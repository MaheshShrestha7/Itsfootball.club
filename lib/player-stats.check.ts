// Self-check for player stats helpers.
// Run: npx esbuild lib/player-stats.check.ts --bundle --platform=node --log-level=warning | node
import assert from 'node:assert/strict';
import type { PlayerStats } from './supabase/types';
import { addSeasonStats } from './player-stats';

const row = (id: string, member_id: string, season: string, goals = 0): PlayerStats => ({
  id, club_id: 'c1', member_id, season, appearances: 0, minutes_played: 0, goals, assists: 0, clean_sheets: 0, yellow_cards: 0, red_cards: 0, motm_awards: 0,
});
const rows = [row('a', 'm1', '2025/26', 4), row('b', 'm1', '2026/27', 1), row('c', 'm2', '2026/27', 2)];

// Only the given season's row changes; last season keeps its history
const after = addSeasonStats(rows, { clubId: 'c1', memberId: 'm1', season: '2026/27' }, { goals: 1, appearances: 1, minutes_played: 90 });
assert.deepEqual(after.map(r => [r.id, r.goals, r.appearances, r.minutes_played]), [['a', 4, 0, 0], ['b', 2, 1, 90], ['c', 2, 0, 0]]);

// No row for that season yet: one is added with the delta
const added = addSeasonStats(rows, { clubId: 'c1', memberId: 'm2', season: '2025/26' }, { assists: 1 });
assert.equal(added.length, 4);
const fresh = added[3];
assert.equal(fresh.member_id, 'm2');
assert.equal(fresh.season, '2025/26');
assert.equal(fresh.assists, 1);
assert.equal(fresh.goals, 0);
// Stable id: adding to the same new row twice in one batch keeps one row
assert.equal(addSeasonStats(added, { clubId: 'c1', memberId: 'm2', season: '2025/26' }, { assists: 1 }).length, 4);
assert.match(fresh.id, /^[0-9a-f-]{36}$/);

console.log('player-stats checks passed');
