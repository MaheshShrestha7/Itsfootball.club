import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service';
import { durableRateLimit, getClientIp } from '@/lib/rate-limit';
import { findSponsorByKey } from '@/lib/sponsor-portal-server';
import { clubBaseUrl } from '@/lib/email/club-brand';
import { isUuid } from '@/lib/ids';
import { gstIncludedCents, invoiceTaxDetails } from '@/lib/invoice';
import { sponsorshipPaidFor } from '@/lib/sponsors';

// A sponsorship invoice (SP-F4). GET ?k={sponsor link secret}&payment={id}, paid payments only.
// The club's next invoice number is given the first time it's opened (assign_invoice_number,
// migration 20261133), then stays the same. Admins open it from the sponsor's page link too.

export async function GET(req: NextRequest) {
  if (!(await durableRateLimit(`sponsor-invoice:${getClientIp(req.headers)}`, 60, 10 * 60 * 1000))) {
    return NextResponse.json({ error: 'Too many requests. Please wait a few minutes.' }, { status: 429 });
  }
  const db = getServiceClient();
  if (!db) return NextResponse.json({ error: 'Invoices are not available right now.' }, { status: 503 });
  const paymentId = req.nextUrl.searchParams.get('payment');
  const found = await findSponsorByKey(db, req.nextUrl.searchParams.get('k'));
  if (!found || !isUuid(paymentId)) return NextResponse.json({ error: 'This invoice link is not valid.' }, { status: 404 });
  const { sponsor, club } = found;

  const { data: payment } = await db.from('payments')
    // '*' so the GST snapshot columns (migration 20261135) are read once they exist
    .select('*')
    .eq('id', paymentId).maybeSingle();
  if (!payment || payment.sponsor_id !== sponsor.id || payment.club_id !== club.id || payment.kind !== 'sponsorship') {
    return NextResponse.json({ error: 'This invoice link is not valid.' }, { status: 404 });
  }
  if (payment.status !== 'paid') {
    return NextResponse.json({ error: 'The invoice is ready once the club has received the payment.' }, { status: 409 });
  }

  const { data: number, error: numberError } = await db.rpc('assign_invoice_number', { p_payment_id: payment.id });
  if (numberError || typeof number !== 'number') {
    console.error('[sponsor-invoice] number:', numberError?.message);
    return NextResponse.json({ error: 'Invoices aren\'t switched on for this club yet. Please ask the club.' }, { status: 409 });
  }

  const [{ data: settings }, { data: pkg }] = await Promise.all([
    db.from('club_payment_settings').select('abn, gst_registered').eq('club_id', club.id).maybeSingle(),
    payment.package_id
      ? db.from('sponsorship_packages').select('name, benefits').eq('id', payment.package_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  // The GST registration and ABN the club had when this was paid (SPE-5), so the invoice never changes
  const { taxInvoice, abn } = invoiceTaxDetails(payment, settings);
  const paidFor = sponsorshipPaidFor(payment);

  return NextResponse.json({
    number,
    taxInvoice,
    club: {
      name: club.name,
      logo_url: club.logo_url,
      primary_color: club.primary_color,
      contact_email: club.contact_email,
      address: club.stadium_address,
      abn,
      site: clubBaseUrl(club).replace(/^https?:\/\//, ''),
    },
    billedTo: { name: sponsor.name, contact_name: sponsor.contact_name || null, contact_email: sponsor.contact_email || null },
    line: {
      // SPE-14: a renewal says so, with the period it pays for (else the season, as before)
      description: pkg?.name
        ? `${pkg.name} sponsorship${paidFor.renewal ? ' renewal' : ''}${paidFor.period ? `, ${paidFor.period}` : payment.season ? `, ${payment.season} season` : ''}`
        : payment.description || 'Sponsorship',
      detail: pkg?.benefits ? String(pkg.benefits).split('\n')[0].slice(0, 160) : null,
    },
    amount_cents: payment.amount_cents,
    gst_cents: taxInvoice ? gstIncludedCents(payment.amount_cents) : 0,
    currency: payment.currency,
    method: payment.method,
    date: payment.paid_at || payment.created_at,
  }, { headers: { 'Cache-Control': 'no-store' } });
}
