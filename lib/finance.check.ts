// Self-check for finance helpers.
// Run: npx esbuild lib/finance.check.ts --bundle --platform=node --log-level=warning | node
import assert from 'node:assert/strict';
import { bookingFeeCents, parseMoneyToCents, paymentReference, toCsv } from './finance';
import { matchesFileSignature } from './file-signature';

assert.equal(parseMoneyToCents('12.50'), 1250);
assert.equal(parseMoneyToCents('1,200'), 120000);
assert.equal(parseMoneyToCents('0.1'), 10);
assert.equal(parseMoneyToCents('19.99'), 1999);
assert.equal(parseMoneyToCents('-5'), null);
assert.equal(parseMoneyToCents('1.234'), null);
assert.equal(parseMoneyToCents('abc'), null);
assert.equal(parseMoneyToCents(''), null);

const none = { percent: 0, flatCents: 0, minCents: 0 };
assert.equal(bookingFeeCents(6000, none), 0);
assert.equal(bookingFeeCents(6000, { ...none, flatCents: 100 }), 100);
assert.equal(bookingFeeCents(6000, { ...none, percent: 2 }), 120);
assert.equal(bookingFeeCents(500, { ...none, percent: 2, minCents: 30 }), 30);
assert.equal(bookingFeeCents(6000, { percent: 1.5, flatCents: 20, minCents: 30 }), 110);
assert.equal(bookingFeeCents(0, { ...none, minCents: 30 }), 0);

assert.equal(paymentReference('3f2a9c1e-0000-4000-8000-000000000000'), '3F2A9C1E');

assert.equal(toCsv([['a', 1, null], ['b,c', 'say "hi"', 'x\ny']]), 'a,1,\r\n"b,c","say ""hi""","x\ny"');
assert.equal(toCsv([['=HYPERLINK("x")', '-5', '+1', '@a']]), `"'=HYPERLINK(""x"")",'-5,'+1,'@a`);

const bytes = (...b: number[]) => new Uint8Array([...b, ...new Array(16).fill(0)]);
const text = (s: string) => new Uint8Array([...s].map(c => c.charCodeAt(0)));
assert.ok(matchesFileSignature(bytes(0xff, 0xd8, 0xff), 'image/jpeg'));
assert.ok(!matchesFileSignature(bytes(0xff, 0xd8, 0xff), 'image/png'));
assert.ok(matchesFileSignature(text('%PDF-1.7\n'), 'application/pdf'));
assert.ok(!matchesFileSignature(text('MZ\x90\x00'), 'application/pdf'));
assert.ok(matchesFileSignature(text('RIFF\0\0\0\0WEBPVP8 '), 'image/webp'));
assert.ok(!matchesFileSignature(text('%PDF-1.7'), 'image/svg+xml'));

console.log('finance: money, booking fee, CSV and file signatures OK');
