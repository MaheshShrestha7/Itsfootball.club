import type { Sponsor } from './supabase/types';

const TIER_RANK: Record<string, number> = { platinum: 0, gold: 1, silver: 2, bronze: 3, grassroots: 4 };

/** Highest tier first (platinum, gold, silver, bronze, grassroots), then the admin's display order */
export function sortSponsorsByTier<T extends Pick<Sponsor, 'tier' | 'display_order'>>(list: T[]): T[] {
  return [...list].sort(
    (a, b) => (TIER_RANK[a.tier] ?? 9) - (TIER_RANK[b.tier] ?? 9) || (a.display_order ?? 0) - (b.display_order ?? 0)
  );
}
