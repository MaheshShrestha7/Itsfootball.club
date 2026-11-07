// The audit pack: a financial year of the club's records, or any dates chosen, set out for an accountant or
// auditor. Pure, so the figures can be checked without a browser (lib/audit-pack.check.ts). Reports here run
// by date, not season, and money uses the AGM report's own sums (agmMoney): income is what's marked paid,
// on the day it was paid; expenses are what was spent, on the day it was spent.
import { agmMoney, type AgmExpense, type AgmMoney, type AgmPayment } from './agm-report';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, PAYMENT_METHOD_LABEL } from './finance';
import { siteToday } from './member-prices';

export interface PackPayment extends AgmPayment {
  created_at: string;
  paid_at?: string | null;
  description?: string | null;
  currency: string;
  reference?: string | null;
  receipt_key?: string | null;
  invoice_number?: number | null;
  stripe_payment_intent_id?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
}

export interface PackExpense extends AgmExpense {
  id: string;
  created_at: string;
  spent_on: string;
  description: string;
  vendor?: string | null;
  method: string;
  currency: string;
  receipt_key?: string | null;
  created_by?: string | null;
}

export interface AuditLogRow {
  id: string;
  actor_email: string | null;
  action: string;
  target_table: string;
  target_id: string | null;
  summary: string;
  details: unknown;
  created_at: string;
}

// ------------------------------------------------------------------------------------------------
// Financial years
// ------------------------------------------------------------------------------------------------
export interface FinancialYear {
  startYear: number;
  label: string;
  /** First and last day, YYYY-MM-DD */
  from: string;
  to: string;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** startMonth is 1-12: a July year starting in 2025 is "2025/26", 1 Jul 2025 to 30 Jun 2026 */
export function financialYear(startYear: number, startMonth: number): FinancialYear {
  const last = new Date(Date.UTC(startYear + 1, startMonth - 1, 0));
  return {
    startYear,
    label: startMonth === 1 ? String(startYear) : `${startYear}/${pad((startYear + 1) % 100)}`,
    from: `${startYear}-${pad(startMonth)}-01`,
    to: last.toISOString().slice(0, 10),
  };
}

export function financialYearOf(day: string, startMonth: number): FinancialYear {
  const [y, m] = day.split('-').map(Number);
  return financialYear(m >= startMonth ? y : y - 1, startMonth);
}

/** The day something happened at, in the site's time zone (same as paymentSeason in lib/finance.ts) */
const siteDay = (iso: string) => siteToday(new Date(iso).getTime());
const settled = (p: PackPayment) => p.status === 'paid' || p.status === 'refunded';
export const paymentDay = (p: PackPayment) => siteDay(p.paid_at || p.created_at);
const expenseDay = (e: PackExpense) => e.spent_on.slice(0, 10);
const within = (day: string, period: PackPeriod) => period.from <= day && day <= period.to;

/** Every financial year with money in it, newest first */
export function yearOptions(payments: PackPayment[], expenses: PackExpense[], startMonth: number): FinancialYear[] {
  const days = [...payments.filter(settled).map(paymentDay), ...expenses.map(expenseDay)];
  const years = new Map(days.map(d => financialYearOf(d, startMonth)).map(y => [y.startYear, y]));
  return [...years.values()].sort((a, b) => b.startYear - a.startYear);
}

/** The dates a pack covers. startYear is set only when they're exactly one financial year. */
export interface PackPeriod {
  from: string;
  to: string;
  label: string;
  startYear?: number;
}

/** Null until both dates are there and in order. Dates that make a whole financial year are treated as that year. */
export function packPeriod(from: string, to: string, startMonth: number): PackPeriod | null {
  if (!from || !to || from > to) return null;
  const year = financialYearOf(from, startMonth);
  return year.from === from && year.to === to ? year : { from, to, label: `${from} to ${to}` };
}

/** The same date a year earlier. The last day of a month stays the last day, so February lands right in a leap year. */
function yearEarlier(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  const lastDay = (year: number) => new Date(Date.UTC(year, m, 0)).getUTCDate();
  return `${y - 1}-${pad(m)}-${pad(d === lastDay(y) ? lastDay(y - 1) : d)}`;
}

/** The same dates a year earlier, if any money was recorded then. Dates spanning over a year would overlap themselves, so they get none. */
export function comparisonPeriod(period: PackPeriod, startMonth: number, payments: PackPayment[], expenses: PackExpense[]): PackPeriod | null {
  const earlier = packPeriod(yearEarlier(period.from), yearEarlier(period.to), startMonth);
  if (!earlier || earlier.to >= period.from) return null;
  const days = [...payments.filter(settled).map(paymentDay), ...expenses.map(expenseDay)];
  return days.some(d => within(d, earlier)) ? earlier : null;
}

/** Audits look back, so open on the latest year that has finished */
export function defaultYear(options: FinancialYear[], today: string): FinancialYear | null {
  return options.find(y => y.to < today) ?? options[0] ?? null;
}

// ------------------------------------------------------------------------------------------------
// Income and expenses, by category
// ------------------------------------------------------------------------------------------------
export interface PackStatement {
  money: AgmMoney;
  /** Records behind each category line in the period, by category key */
  incomeCounts: Record<string, number>;
  expenseCounts: Record<string, number>;
}

const countBy = (rows: { category: string }[]) => {
  const counts: Record<string, number> = {};
  for (const r of rows) counts[r.category] = (counts[r.category] || 0) + 1;
  return counts;
};

export function packStatement(payments: PackPayment[], expenses: PackExpense[], period: PackPeriod, previous: PackPeriod | null): PackStatement {
  const label = (day: string) => (within(day, period) ? period.label : previous && within(day, previous) ? previous.label : 'outside');
  const money = agmMoney(
    payments.map(p => ({ ...p, season: settled(p) ? label(paymentDay(p)) : null })),
    expenses.map(e => ({ ...e, season: label(expenseDay(e)) })),
    period.label,
    previous?.label ?? null
  );
  return {
    money,
    incomeCounts: countBy(payments.filter(p => p.status === 'paid' && within(paymentDay(p), period))),
    expenseCounts: countBy(expenses.filter(e => within(expenseDay(e), period))),
  };
}

// ------------------------------------------------------------------------------------------------
// Every record behind the period
// ------------------------------------------------------------------------------------------------
export interface PackTransaction {
  id: string;
  type: 'Income' | 'Expense';
  date: string;
  entered: string;
  category: string;
  description: string;
  party: string;
  method: string;
  status: string;
  /** Whether it adds to the statement's totals: a refunded payment is listed but isn't income */
  counted: boolean;
  cents: number;
  currency: string;
  reference: string;
  invoiceNumber: number | null;
  stripeId: string;
  /** Income: who checked it. Expenses: who entered it. A user id, see transactionsCsv. */
  actorId: string | null;
  hasReceipt: boolean;
}

export const PAYMENT_STATUS_LABEL: Record<string, string> = {
  paid: 'Paid',
  refunded: 'Refunded',
  pending: 'Not paid',
  awaiting_review: 'Waiting to be checked',
  rejected: 'Cancelled or rejected',
  failed: 'Failed',
};

const expenseStatus = (e: PackExpense) => (e.reimbursed ? 'Paid back to member' : e.paid_by_member_id ? 'Member paid, not paid back yet' : 'Paid');

export function packTransactions(payments: PackPayment[], expenses: PackExpense[], period: PackPeriod): PackTransaction[] {
  const income: PackTransaction[] = payments.filter(p => settled(p) && within(paymentDay(p), period)).map(p => ({
    id: p.id,
    type: 'Income',
    date: paymentDay(p),
    entered: siteDay(p.created_at),
    category: INCOME_CATEGORIES[p.category] || p.category,
    description: p.description || '',
    party: p.payer_name || '',
    method: PAYMENT_METHOD_LABEL[p.method] || p.method,
    status: PAYMENT_STATUS_LABEL[p.status] || p.status,
    counted: p.status === 'paid',
    cents: p.amount_cents,
    currency: p.currency,
    reference: p.reference || '',
    invoiceNumber: p.invoice_number ?? null,
    stripeId: p.stripe_payment_intent_id || '',
    actorId: p.reviewed_by ?? null,
    hasReceipt: !!p.receipt_key,
  }));
  const spent: PackTransaction[] = expenses.filter(e => within(expenseDay(e), period)).map(e => ({
    id: e.id,
    type: 'Expense',
    date: expenseDay(e),
    entered: siteDay(e.created_at),
    category: EXPENSE_CATEGORIES[e.category] || e.category,
    description: e.description,
    party: e.vendor || '',
    method: PAYMENT_METHOD_LABEL[e.method] || e.method,
    status: expenseStatus(e),
    counted: true,
    cents: e.amount_cents,
    currency: e.currency,
    reference: '',
    invoiceNumber: null,
    stripeId: '',
    actorId: e.created_by ?? null,
    hasReceipt: !!e.receipt_key,
  }));
  return [...income, ...spent].sort((a, b) => a.date.localeCompare(b.date) || a.type.localeCompare(b.type) || a.id.localeCompare(b.id));
}

// ------------------------------------------------------------------------------------------------
// Things an auditor would ask about
// ------------------------------------------------------------------------------------------------
export interface PackCheck {
  key: string;
  title: string;
  why: string;
  rows: PackTransaction[];
  /** Added up in the club's currency; null when the rows aren't in it */
  cents: number | null;
}

/** The same day, amount and name more than once. Card payments are left out: Stripe has one record per charge. */
function possibleDuplicates(rows: PackTransaction[]): PackTransaction[] {
  const groups = new Map<string, PackTransaction[]>();
  for (const r of rows) {
    if (r.stripeId || !r.counted) continue;
    const key = [r.type, r.date, r.cents, (r.party || r.description).trim().toLowerCase()].join('|');
    groups.set(key, [...(groups.get(key) || []), r]);
  }
  return [...groups.values()].filter(g => g.length > 1).flat();
}

export function packChecks(payments: PackPayment[], rows: PackTransaction[], period: PackPeriod, currency: string): PackCheck[] {
  const sum = (list: PackTransaction[]) => list.reduce((n, r) => n + r.cents, 0);
  const counted = rows.filter(r => r.counted);
  // Not in the records yet: dated by when they arrived, since they have no paid date
  const waiting = payments.filter(p => p.status === 'awaiting_review' && within(siteDay(p.created_at), period));
  const waitingRows = waiting.map(p => ({
    ...packTransactions([{ ...p, status: 'paid', paid_at: p.created_at }], [], period)[0],
    status: PAYMENT_STATUS_LABEL.awaiting_review,
    counted: false,
  }));
  const inClubCurrency = counted.filter(r => r.currency === currency);
  const checks: Omit<PackCheck, 'cents'>[] = [
    { key: 'expense_no_receipt', title: 'Expenses with no receipt', why: 'Nothing on file shows what the money was spent on.', rows: inClubCurrency.filter(r => r.type === 'Expense' && !r.hasReceipt) },
    { key: 'cash_no_receipt', title: 'Cash income with no receipt', why: 'Cash leaves no bank or card record, so this is the only evidence of it.', rows: inClubCurrency.filter(r => r.type === 'Income' && r.method === PAYMENT_METHOD_LABEL.cash && !r.hasReceipt) },
    { key: 'waiting', title: 'Bank transfers still waiting to be checked', why: 'They aren\'t counted as income until someone checks them against the bank.', rows: waitingRows },
    { key: 'entered_late', title: 'Records entered after the period ended', why: 'They change figures that may already have been reported.', rows: inClubCurrency.filter(r => r.entered > period.to) },
    { key: 'duplicates', title: 'Possible duplicates', why: 'The same day, amount and name more than once. They may be genuine.', rows: possibleDuplicates(inClubCurrency) },
  ];
  const foreign = counted.filter(r => r.currency !== currency);
  return [
    ...checks.map(c => ({ ...c, cents: sum(c.rows) })),
    { key: 'other_currency', title: `Records not in ${currency}`, why: 'The totals add these in at face value, without converting them.', rows: foreign, cents: null },
  ];
}

// ------------------------------------------------------------------------------------------------
// Invoices
// ------------------------------------------------------------------------------------------------
/** Invoices raised in the period, in number order */
export function packInvoices(payments: PackPayment[], period: PackPeriod): PackPayment[] {
  return payments
    .filter(p => p.invoice_number != null && within(siteDay(p.created_at), period))
    .sort((a, b) => a.invoice_number! - b.invoice_number!);
}

/**
 * Numbers missing from the club's whole sequence, whatever year they fell in: each club's numbers run from
 * 1 with no gaps (assign_invoice_number, migration 20261135), so a missing one means an invoice was deleted.
 */
export function missingInvoiceNumbers(payments: PackPayment[]): number[] {
  const used = new Set(payments.map(p => p.invoice_number).filter((n): n is number => n != null));
  const highest = Math.max(0, ...used);
  return Array.from({ length: highest }, (_, i) => i + 1).filter(n => !used.has(n));
}

// ------------------------------------------------------------------------------------------------
// Activity log
// ------------------------------------------------------------------------------------------------
export function logInPeriod(rows: AuditLogRow[], period: PackPeriod): AuditLogRow[] {
  return rows.filter(r => within(siteDay(r.created_at), period)).sort((a, b) => a.created_at.localeCompare(b.created_at));
}

// ------------------------------------------------------------------------------------------------
// CSV rows, for toCsv in lib/finance.ts
// ------------------------------------------------------------------------------------------------
type CsvRow = (string | number | null | undefined)[];
const amount = (cents: number) => (cents / 100).toFixed(2);
const signed = (cents: number) => (cents < 0 ? `(${amount(-cents)})` : amount(cents));

export function statementCsv(s: PackStatement, period: PackPeriod, previous: PackPeriod | null): CsvRow[] {
  const head: CsvRow = ['Section', 'Category', 'Records', period.label, ...(previous ? [previous.label] : [])];
  const row = (section: string, name: string, count: number | string, cents: number, previousCents: number): CsvRow =>
    [section, name, count, amount(cents), ...(previous ? [amount(previousCents)] : [])];
  const { money } = s;
  return [
    head,
    ...money.income.map(l => row('Income', l.label, s.incomeCounts[l.key] || 0, l.cents, l.previousCents)),
    row('Income', 'Total income', '', money.totalIncome, money.previousIncome),
    ...money.expenses.map(l => row('Expenses', l.label, s.expenseCounts[l.key] || 0, l.cents, l.previousCents)),
    row('Expenses', 'Total expenses', '', money.totalExpenses, money.previousExpenses),
    // Brackets, not a minus: spreadsheets read both as negative, but toCsv quotes a leading minus
    ['Result', 'Surplus (deficit)', '', signed(money.surplus), ...(previous ? [signed(money.previousSurplus)] : [])],
  ];
}

export function transactionsCsv(rows: PackTransaction[], actorName: (id: string) => string): CsvRow[] {
  return [
    ['Date', 'Type', 'Category', 'Description', 'Paid by or to', 'Method', 'Status', 'Counted in totals', 'Amount', 'Currency', 'Invoice number', 'Reference', 'Stripe payment', 'Receipt on file', 'Checked or entered by', 'Date entered', 'Record ID'],
    ...rows.map(r => [r.date, r.type, r.category, r.description, r.party, r.method, r.status, r.counted ? 'Yes' : 'No', amount(r.cents), r.currency,
      r.invoiceNumber, r.reference, r.stripeId, r.hasReceipt ? 'Yes' : 'No', r.actorId ? actorName(r.actorId) : '', r.entered, r.id]),
  ];
}

export function checksCsv(checks: PackCheck[]): CsvRow[] {
  return [
    ['Check', 'Date', 'Type', 'Category', 'Description', 'Paid by or to', 'Amount', 'Currency', 'Record ID'],
    ...checks.flatMap(c => c.rows.map(r => [c.title, r.date, r.type, r.category, r.description, r.party, amount(r.cents), r.currency, r.id])),
  ];
}

export function invoicesCsv(invoices: PackPayment[], missing: number[]): CsvRow[] {
  return [
    ['Invoice number', 'Date raised', 'Paid on', 'Payer', 'Description', 'Status', 'Amount', 'Currency', 'Record ID'],
    ...invoices.map(p => [p.invoice_number, siteDay(p.created_at), p.status === 'paid' || p.status === 'refunded' ? paymentDay(p) : '', p.payer_name, p.description,
      PAYMENT_STATUS_LABEL[p.status] || p.status, amount(p.amount_cents), p.currency, p.id]),
    ...missing.map(n => [n, '', '', '', 'Missing from the sequence', '', '', '', '']),
  ];
}

export function auditLogCsv(rows: AuditLogRow[]): CsvRow[] {
  return [
    ['When (UTC)', 'Who', 'Action', 'Table', 'Summary', 'Details', 'Record ID'],
    ...rows.map(r => [r.created_at, r.actor_email, r.action, r.target_table, r.summary, JSON.stringify(r.details ?? {}), r.target_id]),
  ];
}
