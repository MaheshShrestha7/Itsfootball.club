// Self-check for when a fixture change alerts the team.
// Run: npx esbuild lib/fixture-alerts.check.ts --bundle --platform=node --log-level=warning | node
import assert from 'node:assert/strict';
import { fixtureChangeOf } from './fixture-alerts';

const NOW = Date.parse('2027-03-10T00:00:00Z');
const base = { status: 'upcoming' as const, match_date: '2027-03-14T04:00:00Z', match_time: '15:00', venue: 'Riverside Oval' };

assert.equal(fixtureChangeOf(base, { ...base, status: 'cancelled' }, NOW), 'cancelled');
assert.equal(fixtureChangeOf(base, { ...base, status: 'postponed' }, NOW), 'postponed');
assert.equal(fixtureChangeOf(base, { ...base, match_date: '2027-03-15T04:00:00Z' }, NOW), 'moved');
assert.equal(fixtureChangeOf(base, { ...base, match_time: '16:00' }, NOW), 'moved');
assert.equal(fixtureChangeOf(base, { ...base, venue: 'Hills Reserve' }, NOW), 'moved');
assert.equal(fixtureChangeOf(base, { ...base, venue: ' riverside oval ' }, NOW), null, 'same ground, other spelling');
assert.equal(fixtureChangeOf(base, { ...base }, NOW), null);
// A postponed game given its new date
assert.equal(fixtureChangeOf({ ...base, status: 'postponed' }, { ...base, status: 'upcoming', match_date: '2027-04-01T04:00:00Z' }, NOW), 'moved');
// Results and old games stay quiet
assert.equal(fixtureChangeOf(base, { ...base, status: 'completed' }, NOW), null);
assert.equal(fixtureChangeOf({ ...base, match_date: '2027-01-01T04:00:00Z' }, { ...base, match_date: '2027-01-02T04:00:00Z' }, NOW), null);
assert.equal(fixtureChangeOf({ ...base, status: 'completed' }, { ...base, status: 'cancelled' }, NOW), null);

console.log('fixture-alerts: change detection OK');
