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

/** Still to be paid back: the treasurer hasn't turned it down or paid it yet */
export const isOpenClaim = (c: { status: string }) => c.status === 'submitted' || c.status === 'approved';

const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/[<>]/g, '').trim().slice(0, max) : '');

/** Bank details are optional but all-or-nothing. Saved as lines of text, which are erased once the claim is settled. */
function parsePayout(get: (key: string) => unknown): { ok: true; value: string | null } | { ok: false; error: string } {
  const line = (key: string) => clean(get(key), 100).replace(/\s+/g, ' ');
  const digits = (key: string) => clean(get(key), 20).replace(/[\s-]/g, '');
  const [accountName, bankName, bsb, accountNumber] = [line('accountName'), line('bankName'), digits('bsb'), digits('accountNumber')];
  if (!accountName && !bankName && !bsb && !accountNumber) return { ok: true, value: null };
  if (!accountName || !bankName || !bsb || !accountNumber) return { ok: false, error: 'Fill in the account name, bank name, BSB and account number, or leave all four blank.' };
  if (!/^\d{6}$/.test(bsb)) return { ok: false, error: 'A BSB is 6 digits.' };
  if (!/^\d{5,10}$/.test(accountNumber)) return { ok: false, error: 'An account number is 5 to 10 digits.' };
  return { ok: true, value: `${accountName}\n${bankName}\nBSB: ${bsb.slice(0, 3)}-${bsb.slice(3)}\nAccount number: ${accountNumber}` };
}

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
  const payout = parsePayout(get);
  if (!payout.ok) return payout;
  return {
    ok: true,
    value: { category, description, vendor: clean(get('vendor'), 255) || null, amountCents, spentOn, payoutDetails: payout.value },
  };
}

/** Only a current member of the club can claim from it: not a pending applicant, ex-player or suspended member */
export function canClaim(member: { membership_status?: string | null; status?: string | null } | null | undefined): boolean {
  if (!member) return false;
  return (member.membership_status || 'approved') === 'approved' && member.status !== 'alumni' && member.status !== 'suspended';
}
