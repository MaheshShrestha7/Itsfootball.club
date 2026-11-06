import type { SupabaseClient } from '@supabase/supabase-js';
import { billRecipient } from '@/lib/fee-requests';
import { formatMoney } from '@/lib/finance';
import { CLUB_BRAND_COLUMNS, clubBaseUrl, clubBrand, type ClubBrandRow } from './club-brand';
import { looksLikeEmail, sendClubEmails, type ClubEmail } from './club-emails';
import { formatDay, localDate } from './format';
import { feeRequest } from './templates';

/** Everything a bill email needs from its payments row, with the person's current addresses */
export const BILL_COLUMNS = 'id, member_id, request_title, description, amount_cents, currency, due_on, payer_name, payer_email, member:club_members(full_name, email, guardian_name, guardian_email)';

export interface BillRow {
  id: string;
  request_title: string | null;
  description: string | null;
  amount_cents: number;
  currency: string;
  due_on: string | null;
  payer_name: string | null;
  payer_email: string | null;
  member: { full_name: string; email: string | null; guardian_name: string | null; guardian_email: string | null } | null;
}

export interface BillEmailReport {
  emailed: number;
  /** No usable address, or the send failed: the treasurer shares the link instead */
  notEmailed: number;
  /** Already told today (reminders go out at most once a day per person) */
  alreadySent: number;
  error?: string;
}

/**
 * Emails bills to the people on them. A failure here never undoes the request: the rows exist and the
 * treasurer can copy each link. Reminders are keyed by day, so a double tap can't send two.
 */
export async function emailBills(db: SupabaseClient, clubId: string, rows: BillRow[], opts: { reminder: boolean; message?: string | null }): Promise<BillEmailReport> {
  // Never throws: the bills are already saved, and an error here would have the treasurer send them all again
  return sendBills(db, clubId, rows, opts).catch(err => {
    console.error('[fee-requests] email failed:', err);
    return { emailed: 0, notEmailed: rows.length, alreadySent: 0, error: 'The emails could not be sent. Copy the links and send them yourself.' };
  });
}

async function sendBills(db: SupabaseClient, clubId: string, rows: BillRow[], opts: { reminder: boolean; message?: string | null }): Promise<BillEmailReport> {
  if (!process.env.RESEND_API_KEY) return { emailed: 0, notEmailed: rows.length, alreadySent: 0, error: 'Email isn\'t set up yet, so copy the links and send them yourself.' };
  const { data } = await db.from('clubs').select(`${CLUB_BRAND_COLUMNS}, contact_email`).eq('id', clubId).maybeSingle();
  if (!data) return { emailed: 0, notEmailed: rows.length, alreadySent: 0, error: 'Club not found.' };
  const club = data as ClubBrandRow & { contact_email?: string | null };
  const today = localDate();

  const replyTo = looksLikeEmail(club.contact_email) ? club.contact_email.trim() : undefined;

  // A bill goes out even to someone who unsubscribed: that stops club reminders and notices, not what they
  // owe. So there's no opt-out check here, and no unsubscribe link that wouldn't stop these.
  const emails: ClubEmail[] = rows.flatMap(row => {
    const recipient = billRecipient(row);
    if (!recipient || !row.due_on) return [];
    return [{
      key: opts.reminder ? `fee_reminder:${row.id}:${today}` : `fee_request:${row.id}`,
      clubId: club.id, kind: opts.reminder ? 'fee_reminder' as const : 'fee_request' as const, refId: row.id, to: recipient.to,
      fromName: club.name,
      replyTo,
      email: feeRequest({
        brand: clubBrand(club),
        message: opts.message,
        memberName: recipient.name,
        childName: recipient.childName,
        title: row.request_title || row.description || 'Club fee',
        price: formatMoney(row.amount_cents, row.currency),
        dueOn: formatDay(row.due_on!),
        overdue: row.due_on! < today,
        reminder: opts.reminder,
        link: `${clubBaseUrl(club)}/pay/${row.id}`,
      }),
    }];
  });

  const report = await sendClubEmails(db, emails);
  if (report.error) console.error('[fee-requests] email failed:', report.error);
  return {
    emailed: report.sent,
    notEmailed: rows.length - emails.length + report.failed,
    alreadySent: report.alreadySent,
    ...(report.error ? { error: 'Some emails could not be sent. Copy those links and send them yourself.' } : {}),
  };
}
