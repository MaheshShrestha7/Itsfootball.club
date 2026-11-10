import assert from 'node:assert/strict';
import { readMissionUrl, missionUrl, buildQueue, queueItems, staleDoneKeys, isDoneSnooze, DONE_UNTIL, bucketTotals, emailTemplate, firstName, greeting, healthSignals, initials, setupSteps, shortAge, softTint, timeAgo, weekHeading, weekStrip, type HealthInput } from './mission-control';
import { pctChange, changeLabel, pageLabel, ranked, sparkBars, setupFunnel, quietClubs, FEATURES } from './mission-control';
import type { PlatformClubItem, PlatformDailyTrend } from './supabase/types';

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

// Setup steps and the Today queue
const club = (o: Partial<PlatformClubItem>): PlatformClubItem => ({
  id: 'c1', name: 'Westvale FC', short_name: 'WV', slug: 'westvale', is_active: true, created_at: '2026-10-01T00:00:00Z',
  membership_payment_policy: 'allow_waiver', member_count: 0, pending_count: 0, team_count: 0, match_count: 0,
  visits_30d: 0, gmv_cents: 0, stripe_ready: false, approved_count: 0, oldest_pending_at: null, admin_last_seen_at: null, ...o,
});
assert.equal(setupSteps(club({})).length, 5);
assert.equal(setupSteps(club({ membership_payment_policy: 'require_payment' })).length, 6);
assert.equal(setupSteps(club({ logo_url: 'x', team_count: 1, match_count: 2, approved_count: 10, admin_last_seen_at: '2026-10-20T00:00:00Z' }), NOW).every(s => s.done), true);
assert.equal(setupSteps(club({ admin_last_seen_at: '2026-10-01T00:00:00Z' }), NOW).find(s => s.key === 'active')!.done, false);

const kinds = (cs: PlatformClubItem[], snoozed: string[] = []) => buildQueue(cs, new Set(snoozed), NOW).map(i => i.kind);
// 25 days old with nothing done: stalled
assert.deepEqual(kinds([club({})]), ['stalled']);
// Brand new: welcome, never stalled
assert.deepEqual(kinds([club({ created_at: '2026-10-24T00:00:00Z' })]), ['welcome']);
// Backlog by count or by age; ordered before the rest
assert.deepEqual(kinds([club({ pending_count: 5, logo_url: 'x', team_count: 1, match_count: 1 })]), ['backlog']);
assert.deepEqual(kinds([club({ pending_count: 1, oldest_pending_at: '2026-10-10T00:00:00Z' })]), ['backlog', 'stalled']);
assert.deepEqual(kinds([club({ pending_count: 1, oldest_pending_at: '2026-10-25T00:00:00Z', logo_url: 'x', team_count: 1, match_count: 1 })]), []);
// Charges to join without Stripe
assert.deepEqual(kinds([club({ membership_payment_policy: 'require_payment', logo_url: 'x', team_count: 1, match_count: 1 })]), ['payments']);
// Suspended clubs and snoozed items stay out
assert.deepEqual(kinds([club({ is_active: false })]), []);
assert.deepEqual(kinds([club({})], ['stalled:c1']), []);

// Done hides only the current backlog: a new one (a later oldest application) shows again
const backlogClub = club({ pending_count: 6, oldest_pending_at: '2026-10-20T09:00:00Z', logo_url: 'x', team_count: 1, match_count: 1 });
const backlogKey = queueItems([backlogClub], NOW)[0].key;
assert.equal(backlogKey, 'backlog:c1:2026-10-20');
assert.deepEqual(kinds([backlogClub], [backlogKey]), []);
assert.deepEqual(kinds([club({ ...backlogClub, oldest_pending_at: '2026-11-20T09:00:00Z' })], [backlogKey]), ['backlog']);
// An old-style key (before 20261163) no longer hides anything
assert.deepEqual(kinds([backlogClub], ['backlog:c1']), ['backlog']);

// Bank transfers and unread enquiries from get_platform_today, ahead of the rest
const ready = club({ logo_url: 'x', team_count: 1, match_count: 1 });
const extra = { transfers: [{ club_id: 'c1', count: 4, oldest: '2026-10-15T00:00:00Z' }], enquiries: [{ club_id: 'c1', count: 1, oldest: '2026-10-20T00:00:00Z' }] };
const items = buildQueue([ready], new Set(), NOW, extra);
assert.deepEqual(items.map(i => i.kind), ['transfers', 'enquiries']);
assert.ok(items[0].title.includes('4 bank transfers'));
assert.ok(items[1].title.includes('1 enquiry'));
assert.equal(items[0].action.template, 'transfers');
// Transfers for a club that isn't in the list are ignored
assert.deepEqual(buildQueue([ready], new Set(), NOW, { transfers: [{ club_id: 'zz', count: 2, oldest: '2026-10-01T00:00:00Z' }] }).length, 0);

// Done keys whose problem has gone are cleared; snoozes that aren't Today's are left alone
assert.deepEqual(staleDoneKeys(['backlog:c1:2026-10-20', 'stalled:c2', 'crashes:2026-10-25', 'other:thing'], new Set(['stalled:c2'])), ['backlog:c1:2026-10-20', 'crashes:2026-10-25']);
assert.equal(isDoneSnooze(DONE_UNTIL), true);
assert.equal(isDoneSnooze('2026-11-17T00:00:00Z'), false);

const t = emailTemplate('needHand', { name: 'Westvale FC', slug: 'westvale' }, 'Sam');
assert.ok(t.subject.includes('Westvale FC'));
assert.ok(t.message.startsWith('Hi Sam,'));
assert.ok(t.message.includes('https://itsfootball.club/westvale/admin'));
assert.ok(emailTemplate('blank', { name: 'X', slug: 'x' }).message.startsWith('Hi,'));
assert.ok(emailTemplate('transfers', { name: 'Westvale FC', slug: 'westvale' }).message.includes('/westvale/admin/finance'));
assert.ok(emailTemplate('enquiries', { name: 'Westvale FC', slug: 'westvale' }).message.includes('/westvale/admin/inquiries'));

// Health lights
const base: HealthInput = {
  emailsSent24: 600, emailsFailed24: 0,
  jobs: [{ name: 'indexnow', lastAt: '2026-10-26T11:20:00Z', lastOk: true, lastOkAt: '2026-10-26T11:20:00Z' }],
  stripe: { events24: 5, failed24: 0, lastAt: null, connected: 3, needDetails: 0 },
  domains: { total: 2, pending: [] },
  dbMs: 120,
};
const light = (o: Partial<HealthInput>, key: string) => healthSignals({ ...base, ...o }, NOW).find(s => s.key === key)!.light;
assert.ok(healthSignals(base, NOW).every(s => s.light === 'green'));
assert.equal(light({ emailsFailed24: 3 }, 'email'), 'amber');
assert.equal(light({ emailsFailed24: 40 }, 'email'), 'red');
assert.equal(light({ emailsSent24: 20, emailsFailed24: 2 }, 'email'), 'red'); // 9%
// Hourly job: late after 1h45m, failed run is red, never run is grey
assert.equal(light({ jobs: [{ name: 'indexnow', lastAt: '2026-10-26T10:00:00Z', lastOk: true, lastOkAt: null }] }, 'job:indexnow'), 'red');
assert.equal(light({ jobs: [{ name: 'indexnow', lastAt: '2026-10-26T10:30:00Z', lastOk: true, lastOkAt: null }] }, 'job:indexnow'), 'green');
assert.equal(light({ jobs: [{ name: 'indexnow', lastAt: '2026-10-26T11:50:00Z', lastOk: false, lastOkAt: null }] }, 'job:indexnow'), 'red');
assert.equal(light({ jobs: [{ name: 'reminders', lastAt: null, lastOk: null, lastOkAt: null }] }, 'job:reminders'), 'grey');
// Daily job is fine 30 hours later
assert.equal(light({ jobs: [{ name: 'reminders', lastAt: '2026-10-25T06:00:00Z', lastOk: true, lastOkAt: null }] }, 'job:reminders'), 'green');
assert.equal(light({ stripe: { ...base.stripe, failed24: 1 } }, 'stripe'), 'red');
assert.equal(light({ stripe: { ...base.stripe, needDetails: 1 } }, 'stripe'), 'amber');
assert.equal(light({ domains: { total: 2, pending: ['a.com'] } }, 'domains'), 'amber');
assert.equal(light({ domains: null }, 'domains'), 'grey');
assert.equal(light({ dbMs: 900 }, 'db'), 'red');

console.log('mission-control: ok');

// ---- Overview helpers ----
{
  assert.equal(pctChange(112, 100), 12);
  assert.equal(pctChange(5, 0), null);
  assert.equal(changeLabel(90, 100), '-10%');
  assert.equal(changeLabel(100, 100), '0%');
  assert.equal(changeLabel(3, 0), '');
  assert.equal(pageLabel('/'), 'Homepage');
  assert.equal(pageLabel('/tools/lineup-builder'), 'Lineup builder');
  assert.equal(pageLabel('/guides/agm-guide/'), 'Agm guide');
  assert.deepEqual(ranked({ a: 1, b: 5, c: 0 }), [['b', 5], ['a', 1]]);
  assert.deepEqual(ranked(null), []);
  assert.deepEqual(sparkBars([], 3), [0, 0, 0]);
  assert.deepEqual(sparkBars([1, 1, 2, 2], 2), [50, 100]);
  // 5 days into 2 bars: the newest bar holds the newest 3 days
  assert.deepEqual(sparkBars([4, 1, 1, 1, 1], 2), [100, 60]);
  assert.equal(new Set(FEATURES.map(f => f.key)).size, FEATURES.length);

  const now = Date.parse('2026-11-04T00:00:00Z');
  const club = (over: Partial<PlatformClubItem>): PlatformClubItem => ({
    id: 'x', name: 'X', short_name: 'X', slug: 'x', is_active: true, created_at: '2026-10-01T00:00:00Z',
    membership_payment_policy: 'standard', member_count: 0, pending_count: 0, team_count: 0, match_count: 0,
    visits_30d: 0, gmv_cents: 0, stripe_ready: false, ...over,
  } as PlatformClubItem);
  const list = [
    club({ id: 'a', logo_url: 'l', team_count: 1, match_count: 3, approved_count: 12, admin_last_seen_at: '2026-11-01T00:00:00Z' }),
    club({ id: 'b', team_count: 1 }),
    club({ id: 'c', is_active: false }),
    club({ id: 'd', closed_at: '2026-11-01T00:00:00Z' }),
  ];
  const f = setupFunnel(list, now);
  assert.deepEqual(f.map(s => s.clubs.length), [2, 1, 2, 1, 1, 1]);
  assert.deepEqual(quietClubs(list, now).map(c => c.id), ['b']);
}

// Where Mission Control is lives in the web address
assert.deepEqual(readMissionUrl(''), { tab: 'today', club: null, request: null });
assert.deepEqual(readMissionUrl('?tab=support&request=abc-1'), { tab: 'support', club: null, request: 'abc-1' });
assert.deepEqual(readMissionUrl('?tab=clubs&club=c1&request=x'), { tab: 'clubs', club: 'c1', request: null });
assert.equal(readMissionUrl('?tab=cockpit').tab, 'overview');
assert.equal(readMissionUrl('?tab=nope').tab, 'today');
assert.equal(readMissionUrl('?club=<script>').club, null);
assert.equal(missionUrl('', { tab: 'clubs' }), '?tab=clubs');
assert.equal(missionUrl('?tab=clubs', { club: 'c1' }), '?tab=clubs&club=c1');
assert.equal(missionUrl('?tab=clubs&club=c1', { club: null }), '?tab=clubs');
assert.equal(missionUrl('?tab=support&request=r1', { tab: 'today' }), '');
assert.equal(missionUrl('?tab=support&request=r1', { tab: 'log' }), '?tab=log');
