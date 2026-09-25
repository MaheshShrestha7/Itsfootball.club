// ==============================================================================
// itsfootball.club: Soccer Tournament Engine (Challonge Parity for Football)
// ==============================================================================

import {
  Tournament,
  TournamentParticipant,
  TournamentStanding,
  Match
} from './supabase/types';
import { DEFAULT_CREST } from '@/lib/crest';
import { stableId } from './ids';

// Human-readable stage titles
export const STAGE_TITLES: Record<string, string> = {
  group: 'Group Stage',
  round_of_32: 'Round of 32',
  round_of_16: 'Round of 16',
  quarter_final: 'Quarter-Finals',
  semi_final: 'Semi-Finals',
  final: 'Grand Final',
  third_place: '3rd Place Playoff',
};

export const GROUP_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

export interface TiesheetOptions {
  shuffle?: boolean;
}

const DAY = 86400000;
const pad = (n: number) => String(n).padStart(2, '0');

/** Date-only values (older tournaments) start at 15:00 local instead of midnight UTC */
export function parseTournamentDate(value?: string): Date | null {
  if (!value) return null;
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T15:00` : value);
  return isNaN(d.getTime()) ? null : d;
}

/** Local "YYYY-MM-DDTHH:mm" for <input type="datetime-local"> */
export function toDateTimeLocal(value?: string): string {
  const d = parseTournamentDate(value);
  if (!d) return '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Kick-off for each scheduling round: round 0 starts at the tournament start, the last round
 * lands on the end date, rounds in between are spread evenly (whole days, same kick-off time).
 */
function scheduler(tournament: Tournament, totalRounds: number) {
  const start = parseTournamentDate(tournament.start_date) || new Date();
  const end = parseTournamentDate(tournament.end_date);
  const spanDays = end ? Math.max(0, Math.floor((end.getTime() - start.getTime()) / DAY)) : (totalRounds - 1) * 7;
  const gapDays = totalRounds > 1 ? Math.floor(spanDays / (totalRounds - 1)) : 0;
  return (round: number) => {
    const d = new Date(start.getTime() + round * gapDays * DAY);
    return {
      match_date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
      match_time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
    };
  };
}

function baseMatch(tournament: Tournament, fields: Partial<Match>): Match {
  return {
    club_id: tournament.club_id,
    tournament_id: tournament.id,
    competition: tournament.name,
    season: tournament.season,
    match_type: 'tournament',
    is_club_home: true,
    venue: tournament.venue || 'Home Stadium Arena',
    status: 'upcoming',
    home_score: 0,
    away_score: 0,
    current_minute: 0,
    added_time: 0,
    period: 'pre_match',
    home_formation: '4-3-3',
    away_formation: '4-3-3',
    match_format: '11v11',
    door_qr_checkin_enabled: true,
    checkin_count: 0,
    ...fields,
  } as Match;
}

/**
 * Standard tournament bracket seeding order for a given power of 2.
 * E.g., for 8 teams: [1, 8, 4, 5, 2, 7, 3, 6]
 */
export function getStandardSeedingOrder(numTeams: number): number[] {
  let seeds = [1, 2];
  while (seeds.length < numTeams) {
    const nextLength = seeds.length * 2;
    const nextSeeds: number[] = [];
    for (const seed of seeds) {
      nextSeeds.push(seed);
      nextSeeds.push(nextLength + 1 - seed);
    }
    seeds = nextSeeds;
  }
  return seeds;
}

const nextPow2 = (n: number) => {
  let size = 2;
  while (size < n) size *= 2;
  return size;
};

export const knockoutRoundCount = (entrants: number) => (entrants < 2 ? 0 : Math.log2(nextPow2(entrants)));

/** Stage of the knockout round that starts with this many entrants */
export function knockoutStageFor(entrants: number): NonNullable<Match['tournament_stage']> {
  // ponytail: 33+ entrants still label their opening rounds "Round of 32"
  const stages = ['final', 'semi_final', 'quarter_final', 'round_of_16', 'round_of_32'] as const;
  return stages[Math.min(knockoutRoundCount(entrants) - 1, stages.length - 1)];
}

const ordinal = (n: number) => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

/** A bracket entrant: a real team, or a placeholder such as "1st Group A" */
interface Entry {
  name: string;
  logo: string;
  source: string;
}

/**
 * Single-elimination bracket over seeded entries (entries[0] = seed 1).
 * Byes don't create matches: the top seeds go straight into round 2.
 */
function buildBracket(
  tournament: Tournament,
  entries: Entry[],
  when: (round: number) => { match_date: string; match_time: string },
  roundOffset: number,
  firstNumber: number
): Match[] {
  if (entries.length < 2) return [];
  const size = nextPow2(entries.length);
  const totalRounds = Math.log2(size);
  const all: Match[] = [];
  let number = firstNumber;

  let feeds: (Entry | Match)[] = getStandardSeedingOrder(size).map(seed => entries[seed - 1] || null) as (Entry | Match)[];
  let semiFeeds: (Entry | Match)[] = [];

  for (let r = 1; r <= totalRounds; r++) {
    const stage = knockoutStageFor(2 ** (totalRounds - r + 1));
    const next: (Entry | Match)[] = [];
    if (r === totalRounds) semiFeeds = feeds;

    for (let i = 0; i < feeds.length; i += 2) {
      const home = feeds[i];
      const away = feeds[i + 1];
      if (!home || !away) {
        next.push(home || away); // bye
        continue;
      }
      const id = stableId(`match-tourn-${tournament.id}-ko-r${r}-m${i / 2 + 1}`);
      const side = (feed: Entry | Match, slot: 'home' | 'away') => {
        if ('source' in feed) return { name: feed.name, logo: feed.logo, source: feed.source };
        feed.next_match_id = id;
        feed.next_match_slot = slot;
        return { name: 'TBD', logo: DEFAULT_CREST, source: `Winner M#${feed.tournament_match_number}` };
      };
      const h = side(home, 'home');
      const a = side(away, 'away');
      const match = baseMatch(tournament, {
        id,
        title: stage === 'final' ? 'Grand Final' : `${STAGE_TITLES[stage]} • Match ${i / 2 + 1}`,
        tournament_stage: stage,
        tournament_round: r,
        tournament_match_number: number++,
        home_team_name: h.name,
        away_team_name: a.name,
        home_team_logo: h.logo,
        away_team_logo: a.logo,
        home_team_source: h.source,
        away_team_source: a.source,
        ...when(roundOffset + r - 1),
      });
      all.push(match);
      next.push(match);
    }
    feeds = next;
  }

  // 3rd place: only when both semi-finals are real matches (a bye semi has no loser)
  const semis = semiFeeds.filter((f): f is Match => !!f && !('source' in f));
  if (tournament.has_third_place_match && semis.length === 2) {
    all.push(baseMatch(tournament, {
      id: stableId(`match-tourn-${tournament.id}-ko-third-place`),
      title: '3rd Place Playoff',
      tournament_stage: 'third_place',
      tournament_round: totalRounds,
      tournament_match_number: number++,
      home_team_name: 'TBD',
      away_team_name: 'TBD',
      home_team_logo: DEFAULT_CREST,
      away_team_logo: DEFAULT_CREST,
      home_team_source: `Loser M#${semis[0].tournament_match_number}`,
      away_team_source: `Loser M#${semis[1].tournament_match_number}`,
      ...when(roundOffset + totalRounds - 1),
    }));
  }
  return all;
}

/**
 * Round-robin fixtures (circle method). Returns matches with a 0-based `round` for scheduling.
 */
function roundRobin(
  tournament: Tournament,
  participants: TournamentParticipant[],
  when: (round: number) => { match_date: string; match_time: string },
  firstNumber: number,
  group?: string
): Match[] {
  if (participants.length < 2) return [];
  const teams: (TournamentParticipant | null)[] = [...participants];
  if (teams.length % 2) teams.push(null);

  const n = teams.length;
  const matches: Match[] = [];
  let number = firstNumber;

  for (let r = 0; r < n - 1; r++) {
    for (let m = 0; m < n / 2; m++) {
      let home = teams[m === 0 ? r % (n - 1) : (r + m) % (n - 1)];
      let away = teams[m === 0 ? n - 1 : (n - 1 - m + r) % (n - 1)];
      if (!home || !away) continue;
      // Alternate who hosts the fixed team
      if (r % 2 === 1 && m === 0) [home, away] = [away, home];

      matches.push(baseMatch(tournament, {
        id: stableId(`match-tourn-${tournament.id}${group ? `-g${group}` : ''}-r${r + 1}-m${m + 1}`),
        title: `${group ? `Group ${group}` : 'League'} • Round ${r + 1}`,
        tournament_stage: 'group',
        tournament_group: group ? `Group ${group}` : undefined,
        tournament_round: r + 1,
        tournament_match_number: number++,
        home_team_name: home.name,
        away_team_name: away.name,
        home_team_logo: home.logo_url || DEFAULT_CREST,
        away_team_logo: away.logo_url || DEFAULT_CREST,
        ...when(r),
      }));
    }
  }
  return matches;
}

const roundRobinRounds = (teams: number) => (teams < 2 ? 0 : teams % 2 ? teams : teams - 1);

/** Group count / advancing per group clamped to what the team count can actually support */
export function effectiveGroupRules(tournament: Pick<Tournament, 'group_count' | 'teams_advancing_per_group'>, teamCount: number) {
  const groupCount = Math.max(1, Math.min(tournament.group_count ?? 1, Math.floor(teamCount / 2) || 1, GROUP_LETTERS.length));
  const smallestGroup = Math.floor(teamCount / groupCount);
  const advancing = Math.max(
    Math.ceil(2 / groupCount),
    Math.min(tournament.teams_advancing_per_group ?? 2, smallestGroup)
  );
  return { groupCount, advancing };
}

/**
 * Builds the complete fixture list for a tournament. Pure: returns new participants
 * (with seeds / groups) and any rule corrections instead of mutating the inputs.
 */
export function buildTiesheet(
  tournament: Tournament,
  participantsIn: TournamentParticipant[],
  options?: TiesheetOptions
): { matches: Match[]; participants: TournamentParticipant[]; tournamentUpdates: Partial<Tournament> } {
  let participants = participantsIn.map(p => ({ ...p }));
  if (options?.shuffle) {
    for (let i = participants.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [participants[i], participants[j]] = [participants[j], participants[i]];
    }
  } else {
    participants = participants
      .map((p, idx) => ({ p, idx }))
      .sort((a, b) => (a.p.seed ?? 999) - (b.p.seed ?? 999) || a.idx - b.idx)
      .map(x => x.p);
  }
  participants.forEach((p, idx) => {
    p.seed = idx + 1;
    p.group = undefined;
  });

  if (participants.length < 2) return { matches: [], participants, tournamentUpdates: {} };

  if (tournament.format === 'knockout') {
    const entries = participants.map(p => ({ name: p.name, logo: p.logo_url || DEFAULT_CREST, source: `Seed #${p.seed}` }));
    const when = scheduler(tournament, knockoutRoundCount(entries.length));
    return { matches: buildBracket(tournament, entries, when, 0, 1), participants, tournamentUpdates: {} };
  }

  if (tournament.format === 'league') {
    const when = scheduler(tournament, roundRobinRounds(participants.length));
    return { matches: roundRobin(tournament, participants, when, 1), participants, tournamentUpdates: {} };
  }

  // Group stage + knockout: deal seeds across groups (A, B, C, A, B, C, ...)
  const { groupCount, advancing } = effectiveGroupRules(tournament, participants.length);
  const letters = GROUP_LETTERS.slice(0, groupCount);
  participants.forEach((p, idx) => {
    p.group = letters[idx % groupCount];
  });
  const groups = letters.map(letter => participants.filter(p => p.group === letter));
  const groupRounds = Math.max(...groups.map(g => roundRobinRounds(g.length)));

  // Qualifiers ordered as seeds: every group winner first, then every runner-up, ...
  // ponytail: with an odd group count two teams from one group can meet in round 1
  const entries: Entry[] = [];
  for (let rank = 1; rank <= advancing; rank++) {
    for (const letter of letters) {
      const label = `${ordinal(rank)} Group ${letter}`;
      entries.push({ name: label, logo: DEFAULT_CREST, source: label });
    }
  }

  const when = scheduler(tournament, groupRounds + knockoutRoundCount(entries.length));
  const matches: Match[] = [];
  groups.forEach((g, i) => matches.push(...roundRobin(tournament, g, when, matches.length + 1, letters[i])));
  matches.push(...buildBracket(tournament, entries, when, groupRounds, matches.length + 1));

  const tournamentUpdates: Partial<Tournament> = {};
  if (groupCount !== tournament.group_count) tournamentUpdates.group_count = groupCount;
  if (advancing !== tournament.teams_advancing_per_group) tournamentUpdates.teams_advancing_per_group = advancing;
  return { matches, participants, tournamentUpdates };
}

/**
 * Computes Standings / Points Table from completed or ongoing matches.
 * Standard FIFA sorting:
 * 1. Points (PTS) descending
 * 2. Goal Difference (GD) descending
 * 3. Goals For (GF) descending
 * 4. Alphabetical by team name
 */
export function computeStandings(
  matches: Match[],
  participants: TournamentParticipant[],
  options?: {
    group?: string;
    pointsWin?: number;
    pointsDraw?: number;
    pointsLoss?: number;
  }
): TournamentStanding[] {
  const ptsWin = options?.pointsWin ?? 3;
  const ptsDraw = options?.pointsDraw ?? 1;
  const ptsLoss = options?.pointsLoss ?? 0;

  // Filter participants
  const targetParticipants = options?.group
    ? participants.filter(p => p.group === options.group)
    : participants;

  // Initialize standings dictionary keyed by participant name
  const standingsMap = new Map<string, TournamentStanding>();

  targetParticipants.forEach(p => {
    standingsMap.set(p.name, {
      team_id: p.id,
      name: p.name,
      short_name: p.short_name,
      logo_url: p.logo_url || DEFAULT_CREST,
      group: p.group,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      goals_for: 0,
      goals_against: 0,
      goal_difference: 0,
      points: 0,
      form: [],
    });
  });

  // Filter matches belonging to this group / stage
  const groupMatches = matches.filter(m => {
    // Only evaluate group / league matches
    if (m.tournament_stage && m.tournament_stage !== 'group') return false;
    if (options?.group && m.tournament_group && m.tournament_group !== `Group ${options.group}` && m.tournament_group !== options.group) {
      return false;
    }
    // Only count completed or live matches with scores
    return m.status === 'completed' || m.status === 'live' || m.status === 'halftime';
  });

  // Sort matches chronologically for form calculation
  const sortedMatches = [...groupMatches].sort(
    (a, b) => new Date(a.match_date).getTime() - new Date(b.match_date).getTime()
  );

  sortedMatches.forEach(m => {
    const homeStanding = standingsMap.get(m.home_team_name);
    const awayStanding = standingsMap.get(m.away_team_name);

    if (!homeStanding || !awayStanding) return;

    homeStanding.played += 1;
    awayStanding.played += 1;

    homeStanding.goals_for += m.home_score;
    homeStanding.goals_against += m.away_score;
    homeStanding.goal_difference = homeStanding.goals_for - homeStanding.goals_against;

    awayStanding.goals_for += m.away_score;
    awayStanding.goals_against += m.home_score;
    awayStanding.goal_difference = awayStanding.goals_for - awayStanding.goals_against;

    if (m.home_score > m.away_score) {
      // Home Win
      homeStanding.won += 1;
      homeStanding.points += ptsWin;
      homeStanding.form.push('W');

      awayStanding.lost += 1;
      awayStanding.points += ptsLoss;
      awayStanding.form.push('L');
    } else if (m.home_score < m.away_score) {
      // Away Win
      awayStanding.won += 1;
      awayStanding.points += ptsWin;
      awayStanding.form.push('W');

      homeStanding.lost += 1;
      homeStanding.points += ptsLoss;
      homeStanding.form.push('L');
    } else {
      // Draw
      homeStanding.drawn += 1;
      homeStanding.points += ptsDraw;
      homeStanding.form.push('D');

      awayStanding.drawn += 1;
      awayStanding.points += ptsDraw;
      awayStanding.form.push('D');
    }
  });

  // Convert to array and keep last 5 form results
  const standings = Array.from(standingsMap.values()).map(s => ({
    ...s,
    form: s.form.slice(-5),
  }));

  // Standard FIFA Sorting: PTS -> GD -> GF -> Alphabetical
  standings.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goal_difference !== a.goal_difference) return b.goal_difference - a.goal_difference;
    if (b.goals_for !== a.goals_for) return b.goals_for - a.goals_for;
    return a.name.localeCompare(b.name);
  });

  return standings;
}

/**
 * Records the result of a knockout match: sets winner_side, moves the winner into the
 * next match and the loser of a semi-final into the 3rd place playoff.
 */
export function progressKnockoutMatch(allMatches: Match[], updatedMatch: Match): Match[] {
  const updatedMatches = [...allMatches];
  const matchIndex = updatedMatches.findIndex(m => m.id === updatedMatch.id);
  if (matchIndex === -1) return updatedMatches;

  let winnerSide: 'home' | 'away' | undefined;
  if (updatedMatch.status === 'completed') {
    const hp = updatedMatch.home_penalty_score;
    const ap = updatedMatch.away_penalty_score;
    if (updatedMatch.home_score !== updatedMatch.away_score) {
      winnerSide = updatedMatch.home_score > updatedMatch.away_score ? 'home' : 'away';
    } else if (hp != null && ap != null && hp !== ap) {
      winnerSide = hp > ap ? 'home' : 'away';
    }
  }
  updatedMatches[matchIndex] = { ...updatedMatch, winner_side: winnerSide };
  if (!winnerSide) return updatedMatches;

  const loserSide = winnerSide === 'home' ? 'away' : 'home';
  const team = (side: 'home' | 'away') => ({
    name: side === 'home' ? updatedMatch.home_team_name : updatedMatch.away_team_name,
    logo: side === 'home' ? updatedMatch.home_team_logo : updatedMatch.away_team_logo,
  });
  const place = (idx: number, slot: 'home' | 'away', t: { name: string; logo: string }) => {
    updatedMatches[idx] = {
      ...updatedMatches[idx],
      ...(slot === 'home'
        ? { home_team_name: t.name, home_team_logo: t.logo }
        : { away_team_name: t.name, away_team_logo: t.logo }),
    };
  };

  if (updatedMatch.next_match_id) {
    const nextIdx = updatedMatches.findIndex(m => m.id === updatedMatch.next_match_id);
    if (nextIdx !== -1) place(nextIdx, updatedMatch.next_match_slot === 'away' ? 'away' : 'home', team(winnerSide));
  }

  const loserSource = `Loser M#${updatedMatch.tournament_match_number}`;
  updatedMatches.forEach((m, idx) => {
    if (m.tournament_id !== updatedMatch.tournament_id) return;
    if (m.home_team_source === loserSource) place(idx, 'home', team(loserSide));
    if (m.away_team_source === loserSource) place(idx, 'away', team(loserSide));
  });

  return updatedMatches;
}

/**
 * Seeds qualified teams from completed group standings into the initial knockout bracket matches.
 * E.g., fills '1st Group A', '2nd Group B', etc. with concrete team names and crests.
 */
export function seedKnockoutFromGroups(
  matches: Match[],
  standingsByGroup: Record<string, TournamentStanding[]>
): Match[] {
  return matches.map(m => {
    if (!m.tournament_stage || m.tournament_stage === 'group') return m;
    const copy = { ...m };
    for (const side of ['home', 'away'] as const) {
      const parsed = parseGroupSource(copy[`${side}_team_source`] || '');
      const team = parsed && standingsByGroup[parsed.group]?.[parsed.rank - 1];
      if (team) {
        copy[`${side}_team_name`] = team.name;
        copy[`${side}_team_logo`] = team.logo_url;
      }
    }
    return copy;
  });
}

/**
 * Re-derives everything that follows from results: knockout slots filled from finished
 * groups, then winners / losers carried through the bracket in match order.
 */
export function resolveTournament(
  allMatches: Match[],
  tournament: Tournament,
  participants: TournamentParticipant[]
): Match[] {
  const own = (list: Match[]) => list.filter(m => m.tournament_id === tournament.id);

  // Start from placeholders so an edited / reverted result can't leave a stale team behind
  let result = allMatches.map(m => {
    if (m.tournament_id !== tournament.id || !m.tournament_stage || m.tournament_stage === 'group') return m;
    const copy = { ...m };
    for (const side of ['home', 'away'] as const) {
      const source = copy[`${side}_team_source`] || '';
      if (parseGroupSource(source) || /^(Winner|Loser) M#/.test(source)) {
        copy[`${side}_team_name`] = source.startsWith('Winner') || source.startsWith('Loser') ? 'TBD' : source;
        copy[`${side}_team_logo`] = DEFAULT_CREST;
      }
    }
    return copy;
  });

  if (tournament.format === 'group_knockout') {
    const standingsByGroup: Record<string, TournamentStanding[]> = {};
    for (const letter of GROUP_LETTERS.slice(0, tournament.group_count ?? 1)) {
      const groupMatches = own(result).filter(m => m.tournament_group === `Group ${letter}`);
      // Only a finished group decides who qualifies
      if (groupMatches.length === 0 || groupMatches.some(m => m.status !== 'completed')) continue;
      standingsByGroup[letter] = computeStandings(groupMatches, participants, {
        group: letter,
        pointsWin: tournament.points_win,
        pointsDraw: tournament.points_draw,
        pointsLoss: tournament.points_loss,
      });
    }
    const seeded = seedKnockoutFromGroups(own(result), standingsByGroup);
    const byId = new Map(seeded.map(m => [m.id, m]));
    result = result.map(m => byId.get(m.id) || m);
  }

  const knockout = own(result)
    .filter(m => m.tournament_stage && m.tournament_stage !== 'group' && m.status === 'completed')
    .sort((a, b) => (a.tournament_match_number ?? 0) - (b.tournament_match_number ?? 0));
  for (const m of knockout) {
    result = progressKnockoutMatch(result, result.find(x => x.id === m.id)!);
  }
  return result;
}

/**
 * Brackets built by the old engine sourced the 3rd place playoff as "Loser Semi #1/#2";
 * rewrites those to "Loser M#<n>" so the result carries over like any other slot.
 */
export function upgradeLegacyMatches(matches: Match[]): Match[] {
  const semis = matches
    .filter(m => m.tournament_stage === 'semi_final')
    .sort((a, b) => (a.tournament_match_number ?? 0) - (b.tournament_match_number ?? 0));
  const fix = (source?: string) => {
    const k = source?.match(/^Loser Semi #(\d)$/)?.[1];
    const semi = k ? semis[Number(k) - 1] : undefined;
    return semi ? `Loser M#${semi.tournament_match_number}` : source;
  };
  return matches.map(m =>
    [m.home_team_source, m.away_team_source].some(s => s?.startsWith('Loser Semi #'))
      ? { ...m, home_team_source: fix(m.home_team_source), away_team_source: fix(m.away_team_source) }
      : m
  );
}

function parseGroupSource(source: string): { rank: number; group: string } | null {
  const match = source.match(/^(\d+)(?:st|nd|rd|th)?\s+Group\s+([A-Za-z0-9]+)$/i);
  if (match) {
    return {
      rank: parseInt(match[1], 10),
      group: match[2].toUpperCase(),
    };
  }
  return null;
}
