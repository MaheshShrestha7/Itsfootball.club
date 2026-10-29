import type { SupabaseClient } from '@supabase/supabase-js';
import { CLUB_BRAND_COLUMNS, clubBaseUrl, type ClubBrandRow } from '@/lib/email/club-brand';
import { fetchPaged } from '@/lib/paged';
import { cleanAbn, invoiceIsTax } from '@/lib/invoice';
import { canPayRenewal, isSponsorKey, sponsorshipPaidFor, isSponsorOnSite, localDateISO, matchSponsorPackage, summariseSponsorEvents, type SponsorResults } from '@/lib/sponsors';
import type { Sponsor } from '@/lib/supabase/types';

// A sponsor's own private page (/{club}/sponsor/your-sponsorship?k=...), read on the server with
// the service role. The link's secret (sponsors.access_key, migration 20261132) is the only key:
// nothing here is readable from the browser's own Supabase session.

export type PortalClub = ClubBrandRow & { contact_email: string | null; stadium_address: string | null };

export interface PortalSponsorRow extends Sponsor {
  access_key: string;
}

/** The sponsor and their club for a link's secret, or null */
export async function findSponsorByKey(db: SupabaseClient, key: unknown): Promise<{ sponsor: PortalSponsorRow; club: PortalClub } | null> {
  if (!isSponsorKey(key)) return null;
  const { data: sponsor } = await db.from('sponsors').select('*').eq('access_key', key).maybeSingle();
  if (!sponsor) return null;
  const { data: club } = await db.from('clubs').select(`${CLUB_BRAND_COLUMNS}, contact_email, stadium_address`).eq('id', sponsor.club_id).maybeSingle();
  if (!club) return null;
  return { sponsor: sponsor as PortalSponsorRow, club: club as PortalClub };
}

export interface PortalPayment {
  id: string;
  description: string | null;
  packageName: string | null;
  amount_cents: number;
  currency: string;
  method: string;
  /** 'pending' is an invoice the club sent before payment, due by due_on (SPP-2) */
  status: 'paid' | 'awaiting_review' | 'pending';
  due_on: string | null;
  paid_at: string | null;
  created_at: string;
  /** A tax invoice (the club's GST registration and ABN when this payment was made, SPE-5) */
  taxInvoice: boolean;
  /** SPE-14: a renewal, and the period it pays for ("7 Nov 2026 to 7 Nov 2027") when known */
  renewal: boolean;
  period: string | null;
}

export interface PortalData {
  club: { name: string; slug: string; logo_url: string | null; primary_color: string | null; contact_email: string | null };
  sponsor: {
    name: string;
    tier: string;
    label: string | null;
    logo_url: string;
    website_url: string | null;
    ends_on: string | null;
    on_site: boolean;
    pending_logo_url: string | null;
    pending_website_url: string | null;
    pending_sent_at: string | null;
    /** What the club did with what they last sent (SPE-17, migration 20261136) */
    change_reviewed: 'used' | 'kept' | null;
    change_reviewed_at: string | null;
  };
  /** False until migration 20261133 adds the pending columns: the page then hides the upload */
  canSend: boolean;
  results: SponsorResults & { since: string };
  payments: PortalPayment[];
  /** The club is registered for GST and has an ABN: its invoices are tax invoices */
  taxInvoice: boolean;
  /** The renewal payment link, in the last 60 days or once ended */
  renewLink: string | null;
  /** Their payment link can take a payment now: a new sign-up, or a renewal that is due (SPE-1) */
  canPay: boolean;
  /** A bank transfer receipt is waiting for the club to check it */
  receiptWaiting: boolean;
  /** SPP-2: they can ask for an invoice to pay against (something to pay, and no invoice open yet) */
  canInvoice: boolean;
}

const DAY = 24 * 3600 * 1000;

/** Results run from the start of their current year (a year before the end date), or from when they
 *  joined, and never further back than a year */
export function resultsSince(sponsor: { ends_on?: string | null; created_at?: string }, now = Date.now()): string {
  const yearAgo = localDateISO(now - 365 * DAY);
  let from = sponsor.created_at ? sponsor.created_at.slice(0, 10) : yearAgo;
  if (sponsor.ends_on) {
    const end = new Date(`${sponsor.ends_on}T00:00:00Z`);
    end.setUTCFullYear(end.getUTCFullYear() - 1);
    const startOfTerm = end.toISOString().slice(0, 10);
    if (startOfTerm > from) from = startOfTerm;
  }
  return from < yearAgo ? yearAgo : from > localDateISO(now) ? localDateISO(now) : from;
}

export async function loadPortal(db: SupabaseClient, sponsor: PortalSponsorRow, club: PortalClub): Promise<PortalData> {
  const since = resultsSince(sponsor);
  const [{ data: events }, { data: payments }, { data: packages }, { data: settings }] = await Promise.all([
    fetchPaged<{ event_type: string; placement: string | null; visitor_hash: string | null }>(
      (from, to) => db.from('sponsor_analytics').select('event_type, placement, visitor_hash')
        .eq('sponsor_id', sponsor.id).gte('created_at', `${since}T00:00:00Z`).order('id').range(from, to),
      50000
    ),
    // '*' so the invoice snapshot columns (migration 20261135) are read once they exist
    db.from('payments').select('*')
      .eq('sponsor_id', sponsor.id).eq('kind', 'sponsorship').in('status', ['paid', 'awaiting_review', 'pending'])
      .order('created_at', { ascending: false }).limit(20),
    db.from('sponsorship_packages').select('id, name, tier, price_cents, is_active').eq('club_id', sponsor.club_id),
    // abn and gst_registered are from migration 20261133; before it runs this errors and data is null
    db.from('club_payment_settings').select('abn, gst_registered').eq('club_id', sponsor.club_id).maybeSingle(),
  ]);

  // A 'pending' row is an abandoned card checkout, unless it's an invoice the club sent (due_on, SPP-2)
  const shown = (payments || []).filter(p => p.status !== 'pending' || p.due_on);
  const packageName = new Map((packages || []).map(p => [p.id as string, p.name as string]));
  let renewLink: string | null = null;
  if (canPayRenewal(sponsor)) {
    const active = (packages || []).filter(p => p.is_active);
    const pkg = active.find(p => p.id === sponsor.package_id && p.price_cents > 0) || matchSponsorPackage(sponsor, active);
    if (pkg) renewLink = `${clubBaseUrl(club)}/sponsor?${new URLSearchParams({ pay: sponsor.id, package: pkg.id, k: sponsor.access_key })}`;
  }

  return {
    club: { name: club.name, slug: club.slug, logo_url: club.logo_url, primary_color: club.primary_color, contact_email: club.contact_email },
    sponsor: {
      name: sponsor.name,
      tier: sponsor.tier,
      label: sponsor.label ?? null,
      logo_url: sponsor.logo_url || '',
      website_url: sponsor.website_url || null,
      ends_on: sponsor.ends_on ?? null,
      on_site: isSponsorOnSite(sponsor),
      pending_logo_url: sponsor.pending_logo_url ?? null,
      pending_website_url: sponsor.pending_website_url ?? null,
      pending_sent_at: sponsor.pending_sent_at ?? null,
      change_reviewed: sponsor.change_reviewed ?? null,
      change_reviewed_at: sponsor.change_reviewed_at ?? null,
    },
    canSend: 'pending_sent_at' in sponsor,
    results: { ...summariseSponsorEvents(events), since },
    payments: shown.map(p => ({
      id: p.id,
      description: p.description,
      packageName: p.package_id ? packageName.get(p.package_id) ?? null : null,
      amount_cents: p.amount_cents,
      currency: p.currency,
      method: p.method,
      status: p.status,
      due_on: p.due_on ?? null,
      paid_at: p.paid_at,
      created_at: p.created_at,
      taxInvoice: invoiceIsTax(p, settings),
      ...sponsorshipPaidFor(p),
    })),
    taxInvoice: !!settings?.gst_registered && !!cleanAbn(settings.abn),
    renewLink,
    canPay: sponsor.package_status === 'prospect' || canPayRenewal(sponsor),
    receiptWaiting: shown.some(p => p.status === 'awaiting_review'),
    // Something to pay for, no invoice or receipt open, and a priced package that fits (as the invoice
    // route picks it). Before migration 20261137 there's no due_on, so nothing is open and the
    // invoice route says invoices aren't ready.
    canInvoice: (sponsor.package_status === 'prospect' || canPayRenewal(sponsor))
      && !shown.some(p => p.status === 'awaiting_review' || (p.status === 'pending' && p.due_on))
      && !!((packages || []).find(p => p.is_active && p.price_cents > 0 && p.id === sponsor.package_id) || matchSponsorPackage(sponsor, (packages || []).filter(p => p.is_active))),
  };
}
