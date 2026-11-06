// Run: npx esbuild lib/expense-claims.check.ts --bundle --platform=node | node   (part of `npm run check`)
import assert from 'node:assert/strict';
import { canClaim, parseClaim } from './expense-claims';

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
const s = parse({ description: '<img src=x>tape', payoutDetails: ' BSB 062-000 <b> ' });
assert.ok(s.ok && !/[<>]/.test(s.value.description + s.value.payoutDetails), 'angle brackets removed');
assert.equal(parseClaim(() => null, TODAY).ok, false, 'empty form');

assert.equal(canClaim({ membership_status: 'approved', status: 'active' }), true);
assert.equal(canClaim({ membership_status: null, status: 'active' }), true, 'a squad entry with no application');
assert.equal(canClaim({ membership_status: 'pending', status: 'active' }), false, 'applicant');
assert.equal(canClaim({ membership_status: 'rejected' }), false);
assert.equal(canClaim({ membership_status: 'approved', status: 'suspended' }), false);
assert.equal(canClaim({ membership_status: 'approved', status: 'alumni' }), false);
assert.equal(canClaim(null), false, 'not a member here');

console.log('expense-claims.check ok');
