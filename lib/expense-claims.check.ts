// Run: npx esbuild lib/expense-claims.check.ts --bundle --platform=node | node   (part of `npm run check`)
import assert from 'node:assert/strict';
import { canClaim, isOpenClaim, parseClaim } from './expense-claims';

const TODAY = '2026-11-06';
const valid: Record<string, string> = { description: 'Oranges', amount: '42.50', category: 'catering', spentOn: '2026-11-05' };
const parse = (over: object) => parseClaim(k => ({ ...valid, ...over } as Record<string, unknown>)[k], TODAY);
const err = (over: object) => { const r = parse(over); return r.ok ? null : r.error; };

const ok = parse({});
assert.ok(ok.ok);
assert.equal(ok.ok && ok.value.amountCents, 4250);
assert.equal(ok.ok && ok.value.vendor, null);
assert.equal(ok.ok && ok.value.payoutDetails, null);
assert.ok(err({ description: '   ' }), 'blank description');
assert.ok(err({ amount: '0' }), 'nothing to claim');
assert.ok(err({ amount: '-5' }), 'negative');
assert.ok(err({ amount: 'abc' }), 'not a number');
assert.ok(err({ amount: '10000.01' }), 'over the cap');
assert.ok(err({ category: 'nope' }), 'unknown category');
assert.ok(err({ spentOn: '2026-11-07' }), 'receipt from the future');
assert.equal(err({ spentOn: TODAY }), null, 'bought today');
assert.ok(err({ spentOn: 'yesterday' }), 'date junk');
const bank = { accountName: 'M Shrestha', bankName: 'Westpac', bsb: '062000', accountNumber: '12345678' };
const paid = parse(bank);
assert.equal(paid.ok && paid.value.payoutDetails, 'M Shrestha\nWestpac\nBSB: 062-000\nAccount number: 12345678');
const pasted = parse({ ...bank, bsb: ' 062-000 ', accountNumber: '1234 5678' });
assert.equal(pasted.ok && pasted.value.payoutDetails, paid.ok && paid.value.payoutDetails, 'pasted with dashes and spaces');
assert.ok(err({ ...bank, bankName: '' }), 'bank details half filled in');
assert.ok(err({ bsb: '062000' }), 'only a BSB');
assert.ok(err({ ...bank, bsb: '06200' }), 'short BSB');
assert.ok(err({ ...bank, bsb: '06200a' }), 'BSB with a letter');
assert.ok(err({ ...bank, accountNumber: '1234' }), 'short account number');
assert.ok(err({ ...bank, accountNumber: '12345678901' }), 'long account number');
const s = parse({ ...bank, description: '<img src=x>tape', accountName: ' <b>M\nFake line ' });
assert.ok(s.ok && !/[<>]/.test(s.value.description + s.value.payoutDetails), 'angle brackets removed');
assert.ok(s.ok && s.value.payoutDetails?.startsWith('bM Fake line\nWestpac'), 'a name stays on one line');
assert.equal(parseClaim(() => null, TODAY).ok, false, 'empty form');
assert.equal(isOpenClaim({ status: 'submitted' }), true);
assert.equal(isOpenClaim({ status: 'approved' }), true);
assert.equal(isOpenClaim({ status: 'paid' }), false);
assert.equal(isOpenClaim({ status: 'rejected' }), false);

assert.equal(canClaim({ membership_status: 'approved', status: 'active' }), true);
assert.equal(canClaim({ membership_status: null, status: 'active' }), true, 'a squad entry with no application');
assert.equal(canClaim({ membership_status: 'pending', status: 'active' }), false, 'applicant');
assert.equal(canClaim({ membership_status: 'rejected' }), false);
assert.equal(canClaim({ membership_status: 'approved', status: 'suspended' }), false);
assert.equal(canClaim({ membership_status: 'approved', status: 'alumni' }), false);
assert.equal(canClaim(null), false, 'not a member here');

console.log('expense-claims.check ok');
