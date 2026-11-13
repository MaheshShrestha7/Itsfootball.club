import assert from 'node:assert/strict';
import { boardsAreBlank, cleanBoards, defaultBoards, hitItem, lineShape, sampleCurve, simplify, MAX_ITEMS, type Pt } from './tactics-board';

// Nothing saved yet: the five starter boards, blank
const blank = cleanBoards(null);
assert.deepEqual(blank.map(b => b.name), ['Open play', 'Our corner', 'Their corner', 'Free kick', 'Goal kick']);
assert.equal(boardsAreBlank(blank), true);
assert.deepEqual(cleanBoards('junk'), defaultBoards());

// Saved boards come back as drawn; anything malformed is dropped, and colours stay in the palette
const saved = cleanBoards([
  { id: 'corner', name: 'Renamed', show: true, note: 'Near post', players: { 'slot-1': [50, 8], bad: 'x', 'slot-2': [200, -40] },
    items: [
      { t: 'run', c: '#FACC15', p: [[10, 10], [20, 20]] },
      { t: 'pass', c: 'url(javascript:1)', p: [[1, 1], [2, 2]] },
      { t: 'run', c: '#FFFFFF', p: [[1, 1]] },
      { t: 'zone', c: '#38BDF8', x: 10, y: 10, w: 20, h: 9 },
      { t: 'opp', x: 40, y: 40 },
      { t: 'ball', x: 'NaN', y: 3 },
      { t: '<script>', x: 1, y: 1 },
      null,
    ] },
  { id: 'my-press', name: '  High press  ', items: [] },
  { id: 'my-press', name: 'Twice' },
  { id: 'bad id!', name: 'x' },
]);
const corner = saved.find(b => b.id === 'corner')!;
assert.equal(corner.name, 'Our corner', 'starter boards keep their names');
assert.equal(corner.show, true);
assert.deepEqual(corner.players, { 'slot-1': [50, 8], 'slot-2': [98, 2] });
assert.deepEqual(corner.items.map(i => i.t), ['run', 'pass', 'zone', 'opp']);
assert.equal((corner.items[1] as { c: string }).c, '#FFFFFF');
assert.equal((corner.items[3] as { n?: number }).n, 1);
assert.deepEqual(saved.map(b => b.id), ['open', 'corner', 'their-corner', 'free-kick', 'goal-kick', 'my-press']);
assert.equal(saved[5].name, 'High press');
assert.equal(boardsAreBlank(saved), false);
assert.equal(cleanBoards([{ id: 'open', items: Array.from({ length: 200 }, () => ({ t: 'cone', x: 5, y: 5 })) }])[0].items.length, MAX_ITEMS);

// A shaky straight line becomes its two ends; a real corner is kept
const shaky: Pt[] = [[0, 0], [10, 0.3], [20, -0.2], [30, 0.1], [40, 0]];
assert.deepEqual(simplify(shaky, 1.6), [[0, 0], [40, 0]]);
assert.equal(simplify([[0, 0], [20, 0], [20, 20]], 1.6).length, 3);

// The curve is sampled evenly and ends exactly on the last point
const curve = sampleCurve([[0, 0], [50, 0], [100, 0]], 2);
assert.deepEqual(curve[curve.length - 1], [100, 0]);
assert.ok(Math.abs(curve.length - 51) <= 1, `about one point every 2px, got ${curve.length}`);

// An arrow has a head at the tip; the pen and a tiny flick have none
const run = lineShape('run', [[0, 0], [100, 0]]);
assert.ok(run.head.startsWith('100.0,0.0 '), run.head);
assert.ok(run.d.startsWith('M0.0 0.0L'));
assert.equal(lineShape('pen', [[0, 0], [100, 0]]).head, '');
assert.equal(lineShape('run', [[0, 0], [6, 0]]).head, '');
// A dribble leaves the straight line, a run does not
const offLine = (d: string) => d.slice(1).split('L').some(q => Math.abs(Number(q.split(' ')[1])) > 2);
assert.equal(offLine(lineShape('dribble', [[0, 0], [100, 0]]).d), true);
assert.equal(offLine(run.d), false);

// Erase: the drawing under the tap, the top one when two overlap, nothing on open grass
const items = cleanBoards([{ id: 'open', items: [
  { t: 'zone', c: '#FACC15', x: 10, y: 10, w: 30, h: 30 },
  { t: 'run', c: '#FFFFFF', p: [[0, 50], [100, 50]] },
  { t: 'ball', x: 20, y: 20 },
] }])[0].items;
assert.equal(hitItem(items, [50, 51], 400, 600), 1);
assert.equal(hitItem(items, [20, 20], 400, 600), 2);
assert.equal(hitItem(items, [35, 35], 400, 600), 0);
assert.equal(hitItem(items, [80, 90], 400, 600), -1);

console.log('tactics-board checks passed');
