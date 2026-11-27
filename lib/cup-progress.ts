// An outside cup the club only enters (a club event with linked fixtures): after its last game,
// should admin be asked "Did we go through?" and offered the next knockout game?
import { clubResult } from '@/lib/fixtures';
import type { ClubEvent, CupFinish, CupFormat, Match } from '@/lib/supabase/types';

export type KoStage = Exclude<NonNullable<Match['tournament_stage']>, 'group' | 'third_place'>;

export const CUP_FORMATS: [CupFormat, string][] = [
  ['group_ko', 'Groups, then knockouts'], ['league', 'League'], ['knockout', 'Knockout'],
];

export const KO_ROUNDS: [KoStage, string][] = [
  ['round_of_32', 'Round of 32'], ['round_of_16', 'Round of 16'], ['quarter_final', 'Quarter-final'], ['semi_final', 'Semi-final'], ['final', 'Final'],
];

export const isKoStage = (s?: string | null): s is KoStage => KO_ROUNDS.some(([k]) => k === s);
export const roundName = (s?: string | null) => KO_ROUNDS.find(([k]) => k === s)?.[1] || (s === 'third_place' ? 'Third place' : '');

export interface CupAsk {
  /** The last game played; the question is about what came after it */
  last: Match;
  team_id: string | null;
  /** groups: last group game done; won/drew/lost: a knockout game */
  kind: 'groups' | 'won' | 'drew' | 'lost';
  /** The round after the last one, when known */
  next?: KoStage;
}

const time = (m: Match) => new Date(m.match_date).getTime() || 0;

/** One question per team whose games in the cup are all played, or none (cup done, league, not set) */
export function cupAsks(event: Pick<ClubEvent, 'id' | 'cup_format' | 'completed_at'>, matches: Match[]): CupAsk[] {
  if (event.completed_at || (event.cup_format !== 'group_ko' && event.cup_format !== 'knockout')) return [];
  const games = matches.filter(m => m.event_id === event.id && m.match_type !== 'internal' && m.status !== 'cancelled');
  const asks: CupAsk[] = [];
  for (const team of new Set(games.map(m => m.team_id || null))) {
    const own = games.filter(m => (m.team_id || null) === team);
    if (own.some(m => m.status !== 'completed' && m.status !== 'postponed')) continue;
    const last = own.filter(m => m.status === 'completed').sort((a, b) => time(b) - time(a))[0];
    if (!last) continue;
    const stage = last.tournament_stage || 'group';
    if (stage === 'final' || stage === 'third_place') continue;
    const i = KO_ROUNDS.findIndex(([k]) => k === stage);
    const next = i >= 0 ? KO_ROUNDS[i + 1]?.[0] : undefined;
    if (stage === 'group' && event.cup_format === 'group_ko') { asks.push({ last, team_id: team, kind: 'groups' }); continue; }
    const outcome = clubResult(last).outcome;
    if (!outcome) continue;
    asks.push({ last, team_id: team, kind: outcome === 'W' ? 'won' : outcome === 'D' ? 'drew' : 'lost', next });
  }
  return asks;
}

/** How a team finished, guessed from its last game, for the Mark as completed popup */
export function guessFinish(last: Match): CupFinish | null {
  const stage = last.tournament_stage || 'group';
  if (stage === 'group') return { stage: 'group' };
  if (stage === 'final') { const o = clubResult(last).outcome; return o === 'W' ? { stage: 'won' } : o === 'L' ? { stage: 'final' } : null; }
  return stage === 'semi_final' ? { stage: 'semi' } : stage === 'quarter_final' ? { stage: 'quarter' } : null;
}
