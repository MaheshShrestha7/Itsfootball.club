// Live-score push alerts for people following a club (the bell / "Follow the club"): kick-off,
// each goal and full time. Match Centre spots the change (alertFor) and the server sends it (matchAlert).

/** 'lineup' is sent by Lineup Draft when the coach publishes the team, not by a change in the score */
export type AlertKind = 'kickoff' | 'goal' | 'fulltime' | 'lineup';
export interface MatchState { status: string; home: number; away: number }

/** The alert a change in a match calls for, if any. Corrections (a score going down) and anything
 *  before kick-off stay quiet. */
export function alertFor(prev: MatchState, next: MatchState): AlertKind | null {
  const live = (s: string) => s === 'live' || s === 'halftime';
  if (next.status === 'completed' && prev.status !== 'completed') return 'fulltime';
  if (live(next.status) && prev.status === 'upcoming') return 'kickoff';
  if (live(next.status) && live(prev.status) && next.home + next.away > prev.home + prev.away) return 'goal';
  return null;
}

/** The notification text: score first, so it reads on a lock screen */
export function matchAlert(kind: AlertKind, m: { home_team_name: string; away_team_name: string }, home: number, away: number, minute?: number) {
  const score = `${m.home_team_name} ${home}–${away} ${m.away_team_name}`;
  if (kind === 'lineup') return { title: 'The line-up is out', body: `${m.home_team_name} v ${m.away_team_name}. See who\u2019s starting.` };
  if (kind === 'kickoff') return { title: 'Kick-off', body: `${m.home_team_name} v ${m.away_team_name} is under way` };
  if (kind === 'goal') return { title: `Goal! ${score}`, body: minute ? `${minute}'` : 'Follow it live' };
  return { title: `Full time: ${score}`, body: 'See the match report' };
}
