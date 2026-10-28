import { NextRequest, NextResponse } from 'next/server';
import { requireClubPerm } from '@/lib/supabase/server-auth';
import { getServiceClient } from '@/lib/supabase/service';
import { durableRateLimit } from '@/lib/rate-limit';
import { CLUB_BRAND_COLUMNS, type ClubBrandRow } from '@/lib/email/club-brand';
import { filterDrafts, materialize, sendClubEmails } from '@/lib/email/club-emails';
import { fixtureChangeNoticeFor, teamAudience, validDate, validTime, type FixtureChangeInput } from '@/lib/email/team-notices';
import { pushConfigured, pushToClub } from '@/lib/push';
import { isUuid } from '@/lib/ids';

// Tells a team when its fixture is cancelled, postponed or moved (F27-2). Sent by Fixtures right
// after the admin saves the change and says yes to "Let the team know?".
//   POST { clubId, matchId, change: 'cancelled' | 'postponed' | 'moved', now: { date, time, venue }, was?: {...} }
// The page sends the new details because its save reaches the database a moment later.

const CHANGES = ['cancelled', 'postponed', 'moved'] as const;
const place = (v: unknown) => (typeof v === 'string' ? v.replace(/[<>]/g, '').trim().slice(0, 200) : '');

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const now = body?.now, was = body?.was;
  if (!isUuid(body?.clubId) || !isUuid(body?.matchId) || !CHANGES.includes(body?.change)
      || !validDate(now?.date) || !validTime(now?.time) || (was && (!validDate(was.date) || !validTime(was.time)))) {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }
  const auth = await requireClubPerm(req, body.clubId, ['matches', 'match-center'], 'edit');
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const db = getServiceClient();
  if (!db) return NextResponse.json({ error: 'Alerts are not set up on the server.' }, { status: 503 });

  const [{ data: club }, { data: match }] = await Promise.all([
    db.from('clubs').select(CLUB_BRAND_COLUMNS).eq('id', body.clubId).maybeSingle(),
    db.from('matches').select('id, slug, team_id, match_type, tournament_id, home_team_name, away_team_name').eq('id', body.matchId).eq('club_id', body.clubId).maybeSingle(),
  ]);
  if (!club || !match) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  if (match.match_type === 'internal' || match.tournament_id) return NextResponse.json({ error: 'Alerts are for club fixtures.' }, { status: 400 });
  if (!(await durableRateLimit(`fixture-alert:${body.clubId}`, 30, 60 * 60 * 1000))) {
    return NextResponse.json({ error: 'That\'s a lot of fixture alerts in an hour. Please wait a while.' }, { status: 429 });
  }

  const input: FixtureChangeInput = {
    change: body.change,
    now: { date: now.date, time: now.time || null, venue: place(now.venue) },
    ...(was ? { was: { date: was.date, time: was.time || null, venue: place(was.venue) } } : {}),
  };
  const audience = await teamAudience(db, body.clubId, match.team_id || null);
  if (!audience) return NextResponse.json({ error: 'Team not found.' }, { status: 404 });
  const notice = fixtureChangeNoticeFor(club as ClubBrandRow, audience, match, input);
  const { due, alreadySent } = await filterDrafts(db, notice.drafts);

  // Inbox copies and push once per change (the same key as the emails' version)
  const once = await durableRateLimit(`notice-once:${notice.onceKey}`, 1, 7 * 24 * 60 * 60 * 1000);
  const [{ error: inboxError }, pushed] = once
    ? await Promise.all([
        notice.inbox.length ? db.from('member_messages').insert(notice.inbox) : Promise.resolve({ error: null }),
        notice.push && pushConfigured() ? pushToClub(db, body.clubId, notice.push) : Promise.resolve(0),
      ])
    : [{ error: null }, 0];
  const report = process.env.RESEND_API_KEY && due.length
    ? await sendClubEmails(db, await materialize(due))
    : { sent: 0, failed: 0, alreadySent: 0 };
  if (inboxError) console.error('[fixture-alert] inbox:', inboxError.message);
  return NextResponse.json({ label: notice.label, members: notice.members, ...report, inbox: once && !inboxError ? notice.inbox.length : 0, pushed, alreadySent: alreadySent + report.alreadySent });
}
