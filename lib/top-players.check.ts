import assert from 'node:assert/strict';
import { hasSeasonStats, inPositionGroup, leadsWithCleanSheets, playerFigures, rankPlaces, rankPlayers, rankView } from './top-players';
import { groupByLine } from './positions';

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
assert.deepEqual(rankPlayers(players, statFor, 'MID', 'goals').map(p => p.id), ['a', 'c', 'b']);
// Keepers: clean sheets, then games
assert.deepEqual(rankPlayers(players, statFor, 'GK', 'clean_sheets').map(p => p.id), ['b', 'c', 'a']);
// Defenders: clean sheets, then goals, then assists
assert.deepEqual(rankPlayers(players, statFor, 'DEF', 'clean_sheets').map(p => p.id), ['c', 'b', 'a']);
// One figure, ties keep the view's order
assert.deepEqual(rankPlayers(players, statFor, 'GK', 'appearances').map(p => p.id), ['b', 'a', 'c']);
// A tab the view doesn't have falls back to the view's order
assert.deepEqual(rankPlayers(players, statFor, 'GK', 'goals').map(p => p.id), ['b', 'c', 'a']);
// No tab repeats another's order: each view's first tab is its default, and there's no separate "overall"
assert.equal(rankView('ALL').tabs[0][0], 'goals');
assert.equal(rankView('GK').tabs[0][0], 'clean_sheets');
assert.equal(rankView('DEF').tabs[0][0], 'clean_sheets');

// Level on every figure: a shared place, and the next player's place skips past them
const level = [
  { id: 'p', full_name: 'P' }, { id: 'q', full_name: 'Q' }, { id: 'r', full_name: 'R' }, { id: 's', full_name: 'S' },
];
const levelStats: Record<string, { goals: number; appearances: number }> = {
  p: { goals: 2, appearances: 4 }, q: { goals: 1, appearances: 4 }, r: { goals: 1, appearances: 4 }, s: { goals: 0, appearances: 4 },
};
assert.deepEqual(rankPlaces(level, id => levelStats[id], 'ALL', 'goals'), [
  { place: 1, tied: false }, { place: 2, tied: true }, { place: 2, tied: true }, { place: 4, tied: false },
]);
// Level on the chosen figure but split by a tiebreak (one more goal) is not a tie
assert.deepEqual(rankPlaces(level.slice(0, 2), id => levelStats[id], 'ALL', 'appearances'), [
  { place: 1, tied: false }, { place: 2, tied: false },
]);

assert.equal(rankView('GK').leader.map(l => l.key).includes('goals'), false);
assert.equal(rankView('DEF').leader[0].key, 'clean_sheets');
assert.equal(rankView('ALL').leader[0].key, 'goals');
assert.ok(leadsWithCleanSheets('GK') && leadsWithCleanSheets('LB') && !leadsWithCleanSheets('CM') && !leadsWithCleanSheets(null));
assert.ok(inPositionGroup('ST', 'FWD') && !inPositionGroup('ST', 'MID') && inPositionGroup(undefined, 'ALL'));
assert.ok(hasSeasonStats({ clean_sheets: 1 }) && !hasSeasonStats({}) && !hasSeasonStats(undefined));

// A player's figures by position; nothing saved reads as noughts
const season = { appearances: 4, goals: 2, assists: 1, motm_awards: 1, clean_sheets: 3 };
assert.deepEqual(playerFigures('ST', season).map(f => [f.key, f.n]), [['appearances', 4], ['goals', 2], ['assists', 1], ['motm_awards', 1]]);
assert.deepEqual(playerFigures('GK', season).map(f => f.key), ['appearances', 'clean_sheets', 'assists', 'motm_awards']);
assert.deepEqual(playerFigures('CB', season).map(f => f.key), ['appearances', 'clean_sheets', 'goals', 'assists']);
assert.deepEqual(playerFigures(null, undefined).map(f => f.n), [0, 0, 0, 0]);

// A squad by line: pitch order, no empty lines, and an unknown position still appears
const lined = groupByLine([{ player_position: 'ST' }, { player_position: 'GK' }, { player_position: 'LWB' }, { player_position: null }, { player_position: 'SUB' }]);
assert.deepEqual(lined.map(g => [g.key, g.list.length]), [['GK', 1], ['DEF', 1], ['FWD', 1], ['OTHER', 2]]);
console.log('top-players: ok');
