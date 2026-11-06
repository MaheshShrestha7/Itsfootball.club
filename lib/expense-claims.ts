// Expense claims: a member asks the club for money back. Checked by lib/expense-claims.check.ts.
import { EXPENSE_CATEGORIES, parseMoneyToCents } from './finance';

const MAX_CLAIM_CENTS = 1000000;

export const CLAIM_STATUS_LABEL: Record<string, string> = {
  submitted: 'Waiting for the treasurer',
  approved: 'Approved, payment on its way',
  paid: 'Paid',
  rejected: 'Not approved',
};

export interface ClaimInput {
  category: string;
  description: string;
  vendor: string | null;
  amountCents: number;
  spentOn: string;
  payoutDetails: string | null;
}

const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/[<>]/g, '').trim().slice(0, max) : '');

/** `get` reads a form field. `today` is the site's date: a receipt can't be from the future. */
export function parseClaim(get: (key: string) => unknown, today: string): { ok: true; value: ClaimInput } | { ok: false; error: string } {
  const description = clean(get('description'), 300);
  if (!description) return { ok: false, error: 'Say what the money was spent on.' };
  const amountCents = parseMoneyToCents(clean(get('amount'), 20));
  if (amountCents === null || amountCents <= 0 || amountCents > MAX_CLAIM_CENTS) return { ok: false, error: 'Enter an amount between 0.01 and 10,000.00.' };
  const category = clean(get('category'), 48);
  if (!EXPENSE_CATEGORIES[category]) return { ok: false, error: 'Choose a category.' };
  const spentOn = clean(get('spentOn'), 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(spentOn) || Number.isNaN(Date.parse(spentOn))) return { ok: false, error: 'Enter the date on the receipt.' };
  if (spentOn > today) return { ok: false, error: 'The receipt date is in the future.' };
  return {
    ok: true,
    value: { category, description, vendor: clean(get('vendor'), 255) || null, amountCents, spentOn, payoutDetails: clean(get('payoutDetails'), 300) || null },
  };
}

/** Only a current member of the club can claim from it: not a pending applicant, ex-player or suspended member */
export function canClaim(member: { membership_status?: string | null; status?: string | null } | null | undefined): boolean {
  if (!member) return false;
  return (member.membership_status || 'approved') === 'approved' && member.status !== 'alumni' && member.status !== 'suspended';
}
