// Self-check for the member Season Stats helpers.
// Run: npx esbuild lib/member-season-stats.check.ts --bundle --platform=node --log-level=warning | node
import assert from 'node:assert/strict';
import type { ClubSeason, GamificationActivityLog } from './supabase/types';
import { inSeason, pointsBreakdown, seasonOptions } from './member-season-stats';

const season = (name: string, start_date: string, end_date: string, is_current = false): ClubSeason => ({
  id: name, club_id: 'c1', name, start_date, end_date, is_current, status: is_current ? 'active' : 'completed',
});
const log = (id: string, event_type: GamificationActivityLog['event_type'], final_points: number, created_at: string, reference_id?: string): GamificationActivityLog => ({
  id, club_id: 'c1', member_id: 'm1', event_type, points_awarded: final_points, multiplier: 1, final_points, description: id, created_at, reference_id,
});

// Newest season first; seasons only found in data are added; the active one is always there
const seasons = [season('2025/26', '2025-08-01', '2026-07-31'), season('2026/27', '2026-08-01', '2027-07-31', true)];
assert.deepEqual(seasonOptions(seasons, '2026/27', ['2025/2026', '2026/27', null, '']), ['2026/27', '2025/26', '2025/2026']);
assert.deepEqual(seasonOptions([], '2026/27', []), ['2026/27']);

// Rows without a season belong to the active season
assert.equal(inSeason(undefined, '2026/27', '2026/27'), true);
assert.equal(inSeason(null, '2025/26', '2026/27'), false);
assert.equal(inSeason('2025/26', '2025/26', '2026/27'), true);

const refs: Record<string, string | null> = { matchOld: '2025/26', matchNew: '2026/27', eventNoSeason: null };
const logs = [
  log('a', 'match_appearance', 5, '2026-09-01T10:00:00Z', 'matchNew'),
  log('b', 'match_goal', 10, '2026-09-01T10:00:00Z', 'matchNew'),
  log('c', 'match_goal', 12, '2026-09-08T10:00:00Z', 'matchNew'),
  log('d', 'disciplinary_card', -3, '2026-09-08T10:00:00Z', 'matchNew'),
  // Awarded this season for last season's fixture: goes by the fixture
  log('e', 'match_goal', 10, '2026-08-05T10:00:00Z', 'matchOld'),
  log('f', 'training_checkin', 2, '2026-09-02T10:00:00Z', 'eventNoSeason'),
  // No reference: goes by date
  log('g', 'admin_award', 20, '2026-03-01T10:00:00Z'),
];
const referenceSeason = (id: string) => (id in refs ? refs[id] : undefined);

const current = pointsBreakdown(logs, { season: '2026/27', activeName: '2026/27', seasonRecord: seasons[1], referenceSeason, total: 26 });
assert.deepEqual(current.map(r => [r.source, r.count, r.points]), [
  ['match_appearance', 1, 5], ['match_goal', 2, 22], ['training_checkin', 1, 2], ['disciplinary_card', 1, -3],
]);

const previous = pointsBreakdown(logs, { season: '2025/26', activeName: '2026/27', seasonRecord: seasons[0], referenceSeason, total: 40 });
assert.deepEqual(previous.map(r => [r.source, r.points]), [['match_goal', 10], ['admin_award', 20], ['adjustment', 10]]);
// Rows always add up to the season total
assert.equal(previous.reduce((s, r) => s + r.points, 0), 40);

console.log('member-season-stats checks passed');
