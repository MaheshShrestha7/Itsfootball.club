import type { Sponsor } from './supabase/types';

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
