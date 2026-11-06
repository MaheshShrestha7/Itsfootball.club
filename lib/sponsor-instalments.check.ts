// Run: npx esbuild lib/sponsor-instalments.check.ts --bundle --platform=node | node   (part of `npm run check`)
import assert from 'node:assert/strict';
import { addMonths, buildSchedule, instalmentLabel, invoiceIsDue, parseSchedule, planSummary, reminderIsDue, type PlanRow } from './sponsor-instalments';

const TODAY = '2026-11-07';

// --- dates ---
assert.equal(addMonths('2026-01-31', 1), '2026-02-28', 'a shorter month uses its last day');
assert.equal(addMonths('2028-01-31', 1), '2028-02-29', 'leap year');
assert.equal(addMonths('2026-11-15', 3), '2027-02-15', 'across the new year');
assert.equal(addMonths('2026-12-01', 12), '2027-12-01', 'a whole year');
assert.equal(addMonths('2026-11-15', 0), '2026-11-15');

// --- the split always adds up ---
const three = buildSchedule(300000, 3, '2027-01-01', 3);
assert.deepEqual(three, [
  { amountCents: 100000, dueOn: '2027-01-01' },
  { amountCents: 100000, dueOn: '2027-04-01' },
  { amountCents: 100000, dueOn: '2027-07-01' },
]);
const odd = buildSchedule(100000, 3, '2027-01-31', 1);
assert.deepEqual(odd.map(r => r.amountCents), [33334, 33333, 33333], 'odd cents go on the earliest');
assert.deepEqual(odd.map(r => r.dueOn), ['2027-01-31', '2027-02-28', '2027-03-31'], 'each counted from the first, so short months do not drift');
for (const total of [100, 199, 12345, 99999, 1000001]) for (const n of [2, 3, 7, 12]) {
  assert.equal(buildSchedule(total, n, TODAY, 1).reduce((s, r) => s + r.amountCents, 0), total, `${total} over ${n}`);
}

// --- what the server accepts ---
const row = (amountCents: unknown, dueOn: unknown) => ({ amountCents, dueOn });
const good = [row(150000, '2026-11-07'), row(150000, '2027-02-07')];
assert.equal(parseSchedule(good, TODAY).ok, true, 'first due today is fine');
const err = (input: unknown) => { const r = parseSchedule(input, TODAY); return r.ok ? null : r.error; };
assert.ok(err(null), 'nothing sent');
assert.ok(err([good[0]]), 'one instalment is not a plan');
assert.ok(err(Array.from({ length: 13 }, (_, i) => row(100, addMonths(TODAY, i)))), 'more than twelve');
assert.ok(err([row(99, '2026-12-01'), row(100, '2027-01-01')]), 'too small for Stripe');
assert.ok(err([row(100.5, '2026-12-01'), row(100, '2027-01-01')]), 'cents must be whole');
assert.ok(err([row('abc', '2026-12-01'), row(100, '2027-01-01')]), 'amount junk');
assert.ok(err([row(-500, '2026-12-01'), row(100, '2027-01-01')]), 'negative');
assert.ok(err([row(100, '2026-11-06'), row(100, '2027-01-01')]), 'already past');
assert.ok(err([row(100, '2027-01-01'), row(100, '2027-01-01')]), 'same day twice');
assert.ok(err([row(100, '2027-02-01'), row(100, '2027-01-01')]), 'out of order');
assert.ok(err([row(100, 'soon'), row(100, '2027-01-01')]), 'date junk');
assert.ok(err([row(90_000_000, '2027-01-01'), row(90_000_000, '2027-02-01')]), 'absurd total');

// --- labels ---
assert.equal(instalmentLabel({ instalment_no: 2, instalment_of: 3 }), 'Instalment 2 of 3');
assert.equal(instalmentLabel({}), null, 'an ordinary payment');

// --- where a plan is up to ---
const plan = (no: number, status: string, due: string, id = 'p1'): PlanRow => ({ id: `${id}-${no}`, sponsor_id: 's', instalment_plan_id: id, instalment_no: no, instalment_of: 3, status, amount_cents: 100000, currency: 'AUD', due_on: due });
assert.equal(planSummary([], TODAY), null, 'no plan');
assert.equal(planSummary([{ ...plan(1, 'pending', '2027-01-01'), instalment_plan_id: null }], TODAY), null, 'an ordinary invoice is not a plan');
const mid = planSummary([plan(3, 'pending', '2027-07-01'), plan(1, 'paid', '2027-01-01'), plan(2, 'pending', '2027-04-01')], TODAY)!;
assert.deepEqual(mid.rows.map(r => r.instalment_no), [1, 2, 3], 'in order');
assert.deepEqual([mid.paidCount, mid.paidCents, mid.leftCents, mid.next?.instalment_no, mid.overdue, mid.open], [1, 100000, 200000, 2, false, true]);
const late = planSummary([plan(1, 'paid', '2026-09-01'), plan(2, 'pending', '2026-11-06'), plan(3, 'pending', '2027-01-01')], TODAY)!;
assert.equal(late.overdue, true, 'next one is past its due date');
assert.equal(planSummary([plan(1, 'paid', '2026-09-01'), plan(2, 'pending', TODAY)], TODAY)!.overdue, false, 'due today is not overdue yet');
const checking = planSummary([plan(1, 'awaiting_review', '2026-09-01'), plan(2, 'pending', '2027-01-01')], TODAY)!;
assert.equal(checking.next?.instalment_no, 2, 'a receipt being checked is not the next to pay');
assert.equal(checking.overdue, false, 'and not overdue while the club checks it');
assert.equal(checking.leftCents, 200000, 'but not counted as paid');
const done = planSummary([plan(1, 'paid', '2026-09-01'), plan(2, 'paid', '2026-10-01'), plan(3, 'paid', '2026-11-01')], TODAY)!;
assert.deepEqual([done.open, done.next, done.leftCents], [false, null, 0], 'finished');
assert.equal(planSummary([plan(1, 'rejected', '2027-01-01')], TODAY), null, 'a cancelled plan is gone');
const newer = planSummary([plan(1, 'paid', '2025-09-01', 'old'), plan(1, 'pending', '2027-01-01', 'new')], TODAY)!;
assert.equal(newer.planId, 'new', 'the plan still running, not last year\'s');

// --- when emails go out ---
assert.equal(invoiceIsDue(TODAY, TODAY), true, 'due today');
assert.equal(invoiceIsDue('2026-11-21', TODAY), true, 'exactly 14 days out');
assert.equal(invoiceIsDue('2026-11-22', TODAY), false, '15 days out waits');
assert.equal(reminderIsDue('2026-11-05', TODAY), false, 'two days late: not yet');
assert.equal(reminderIsDue('2026-11-04', TODAY), true, 'three days late');
assert.equal(reminderIsDue('2027-01-01', TODAY), false, 'not due yet');

console.log('sponsor-instalments: dates, splits, schedule checks, plan progress and email timing OK');
