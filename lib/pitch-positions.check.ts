// Self-check for line-up slot filling.
// Run: npx esbuild lib/pitch-positions.check.ts --bundle --platform=node --log-level=warning | node
import assert from 'node:assert/strict';
import type { PlayerPosition } from './supabase/types';
import { fillSlots, slotFit } from './pitch-positions';

const p = (name: string, player_position?: PlayerPosition, secondary_positions?: PlayerPosition[]) => ({ name, player_position, secondary_positions });

// Keepers stay in goal and outfield players stay out of it
assert.equal(slotFit(p('k', 'GK'), 'RB'), null);
assert.equal(slotFit(p('d', 'CB'), 'GK'), null);
assert.equal(slotFit(p('k', 'GK'), 'GK'), 0);
// Own position, then a second position, then the same line, then further away
assert.equal(slotFit(p('w', 'RW'), 'RW'), 0);
assert.equal(slotFit(p('w', 'RW', ['CAM']), 'CAM'), 1);
assert.equal(slotFit(p('w', 'RW'), 'ST'), 2);
assert.equal(slotFit(p('w', 'RW'), 'CM'), 3);
assert.equal(slotFit(p('w', 'RW'), 'CB'), 4);
// No position on file: anywhere, after everyone who fits
assert.equal(slotFit(p('x'), 'GK'), 5);

// The UX30-3 case: list order is CB, CB, RB, GK, ... and a 4-3-3 starts with GK
const squad = [p('Oliver', 'CB'), p('Jack', 'CB'), p('Noah', 'RB'), p('Liam', 'GK'), p('Lucas', 'CDM'), p('Henry', 'CM'), p('William', 'LB')];
const slots = ['GK', 'LB', 'CB', 'CB', 'RB', 'CDM', 'CM', 'CAM', 'LW', 'ST', 'RW'];
const got = fillSlots(slots, squad).map(x => x?.name);
assert.deepEqual(got, ['Liam', 'William', 'Oliver', 'Jack', 'Noah', 'Lucas', 'Henry', undefined, undefined, undefined, undefined]);

// A second keeper is left on the bench rather than played outfield; no keeper leaves goal empty
assert.deepEqual(fillSlots(['GK', 'ST'], [p('a', 'GK'), p('b', 'GK')]).map(x => x?.name), ['a', undefined]);
assert.deepEqual(fillSlots(['GK', 'ST'], [p('c', 'ST')]).map(x => x?.name), [undefined, 'c']);
// Earlier players win a tie (the list comes sorted In first)
assert.deepEqual(fillSlots(['ST'], [p('in', 'ST'), p('maybe', 'ST')]).map(x => x?.name), ['in']);

console.log('pitch-positions checks passed');
