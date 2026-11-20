import { NextRequest, NextResponse } from 'next/server';
import { requireClubPerm } from '@/lib/supabase/server-auth';
import { getServiceClient } from '@/lib/supabase/service';
import { pushConfigured } from '@/lib/push';
import { type AlertKind } from '@/lib/match-alerts';
import { sendMatchAlert } from '@/lib/match-push-server';
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
  const result = await sendMatchAlert(db, club.slug, match as Match, (teams || []) as ClubTeam[], body.kind, home, away,
    Number.isInteger(body.minute) ? body.minute : undefined, typeof body.scorer === 'string' ? body.scorer : undefined);
  return NextResponse.json(result);
}
