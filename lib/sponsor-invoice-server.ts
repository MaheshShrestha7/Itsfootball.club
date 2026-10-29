import type { SupabaseClient } from '@supabase/supabase-js';
import { CLUB_BRAND_COLUMNS, clubBaseUrl, clubBrand, type ClubBrandRow } from '@/lib/email/club-brand';
import { looksLikeEmail, sendClubEmails } from '@/lib/email/club-emails';
import { sponsorInvoice } from '@/lib/email/templates';
import { formatMoney } from '@/lib/finance';
import { invoiceLabel } from '@/lib/invoice';
import { formatEndDate, holdsPackageSpot, INVOICE_DUE_DAYS, isSponsorKey, localDateISO, packageSpotsLeft } from '@/lib/sponsors';
import type { Payment } from '@/lib/supabase/types';

// Server-only helpers for sponsorship invoices sent before payment (SPP-2) and package limits (SPP-4),
// shared by the sign-up, payment, invoice and admin routes. Run with the service role.

export const PACKAGE_TAKEN = 'Sorry, that package has just been taken. Please pick another one, or contact the club.';

/** The sponsor's open invoice (sent before payment, not paid yet), or null. Null before migration
 *  20261137 too: the due_on filter then errors and nothing is found. */
export async function openSponsorInvoice(db: SupabaseClient, sponsorId: string): Promise<Payment | null> {
  const { data } = await db.from('payments').select('*')
    .eq('sponsor_id', sponsorId).eq('kind', 'sponsorship').eq('status', 'pending').not('due_on', 'is', null)
    .order('created_at', { ascending: false }).limit(1).maybeSingle();
  return (data as Payment | null) ?? null;
}

/** SPP-4: the package can't take another sponsor. `exceptSponsorId` is the one signing up or paying,
 *  who doesn't count against themselves. False when the package has no limit. */
export async function packageIsFull(
  db: SupabaseClient, clubId: string, pkg: { id: string; max_sponsors?: number | null }, exceptSponsorId?: string | null
): Promise<boolean> {
  if (!pkg.max_sponsors) return false;
  const { data: holders, error } = await db.from('sponsors')
    .select('id, is_active, package_status, created_at, ends_on, package_id')
    .eq('club_id', clubId).eq('package_id', pkg.id);
  if (error || !holders) return false;
  const { data: open } = await db.from('payments').select('sponsor_id, status, due_on')
    .in('sponsor_id', holders.map(h => h.id)).eq('kind', 'sponsorship').in('status', ['pending', 'awaiting_review']);
  const openIds = new Set((open || []).filter(p => p.status === 'awaiting_review' || p.due_on).map(p => p.sponsor_id));
  const holding = holders.filter(h => holdsPackageSpot(h, openIds.has(h.id)));
  // One who already holds a spot (renewing, or paying for the sign-up that holds it) keeps it
  if (holding.some(h => h.id === exceptSponsorId)) return false;
  const taken = holding.length;
  return (packageSpotsLeft(pkg, taken) ?? 1) <= 0;
}

export interface InvoiceSponsor {
  id: string;
  club_id: string;
  name: string;
  contact_name?: string | null;
  contact_email?: string | null;
  package_status?: string | null;
  package_id?: string | null;
  access_key?: string | null;
}

/**
 * The sponsor's open invoice, or a new one for `pkg`: a 'pending' sponsorship payment due in 14 days,
 * given the club's next invoice number now, so it reads the same once paid. Paying it by card or
 * transfer (lib/payments-server.ts), or Record a payment in admin, turns this same row paid.
 */
export async function issueSponsorInvoice(
  db: SupabaseClient,
  sponsor: InvoiceSponsor,
  pkg: { id: string; name: string; price_cents: number },
  now = Date.now()
): Promise<{ ok: true; payment: Payment; number: number; created: boolean } | { ok: false; status: number; error: string }> {
  const existing = await openSponsorInvoice(db, sponsor.id);
  let payment = existing;
  if (!payment) {
    if (!(pkg.price_cents > 0)) return { ok: false, status: 400, error: 'This package has nothing to pay.' };
    const [{ data: settings }, { data: paidBefore }] = await Promise.all([
      db.from('club_payment_settings').select('currency').eq('club_id', sponsor.club_id).maybeSingle(),
      db.from('payments').select('id').eq('sponsor_id', sponsor.id).eq('kind', 'sponsorship').eq('status', 'paid').limit(1).maybeSingle(),
    ]);
    const { data, error } = await db.from('payments').insert({
      club_id: sponsor.club_id, kind: 'sponsorship', category: 'sponsorship',
      sponsor_id: sponsor.id, package_id: pkg.id,
      // " renewal (" is how sponsorshipPaidFor tells a renewal from the first payment
      description: `${pkg.name}${paidBefore ? ' renewal' : ''} (${sponsor.name})`,
      amount_cents: pkg.price_cents, currency: settings?.currency || 'AUD',
      method: 'bank_transfer', status: 'pending',
      due_on: localDateISO(now + INVOICE_DUE_DAYS * 24 * 3600 * 1000),
      payer_name: sponsor.contact_name || sponsor.name, payer_email: sponsor.contact_email || null,
    }).select('*').single();
    if (error || !data) {
      console.error('[sponsor-invoice] create:', error?.message);
      return { ok: false, status: 500, error: 'The invoice could not be made right now. Please try again.' };
    }
    payment = data as Payment;
    // The package they're being invoiced for is the one they hold (SPP-4). Best effort.
    if (!sponsor.package_id) await db.from('sponsors').update({ package_id: pkg.id }).eq('id', sponsor.id).then(() => undefined, () => undefined);
  }
  const { data: number, error: numberError } = await db.rpc('assign_invoice_number', { p_payment_id: payment.id });
  if (numberError || typeof number !== 'number') {
    console.error('[sponsor-invoice] number:', numberError?.message);
    return { ok: false, status: 409, error: 'Invoices aren\'t switched on for this club yet. Please ask the club.' };
  }
  return { ok: true, payment, number, created: !existing };
}

/** The invoice's private link, for the sponsor (their link secret is the key) */
export const sponsorInvoiceUrl = (club: ClubBrandRow, paymentId: string, accessKey: string) =>
  `${clubBaseUrl(club)}/sponsor/invoice/${paymentId}?k=${encodeURIComponent(accessKey)}`;

/** Emails the invoice to the sponsor's contact. `resend` lets an admin send it again (once a minute at
 *  most); otherwise it goes out once per invoice. */
export async function emailSponsorInvoice(
  db: SupabaseClient, sponsor: InvoiceSponsor, payment: Payment, number: number, resend = false
): Promise<{ emailed: boolean; note?: string }> {
  if (!looksLikeEmail(sponsor.contact_email)) return { emailed: false, note: 'They have no email address, so copy the link and send it yourself.' };
  if (!process.env.RESEND_API_KEY) return { emailed: false, note: 'Email isn\'t set up yet, so copy the link and send it yourself.' };
  if (!isSponsorKey(sponsor.access_key)) return { emailed: false, note: 'Invoices need the sponsor renewals update (migration 20261132) first.' };
  const [{ data: club }, { data: pkg }] = await Promise.all([
    db.from('clubs').select(`${CLUB_BRAND_COLUMNS}, contact_email`).eq('id', sponsor.club_id).maybeSingle(),
    payment.package_id ? db.from('sponsorship_packages').select('name').eq('id', payment.package_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  if (!club) return { emailed: false, note: 'The invoice could not be emailed. Copy the link and send it yourself.' };
  const row = club as ClubBrandRow & { contact_email?: string | null };
  const replyTo = looksLikeEmail(row.contact_email) ? row.contact_email.trim() : undefined;
  const report = await sendClubEmails(db, [{
    key: `sponsor_invoice:${payment.id}${resend ? `:${new Date().toISOString().slice(0, 16)}` : ''}`,
    clubId: row.id,
    kind: 'sponsor_invoice',
    refId: sponsor.id,
    to: sponsor.contact_email.trim(),
    fromName: row.name,
    replyTo,
    email: sponsorInvoice({
      brand: clubBrand(row),
      contactName: sponsor.contact_name || sponsor.name,
      business: sponsor.name,
      packageName: pkg?.name || 'sponsorship',
      price: formatMoney(payment.amount_cents, payment.currency),
      number: invoiceLabel(number),
      dueOn: payment.due_on ? formatEndDate(payment.due_on) : 'on receipt',
      invoiceLink: sponsorInvoiceUrl(row, payment.id, sponsor.access_key),
      canReply: !!replyTo,
    }),
  }]);
  if (report.error) console.error('[sponsor-invoice] email failed:', payment.id, report.error);
  const emailed = report.sent > 0 || report.alreadySent > 0;
  return emailed ? { emailed } : { emailed, note: 'The email could not be sent. Copy the link and send it yourself.' };
}
