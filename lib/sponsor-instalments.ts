// A sponsorship paid in instalments: ordinary sponsorship invoices sharing an instalment_plan_id. Pure,
// so it can be checked without a browser (lib/sponsor-instalments.check.ts). What a payment does to the
// sponsor is decided in the database (fulfil_payment, migration 20261153).
import { INVOICE_DUE_DAYS } from './sponsors';

export const MIN_INSTALMENTS = 2;
export const MAX_INSTALMENTS = 12;
// Stripe refuses very small charges
const MIN_INSTALMENT_CENTS = 100;
const MAX_PLAN_CENTS = 100_000_000;
/** How long after the due date a sponsor gets their one reminder */
export const OVERDUE_REMINDER_DAYS = 3;

export interface Instalment {
  amountCents: number;
  dueOn: string;
}

const pad = (n: number) => String(n).padStart(2, '0');
const DAY = 24 * 3600 * 1000;

/** `months` after a YYYY-MM-DD date, on the same day of the month or the last day of a shorter one (31 Jan -> 28 Feb) */
export function addMonths(date: string, months: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const total = m - 1 + months;
  const year = y + Math.floor(total / 12);
  const month = (total % 12) + 1;
  return `${year}-${pad(month)}-${pad(Math.min(d, new Date(Date.UTC(year, month, 0)).getUTCDate()))}`;
}

/** An even split: any odd cents go on the earliest instalments, and it always adds up to the total */
export function buildSchedule(totalCents: number, count: number, firstDue: string, everyMonths: number): Instalment[] {
  const each = Math.floor(totalCents / count);
  const extra = totalCents - each * count;
  return Array.from({ length: count }, (_, i) => ({
    amountCents: each + (i < extra ? 1 : 0),
    dueOn: addMonths(firstDue, i * everyMonths),
  }));
}

/** The schedule an admin sent, checked at the server. Dates must run in order, with none already past. */
export function parseSchedule(input: unknown, today: string): { ok: true; value: Instalment[] } | { ok: false; error: string } {
  if (!Array.isArray(input) || input.length < MIN_INSTALMENTS || input.length > MAX_INSTALMENTS) {
    return { ok: false, error: `Choose between ${MIN_INSTALMENTS} and ${MAX_INSTALMENTS} instalments.` };
  }
  const value: Instalment[] = [];
  for (const row of input as { amountCents?: unknown; dueOn?: unknown }[]) {
    const amountCents = Number(row?.amountCents);
    const dueOn = typeof row?.dueOn === 'string' ? row.dueOn : '';
    if (!Number.isInteger(amountCents) || amountCents < MIN_INSTALMENT_CENTS) return { ok: false, error: 'Each instalment must be at least 1.00.' };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueOn) || Number.isNaN(Date.parse(dueOn))) return { ok: false, error: 'Each instalment needs a due date.' };
    if (dueOn < today) return { ok: false, error: 'A due date has already passed.' };
    const previous = value[value.length - 1];
    if (previous && dueOn <= previous.dueOn) return { ok: false, error: 'Each due date must be after the one before.' };
    value.push({ amountCents, dueOn });
  }
  if (value.reduce((n, r) => n + r.amountCents, 0) > MAX_PLAN_CENTS) return { ok: false, error: 'That total is too large.' };
  return { ok: true, value };
}

/** "Instalment 2 of 3", or null for a payment that isn't one */
export function instalmentLabel(p: { instalment_no?: number | null; instalment_of?: number | null }): string | null {
  return p.instalment_no && p.instalment_of ? `Instalment ${p.instalment_no} of ${p.instalment_of}` : null;
}

export interface PlanRow {
  id: string;
  sponsor_id?: string | null;
  instalment_plan_id?: string | null;
  instalment_no?: number | null;
  instalment_of?: number | null;
  status: string;
  amount_cents: number;
  currency: string;
  due_on?: string | null;
}

export interface PlanSummary {
  planId: string;
  rows: PlanRow[];
  paidCount: number;
  paidCents: number;
  /** Not paid yet, counting a receipt the club is still checking */
  leftCents: number;
  /** The next instalment nobody has paid or sent a receipt for */
  next: PlanRow | null;
  overdue: boolean;
  /** Something still to come, so the plan can be cancelled and the sponsor can't start another */
  open: boolean;
}

/** A sponsor's most recent plan with anything paid or owing, from their sponsorship payments */
export function planSummary(rows: PlanRow[], today: string): PlanSummary | null {
  const inPlan = rows.filter(r => r.instalment_plan_id && ['paid', 'pending', 'awaiting_review'].includes(r.status));
  const open = inPlan.filter(r => r.status !== 'paid');
  const planId = (open[0] ?? inPlan[0])?.instalment_plan_id;
  if (!planId) return null;
  const mine = inPlan.filter(r => r.instalment_plan_id === planId).sort((a, b) => (a.instalment_no || 0) - (b.instalment_no || 0));
  const paid = mine.filter(r => r.status === 'paid');
  const next = mine.find(r => r.status === 'pending') ?? null;
  return {
    planId,
    rows: mine,
    paidCount: paid.length,
    paidCents: paid.reduce((n, r) => n + r.amount_cents, 0),
    leftCents: mine.filter(r => r.status !== 'paid').reduce((n, r) => n + r.amount_cents, 0),
    next,
    overdue: !!next?.due_on && next.due_on < today,
    open: mine.some(r => r.status !== 'paid'),
  };
}

const daysBetween = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / DAY);

/** An instalment's invoice goes out once it's within the usual time to pay an invoice of its due date */
export const invoiceIsDue = (dueOn: string, today: string) => daysBetween(today, dueOn) <= INVOICE_DUE_DAYS;

/** It's far enough past its due date for the one reminder */
export const reminderIsDue = (dueOn: string, today: string) => daysBetween(dueOn, today) >= OVERDUE_REMINDER_DAYS;
