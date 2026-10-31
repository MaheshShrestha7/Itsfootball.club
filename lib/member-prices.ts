// Member prices (migration 20261143): who gets them and what a ticket costs. Shared by the payment
// routes (the real price, lib/payments-server.ts) and the shop and ticket pages (display only).
import { SITE_TIME_ZONE } from './dates';

/** Today as YYYY-MM-DD in Sydney, as the database compares membership_expires_at */
export function siteToday(now = Date.now()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: SITE_TIME_ZONE }).format(now);
}

export interface MembershipRow {
  user_id?: string | null;
  guardian_email?: string | null;
  membership_status?: string | null;
  status?: string | null;
  membership_expires_at?: string | null;
}

/** One of `rows` is the payer's own membership (user_id) or a child's they're the guardian of
 *  (their confirmed email), and it's approved, not suspended and in date. The same rule as
 *  is_active_club_member() in migration 20261141 */
export function hasActiveMembership(rows: MembershipRow[], userId: string | null, email: string | null, today: string): boolean {
  const mail = email?.trim().toLowerCase() || '';
  return rows.some(m =>
    ((!!userId && m.user_id === userId) || (!!mail && (m.guardian_email || '').trim().toLowerCase() === mail))
    && (m.membership_status ?? 'approved') === 'approved'
    && m.status !== 'suspended'
    && (!m.membership_expires_at || m.membership_expires_at >= today));
}

/** What one ticket costs this buyer */
export function ticketUnitCents(event: { ticket_price_cents: number; ticket_member_price_cents?: number | null }, isMember: boolean): number {
  return isMember && event.ticket_member_price_cents ? event.ticket_member_price_cents : event.ticket_price_cents;
}

/** What one product costs this buyer */
export function productUnitCents(product: { price_cents: number; member_price_cents?: number | null }, isMember: boolean): number {
  return isMember && product.member_price_cents ? product.member_price_cents : product.price_cents;
}
