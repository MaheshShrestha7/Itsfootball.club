// Season picker and ClubScore points breakdown for the member Season Stats tab.
import type { ClubSeason, GamificationActivityLog, GamificationEventType } from './supabase/types';

/**
 * Seasons a member can pick: the club's seasons (newest first), plus any other season
 * names their stats, ClubScore or the club's fixtures were saved under. The active one
 * is always in the list.
 */
export function seasonOptions(clubSeasons: ClubSeason[], activeName: string, extraNames: (string | null | undefined)[]): string[] {
  const named = [...clubSeasons]
    .sort((a, b) => String(b.start_date || '').localeCompare(String(a.start_date || '')) || b.name.localeCompare(a.name))
    .map(s => s.name);
  const extras = extraNames.filter((n): n is string => !!n && !named.includes(n));
  const all = [...new Set([...named, ...extras.sort((a, b) => b.localeCompare(a))])];
  return all.includes(activeName) ? all : [activeName, ...all];
}

/** A fixture or event without a season counts toward the active one (as the database awards it) */
export function inSeason(rowSeason: string | null | undefined, season: string, activeName: string): boolean {
  return (rowSeason || activeName) === season;
}

export const POINTS_SOURCE_LABELS: Record<GamificationEventType, string> = {
  match_appearance: 'Match appearances',
  match_goal: 'Goals',
  match_assist: 'Assists',
  match_clean_sheet: 'Clean sheets',
  match_motm: 'Man of the Match',
  training_checkin: 'Training check-ins',
  social_checkin: 'Social event check-ins',
  streak_bonus: 'Streak bonuses',
  admin_award: 'Awards from the club',
  disciplinary_card: 'Cards',
};

export interface PointsBreakdownRow {
  source: GamificationEventType | 'adjustment';
  label: string;
  count: number;
  points: number;
}

/**
 * Splits a member's ClubScore points for one season by where they came from.
 * A ledger entry belongs to the season of the fixture or event it references; entries
 * without one go by their date within the season's start and end dates. When the
 * ledger doesn't add up to the season total (older entries, manual edits) the
 * difference is shown as its own row, so the rows always add up to the total shown.
 */
export function pointsBreakdown(
  logs: GamificationActivityLog[],
  opts: {
    season: string;
    activeName: string;
    seasonRecord?: Pick<ClubSeason, 'start_date' | 'end_date'>;
    referenceSeason: (id: string) => string | null | undefined;
    total?: number;
  }
): PointsBreakdownRow[] {
  const { season, activeName, seasonRecord, referenceSeason, total } = opts;
  const belongs = (log: GamificationActivityLog): boolean => {
    if (log.reference_id) {
      const ref = referenceSeason(log.reference_id);
      if (ref !== undefined) return inSeason(ref, season, activeName);
    }
    if (seasonRecord?.start_date && seasonRecord?.end_date) {
      const day = String(log.created_at || '').slice(0, 10);
      return day >= seasonRecord.start_date && day <= seasonRecord.end_date;
    }
    return season === activeName;
  };

  const bySource = new Map<GamificationEventType, PointsBreakdownRow>();
  logs.filter(belongs).forEach(log => {
    const row = bySource.get(log.event_type) || { source: log.event_type, label: POINTS_SOURCE_LABELS[log.event_type] || log.event_type, count: 0, points: 0 };
    row.count += 1;
    row.points += log.final_points ?? log.points_awarded ?? 0;
    bySource.set(log.event_type, row);
  });

  const order = Object.keys(POINTS_SOURCE_LABELS);
  const rows: PointsBreakdownRow[] = [...bySource.values()].sort((a, b) => order.indexOf(a.source) - order.indexOf(b.source));
  if (typeof total === 'number') {
    const diff = total - rows.reduce((sum, r) => sum + r.points, 0);
    if (diff !== 0) rows.push({ source: 'adjustment', label: 'Other adjustments', count: 0, points: diff });
  }
  return rows;
}
