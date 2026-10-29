import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service';
import { requireClubPerm } from '@/lib/supabase/server-auth';
import { emailSponsorPaid } from '@/lib/email/sponsor-paid';
import { openSponsorInvoice } from '@/lib/sponsor-invoice-server';
import { localDateISO, matchSponsorPackage } from '@/lib/sponsors';
import { isUuid } from '@/lib/ids';
import type { Payment } from '@/lib/supabase/types';

// Money a sponsor paid outside the app: cash at the clubhouse, a cheque, or a direct deposit the
// treasurer saw in the bank (SPP-3, 29 Oct 2026 sponsor pain points).
//   POST { clubId, sponsorId, amountCents, method: 'bank_transfer' | 'cash' | 'cheque' | 'other', paidOn, until? }
//   club admins who can edit Sponsors or Finance
// It pays their open invoice if they have one (same invoice number), otherwise records a new
// sponsorship payment, and runs it through fulfil_payment like an online payment: Paid, the end date,
// the package, and an invoice on their sponsor page. `until` sets the end date the club agreed.
// The sponsor gets the usual thank-you email with their sponsor page link.

const METHODS: Record<string, { method: 'bank_transfer' | 'cash' | 'other'; note: string | null }> = {
  bank_transfer: { method: 'bank_transfer', note: null },
  cash: { method: 'cash', note: null },
  cheque: { method: 'other', note: 'Cheque' },
  other: { method: 'other', note: null },
};
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!isUuid(body?.clubId) || !isUuid(body?.sponsorId)) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  const auth = await requireClubPerm(req, body.clubId, ['sponsors', 'finance'], 'edit');
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const how = METHODS[String(body.method)];
  const today = localDateISO();
  const paidOn = typeof body.paidOn === 'string' && DATE_RE.test(body.paidOn) ? body.paidOn : null;
  if (!how) return NextResponse.json({ error: 'Choose how they paid.' }, { status: 400 });
  if (!paidOn || paidOn > today) return NextResponse.json({ error: 'Enter the day the money arrived (today or earlier).' }, { status: 400 });
  const until = typeof body.until === 'string' && DATE_RE.test(body.until) ? body.until : null;
  if (body.until && (!until || until <= paidOn)) return NextResponse.json({ error: 'The end date must be after the day they paid.' }, { status: 400 });

  const db = getServiceClient();
  if (!db) return NextResponse.json({ error: 'Payments cannot be recorded right now.' }, { status: 503 });
  const [{ data: sponsor }, invoice, { data: waiting }, { data: settings }, { data: packages }, { data: paidBefore }] = await Promise.all([
    db.from('sponsors').select('*').eq('id', body.sponsorId).eq('club_id', body.clubId).maybeSingle(),
    openSponsorInvoice(db, body.sponsorId),
    db.from('payments').select('id').eq('sponsor_id', body.sponsorId).eq('kind', 'sponsorship').eq('status', 'awaiting_review').limit(1).maybeSingle(),
    db.from('club_payment_settings').select('currency').eq('club_id', body.clubId).maybeSingle(),
    db.from('sponsorship_packages').select('id, name, tier, price_cents').eq('club_id', body.clubId),
    db.from('payments').select('id').eq('sponsor_id', body.sponsorId).eq('kind', 'sponsorship').eq('status', 'paid').limit(1).maybeSingle(),
  ]);
  if (!sponsor) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  if (waiting) {
    return NextResponse.json({ error: 'They sent a bank transfer receipt that is waiting to be checked. Verify it in Finance instead, so it isn\'t counted twice.' }, { status: 409 });
  }
  const amount = invoice ? invoice.amount_cents : Math.round(Number(body.amountCents));
  if (!Number.isFinite(amount) || amount <= 0 || amount > 100_000_000) return NextResponse.json({ error: 'Enter the amount they paid.' }, { status: 400 });

  // Noon, so the day reads the same in any time zone
  const paidAt = new Date(`${paidOn}T12:00:00`).toISOString();
  let paymentId: string;
  if (invoice) {
    const { error } = await db.from('payments').update({ method: how.method, paid_at: paidAt, notes: how.note }).eq('id', invoice.id).eq('status', 'pending');
    if (error) return NextResponse.json({ error: 'Could not record the payment. Please try again.' }, { status: 500 });
    paymentId = invoice.id;
  } else {
    const pkg = (packages || []).find(p => p.id === sponsor.package_id) || matchSponsorPackage(sponsor, packages || []);
    const { data: row, error } = await db.from('payments').insert({
      club_id: sponsor.club_id, kind: 'sponsorship', category: 'sponsorship',
      sponsor_id: sponsor.id, package_id: pkg?.id ?? null,
      // " renewal (" is how sponsorshipPaidFor tells a renewal from the first payment
      description: `${pkg?.name || 'Sponsorship'}${paidBefore ? ' renewal' : ''} (${sponsor.name})`,
      amount_cents: amount, currency: settings?.currency || 'AUD',
      method: how.method, status: 'pending', paid_at: paidAt, notes: how.note,
      payer_name: sponsor.contact_name || sponsor.name, payer_email: sponsor.contact_email || null,
    }).select('id').single();
    if (error || !row) return NextResponse.json({ error: 'Could not record the payment. Please try again.' }, { status: 500 });
    paymentId = row.id;
  }

  const { data: paid, error: fulfilError } = await db.rpc('fulfil_payment', { p_payment_id: paymentId });
  if (fulfilError) {
    console.error('[sponsor-record-payment] fulfil:', fulfilError.message);
    return NextResponse.json({ error: 'The payment was saved but the sponsorship could not be updated. Please try again.' }, { status: 500 });
  }
  await db.from('payments').update({ reviewed_by: auth.userId, reviewed_at: new Date().toISOString() }).eq('id', paymentId);
  // The end date the club agreed, when it isn't the year fulfil_payment gave
  if (until) {
    await db.from('sponsors').update({ ends_on: until }).eq('id', sponsor.id);
    await db.from('payments').update({ covers_until: until }).eq('id', paymentId).then(() => undefined, () => undefined);
  }
  const { data: after } = await db.from('sponsors').select('ends_on, package_status').eq('id', sponsor.id).maybeSingle();
  const sent = await emailSponsorPaid(db, paid as Payment).catch(() => false);
  return NextResponse.json({ ok: true, paymentId, sent, ends_on: after?.ends_on ?? null, package_status: after?.package_status ?? 'paid', amount_cents: amount });
}
