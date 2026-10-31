// Run: npm run check. One time and day style everywhere (UX30-10).
import assert from 'node:assert/strict';
import { dayOptions, formatClock, formatShortDay } from './dates';

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
