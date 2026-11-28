// The public tournament page's Overview: which phase the tournament is in, and its format in plain words.
import type { Match, Tournament } from './supabase/types';

/** The final (or every league game) is played, or the host marked the tournament completed */
export function tournamentOver(tournament: Pick<Tournament, 'status' | 'format'>, matches: Match[]): boolean {
  const done = matches.length > 0 && matches.every(m => m.status === 'completed' || m.status === 'cancelled');
  return tournament.status === 'completed' || (done && (tournament.format === 'league' || matches.some(m => m.tournament_stage === 'final')));
}

export type TournamentPhase = 'before' | 'during' | 'after';

const isOn = (m: Match) => m.status === 'live' || m.status === 'halftime';

/** From the games, not only the status the host sets: hosts often forget to mark a cup completed */
export function tournamentPhase(tournament: Tournament, matches: Match[]): TournamentPhase {
  if (tournamentOver(tournament, matches)) return 'after';
  return matches.some(m => m.status === 'completed' || isOn(m)) ? 'during' : 'before';
}

export const STAGES: [NonNullable<Match['tournament_stage']>, string][] = [
  ['group', 'Group stage'], ['round_of_32', 'Round of 32'], ['round_of_16', 'Round of 16'],
  ['quarter_final', 'Quarter-finals'], ['semi_final', 'Semi-finals'], ['final', 'Final'],
];
const koRound = (teams: number) => (teams <= 2 ? 'the final' : teams <= 4 ? 'the semi-finals' : teams <= 8 ? 'the quarter-finals' : 'the knockout rounds');
const mins = (half?: number | null) => (half ? `2 × ${half} minutes` : null);

/** "8 teams in 2 groups of 4. The top 2 in each group go into the semi-finals." from the stored settings */
export function formatLines(t: Tournament, teams: number): string[] {
  const lines: string[] = [];
  if (t.format === 'league') lines.push(`${teams} teams, everyone plays everyone once. Most points wins.`);
  else if (t.format === 'knockout') lines.push(`${teams} teams, straight knockout. Win and you're through.`);
  else {
    const groups = t.group_count ?? 1;
    const adv = t.teams_advancing_per_group ?? 2;
    const per = Math.round(teams / groups);
    lines.push(groups > 1 ? `${teams} teams in ${groups} groups of ${per}.` : `${teams} teams in one group.`);
    lines.push(`The top ${adv} ${groups > 1 ? 'in each group go' : 'go'} into ${koRound(groups * adv)}${t.has_third_place_match ? ', with a game for third place' : ''}.`);
  }
  const group = mins(t.half_minutes);
  const ko = t.format === 'group_knockout' ? mins(t.ko_half_minutes) : null;
  const final = t.format !== 'league' ? mins(t.final_half_minutes) : null;
  const len = [group && (ko || final ? `Group games ${group}` : `Games ${group}`), ko && `knockout games ${ko}`, final && `the final ${final}`].filter(Boolean);
  if (len.length) lines.push(`${len.join(', ')}.`);
  if (t.pitches && t.pitches > 1) lines.push(`Played on ${t.pitches} pitches at once.`);
  return lines;
}

