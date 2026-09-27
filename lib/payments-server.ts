import type { SupabaseClient } from '@supabase/supabase-js';

// Server-only: works out what a payer owes from ids alone. The amount always comes from the
// club's plan / package rows, never from the client.

export type PayableKind = 'membership_signup' | 'membership_renewal' | 'sponsorship';

export interface PaymentDraft {
  club: { id: string; slug: string; name: string };
  currency: string;
  stripeAccountId: string | null;
  stripeChargesEnabled: boolean;
  label: string;
  /** Columns for the payments row */
  row: {
    club_id: string;
    kind: PayableKind;
    category: 'membership' | 'sponsorship';
    member_id: string | null;
    sponsor_id: string | null;
    plan_id: string | null;
    package_id: string | null;
    description: string;
    amount_cents: number;
    currency: string;
    payer_name: string | null;
    payer_email: string | null;
  };
}

type Result = { ok: true; draft: PaymentDraft } | { ok: false; status: number; error: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuid = (v: unknown): string | null => (typeof v === 'string' && UUID_RE.test(v) ? v : null);

export function readPaymentInput(get: (key: string) => unknown) {
  const kind = get('kind');
  return {
    clubId: uuid(get('clubId')),
    kind: (['membership_signup', 'membership_renewal', 'sponsorship'].includes(kind as string) ? kind : null) as PayableKind | null,
    memberId: uuid(get('memberId')),
    sponsorId: uuid(get('sponsorId')),
    planId: uuid(get('planId')),
    packageId: uuid(get('packageId')),
  };
}

export async function preparePayment(db: SupabaseClient, input: ReturnType<typeof readPaymentInput>): Promise<Result> {
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

  if (input.kind === 'sponsorship') {
    if (!input.sponsorId || !input.packageId) return bad('Choose a sponsorship package.');
    const [{ data: sponsor }, { data: pkg }] = await Promise.all([
      db.from('sponsors').select('id, name, contact_name, contact_email').eq('id', input.sponsorId).eq('club_id', club.id).maybeSingle(),
      db.from('sponsorship_packages').select('id, name, price_cents').eq('id', input.packageId).eq('club_id', club.id).eq('is_active', true).maybeSingle(),
    ]);
    if (!sponsor || !pkg) return bad('Sponsorship not found.', 404);
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
    db.from('club_members').select('id, full_name, email, membership_status').eq('id', input.memberId).eq('club_id', club.id).maybeSingle(),
    db.from('membership_plans').select('id, name, price_cents').eq('id', input.planId).eq('club_id', club.id).eq('is_active', true).maybeSingle(),
  ]);
  if (!member || !plan) return bad('Membership not found.', 404);
  if (member.membership_status === 'rejected') return bad('This application was not approved. Please contact the club.', 409);
  if (input.kind === 'membership_signup' && member.membership_status !== 'pending') {
    return bad('This membership is already active. Use renewal instead.', 409);
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
