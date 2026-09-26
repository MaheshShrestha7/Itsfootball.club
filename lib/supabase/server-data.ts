import { cache } from 'react';
import { createClient } from '@supabase/supabase-js';
import { SupabaseSync, type SyncState } from './sync';
import { clubSlugFromPath } from '../slugs';

// A slow database shouldn't hold the whole page: past this the browser loads the data itself, as before
const TIMEOUT_MS = 3000;

/** One load per request and club slug ('' = platform pages), shared by every layout that asks */
const loadForSlug = cache(async (slug: string): Promise<Partial<SyncState> | null> => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;

  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const load = new SupabaseSync(client)
    .load({ slug, clubIds: [] })
    .then(({ data }) => data)
    .catch(() => null);
  const timeout = new Promise<null>(resolve => setTimeout(() => resolve(null), TIMEOUT_MS));
  return Promise.race([load, timeout]);
});

/**
 * The public data a page starts with, loaded on the server so the first HTML already holds the
 * page (for search engines and a fast first paint) instead of a loading screen. Same query and
 * scope a signed-out browser uses: the club in the URL, plus platform-wide clubs and sponsors.
 * Null when Supabase isn't configured, fails or is too slow.
 */
export function loadInitialData(pathname: string): Promise<Partial<SyncState> | null> {
  return loadForSlug(clubSlugFromPath(pathname));
}

/**
 * Whether an active club lives at this slug (its current one or an old one), read from this
 * request's data rather than a cached club list, so a club renamed a moment ago is found.
 * Fails open (true) when the data couldn't be loaded; the page then decides for itself.
 */
export async function clubExists(slug: string): Promise<boolean> {
  const clean = clubSlugFromPath(`/${slug}`);
  const clubs = (await loadForSlug(clean))?.clubs as { slug?: string; previous_slugs?: string[] }[] | undefined;
  if (!clubs) return true;
  return clubs.some(
    c => c.slug?.toLowerCase() === clean || c.previous_slugs?.some(prev => prev?.toLowerCase() === clean)
  );
}
