import assert from 'node:assert/strict';
import { adminAreas, daysBetween, feeReminderStep, localDay, summaryFingerprint } from './club-automations';

// AUTO-3: 3 days before, 3 days after, a week after that; nothing in between or later
assert.equal(daysBetween('2026-12-05', '2026-12-02'), -3);
assert.equal(feeReminderStep('2026-12-05', '2026-12-01'), null, '4 days before');
assert.equal(feeReminderStep('2026-12-05', '2026-12-02'), 1, '3 days before');
assert.equal(feeReminderStep('2026-12-05', '2026-12-04'), 1, 'the day before');
assert.equal(feeReminderStep('2026-12-05', '2026-12-05'), null, 'due today: the bill itself said so');
assert.equal(feeReminderStep('2026-12-05', '2026-12-07'), null, '2 days late');
assert.equal(feeReminderStep('2026-12-05', '2026-12-08'), 2, '3 days late');
assert.equal(feeReminderStep('2026-12-05', '2026-12-15'), 3, '10 days late');
assert.equal(feeReminderStep('2026-12-05', '2026-12-22'), null, 'given up after three');
assert.equal(feeReminderStep('2026-12-31', '2027-01-03'), 2, 'across the new year');

// Weekday in the club's own zone: the 22:00 UTC run is Thursday morning in Sydney (9 am) and Perth (6 am)
const wedNightUtc = Date.parse('2026-11-25T22:00:00Z');
assert.deepEqual(localDay(wedNightUtc, 'Australia/Sydney'), { date: '2026-11-26', weekday: 4 });
assert.deepEqual(localDay(wedNightUtc, 'Australia/Perth'), { date: '2026-11-26', weekday: 4 });
assert.deepEqual(localDay(Date.parse('2026-11-25T09:00:00Z'), 'UTC'), { date: '2026-11-25', weekday: 3 });

// AUTO-1: what each admin sees
const roles: { name: string; permissions: Record<string, string> }[] = [
  { name: 'Treasurer', permissions: { finance: 'full', sponsors: 'view' } },
  { name: 'Coach', permissions: { 'match-center': 'edit', lineup: 'edit', finance: 'none' } },
];
assert.equal(adminAreas({ role: 'Player, Club Admin' }, roles), 'all');
assert.equal(adminAreas({ roles: ['Owner'] }, roles), 'all');
assert.deepEqual([...(adminAreas({ role: 'treasurer' }, roles) as Set<string>)].sort(), ['finance', 'sponsors']);
assert.deepEqual([...(adminAreas({ role: 'Coach', roles: ['Player'] }, roles) as Set<string>)].sort(), ['lineup', 'match-center']);
assert.equal((adminAreas({ role: 'Player' }, roles) as Set<string>).size, 0);

// The summary repeats only when what's waiting changes
const a = summaryFingerprint([{ key: 'messages', count: 3 }, { key: 'result-m1' }]);
assert.equal(a, summaryFingerprint([{ key: 'result-m1' }, { key: 'messages', count: 3 }]), 'order does not matter');
assert.notEqual(a, summaryFingerprint([{ key: 'messages', count: 4 }, { key: 'result-m1' }]), 'a new message changes it');

console.log('club-automations checks passed');
