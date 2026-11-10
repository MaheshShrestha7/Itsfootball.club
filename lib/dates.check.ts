// Run: npm run check. One time and day style everywhere (UX30-10).
import assert from 'node:assert/strict';
import { clubTimeZone, dayOptions, formatClock, formatShortDay } from './dates';
import { matchIsoDates } from './schema';
import { formatWhen } from './email/format';

assert.equal(formatClock('15:00'), '3:00 pm');
assert.equal(formatClock('09:30:00'), '9:30 am');
assert.equal(formatClock('00:15'), '12:15 am');
assert.equal(formatClock('12:00'), '12:00 pm');
assert.equal(formatClock('TBC'), 'TBC');
assert.equal(formatClock('25:00'), '25:00');
assert.equal(formatClock(null), '');

const thisYear = new Date().getFullYear();
assert.equal(dayOptions(`${thisYear}-03-04T12:00:00`).year, undefined);
assert.equal(dayOptions(`${thisYear - 1}-03-04T12:00:00`).year, 'numeric');
assert.ok(!formatShortDay(`${thisYear}-03-04`).includes(String(thisYear)));
assert.ok(formatShortDay(`${thisYear - 1}-03-04`).endsWith(String(thisYear - 1)));
assert.ok(formatShortDay(`${thisYear}-03-04T12:00:00`, true).includes(' · 12:00 pm'));
assert.equal(formatShortDay(''), '');

console.log('dates.check passed');

// F10-1: a club's own time zone, Sydney when unset or not one we offer
assert.equal(clubTimeZone(null), 'Australia/Sydney');
assert.equal(clubTimeZone({ config: {} }), 'Australia/Sydney');
assert.equal(clubTimeZone({ config: { time_zone: 'Australia/Perth' } }), 'Australia/Perth');
assert.equal(clubTimeZone({ config: { time_zone: 'Mars/Olympus' } }), 'Australia/Sydney');
// Kick-off with the club's offset, half hours included
assert.equal(matchIsoDates('2026-11-14', '15:00').startDate, '2026-11-14T15:00:00+11:00');
assert.equal(matchIsoDates('2026-11-14', '15:00', 'Australia/Perth').startDate, '2026-11-14T15:00:00+08:00');
assert.equal(matchIsoDates('2026-11-14', '15:00', 'Australia/Adelaide').startDate, '2026-11-14T15:00:00+10:30');
assert.equal(matchIsoDates('2026-06-13', '15:00', 'Australia/Brisbane').startDate, '2026-06-13T15:00:00+10:00');
// 3 pm Perth (07:00 UTC) reads 3:00 pm in a Perth club's email, 6:00 pm in Sydney's
assert.match(formatWhen('2026-11-14T07:00:00Z', 'Australia/Perth'), /3:00\spm/);
assert.match(formatWhen('2026-11-14T07:00:00Z'), /6:00\spm/);
