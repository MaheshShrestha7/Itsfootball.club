import assert from 'node:assert/strict';
import { bucketTotals, firstName, greeting, initials, shortAge, softTint, timeAgo, weekHeading, weekStrip } from './mission-control';
import type { PlatformDailyTrend } from './supabase/types';

const day = (date: string, members: number, revenue_cents = 0): PlatformDailyTrend => ({ date, clubs: 0, users: 0, members, visits: 0, revenue_cents });

assert.equal(greeting(8), 'Good morning');
assert.equal(greeting(13), 'Good afternoon');
assert.equal(greeting(20), 'Good evening');

assert.equal(firstName('Mahesh Shrestha', 'm@x.com'), 'Mahesh');
assert.equal(firstName('  ', 'jess.r@example.com'), 'jess.r');
assert.equal(firstName(null, null), '');

assert.equal(initials('Aisha Patel'), 'AP');
assert.equal(initials('jess'), 'J');
assert.equal(initials('tom.king@example.com'), 'TK');
assert.equal(initials(''), '?');

// 28 days into 4 weekly buckets, newest last
const month = Array.from({ length: 28 }, (_, i) => day(`2026-10-${String(i + 1).padStart(2, '0')}`, 1, 100));
assert.deepEqual(bucketTotals(month, 4, t => t.revenue_cents), [700, 700, 700, 700]);
// Order of the input does not matter
assert.deepEqual(bucketTotals([...month].reverse(), 4, t => t.members), [7, 7, 7, 7]);
// 30 days: the two oldest days fall before the first full bucket and are left out of the bars
assert.deepEqual(bucketTotals(Array.from({ length: 30 }, (_, i) => day(`2026-09-${String(i + 1).padStart(2, '0')}`, 1)), 4, t => t.members), [7, 7, 7, 7]);
assert.deepEqual(bucketTotals([], 4, t => t.members), [0, 0, 0, 0]);
// Fewer days than buckets: one day per bucket at the end
assert.deepEqual(bucketTotals([day('2026-10-01', 2), day('2026-10-02', 5)], 4, t => t.members), [0, 0, 2, 5]);

// Week strip: Monday 26 Oct 2026, local dates
const today = new Date(2026, 9, 26, 15, 0);
const week = weekStrip([day('2026-10-26', 3), day('2026-10-28', 1), day('2026-10-25', 9)], today);
assert.deepEqual(week.map(d => d.day), [26, 27, 28, 29, 30, 31, 1]);
assert.equal(week[0].isToday, true);
assert.equal(week[0].members, 3);
assert.equal(week[2].members, 1);
assert.equal(week[2].future, true);
assert.equal(weekHeading(week), 'Oct – Nov 2026');
const lastWeek = weekStrip([day('2026-10-25', 9)], today, -1);
assert.equal(lastWeek[0].day, 19);
assert.equal(lastWeek[6].members, 9);
assert.equal(weekHeading(lastWeek), 'October 2026');
// A Sunday still belongs to the week that started the Monday before
assert.equal(weekStrip([], new Date(2026, 10, 1))[0].day, 26);

const NOW = Date.parse('2026-10-26T12:00:00Z');
assert.equal(timeAgo('2026-10-26T11:59:30Z', NOW), 'just now');
assert.equal(timeAgo('2026-10-26T11:40:00Z', NOW), '20 min ago');
assert.equal(timeAgo('2026-10-26T09:00:00Z', NOW), '3 hours ago');
assert.equal(timeAgo('2026-10-24T12:00:00Z', NOW), '2 days ago');
assert.equal(timeAgo('2026-10-05T12:00:00Z', NOW), '3 weeks ago');
assert.equal(timeAgo(null, NOW), '');

assert.equal(shortAge('2026-10-26T08:00:00Z', NOW), 'Today');
assert.equal(shortAge('2026-10-23T12:00:00Z', NOW), '3 days');
assert.equal(shortAge('2026-10-05T12:00:00Z', NOW), '3 weeks');

assert.equal(softTint('#10B981', 0.5), 'rgba(16, 185, 129, 0.5)');
assert.equal(softTint('nope', 0.5), 'rgba(16, 185, 129, 0.5)');

console.log('mission-control: ok');
