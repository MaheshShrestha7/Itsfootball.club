import type { SupabaseClient } from '@supabase/supabase-js';
import { describeItems, parseCart, priceCart, type OrderItem, type PricedProduct } from './shop';
import { ticketOrderError, type TicketedEvent } from './tickets';
import { hasActiveMembership, siteToday, ticketUnitCents, type MembershipRow } from './member-prices';
import { canPayRenewal } from './sponsors';
import { openSponsorInvoice, packageIsFull, PACKAGE_TAKEN } from './sponsor-invoice-server';

// Server-only: works out what a payer owes from ids alone. The amount always comes from the
// club's plan / package / product rows, never from the client.

export type PayableKind = 'membership_signup' | 'membership_renewal' | 'sponsorship' | 'shop_order' | 'event_ticket';

export interface PaymentDraft {
  club: { id: string; slug: string; name: string };
  currency: string;
  stripeAccountId: string | null;
  stripeChargesEnabled: boolean;
  label: string;
  /** Stripe Checkout lines when there is more than one thing being bought (shop orders) */
  lines?: { name: string; unit_cents: number; quantity: number }[];
  /** Columns for the payments row */
  row: {
    club_id: string;
    kind: PayableKind;
    category: 'membership' | 'sponsorship' | 'merchandise' | 'events_tickets';
    member_id: string | null;
    sponsor_id: string | null;
    plan_id: string | null;
    package_id: string | null;
    description: string;
    amount_cents: number;
    currency: string;
    payer_name: string | null;
    payer_email: string | null;
    items?: OrderItem[];
    event_id?: string;
  };
  /** SPP-2: the sponsor's open invoice this pays. The routes turn that row paid instead of adding one,
   *  so the invoice number stays the same. */
  invoiceId?: string;
}

export const SPONSOR_ALREADY_PAID = 'This sponsorship is already paid, thank you. Your sponsor page has your invoice, and offers renewal nearer the end date.';
export const SPONSOR_RECEIPT_WAITING = 'Your bank transfer receipt is with the club. There is nothing more to pay until they have checked it.';

type Result = { ok: true; draft: PaymentDraft } | { ok: false; status: number; error: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuid = (v: unknown): string | null => (typeof v === 'string' && UUID_RE.test(v) ? v : null);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const text = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/[<>]/g, '').trim().slice(0, max) : '');

export function readPaymentInput(get: (key: string) => unknown) {
  const kind = get('kind');
  return {
    clubId: uuid(get('clubId')),
    kind: (['membership_signup', 'membership_renewal', 'sponsorship', 'shop_order', 'event_ticket'].includes(kind as string) ? kind : null) as PayableKind | null,
    memberId: uuid(get('memberId')),
    sponsorId: uuid(get('sponsorId')),
    /** The secret from a payment or renewal link the club emailed (sponsors.access_key) */
    sponsorKey: /^[0-9a-f]{64}$/.test(String(get('sponsorKey') ?? '')) ? String(get('sponsorKey')) : null,
    planId: uuid(get('planId')),
    packageId: uuid(get('packageId')),
    eventId: uuid(get('eventId')),
    quantity: Number(get('quantity')),
    cart: parseCart(get('items')),
    buyerName: text(get('buyerName'), 120),
    buyerEmail: text(get('buyerEmail'), 255).toLowerCase(),
  };
}

/**
 * Who may pay for what (these routes are public, and ids alone must not be enough):
 *   membership_signup   a pending application; its id is only known to the applicant (club_members is not public)
 *   membership_renewal  only the signed-in member themselves (`payerUserId` from their session), or their
 *                       parent / guardian (`payerEmail`, the session's confirmed email, is the member's guardian_email)
 *   sponsorship         a sponsor still at 'prospect', i.e. one that just applied; active sponsors' ids are public,
 *                       so renewing an existing sponsorship also needs the secret key from the club's renewal link
 *   shop_order          anyone: it pays for new goods, never for someone else's record
 *   event_ticket        anyone: new tickets for a public event, priced from the event row
 * Shop orders and tickets cost the member price (migration 20261143) only when the signed-in payer is an
 * active member of the club, or the guardian of one (payerIsActiveMember); everyone else pays the full price.
 */
/** The signed-in payer is an approved, unsuspended, in-date member of the club, or the guardian of one
 *  (`email` is their confirmed sign-in email). Signed out = not a member. */
export async function payerIsActiveMember(db: SupabaseClient, clubId: string, userId: string | null, email: string | null): Promise<boolean> {
  if (!userId && !email) return false;
  const columns = 'user_id, guardian_email, membership_status, status, membership_expires_at';
  const mail = email?.trim().toLowerCase() || '';
  const [own, children] = await Promise.all([
    userId ? db.from('club_members').select(columns).eq('club_id', clubId).eq('user_id', userId) : Promise.resolve({ data: [] }),
    // ilike only narrows (guardian emails typed by an admin may not be lower case); hasActiveMembership
    // compares the whole address
    mail ? db.from('club_members').select(columns).eq('club_id', clubId).ilike('guardian_email', mail) : Promise.resolve({ data: [] }),
  ]);
  const rows = [...(own.data || []), ...(children.data || [])] as MembershipRow[];
  return hasActiveMembership(rows, userId, mail || null, siteToday());
}

export async function preparePayment(
  db: SupabaseClient,
  input: ReturnType<typeof readPaymentInput>,
  payerUserId: string | null = null,
  payerEmail: string | null = null
): Promise<Result> {
  const bad = (error: string, status = 400): Result => ({ ok: false, status, error });
  if (!input.clubId || !input.kind) return bad('Invalid payment request.');

  const [{ data: club }, { data: settings }] = await Promise.all([
    db.from('clubs').select('id, slug, name').eq('id', input.clubId).eq('is_active', true).maybeSingle(),
    db.from('club_payment_settings').select('*').eq('club_id', input.clubId).maybeSingle(),
  ]);
  if (!club) return bad('Club not found.', 404);
  const currency: string = settings?.currency || 'AUD';

  const base = {
    club,
    currency,
    stripeAccountId: settings?.stripe_account_id ?? null,
    stripeChargesEnabled: Boolean(settings?.stripe_charges_enabled),
  };

  if (input.kind === 'shop_order') {
    if (!input.cart) return bad('Your cart is empty.');
    if (!input.buyerName || !EMAIL_RE.test(input.buyerEmail)) return bad('Enter your name and a valid email.');
    // '*': member_price_cents only exists after migration 20261143, and orders must work before it
    const [{ data: products }, isMember] = await Promise.all([
      db.from('shop_products').select('*').eq('club_id', club.id).in('id', input.cart.map(l => l.productId).filter(id => UUID_RE.test(id))),
      payerIsActiveMember(db, club.id, payerUserId, payerEmail),
    ]);
    const priced = priceCart(input.cart, (products || []) as PricedProduct[], isMember);
    if (!priced.ok) return bad(priced.error);
    return {
      ok: true,
      draft: {
        ...base,
        label: `${club.name} shop order`,
        lines: priced.items.map(i => ({ name: i.size ? `${i.name} (${i.size})` : i.name, unit_cents: i.unit_cents, quantity: i.quantity })),
        row: {
          club_id: club.id, kind: 'shop_order', category: 'merchandise',
          member_id: null, sponsor_id: null, plan_id: null, package_id: null,
          description: describeItems(priced.items).slice(0, 500),
          amount_cents: priced.totalCents, currency,
          payer_name: input.buyerName, payer_email: input.buyerEmail,
          items: priced.items,
        },
      },
    };
  }

  if (input.kind === 'event_ticket') {
    if (!input.eventId) return bad('Event not found.', 404);
    if (!input.buyerName || !EMAIL_RE.test(input.buyerEmail)) return bad('Enter your name and a valid email.');
    // '*': ticket_member_price_cents only exists after migration 20261143
    const [{ data: event }, { data: left }, isMember] = await Promise.all([
      db.from('events').select('*').eq('id', input.eventId).eq('club_id', club.id).maybeSingle(),
      db.rpc('tickets_left', { p_event_id: input.eventId }),
      payerIsActiveMember(db, club.id, payerUserId, payerEmail),
    ]);
    // ponytail: the member price covers every ticket in the order (up to MAX_TICKETS_PER_ORDER), so a member can
    // buy cheap tickets for friends. Cap member-priced tickets per order if a club complains.
    // ponytail: capacity is checked here, not held: two buyers racing for the last seats can both pay. Reserve seats if clubs sell out often.
    const problem = ticketOrderError(event as TicketedEvent | null, input.quantity, typeof left === 'number' ? left : null);
    if (problem) return bad(problem, problem === 'Event not found.' ? 404 : 400);
    const item: OrderItem = { product_id: event!.id, name: `Ticket: ${event!.title}`, size: null, quantity: input.quantity, unit_cents: ticketUnitCents(event!, isMember) };
    return {
      ok: true,
      draft: {
        ...base,
        label: `${club.name}: ${event!.title} tickets`,
        lines: [{ name: item.name, unit_cents: item.unit_cents, quantity: item.quantity }],
        row: {
          club_id: club.id, kind: 'event_ticket', category: 'events_tickets',
          member_id: null, sponsor_id: null, plan_id: null, package_id: null,
          description: describeItems([item]).slice(0, 500),
          amount_cents: item.unit_cents * item.quantity, currency,
          payer_name: input.buyerName, payer_email: input.buyerEmail,
          items: [item], event_id: event!.id,
        },
      },
    };
  }

  if (input.kind === 'sponsorship') {
    if (!input.sponsorId) return bad('Choose a sponsorship package.');
    // access_key only exists after migration 20261132, so it's only asked for when a link sent one
    const sponsorColumns = `id, name, contact_name, contact_email, package_status${input.sponsorKey ? ', access_key, ends_on' : ''}`;
    const [{ data: sponsorRow }, invoice, { data: waiting }] = await Promise.all([
      db.from('sponsors').select(sponsorColumns).eq('id', input.sponsorId).eq('club_id', club.id).maybeSingle(),
      // SPP-2: an invoice the club sent before payment; paying it pays that invoice, whatever the link says
      openSponsorInvoice(db, input.sponsorId),
      // A bank transfer receipt the treasurer hasn't checked yet
      db.from('payments').select('id').eq('sponsor_id', input.sponsorId).eq('kind', 'sponsorship').eq('status', 'awaiting_review').limit(1).maybeSingle(),
    ]);
    const packageId = invoice?.package_id || input.packageId;
    if (!packageId) return bad('Choose a sponsorship package.');
    // '*' so max_sponsors (migration 20261137) is read once it exists. An invoiced package can be paid
    // even if the club has since stopped offering it.
    let pkgQuery = db.from('sponsorship_packages').select('*').eq('id', packageId).eq('club_id', club.id);
    if (!invoice) pkgQuery = pkgQuery.eq('is_active', true);
    const { data: pkg } = await pkgQuery.maybeSingle();
    const sponsor = sponsorRow as unknown as { id: string; name: string; contact_name: string | null; contact_email: string | null; package_status: string | null; access_key?: string | null; ends_on?: string | null } | null;
    if (!sponsor || !pkg || (invoice && invoice.club_id !== club.id)) return bad('Sponsorship not found.', 404);
    if (waiting) return bad(SPONSOR_RECEIPT_WAITING, 409);
    const renewing = !!input.sponsorKey && !!sponsor.access_key && sponsor.access_key === input.sponsorKey;
    if (sponsor.package_status !== 'prospect' && !renewing) return bad('This sponsorship is already set up. Please contact the club about payment.', 409);
    // SPE-1: the link's key renews only when a renewal is due, so an old payment or renewal link
    // opened again after paying can't take a second payment for the same term. An open invoice from
    // the club is always payable.
    if (!invoice && sponsor.package_status !== 'prospect' && !canPayRenewal(sponsor)) return bad(SPONSOR_ALREADY_PAID, 409);
    const amount = invoice ? invoice.amount_cents : pkg.price_cents;
    if (!(amount > 0)) return bad('This package has nothing to pay.');
    // SPP-4: a package with a limit that's sold out (someone else took the last one)
    if (!invoice && await packageIsFull(db, club.id, pkg, sponsor.id)) return bad(PACKAGE_TAKEN, 409);
    const label = `${club.name} sponsorship: ${pkg.name}`;
    return {
      ok: true,
      draft: {
        ...base,
        label,
        row: {
          club_id: club.id, kind: 'sponsorship', category: 'sponsorship',
          member_id: null, sponsor_id: sponsor.id, plan_id: null, package_id: pkg.id,
          description: invoice?.description || `${pkg.name}${sponsor.package_status !== 'prospect' ? ' renewal' : ''} (${sponsor.name})`,
          amount_cents: amount, currency: invoice?.currency || currency,
          payer_name: sponsor.contact_name || sponsor.name, payer_email: sponsor.contact_email,
        },
        ...(invoice ? { invoiceId: invoice.id } : {}),
      },
    };
  }

  if (!input.memberId || !input.planId) return bad('Choose a membership plan.');
  const [{ data: member }, { data: plan }] = await Promise.all([
    db.from('club_members').select('id, user_id, full_name, email, guardian_name, guardian_email, membership_status').eq('id', input.memberId).eq('club_id', club.id).maybeSingle(),
    db.from('membership_plans').select('id, name, price_cents').eq('id', input.planId).eq('club_id', club.id).eq('is_active', true).maybeSingle(),
  ]);
  if (!member || !plan) return bad('Membership not found.', 404);
  if (member.membership_status === 'rejected') return bad('This application was not approved. Please contact the club.', 409);
  if (input.kind === 'membership_signup' && member.membership_status !== 'pending') {
    return bad('This membership is already active. Use renewal instead.', 409);
  }
  const guardianEmail = (member.guardian_email || '').trim().toLowerCase();
  const isGuardian = !!guardianEmail && !!payerEmail && payerEmail.trim().toLowerCase() === guardianEmail;
  if (input.kind === 'membership_renewal' && !isGuardian && (!payerUserId || member.user_id !== payerUserId)) {
    return bad('Sign in as this member, or as their parent or guardian, to renew.', 403);
  }
  if (plan.price_cents <= 0) return bad('This plan has nothing to pay.');
  const label = `${club.name}: ${plan.name}${input.kind === 'membership_renewal' ? ' (renewal)' : ''}`;
  return {
    ok: true,
    draft: {
      ...base,
      label,
      row: {
        club_id: club.id, kind: input.kind, category: 'membership',
        member_id: member.id, sponsor_id: null, plan_id: plan.id, package_id: null,
        description: `${plan.name} (${member.full_name})`,
        amount_cents: plan.price_cents, currency,
        // Juniors' fees are paid by their parent or guardian, who gets the receipt
        ...(guardianEmail
          ? { payer_name: member.guardian_name || member.full_name, payer_email: guardianEmail }
          : { payer_name: member.full_name, payer_email: member.email }),
      },
    },
  };
}
