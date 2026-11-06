// The treasurer's report for a club's AGM: the season's money set against the season before, what's
// owed both ways, and the season in numbers. Pure, so the totals can be checked without a browser
// (lib/agm-report.check.ts). Money follows the Finance page's own rules, so the two always agree:
// income is what's marked paid, in the season it was paid (the page passes payments through
// paymentSeason in lib/finance.ts first); expenses are everything filed under the season.
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from './finance';

export interface AgmPayment {
  id: string;
  kind: string;
  category: string;
  status: string;
  method: string;
  amount_cents: number;
  season?: string | null;
  due_on?: string | null;
  sponsor_id?: string | null;
  payer_name?: string | null;
}

export interface AgmExpense {
  category: string;
  amount_cents: number;
  season?: string | null;
  paid_by_member_id?: string | null;
  reimbursed: boolean;
}

export interface SeasonOption {
  name: string;
  start_date?: string;
  end_date?: string;
}

/** Every season with anything to report, newest first: the club's own seasons, then any label only the ledger uses */
export function seasonOptions(
  seasons: { name: string; start_date?: string; end_date?: string }[],
  rows: { season?: string | null }[]
): SeasonOption[] {
  const byName = new Map<string, SeasonOption>();
  for (const s of seasons) if (s.name?.trim()) byName.set(s.name.trim(), { name: s.name.trim(), start_date: s.start_date, end_date: s.end_date });
  for (const r of rows) {
    const name = r.season?.trim();
    if (name && !byName.has(name)) byName.set(name, { name });
  }
  // Labels like "2026/27" and "2026" sort by their year; a dated season uses its real start
  const order = (s: SeasonOption) => s.start_date || s.name;
  return [...byName.values()].sort((a, b) => order(b).localeCompare(order(a)));
}

export interface MoneyLine {
  key: string;
  label: string;
  cents: number;
  previousCents: number;
}

export interface AgmMoney {
  income: MoneyLine[];
  expenses: MoneyLine[];
  totalIncome: number;
  totalExpenses: number;
  surplus: number;
  previousIncome: number;
  previousExpenses: number;
  previousSurplus: number;
  /** Something was paid by card, so Stripe's processing fees apply */
  anyCard: boolean;
  /** Paid payments or expenses with no season: in no season's totals, so the report says so */
  unfiledCents: number;
  refundedCents: number;
}

/** Category lines, biggest first, including any only the previous season had */
function lines<T extends { category: string; amount_cents: number; season?: string | null }>(
  rows: T[], season: string, previous: string | null, labels: Record<string, string>
): MoneyLine[] {
  const out = new Map<string, MoneyLine>();
  const line = (key: string) => {
    if (!out.has(key)) out.set(key, { key, label: labels[key] || key, cents: 0, previousCents: 0 });
    return out.get(key)!;
  };
  for (const r of rows) {
    if (r.season === season) line(r.category).cents += r.amount_cents;
    else if (previous && r.season === previous) line(r.category).previousCents += r.amount_cents;
  }
  return [...out.values()].sort((a, b) => b.cents - a.cents || b.previousCents - a.previousCents || a.label.localeCompare(b.label));
}

const sum = (rows: { amount_cents: number }[]) => rows.reduce((n, r) => n + r.amount_cents, 0);

export function agmMoney(payments: AgmPayment[], expenses: AgmExpense[], season: string, previous: string | null): AgmMoney {
  const paid = payments.filter(p => p.status === 'paid');
  const income = lines(paid, season, previous, INCOME_CATEGORIES);
  const spent = lines(expenses, season, previous, EXPENSE_CATEGORIES);
  const total = (list: MoneyLine[], field: 'cents' | 'previousCents') => list.reduce((n, l) => n + l[field], 0);
  const totalIncome = total(income, 'cents');
  const totalExpenses = total(spent, 'cents');
  const previousIncome = total(income, 'previousCents');
  const previousExpenses = total(spent, 'previousCents');
  return {
    income,
    expenses: spent,
    totalIncome,
    totalExpenses,
    surplus: totalIncome - totalExpenses,
    previousIncome,
    previousExpenses,
    previousSurplus: previousIncome - previousExpenses,
    anyCard: paid.some(p => p.season === season && p.method === 'stripe'),
    unfiledCents: sum(paid.filter(p => !p.season?.trim())) + sum(expenses.filter(e => !e.season?.trim())),
    refundedCents: sum(payments.filter(p => p.status === 'refunded' && p.season === season)),
  };
}

export interface AgmOwed {
  /** Invoices sent to sponsors, including instalments not yet paid */
  sponsorInvoices: { count: number; cents: number };
  /** Fee requests nobody has paid or been excused from */
  fees: { count: number; cents: number };
  /** Bank transfer receipts the treasurer hasn't checked yet */
  receipts: { count: number; cents: number };
  totalToClub: number;
  /** Expenses members paid for that haven't been paid back */
  toMembers: { count: number; cents: number };
  /** Expense claims nobody has decided yet: not in the books until approved */
  claims: { count: number; cents: number };
  totalByClub: number;
}

const tally = (rows: { amount_cents: number }[]) => ({ count: rows.length, cents: sum(rows) });

/** What's owed as at today, whatever season it started in: a debt doesn't end with the season */
export function agmOwed(payments: AgmPayment[], expenses: AgmExpense[], claims: { amount_cents: number; status: string }[]): AgmOwed {
  // A 'pending' row with no due date is an abandoned card checkout, which nobody owes
  const invoiced = payments.filter(p => p.status === 'pending' && p.due_on);
  const sponsorInvoices = tally(invoiced.filter(p => p.kind === 'sponsorship'));
  const fees = tally(invoiced.filter(p => p.kind !== 'sponsorship'));
  const receipts = tally(payments.filter(p => p.status === 'awaiting_review'));
  const toMembers = tally(expenses.filter(e => e.paid_by_member_id && !e.reimbursed));
  const undecided = tally(claims.filter(c => c.status === 'submitted'));
  return {
    sponsorInvoices,
    fees,
    receipts,
    totalToClub: sponsorInvoices.cents + fees.cents + receipts.cents,
    toMembers,
    claims: undecided,
    totalByClub: toMembers.cents + undecided.cents,
  };
}

export interface AgmSponsorLine {
  name: string;
  paidCents: number;
  owingCents: number;
}

/** What each sponsor paid in the season, and what they owe now, biggest first */
export function agmSponsors(payments: AgmPayment[], sponsors: { id: string; name: string }[], season: string): AgmSponsorLine[] {
  const names = new Map(sponsors.map(s => [s.id, s.name]));
  const out = new Map<string, AgmSponsorLine>();
  const line = (p: AgmPayment) => {
    const key = p.sponsor_id || p.id;
    if (!out.has(key)) out.set(key, { name: (p.sponsor_id && names.get(p.sponsor_id)) || p.payer_name || 'Sponsor', paidCents: 0, owingCents: 0 });
    return out.get(key)!;
  };
  for (const p of payments) {
    if (p.kind !== 'sponsorship') continue;
    if (p.status === 'paid' && p.season === season) line(p).paidCents += p.amount_cents;
    else if ((p.status === 'pending' && p.due_on) || p.status === 'awaiting_review') line(p).owingCents += p.amount_cents;
  }
  return [...out.values()].sort((a, b) => b.paidCents - a.paidCents || b.owingCents - a.owingCents || a.name.localeCompare(b.name));
}

/** The closing balance implied by the opening one the treasurer typed. Null until they type one. */
export function closingBalance(openingCents: number | null, surplus: number): number | null {
  return openingCents === null ? null : openingCents + surplus;
}

/** Members by what they joined as, biggest first, with anyone on no plan last */
export function membersByTier(members: { membership_tier?: string | null }[]): { tier: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const m of members) {
    const tier = m.membership_tier?.trim() || 'No membership type';
    counts.set(tier, (counts.get(tier) || 0) + 1);
  }
  return [...counts].map(([tier, count]) => ({ tier, count })).sort((a, b) =>
    Number(a.tier === 'No membership type') - Number(b.tier === 'No membership type') || b.count - a.count || a.tier.localeCompare(b.tier));
}
