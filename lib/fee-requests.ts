// Fee requests: the club asks a group of people for money (match fees, tour deposits, kit).
// Each person is one 'fee_request' row in payments, sharing a request_id. Pure, so it can be
// checked without a browser (lib/fee-requests.check.ts).
import { looksLikeEmail, memberRecipient, type MemberRecipient } from './email/recipient';
import { INCOME_CATEGORIES } from './finance';
import { isUuid } from './ids';
import type { Payment } from './supabase/types';

export const MAX_FEE_RECIPIENTS = 500;
// Stripe refuses very small charges, and over this is a typo or an invoice
const MIN_FEE_CENTS = 100;
const MAX_FEE_CENTS = 1000000;

/** Membership and sponsorship have their own payments, which also move expiry dates */
export const FEE_CATEGORIES: Record<string, string> = Object.fromEntries(
  Object.entries(INCOME_CATEGORIES).filter(([k]) => k !== 'membership' && k !== 'sponsorship')
);

export interface FeeRequestInput {
  title: string;
  amountCents: number;
  dueOn: string;
  category: string;
  message: string | null;
  memberIds: string[];
}

export function parseFeeRequest(body: unknown, today: string): { ok: true; value: FeeRequestInput } | { ok: false; error: string } {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const title = typeof b.title === 'string' ? b.title.replace(/[<>]/g, '').trim() : '';
  if (!title || title.length > 120) return { ok: false, error: 'Give it a name of up to 120 characters.' };
  const amountCents = Number(b.amountCents);
  if (!Number.isInteger(amountCents) || amountCents < MIN_FEE_CENTS || amountCents > MAX_FEE_CENTS) {
    return { ok: false, error: 'Enter an amount between 1.00 and 10,000.00.' };
  }
  const dueOn = typeof b.dueOn === 'string' ? b.dueOn : '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueOn) || Number.isNaN(Date.parse(dueOn))) return { ok: false, error: 'Choose a due date.' };
  if (dueOn < today) return { ok: false, error: 'The due date has already passed.' };
  const category = typeof b.category === 'string' && FEE_CATEGORIES[b.category] ? b.category : null;
  if (!category) return { ok: false, error: 'Choose a category.' };
  const memberIds = Array.isArray(b.memberIds) ? [...new Set(b.memberIds)].filter(isUuid) : [];
  if (!memberIds.length) return { ok: false, error: 'Choose who this is for.' };
  if (memberIds.length > MAX_FEE_RECIPIENTS) return { ok: false, error: `That's more than ${MAX_FEE_RECIPIENTS} people. Split it into smaller groups.` };
  const message = typeof b.message === 'string' ? b.message.replace(/[<>]/g, '').trim().slice(0, 1000) : '';
  return { ok: true, value: { title, amountCents, dueOn, category, message: message || null, memberIds } };
}

export interface FeeRequestGroup {
  id: string;
  title: string;
  dueOn: string;
  amountCents: number;
  currency: string;
  createdAt: string;
  rows: Payment[];
  paidCount: number;
  paidCents: number;
  /** Still owed, not counting receipts waiting to be checked */
  unpaidCount: number;
  unpaidCents: number;
  toCheckCount: number;
  excusedCount: number;
  overdue: boolean;
}

/** Groups the ledger's fee requests: anything with money still to come first, then newest */
export function feeRequestGroups(payments: Payment[], today: string): FeeRequestGroup[] {
  const byId = new Map<string, Payment[]>();
  for (const p of payments) {
    if (p.kind !== 'fee_request' || !p.request_id) continue;
    byId.set(p.request_id, [...(byId.get(p.request_id) || []), p]);
  }
  const groups = [...byId].map(([id, rows]): FeeRequestGroup => {
    const of = (status: string) => rows.filter(r => r.status === status);
    const sum = (list: Payment[]) => list.reduce((n, r) => n + r.amount_cents, 0);
    const dueOn = rows[0].due_on || '';
    return {
      id,
      title: rows[0].request_title || rows[0].description || 'Fee',
      dueOn,
      amountCents: rows[0].amount_cents,
      currency: rows[0].currency,
      createdAt: rows[0].created_at,
      rows,
      paidCount: of('paid').length,
      paidCents: sum(of('paid')),
      unpaidCount: of('pending').length,
      unpaidCents: sum(of('pending')),
      toCheckCount: of('awaiting_review').length,
      excusedCount: of('rejected').length,
      overdue: of('pending').length > 0 && !!dueOn && dueOn < today,
    };
  });
  const open = (g: FeeRequestGroup) => g.unpaidCount + g.toCheckCount > 0;
  return groups.sort((a, b) => Number(open(b)) - Number(open(a)) || b.createdAt.localeCompare(a.createdAt));
}

/** Search box match: every word typed appears in one of the fields, ignoring case */
export function matchesSearch(query: string, ...fields: (string | null | undefined)[]): boolean {
  const haystack = fields.filter(Boolean).join(' ').toLowerCase();
  return query.toLowerCase().split(/\s+/).filter(Boolean).every(word => haystack.includes(word));
}

/** Unpaid or excused fee rows live on the Fee requests tab: they aren't income, so they stay out of Income and its export */
export function isLedgerRow(p: Pick<Payment, 'kind' | 'status'>): boolean {
  return p.kind !== 'fee_request' || !['pending', 'rejected'].includes(p.status);
}

/** A slip of the finger can be undone, but never a card payment or a transfer someone checked */
export function canReopenFee(p: Pick<Payment, 'kind' | 'status' | 'method'>): boolean {
  if (p.kind !== 'fee_request') return false;
  return p.status === 'rejected' || (p.status === 'paid' && p.method === 'cash');
}

/** Who a bill email goes to now (their squad entry may have a newer address), else who it was addressed to */
export function billRecipient(row: {
  payer_name?: string | null;
  payer_email?: string | null;
  member?: { full_name: string; email?: string | null; guardian_name?: string | null; guardian_email?: string | null } | null;
}): MemberRecipient | null {
  if (row.member) return memberRecipient(row.member);
  return looksLikeEmail(row.payer_email) ? { to: row.payer_email.trim(), name: row.payer_name || '' } : null;
}
