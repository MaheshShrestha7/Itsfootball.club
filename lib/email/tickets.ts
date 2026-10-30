import type { SupabaseClient } from '@supabase/supabase-js';
import { CLUB_BRAND_COLUMNS, clubBaseUrl, clubBrand, type ClubBrandRow } from '@/lib/email/club-brand';
import { formatWhen } from '@/lib/email/format';
import { sendEmail } from '@/lib/email/send';
import { ticketsEmail } from '@/lib/email/templates';
import type { Payment } from '@/lib/supabase/types';
import { loadGroundSponsors } from '@/lib/sponsor-ground-server';

/** Emails the buyer the link to their tickets, once a ticket order is paid (card webhook, or the
 *  club verifying a bank transfer). Callers may retry, so Resend dedupes by order id. */
export async function emailTickets(db: SupabaseClient, pay: Payment): Promise<boolean> {
  if (!pay.payer_email || !pay.event_id) return false;
  const [{ data: club }, { data: event }] = await Promise.all([
    db.from('clubs').select(CLUB_BRAND_COLUMNS).eq('id', pay.club_id).maybeSingle(),
    db.from('events').select('title, start_time, location').eq('id', pay.event_id).maybeSingle(),
  ]);
  if (!club || !event) return false;
  // A sponsor row is a bonus: the tickets still go out if it can't be read
  const sponsors = await loadGroundSponsors(db, pay.club_id, 'event_tickets', pay.event_id).catch(() => []);
  const quantity = (pay.items || []).reduce((n, i) => n + i.quantity, 0) || 1;
  const email = ticketsEmail({
    brand: clubBrand(club as ClubBrandRow),
    buyerName: pay.payer_name || '',
    event: event.title,
    quantity,
    when: formatWhen(event.start_time),
    venue: event.location,
    link: `${clubBaseUrl(club as ClubBrandRow)}/tickets/${pay.id}`,
    sponsors: sponsors.map(sp => ({ name: sp.name, logoUrl: sp.logo_url, url: sp.website_url })),
  });
  const sent = await sendEmail({ ...email, to: pay.payer_email, fromName: (club as ClubBrandRow).name, idempotencyKey: `tickets-${pay.id}` });
  if (!sent.ok) console.error('Tickets email failed:', pay.id, sent.error);
  return sent.ok;
}
