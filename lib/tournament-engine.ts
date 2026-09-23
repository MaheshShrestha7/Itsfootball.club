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
  round_of_16: 'Round of 16',
  quarter_final: 'Quarter-Finals',
  semi_final: 'Semi-Finals',
  final: 'Grand Final',
  third_place: '3rd Place Playoff',
};

export interface TiesheetOptions {
  shuffle?: boolean;
  matchDurationMinutes?: number;
  kickoffTime?: string;
  startDate?: string;
  venue?: string;
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

/**
 * Generates single-elimination knockout bracket matches.
 */
export function generateKnockoutBracket(
  tournament: Tournament,
  participants: TournamentParticipant[],
  options?: TiesheetOptions
): Match[] {
  const matches: Match[] = [];
  const count = participants.length;
  if (count < 2) return matches;

  // Find next power of 2 (e.g. 4, 8, 16)
  let bracketSize = 2;
  while (bracketSize < count) {
    bracketSize *= 2;
  }

  // Seeding
  let seededParticipants = [...participants];
  if (options?.shuffle) {
    seededParticipants = seededParticipants.sort(() => Math.random() - 0.5);
    seededParticipants.forEach((p, idx) => {
      p.seed = idx + 1;
    });
  } else {
    // Sort by existing seed or order
    seededParticipants.sort((a, b) => (a.seed || 999) - (b.seed || 999));
    seededParticipants.forEach((p, idx) => {
      if (!p.seed) p.seed = idx + 1;
    });
  }

  // Create slot mapping for bracketSize
  const seedOrder = getStandardSeedingOrder(bracketSize);
  const slots: (TournamentParticipant | null)[] = seedOrder.map(seed => {
    return seededParticipants.find(p => p.seed === seed) || null;
  });

  const totalRounds = Math.log2(bracketSize);
  const defaultVenue = options?.venue || tournament.venue || 'Home Stadium Arena';
  const baseDate = options?.startDate ? new Date(options.startDate) : new Date(tournament.start_date || Date.now());
  const defaultTime = options?.kickoffTime || '15:00';

  // Map of round -> matches
  const roundMatches: Match[][] = [];

  // Stage name helper
  const getStageForRound = (round: number): Match['tournament_stage'] => {
    const roundsRemaining = totalRounds - round;
    if (roundsRemaining === 0) return 'final';
    if (roundsRemaining === 1) return 'semi_final';
    if (roundsRemaining === 2) return 'quarter_final';
    if (roundsRemaining === 3) return 'round_of_16';
    return 'group';
  };

  let matchSequence = 1;

  // Build rounds backwards or forwards:
  // Round 1 (first round of bracket)
  const round1Matches: Match[] = [];
  const round1MatchCount = bracketSize / 2;

  for (let m = 0; m < round1MatchCount; m++) {
    const p1 = slots[m * 2];
    const p2 = slots[m * 2 + 1];

    const matchDate = new Date(baseDate.getTime() + 0 * 86400000);

    const matchId = stableId(`match-tourn-${tournament.id}-r1-m${m + 1}`);
    const newMatch: Match = {
      id: matchId,
      club_id: tournament.club_id,
      tournament_id: tournament.id,
      competition: tournament.name,
      season: tournament.season,
      match_type: 'tournament',
      title: `${STAGE_TITLES[getStageForRound(1) || 'group']} Match #${matchSequence}`,
      tournament_stage: getStageForRound(1),
      tournament_round: 1,
      tournament_match_number: matchSequence++,
      home_team_name: p1 ? p1.name : 'TBD',
      away_team_name: p2 ? p2.name : 'TBD',
      home_team_logo: p1 ? p1.logo_url : DEFAULT_CREST,
      away_team_logo: p2 ? p2.logo_url : DEFAULT_CREST,
      home_team_source: p1 ? `Seed #${p1.seed}` : `Seed #${seedOrder[m * 2]}`,
      away_team_source: p2 ? `Seed #${p2.seed}` : `Seed #${seedOrder[m * 2 + 1]}`,
      is_club_home: true,
      match_date: matchDate.toISOString().slice(0, 10),
      match_time: defaultTime,
      venue: defaultVenue,
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
    };

    // If one team has a bye (p2 is null), p1 automatically wins and advances
    if (p1 && !p2) {
      newMatch.status = 'completed';
      newMatch.home_score = 1;
      newMatch.away_score = 0;
      newMatch.winner_side = 'home';
      newMatch.description = 'Bye match — Winner advances automatically';
    } else if (!p1 && p2) {
      newMatch.status = 'completed';
      newMatch.home_score = 0;
      newMatch.away_score = 1;
      newMatch.winner_side = 'away';
      newMatch.description = 'Bye match — Winner advances automatically';
    }

    round1Matches.push(newMatch);
  }

  roundMatches.push(round1Matches);

  // Subsequent rounds (Round 2 to Final)
  for (let r = 2; r <= totalRounds; r++) {
    const prevMatches = roundMatches[r - 2];
    const currMatchCount = prevMatches.length / 2;
    const currRoundMatches: Match[] = [];

    const roundDate = new Date(baseDate.getTime() + (r - 1) * 2 * 86400000);

    for (let m = 0; m < currMatchCount; m++) {
      const matchId = stableId(`match-tourn-${tournament.id}-r${r}-m${m + 1}`);
      const parent1 = prevMatches[m * 2];
      const parent2 = prevMatches[m * 2 + 1];

      // Auto check if parents had byes
      let homeName = 'TBD';
      let awayName = 'TBD';
      let homeLogo = DEFAULT_CREST;
      let awayLogo = DEFAULT_CREST;

      if (parent1.status === 'completed' && parent1.winner_side) {
        homeName = parent1.winner_side === 'home' ? parent1.home_team_name : parent1.away_team_name;
        homeLogo = parent1.winner_side === 'home' ? parent1.home_team_logo : parent1.away_team_logo;
      }
      if (parent2.status === 'completed' && parent2.winner_side) {
        awayName = parent2.winner_side === 'home' ? parent2.home_team_name : parent2.away_team_name;
        awayLogo = parent2.winner_side === 'home' ? parent2.home_team_logo : parent2.away_team_logo;
      }

      const newMatch: Match = {
        id: matchId,
        club_id: tournament.club_id,
        tournament_id: tournament.id,
        competition: tournament.name,
        season: tournament.season,
        match_type: 'tournament',
        title: `${STAGE_TITLES[getStageForRound(r) || 'final']} Match #${matchSequence}`,
        tournament_stage: getStageForRound(r),
        tournament_round: r,
        tournament_match_number: matchSequence++,
        home_team_name: homeName,
        away_team_name: awayName,
        home_team_logo: homeLogo,
        away_team_logo: awayLogo,
        home_team_source: `Winner M#${parent1.tournament_match_number}`,
        away_team_source: `Winner M#${parent2.tournament_match_number}`,
        is_club_home: true,
        match_date: roundDate.toISOString().slice(0, 10),
        match_time: defaultTime,
        venue: defaultVenue,
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
      };

      // Link parents forward to this match
      parent1.next_match_id = matchId;
      parent1.next_match_slot = 'home';
      parent2.next_match_id = matchId;
      parent2.next_match_slot = 'away';

      currRoundMatches.push(newMatch);
    }

    roundMatches.push(currRoundMatches);
  }

  // 3rd place match if requested
  if (tournament.has_third_place_match && totalRounds >= 2) {
    const semiMatches = roundMatches[totalRounds - 2];
    if (semiMatches && semiMatches.length === 2) {
      const matchId = stableId(`match-tourn-${tournament.id}-third-place`);
      const semiDate = new Date(baseDate.getTime() + (totalRounds - 1) * 2 * 86400000);
      const thirdPlaceMatch: Match = {
        id: matchId,
        club_id: tournament.club_id,
        tournament_id: tournament.id,
        competition: tournament.name,
        season: tournament.season,
        match_type: 'tournament',
        title: '3rd Place Playoff',
        tournament_stage: 'third_place',
        tournament_round: totalRounds,
        tournament_match_number: matchSequence++,
        home_team_name: 'TBD',
        away_team_name: 'TBD',
        home_team_logo: DEFAULT_CREST,
        away_team_logo: DEFAULT_CREST,
        home_team_source: `Loser Semi #1`,
        away_team_source: `Loser Semi #2`,
        is_club_home: true,
        match_date: semiDate.toISOString().slice(0, 10),
        match_time: '12:30',
        venue: defaultVenue,
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
      };
      roundMatches[roundMatches.length - 1].push(thirdPlaceMatch);
    }
  }

  // Flatten all matches
  return roundMatches.flat();
}

/**
 * Generates round-robin fixtures using the Berger / polygon scheduling algorithm.
 */
export function generateRoundRobinSchedule(
  tournament: Tournament,
  participants: TournamentParticipant[],
  options?: TiesheetOptions & { group?: string }
): Match[] {
  const matches: Match[] = [];
  const list = [...participants];
  if (list.length < 2) return matches;

  // If odd number of teams, add virtual dummy
  const isOdd = list.length % 2 !== 0;
  const teams: (TournamentParticipant | null)[] = [...list];
  if (isOdd) {
    teams.push(null);
  }

  const numTeams = teams.length;
  const numRounds = numTeams - 1;
  const matchesPerRound = numTeams / 2;

  const baseDate = options?.startDate ? new Date(options.startDate) : new Date(tournament.start_date || Date.now());
  const defaultVenue = options?.venue || tournament.venue || 'Home Stadium Arena';
  const defaultTime = options?.kickoffTime || '15:00';

  let matchSequence = 1;

  for (let r = 0; r < numRounds; r++) {
    const roundNumber = r + 1;
    const roundDate = new Date(baseDate.getTime() + r * 7 * 86400000); // 1 round per week or days

    for (let m = 0; m < matchesPerRound; m++) {
      const homeIdx = (r + m) % (numTeams - 1);
      let awayIdx = (numTeams - 1 - m + r) % (numTeams - 1);

      if (m === 0) {
        awayIdx = numTeams - 1;
      }

      let home = teams[homeIdx];
      let away = teams[awayIdx];

      // Skip byes
      if (!home || !away) continue;

      // Alternate home/away for fair hosting
      if (r % 2 === 1 && m === 0) {
        const tmp = home;
        home = away;
        away = tmp;
      }

      const matchId = stableId(`match-tourn-${tournament.id}${options?.group ? `-g${options.group}` : ''}-r${roundNumber}-m${m + 1}`);
      const groupLabel = options?.group ? `Group ${options.group}` : 'League';

      matches.push({
        id: matchId,
        club_id: tournament.club_id,
        tournament_id: tournament.id,
        competition: tournament.name,
        season: tournament.season,
        match_type: 'tournament',
        title: `${groupLabel} • Round ${roundNumber}`,
        tournament_stage: 'group',
        tournament_group: options?.group ? `Group ${options.group}` : undefined,
        tournament_round: roundNumber,
        tournament_match_number: matchSequence++,
        home_team_name: home.name,
        away_team_name: away.name,
        home_team_logo: home.logo_url || DEFAULT_CREST,
        away_team_logo: away.logo_url || DEFAULT_CREST,
        is_club_home: true,
        match_date: roundDate.toISOString().slice(0, 10),
        match_time: defaultTime,
        venue: defaultVenue,
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
      });
    }
  }

  return matches;
}

/**
 * Generates Group Stage + Knockout schedule (e.g. World Cup / Champions League format).
 * 1. Divides participants into groups A, B, etc.
 * 2. Generates round-robin fixtures within each group.
 * 3. Generates Knockout bracket (Semifinals / Finals or Quarterfinals) with placeholders for group winners/runners-up.
 */
export function generateGroupKnockoutSchedule(
  tournament: Tournament,
  participants: TournamentParticipant[],
  options?: TiesheetOptions
): { matches: Match[]; updatedParticipants: TournamentParticipant[] } {
  const groupCount = Math.max(1, tournament.group_count ?? 1);
  const advancingPerGroup = Math.max(1, tournament.teams_advancing_per_group ?? 2);
  const groupLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].slice(0, groupCount);

  // Group assignment
  const participantsCopy = [...participants];
  if (options?.shuffle) {
    participantsCopy.sort(() => Math.random() - 0.5);
  }

  participantsCopy.forEach((p, idx) => {
    const groupLetter = groupLetters[idx % groupCount];
    p.group = groupLetter;
  });

  const allMatches: Match[] = [];

  // 1. Group Stage Fixtures
  groupLetters.forEach(letter => {
    const groupParticipants = participantsCopy.filter(p => p.group === letter);
    const groupMatches = generateRoundRobinSchedule(tournament, groupParticipants, {
      ...options,
      group: letter,
    });
    allMatches.push(...groupMatches);
  });

  // Calculate when group matches finish to schedule knockouts
  const baseDate = options?.startDate ? new Date(options.startDate) : new Date(tournament.start_date || Date.now());
  const maxGroupRounds = Math.max(
    ...allMatches.map(m => m.tournament_round || 1),
    1
  );
  const koBaseDate = new Date(baseDate.getTime() + (maxGroupRounds + 1) * 7 * 86400000);
  const defaultVenue = options?.venue || tournament.venue || 'Home Stadium Arena';
  const defaultTime = options?.kickoffTime || '16:00';

  let matchSequence = allMatches.length + 1;

  // 2. Knockout Stage Setup
  // Minimum 2 teams and maximum teams to progress to KO (bracket powers of 2: 2, 4, 8, 16)
  const rawAdvancing = groupCount * advancingPerGroup;
  let totalAdvancing = 2;
  if (rawAdvancing <= 2) {
    totalAdvancing = 2;
  } else if (rawAdvancing <= 5) {
    totalAdvancing = 4;
  } else if (rawAdvancing <= 11) {
    totalAdvancing = 8;
  } else {
    totalAdvancing = 16;
  }

  if (totalAdvancing === 2) {
    // --------------------------------------------------------------------------
    // CASE A: 2 Teams Advance -> Direct Grand Final (+ optional 3rd Place Match)
    // --------------------------------------------------------------------------
    const finalId = stableId(`match-tourn-${tournament.id}-ko-final`);
    const finalDate = new Date(koBaseDate.getTime() + 0 * 86400000);

    const homeSource = '1st Group A';
    const awaySource = groupCount === 1 ? '2nd Group A' : '1st Group B';

    const finalMatch: Match = {
      id: finalId,
      club_id: tournament.club_id,
      tournament_id: tournament.id,
      competition: tournament.name,
      season: tournament.season,
      match_type: 'tournament',
      title: 'Championship Grand Final',
      tournament_stage: 'final',
      tournament_round: 1,
      tournament_match_number: matchSequence++,
      home_team_name: homeSource,
      away_team_name: awaySource,
      home_team_logo: DEFAULT_CREST,
      away_team_logo: DEFAULT_CREST,
      home_team_source: homeSource,
      away_team_source: awaySource,
      is_club_home: true,
      match_date: finalDate.toISOString().slice(0, 10),
      match_time: defaultTime,
      venue: defaultVenue,
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
    };

    allMatches.push(finalMatch);

    // Optional 3rd Place match
    if (tournament.has_third_place_match) {
      const thirdPlaceId = stableId(`match-tourn-${tournament.id}-ko-third-place`);
      const tpHomeSource = groupCount === 1 ? '3rd Group A' : '2nd Group A';
      const tpAwaySource = groupCount === 1 ? '4th Group A' : '2nd Group B';

      allMatches.push({
        id: thirdPlaceId,
        club_id: tournament.club_id,
        tournament_id: tournament.id,
        competition: tournament.name,
        season: tournament.season,
        match_type: 'tournament',
        title: '3rd Place Playoff',
        tournament_stage: 'third_place',
        tournament_round: 1,
        tournament_match_number: matchSequence++,
        home_team_name: tpHomeSource,
        away_team_name: tpAwaySource,
        home_team_logo: DEFAULT_CREST,
        away_team_logo: DEFAULT_CREST,
        home_team_source: tpHomeSource,
        away_team_source: tpAwaySource,
        is_club_home: true,
        match_date: finalDate.toISOString().slice(0, 10),
        match_time: '13:00',
        venue: defaultVenue,
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
      });
    }
  } else if (totalAdvancing === 4) {
    // --------------------------------------------------------------------------
    // CASE B: 4 Teams Advance -> Semi-Finals & Grand Final
    // --------------------------------------------------------------------------
    const sf1Id = stableId(`match-tourn-${tournament.id}-ko-sf1`);
    const sf2Id = stableId(`match-tourn-${tournament.id}-ko-sf2`);
    const finalId = stableId(`match-tourn-${tournament.id}-ko-final`);

    const sfDate = new Date(koBaseDate.getTime() + 0 * 86400000);
    const finalDate = new Date(koBaseDate.getTime() + 7 * 86400000);

    let sf1Home = '1st Group A';
    let sf1Away = '2nd Group B';
    let sf2Home = '1st Group B';
    let sf2Away = '2nd Group A';

    if (groupCount === 1) {
      // 1 Group: 1st plays 4th, 2nd plays 3rd
      sf1Home = '1st Group A';
      sf1Away = '4th Group A';
      sf2Home = '2nd Group A';
      sf2Away = '3rd Group A';
    } else if (groupCount >= 4) {
      sf1Home = '1st Group A';
      sf1Away = '1st Group B';
      sf2Home = '1st Group C';
      sf2Away = '1st Group D';
    }

    const sf1: Match = {
      id: sf1Id,
      club_id: tournament.club_id,
      tournament_id: tournament.id,
      competition: tournament.name,
      season: tournament.season,
      match_type: 'tournament',
      title: 'Semi-Final 1',
      tournament_stage: 'semi_final',
      tournament_round: 1,
      tournament_match_number: matchSequence++,
      home_team_name: sf1Home,
      away_team_name: sf1Away,
      home_team_logo: DEFAULT_CREST,
      away_team_logo: DEFAULT_CREST,
      home_team_source: sf1Home,
      away_team_source: sf1Away,
      next_match_id: finalId,
      next_match_slot: 'home',
      is_club_home: true,
      match_date: sfDate.toISOString().slice(0, 10),
      match_time: defaultTime,
      venue: defaultVenue,
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
    };

    const sf2: Match = {
      id: sf2Id,
      club_id: tournament.club_id,
      tournament_id: tournament.id,
      competition: tournament.name,
      season: tournament.season,
      match_type: 'tournament',
      title: 'Semi-Final 2',
      tournament_stage: 'semi_final',
      tournament_round: 1,
      tournament_match_number: matchSequence++,
      home_team_name: sf2Home,
      away_team_name: sf2Away,
      home_team_logo: DEFAULT_CREST,
      away_team_logo: DEFAULT_CREST,
      home_team_source: sf2Home,
      away_team_source: sf2Away,
      next_match_id: finalId,
      next_match_slot: 'away',
      is_club_home: true,
      match_date: sfDate.toISOString().slice(0, 10),
      match_time: defaultTime,
      venue: defaultVenue,
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
    };

    const finalMatch: Match = {
      id: finalId,
      club_id: tournament.club_id,
      tournament_id: tournament.id,
      competition: tournament.name,
      season: tournament.season,
      match_type: 'tournament',
      title: 'Championship Grand Final',
      tournament_stage: 'final',
      tournament_round: 2,
      tournament_match_number: matchSequence++,
      home_team_name: 'Winner Semi-Final 1',
      away_team_name: 'Winner Semi-Final 2',
      home_team_logo: DEFAULT_CREST,
      away_team_logo: DEFAULT_CREST,
      home_team_source: `Winner M#${sf1.tournament_match_number}`,
      away_team_source: `Winner M#${sf2.tournament_match_number}`,
      is_club_home: true,
      match_date: finalDate.toISOString().slice(0, 10),
      match_time: defaultTime,
      venue: defaultVenue,
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
    };

    allMatches.push(sf1, sf2, finalMatch);

    // 3rd place match
    if (tournament.has_third_place_match) {
      const thirdPlaceId = stableId(`match-tourn-${tournament.id}-ko-third-place`);
      allMatches.push({
        id: thirdPlaceId,
        club_id: tournament.club_id,
        tournament_id: tournament.id,
        competition: tournament.name,
        season: tournament.season,
        match_type: 'tournament',
        title: '3rd Place Playoff',
        tournament_stage: 'third_place',
        tournament_round: 2,
        tournament_match_number: matchSequence++,
        home_team_name: 'Loser Semi-Final 1',
        away_team_name: 'Loser Semi-Final 2',
        home_team_logo: DEFAULT_CREST,
        away_team_logo: DEFAULT_CREST,
        home_team_source: `Loser M#${sf1.tournament_match_number}`,
        away_team_source: `Loser M#${sf2.tournament_match_number}`,
        is_club_home: true,
        match_date: finalDate.toISOString().slice(0, 10),
        match_time: '13:00',
        venue: defaultVenue,
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
      });
    }
  } else if (totalAdvancing === 8) {
    // --------------------------------------------------------------------------
    // CASE C: 8 Teams Advance -> Quarter-Finals -> Semi-Finals -> Grand Final
    // --------------------------------------------------------------------------
    const qfIds = [1, 2, 3, 4].map(i => stableId(`match-tourn-${tournament.id}-ko-qf${i}`));
    const sfIds = [1, 2].map(i => stableId(`match-tourn-${tournament.id}-ko-sf${i}`));
    const finalId = stableId(`match-tourn-${tournament.id}-ko-final`);

    const qfDate = new Date(koBaseDate.getTime() + 0 * 86400000);
    const sfDate = new Date(koBaseDate.getTime() + 7 * 86400000);
    const finalDate = new Date(koBaseDate.getTime() + 14 * 86400000);

    let qfPairs = [
      { home: '1st Group A', away: '2nd Group B' },
      { home: '1st Group C', away: '2nd Group D' },
      { home: '1st Group B', away: '2nd Group A' },
      { home: '1st Group D', away: '2nd Group C' },
    ];

    if (groupCount === 1) {
      // 1 Group: 1st vs 8th, 4th vs 5th, 2nd vs 7th, 3rd vs 6th
      qfPairs = [
        { home: '1st Group A', away: '8th Group A' },
        { home: '4th Group A', away: '5th Group A' },
        { home: '2nd Group A', away: '7th Group A' },
        { home: '3rd Group A', away: '6th Group A' },
      ];
    } else if (groupCount === 2) {
      qfPairs = [
        { home: '1st Group A', away: '4th Group B' },
        { home: '2nd Group B', away: '3rd Group A' },
        { home: '1st Group B', away: '4th Group A' },
        { home: '2nd Group A', away: '3rd Group B' },
      ];
    }

    const qfMatches: Match[] = qfPairs.map((pair, idx) => ({
      id: qfIds[idx],
      club_id: tournament.club_id,
      tournament_id: tournament.id,
      competition: tournament.name,
      season: tournament.season,
      match_type: 'tournament',
      title: `Quarter-Final ${idx + 1}`,
      tournament_stage: 'quarter_final',
      tournament_round: 1,
      tournament_match_number: matchSequence++,
      home_team_name: pair.home,
      away_team_name: pair.away,
      home_team_logo: DEFAULT_CREST,
      away_team_logo: DEFAULT_CREST,
      home_team_source: pair.home,
      away_team_source: pair.away,
      next_match_id: idx < 2 ? sfIds[0] : sfIds[1],
      next_match_slot: idx % 2 === 0 ? 'home' : 'away',
      is_club_home: true,
      match_date: qfDate.toISOString().slice(0, 10),
      match_time: defaultTime,
      venue: defaultVenue,
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
    }));

    const sf1: Match = {
      id: sfIds[0],
      club_id: tournament.club_id,
      tournament_id: tournament.id,
      competition: tournament.name,
      season: tournament.season,
      match_type: 'tournament',
      title: 'Semi-Final 1',
      tournament_stage: 'semi_final',
      tournament_round: 2,
      tournament_match_number: matchSequence++,
      home_team_name: 'Winner QF 1',
      away_team_name: 'Winner QF 2',
      home_team_logo: DEFAULT_CREST,
      away_team_logo: DEFAULT_CREST,
      home_team_source: `Winner M#${qfMatches[0].tournament_match_number}`,
      away_team_source: `Winner M#${qfMatches[1].tournament_match_number}`,
      next_match_id: finalId,
      next_match_slot: 'home',
      is_club_home: true,
      match_date: sfDate.toISOString().slice(0, 10),
      match_time: defaultTime,
      venue: defaultVenue,
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
    };

    const sf2: Match = {
      id: sfIds[1],
      club_id: tournament.club_id,
      tournament_id: tournament.id,
      competition: tournament.name,
      season: tournament.season,
      match_type: 'tournament',
      title: 'Semi-Final 2',
      tournament_stage: 'semi_final',
      tournament_round: 2,
      tournament_match_number: matchSequence++,
      home_team_name: 'Winner QF 3',
      away_team_name: 'Winner QF 4',
      home_team_logo: DEFAULT_CREST,
      away_team_logo: DEFAULT_CREST,
      home_team_source: `Winner M#${qfMatches[2].tournament_match_number}`,
      away_team_source: `Winner M#${qfMatches[3].tournament_match_number}`,
      next_match_id: finalId,
      next_match_slot: 'away',
      is_club_home: true,
      match_date: sfDate.toISOString().slice(0, 10),
      match_time: defaultTime,
      venue: defaultVenue,
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
    };

    const finalMatch: Match = {
      id: finalId,
      club_id: tournament.club_id,
      tournament_id: tournament.id,
      competition: tournament.name,
      season: tournament.season,
      match_type: 'tournament',
      title: 'Championship Grand Final',
      tournament_stage: 'final',
      tournament_round: 3,
      tournament_match_number: matchSequence++,
      home_team_name: 'Winner Semi-Final 1',
      away_team_name: 'Winner Semi-Final 2',
      home_team_logo: DEFAULT_CREST,
      away_team_logo: DEFAULT_CREST,
      home_team_source: `Winner M#${sf1.tournament_match_number}`,
      away_team_source: `Winner M#${sf2.tournament_match_number}`,
      is_club_home: true,
      match_date: finalDate.toISOString().slice(0, 10),
      match_time: defaultTime,
      venue: defaultVenue,
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
    };

    allMatches.push(...qfMatches, sf1, sf2, finalMatch);

    // 3rd place match
    if (tournament.has_third_place_match) {
      const thirdPlaceId = stableId(`match-tourn-${tournament.id}-ko-third-place`);
      allMatches.push({
        id: thirdPlaceId,
        club_id: tournament.club_id,
        tournament_id: tournament.id,
        competition: tournament.name,
        season: tournament.season,
        match_type: 'tournament',
        title: '3rd Place Playoff',
        tournament_stage: 'third_place',
        tournament_round: 3,
        tournament_match_number: matchSequence++,
        home_team_name: 'Loser Semi-Final 1',
        away_team_name: 'Loser Semi-Final 2',
        home_team_logo: DEFAULT_CREST,
        away_team_logo: DEFAULT_CREST,
        home_team_source: `Loser M#${sf1.tournament_match_number}`,
        away_team_source: `Loser M#${sf2.tournament_match_number}`,
        is_club_home: true,
        match_date: finalDate.toISOString().slice(0, 10),
        match_time: '13:00',
        venue: defaultVenue,
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
      });
    }
  } else {
    // --------------------------------------------------------------------------
    // CASE D: 16 Teams Advance -> Round of 16 -> QF -> SF -> Grand Final
    // --------------------------------------------------------------------------
    const r16Ids = Array.from({ length: 8 }, (_, i) => stableId(`match-tourn-${tournament.id}-ko-r16-${i + 1}`));
    const qfIds = [1, 2, 3, 4].map(i => stableId(`match-tourn-${tournament.id}-ko-qf${i}`));
    const sfIds = [1, 2].map(i => stableId(`match-tourn-${tournament.id}-ko-sf${i}`));
    const finalId = stableId(`match-tourn-${tournament.id}-ko-final`);

    const r16Date = new Date(koBaseDate.getTime() + 0 * 86400000);
    const qfDate = new Date(koBaseDate.getTime() + 7 * 86400000);
    const sfDate = new Date(koBaseDate.getTime() + 14 * 86400000);
    const finalDate = new Date(koBaseDate.getTime() + 21 * 86400000);

    let r16Pairs: { home: string; away: string }[] = [];

    if (groupCount === 1) {
      // 1 Group: standard 16-seed bracket (1v16, 8v9, 4v13, 5v12, 2v15, 7v10, 3v14, 6v11)
      r16Pairs = [
        { home: '1st Group A', away: '16th Group A' },
        { home: '8th Group A', away: '9th Group A' },
        { home: '4th Group A', away: '13th Group A' },
        { home: '5th Group A', away: '12th Group A' },
        { home: '2nd Group A', away: '15th Group A' },
        { home: '7th Group A', away: '10th Group A' },
        { home: '3rd Group A', away: '14th Group A' },
        { home: '6th Group A', away: '11th Group A' },
      ];
    } else if (groupCount === 2) {
      // 2 Groups (8 advancing each)
      r16Pairs = [
        { home: '1st Group A', away: '8th Group B' },
        { home: '4th Group B', away: '5th Group A' },
        { home: '2nd Group B', away: '7th Group A' },
        { home: '3rd Group A', away: '6th Group B' },
        { home: '1st Group B', away: '8th Group A' },
        { home: '4th Group A', away: '5th Group B' },
        { home: '2nd Group A', away: '7th Group B' },
        { home: '3rd Group B', away: '6th Group A' },
      ];
    } else if (groupCount === 4) {
      // 4 Groups (4 advancing each)
      r16Pairs = [
        { home: '1st Group A', away: '4th Group B' },
        { home: '2nd Group C', away: '3rd Group D' },
        { home: '1st Group C', away: '4th Group D' },
        { home: '2nd Group A', away: '3rd Group B' },
        { home: '1st Group B', away: '4th Group A' },
        { home: '2nd Group D', away: '3rd Group C' },
        { home: '1st Group D', away: '4th Group C' },
        { home: '2nd Group B', away: '3rd Group A' },
      ];
    } else {
      // 8 Groups (2 advancing each - standard FIFA World Cup R16)
      r16Pairs = [
        { home: '1st Group A', away: '2nd Group B' },
        { home: '1st Group C', away: '2nd Group D' },
        { home: '1st Group E', away: '2nd Group F' },
        { home: '1st Group G', away: '2nd Group H' },
        { home: '1st Group B', away: '2nd Group A' },
        { home: '1st Group D', away: '2nd Group C' },
        { home: '1st Group F', away: '2nd Group E' },
        { home: '1st Group H', away: '2nd Group G' },
      ];
    }

    const r16Matches: Match[] = r16Ids.map((id, idx) => {
      const matchNum = matchSequence++;
      const pair = r16Pairs[idx] || { home: 'TBD', away: 'TBD' };
      const homeSource = pair.home;
      const awaySource = pair.away;

      return {
        id,
        club_id: tournament.club_id,
        tournament_id: tournament.id,
        competition: tournament.name,
        season: tournament.season,
        match_type: 'tournament',
        title: `Round of 16 • Match ${idx + 1}`,
        tournament_stage: 'round_of_16',
        tournament_round: 1,
        tournament_match_number: matchNum,
        home_team_name: homeSource,
        away_team_name: awaySource,
        home_team_logo: DEFAULT_CREST,
        away_team_logo: DEFAULT_CREST,
        home_team_source: homeSource,
        away_team_source: awaySource,
        next_match_id: qfIds[Math.floor(idx / 2)],
        next_match_slot: idx % 2 === 0 ? 'home' : 'away',
        is_club_home: true,
        match_date: r16Date.toISOString().slice(0, 10),
        match_time: defaultTime,
        venue: defaultVenue,
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
      };
    });

    const qfMatches: Match[] = qfIds.map((id, idx) => {
      const matchNum = matchSequence++;
      return {
        id,
        club_id: tournament.club_id,
        tournament_id: tournament.id,
        competition: tournament.name,
        season: tournament.season,
        match_type: 'tournament',
        title: `Quarter-Final ${idx + 1}`,
        tournament_stage: 'quarter_final',
        tournament_round: 2,
        tournament_match_number: matchNum,
        home_team_name: `Winner R16 #${idx * 2 + 1}`,
        away_team_name: `Winner R16 #${idx * 2 + 2}`,
        home_team_logo: DEFAULT_CREST,
        away_team_logo: DEFAULT_CREST,
        home_team_source: `Winner M#${r16Matches[idx * 2].tournament_match_number}`,
        away_team_source: `Winner M#${r16Matches[idx * 2 + 1].tournament_match_number}`,
        next_match_id: sfIds[Math.floor(idx / 2)],
        next_match_slot: idx % 2 === 0 ? 'home' : 'away',
        is_club_home: true,
        match_date: qfDate.toISOString().slice(0, 10),
        match_time: defaultTime,
        venue: defaultVenue,
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
      };
    });

    const sf1: Match = {
      id: sfIds[0],
      club_id: tournament.club_id,
      tournament_id: tournament.id,
      competition: tournament.name,
      season: tournament.season,
      match_type: 'tournament',
      title: 'Semi-Final 1',
      tournament_stage: 'semi_final',
      tournament_round: 3,
      tournament_match_number: matchSequence++,
      home_team_name: 'Winner QF 1',
      away_team_name: 'Winner QF 2',
      home_team_logo: DEFAULT_CREST,
      away_team_logo: DEFAULT_CREST,
      home_team_source: `Winner M#${qfMatches[0].tournament_match_number}`,
      away_team_source: `Winner M#${qfMatches[1].tournament_match_number}`,
      next_match_id: finalId,
      next_match_slot: 'home',
      is_club_home: true,
      match_date: sfDate.toISOString().slice(0, 10),
      match_time: defaultTime,
      venue: defaultVenue,
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
    };

    const sf2: Match = {
      id: sfIds[1],
      club_id: tournament.club_id,
      tournament_id: tournament.id,
      competition: tournament.name,
      season: tournament.season,
      match_type: 'tournament',
      title: 'Semi-Final 2',
      tournament_stage: 'semi_final',
      tournament_round: 3,
      tournament_match_number: matchSequence++,
      home_team_name: 'Winner QF 3',
      away_team_name: 'Winner QF 4',
      home_team_logo: DEFAULT_CREST,
      away_team_logo: DEFAULT_CREST,
      home_team_source: `Winner M#${qfMatches[2].tournament_match_number}`,
      away_team_source: `Winner M#${qfMatches[3].tournament_match_number}`,
      next_match_id: finalId,
      next_match_slot: 'away',
      is_club_home: true,
      match_date: sfDate.toISOString().slice(0, 10),
      match_time: defaultTime,
      venue: defaultVenue,
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
    };

    const finalMatch: Match = {
      id: finalId,
      club_id: tournament.club_id,
      tournament_id: tournament.id,
      competition: tournament.name,
      season: tournament.season,
      match_type: 'tournament',
      title: 'Championship Grand Final',
      tournament_stage: 'final',
      tournament_round: 4,
      tournament_match_number: matchSequence++,
      home_team_name: 'Winner Semi-Final 1',
      away_team_name: 'Winner Semi-Final 2',
      home_team_logo: DEFAULT_CREST,
      away_team_logo: DEFAULT_CREST,
      home_team_source: `Winner M#${sf1.tournament_match_number}`,
      away_team_source: `Winner M#${sf2.tournament_match_number}`,
      is_club_home: true,
      match_date: finalDate.toISOString().slice(0, 10),
      match_time: defaultTime,
      venue: defaultVenue,
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
    };

    allMatches.push(...r16Matches, ...qfMatches, sf1, sf2, finalMatch);

    // 3rd place match
    if (tournament.has_third_place_match) {
      const thirdPlaceId = stableId(`match-tourn-${tournament.id}-ko-third-place`);
      allMatches.push({
        id: thirdPlaceId,
        club_id: tournament.club_id,
        tournament_id: tournament.id,
        competition: tournament.name,
        season: tournament.season,
        match_type: 'tournament',
        title: '3rd Place Playoff',
        tournament_stage: 'third_place',
        tournament_round: 4,
        tournament_match_number: matchSequence++,
        home_team_name: 'Loser Semi-Final 1',
        away_team_name: 'Loser Semi-Final 2',
        home_team_logo: DEFAULT_CREST,
        away_team_logo: DEFAULT_CREST,
        home_team_source: `Loser M#${sf1.tournament_match_number}`,
        away_team_source: `Loser M#${sf2.tournament_match_number}`,
        is_club_home: true,
        match_date: finalDate.toISOString().slice(0, 10),
        match_time: '13:00',
        venue: defaultVenue,
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
      });
    }
  }

  return { matches: allMatches, updatedParticipants: participantsCopy };
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
 * Evaluates a completed match and advances the winner in the knockout bracket.
 * If tied in knockout, evaluates penalty shootouts.
 */
export function progressKnockoutMatch(allMatches: Match[], updatedMatch: Match): Match[] {
  const updatedMatches = [...allMatches];
  const matchIndex = updatedMatches.findIndex(m => m.id === updatedMatch.id);
  if (matchIndex === -1) return updatedMatches;

  updatedMatches[matchIndex] = updatedMatch;

  // Determine winner
  let winnerSide: 'home' | 'away' | null = null;

  if (updatedMatch.status === 'completed') {
    if (updatedMatch.home_score > updatedMatch.away_score) {
      winnerSide = 'home';
    } else if (updatedMatch.away_score > updatedMatch.home_score) {
      winnerSide = 'away';
    } else if (
      updatedMatch.home_penalty_score !== undefined &&
      updatedMatch.away_penalty_score !== undefined
    ) {
      // Penalty shootout winner
      if (updatedMatch.home_penalty_score > updatedMatch.away_penalty_score) {
        winnerSide = 'home';
      } else if (updatedMatch.away_penalty_score > updatedMatch.home_penalty_score) {
        winnerSide = 'away';
      }
    }
  }

  updatedMatches[matchIndex].winner_side = winnerSide || undefined;

  // If winner resolved and has downstream match
  if (winnerSide && updatedMatch.next_match_id) {
    const nextMatchIdx = updatedMatches.findIndex(m => m.id === updatedMatch.next_match_id);
    if (nextMatchIdx !== -1) {
      const nextMatch = { ...updatedMatches[nextMatchIdx] };
      const winningTeamName = winnerSide === 'home' ? updatedMatch.home_team_name : updatedMatch.away_team_name;
      const winningTeamLogo = winnerSide === 'home' ? updatedMatch.home_team_logo : updatedMatch.away_team_logo;

      if (updatedMatch.next_match_slot === 'home') {
        nextMatch.home_team_name = winningTeamName;
        nextMatch.home_team_logo = winningTeamLogo;
      } else {
        nextMatch.away_team_name = winningTeamName;
        nextMatch.away_team_logo = winningTeamLogo;
      }

      updatedMatches[nextMatchIdx] = nextMatch;
    }
  }

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
  const updatedMatches = [...matches];

  updatedMatches.forEach((m, idx) => {
    if (!m.tournament_stage || m.tournament_stage === 'group') return;

    let modified = false;
    const matchCopy = { ...m };

    // Check home team source e.g. "1st Group A"
    if (matchCopy.home_team_source) {
      const parsed = parseGroupSource(matchCopy.home_team_source);
      if (parsed) {
        const groupStandings = standingsByGroup[parsed.group];
        if (groupStandings && groupStandings.length >= parsed.rank) {
          const qualifiedTeam = groupStandings[parsed.rank - 1];
          if (qualifiedTeam && qualifiedTeam.played > 0 && matchCopy.home_team_name !== qualifiedTeam.name) {
            matchCopy.home_team_name = qualifiedTeam.name;
            matchCopy.home_team_logo = qualifiedTeam.logo_url;
            modified = true;
          }
        }
      }
    }

    // Check away team source e.g. "2nd Group B"
    if (matchCopy.away_team_source) {
      const parsed = parseGroupSource(matchCopy.away_team_source);
      if (parsed) {
        const groupStandings = standingsByGroup[parsed.group];
        if (groupStandings && groupStandings.length >= parsed.rank) {
          const qualifiedTeam = groupStandings[parsed.rank - 1];
          if (qualifiedTeam && qualifiedTeam.played > 0 && matchCopy.away_team_name !== qualifiedTeam.name) {
            matchCopy.away_team_name = qualifiedTeam.name;
            matchCopy.away_team_logo = qualifiedTeam.logo_url;
            modified = true;
          }
        }
      }
    }

    if (modified) {
      updatedMatches[idx] = matchCopy;
    }
  });

  return updatedMatches;
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
