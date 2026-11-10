import { NextRequest, NextResponse } from 'next/server';
import { requireClubPerm } from '@/lib/supabase/server-auth';
import { getServiceClient } from '@/lib/supabase/service';
import { durableRateLimit } from '@/lib/rate-limit';
import { pushConfigured, pushToClub } from '@/lib/push';
import { matchAlert, type AlertKind } from '@/lib/match-alerts';
import { isJuniorFixture, publicScoreHidden } from '@/lib/teams';
import { matchPath } from '@/lib/slugs';
import { isUuid } from '@/lib/ids';
import type { ClubTeam, Match } from '@/lib/supabase/types';

// Live-score alerts to the club's followers, sent by Match Centre as the match goes on.
//   POST { clubId, matchId, kind: 'kickoff' | 'goal' | 'fulltime' | 'lineup', home, away, minute? }
// 'lineup' comes from Lineup Draft when the team is published (once a day per match).
// Admins running the match only. Each alert goes once (per score for goals), however often it's called.
// Junior games whose scores the club keeps off its public pages get no alerts, nor do matches
// an admin muted (matches.alerts_muted).
const KINDS: AlertKind[] = ['kickoff', 'goal', 'fulltime', 'lineup'];

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const home = Number(body?.home), away = Number(body?.away);
  if (!isUuid(body?.clubId) || !isUuid(body?.matchId) || !KINDS.includes(body?.kind)
      || !Number.isInteger(home) || !Number.isInteger(away) || home < 0 || away < 0 || home > 99 || away > 99) {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }
  const auth = await requireClubPerm(req, body.clubId, ['match-center', 'matches', 'tournaments', 'lineup'], 'edit');
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const db = getServiceClient();
  if (!db || !pushConfigured()) return NextResponse.json({ pushed: 0, error: 'Notifications are not set up.' }, { status: 503 });

  const [{ data: match }, { data: club }, { data: teams }] = await Promise.all([
    db.from('matches').select('*').eq('id', body.matchId).eq('club_id', body.clubId).maybeSingle(),
    db.from('clubs').select('slug').eq('id', body.clubId).maybeSingle(),
    db.from('club_teams').select('*').eq('club_id', body.clubId),
  ]);
  if (!match || !club) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  // An admin turned follower alerts off for this match (e.g. correcting it after full time)
  if (match.alerts_muted) return NextResponse.json({ pushed: 0, skipped: 'alerts muted' });
  // The line-up alert carries no score, so it still goes for a team that hides its scores
  if (body.kind !== 'lineup' && publicScoreHidden(match as Match, (teams || []) as ClubTeam[])) return NextResponse.json({ pushed: 0, skipped: 'scores hidden' });

  const key = `match-push:${match.id}:${body.kind}${body.kind === 'goal' ? `:${home}-${away}` : ''}`;
  if (!(await durableRateLimit(key, 1, 24 * 60 * 60 * 1000))) return NextResponse.json({ pushed: 0, alreadySent: true });
  const minute = Number.isInteger(body.minute) ? body.minute : undefined;
  // The scorer's name, for a goal. Never for a junior team's game, where names are shortened in public.
  const scorer = body.kind === 'goal' && typeof body.scorer === 'string' && !isJuniorFixture(match as Match, (teams || []) as ClubTeam[])
    ? body.scorer.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 60) || undefined
    : undefined;
  const pushed = await pushToClub(db, body.clubId, {
    ...matchAlert(body.kind, match, home, away, minute, scorer),
    url: matchPath(club.slug, match),
    tag: `match-${match.id}`, // one notification per match on the lock screen, updated as it goes
  });
  return NextResponse.json({ pushed });
}
