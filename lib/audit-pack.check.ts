// Run: npx esbuild lib/audit-pack.check.ts --bundle --platform=node | node   (part of `npm run check`)
import assert from 'node:assert/strict';
import {
  auditLogCsv, checksCsv, comparisonPeriod, defaultYear, financialYear, financialYearOf, invoicesCsv, logInPeriod, missingInvoiceNumbers, packChecks, packInvoices,
  packPeriod, packStatement, packTransactions, statementCsv, transactionsCsv, yearOptions, type PackExpense, type PackPayment,
} from './audit-pack';
import { toCsv } from './finance';

let n = 0;
const pay = (over: Partial<PackPayment>): PackPayment => ({
  id: `p${++n}`, kind: 'income_other', category: 'other', status: 'paid', method: 'bank_transfer', amount_cents: 1000, currency: 'AUD',
  created_at: '2026-03-01T01:00:00Z', paid_at: '2026-03-01T01:00:00Z', payer_name: `Payer ${n}`, ...over,
});
const exp = (over: Partial<PackExpense>): PackExpense => ({
  id: `e${++n}`, category: 'other', amount_cents: 1000, currency: 'AUD', reimbursed: false, spent_on: '2026-03-01', created_at: '2026-03-01T01:00:00Z',
  description: `Expense ${n}`, vendor: `Vendor ${n}`, method: 'bank_transfer', receipt_key: 'r', ...over,
});

// --- financial years ---
const fy2526 = financialYear(2025, 7);
assert.deepEqual(fy2526, { startYear: 2025, label: '2025/26', from: '2025-07-01', to: '2026-06-30' });
assert.deepEqual(financialYear(2026, 1), { startYear: 2026, label: '2026', from: '2026-01-01', to: '2026-12-31' }, 'a calendar year');
assert.equal(financialYear(2023, 3).to, '2024-02-29', 'ends on a leap day');
assert.equal(financialYear(2099, 7).label, '2099/00', 'the century rolls over');
assert.equal(financialYearOf('2026-06-30', 7).startYear, 2025);
assert.equal(financialYearOf('2026-07-01', 7).startYear, 2026);

// --- the day counts in Sydney, not UTC ---
const lastNight = pay({ paid_at: '2026-06-30T14:30:00Z' }); // 1 July, 00:30 in Sydney
assert.equal(packTransactions([lastNight], [], fy2526).length, 0, 'belongs to the next year');
assert.equal(packTransactions([lastNight], [], financialYear(2026, 7)).length, 1);

// --- which years, and which opens first ---
const options = yearOptions([pay({}), pay({ status: 'pending', paid_at: null, created_at: '2020-01-01T00:00:00Z' })], [exp({ spent_on: '2024-08-01' })], 7);
assert.deepEqual(options.map(y => y.label), ['2025/26', '2024/25'], 'newest first, and an unpaid bill makes no year');
assert.equal(defaultYear(options, '2026-11-07')?.label, '2025/26', 'the latest finished year');
assert.equal(defaultYear(options, '2026-05-01')?.label, '2024/25', 'not one still running');
assert.equal(defaultYear([fy2526], '2026-05-01')?.label, '2025/26', 'the only year, even if unfinished');
assert.equal(defaultYear([], '2026-05-01'), null);

// --- the statement, and that the listing adds up to it ---
const previous = financialYear(2024, 7);
const payments: PackPayment[] = [
  pay({ category: 'membership', amount_cents: 50000 }),
  pay({ category: 'membership', amount_cents: 25000 }),
  pay({ category: 'grants', amount_cents: 9000, paid_at: '2025-03-01T01:00:00Z', created_at: '2025-03-01T01:00:00Z' }),
  pay({ category: 'other', amount_cents: 7777, status: 'refunded' }),
  pay({ category: 'other', amount_cents: 1111, status: 'pending', paid_at: null }),
];
const expenses = [exp({ category: 'referees', amount_cents: 30000 }), exp({ category: 'insurance', amount_cents: 5000, spent_on: '2025-03-01' })];
const statement = packStatement(payments, expenses, fy2526, previous);
assert.equal(statement.money.totalIncome, 75000, 'paid only');
assert.equal(statement.money.previousIncome, 9000);
assert.equal(statement.money.totalExpenses, 30000);
assert.equal(statement.money.surplus, 45000);
assert.equal(statement.money.refundedCents, 7777);
assert.equal(statement.money.unfiledCents, 0, 'every counted record has a year');
assert.equal(statement.incomeCounts.membership, 2);
const listed = packTransactions(payments, expenses, fy2526);
const counted = (type: string) => listed.filter(r => r.type === type && r.counted).reduce((t, r) => t + r.cents, 0);
assert.equal(counted('Income'), statement.money.totalIncome, 'the listing adds up to the statement');
assert.equal(counted('Expense'), statement.money.totalExpenses);
assert.equal(listed.find(r => r.cents === 7777)?.counted, false, 'a refund is listed but not counted');
assert.ok(!listed.some(r => r.cents === 1111), 'an unpaid bill is not listed');
assert.deepEqual(packStatement(payments, expenses, fy2526, null).money.previousIncome, 0, 'no comparison year');

// --- any dates, not only a whole year ---
assert.deepEqual(packPeriod('2025-07-01', '2026-06-30', 7), fy2526, 'dates that make a year are that year');
const part = packPeriod('2026-01-01', '2026-03-31', 7)!;
assert.equal(part.label, '2026-01-01 to 2026-03-31');
assert.equal(part.startYear, undefined);
assert.equal(packPeriod('2026-03-31', '2026-01-01', 7), null, 'backwards');
assert.equal(packPeriod('', '2026-01-01', 7), null, 'a date missing');
assert.ok(packPeriod('2026-03-01', '2026-03-01', 7), 'a single day');
const ranged = [pay({ amount_cents: 100, paid_at: '2026-03-31T01:00:00Z' }), pay({ amount_cents: 200, paid_at: '2026-04-01T01:00:00Z' })];
const partStatement = packStatement(ranged, [exp({ amount_cents: 40, spent_on: '2026-01-01' }), exp({ amount_cents: 80, spent_on: '2025-12-31' })], part, null);
assert.equal(partStatement.money.totalIncome, 100, 'only inside the dates');
assert.equal(partStatement.money.totalExpenses, 40, 'first day counts, the day before does not');
assert.equal(partStatement.money.unfiledCents, 0, 'outside the dates is not unfiled');
assert.equal(packTransactions(ranged, [], part).reduce((t, r) => t + r.cents, 0), partStatement.money.totalIncome, 'the listing still adds up');
const across = packPeriod('2024-07-01', '2026-06-30', 7)!;
assert.equal(packStatement(payments, expenses, across, null).money.totalIncome, 84000, 'across two years');
const lateInPart = packChecks([], packTransactions([], [exp({ spent_on: '2026-02-01', created_at: '2026-04-01T01:00:00Z' })], part), part, 'AUD');
assert.equal(lateInPart.find(k => k.key === 'entered_late')?.rows.length, 1, 'late means after the chosen end date');

// --- compared with the same dates a year earlier ---
const compare = (from: string, to: string, spent: string) => comparisonPeriod(packPeriod(from, to, 7)!, 7, [], [exp({ spent_on: spent })]);
assert.deepEqual(compare('2025-07-01', '2026-06-30', '2025-01-01'), financialYear(2024, 7), 'a whole year compares with the year before');
const lastYear = compare('2026-01-01', '2026-03-31', '2025-02-01')!;
assert.equal(lastYear.label, '2025-01-01 to 2025-03-31');
assert.equal(compare('2026-01-01', '2026-03-31', '2025-04-01'), null, 'no money then, so no empty column');
assert.equal(compare('2024-07-01', '2026-06-30', '2023-08-01'), null, 'over a year would overlap itself');
assert.ok(compare('2025-07-01', '2026-06-29', '2025-01-01'), 'just under a year does not');
assert.equal(compare('2024-02-01', '2024-02-29', '2023-02-10')?.to, '2023-02-28', 'from a leap day');
assert.equal(compare('2025-02-01', '2025-02-28', '2024-02-29')?.to, '2024-02-29', 'to a leap day');
assert.equal(compare('2024-02-01', '2024-02-28', '2023-02-10')?.to, '2023-02-28', 'an ordinary 28th stays the 28th');
const sameDates = packPeriod('2026-01-01', '2026-03-31', 7)!;
const paidBoth = [pay({ amount_cents: 100, paid_at: '2026-02-01T01:00:00Z' }), pay({ amount_cents: 60, paid_at: '2025-02-01T01:00:00Z' }), pay({ amount_cents: 999, paid_at: '2025-04-01T01:00:00Z' })];
const comparedMoney = packStatement(paidBoth, [], sameDates, comparisonPeriod(sameDates, 7, paidBoth, [])).money;
assert.equal(comparedMoney.totalIncome, 100);
assert.equal(comparedMoney.previousIncome, 60, 'only inside the earlier dates');

// --- expense status tells the three cases apart ---
const statusOf = (over: Partial<PackExpense>) => packTransactions([], [exp(over)], fy2526)[0].status;
assert.equal(statusOf({}), 'Paid');
assert.equal(statusOf({ paid_by_member_id: 'm' }), 'Member paid, not paid back yet');
assert.equal(statusOf({ paid_by_member_id: 'm', reimbursed: true }), 'Paid back to member');

// --- checks ---
const keyed = (ps: PackPayment[], es: PackExpense[]) =>
  Object.fromEntries(packChecks(ps, packTransactions(ps, es, fy2526), fy2526, 'AUD').map(c => [c.key, c]));
let c = keyed([], [exp({ receipt_key: null, amount_cents: 200 }), exp({})]);
assert.equal(c.expense_no_receipt.rows.length, 1);
assert.equal(c.expense_no_receipt.cents, 200);
c = keyed([pay({ method: 'cash' }), pay({ method: 'cash', receipt_key: 'r' }), pay({ method: 'bank_transfer' })], []);
assert.equal(c.cash_no_receipt.rows.length, 1, 'only cash with nothing on file');
c = keyed([pay({ status: 'awaiting_review', paid_at: null, amount_cents: 300 }), pay({ status: 'awaiting_review', paid_at: null, created_at: '2020-01-01T00:00:00Z' })], []);
assert.equal(c.waiting.rows.length, 1, 'only those from this year');
assert.equal(c.waiting.cents, 300);
assert.equal(c.waiting.rows[0].counted, false);
c = keyed([], [exp({ created_at: '2026-07-02T01:00:00Z' }), exp({ created_at: '2026-06-30T01:00:00Z' })]);
assert.equal(c.entered_late.rows.length, 1);
c = keyed([], [exp({ vendor: 'Ref Co' }), exp({ vendor: ' ref co ' }), exp({ vendor: 'Ref Co', amount_cents: 2 }), exp({ vendor: 'Other' })]);
assert.equal(c.duplicates.rows.length, 2, 'same day, amount and name, whatever the capitals');
c = keyed([pay({ payer_name: 'A', stripe_payment_intent_id: 'pi_1' }), pay({ payer_name: 'A', stripe_payment_intent_id: 'pi_2' })], []);
assert.equal(c.duplicates.rows.length, 0, 'two card charges are two charges');
c = keyed([pay({ payer_name: 'A', status: 'refunded' }), pay({ payer_name: 'A' })], []);
assert.equal(c.duplicates.rows.length, 0, 'a refunded payment and its replacement');
c = keyed([pay({ currency: 'NZD' })], [exp({ currency: 'NZD', receipt_key: null })]);
assert.equal(c.other_currency.rows.length, 2);
assert.equal(c.other_currency.cents, null, 'no total across currencies');
assert.equal(c.expense_no_receipt.rows.length, 0, 'not added to an AUD total elsewhere');

// --- invoices ---
const invoices = [
  pay({ invoice_number: 3 }),
  pay({ invoice_number: 1, status: 'rejected', paid_at: null }),
  pay({ invoice_number: 5, created_at: '2024-01-01T00:00:00Z' }),
  pay({}),
];
assert.deepEqual(packInvoices(invoices, fy2526).map(p => p.invoice_number), [1, 3], 'this year, in order, cancelled ones included');
assert.deepEqual(missingInvoiceNumbers(invoices), [2, 4], 'across every year');
assert.deepEqual(missingInvoiceNumbers([]), []);

// --- activity log ---
const log = (created_at: string) => ({ id: created_at, actor_email: 'a@b.co', action: 'x', target_table: 'payments', target_id: null, summary: '=SUM(1)', details: { reason: 'r' }, created_at });
assert.deepEqual(logInPeriod([log('2026-02-01T00:00:00Z'), log('2025-08-01T00:00:00Z'), log('2026-08-01T00:00:00Z')], fy2526).map(r => r.created_at),
  ['2025-08-01T00:00:00Z', '2026-02-01T00:00:00Z'], 'this year, oldest first');

// --- CSV ---
const lines = toCsv(statementCsv(statement, fy2526, previous)).split('\r\n');
assert.equal(lines[0], 'Section,Category,Records,2025/26,2024/25');
assert.ok(lines.includes('Income,Membership fees,2,750.00,0.00'));
assert.ok(lines.includes('Income,Total income,,750.00,90.00'));
assert.ok(lines.includes('Result,Surplus (deficit),,450.00,40.00'));
const deficit = packStatement([], [exp({ amount_cents: 500 })], fy2526, null);
assert.ok(toCsv(statementCsv(deficit, fy2526, null)).includes('Result,Surplus (deficit),,(5.00)'), 'brackets for a deficit');
const txCsv = transactionsCsv(packTransactions([pay({ reviewed_by: 'u1', invoice_number: 7 })], [], fy2526), id => `Name of ${id}`);
assert.equal(txCsv[1][10], 7);
assert.equal(txCsv[1][14], 'Name of u1');
assert.equal(txCsv[0].length, txCsv[1].length, 'a value for every heading');
assert.equal(checksCsv(Object.values(keyed([], [exp({ receipt_key: null })])))[1][0], 'Expenses with no receipt');
assert.equal(invoicesCsv([], [2])[1][4], 'Missing from the sequence');
assert.equal(invoicesCsv(invoices.slice(0, 1), [])[0].length, invoicesCsv(invoices.slice(0, 1), [])[1].length);
assert.ok(toCsv(auditLogCsv([log('2026-02-01T00:00:00Z')])).includes(`'=SUM(1)`), 'a logged value can\'t run as a formula');

console.log('audit-pack checks passed');
