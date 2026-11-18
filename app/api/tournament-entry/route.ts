import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service';
import { durableRateLimit, getClientIp } from '@/lib/rate-limit';
import { matchesFileSignature } from '@/lib/file-signature';
import { isR2Configured, uploadBufferToR2 } from '@/lib/storage/r2';
import { entryOpen, parseEntry } from '@/lib/hosted-tournaments';
import { findEntryByKey, loadEntryView, tournamentTitle } from '@/lib/tournament-entries-server';
import { looksLikeEmail } from '@/lib/email/recipient';

// A guest club's team entry link (hosted tournaments, migration 20261180). The key is the credential.
//   GET  ?k=...                               the team's entry, games, entry fee and (once done) report
//   POST multipart { k, data (JSON), crest? }  save the entry; data.submit sends it to the host club.
//        Closed after the entry deadline. The team's name stays the host's: fixtures are keyed on it.

const MAX_CREST = 2 * 1024 * 1024;
const CREST_TYPES: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };
const PRIVATE = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' };
const BAD_LINK = 'This link isn\'t working. Ask the host club for a new one.';

export async function GET(req: NextRequest) {
  if (!(await durableRateLimit(`team-entry:${getClientIp(req.headers)}`, 60, 10 * 60 * 1000))) {
    return NextResponse.json({ error: 'Too many requests. Please wait a few minutes.' }, { status: 429, headers: PRIVATE });
  }
  const db = getServiceClient();
  if (!db) return NextResponse.json({ error: 'This page is not available right now.' }, { status: 503, headers: PRIVATE });
  const found = await findEntryByKey(db, req.nextUrl.searchParams.get('k'));
  if (!found) return NextResponse.json({ error: BAD_LINK }, { status: 404, headers: PRIVATE });
  return NextResponse.json(await loadEntryView(db, found), { headers: PRIVATE });
}

export async function POST(req: NextRequest) {
  if (Number(req.headers.get('content-length') || 0) > MAX_CREST + 512 * 1024) {
    return NextResponse.json({ error: 'The crest must be 2 MB or smaller.' }, { status: 413, headers: PRIVATE });
  }
  if (!(await durableRateLimit(`team-entry-save:${getClientIp(req.headers)}`, 30, 60 * 60 * 1000))) {
    return NextResponse.json({ error: 'Too many saves in an hour. Please try again a little later.' }, { status: 429, headers: PRIVATE });
  }
  const db = getServiceClient();
  if (!db) return NextResponse.json({ error: 'This page is not available right now.' }, { status: 503, headers: PRIVATE });

  const form = await req.formData().catch(() => null);
  const found = await findEntryByKey(db, form?.get('k'));
  if (!found) return NextResponse.json({ error: BAD_LINK }, { status: 404, headers: PRIVATE });
  const { entry, team, tournament, club } = found;
  if (!entryOpen(tournament)) {
    return NextResponse.json({ error: 'Entries have closed. Contact the host club to change anything.' }, { status: 409, headers: PRIVATE });
  }

  let data: unknown;
  try { data = JSON.parse(String(form?.get('data') ?? '{}')); } catch { data = null; }
  const parsed = parseEntry(data, tournament.max_squad);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400, headers: PRIVATE });
  const v = parsed.value;

  let logoUrl: string | null = null;
  const file = form?.get('crest');
  if (file instanceof File && file.size > 0) {
    const type = (file.type || '').toLowerCase();
    if (!CREST_TYPES[type]) return NextResponse.json({ error: 'Please send a PNG, JPG or WebP image.' }, { status: 415, headers: PRIVATE });
    if (file.size > MAX_CREST) return NextResponse.json({ error: 'The crest must be 2 MB or smaller.' }, { status: 413, headers: PRIVATE });
    const buffer = Buffer.from(await file.arrayBuffer());
    if (!matchesFileSignature(buffer, type)) return NextResponse.json({ error: 'That file isn\'t the image it says it is.' }, { status: 415, headers: PRIVATE });
    const key = `clubs/${club.id}/tournaments/${tournament.id}/${crypto.randomUUID()}.${CREST_TYPES[type]}`;
    if (isR2Configured) logoUrl = await uploadBufferToR2(key, buffer, type);
    if (!logoUrl) {
      const { error } = await db.storage.from('club-assets').upload(key, buffer, { contentType: type, upsert: false });
      if (!error) logoUrl = db.storage.from('club-assets').getPublicUrl(key).data.publicUrl;
      else console.error('[team-entry] crest upload failed:', error.message);
    }
    if (!logoUrl) return NextResponse.json({ error: 'The crest could not be saved right now. Please try again later.' }, { status: 503, headers: PRIVATE });
  }

  // Public team details (shown on the draw and the team page)
  const teamUpdate = {
    manager_name: v.manager_name, coach_name: v.coach_name,
    ...(v.color ? { color: v.color } : {}),
    secondary_color: v.secondary_color,
    ...(logoUrl ? { logo_url: logoUrl } : {}),
  };
  const { error: teamError } = await db.from('tournament_participants').update(teamUpdate).eq('id', team.id);
  if (teamError) return NextResponse.json({ error: 'Could not save your entry. Please try again.' }, { status: 500, headers: PRIVATE });
  // Fixtures carry the crest themselves
  if (logoUrl) {
    await db.from('matches').update({ home_team_logo: logoUrl }).eq('tournament_id', tournament.id).eq('home_team_name', team.name);
    await db.from('matches').update({ away_team_logo: logoUrl }).eq('tournament_id', tournament.id).eq('away_team_name', team.name);
  }

  // The squad: replaced as a whole, in the order sent
  const { error: delError } = await db.from('tournament_squads').delete().eq('participant_id', team.id);
  if (delError) return NextResponse.json({ error: 'Could not save your players. Please try again.' }, { status: 500, headers: PRIVATE });
  if (v.players.length) {
    const { error } = await db.from('tournament_squads').insert(v.players.map((p, i) => ({
      participant_id: team.id, tournament_id: tournament.id, club_id: club.id, ...p, sort_order: i,
    })));
    if (error) return NextResponse.json({ error: 'Could not save your players. Please try again.' }, { status: 500, headers: PRIVATE });
  }

  const now = new Date().toISOString();
  const firstSubmit = v.submit && entry.status !== 'submitted';
  const { error: entryError } = await db.from('tournament_entries').update({
    contact_name: v.contact_name, contact_phone: v.contact_phone,
    assistant_name: v.assistant_name, first_aid_name: v.first_aid_name,
    status: v.submit || entry.status === 'submitted' ? 'submitted' : 'in_progress',
    ...(firstSubmit ? { submitted_at: now } : {}),
  }).eq('participant_id', team.id);
  if (entryError) return NextResponse.json({ error: 'Could not save your entry. Please try again.' }, { status: 500, headers: PRIVATE });

  // Tell the host in their Inbox once, when the entry first arrives (best effort)
  if (firstSubmit && looksLikeEmail(entry.contact_email)) {
    await db.from('contact_inquiries').insert({
      club_id: club.id,
      sender_name: v.contact_name || v.manager_name || team.name,
      sender_email: entry.contact_email,
      sender_phone: v.contact_phone,
      inquiry_type: 'General Inquiry',
      message: `${team.name} sent their team entry for ${tournamentTitle(tournament)}: ${v.players.length} player${v.players.length === 1 ? '' : 's'}, manager ${v.manager_name}.\n\nSee it under Tournaments, ${tournament.name}, Teams.`,
      status: 'unread',
    }).then(() => undefined, () => undefined);
  }

  const fresh = await findEntryByKey(db, form?.get('k'));
  return NextResponse.json(fresh ? await loadEntryView(db, fresh) : { ok: true }, { headers: PRIVATE });
}
