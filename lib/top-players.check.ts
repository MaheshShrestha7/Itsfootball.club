import assert from 'node:assert/strict';
import { hasSeasonStats, inPositionGroup, leadsWithCleanSheets, rankPlayers, rankView } from './top-players';

const players = [
  { id: 'a', full_name: 'Arjun' }, { id: 'b', full_name: 'Bivek' }, { id: 'c', full_name: 'Chandra' },
];
const stats: Record<string, { goals?: number; assists?: number; clean_sheets?: number; appearances?: number; motm_awards?: number }> = {
  a: { goals: 2, clean_sheets: 0, appearances: 4 },
  b: { goals: 0, clean_sheets: 3, appearances: 4 },
  c: { goals: 0, clean_sheets: 3, appearances: 2, assists: 1 },
};
const statFor = (id: string) => stats[id];

// Outfield: goals first
assert.deepEqual(rankPlayers(players, statFor, 'MID', 'overall').map(p => p.id), ['a', 'c', 'b']);
// Keepers: clean sheets, then games
assert.deepEqual(rankPlayers(players, statFor, 'GK', 'overall').map(p => p.id), ['b', 'c', 'a']);
// Defenders: clean sheets, then goals, then assists
assert.deepEqual(rankPlayers(players, statFor, 'DEF', 'overall').map(p => p.id), ['c', 'b', 'a']);
// One figure, ties keep the overall order
assert.deepEqual(rankPlayers(players, statFor, 'GK', 'appearances').map(p => p.id), ['b', 'a', 'c']);
// A tab the view doesn't have falls back to overall
assert.deepEqual(rankPlayers(players, statFor, 'GK', 'goals').map(p => p.id), ['b', 'c', 'a']);

assert.equal(rankView('GK').leader.map(l => l.key).includes('goals'), false);
assert.equal(rankView('DEF').leader[0].key, 'clean_sheets');
assert.equal(rankView('ALL').leader[0].key, 'goals');
assert.ok(leadsWithCleanSheets('GK') && leadsWithCleanSheets('LB') && !leadsWithCleanSheets('CM') && !leadsWithCleanSheets(null));
assert.ok(inPositionGroup('ST', 'FWD') && !inPositionGroup('ST', 'MID') && inPositionGroup(undefined, 'ALL'));
assert.ok(hasSeasonStats({ clean_sheets: 1 }) && !hasSeasonStats({}) && !hasSeasonStats(undefined));
console.log('top-players: ok');
