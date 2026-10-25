import { countsTowardClubRecord, type Match, type TournamentParticipant } from './supabase/types';

/** Kickoff as a timestamp, for sorting (0 when the date can't be read) */
export function kickoff(m: Pick<Match, 'match_date'>): number {
  const t = Date.parse(m.match_date);
  return Number.isNaN(t) ? 0 : t;
}

export const soonestFirst = (a: Pick<Match, 'match_date'>, b: Pick<Match, 'match_date'>) => kickoff(a) - kickoff(b);
export const latestFirst = (a: Pick<Match, 'match_date'>, b: Pick<Match, 'match_date'>) => kickoff(b) - kickoff(a);

/** Whether the club's own players take part: every match outside a tournament, and tournament
 *  matches unless both sides are invited (external) teams. A club hosting a cup between other
 *  clubs shouldn't list those games as its own fixtures or ask its players to RSVP for them.
 *  When the entries aren't known (not loaded yet, or "Winner of SF1"), the match counts. */
export function clubPlaysIn(
  m: Pick<Match, 'tournament_id' | 'home_team_name' | 'away_team_name'>,
  participants: Pick<TournamentParticipant, 'tournament_id' | 'team_type' | 'name'>[],
  clubName: string,
): boolean {
  if (!m.tournament_id) return true;
  const norm = (s?: string | null) => (s || '').trim().toLowerCase();
  const club = norm(clubName);
  const external = new Set(
    participants.filter(p => p.tournament_id === m.tournament_id && p.team_type === 'external').map(p => norm(p.name)),
  );
  const isExternal = (name: string) => external.has(norm(name)) && norm(name) !== club;
  return !(isExternal(m.home_team_name) && isExternal(m.away_team_name));
}

export type MatchKind = 'club' | 'tournament' | 'inhouse';

/** Which Match Centre list a game sits in: a game in one of the club's tournaments (whoever plays),
 *  two of the club's own teams against each other, or a game against another club (league, cup or
 *  friendly; a cup game typed in by hand without a tournament is one of these too). */
export function matchKind(m: Pick<Match, 'tournament_id' | 'match_type'>): MatchKind {
  if (m.tournament_id) return 'tournament';
  return m.match_type === 'internal' ? 'inhouse' : 'club';
}

/** The fixture an admin page should open on: the live one (unless `skipLive`, for pages about the
 *  next game such as availability), else the club's next fixture, else its latest result (and only
 *  then other teams' tournament games). */
export function defaultFixture<M extends Match>(
  matches: M[],
  participants: Pick<TournamentParticipant, 'tournament_id' | 'team_type' | 'name'>[],
  clubName: string,
  { skipLive = false }: { skipLive?: boolean } = {},
): M | undefined {
  const live = matches.find(m => m.status === 'live' || m.status === 'halftime');
  if (live && !skipLive) return live;
  const ours = matches.filter(m => clubPlaysIn(m, participants, clubName));
  const upcoming = ours.filter(m => m.status === 'upcoming').sort(soonestFirst);
  // A match left on "upcoming" after its day (never updated) shouldn't win over the real next one
  const dayAgo = Date.now() - 86400000;
  const next = upcoming.find(m => kickoff(m) >= dayAgo) || upcoming[0];
  if (next) return next;
  return live || ours.filter(m => m.status === 'completed').sort(latestFirst)[0] || [...matches].sort(latestFirst)[0];
}

export type ClubOutcome = 'W' | 'D' | 'L';

/** A finished match from the club's side: its own score first, the opponent's second, and W/D/L.
 *  Level games decided on penalties count as a win or loss. Internal and tournament matches
 *  (is_club_home is true whoever plays there) have no outcome and keep home-away order. */
export function clubResult(
  m: Pick<Match, 'is_club_home' | 'home_score' | 'away_score' | 'home_penalty_score' | 'away_penalty_score' | 'match_type' | 'tournament_id'>,
): { us: number; them: number; outcome: ClubOutcome | null; onPens: boolean } {
  const home = m.is_club_home !== false;
  const us = (home ? m.home_score : m.away_score) ?? 0;
  const them = (home ? m.away_score : m.home_score) ?? 0;
  if (!countsTowardClubRecord(m)) return { us: m.home_score ?? 0, them: m.away_score ?? 0, outcome: null, onPens: false };
  if (us !== them) return { us, them, outcome: us > them ? 'W' : 'L', onPens: false };
  const pUs = home ? m.home_penalty_score : m.away_penalty_score;
  const pThem = home ? m.away_penalty_score : m.home_penalty_score;
  if (pUs != null && pThem != null && pUs !== pThem) return { us, them, outcome: pUs > pThem ? 'W' : 'L', onPens: true };
  return { us, them, outcome: 'D', onPens: false };
}

export const OUTCOME_LABEL: Record<ClubOutcome, string> = { W: 'Win', D: 'Draw', L: 'Loss' };

/** Whether match_date is the kickoff instant. Tournament fixtures store just the date (or midnight
 *  UTC) with the local time in match_time, the same rule as matchTimes() in lib/calendar.ts. */
export function hasKickoffTime(m: Pick<Match, 'match_date' | 'match_time'>): boolean {
  if (!m.match_date || /^\d{4}-\d{2}-\d{2}$/.test(m.match_date)) return false;
  const d = new Date(m.match_date);
  if (Number.isNaN(d.getTime())) return false;
  return !(m.match_time && d.getUTCHours() === 0 && d.getUTCMinutes() === 0);
}
