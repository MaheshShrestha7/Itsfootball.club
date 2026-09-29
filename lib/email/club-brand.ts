import type { SupabaseClient } from '@supabase/supabase-js';
import { SITE_URL } from '@/lib/seo';
import { clubSlugFromPath, isPlatformHost } from '@/lib/slugs';
import type { EmailBrand } from './templates';

export const CLUB_BRAND_COLUMNS = 'id, slug, name, logo_url, primary_color, custom_domain';

export interface ClubBrandRow {
  id: string;
  slug: string;
  name: string;
  logo_url: string | null;
  primary_color: string | null;
  custom_domain: string | null;
}

/** Public base URL of a club's site: its own domain when it has one */
export const clubBaseUrl = (club: Pick<ClubBrandRow, 'slug' | 'custom_domain'>) =>
  club.custom_domain ? `https://${club.custom_domain}` : `${SITE_URL}/${club.slug}`;

export const clubBrand = (club: ClubBrandRow): EmailBrand => ({
  name: club.name,
  logoUrl: club.logo_url,
  color: club.primary_color,
  url: clubBaseUrl(club),
});

/** The club a redirect URL belongs to: by custom domain, else by the first path segment */
export async function clubForUrl(db: SupabaseClient, url: string): Promise<ClubBrandRow | null> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const host = parsed.host.toLowerCase();
  const query = db.from('clubs').select(CLUB_BRAND_COLUMNS).eq('is_active', true);
  if (!isPlatformHost(host)) {
    const { data } = await query.eq('custom_domain', host).maybeSingle();
    return (data as ClubBrandRow | null) ?? null;
  }
  const slug = clubSlugFromPath(parsed.pathname);
  if (!slug) return null;
  const { data } = await query.eq('slug', slug).maybeSingle();
  return (data as ClubBrandRow | null) ?? null;
}
