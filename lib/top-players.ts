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
type Stat = Partial<Pick<PlayerStats, StatKey>> | undefined;

export interface RankView {
  /** The stats a ranking falls back on for ties, in order; the first tab sorts on exactly this */
  order: StatKey[];
  tabs: [StatKey, string][];
  /** Table columns; `wide` ones only show on desktop */
  columns: { key: StatKey; label: string; abbr?: string; wide?: boolean }[];
  /** The figures on the 1st-place card */
  leader: { key: StatKey; label: string; abbr?: string }[];
}

const LABEL: Record<StatKey, string> = {
  goals: 'Goals', assists: 'Assists', motm_awards: 'Player of the Match', appearances: 'Games', clean_sheets: 'Clean sheets',
};
const tab = (k: StatKey): [StatKey, string] => [k, LABEL[k]];
const col = (key: StatKey, wide = false) =>
  key === 'motm_awards' ? { key, label: LABEL[key], abbr: 'PotM', wide } : { key, label: LABEL[key], wide };

const OUTFIELD: RankView = {
  order: ['goals', 'assists', 'motm_awards', 'appearances'],
  tabs: (['goals', 'assists', 'motm_awards', 'appearances'] as StatKey[]).map(tab),
  columns: [col('goals'), col('assists'), col('motm_awards'), col('appearances', true)],
  leader: (['goals', 'assists', 'motm_awards', 'appearances'] as StatKey[]).map(key => col(key)),
};
const KEEPERS: RankView = {
  order: ['clean_sheets', 'appearances', 'motm_awards'],
  tabs: (['clean_sheets', 'appearances', 'motm_awards'] as StatKey[]).map(tab),
  columns: [col('clean_sheets'), col('appearances'), col('motm_awards')],
  leader: (['clean_sheets', 'appearances', 'motm_awards'] as StatKey[]).map(key => col(key)),
};
const DEFENDERS: RankView = {
  order: ['clean_sheets', 'goals', 'assists', 'motm_awards', 'appearances'],
  tabs: (['clean_sheets', 'goals', 'assists', 'appearances'] as StatKey[]).map(tab),
  columns: [col('clean_sheets'), col('goals'), col('assists'), col('appearances', true)],
  leader: (['clean_sheets', 'appearances', 'goals', 'assists'] as StatKey[]).map(key => col(key)),
};

export const rankView = (group: PositionGroup): RankView =>
  group === 'GK' ? KEEPERS : group === 'DEF' ? DEFENDERS : OUTFIELD;

/** The figures a ranking compares: the chosen one, then the view's order for ties */
const rankKeys = (group: PositionGroup, rankBy: StatKey): StatKey[] => {
  const v = rankView(group);
  return v.tabs.some(([k]) => k === rankBy) ? [rankBy, ...v.order] : v.order;
};

/** Sort by one figure (ties keeping the view's order), then by name */
export function rankPlayers<P extends { id: string; full_name: string }>(
  players: P[], statFor: (id: string) => Stat, group: PositionGroup, rankBy: StatKey,
): P[] {
  const keys = rankKeys(group, rankBy);
  return [...players].sort((a, b) => {
    for (const k of keys) {
      const d = (statFor(b.id)?.[k] ?? 0) - (statFor(a.id)?.[k] ?? 0);
      if (d) return d;
    }
    return a.full_name.localeCompare(b.full_name);
  });
}

/** Each place in a list from rankPlayers. Players level on every figure share one (1, =2, =2, 4),
 *  because only the alphabet separates them. Pass the whole list, so a tie across the cut still shows. */
export function rankPlaces<P extends { id: string }>(
  ranked: P[], statFor: (id: string) => Stat, group: PositionGroup, rankBy: StatKey,
): { place: number; tied: boolean }[] {
  const keys = rankKeys(group, rankBy);
  const level = (a?: P, b?: P) => !!a && !!b && keys.every(k => (statFor(a.id)?.[k] ?? 0) === (statFor(b.id)?.[k] ?? 0));
  let place = 1;
  return ranked.map((p, i) => {
    if (i > 0 && !level(ranked[i - 1], p)) place = i + 1;
    return { place, tied: level(ranked[i - 1], p) || level(p, ranked[i + 1]) };
  });
}

/** Has done something this season, so a rank means something */
export const hasSeasonStats = (st: Stat) =>
  !!(st?.appearances || st?.goals || st?.assists || st?.motm_awards || st?.clean_sheets);
