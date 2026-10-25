// Club finance: shared labels and formatting (client + server). Category keys match the CHECK
// constraints in supabase/migrations/20261010_finance.sql.

import { DATE_LOCALE } from './dates';

export const INCOME_CATEGORIES: Record<string, string> = {
  membership: 'Membership fees',
  sponsorship: 'Sponsorship',
  match_fees: 'Match fees / subs',
  registration_fees: 'Registration fees',
  merchandise: 'Merchandise & kit sales',
  events_tickets: 'Events & tickets',
  fundraising: 'Fundraising & raffles',
  donations: 'Donations',
  grants: 'Grants & council funding',
  bar_canteen: 'Bar & canteen',
  facility_hire: 'Facility hire income',
  prize_money: 'Prize money',
  other: 'Other income',
};

export const EXPENSE_CATEGORIES: Record<string, string> = {
  facility_hire: 'Pitch & facility hire',
  referees: 'Referees & officials',
  league_fees: 'League & affiliation fees',
  insurance: 'Insurance',
  kit_equipment: 'Kit & equipment',
  medical: 'Medical & first aid',
  travel: 'Travel & transport',
  coaching: 'Coaching & courses',
  events: 'Events & awards',
  catering: 'Catering',
  marketing: 'Marketing & printing',
  software: 'Website & software',
  bank_fees: 'Bank & Stripe fees',
  utilities: 'Utilities',
  maintenance: 'Maintenance',
  player_welfare: 'Player welfare',
  reimbursements: 'Reimbursements',
  other: 'Other',
};

export const PAYMENT_KIND_LABEL: Record<string, string> = {
  membership_signup: 'Membership (new)',
  membership_renewal: 'Membership renewal',
  sponsorship: 'Sponsorship',
  shop_order: 'Shop order',
  event_ticket: 'Event tickets',
  income_other: 'Other income',
};

export const PAYMENT_METHOD_LABEL: Record<string, string> = {
  stripe: 'Card (Stripe)',
  bank_transfer: 'Bank transfer',
  cash: 'Cash',
  card: 'Card',
  other: 'Other',
};

export const CURRENCIES = ['AUD', 'NZD', 'GBP', 'EUR', 'USD', 'CAD', 'NPR', 'INR', 'ZAR', 'SGD'];

// Booking fee: added on top of card payments and routed to the platform by Stripe Connect, so the club
// still receives its full price. NEXT_PUBLIC_ so the payment screen shows exactly what the server charges.
// fee = max(price x percent + flat, minimum); all unset or 0 = no fee.
const feeSetting = (v: string | undefined) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
};
export const BOOKING_FEE = {
  percent: feeSetting(process.env.NEXT_PUBLIC_BOOKING_FEE_PERCENT),
  flatCents: Math.round(feeSetting(process.env.NEXT_PUBLIC_BOOKING_FEE_FLAT_CENTS)),
  minCents: Math.round(feeSetting(process.env.NEXT_PUBLIC_BOOKING_FEE_MIN_CENTS)),
};

export function bookingFeeCents(amountCents: number, fee = BOOKING_FEE): number {
  if (!(amountCents > 0)) return 0;
  return Math.max(Math.round((amountCents * fee.percent) / 100) + fee.flatCents, fee.minCents);
}

/** The fee in words, for llms.txt, pricing.md and the FAQ: "1.5% of the payment (minimum 0.30 in the payment's currency)" */
export function bookingFeeText(fee = BOOKING_FEE): string {
  const amount = (cents: number) => (cents / 100).toFixed(2);
  const parts = [fee.percent && `${fee.percent}% of the payment`, fee.flatCents && amount(fee.flatCents)].filter(Boolean);
  if (!parts.length) return fee.minCents ? `${amount(fee.minCents)} per payment (in the payment's currency)` : 'no booking fee';
  const min = fee.minCents ? `minimum ${amount(fee.minCents)} ` : '';
  return `${parts.join(' + ')}${fee.flatCents || fee.minCents ? ` (${min}in the payment's currency)` : ''}`;
}

export function formatMoney(cents: number, currency: string): string {
  try {
    // A fixed locale, not the runtime's: the server (en-US: "A$15.00") and an Australian browser
    // ("$15.00") disagreed, which broke hydration on the events page and app home
    return new Intl.NumberFormat(DATE_LOCALE, { style: 'currency', currency }).format(cents / 100);
  } catch {
    return `${currency} ${(cents / 100).toFixed(2)}`;
  }
}

/** "12.50" -> 1250; null for anything that isn't a non-negative amount */
export function parseMoneyToCents(input: string): number | null {
  const clean = input.replace(/[,\s]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return null;
  return Math.round(parseFloat(clean) * 100);
}

/** Short code payers put on their bank transfer so the treasurer can match it */
export function paymentReference(id: string): string {
  return id.replace(/-/g, '').slice(0, 8).toUpperCase();
}

/** RFC 4180 CSV (quotes doubled, fields with commas/quotes/newlines wrapped) */
export function toCsv(rows: (string | number | null | undefined)[][]): string {
  return rows
    .map(row =>
      row
        .map(v => {
          let s = v == null ? '' : String(v);
          // Keep spreadsheet apps from running a payer-supplied value as a formula
          if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
          return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(',')
    )
    .join('\r\n');
}

// ------------------------------------------------------------------------------------------------
// Membership terms. Same rule as membership_term_end() in supabase/migrations/20261025_membership_renewal.sql
// ------------------------------------------------------------------------------------------------
export type RenewalMode = 'anniversary' | 'fiscal';

export interface RenewalRule {
  membership_renewal?: RenewalMode | null;
  /** 1-12; the fiscal year starts on the 1st of this month */
  fiscal_year_start_month?: number | null;
  /** Fiscal year: joining this many days (or fewer) before it starts counts for the next year */
  fiscal_grace_days?: number | null;
}

export const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const pad = (n: number) => String(n).padStart(2, '0');

/** Today as YYYY-MM-DD in local time */
export function todayIso(now = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/**
 * When a membership starting (or renewed) on `from` (YYYY-MM-DD) runs out.
 * Year to year: `months` later (1 Aug 2025 -> 1 Aug 2026; 29 Feb -> 28 Feb, as Postgres does).
 * Fiscal year: the next fiscal year start after `from` (July year: 1 Aug 2025 -> 1 Jul 2026), or the
 * one after that when `from` is within the grace period before it (30 days: 15 Jun 2026 -> 1 Jul 2027).
 */
export function membershipTermEnd(from: string, rule: RenewalRule | null | undefined, months = 12): string {
  const [y, m, d] = from.slice(0, 10).split('-').map(Number);
  if (rule?.membership_renewal === 'fiscal') {
    const start = rule.fiscal_year_start_month || 7;
    const nextYear = m >= start ? y + 1 : y;
    const daysBefore = (Date.UTC(nextYear, start - 1, 1) - Date.UTC(y, m - 1, d)) / 86400000;
    return `${daysBefore <= (rule.fiscal_grace_days || 0) ? nextYear + 1 : nextYear}-${pad(start)}-01`;
  }
  const total = m - 1 + months;
  const year = y + Math.floor(total / 12);
  const month = (total % 12) + 1;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${pad(month)}-${pad(Math.min(d, lastDay))}`;
}

// ------------------------------------------------------------------------------------------------
// Membership payment & approval policy (configured by admins)
// ------------------------------------------------------------------------------------------------
export type MembershipPaymentPolicy =
  | 'require_payment'
  | 'allow_waiver'
  | 'auto_approve'
  | 'auto_approve_with_waiver';

export const DEFAULT_MEMBERSHIP_PAYMENT_POLICY: MembershipPaymentPolicy = 'require_payment';

export interface PaymentPolicyMeta {
  id: MembershipPaymentPolicy;
  title: string;
  shortLabel: string;
  badge: string;
  description: string;
}

export const MEMBERSHIP_PAYMENT_POLICIES: PaymentPolicyMeta[] = [
  {
    id: 'require_payment',
    title: '1. Require Payment Before Approval (Default)',
    shortLabel: 'Payment Required',
    badge: 'Strict',
    description: 'Members must pay their membership fee before committee approval can be finalized. Unpaid applications cannot be approved directly. Free tiers ($0) are unaffected.',
  },
  {
    id: 'allow_waiver',
    title: '2. Allow Fee Waiver',
    shortLabel: 'Fee Waiver Allowed',
    badge: 'Discretionary',
    description: 'Payment is required by default, but club admins can waive the fee for scholarships, hardship, or life members with a recorded reason.',
  },
  {
    id: 'auto_approve',
    title: '3. Auto-Approve on Payment',
    shortLabel: 'Auto-Approve on Payment',
    badge: 'Automated',
    description: 'Members are automatically approved and digital passes activated immediately as soon as their payment is confirmed. Unpaid applications remain pending.',
  },
  {
    id: 'auto_approve_with_waiver',
    title: 'Auto-Approve on Payment + Allow Fee Waiver',
    shortLabel: 'Auto-Approve & Waiver',
    badge: 'Automated + Waiver',
    description: 'Auto-approves upon confirmed payment, and allows admins to manually waive fees for exceptional cases.',
  },
];

export function policyAllowsWaiver(policy?: MembershipPaymentPolicy | null): boolean {
  return policy === 'allow_waiver' || policy === 'auto_approve_with_waiver';
}

export function policyAutoApprovesOnPayment(policy?: MembershipPaymentPolicy | null): boolean {
  return policy === 'auto_approve' || policy === 'auto_approve_with_waiver';
}

