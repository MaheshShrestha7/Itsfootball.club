import type { Sponsor } from './supabase/types';
import { DATE_LOCALE } from './dates';

const TIER_RANK: Record<string, number> = { platinum: 0, gold: 1, silver: 2, bronze: 3, grassroots: 4 };

/** A sponsor's website link, only if it is a real web address (blocks javascript:, data: and the like) */
export function sponsorHref(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.href : undefined;
  } catch {
    return undefined;
  }
}

/** A link set by an admin: a web address (as sponsorHref) or a path on this site such as /tools */
export function safeLinkHref(url: string | null | undefined): string | undefined {
  const trimmed = (url || '').trim();
  if (/^\/(?![/\\])/.test(trimmed) && !/\s/.test(trimmed)) return trimmed;
  return sponsorHref(trimmed || undefined);
}

/** Shown on the public club pages: switched on and not ended. Admins load every sponsor row,
 *  so the public pages check this too and show admins what fans see. */
export function isSponsorOnSite(sponsor: Pick<Sponsor, 'is_active' | 'package_status'>): boolean {
  return sponsor.is_active !== false && sponsor.package_status !== 'expired' && sponsor.package_status !== 'cancelled';
}

const SIGNUP_FRESH_MS = 14 * 24 * 3600 * 1000;

/** Where a website sign-up is up to, for the admin's "Needs you" list and New sign-ups view:
 *  'paid' (hidden, waiting for an admin to tap Put on site), 'unpaid' (a fresh, hidden prospect),
 *  or null for everything else. Older unpaid prospects stay on the Sponsors page but stop nagging. */
export function sponsorSignupStage(
  sponsor: Pick<Sponsor, 'is_active' | 'package_status' | 'created_at'>,
  now = Date.now()
): 'paid' | 'unpaid' | null {
  if (sponsor.is_active) return null;
  if (sponsor.package_status === 'paid') return 'paid';
  if (sponsor.package_status !== 'prospect') return null;
  const created = sponsor.created_at ? Date.parse(sponsor.created_at) : NaN;
  // Just arrived live (no created_at yet) counts as new
  return Number.isNaN(created) || now - created < SIGNUP_FRESH_MS ? 'unpaid' : null;
}

/** Highest tier first (platinum, gold, silver, bronze, grassroots), then the admin's display order */
export function sortSponsorsByTier<T extends Pick<Sponsor, 'tier' | 'display_order'>>(list: T[]): T[] {
  return [...list].sort(
    (a, b) => (TIER_RANK[a.tier] ?? 9) - (TIER_RANK[b.tier] ?? 9) || (a.display_order ?? 0) - (b.display_order ?? 0)
  );
}

const TIER_LABEL: Record<string, string> = {
  platinum: 'Platinum Partner',
  gold: 'Gold Partner',
  silver: 'Silver Partner',
  bronze: 'Bronze Partner',
  grassroots: 'Grassroots Partner',
};

/** What each tier is called on club pages, from the sponsor's tier in the database */
export function sponsorTierLabel(tier: string | undefined): string {
  return (tier && TIER_LABEL[tier]) || 'Club Partner';
}

/** A sponsor's badge text: what the admin typed, otherwise the tier name */
export function sponsorLabel(sponsor: { tier?: string; label?: string | null }): string {
  return sponsor.label?.trim() || sponsorTierLabel(sponsor.tier);
}

const DAY_MS = 24 * 3600 * 1000;

/** The Sponsor Report chart's bars for the range picked: one a day for up to 31 days, otherwise
 *  one a week. Each bar runs from start (inclusive) to end (exclusive), in local time. */
export function chartBuckets(since: Date, until: Date): { label: string; start: number; end: number }[] {
  const first = new Date(since.getFullYear(), since.getMonth(), since.getDate()).getTime();
  const last = until.getTime();
  if (!(last > first)) return [];
  const days = Math.ceil((last - first) / DAY_MS);
  const step = days <= 31 ? 1 : 7;
  const buckets: { label: string; start: number; end: number }[] = [];
  for (let i = 0; i < days; i += step) {
    // Built from the calendar date, so a daylight-saving change doesn't shift a bar by an hour
    const startDate = new Date(since.getFullYear(), since.getMonth(), since.getDate() + i);
    const start = startDate.getTime();
    const end = Math.min(new Date(since.getFullYear(), since.getMonth(), since.getDate() + i + step).getTime(), last + 1);
    const label = startDate.toLocaleDateString(DATE_LOCALE, { day: 'numeric', month: 'short' });
    buckets.push({ label: step === 7 ? `w/c ${label}` : label, start, end });
  }
  return buckets;
}
