// Run: npx esbuild lib/agm-report.check.ts --bundle --platform=node | node   (part of `npm run check`)
import assert from 'node:assert/strict';
import { agmMoney, agmOwed, agmSponsors, closingBalance, membersByTier, seasonOptions, type AgmExpense, type AgmPayment } from './agm-report';

let n = 0;
const pay = (over: Partial<AgmPayment>): AgmPayment => ({ id: `p${++n}`, kind: 'income_other', category: 'other', status: 'paid', method: 'cash', amount_cents: 1000, season: '2026', ...over });
const exp = (over: Partial<AgmExpense>): AgmExpense => ({ category: 'other', amount_cents: 1000, season: '2026', reimbursed: false, ...over });

// --- which seasons, in what order ---
const options = seasonOptions(
  [{ name: '2025', start_date: '2025-01-01', end_date: '2025-12-31' }, { name: '2026', start_date: '2026-01-01', end_date: '2026-12-31' }, { name: ' ' }],
  [{ season: '2024' }, { season: '2026' }, { season: null }, { season: '' }]
);
assert.deepEqual(options.map(o => o.name), ['2026', '2025', '2024'], 'newest first, no blanks or doubles, ledger-only labels included');
assert.equal(options[0].end_date, '2026-12-31', 'a real season keeps its dates');
assert.deepEqual(seasonOptions([], []), [], 'nothing to report');
assert.deepEqual(seasonOptions([], [{ season: '2025/26' }, { season: '2026/27' }]).map(o => o.name), ['2026/27', '2025/26']);

// --- the money ---
const payments: AgmPayment[] = [
  pay({ category: 'membership', amount_cents: 50000 }),
  pay({ category: 'membership', amount_cents: 25000, method: 'stripe' }),
  pay({ category: 'sponsorship', amount_cents: 100000, kind: 'sponsorship' }),
  pay({ category: 'match_fees', amount_cents: 1500, kind: 'fee_request' }),
  pay({ category: 'membership', amount_cents: 40000, season: '2025' }),
  pay({ category: 'grants', amount_cents: 9000, season: '2025' }),
  pay({ category: 'fundraising', amount_cents: 7000, season: '2024' }),
  // None of these is income
  pay({ category: 'membership', amount_cents: 11100, status: 'pending' }),
  pay({ category: 'match_fees', amount_cents: 1500, kind: 'fee_request', status: 'pending', due_on: '2026-12-01' }),
  pay({ category: 'match_fees', amount_cents: 1500, kind: 'fee_request', status: 'rejected', due_on: '2026-12-01' }),
  pay({ category: 'membership', amount_cents: 22200, status: 'awaiting_review' }),
  pay({ category: 'membership', amount_cents: 33300, status: 'refunded' }),
  pay({ category: 'membership', amount_cents: 44400, status: 'failed' }),
];
const expenses: AgmExpense[] = [
  exp({ category: 'referees', amount_cents: 30000 }),
  exp({ category: 'kit_equipment', amount_cents: 60000, paid_by_member_id: 'm1', reimbursed: true }),
  exp({ category: 'referees', amount_cents: 20000, season: '2025' }),
  exp({ category: 'insurance', amount_cents: 5000, season: '2025' }),
  exp({ category: 'catering', amount_cents: 999, season: '2024' }),
];
const money = agmMoney(payments, expenses, '2026', '2025');
assert.equal(money.totalIncome, 176500, 'only paid money in this season');
assert.equal(money.totalExpenses, 90000);
assert.equal(money.surplus, 86500);
assert.equal(money.previousIncome, 49000);
assert.equal(money.previousExpenses, 25000);
assert.equal(money.previousSurplus, 24000);
assert.deepEqual(money.income.map(l => [l.label, l.cents, l.previousCents]), [
  ['Sponsorship', 100000, 0],
  ['Membership fees', 75000, 40000],
  ['Match fees / subs', 1500, 0],
  ['Grants & council funding', 0, 9000],
], 'biggest first, labelled, with last season\'s figures and lines only last season had; older seasons left out');
assert.deepEqual(money.expenses.map(l => [l.key, l.cents, l.previousCents]), [['kit_equipment', 60000, 0], ['referees', 30000, 20000], ['insurance', 0, 5000]]);
assert.equal(money.income.reduce((t, l) => t + l.cents, 0), money.totalIncome, 'the lines add up to the total');
assert.equal(money.anyCard, true);
assert.equal(money.refundedCents, 33300);
assert.equal(money.unfiledCents, 0);

const alone = agmMoney(payments, expenses, '2024', null);
assert.deepEqual([alone.totalIncome, alone.totalExpenses, alone.previousIncome, alone.previousSurplus, alone.anyCard], [7000, 999, 0, 0, false], 'the first season has nothing to compare with');
const deficit = agmMoney([pay({ amount_cents: 100 })], [exp({ amount_cents: 900 })], '2026', null);
assert.equal(deficit.surplus, -800, 'a loss shows as a loss');
const none = agmMoney([], [], '2026', '2025');
assert.deepEqual([none.totalIncome, none.surplus, none.income.length], [0, 0, 0], 'an empty season');
const unfiled = agmMoney([pay({ season: null, amount_cents: 500 }), pay({ season: '', amount_cents: 200 })], [exp({ season: null, amount_cents: 300 })], '2026', null);
assert.equal(unfiled.unfiledCents, 1000, 'money filed under no season is reported, not lost');
assert.equal(unfiled.totalIncome, 0);
assert.equal(agmMoney([pay({ category: 'made_up' })], [], '2026', null).income[0].label, 'made_up', 'an unknown category still shows');

// --- what's owed, whatever the season ---
const owed = agmOwed([
  pay({ kind: 'sponsorship', status: 'pending', due_on: '2027-01-01', amount_cents: 100000, season: '2026' }),
  pay({ kind: 'sponsorship', status: 'pending', due_on: '2027-04-01', amount_cents: 100000, season: '2025' }),
  pay({ kind: 'fee_request', status: 'pending', due_on: '2026-12-01', amount_cents: 1500 }),
  pay({ kind: 'sponsorship', status: 'awaiting_review', due_on: '2026-11-01', amount_cents: 50000 }),
  pay({ kind: 'membership_renewal', status: 'awaiting_review', amount_cents: 9000 }),
  pay({ kind: 'membership_renewal', status: 'pending', amount_cents: 7777 }),
  pay({ kind: 'fee_request', status: 'rejected', due_on: '2026-12-01', amount_cents: 1500 }),
  pay({ status: 'paid', due_on: '2026-12-01', amount_cents: 8888 }),
], [
  exp({ paid_by_member_id: 'm1', reimbursed: false, amount_cents: 4250 }),
  exp({ paid_by_member_id: 'm1', reimbursed: true, amount_cents: 6000 }),
  exp({ paid_by_member_id: null, reimbursed: false, amount_cents: 7000 }),
], [{ amount_cents: 3000, status: 'submitted' }, { amount_cents: 4250, status: 'approved' }, { amount_cents: 100, status: 'rejected' }, { amount_cents: 200, status: 'paid' }]);
assert.deepEqual(owed.sponsorInvoices, { count: 2, cents: 200000 }, 'all instalments still to come, across seasons');
assert.deepEqual(owed.fees, { count: 1, cents: 1500 }, 'excused fees and abandoned checkouts aren\'t owed');
assert.deepEqual(owed.receipts, { count: 2, cents: 59000 });
assert.equal(owed.totalToClub, 260500);
assert.deepEqual(owed.toMembers, { count: 1, cents: 4250 }, 'only money a member is still out of pocket');
assert.deepEqual(owed.claims, { count: 1, cents: 3000 }, 'an approved claim is already an expense, so isn\'t counted twice');
assert.equal(owed.totalByClub, 7250);

// --- sponsors ---
const list = agmSponsors([
  pay({ kind: 'sponsorship', sponsor_id: 'a', amount_cents: 100000 }),
  pay({ kind: 'sponsorship', sponsor_id: 'a', amount_cents: 100000 }),
  pay({ kind: 'sponsorship', sponsor_id: 'a', status: 'pending', due_on: '2027-01-01', amount_cents: 100000 }),
  pay({ kind: 'sponsorship', sponsor_id: 'b', amount_cents: 500000 }),
  pay({ kind: 'sponsorship', sponsor_id: 'c', amount_cents: 900000, season: '2025' }),
  pay({ kind: 'sponsorship', sponsor_id: 'd', status: 'pending', amount_cents: 400 }),
  pay({ kind: 'sponsorship', sponsor_id: 'gone', payer_name: 'Old Mill', amount_cents: 2000 }),
  pay({ kind: 'membership_signup', sponsor_id: 'a', amount_cents: 999999 }),
], [{ id: 'a', name: 'Acme' }, { id: 'b', name: 'Bakery' }, { id: 'c', name: 'Cafe' }], '2026');
assert.deepEqual(list.map(s => [s.name, s.paidCents, s.owingCents]), [['Bakery', 500000, 0], ['Acme', 200000, 100000], ['Old Mill', 2000, 0]],
  'this season\'s payments and what\'s owed now; last season\'s, abandoned checkouts and other kinds left out; a removed sponsor keeps their name');

// --- the rest ---
assert.equal(closingBalance(null, 500), null, 'no opening balance, no closing balance');
assert.equal(closingBalance(1000, -1500), -500);
assert.equal(closingBalance(0, 500), 500, 'an opening balance of zero is still one');
assert.deepEqual(membersByTier([{ membership_tier: 'Senior' }, { membership_tier: null }, { membership_tier: 'U10' }, { membership_tier: 'Senior' }, { membership_tier: ' ' }, { membership_tier: 'U12' }]),
  [{ tier: 'Senior', count: 2 }, { tier: 'U10', count: 1 }, { tier: 'U12', count: 1 }, { tier: 'No membership type', count: 2 }]);

console.log('agm-report: seasons, money, what\'s owed, sponsors and members OK');
