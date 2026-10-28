import type { ClubSeason, Sponsor, SponsorSizeScale, SponsorshipPackage } from './supabase/types';
import type { CSSProperties } from 'react';
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

/** How many days before the end date a sponsor can pay to renew (the renewal link works, and their
 *  page offers "Renew for another year") */
export const RENEWAL_WINDOW_DAYS = 60;

/** A sponsor that is already set up may pay again only to renew: from 60 days before their end date,
 *  after it, or once the club has ended the sponsorship. Anything else is a second payment for the
 *  same term, e.g. an old "Finish your sponsorship" link opened after paying (SPE-1). */
export function canPayRenewal(sponsor: { package_status?: string | null; ends_on?: string | null }, now = Date.now()): boolean {
  if (!sponsor.package_status || sponsor.package_status === 'prospect') return false;
  if (sponsor.package_status === 'expired' || sponsor.package_status === 'cancelled') return true;
  const days = daysUntilEnd(sponsor, now);
  return days !== null && days <= RENEWAL_WINDOW_DAYS;
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


/** Where a sponsor logo shows, in the words a volunteer or a sponsor would use (sponsor_analytics.placement) */
export const PLACEMENT_LABELS: Record<string, string> = {
  club_home_showcase: 'Home page',
  footer_marquee: 'Every page footer',
  match_center_marquee: 'Match pages',
  event_page: 'Event pages',
  supported_by: 'Match reports and news',
};

export const placementName = (placement: string | null | undefined) =>
  (placement && PLACEMENT_LABELS[placement]) || 'Other pages';

/** The link to a sponsor's own private page (SP-F1/F3/F4). base is the club's site, e.g.
 *  "https://itsfootball.club/riverside-rovers-fc" or "https://riversiderovers.com.au" */
export function sponsorPageUrl(base: string, accessKey: string): string {
  return `${base.replace(/\/$/, '')}/sponsor/your-sponsorship?k=${encodeURIComponent(accessKey)}`;
}

/** A sponsor link's secret (sponsors.access_key): 64 lowercase hex characters */
export const isSponsorKey = (key: unknown): key is string => typeof key === 'string' && /^[0-9a-f]{64}$/.test(key);

export interface SponsorResults {
  /** Times the logo was shown */
  seen: number;
  /** Different browsers that saw it (an estimate of people) */
  people: number;
  /** Clicks through to their website */
  clicks: number;
  /** Most seen first */
  byPlacement: { placement: string; label: string; seen: number; clicks: number }[];
}

/** Totals for sponsor_analytics rows, in plain terms (the sponsor's page and the admin report) */
export function summariseSponsorEvents(rows: { event_type: string; placement?: string | null; visitor_hash?: string | null }[]): SponsorResults {
  const people = new Set<string>();
  const places = new Map<string, { seen: number; clicks: number }>();
  let seen = 0;
  let clicks = 0;
  for (const r of rows) {
    if (r.event_type !== 'impression' && r.event_type !== 'click') continue;
    const key = r.placement && PLACEMENT_LABELS[r.placement] ? r.placement : 'other';
    const place = places.get(key) || { seen: 0, clicks: 0 };
    if (r.event_type === 'impression') {
      seen++;
      place.seen++;
      if (r.visitor_hash) people.add(r.visitor_hash);
    } else {
      clicks++;
      place.clicks++;
    }
    places.set(key, place);
  }
  const byPlacement = [...places.entries()]
    .map(([placement, v]) => ({ placement, label: placementName(placement), ...v }))
    .sort((a, b) => b.seen - a.seen || b.clicks - a.clicks);
  return { seen, people: people.size, clicks, byPlacement };
}

// Each tier's badge in its own colour, matching the tier badges on the club page
export const TIER_BADGE: Record<string, CSSProperties> = {
  platinum: { background: 'rgba(245, 158, 11, 0.2)', color: 'var(--c-amber)', border: '1px solid rgba(245, 158, 11, 0.4)' },
  gold: { background: 'rgba(234, 179, 8, 0.15)', color: 'var(--c-amber)', border: '1px solid rgba(234, 179, 8, 0.3)' },
  silver: { background: 'rgba(148, 163, 184, 0.15)', color: 'var(--text-secondary)', border: '1px solid rgba(148, 163, 184, 0.35)' },
  bronze: { background: 'rgba(180, 83, 9, 0.15)', color: 'var(--c-amber)', border: '1px solid rgba(180, 83, 9, 0.35)' },
  grassroots: { background: 'rgba(16, 185, 129, 0.12)', color: 'var(--c-green)', border: '1px solid rgba(16, 185, 129, 0.3)' },
};

/** The sponsor sent a new logo or website from their page that the admin hasn't checked yet */
export const hasSentChange = (s: { pending_sent_at?: string | null; pending_logo_url?: string | null; pending_website_url?: string | null }) =>
  !!s.pending_sent_at && !!(s.pending_logo_url || s.pending_website_url);

/** A website someone typed, with https:// added when they left it off ("acme.com.au"), or undefined
 *  unless it's a real web address (as sponsorHref) with a domain like acme.com.au (SPE-4: the form
 *  box is plain text now, so "not a website" must not become https://not%20a%20website/) */
export function typedWebsite(input: string | null | undefined): string | undefined {
  const v = (input || '').trim();
  if (!v || /\s/.test(v)) return undefined;
  const href = sponsorHref(/^[a-z][a-z0-9+.-]*:/i.test(v) ? v : `https://${v}`);
  return href && /^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z][a-z0-9-]+$/i.test(new URL(href).hostname) ? href : undefined;
}

/** The places a package can say it includes (sponsorship_packages.includes keys), in plain words:
 *  `admin` is the short tick label in the package editor, `card` the line on the public package card */
export const PACKAGE_INCLUDES = [
  { key: 'home_page', admin: 'Home page', card: 'Logo on the home page' },
  { key: 'footer', admin: 'Every page footer', card: 'Logo in the footer of every page' },
  { key: 'match_pages', admin: 'Match pages', card: 'Logo on every match page' },
  { key: 'match_graphics', admin: 'Match graphics', card: 'Logo on match result graphics' },
  { key: 'reports_news', admin: 'Match reports and news', card: '"Supported by" on match reports and news' },
  { key: 'event_pages', admin: 'Event pages', card: 'Logo on event pages' },
] as const;

const INCLUDE_KEYS = new Set<string>(PACKAGE_INCLUDES.map(i => i.key));

/** A package's ticks split into the fixed places (in PACKAGE_INCLUDES order) and the club's own extras */
export function packageIncludes(includes: string[] | null | undefined): { places: string[]; extras: string[] } {
  const list = includes || [];
  return {
    places: PACKAGE_INCLUDES.filter(i => list.includes(i.key)).map(i => i.key),
    extras: list.filter(i => !INCLUDE_KEYS.has(i)).map(i => i.trim()).filter(Boolean),
  };
}

/** The lines on a public package card: the ticked places in plain words, then the extras */
export function packageIncludeLines(includes: string[] | null | undefined): string[] {
  const { places, extras } = packageIncludes(includes);
  return [...PACKAGE_INCLUDES.filter(i => places.includes(i.key)).map(i => i.card), ...extras];
}

/** The list to save from the editor's ticks and its extras box (one per line), within the database's limits */
export function buildPackageIncludes(places: string[], extrasText: string): string[] {
  const extras = extrasText.split('\n').map(l => l.trim().slice(0, 80)).filter(l => l && !INCLUDE_KEYS.has(l));
  return [...PACKAGE_INCLUDES.filter(i => places.includes(i.key)).map(i => i.key), ...new Set(extras)].slice(0, 16);
}

/** The sponsors for the "Supported by" strip: the highest tier on the site, at most `max` */
export function topTierSponsors<T extends Pick<Sponsor, 'tier' | 'display_order'>>(onSite: T[], max = 4): T[] {
  const sorted = sortSponsorsByTier(onSite);
  return sorted.filter(s => s.tier === sorted[0]?.tier).slice(0, max);
}
