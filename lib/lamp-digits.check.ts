import assert from 'node:assert/strict';
import { lampRows } from './lamp-digits';

// Digits are bold: one lamp wider than the 5 x 7 glyph, every stroke two lamps thick
assert.deepEqual(lampRows('1'), ['001100', '011100', '001100', '001100', '001100', '001100', '011110']);
for (const d of '0123456789') assert.ok(lampRows(d).every(r => r.length === 6), d);
// The 0 has no slash, so it never reads as an 8
assert.equal(lampRows('0')[3], '110011');
// The dash between the scores and the colon in a kick-off time keep their shape
assert.deepEqual(lampRows('-').map(r => r.includes('1')), [false, false, false, true, false, false, false]);
assert.equal(lampRows(':').join(''), '0010100');
assert.deepEqual(lampRows('x'), []);
console.log('lamp-digits ok');
