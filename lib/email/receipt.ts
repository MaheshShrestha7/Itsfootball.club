// AUTO-4: a receipt for a member's payment once it's in: a card payment (Stripe webhook), or a bank
// transfer the treasurer checked (Finance -> Verify, People -> Applications, Fee requests -> Paid by bank).
// Ticket orders and sponsorships have their own emails (tickets.ts, sponsor-paid.ts).
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Payment } from '@/lib/supabase/types';
import { formatMoney } from '@/lib/finance';
import { clubTimeZone } from '@/lib/dates';
import { CLUB_BRAND_COLUMNS, clubBaseUrl, clubBrand, type ClubBrandRow } from './club-brand';
import { looksLikeEmail, sendClubEmails } from './club-emails';
import { paymentReceipt } from './templates';

export const RECEIPT_KINDS = ['membership_signup', 'membership_renewal', 'fee_request', 'shop_order'] as const;

/** Card or checked bank transfer only: cash and other offline money was handed over in person */
export function receiptMethod(pay: Pick<Payment, 'kind' | 'status' | 'method'>): 'card' | 'bank' | null {
  if (pay.status !== 'paid' || !(RECEIPT_KINDS as readonly string[]).includes(pay.kind)) return null;
  return pay.method === 'stripe' ? 'card' : pay.method === 'bank_transfer' ? 'bank' : null;
}

/** Sends the receipt once per payment (email_log), whoever calls it how often. Never throws. */
export async function emailReceipt(db: SupabaseClient, pay: Payment): Promise<boolean> {
  try {
    const method = receiptMethod(pay);
    if (!method || !looksLikeEmail(pay.payer_email)) return false;
    const { data } = await db.from('clubs').select(`${CLUB_BRAND_COLUMNS}, contact_email`).eq('id', pay.club_id).maybeSingle();
    if (!data) return false;
    const club = data as ClubBrandRow & { contact_email?: string | null };
    const replyTo = looksLikeEmail(club.contact_email) ? club.contact_email.trim() : undefined;
    const paidOn = new Intl.DateTimeFormat('en-AU', { timeZone: clubTimeZone(club), weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
      .format(new Date(pay.paid_at || Date.now()));
    // A receipt goes out whatever the payer's email opt-out says: it's about their money, not news
    const report = await sendClubEmails(db, [{
      key: `receipt:${pay.id}`, clubId: club.id, kind: 'receipt', refId: pay.id, to: pay.payer_email.trim(), fromName: club.name, replyTo,
      email: paymentReceipt({
        brand: clubBrand(club),
        payerName: pay.payer_name || '',
        what: pay.request_title || pay.description || 'Club payment',
        price: formatMoney(pay.amount_cents, pay.currency),
        paidOn,
        method,
        reference: pay.id.slice(0, 8).toUpperCase(),
        link: clubBaseUrl(club),
        canReply: !!replyTo,
      }),
    }]);
    if (report.error) console.error('[receipt] email failed:', pay.id, report.error);
    return report.sent > 0 || report.alreadySent > 0;
  } catch (err) {
    console.error('[receipt] email failed:', pay.id, err);
    return false;
  }
}
