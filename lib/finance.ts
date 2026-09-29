// Club finance: shared labels and formatting (client + server). Category keys match the CHECK
// constraints in supabase/migrations/20261010_finance.sql.

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

export function formatMoney(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(cents / 100);
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
