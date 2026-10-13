import type { PlayerStats } from './supabase/types';
import { stableId } from './ids';

export type StatsDelta = Partial<Pick<PlayerStats, 'appearances' | 'minutes_played' | 'goals' | 'assists' | 'clean_sheets' | 'yellow_cards' | 'red_cards' | 'motm_awards'>>;

/**
 * Adds to one member's stats for one season (a member has one row per season). Other seasons
 * keep their history. A member with no row for that season gets one, so nothing is lost.
 */
export function addSeasonStats(rows: PlayerStats[], target: { clubId: string; memberId: string; season: string }, delta: StatsDelta): PlayerStats[] {
  const { clubId, memberId, season } = target;
  const apply = (row: PlayerStats): PlayerStats => {
    const next = { ...row };
    (Object.keys(delta) as (keyof StatsDelta)[]).forEach(k => {
      next[k] = (row[k] || 0) + (delta[k] || 0);
    });
    return next;
  };
  if (rows.some(s => s.member_id === memberId && s.season === season)) {
    return rows.map(s => (s.member_id === memberId && s.season === season ? apply(s) : s));
  }
  return [...rows, apply({
    id: stableId(`stat-${memberId}-${season}`),
    club_id: clubId,
    member_id: memberId,
    season,
    appearances: 0,
    minutes_played: 0,
    goals: 0,
    assists: 0,
    clean_sheets: 0,
    yellow_cards: 0,
    red_cards: 0,
    motm_awards: 0,
  })];
}
