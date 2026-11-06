// Run: npx esbuild lib/fee-requests.check.ts --bundle --platform=node | node   (part of `npm run check`)
import assert from 'node:assert/strict';
import { billRecipient, canReopenFee, feeRequestGroups, FEE_CATEGORIES, isLedgerRow, matchesSearch, parseFeeRequest } from './fee-requests';
import type { Payment } from './supabase/types';

const TODAY = '2026-11-06';
const A = '00000000-0000-4000-8000-000000000001';
const B = '00000000-0000-4000-8000-000000000002';
const valid = { title: 'Match fee', amountCents: 1500, dueOn: '2026-11-13', category: 'match_fees', memberIds: [A, B] };
const err = (over: object) => { const r = parseFeeRequest({ ...valid, ...over }, TODAY); return r.ok ? null : r.error; };

// --- input ---
const ok = parseFeeRequest(valid, TODAY);
assert.ok(ok.ok);
assert.deepEqual(ok.ok && ok.value.memberIds, [A, B]);
assert.equal(ok.ok && ok.value.message, null, 'no message is null, not an empty string');
assert.ok(err({ title: '  ' }), 'blank title');
assert.ok(err({ title: 'x'.repeat(121) }), 'long title');
assert.ok(err({ amountCents: 99 }), 'too small for Stripe');
assert.ok(err({ amountCents: 15.5 }), 'cents must be whole');
assert.ok(err({ amountCents: '1500; drop' }), 'amount junk');
assert.ok(err({ amountCents: 1000001 }), 'over the cap');
assert.ok(err({ dueOn: '2026-11-05' }), 'due date in the past');
assert.equal(err({ dueOn: TODAY }), null, 'due today is fine');
assert.ok(err({ dueOn: 'soon' }), 'due date junk');
assert.ok(err({ category: 'membership' }), 'membership has its own payment, which moves expiry dates');
assert.ok(err({ category: 'sponsorship' }), 'sponsorship has its own payment');
assert.ok(err({ category: 'nope' }), 'unknown category');
assert.ok(FEE_CATEGORIES.match_fees && !FEE_CATEGORIES.membership);
assert.ok(err({ memberIds: [] }), 'nobody');
assert.ok(err({ memberIds: ['not-a-uuid'] }), 'junk ids dropped, leaving nobody');
assert.ok(err({ memberIds: Array.from({ length: 501 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`) }), 'too many');
const dup = parseFeeRequest({ ...valid, memberIds: [A, A, B] }, TODAY);
assert.deepEqual(dup.ok && dup.value.memberIds, [A, B], 'one bill per person, even if ticked twice');
const stripped = parseFeeRequest({ ...valid, title: '<b>Fee</b>', message: '<script>' }, TODAY);
assert.ok(stripped.ok && !/[<>]/.test(stripped.value.title + stripped.value.message), 'angle brackets removed');
assert.equal(parseFeeRequest(null, TODAY).ok, false, 'no body');

// --- totals ---
const row = (over: Partial<Payment>): Payment => ({
  id: 'x', club_id: 'c', kind: 'fee_request', category: 'match_fees', amount_cents: 1500, currency: 'AUD', method: 'bank_transfer', status: 'pending',
  request_id: 'r1', request_title: 'Match fee', due_on: '2026-11-13', created_at: '2026-11-01T00:00:00Z', ...over,
});
const groups = feeRequestGroups([
  row({ id: '1', status: 'paid', method: 'stripe' }),
  row({ id: '2', status: 'paid', method: 'cash' }),
  row({ id: '3' }),
  row({ id: '4', status: 'awaiting_review' }),
  row({ id: '5', status: 'rejected' }),
  row({ id: 'old1', request_id: 'r2', request_title: 'Old tour', status: 'paid', created_at: '2026-12-01T00:00:00Z' }),
  row({ id: 'late', request_id: 'r3', request_title: 'Late kit', due_on: '2026-11-05', created_at: '2026-10-01T00:00:00Z' }),
  row({ id: 'other', kind: 'income_other', request_id: null }),
  row({ id: 'nogroup', request_id: null }),
], TODAY);
assert.deepEqual(groups.map(g => g.id), ['r1', 'r3', 'r2'], 'open first, newest first; finished last; other kinds left out');
const g = groups[0];
assert.deepEqual([g.paidCount, g.unpaidCount, g.toCheckCount, g.excusedCount], [2, 1, 1, 1]);
assert.equal(g.paidCents, 3000, 'only paid money counts as in');
assert.equal(g.unpaidCents, 1500, 'a receipt being checked and an excused person are not "to come"');
assert.equal(g.overdue, false);
assert.equal(groups[1].overdue, true, 'past due with someone still owing');
assert.equal(feeRequestGroups([row({ status: 'paid', due_on: '2026-01-01' })], TODAY)[0].overdue, false, 'everyone paid: never overdue');
assert.deepEqual(feeRequestGroups([], TODAY), []);

// --- what counts as income ---
assert.equal(isLedgerRow(row({ status: 'pending' })), false, 'an unpaid bill is not income');
assert.equal(isLedgerRow(row({ status: 'rejected' })), false, 'an excused bill is not income');
assert.equal(isLedgerRow(row({ status: 'paid' })), true);
assert.equal(isLedgerRow(row({ status: 'awaiting_review' })), true, 'receipts are verified on the Income tab');
assert.equal(isLedgerRow(row({ kind: 'membership_renewal', status: 'pending' })), true, 'other kinds are untouched');

// --- undo ---
assert.equal(canReopenFee(row({ status: 'paid', method: 'cash' })), true);
assert.equal(canReopenFee(row({ status: 'rejected' })), true);
assert.equal(canReopenFee(row({ status: 'paid', method: 'stripe' })), false, 'real card money can never be undone here');
assert.equal(canReopenFee(row({ status: 'paid', method: 'bank_transfer' })), false, 'a checked transfer stays');
assert.equal(canReopenFee(row({ kind: 'income_other', status: 'rejected' })), false, 'only fee requests');

// --- search ---
assert.equal(matchesSearch('', 'Alice Adams'), true, 'an empty box shows everyone');
assert.equal(matchesSearch('   ', 'Alice Adams'), true, 'spaces alone show everyone');
assert.equal(matchesSearch('ALI', 'Alice Adams'), true, 'ignores case, matches part of a name');
assert.equal(matchesSearch('adams alice', 'Alice Adams'), true, 'words in any order');
assert.equal(matchesSearch('alice smith', 'Alice Adams'), false, 'every word must match');
assert.equal(matchesSearch('parent@', 'Kit Kid', 'parent@x.test'), true, 'any field');
assert.equal(matchesSearch('bob', 'Alice Adams', null, undefined), false, 'blank fields are fine');

// --- who is emailed ---
assert.equal(billRecipient({ payer_email: 'old@x.test', member: { full_name: 'Al', email: 'new@x.test' } })?.to, 'new@x.test', 'current address wins');
const kid = billRecipient({ member: { full_name: 'Kid', email: 'kid@x.test', guardian_name: 'Pat', guardian_email: 'pat@x.test' } });
assert.deepEqual([kid?.to, kid?.childName], ['pat@x.test', 'Kid'], 'a junior is billed through their guardian');
assert.equal(billRecipient({ payer_name: 'Gone', payer_email: 'gone@x.test', member: null })?.to, 'gone@x.test', 'member since removed');
assert.equal(billRecipient({ member: { full_name: 'No Mail', email: '' } }), null);
assert.equal(billRecipient({ member: null, payer_email: null }), null);

console.log('fee-requests.check ok');
