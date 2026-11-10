import assert from 'node:assert/strict';
import { cameOn, minutesOnPitch, subDetail, subPlayers, wasSubbedOff } from './match-subs';

const sub = (on: string, off: string, minute: number) => ({ event_type: 'sub' as const, player_name: on, detail_text: subDetail(on, off), minute });

assert.deepEqual(subPlayers(sub('Sam Lee', 'Joe Kerr', 60)), { on: 'Sam Lee', off: 'Joe Kerr' });
assert.equal(subPlayers({ event_type: 'goal', player_name: 'Sam Lee', detail_text: 'Substitution: A ON, B OFF.' }), null);
assert.equal(subPlayers({ event_type: 'sub', player_name: 'Sam Lee', detail_text: 'came on late' }), null, 'typed by hand');

// The player coming ON is not the one marked as taken off
const events = [sub('Sam Lee', 'Joe Kerr', 60)];
assert.equal(wasSubbedOff(events, 'Joe Kerr'), true);
assert.equal(wasSubbedOff(events, 'Sam Lee'), false);
assert.equal(wasSubbedOff(events, 'Joe'), false, 'whole names only');
assert.equal(cameOn(events, 'sam lee'), true);
assert.equal(cameOn(events, 'Joe Kerr'), false);

// Minutes: starter taken off at 60, sub plays the last 30, a sending-off ends a player's game
const mins = minutesOnPitch(['Joe Kerr', 'Ali Khan', 'Ben Stone'], [
  ...events,
  { event_type: 'red_card' as const, player_name: 'Ben Stone', detail_text: '', minute: 70 },
  { event_type: 'yellow_card' as const, player_name: 'Ali Khan', detail_text: '', minute: 20 },
], 90);
assert.deepEqual(mins, { 'joe kerr': 60, 'ali khan': 90, 'ben stone': 70, 'sam lee': 30 });
// A sub who is later sent off
assert.equal(minutesOnPitch([], [sub('Sam Lee', 'Joe Kerr', 60), { event_type: 'red_card' as const, player_name: 'Sam Lee', detail_text: '', minute: 80 }], 90)['sam lee'], 20);
console.log('match-subs checks passed');
