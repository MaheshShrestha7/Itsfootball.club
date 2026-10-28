import { NextRequest, NextResponse } from 'next/server';
import { requireClubPerm } from '@/lib/supabase/server-auth';
import { getServiceClient } from '@/lib/supabase/service';
import { CLUB_BRAND_COLUMNS, clubBaseUrl, clubBrand, type ClubBrandRow } from '@/lib/email/club-brand';
import { sendClubEmails, looksLikeEmail } from '@/lib/email/club-emails';
import { sponsorLink } from '@/lib/email/templates';
import { durableRateLimit } from '@/lib/rate-limit';
import { formatMoney } from '@/lib/finance';
import { formatEndDate, isPastEndDate, matchSponsorPackage } from '@/lib/sponsors';
import { isUuid } from '@/lib/ids';

// Emails a sponsor a link to pay (SP-X5, 28 Oct 2026 sponsors review).
//   POST { clubId, sponsorId, kind: 'payment' | 'renewal' }   club admins who can edit Sponsors
//   payment  a website sign-up that hasn't paid yet: back to their payment step
//   renewal  an existing sponsor: pay the package again; fulfil_payment then moves their end date
//            a year on. Needs the secret access_key (migration 20261132), so a public sponsor id
//            alone can't be used to pay.
// Always returns the link, so the admin can copy it and send it themselves when email isn't set up.

export async function POST(req: NextRequest) {
  const input = await req.json().catch(() => null);
  const kind = input?.kind === 'renewal' ? 'renewal' : input?.kind === 'payment' ? 'payment' : null;
  if (!isUuid(input?.clubId) || !isUuid(input?.sponsorId) || !kind) {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }
  const auth = await requireClubPerm(req, input.clubId, ['sponsors'], 'edit');
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!(await durableRateLimit(`sponsor-link:${input.sponsorId}`, 5, 60 * 60 * 1000))) {
    return NextResponse.json({ error: 'That link was sent a few times already. Try again in an hour.' }, { status: 429 });
  }

  const db = getServiceClient();
  if (!db) return NextResponse.json({ error: 'Links cannot be sent right now.' }, { status: 503 });

  const [{ data: sponsor }, { data: club }, { data: packages }, { data: settings }] = await Promise.all([
    db.from('sponsors').select('*').eq('id', input.sponsorId).eq('club_id', input.clubId).maybeSingle(),
    db.from('clubs').select(`${CLUB_BRAND_COLUMNS}, contact_email`).eq('id', input.clubId).maybeSingle(),
    db.from('sponsorship_packages').select('id, name, tier, price_cents').eq('club_id', input.clubId).eq('is_active', true).order('sort_order'),
    db.from('club_payment_settings').select('currency').eq('club_id', input.clubId).maybeSingle(),
  ]);
  if (!sponsor || !club) return NextResponse.json({ error: 'Not found.' }, { status: 404 });

  if (kind === 'payment' && sponsor.package_status !== 'prospect') {
    return NextResponse.json({ error: 'They have already paid or been set up. Use Send renewal link instead.' }, { status: 409 });
  }
  if (kind === 'renewal' && !sponsor.access_key) {
    return NextResponse.json({ error: 'Renewal links need the sponsor renewals update (migration 20261132) first.' }, { status: 409 });
  }
  const pkg = matchSponsorPackage(sponsor, packages || []);
  if (!pkg) {
    return NextResponse.json({ error: 'No package fits this sponsor. Check their tier and value, or add a priced package under Sponsors, Packages.' }, { status: 409 });
  }

  const row = club as ClubBrandRow & { contact_email?: string | null };
  const query = new URLSearchParams({ pay: sponsor.id, package: pkg.id });
  if (sponsor.access_key) query.set('k', sponsor.access_key);
  const link = `${clubBaseUrl(row)}/sponsor?${query}`;

  let emailed = false;
  let emailError: string | undefined;
  if (!looksLikeEmail(sponsor.contact_email)) {
    emailError = 'They have no email address, so copy the link and send it yourself.';
  } else if (!process.env.RESEND_API_KEY) {
    emailError = 'Email isn\'t set up yet, so copy the link and send it yourself.';
  } else {
    const replyTo = looksLikeEmail(row.contact_email) ? row.contact_email.trim() : undefined;
    const sentAt = new Date().toISOString();
    const report = await sendClubEmails(db, [{
      // One a minute at most, so a double tap doesn't send it twice
      key: `sponsor_${kind}:${sponsor.id}:${sentAt.slice(0, 16)}`,
      clubId: row.id,
      kind: kind === 'renewal' ? 'sponsor_renewal' : 'sponsor_payment',
      refId: sponsor.id,
      to: sponsor.contact_email.trim(),
      fromName: row.name,
      replyTo,
      email: sponsorLink({
        brand: clubBrand(row),
        contactName: sponsor.contact_name || sponsor.name,
        business: sponsor.name,
        packageName: pkg.name,
        price: formatMoney(pkg.price_cents, settings?.currency || 'AUD'),
        renewal: kind === 'renewal',
        endsOn: kind === 'renewal' && sponsor.ends_on ? formatEndDate(sponsor.ends_on) : null,
        ended: isPastEndDate(sponsor),
        link,
        canReply: !!replyTo,
      }),
    }]);
    emailed = report.sent > 0 || report.alreadySent > 0;
    if (!emailed) emailError = 'The email could not be sent. Copy the link and send it yourself.';
    // link_sent_at is from migration 20261132; before it runs this quietly does nothing
    if (emailed) await db.from('sponsors').update({ link_sent_at: sentAt }).eq('id', sponsor.id).then(() => undefined, () => undefined);
    if (report.error) console.error('[sponsor-link] email failed:', report.error);
  }

  return NextResponse.json({ link, emailed, packageName: pkg.name, ...(emailError ? { note: emailError } : {}) });
}
