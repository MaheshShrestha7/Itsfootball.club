import type { PlayerStats } from '@/lib/supabase/types';
import { DEFENDER_POSITIONS, KEEPER_POSITIONS } from '@/lib/club-overview';

/** The Top Players position filter on the club home page */
export type PositionGroup = 'ALL' | 'GK' | 'DEF' | 'MID' | 'FWD';
export const POSITION_GROUPS: Record<Exclude<PositionGroup, 'ALL'>, readonly string[]> = {
  GK: KEEPER_POSITIONS,
  DEF: DEFENDER_POSITIONS,
  MID: ['CDM', 'CM', 'CAM'],
  FWD: ['LW', 'RW', 'ST'],
};
export const inPositionGroup = (pos: string | null | undefined, group: PositionGroup) =>
  group === 'ALL' || POSITION_GROUPS[group].includes(pos || '');

/** Keepers and defenders are judged on clean sheets, like the Golden Glove; the Save Player Stats
 *  screen only offers a clean sheet to these positions */
export const leadsWithCleanSheets = (pos: string | null | undefined) =>
  inPositionGroup(pos, 'GK') || inPositionGroup(pos, 'DEF');

export type StatKey = 'goals' | 'assists' | 'motm_awards' | 'appearances' | 'clean_sheets';
export type RankKey = 'overall' | StatKey;
type Stat = Partial<Pick<PlayerStats, StatKey>> | undefined;

export interface RankView {
  /** The stats an overall ranking sorts on, in order */
  order: StatKey[];
  /** Read out under the heading: "ranked by …" */
  overallText: string;
  tabs: [RankKey, string][];
  /** Table columns; `wide` ones only show on desktop */
  columns: { key: StatKey; label: string; abbr?: string; wide?: boolean }[];
  /** The figures on the 1st-place card */
  leader: { key: StatKey; label: string }[];
}

const LABEL: Record<StatKey, string> = {
  goals: 'Goals', assists: 'Assists', motm_awards: 'Player of the Match', appearances: 'Games', clean_sheets: 'Clean sheets',
};
const tab = (k: RankKey): [RankKey, string] => [k, k === 'overall' ? 'Overall' : LABEL[k]];
const col = (key: StatKey, wide = false) =>
  key === 'motm_awards' ? { key, label: LABEL[key], abbr: 'PotM', wide } : { key, label: LABEL[key], wide };

const OUTFIELD: RankView = {
  order: ['goals', 'assists', 'motm_awards', 'appearances'],
  overallText: 'goals, then assists, Player of the Match and games',
  tabs: (['overall', 'goals', 'assists', 'motm_awards', 'appearances'] as RankKey[]).map(tab),
  columns: [col('goals'), col('assists'), col('motm_awards'), col('appearances', true)],
  leader: (['goals', 'assists', 'motm_awards', 'appearances'] as StatKey[]).map(key => ({ key, label: LABEL[key] })),
};
const KEEPERS: RankView = {
  order: ['clean_sheets', 'appearances', 'motm_awards'],
  overallText: 'clean sheets, then games and Player of the Match',
  tabs: (['overall', 'clean_sheets', 'appearances', 'motm_awards'] as RankKey[]).map(tab),
  columns: [col('clean_sheets'), col('appearances'), col('motm_awards')],
  leader: (['clean_sheets', 'appearances', 'motm_awards'] as StatKey[]).map(key => ({ key, label: LABEL[key] })),
};
const DEFENDERS: RankView = {
  order: ['clean_sheets', 'goals', 'assists', 'motm_awards', 'appearances'],
  overallText: 'clean sheets, then goals and assists, Player of the Match and games',
  tabs: (['overall', 'clean_sheets', 'goals', 'assists', 'appearances'] as RankKey[]).map(tab),
  columns: [col('clean_sheets'), col('goals'), col('assists'), col('appearances', true)],
  leader: (['clean_sheets', 'appearances', 'goals', 'assists'] as StatKey[]).map(key => ({ key, label: LABEL[key] })),
};

export const rankView = (group: PositionGroup): RankView =>
  group === 'GK' ? KEEPERS : group === 'DEF' ? DEFENDERS : OUTFIELD;

/** Sort by the view's overall order (or one figure, ties keeping the overall order), then by name */
export function rankPlayers<P extends { id: string; full_name: string }>(
  players: P[], statFor: (id: string) => Stat, group: PositionGroup, rankBy: RankKey,
): P[] {
  const v = rankView(group);
  const keys = rankBy === 'overall' || !v.tabs.some(([k]) => k === rankBy) ? v.order : [rankBy as StatKey, ...v.order];
  return [...players].sort((a, b) => {
    for (const k of keys) {
      const d = (statFor(b.id)?.[k] ?? 0) - (statFor(a.id)?.[k] ?? 0);
      if (d) return d;
    }
    return a.full_name.localeCompare(b.full_name);
  });
}

/** Has done something this season, so a rank means something */
export const hasSeasonStats = (st: Stat) =>
  !!(st?.appearances || st?.goals || st?.assists || st?.motm_awards || st?.clean_sheets);
