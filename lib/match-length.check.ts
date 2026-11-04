// Self-check for match length (any half length, stoppage time, the live clock).
// Run: npx esbuild lib/match-length.check.ts --bundle --platform=node --log-level=warning | node
import assert from 'node:assert/strict';
import type { Match } from './supabase/types';
import { clockLabel, compareEventMinute, eventMinuteLabel, extraHalfMinutes, fullMinutes, halfMinutes, lengthLabel, maxMinute, periodEndMinute, periodStartMinute, splitMinute, validHalfMinutes } from './match-length';
import { getLiveMinute, getLiveMinuteLabel } from './match-clock';
import { fullMatchMinutes, lineupAdditions } from './match-stats';

// Matches saved before the setting keep the lengths the app always used
assert.equal(halfMinutes({}), 45);
assert.equal(halfMinutes(null), 45);
assert.equal(fullMinutes({ match_format: '11v11' }), 90);
assert.equal(fullMinutes({ match_format: '9v9' }), 60);
assert.equal(fullMinutes({ match_format: '7v7' }), 50);
assert.equal(fullMinutes({ match_format: '5v5' }), 40);
assert.equal(fullMatchMinutes(undefined), 90);
assert.equal(fullMatchMinutes('9v9'), 60);

// A 2 x 12 game
const short = { half_minutes: 12, match_format: '11v11' };
assert.equal(halfMinutes(short), 12);
assert.equal(fullMinutes(short), 24);
assert.equal(fullMatchMinutes(short), 24);
assert.equal(lengthLabel(short), '2 × 12 min');
assert.equal(periodStartMinute(short, 'first_half'), 1);
assert.equal(periodStartMinute(short, 'second_half'), 13);
assert.equal(periodStartMinute(short, 'extra_time'), 25);
assert.equal(periodEndMinute(short, 'first_half'), 12);
assert.equal(periodEndMinute(short, 'second_half'), 24);
assert.equal(extraHalfMinutes(short), 4);
assert.equal(extraHalfMinutes({}), 15);
assert.equal(periodEndMinute(short, 'halftime'), null);

// Stoppage time reads 12+2, the way referees say it
assert.deepEqual(splitMinute(short, 'first_half', 14), { minute: 12, added: 2 });
assert.deepEqual(splitMinute(short, 'first_half', 12), { minute: 12, added: 0 });
assert.deepEqual(splitMinute(short, 'second_half', 14), { minute: 14, added: 0 });
assert.deepEqual(splitMinute(short, 'second_half', 27), { minute: 24, added: 3 });
assert.deepEqual(splitMinute({}, 'first_half', 47), { minute: 45, added: 2 });
assert.deepEqual(splitMinute(short, 'halftime', 30), { minute: 30, added: 0 });
assert.equal(clockLabel(short, 'first_half', 14), '12+2');
assert.equal(clockLabel(short, 'first_half', 9), '9');
assert.equal(eventMinuteLabel({ minute: 12, added_minute: 2 }), '12+2');
assert.equal(eventMinuteLabel({ minute: 30 }), '30');
assert.deepEqual(
  [{ minute: 13 }, { minute: 12, added_minute: 2 }, { minute: 12 }].sort(compareEventMinute),
  [{ minute: 12 }, { minute: 12, added_minute: 2 }, { minute: 13 }]);

// Bad stored values fall back to the format
assert.equal(validHalfMinutes(0), null);
assert.equal(validHalfMinutes(61), null);
assert.equal(validHalfMinutes('12'), 12);
assert.equal(halfMinutes({ half_minutes: 0, match_format: '7v7' }), 25);

// The live clock: second half of a 2 x 12 game, 13' at kick-off, stoppage after 24'
const kickoff = Date.parse('2026-11-04T10:00:00Z');
const live = { status: 'live', period: 'second_half', current_minute: 13, period_started_at: new Date(kickoff).toISOString(), half_minutes: 12, match_format: '11v11' } as unknown as Match;
assert.equal(getLiveMinute(live, kickoff + 5 * 60000), 18);
assert.equal(getLiveMinuteLabel(live, kickoff + 5 * 60000), '18');
assert.equal(getLiveMinuteLabel(live, kickoff + 13 * 60000), '24+2');
// Capped well past the end of extra time, never earlier than a minute set by hand
assert.equal(maxMinute(short), 24 + 8 + 30);
assert.equal(getLiveMinute(live, kickoff + 600 * 60000), maxMinute(short));
assert.equal(getLiveMinute({ ...live, period: 'first_half', current_minute: 1, half_minutes: null } as unknown as Match, kickoff + 600 * 60000), 150);

// Minutes played from the line-up follow the match's length
assert.deepEqual(lineupAdditions([], ['a'], short).map(l => l.minutes), [24]);
assert.deepEqual(lineupAdditions([], ['a'], '7v7').map(l => l.minutes), [50]);

console.log('match-length checks passed');
