import type { SupabaseClient } from '@supabase/supabase-js';
import { describeItems, parseCart, priceCart, type OrderItem, type PricedProduct } from './shop';

// Server-only: works out what a payer owes from ids alone. The amount always comes from the
// club's plan / package / product rows, never from the client.

export type PayableKind = 'membership_signup' | 'membership_renewal' | 'sponsorship' | 'shop_order';

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
    category: 'membership' | 'sponsorship' | 'merchandise';
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
  };
}

type Result = { ok: true; draft: PaymentDraft } | { ok: false; status: number; error: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuid = (v: unknown): string | null => (typeof v === 'string' && UUID_RE.test(v) ? v : null);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const text = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/[<>]/g, '').trim().slice(0, max) : '');

export function readPaymentInput(get: (key: string) => unknown) {
  const kind = get('kind');
  return {
    clubId: uuid(get('clubId')),
    kind: (['membership_signup', 'membership_renewal', 'sponsorship', 'shop_order'].includes(kind as string) ? kind : null) as PayableKind | null,
    memberId: uuid(get('memberId')),
    sponsorId: uuid(get('sponsorId')),
    planId: uuid(get('planId')),
    packageId: uuid(get('packageId')),
    cart: parseCart(get('items')),
    buyerName: text(get('buyerName'), 120),
    buyerEmail: text(get('buyerEmail'), 255).toLowerCase(),
  };
}

/**
 * Who may pay for what (these routes are public, and ids alone must not be enough):
 *   membership_signup   a pending application; its id is only known to the applicant (club_members is not public)
 *   membership_renewal  only the signed-in member themselves (`payerUserId` from their session)
 *   sponsorship         a sponsor still at 'prospect', i.e. one that just applied; active sponsors' ids are public
 *   shop_order          anyone: it pays for new goods, never for someone else's record
 */
export async function preparePayment(
  db: SupabaseClient,
  input: ReturnType<typeof readPaymentInput>,
  payerUserId: string | null = null
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
    const { data: products } = await db.from('shop_products').select('id, name, price_cents, sizes, is_active')
      .eq('club_id', club.id).in('id', input.cart.map(l => l.productId).filter(id => UUID_RE.test(id)));
    const priced = priceCart(input.cart, (products || []) as PricedProduct[]);
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

  if (input.kind === 'sponsorship') {
    if (!input.sponsorId || !input.packageId) return bad('Choose a sponsorship package.');
    const [{ data: sponsor }, { data: pkg }] = await Promise.all([
      db.from('sponsors').select('id, name, contact_name, contact_email, package_status').eq('id', input.sponsorId).eq('club_id', club.id).maybeSingle(),
      db.from('sponsorship_packages').select('id, name, price_cents').eq('id', input.packageId).eq('club_id', club.id).eq('is_active', true).maybeSingle(),
    ]);
    if (!sponsor || !pkg) return bad('Sponsorship not found.', 404);
    if (sponsor.package_status !== 'prospect') return bad('This sponsorship is already set up. Please contact the club about payment.', 409);
    if (pkg.price_cents <= 0) return bad('This package has nothing to pay.');
    const label = `${club.name} sponsorship: ${pkg.name}`;
    return {
      ok: true,
      draft: {
        ...base,
        label,
        row: {
          club_id: club.id, kind: 'sponsorship', category: 'sponsorship',
          member_id: null, sponsor_id: sponsor.id, plan_id: null, package_id: pkg.id,
          description: `${pkg.name} (${sponsor.name})`,
          amount_cents: pkg.price_cents, currency,
          payer_name: sponsor.contact_name || sponsor.name, payer_email: sponsor.contact_email,
        },
      },
    };
  }

  if (!input.memberId || !input.planId) return bad('Choose a membership plan.');
  const [{ data: member }, { data: plan }] = await Promise.all([
    db.from('club_members').select('id, user_id, full_name, email, membership_status').eq('id', input.memberId).eq('club_id', club.id).maybeSingle(),
    db.from('membership_plans').select('id, name, price_cents').eq('id', input.planId).eq('club_id', club.id).eq('is_active', true).maybeSingle(),
  ]);
  if (!member || !plan) return bad('Membership not found.', 404);
  if (member.membership_status === 'rejected') return bad('This application was not approved. Please contact the club.', 409);
  if (input.kind === 'membership_signup' && member.membership_status !== 'pending') {
    return bad('This membership is already active. Use renewal instead.', 409);
  }
  if (input.kind === 'membership_renewal' && (!payerUserId || member.user_id !== payerUserId)) {
    return bad('Sign in as this member to renew.', 403);
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
        payer_name: member.full_name, payer_email: member.email,
      },
    },
  };
}
