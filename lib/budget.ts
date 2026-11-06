// Budget vs actuals: the plan a club sets per season and category against what the ledger says happened.
// Pure, so the sums and the CSV handling can be checked without a browser (lib/budget.check.ts).
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, parseMoneyToCents, toCsv } from './finance';
import { DATE_LOCALE, SITE_TIME_ZONE } from './dates';

export type BudgetKind = 'income' | 'expense';

export const CATEGORIES: Record<BudgetKind, Record<string, string>> = { income: INCOME_CATEGORIES, expense: EXPENSE_CATEGORIES };
const MAX_BUDGET_CENTS = 100_000_000_000;

export const budgetKey = (kind: BudgetKind, category: string) => `${kind}:${category}`;

export interface BudgetLine {
  kind: BudgetKind;
  category: string;
  label: string;
  budget: number;
  actual: number;
  /** Actual as a share of the budget, as a whole percent. Null with no budget to measure against. */
  percent: number | null;
  /** Budget less actual for spending, actual less budget for income: positive is good news either way */
  variance: number;
}

/** Every category with a budget or any actual money (a surprise cost must still show), biggest first */
export function budgetLines(
  kind: BudgetKind,
  budgets: Record<string, number>,
  actuals: { key: string; cents: number }[]
): BudgetLine[] {
  const actual = new Map(actuals.map(a => [a.key, a.cents]));
  const keys = new Set<string>();
  for (const k of Object.keys(CATEGORIES[kind])) if ((budgets[budgetKey(kind, k)] || 0) > 0) keys.add(k);
  for (const a of actuals) if (a.cents !== 0) keys.add(a.key);
  return [...keys].map(category => {
    const b = budgets[budgetKey(kind, category)] || 0;
    const a = actual.get(category) || 0;
    return {
      kind, category, label: CATEGORIES[kind][category] || category, budget: b, actual: a,
      percent: b > 0 ? Math.round((a / b) * 100) : null,
      variance: kind === 'income' ? a - b : b - a,
    };
  }).sort((x, y) => Math.max(y.budget, y.actual) - Math.max(x.budget, x.actual) || x.label.localeCompare(y.label));
}

export function budgetTotals(lines: BudgetLine[]) {
  const budget = lines.reduce((n, l) => n + l.budget, 0);
  const actual = lines.reduce((n, l) => n + l.actual, 0);
  return { budget, actual, percent: budget > 0 ? Math.round((actual / budget) * 100) : null };
}

/** In words, since "under" is good for spending and bad for income */
export function varianceWord(kind: BudgetKind, variance: number): string {
  if (variance === 0) return 'On budget';
  if (kind === 'income') return variance > 0 ? 'Above budget' : 'Below budget';
  return variance > 0 ? 'Under budget' : 'Over budget';
}

// --------------------------------- CSV ---------------------------------

/** Every category, so a club's first export doubles as the template to fill in */
export function budgetCsv(season: string, budgets: Record<string, number>, actuals: Record<BudgetKind, { key: string; cents: number }[]>): string {
  const rows: (string | number)[][] = [['Type', 'Category', 'Budget', 'Actual', 'Difference', 'Position', 'Season']];
  for (const kind of ['income', 'expense'] as const) {
    const actual = new Map(actuals[kind].map(a => [a.key, a.cents]));
    const known = Object.keys(CATEGORIES[kind]);
    for (const category of [...known, ...actuals[kind].map(a => a.key).filter(k => !CATEGORIES[kind][k])]) {
      const b = budgets[budgetKey(kind, category)] || 0;
      const a = actual.get(category) || 0;
      const variance = kind === 'income' ? a - b : b - a;
      rows.push([
        kind === 'income' ? 'Income' : 'Expense', CATEGORIES[kind][category] || category,
        (b / 100).toFixed(2), (a / 100).toFixed(2), (Math.abs(variance) / 100).toFixed(2),
        b === 0 && a === 0 ? '' : varianceWord(kind, variance), season,
      ]);
    }
  }
  return toCsv(rows);
}

/** RFC 4180: quoted fields, doubled quotes, commas and line breaks inside quotes, any line ending */
export function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const src = text.replace(/^﻿/, '');
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"' && field === '') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(field); field = '';
      rows.push(row); row = [];
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.some(cell => cell.trim() !== ''));
}

export interface BudgetImport {
  /** budgetKey -> cents, for every row that was understood */
  amounts: Record<string, number>;
  /** One plain sentence per row that wasn't used. Nothing is dropped without saying so. */
  problems: string[];
}

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

/** Reads the file budgetCsv writes, or any spreadsheet with Type, Category and Budget columns in any order */
export function parseBudgetCsv(text: string): BudgetImport {
  const rows = parseCsvRows(text);
  const out: BudgetImport = { amounts: {}, problems: [] };
  if (!rows.length) return { ...out, problems: ['The file is empty.'] };
  const header = rows[0].map(norm);
  const col = { type: header.indexOf('type'), category: header.indexOf('category'), budget: header.indexOf('budget') };
  if (col.type < 0 || col.category < 0 || col.budget < 0) {
    return { ...out, problems: ['The first row needs columns called Type, Category and Budget. Export a budget to see the layout.'] };
  }
  const seen = new Set<string>();
  rows.slice(1).forEach((row, i) => {
    const line = `Row ${i + 2}`;
    // toCsv puts ' before anything a spreadsheet could run as a formula
    const typeText = norm((row[col.type] || '').replace(/^'/, ''));
    const kind: BudgetKind | null = typeText === 'income' ? 'income' : typeText === 'expense' || typeText === 'expenses' ? 'expense' : null;
    if (!kind) return void out.problems.push(`${line}: the type must be Income or Expense.`);
    const name = (row[col.category] || '').replace(/^'/, '');
    const category = Object.entries(CATEGORIES[kind]).find(([k, label]) => norm(k) === norm(name) || norm(label) === norm(name))?.[0];
    if (!category) return void out.problems.push(`${line}: "${name.trim()}" isn't an ${kind} category.`);
    const raw = (row[col.budget] || '').replace(/^'/, '').trim();
    // Blank means nothing to change for this category
    if (!raw) return;
    const cents = parseMoneyToCents(raw.replace(/^[A-Za-z]{0,3}\$\s*/, ''));
    if (cents === null || cents > MAX_BUDGET_CENTS) return void out.problems.push(`${line}: "${raw}" isn't an amount for ${CATEGORIES[kind][category]}.`);
    const key = budgetKey(kind, category);
    if (seen.has(key)) return void out.problems.push(`${line}: ${CATEGORIES[kind][category]} is in the file twice. The first one was used.`);
    seen.add(key);
    out.amounts[key] = cents;
  });
  return out;
}

// --------------------------------- charts ---------------------------------

export interface PacePoint {
  /** First day of the month, YYYY-MM-01 */
  month: string;
  label: string;
  /** Running total to the end of this month. Null for months still to come, so the line stops at today. */
  actual: number | null;
  /** How far along an even spread of the budget would be by then */
  pace: number;
}

const monthKey = (day: string) => day.slice(0, 7);

/** The day (YYYY-MM-DD) a moment fell on in the site's time zone */
export const siteDay = (iso: string) => new Intl.DateTimeFormat('en-CA', { timeZone: SITE_TIME_ZONE }).format(new Date(iso));

/**
 * Running totals by month across a season, beside an even spread of the budget. Anything dated outside
 * the season counts in its first or last month, so the line ends on the same total as the table.
 */
export function paceSeries(items: { day: string; cents: number }[], budget: number, start: string, end: string, today: string): PacePoint[] {
  const months: string[] = [];
  let [y, m] = start.split('-').map(Number);
  const last = monthKey(end);
  while (months.length < 36) {
    const key = `${y}-${String(m).padStart(2, '0')}`;
    months.push(key);
    if (key >= last) break;
    if (++m > 12) { m = 1; y++; }
  }
  const totals = new Map<string, number>();
  for (const it of items) {
    const key = monthKey(it.day);
    const at = key < months[0] ? months[0] : key > months[months.length - 1] ? months[months.length - 1] : key;
    totals.set(at, (totals.get(at) || 0) + it.cents);
  }
  const current = monthKey(today);
  let running = 0;
  return months.map((key, i) => {
    running += totals.get(key) || 0;
    const [yr, mo] = key.split('-').map(Number);
    return {
      month: `${key}-01`,
      label: new Date(Date.UTC(yr, mo - 1, 1)).toLocaleDateString(DATE_LOCALE, { month: 'short', timeZone: 'UTC' }),
      actual: key <= current ? running : null,
      pace: Math.round((budget * (i + 1)) / months.length),
    };
  });
}

export interface PieSlice {
  key: string;
  label: string;
  cents: number;
  percent: number;
}

/** A pie's slices: the biggest few, then the rest as Other, so it stays readable. Nothing negative or empty. */
export function pieSlices(lines: { category: string; label: string; actual: number }[], max = 5): PieSlice[] {
  const positive = lines.filter(l => l.actual > 0).sort((a, b) => b.actual - a.actual);
  const total = positive.reduce((n, l) => n + l.actual, 0);
  if (!total) return [];
  const slice = (key: string, label: string, cents: number) => ({ key, label, cents, percent: Math.round((cents / total) * 1000) / 10 });
  const kept = positive.length > max + 1 ? positive.slice(0, max) : positive;
  const rest = positive.slice(kept.length).reduce((n, l) => n + l.actual, 0);
  return [...kept.map(l => slice(l.category, l.label, l.actual)), ...(rest > 0 ? [slice('__other', 'Everything else', rest)] : [])];
}
