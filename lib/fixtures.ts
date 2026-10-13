import type { Match, TournamentParticipant } from './supabase/types';

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
