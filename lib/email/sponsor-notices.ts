import type { SupabaseClient } from '@supabase/supabase-js';
import { CLUB_BRAND_COLUMNS, clubBaseUrl, clubBrand, type ClubBrandRow } from '@/lib/email/club-brand';
import { looksLikeEmail, sendClubEmails } from '@/lib/email/club-emails';
import { sponsorChangeReviewed, sponsorTransferRejected } from '@/lib/email/templates';
import { formatMoney } from '@/lib/finance';
import { isSponsorKey, sponsorPageUrl } from '@/lib/sponsors';
import type { Payment } from '@/lib/supabase/types';

async function loadClub(db: SupabaseClient, clubId: string) {
  const { data } = await db.from('clubs').select(`${CLUB_BRAND_COLUMNS}, contact_email`).eq('id', clubId).maybeSingle();
  if (!data) return null;
  const row = data as ClubBrandRow & { contact_email?: string | null };
  return { row, replyTo: looksLikeEmail(row.contact_email) ? row.contact_email.trim() : undefined };
}

/** SPE-8: tells a sponsor the club couldn't match their bank transfer, with the club's note and the
 *  link to pay again. email_log makes it go out once per payment. */
export async function emailSponsorTransferRejected(db: SupabaseClient, pay: Payment & { reviewed_at?: string | null }): Promise<boolean> {
  // SPP-2: a receipt for an invoice the club sent goes back to 'pending' (the invoice is still due)
  const invoiceStillDue = pay.status === 'pending' && !!pay.due_on && !!pay.reviewed_at;
  if (pay.kind !== 'sponsorship' || (pay.status !== 'rejected' && !invoiceStillDue) || !pay.sponsor_id || !process.env.RESEND_API_KEY) return false;
  const [{ data: sponsor }, club, { data: pkg }] = await Promise.all([
    db.from('sponsors').select('*').eq('id', pay.sponsor_id).maybeSingle(),
    loadClub(db, pay.club_id),
    pay.package_id ? db.from('sponsorship_packages').select('id, name').eq('id', pay.package_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const to = sponsor?.contact_email || pay.payer_email;
  if (!sponsor || !club || !isSponsorKey(sponsor.access_key) || !looksLikeEmail(to)) return false;
  const query = new URLSearchParams({ pay: sponsor.id, ...(pkg?.id ? { package: pkg.id } : {}), k: sponsor.access_key });
  const report = await sendClubEmails(db, [{
    // An invoice can have a receipt turned down more than once: once per check
    key: `sponsor_rejected:${pay.id}${invoiceStillDue ? `:${pay.reviewed_at}` : ''}`,
    clubId: club.row.id,
    kind: 'sponsor_rejected',
    refId: sponsor.id,
    to: to.trim(),
    fromName: club.row.name,
    replyTo: club.replyTo,
    email: sponsorTransferRejected({
      brand: clubBrand(club.row),
      contactName: sponsor.contact_name || pay.payer_name || sponsor.name,
      business: sponsor.name,
      packageName: pkg?.name || 'sponsorship',
      price: formatMoney(pay.amount_cents, pay.currency),
      reason: pay.rejection_reason?.trim() || null,
      link: `${clubBaseUrl(club.row)}/sponsor?${query}`,
      canReply: !!club.replyTo,
    }),
  }]);
  if (report.error) console.error('[sponsor-rejected] email failed:', pay.id, report.error);
  return report.sent > 0 || report.alreadySent > 0;
}

/** SPE-17: tells a sponsor whether the club used the logo or website they sent, or kept the old one */
export async function emailSponsorChangeReviewed(
  db: SupabaseClient,
  sponsor: { id: string; club_id: string; name: string; contact_name?: string | null; contact_email?: string | null; access_key?: string | null },
  used: boolean,
  what: string,
): Promise<boolean> {
  if (!process.env.RESEND_API_KEY || !looksLikeEmail(sponsor.contact_email) || !isSponsorKey(sponsor.access_key)) return false;
  const club = await loadClub(db, sponsor.club_id);
  if (!club) return false;
  const report = await sendClubEmails(db, [{
    // One a minute at most, so a double tap doesn't send it twice
    key: `sponsor_change:${sponsor.id}:${new Date().toISOString().slice(0, 16)}`,
    clubId: club.row.id,
    kind: 'sponsor_change',
    refId: sponsor.id,
    to: sponsor.contact_email.trim(),
    fromName: club.row.name,
    replyTo: club.replyTo,
    email: sponsorChangeReviewed({
      brand: clubBrand(club.row),
      contactName: sponsor.contact_name || sponsor.name,
      business: sponsor.name,
      used,
      what,
      pageLink: sponsorPageUrl(clubBaseUrl(club.row), sponsor.access_key),
      canReply: !!club.replyTo,
    }),
  }]);
  if (report.error) console.error('[sponsor-change] email failed:', sponsor.id, report.error);
  return report.sent > 0 || report.alreadySent > 0;
}
