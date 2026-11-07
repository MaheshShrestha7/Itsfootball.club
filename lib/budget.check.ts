// Run: npx esbuild lib/budget.check.ts --bundle --platform=node | node   (part of `npm run check`)
import assert from 'node:assert/strict';
import { budgetCsv, budgetKey, budgetLines, budgetTotals, paceSeries, parseBudgetCsv, parseCsvRows, pieSlices, siteDay, varianceWord } from './budget';

// --- lines ---
const budgets = { [budgetKey('expense', 'referees')]: 100000, [budgetKey('expense', 'insurance')]: 50000, [budgetKey('income', 'membership')]: 200000 };
const spend = budgetLines('expense', budgets, [{ key: 'referees', cents: 120000 }, { key: 'kit_equipment', cents: 30000 }]);
assert.deepEqual(spend.map(l => [l.category, l.budget, l.actual, l.percent, l.variance]), [
  ['referees', 100000, 120000, 120, -20000],
  ['insurance', 50000, 0, 0, 50000],
  ['kit_equipment', 0, 30000, null, -30000],
], 'over budget, untouched, and a surprise cost with no budget all show; biggest first');
assert.equal(spend[0].label, 'Referees & officials');
const income = budgetLines('income', budgets, [{ key: 'membership', cents: 250000 }]);
assert.equal(income[0].variance, 50000, 'more income than planned is good news');
assert.equal(budgetLines('expense', {}, []).length, 0, 'nothing planned or spent');
assert.deepEqual(budgetTotals(spend), { budget: 150000, actual: 150000, percent: 100 });
assert.equal(budgetTotals([]).percent, null, 'no budget, no percentage');
assert.equal(budgetLines('income', { [budgetKey('income', 'grants')]: 0 }, []).length, 0, 'a zero budget is no budget');
assert.equal(budgetLines('expense', {}, [{ key: 'made_up', cents: 5 }])[0].label, 'made_up', 'an unknown category still shows');
assert.equal(varianceWord('expense', 5), 'Under budget');
assert.equal(varianceWord('expense', -5), 'Over budget');
assert.equal(varianceWord('income', 5), 'Above budget');
assert.equal(varianceWord('income', -5), 'Below budget');
assert.equal(varianceWord('income', 0), 'On budget');

// --- CSV parsing ---
assert.deepEqual(parseCsvRows('a,b\r\n"c,d","e""f"\n\n"line\nbreak",g'), [['a', 'b'], ['c,d', 'e"f'], ['line\nbreak', 'g']], 'quotes, commas, line breaks and blank rows');
assert.deepEqual(parseCsvRows('﻿Type\n'), [['Type']], 'Excel\'s byte order mark');

// --- export then import gives back the same budget ---
const csv = budgetCsv('2026', budgets, { income: [{ key: 'membership', cents: 150000 }], expense: [{ key: 'referees', cents: 120000 }, { key: 'made_up', cents: 700 }] });
const lines = parseCsvRows(csv);
assert.deepEqual(lines[0], ['Type', 'Category', 'Budget', 'Actual', 'Difference', 'Position', 'Season']);
assert.equal(lines.find(r => r[1] === 'Referees & officials')!.join('|'), 'Expense|Referees & officials|1000.00|1200.00|200.00|Over budget|2026');
assert.equal(lines.find(r => r[1] === 'Membership fees')!.join('|'), 'Income|Membership fees|2000.00|1500.00|500.00|Below budget|2026');
assert.ok(lines.find(r => r[1] === 'Bank & Stripe fees'), 'every category is listed, so it doubles as a template');
assert.equal(lines.find(r => r[1] === 'Grants & council funding')![5], '', 'an unused category has no position');
const round = parseBudgetCsv(csv);
assert.equal(round.problems.length, 1, 'only the made-up category is reported');
assert.match(round.problems[0], /"made_up" isn't an expense category/);
assert.equal(round.amounts[budgetKey('expense', 'referees')], 100000);
assert.equal(round.amounts[budgetKey('income', 'membership')], 200000);
assert.equal(round.amounts[budgetKey('income', 'grants')], 0, 'a zero clears that budget');

// --- importing a spreadsheet someone made ---
const made = parseBudgetCsv('Notes,BUDGET,category,type\nfirst,"$1,250.50",referees & OFFICIALS,expenses\nx,A$99,Membership Fees,Income\ny,,Insurance,Expense\nz,abc,Catering,Expense\nw,-5,Travel & transport,Expense\nq,5,Nope,Expense\nr,5,Insurance,Other\ns,7,Referees & officials,Expense\n');
assert.equal(made.amounts[budgetKey('expense', 'referees')], 125050, 'columns in any order, any case, $ and commas');
assert.equal(made.amounts[budgetKey('income', 'membership')], 9900, 'A$ too');
assert.equal(budgetKey('expense', 'insurance') in made.amounts, false, 'a blank cell changes nothing');
assert.equal(made.problems.length, 5, made.problems.join(' / '));
assert.match(made.problems[0], /Row 5: "abc" isn't an amount for Catering/);
assert.match(made.problems[1], /Row 6: "-5" isn't an amount/);
assert.match(made.problems[2], /Row 7: "Nope"/);
assert.match(made.problems[3], /Row 8: the type must be/);
assert.match(made.problems[4], /Row 9: Referees & officials is in the file twice/);
assert.match(parseBudgetCsv('a,b\n1,2').problems[0], /Type, Category and Budget/, 'the wrong file says so');
assert.match(parseBudgetCsv('').problems[0], /empty/);
assert.equal(parseBudgetCsv("Type,Category,Budget\nExpense,Catering,'5").amounts[budgetKey('expense', 'catering')], 500, 'the export\'s formula guard is undone');

// --- the line chart ---
const pace = paceSeries([
  { day: '2026-01-15', cents: 1000 }, { day: '2026-03-02', cents: 2000 }, { day: '2025-12-20', cents: 500 }, { day: '2027-02-01', cents: 800 },
], 12000, '2026-01-01', '2026-12-31', '2026-03-10');
assert.equal(pace.length, 12);
assert.deepEqual(pace.slice(0, 4).map(p => p.actual), [1500, 1500, 3500, null], 'running total, earlier items in the first month, stopping at today');
assert.deepEqual([pace[0].pace, pace[5].pace, pace[11].pace], [1000, 6000, 12000], 'an even spread ending on the budget');
assert.equal(pace[0].label, 'Jan');
const finished = paceSeries([{ day: '2026-01-15', cents: 1000 }, { day: '2027-02-01', cents: 800 }], 100, '2026-01-01', '2026-12-31', '2027-06-01');
assert.equal(finished[11].actual, 1800, 'a finished season ends on the same total as the table');
assert.deepEqual(paceSeries([], 300, '2026-07-15', '2027-06-30', '2026-07-20').map(p => p.month).slice(0, 7), ['2026-07-01', '2026-08-01', '2026-09-01', '2026-10-01', '2026-11-01', '2026-12-01', '2027-01-01'], 'across a new year');
assert.equal(paceSeries([], 300, '2026-07-15', '2027-06-30', '2026-07-20').length, 12);
assert.equal(siteDay('2025-12-31T13:30:00Z'), '2026-01-01', 'days are the site\'s, not UTC\'s');

// --- the pie ---
const line = (category: string, actual: number) => ({ category, label: category, actual });
assert.deepEqual(pieSlices([line('a', 750), line('b', 250), line('none', 0), line('neg', -5)]).map(s => [s.key, s.percent]), [['a', 75], ['b', 25]], 'empty and negative left out');
const many = pieSlices(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((k, i) => line(k, 80 - i * 10)), 5);
assert.deepEqual(many.map(s => s.key), ['a', 'b', 'c', 'd', 'e', '__other']);
assert.equal(many[5].cents, 30 + 20 + 10);
assert.equal(many.reduce((n, s) => n + s.cents, 0), 360, 'it all adds up');
assert.deepEqual(pieSlices(['a', 'b', 'c', 'd', 'e', 'f'].map(k => line(k, 1))).map(s => s.key), ['a', 'b', 'c', 'd', 'e', 'f'], 'one extra slice is better than an "everything else" of one');
assert.deepEqual(pieSlices([]), []);

console.log('budget: lines, CSV export and import, line chart and pie figures OK');
