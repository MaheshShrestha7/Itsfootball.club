import type { SupabaseClient } from '@supabase/supabase-js';
import { CLUB_BRAND_COLUMNS, clubBaseUrl, clubBrand, type ClubBrandRow } from '@/lib/email/club-brand';
import { looksLikeEmail, sendClubEmails } from '@/lib/email/club-emails';
import { sponsorPaid } from '@/lib/email/templates';
import { formatMoney } from '@/lib/finance';
import { isSponsorKey, sponsorPageUrl } from '@/lib/sponsors';
import type { Payment } from '@/lib/supabase/types';

/** Thanks a sponsor once their payment is in (card webhook, or the club verifying a bank transfer),
 *  with the link to their own page. email_log makes it go out once per payment, so callers may retry. */
export async function emailSponsorPaid(db: SupabaseClient, pay: Payment): Promise<boolean> {
  if (pay.kind !== 'sponsorship' || pay.status !== 'paid' || !pay.sponsor_id || !process.env.RESEND_API_KEY) return false;
  const [{ data: sponsor }, { data: club }, { data: pkg }] = await Promise.all([
    db.from('sponsors').select('*').eq('id', pay.sponsor_id).maybeSingle(),
    db.from('clubs').select(`${CLUB_BRAND_COLUMNS}, contact_email`).eq('id', pay.club_id).maybeSingle(),
    pay.package_id ? db.from('sponsorship_packages').select('name').eq('id', pay.package_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const to = sponsor?.contact_email || pay.payer_email;
  if (!sponsor || !club || !isSponsorKey(sponsor.access_key) || !looksLikeEmail(to)) return false;
  const row = club as ClubBrandRow & { contact_email?: string | null };
  const replyTo = looksLikeEmail(row.contact_email) ? row.contact_email.trim() : undefined;
  const report = await sendClubEmails(db, [{
    key: `sponsor_paid:${pay.id}`,
    clubId: row.id,
    kind: 'sponsor_paid',
    refId: sponsor.id,
    to: to.trim(),
    fromName: row.name,
    replyTo,
    email: sponsorPaid({
      brand: clubBrand(row),
      contactName: sponsor.contact_name || pay.payer_name || sponsor.name,
      business: sponsor.name,
      packageName: pkg?.name || 'sponsorship',
      price: formatMoney(pay.amount_cents, pay.currency),
      pageLink: sponsorPageUrl(clubBaseUrl(row), sponsor.access_key),
      canReply: !!replyTo,
    }),
  }]);
  if (report.error) console.error('[sponsor-paid] email failed:', pay.id, report.error);
  return report.sent > 0 || report.alreadySent > 0;
}
