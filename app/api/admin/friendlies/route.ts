import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { requireClubPerm } from '@/lib/supabase/server-auth';
import { getServiceClient } from '@/lib/supabase/service';
import { CLUB_BRAND_COLUMNS, clubBaseUrl, clubBrand } from '@/lib/email/club-brand';
import { sendClubEmails, looksLikeEmail } from '@/lib/email/club-emails';
import { friendlyConfirm, friendlySuggest, friendlyUpdate, inquiryReply } from '@/lib/email/templates';
import { dateLabel, friendlyOf, parseSuggested } from '@/lib/friendlies';
import {
  FRIENDLY_INQUIRY_COLUMNS, FRIENDLY_MATCH_COLUMNS, friendlyChange, matchdayPack,
  type FriendlyClubRow, type FriendlyMatchRow,
} from '@/lib/friendly-server';
import { localDate } from '@/lib/email/format';
import { isUuid, secureToken } from '@/lib/ids';

// Friendly invitations, the club's side (migration 20261158).
//   POST { action: 'suggest', clubId, inquiryId, body, dates, senderName }
//        Other dates for the visitor. Saved as a reply; the email has a private link where they
//        pick one (/{club}/friendly/{token}). Before the migration it goes as a plain reply.
//   POST { action: 'confirm', clubId, inquiryId, matchId, senderName }
//        "It's on": the match page, add to calendar, directions and the ground guide.
//   POST { action: 'update', clubId, inquiryId, matchId, expect, senderName }
//        The date, time or ground changed, or the game was postponed or called off.
// The fixture is saved from the admin's browser and reaches the database a moment later, so confirm
// and update wait a few seconds for it (`expect` is what the admin just saved).
// Every email is also saved to the enquiry's reply history, so the Inbox shows what was sent.

const clean = (s: unknown, max: number) => (typeof s === 'string' ? s.replace(/[<>]/g, '').trim().slice(0, max) : '');
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

type Snapshot = Pick<FriendlyMatchRow, 'match_date' | 'match_time' | 'venue' | 'status'>;
const snapshotOf = (m: FriendlyMatchRow): Snapshot => ({ match_date: m.match_date, match_time: m.match_time || '', venue: m.venue || '', status: m.status });

/** Timestamps come back from the database written differently ("+00:00" for "Z") */
const same = (k: keyof Snapshot, a: unknown, b: unknown) => {
  if (k === 'match_date') return Date.parse(String(a)) === Date.parse(String(b));
  const x = String(a ?? '').trim();
  const y = String(b ?? '').trim();
  return k === 'match_time' ? x.slice(0, 5) === y.slice(0, 5) : x === y;
};

/** A short fingerprint of what was sent, for the email's once-only key */
const fingerprint = (s: string) => {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
};

/** The fixture, once it has reached the database (and matches what the admin saved, when given) */
async function waitForMatch(db: SupabaseClient, clubId: string, matchId: string, expect?: Partial<Snapshot>): Promise<FriendlyMatchRow | null> {
  let last: FriendlyMatchRow | null = null;
  for (let i = 0; i < 7; i++) {
    const { data } = await db.from('matches').select(FRIENDLY_MATCH_COLUMNS).eq('id', matchId).eq('club_id', clubId).maybeSingle();
    last = (data as FriendlyMatchRow | null) || null;
    const settled = last && (!expect || (Object.keys(expect) as (keyof Snapshot)[]).every(k => same(k, expect[k], (last as FriendlyMatchRow)[k])));
    if (settled) return last;
    await sleep(1200);
  }
  return last;
}

async function loadClub(db: SupabaseClient, clubId: string): Promise<FriendlyClubRow | null> {
  const { data } = await db.from('clubs').select(`${CLUB_BRAND_COLUMNS}, contact_email, contact_phone`).eq('id', clubId).maybeSingle();
  if (!data) return null;
  // The home ground column comes from the grounds migrations; without it there's just no guide link
  const { data: home, error } = await db.from('clubs').select('home_ground_id').eq('id', clubId).maybeSingle();
  return { ...(data as FriendlyClubRow), home_ground_id: error ? null : (home?.home_ground_id ?? null) };
}

export async function POST(req: NextRequest) {
  const input = await req.json().catch(() => null);
  const action = input?.action;
  if (!['suggest', 'confirm', 'update'].includes(action) || !isUuid(input?.clubId) || !isUuid(input?.inquiryId)) {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }
  if (action !== 'suggest' && !isUuid(input?.matchId)) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });

  // Suggesting dates is an Inbox reply; the confirmation and updates go with saving the fixture
  const auth = await requireClubPerm(req, input.clubId, action === 'suggest' ? ['inquiries'] : ['matches', 'inquiries'], 'edit');
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const db = getServiceClient();
  if (!db) return NextResponse.json({ error: 'Emails cannot be sent right now.' }, { status: 503 });

  const [{ data: row }, club] = await Promise.all([
    db.from('contact_inquiries').select(FRIENDLY_INQUIRY_COLUMNS).eq('id', input.inquiryId).eq('club_id', input.clubId).maybeSingle(),
    loadClub(db, input.clubId),
  ]);
  const inquiry = row as (Record<string, unknown> & { id: string; club_id: string; sender_name: string; sender_email: string; inquiry_type: string; message: string; details: Record<string, unknown> | null; team_id: string | null; match_id: string | null; response_token?: string | null }) | null;
  const details = inquiry ? friendlyOf(inquiry as never) : null;
  if (!inquiry || !club || !details) return NextResponse.json({ error: 'Invitation not found.' }, { status: 404 });

  const { data: team } = inquiry.team_id
    ? await db.from('club_teams').select('name').eq('id', inquiry.team_id).maybeSingle()
    : { data: null };
  const teamName = team?.name || details.team_name || club.name;
  const brand = clubBrand(club);
  const replyTo = looksLikeEmail(club.contact_email) ? club.contact_email.trim() : undefined;
  const canEmail = !!process.env.RESEND_API_KEY && looksLikeEmail(inquiry.sender_email);
  const senderName = clean(input.senderName, 255) || null;
  const raw = { ...(inquiry.details || {}) };

  /** Saves what was sent to the reply history, so the Inbox shows it */
  const record = async (body: string) => {
    const { data: reply, error } = await db.from('contact_inquiry_replies').insert({
      inquiry_id: inquiry.id, club_id: inquiry.club_id, body, sent_by_name: senderName, sent_by_user: auth.userId,
    }).select('*').single();
    if (error) console.error('[friendlies] reply save failed:', error.message);
    return reply as Record<string, unknown> | null;
  };
  const markEmailed = async (reply: Record<string, unknown> | null) => {
    if (!reply) return;
    await db.from('contact_inquiry_replies').update({ emailed: true }).eq('id', reply.id as string);
    reply.emailed = true;
  };
  const send = async (key: string, kind: 'friendly_suggest' | 'friendly_confirm' | 'friendly_update' | 'inquiry_reply', email: ReturnType<typeof friendlyConfirm>) => {
    if (!canEmail) return false;
    const report = await sendClubEmails(db, [{
      key, clubId: club.id, kind, refId: inquiry.id, to: inquiry.sender_email.trim(), fromName: club.name, replyTo, email,
    }]);
    if (report.error) console.error('[friendlies] email failed:', report.error);
    return report.sent > 0;
  };
  const fresh = async () => (await db.from('contact_inquiries').select('*').eq('id', inquiry.id).maybeSingle()).data;

  // ---------------------------------------------------------------------------------------------
  if (action === 'suggest') {
    const text = clean(input.body, 4000);
    if (!text) return NextResponse.json({ error: 'Write a message to go with the dates.' }, { status: 400 });
    const parsed = parseSuggested(input.dates, localDate(-1));
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

    const token = inquiry.response_token || secureToken('fr');
    const next = { ...raw, suggested: parsed.dates };
    delete (next as Record<string, unknown>).picked;
    const { error: saveError } = await db.from('contact_inquiries')
      .update({ details: next, response_token: token, status: 'replied' }).eq('id', inquiry.id);
    // Before migration 20261158 there's no token column: it still goes, as a normal reply
    const linked = !saveError;
    if (!linked) await db.from('contact_inquiries').update({ status: 'replied' }).eq('id', inquiry.id);

    const reply = await record(text);
    if (!reply) return NextResponse.json({ error: 'The reply could not be saved.' }, { status: 500 });
    const link = `${clubBaseUrl(club)}/friendly/${encodeURIComponent(token)}`;
    const emailed = linked
      ? await send(`friendly_suggest:${reply.id}`, 'friendly_suggest', friendlySuggest({
          brand, senderName: inquiry.sender_name, teamName, message: text, dates: parsed.dates.map(dateLabel), link, canReply: !!replyTo,
        }))
      : await send(`inquiry_reply:${reply.id}`, 'inquiry_reply', inquiryReply({
          brand, senderName: inquiry.sender_name, reply: text, inquiryType: inquiry.inquiry_type, original: inquiry.message || '', canReply: !!replyTo,
        }));
    if (emailed) await markEmailed(reply);
    return NextResponse.json({ reply, emailed, linked, inquiry: await fresh() });
  }

  // ---------------------------------------------------------------------------------------------
  const expect = input.expect && typeof input.expect === 'object'
    ? {
        match_date: clean(input.expect.match_date, 40), match_time: clean(input.expect.match_time, 8),
        venue: clean(input.expect.venue, 300), status: clean(input.expect.status, 20),
      }
    : undefined;
  const match = await waitForMatch(db, club.id, input.matchId, expect);
  if (!match) return NextResponse.json({ error: 'The fixture hasn’t saved yet. Try again in a moment.' }, { status: 409 });

  const sentBefore = (raw.sent && typeof raw.sent === 'object' ? raw.sent : {}) as Record<string, Snapshot>;
  const pack = await matchdayPack(db, club, match, details, teamName);

  if (action === 'confirm') {
    const sent = { ...sentBefore, [match.id]: snapshotOf(match) };
    const { error: linkError } = await db.from('contact_inquiries').update({
      details: { ...raw, sent }, status: 'replied', ...(inquiry.match_id ? {} : { match_id: match.id }),
    }).eq('id', inquiry.id);
    if (linkError) console.error('[friendlies] link failed:', linkError.message);
    const reply = await record(`Sent the confirmation: ${pack.facts.title}, ${pack.facts.when}. ${pack.facts.where}.`);
    const emailed = await send(`friendly_confirm:${inquiry.id}:${match.id}`, 'friendly_confirm', friendlyConfirm({
      brand, senderName: inquiry.sender_name, facts: pack.facts, matchUrl: pack.matchUrl, links: pack.links, canReply: !!replyTo,
    }));
    if (emailed) await markEmailed(reply);
    return NextResponse.json({ reply, emailed, inquiry: await fresh() });
  }

  // update: only when they were sent this fixture, and something they'd care about changed
  const before = sentBefore[match.id];
  if (!before) return NextResponse.json({ sent: false, reason: 'They haven’t been sent this fixture yet.' });
  const change = friendlyChange(before, match);
  if (!change) return NextResponse.json({ sent: false, reason: 'Nothing they need to know about changed.' });
  const { error: snapError } = await db.from('contact_inquiries')
    .update({ details: { ...raw, sent: { ...sentBefore, [match.id]: snapshotOf(match) } } }).eq('id', inquiry.id);
  if (snapError) console.error('[friendlies] snapshot failed:', snapError.message);
  const was = change === 'changed' ? (await matchdayPack(db, club, { ...match, ...before }, details, teamName)).facts.when : null;
  const reply = await record(
    change === 'cancelled' ? `Told them the game is called off (${pack.facts.when}).`
      : change === 'postponed' ? `Told them the game is postponed (${pack.facts.when}).`
        : `Sent the new details: ${pack.facts.when}. ${pack.facts.where}.`,
  );
  const key = `friendly_update:${inquiry.id}:${match.id}:${fingerprint([match.status, Date.parse(match.match_date), match.match_time, match.venue].join('|'))}`;
  const emailed = await send(key, 'friendly_update', friendlyUpdate({
    brand, senderName: inquiry.sender_name, change, facts: pack.facts, was: was !== pack.facts.when ? was : null,
    matchUrl: pack.matchUrl, links: pack.links, canReply: !!replyTo,
  }));
  if (emailed) await markEmailed(reply);
  return NextResponse.json({ sent: true, change, reply, emailed, inquiry: await fresh() });
}
