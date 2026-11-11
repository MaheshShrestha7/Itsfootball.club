import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service';
import { durableRateLimit, getClientIp } from '@/lib/rate-limit';
import { friendlyOf, opponentName, ourSide, type FriendlyDetails } from '@/lib/friendlies';

// The private link in a "would one of these dates suit?" email (migration 20261158):
//   GET  ?token=...                 the invitation and the dates the club suggested
//   POST { token, date, time }      the visitor picks one; it goes back to the club's Inbox as new
// No sign-in: the token is the key, so it's long, unguessable and only ever emailed to them.

const TOKEN_RE = /^fr-[0-9a-f]{32}$/;

async function find(token: unknown) {
  if (typeof token !== 'string' || !TOKEN_RE.test(token)) return null;
  const db = getServiceClient();
  if (!db) return null;
  const { data } = await db.from('contact_inquiries')
    .select('id, club_id, sender_name, inquiry_type, details, team_id, match_id, status, clubs(name, slug, logo_url), club_teams(name)')
    .eq('response_token', token).maybeSingle();
  if (!data) return null;
  const details = friendlyOf(data as never);
  return details ? { db, row: data as unknown as Row, details } : null;
}

interface Row {
  id: string;
  sender_name: string;
  details: Record<string, unknown>;
  match_id: string | null;
  status: string;
  clubs: { name: string; slug: string; logo_url: string | null } | null;
  club_teams: { name: string } | null;
}

const view = (row: Row, details: FriendlyDetails) => ({
  club: row.clubs?.name || '',
  logo: row.clubs?.logo_url || null,
  /** "Leppington Rovers Reserves v Riverside Rovers Seniors" */
  game: `${opponentName(details)} v ${ourSide(row.clubs?.name || '', row.club_teams?.name || details.team_name)}`,
  first_name: row.sender_name.trim().split(/\s+/)[0] || '',
  suggested: details.suggested || [],
  picked: details.picked || null,
  /** The club already made the fixture: nothing left to pick */
  done: !!row.match_id || row.status === 'archived',
});

// Shared by every Workers isolate (SEC11-8), so spreading tries across them doesn't raise the limit
const throttled = async (req: NextRequest) => !(await durableRateLimit(`friendly:${getClientIp(req.headers)}`, 30, 10 * 60 * 1000));

export async function GET(req: NextRequest) {
  if (await throttled(req)) return NextResponse.json({ error: 'Too many tries. Please wait a few minutes.' }, { status: 429 });
  const found = await find(req.nextUrl.searchParams.get('token'));
  if (!found) return NextResponse.json({ error: 'This link has expired or isn’t right.' }, { status: 404 });
  return NextResponse.json(view(found.row, found.details), { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: NextRequest) {
  if (await throttled(req)) return NextResponse.json({ error: 'Too many tries. Please wait a few minutes.' }, { status: 429 });
  const input = await req.json().catch(() => null);
  const found = await find(input?.token);
  if (!found) return NextResponse.json({ error: 'This link has expired or isn’t right.' }, { status: 404 });
  const { db, row, details } = found;
  if (view(row, details).done) return NextResponse.json({ error: 'The club has already sorted this one out.' }, { status: 409 });
  const pick = (details.suggested || []).find(d => d.date === input?.date && d.time === (input?.time || ''));
  if (!pick) return NextResponse.json({ error: 'Pick one of the dates the club suggested.' }, { status: 400 });

  // Back to the top of the club's Inbox, with the date they picked
  const { error } = await db.from('contact_inquiries')
    .update({ details: { ...row.details, picked: pick }, status: 'unread' }).eq('id', row.id);
  if (error) {
    console.error('[friendly] pick failed:', error.message);
    return NextResponse.json({ error: 'That didn’t save. Please try again.' }, { status: 500 });
  }
  return NextResponse.json(view({ ...row, status: 'unread' }, { ...details, picked: pick }));
}
