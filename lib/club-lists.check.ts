// Self-check for the public list helpers (fixtures, events, tournaments: upcoming vs past).
// Run: npx esbuild lib/club-lists.check.ts --bundle --platform=node --log-level=warning | node
import assert from 'node:assert/strict';
import { groupByMonth, isAwaitingResult, isPastEvent, isPastFixture, isPastTournament, seasonOfMatch, seasonOptions } from './club-lists';

const now = Date.parse('2026-11-03T12:00:00Z');
const HOUR = 3600000;
const at = (ms: number) => new Date(ms).toISOString();

// Fixtures: past once played, called off, or scheduled over a day ago
assert.equal(isPastFixture({ status: 'completed', match_date: at(now + 5 * HOUR) }, now), true);
assert.equal(isPastFixture({ status: 'cancelled', match_date: at(now + 48 * HOUR) }, now), true);
assert.equal(isPastFixture({ status: 'upcoming', match_date: at(now + HOUR) }, now), false);
assert.equal(isPastFixture({ status: 'upcoming', match_date: at(now - 3 * HOUR) }, now), false, 'kicked off this afternoon: still upcoming');
assert.equal(isPastFixture({ status: 'upcoming', match_date: at(now - 30 * HOUR) }, now), true, 'scheduled in the past: goes to Past');
assert.equal(isAwaitingResult({ status: 'upcoming', match_date: '2026-10-01' }, now), true, 'date-only fixtures too');
assert.equal(isAwaitingResult({ status: 'upcoming', match_date: '' }, now), false, 'no date: not past');
assert.equal(isPastFixture({ status: 'live', match_date: at(now - 30 * HOUR) }, now), false);
assert.equal(isPastFixture({ status: 'postponed', match_date: at(now - 30 * HOUR) }, now), false, 'postponed waits for a new date');

// Events: by end time, else start
assert.equal(isPastEvent({ start_time: at(now - 50 * HOUR), end_time: at(now - 30 * HOUR) }, now), true);
assert.equal(isPastEvent({ start_time: at(now - 50 * HOUR), end_time: at(now + HOUR) }, now), false, 'multi-day event still on');
assert.equal(isPastEvent({ start_time: at(now - 2 * HOUR) }, now), false);
assert.equal(isPastEvent({ start_time: at(now - 30 * HOUR) }, now), true);

// Tournaments
assert.equal(isPastTournament({ status: 'completed', start_date: '2027-01-01' }, now), true);
assert.equal(isPastTournament({ status: 'ongoing', start_date: '2026-01-01' }, now), false);
assert.equal(isPastTournament({ status: 'draft', start_date: '2026-10-01', end_date: '2026-10-02' }, now), true);
assert.equal(isPastTournament({ status: 'draft', start_date: '2026-12-01' }, now), false);
assert.equal(isPastTournament({ status: 'draft', start_date: '' }, now), false);

// Seasons: own label wins, else the club season the date falls in
const seasons = [
  { name: '2025', start_date: '2025-02-01', end_date: '2025-10-31' },
  { name: '2026', start_date: '2026-02-01', end_date: '2026-10-31' },
];
assert.equal(seasonOfMatch({ season: '2024', match_date: '2026-05-01' }, seasons), '2024');
assert.equal(seasonOfMatch({ season: '', match_date: '2025-05-01T05:00:00Z' }, seasons), '2025');
assert.equal(seasonOfMatch({ season: '', match_date: '2024-05-01' }, seasons), '');
assert.deepEqual(seasonOptions(['2025', '', '2026', '2025', '2023/24'], seasons), ['2026', '2025', '2023/24', '']);
assert.deepEqual(seasonOptions(['2024/25', '2025/26'], []), ['2025/26', '2024/25']);

// Month groups keep order and read in the site's zone (Sydney: 31 Oct 14:00 UTC is 1 Nov there)
const groups = groupByMonth(['2026-11-08T05:00:00Z', '2026-11-01T05:00:00Z', '2026-10-31T14:00:00Z', '2026-10-20', 'nope'], d => d);
assert.deepEqual(groups.map(g => [g.label, g.items.length]), [['November 2026', 3], ['October 2026', 1], ['Date to be confirmed', 1]]);

console.log('club-lists checks passed');
