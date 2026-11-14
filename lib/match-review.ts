// The coach's review after a game (three questions, table match_reviews) and the cup review that
// gathers every game of an event or tournament. Everything here is counted from what the club
// logged (scores, goal minutes, saved player stats) or copied from what the coach wrote: nothing
// is guessed or rewritten.
import { clubResult, teamSideIn, type ClubOutcome } from './fixtures';
import { fullMinutes } from './match-length';
import type { MatchStatLine } from './match-stats';
import { fairMinutes } from './playing-time';
import type { Match, MatchEvent } from './supabase/types';
import { goalScoringSide } from './teams';

export const REVIEW_MAX = 2000;
export const CUP_SUMMARY_MAX = 4000;

export interface MatchReview { match_id: string; went_well: string; work_on: string; next_week: string }

export const emptyReview = (matchId: string): MatchReview => ({ match_id: matchId, went_well: '', work_on: '', next_week: '' });

/** Whether the coach has written anything for this game */
export const hasReview = (r?: MatchReview | null): boolean =>
  !!r && [r.went_well, r.work_on, r.next_week].some(t => t.trim());

/** A coach's answer as separate points: one per line, list marks dropped */
export const reviewPoints = (text: string): string[] =>
  text.split(/\r?\n/).map(l => l.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, '').trim()).filter(Boolean);

type ResultMatch = Pick<Match, 'is_club_home' | 'home_score' | 'away_score' | 'home_penalty_score' | 'away_penalty_score' | 'match_type' | 'tournament_id' | 'home_team_name' | 'away_team_name'>;

/** The side the club's team is on. In a tournament every game is stored "at home", so the side
 *  comes from the team's name there. */
export function ourSide(m: ResultMatch, teamName?: string): 'home' | 'away' {
  if (m.tournament_id) return teamName ? teamSideIn(m, teamName) : 'home';
  return m.match_type !== 'internal' && m.is_club_home === false ? 'away' : 'home';
}

/** A finished game from our team's side. A tournament game has a result once we know which team is ours. */
export function gameResult(m: ResultMatch, teamName?: string): { us: number; them: number; outcome: ClubOutcome | null; onPens: boolean } {
  if (!m.tournament_id || !teamName) return clubResult(m);
  const home = ourSide(m, teamName) === 'home';
  const us = (home ? m.home_score : m.away_score) ?? 0;
  const them = (home ? m.away_score : m.home_score) ?? 0;
  if (us !== them) return { us, them, outcome: us > them ? 'W' : 'L', onPens: false };
  const pUs = home ? m.home_penalty_score : m.away_penalty_score;
  const pThem = home ? m.away_penalty_score : m.home_penalty_score;
  if (pUs != null && pThem != null && pUs !== pThem) return { us, them, outcome: pUs > pThem ? 'W' : 'L', onPens: true };
  return { us, them, outcome: 'D', onPens: false };
}

export interface CupNumbers {
  played: number; won: number; drawn: number; lost: number;
  scored: number; conceded: number; cleanSheets: number;
  /** Goals against with a logged minute, and how many of those came in the last 15 minutes */
  concededLogged: number; concededLate: number;
  /** False when we can't tell which side is ours (a tournament with no club team picked): only `played` means anything */
  hasResults: boolean;
}

type NumbersMatch = ResultMatch & Pick<Match, 'id' | 'status' | 'match_format' | 'half_minutes'>;

/** The cup in numbers, from its finished games and their logged goals */
export function cupNumbers(games: NumbersMatch[], events: Pick<MatchEvent, 'match_id' | 'event_type' | 'team_side' | 'minute'>[], teamName?: string): CupNumbers {
  const n: CupNumbers = { played: 0, won: 0, drawn: 0, lost: 0, scored: 0, conceded: 0, cleanSheets: 0, concededLogged: 0, concededLate: 0, hasResults: false };
  for (const m of games) {
    if (m.status !== 'completed') continue;
    n.played += 1;
    const r = gameResult(m, teamName);
    if (!r.outcome) continue;
    n.hasResults = true;
    if (r.outcome === 'W') n.won += 1; else if (r.outcome === 'D') n.drawn += 1; else n.lost += 1;
    n.scored += r.us;
    n.conceded += r.them;
    if (r.them === 0) n.cleanSheets += 1;
    const side = ourSide(m, teamName);
    const lateFrom = fullMinutes(m) - 15;
    for (const e of events) {
      if (e.match_id !== m.id) continue;
      const to = goalScoringSide(e);
      if (!to || to === side) continue;
      n.concededLogged += 1;
      if (e.minute > lateFrom) n.concededLate += 1;
    }
  }
  return n;
}

/** Players on the pitch for a format: '7v7' -> 7 */
const onField = (format?: string | null): number | null => {
  const n = parseInt(format || '', 10);
  return n >= 3 && n <= 11 ? n : null;
};

export interface MinutesRow { member_id: string; games: number; minutes: number; underHalf: boolean }

/**
 * Minutes per player across some games, most first. Only games whose saved stats recorded minutes
 * count (stats saved without a line-up have none), so a player isn't flagged by a gap in the data.
 * `underHalf`: played, but under half of the minutes those games offered.
 */
export function minutesAcross(
  games: Pick<Match, 'id' | 'match_format' | 'half_minutes'>[],
  linesByMatch: Record<string, MatchStatLine[] | undefined>,
): { rows: MinutesRow[]; total: number; fair: number | null } {
  const rows = new Map<string, MinutesRow>();
  let total = 0, fairSum = 0, fairKnown = true;
  for (const g of games) {
    const played = (linesByMatch[g.id] || []).filter(l => l.played);
    if (!played.some(l => l.minutes > 0)) continue;
    const full = fullMinutes(g);
    total += full;
    const n = onField(g.match_format);
    if (n) fairSum += fairMinutes(n, Math.max(played.length, n), full); else fairKnown = false;
    for (const l of played) {
      const row = rows.get(l.member_id) || { member_id: l.member_id, games: 0, minutes: 0, underHalf: false };
      row.games += 1;
      row.minutes += l.minutes;
      rows.set(l.member_id, row);
    }
  }
  const list = [...rows.values()].sort((a, b) => b.minutes - a.minutes);
  list.forEach(r => { r.underHalf = r.minutes > 0 && r.minutes < total / 2; });
  return { rows: list, total, fair: total && fairKnown ? Math.round(fairSum) : null };
}

const norm = (s?: string | null) => (s || '').trim().toLowerCase();

/** The club's own team in a tournament game: the one side that is one of the club's entries.
 *  None when neither or both are (two of the club's teams playing each other), or outside a tournament. */
export function ourTeamIn(
  m: Pick<Match, 'tournament_id' | 'home_team_name' | 'away_team_name'>,
  participants: { tournament_id: string; team_type: string; name: string }[],
): string | undefined {
  if (!m.tournament_id) return undefined;
  const own = participants.filter(p => p.tournament_id === m.tournament_id && p.team_type === 'internal').map(p => norm(p.name));
  const sides = [m.home_team_name, m.away_team_name].filter(n => own.includes(norm(n)));
  return sides.length === 1 ? sides[0] : undefined;
}

/** Who the game was against: "Westside Rovers", or "Blue v Red" when neither side is "us" */
export function opponentName(m: ResultMatch & Pick<Match, 'opponent_name'>, teamName?: string): string {
  if (m.tournament_id ? !teamName : m.match_type === 'internal') return `${m.home_team_name} v ${m.away_team_name}`;
  if (!m.tournament_id && m.opponent_name) return m.opponent_name;
  return ourSide(m, teamName) === 'home' ? m.away_team_name : m.home_team_name;
}
