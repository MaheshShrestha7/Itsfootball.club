import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service';
import { requireClubPerm } from '@/lib/supabase/server-auth';
import { durableRateLimit, getClientIp } from '@/lib/rate-limit';
import { CLUB_BRAND_COLUMNS, type ClubBrandRow } from '@/lib/email/club-brand';
import { findSponsorByKey } from '@/lib/sponsor-portal-server';
import { emailSponsorInvoice, issueSponsorInvoice, packageIsFull, PACKAGE_TAKEN, sponsorInvoiceUrl, type InvoiceSponsor } from '@/lib/sponsor-invoice-server';
import { canPayRenewal, isSponsorKey, matchSponsorPackage } from '@/lib/sponsors';
import { isUuid } from '@/lib/ids';

// An invoice before payment (SPP-2, 29 Oct 2026 sponsor pain points): many businesses only pay
// against an invoice. It is due in 14 days, has the club's bank details and a pay-by-card button,
// and becomes paid (same number) however the money arrives.
//   POST { k, packageId? }                         the sponsor, from the sign-up page or their own page:
//                                                  a new sign-up, or a renewal that is due
//   POST { clubId, sponsorId, packageId?, resend? } club admins who can edit Sponsors (Send invoice)
// An open invoice is reused, never doubled. The invoice is emailed to the sponsor's contact.

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  const db = getServiceClient();
  if (!db) return NextResponse.json({ error: 'Invoices are not available right now.' }, { status: 503 });

  let sponsor: InvoiceSponsor & { tier?: string; package_value?: number | null; ends_on?: string | null };
  let club: ClubBrandRow;
  const byAdmin = !isSponsorKey(body.k);
  if (byAdmin) {
    if (!isUuid(body.clubId) || !isUuid(body.sponsorId)) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
    const auth = await requireClubPerm(req, body.clubId, ['sponsors'], 'edit');
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const [{ data: s }, { data: c }] = await Promise.all([
      db.from('sponsors').select('*').eq('id', body.sponsorId).eq('club_id', body.clubId).maybeSingle(),
      db.from('clubs').select(CLUB_BRAND_COLUMNS).eq('id', body.clubId).maybeSingle(),
    ]);
    if (!s || !c) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
    sponsor = s;
    club = c as ClubBrandRow;
  } else {
    if (!(await durableRateLimit(`sponsor-invoice-ask:${getClientIp(req.headers)}`, 10, 60 * 60 * 1000))) {
      return NextResponse.json({ error: 'Too many requests. Please wait a few minutes.' }, { status: 429 });
    }
    const found = await findSponsorByKey(db, body.k);
    if (!found) return NextResponse.json({ error: 'This link is not valid. Ask the club for a new one.' }, { status: 404 });
    sponsor = found.sponsor;
    club = found.club;
  }
  if (!isSponsorKey(sponsor.access_key)) {
    return NextResponse.json({ error: 'Invoices need the sponsor renewals update (migration 20261132) first.' }, { status: 409 });
  }
  if (!byAdmin && sponsor.package_status !== 'prospect' && !canPayRenewal(sponsor)) {
    return NextResponse.json({ error: 'There is nothing to pay right now. Your sponsor page offers renewal nearer the end date.' }, { status: 409 });
  }

  // The package: the one asked for, else the one they hold, else the club's package that fits
  const { data: packages } = await db.from('sponsorship_packages').select('*').eq('club_id', sponsor.club_id).eq('is_active', true).order('sort_order');
  const priced = (packages || []).filter(p => p.price_cents > 0);
  const pkg = (isUuid(body.packageId) && priced.find(p => p.id === body.packageId))
    || priced.find(p => p.id === sponsor.package_id)
    || matchSponsorPackage({ tier: sponsor.tier as never, package_value: sponsor.package_value ?? null }, priced);
  if (!pkg) {
    return NextResponse.json({ error: byAdmin
      ? 'No package fits this sponsor. Choose their Package in their details, or add a priced package under Sponsors, Packages.'
      : 'That package is no longer available. Please contact the club.' }, { status: 409 });
  }
  if (sponsor.package_id !== pkg.id && await packageIsFull(db, sponsor.club_id, pkg, sponsor.id)) {
    return NextResponse.json({ error: PACKAGE_TAKEN }, { status: 409 });
  }

  const issued = await issueSponsorInvoice(db, sponsor, pkg);
  if (!issued.ok) return NextResponse.json({ error: issued.error }, { status: issued.status });
  // A sponsor asking again for the same open invoice isn't emailed it twice; an admin's resend is
  const mail = issued.created || (byAdmin && body.resend === true)
    ? await emailSponsorInvoice(db, sponsor, issued.payment, issued.number, !issued.created)
    : { emailed: false };
  return NextResponse.json({
    paymentId: issued.payment.id,
    number: issued.number,
    dueOn: issued.payment.due_on,
    created: issued.created,
    link: sponsorInvoiceUrl(club, issued.payment.id, sponsor.access_key),
    ...mail,
  });
}
