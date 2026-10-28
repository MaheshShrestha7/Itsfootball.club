import type { ClubSeason, Sponsor, SponsorSizeScale, SponsorshipPackage } from './supabase/types';
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

/** Today as YYYY-MM-DD in local time, to compare with a sponsor's ends_on */
export function localDateISO(now = Date.now()): string {
  const d = new Date(now);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** The sponsorship's end date has passed (they stay on the site to the end of that day) */
export function isPastEndDate(sponsor: { ends_on?: string | null }, now = Date.now()): boolean {
  return !!sponsor.ends_on && sponsor.ends_on < localDateISO(now);
}

/** Shown on the public club pages: switched on, not ended, and not past its end date. Admins load
 *  every sponsor row, so the public pages check this too and show admins what fans see. */
export function isSponsorOnSite(sponsor: Pick<Sponsor, 'is_active' | 'package_status'> & { ends_on?: string | null }, now = Date.now()): boolean {
  return sponsor.is_active !== false && sponsor.package_status !== 'expired' && sponsor.package_status !== 'cancelled'
    && !isPastEndDate(sponsor, now);
}

const DAY = 24 * 3600 * 1000;

/** An end date (YYYY-MM-DD) as "15 Nov 2026", read as a calendar day wherever the browser is */
export function formatEndDate(endsOn: string): string {
  const [y, m, d] = endsOn.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(DATE_LOCALE, { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Whole days from today until the end date (0 on the last day), or null with no end date */
export function daysUntilEnd(sponsor: { ends_on?: string | null }, now = Date.now()): number | null {
  if (!sponsor.ends_on) return null;
  const [y, m, d] = sponsor.ends_on.split('-').map(Number);
  const today = new Date(now);
  return Math.round((new Date(y, m - 1, d).getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) / DAY);
}

/** On the site and ending within the next 30 days: time to talk about renewing */
export function isEndingSoon(sponsor: Pick<Sponsor, 'is_active' | 'package_status'> & { ends_on?: string | null }, now = Date.now()): boolean {
  const days = daysUntilEnd(sponsor, now);
  return days !== null && days <= 30 && isSponsorOnSite(sponsor, now);
}

/** Renewing runs a year on from the old end date, or from today if that has passed.
 *  fulfil_payment (migration 20261132) does the same when a renewal is paid online. */
export function renewedEndDate(endsOn: string | null | undefined, now = Date.now()): string {
  const today = localDateISO(now);
  const from = endsOn && endsOn > today ? endsOn : today;
  const [y, m, d] = from.split('-').map(Number);
  // 29 Feb runs to 28 Feb, not 1 Mar
  const next = new Date(y + 1, m - 1, Math.min(d, new Date(y + 1, m, 0).getDate()));
  return localDateISO(next.getTime());
}

/** A new sponsorship's end date: the end of the club's current season, or the next season if the
 *  current one is over, otherwise twelve months from today */
export function defaultSponsorEnd(seasons: Pick<ClubSeason, 'start_date' | 'end_date' | 'is_current'>[], now = Date.now()): string {
  const today = localDateISO(now);
  const current = seasons.find(s => s.is_current && s.end_date >= today);
  if (current) return current.end_date;
  const next = seasons.filter(s => s.start_date > today && s.end_date).sort((a, b) => a.start_date.localeCompare(b.start_date))[0];
  return next?.end_date ?? renewedEndDate(today, now);
}

const STALE_SIGNUP_MS = 60 * DAY;

/** An unpaid website sign-up older than 60 days: offered to the admin to clear, never deleted by itself */
export function isStaleSignup(sponsor: Pick<Sponsor, 'is_active' | 'package_status' | 'created_at'>, now = Date.now()): boolean {
  if (sponsor.is_active || sponsor.package_status !== 'prospect' || !sponsor.created_at) return false;
  const created = Date.parse(sponsor.created_at);
  return !Number.isNaN(created) && now - created > STALE_SIGNUP_MS;
}

/** What the admin calls each logo size (stored as size_scale) */
export const LOGO_SIZE_LABEL: Record<SponsorSizeScale, string> = { auto: 'By tier', xl: 'Big', lg: 'Medium', md: 'Small', sm: 'Tiny' };

/**
 * New display_order values after moving one sponsor in a list sorted as fans see it (tier first).
 * A sponsor only moves among its own tier, since higher tiers always show first. Returns just the
 * sponsors whose number changed, numbered 1, 2, 3... down the whole list.
 */
export function reorderSponsors<T extends Pick<Sponsor, 'id' | 'tier' | 'display_order'>>(
  ordered: T[], id: string, toIndex: number
): { id: string; display_order: number }[] {
  const from = ordered.findIndex(s => s.id === id);
  if (from < 0) return [];
  const tier = ordered[from].tier;
  const first = ordered.findIndex(s => s.tier === tier);
  let last = first;
  while (last + 1 < ordered.length && ordered[last + 1].tier === tier) last++;
  const to = Math.max(first, Math.min(last, toIndex));
  const next = [...ordered];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next
    .map((s, i) => ({ id: s.id, display_order: i + 1, was: s.display_order }))
    .filter(s => s.display_order !== s.was)
    .map(({ id: sid, display_order }) => ({ id: sid, display_order }));
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

const DAY_MS = DAY;

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

/** The package a payment or renewal link is for. Sponsors don't store their package, so it's the
 *  club's priced package with the same tier and price, else the same tier, else the same price,
 *  else the club's only priced package. null when none fits: the admin sets the tier or value first. */
export function matchSponsorPackage<P extends Pick<SponsorshipPackage, 'id' | 'tier' | 'price_cents'>>(
  sponsor: Pick<Sponsor, 'tier' | 'package_value'>, packages: P[]
): P | null {
  const priced = packages.filter(p => p.price_cents > 0);
  const cents = sponsor.package_value != null ? Math.round(Number(sponsor.package_value) * 100) : null;
  return priced.find(p => p.tier === sponsor.tier && p.price_cents === cents)
    ?? priced.find(p => p.tier === sponsor.tier)
    ?? priced.find(p => p.price_cents === cents)
    ?? (priced.length === 1 ? priced[0] : null);
}

