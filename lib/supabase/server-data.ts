import { cache } from 'react';
import { headers } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { SupabaseSync, type EntityKey, type SyncState } from './sync';
import { clubSlugFromPath } from '../slugs';

// A slow database shouldn't hold the whole page: past this the browser loads the data itself, as before
const TIMEOUT_MS = 3000;
// Search engines and AI crawlers mostly read the HTML without running JavaScript, so for them the
// page is worth waiting for: a timeout would hand them a "Loading..." screen instead of the club's
// content. The content is the same a visitor gets once the page has loaded.
const CRAWLER_TIMEOUT_MS = 10000;
// Named crawlers only: a bare "bot" would also match phone models such as "CUBOT" in Android browsers.
// Link-preview fetchers (WhatsApp, Facebook, Slack...) are left out on purpose: they only read the
// meta tags, which don't depend on this data, and some give up on a slow response.
const CRAWLER_UA = new RegExp(
  [
    'googlebot', 'google-inspectiontool', 'bingbot', 'duckduckbot', 'yandexbot', 'baiduspider', 'applebot',
    'gptbot', 'oai-searchbot', 'chatgpt-user', 'claudebot', 'claude-user', 'claude-searchbot',
    'perplexitybot', 'perplexity-user', 'ccbot', 'amazonbot', 'meta-externalagent', 'petalbot', 'bytespider',
  ].join('|'),
  'i'
);
// Loads slower than this are logged (Cloudflare Workers logs), as are timeouts
const SLOW_LOG_MS = 1500;

// Tables no public page shows (member inbox, gate scans, contact messages, draft lineups): the
// server render is always signed out, so reading them only adds requests and delays the page.
// The browser's own load still fetches them for signed-in users.
const NOT_SERVER_RENDERED: EntityKey[] = ['memberMessages', 'gateScans', 'inquiries', 'draftLineups'];

export function isCrawler(userAgent: string | null | undefined): boolean {
  return !!userAgent && CRAWLER_UA.test(userAgent);
}

/** One load per request and club slug ('' = platform pages), shared by every layout that asks */
const loadForSlug = cache(async (slug: string): Promise<Partial<SyncState> | null> => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;

  const crawler = isCrawler((await headers()).get('user-agent'));
  const limit = crawler ? CRAWLER_TIMEOUT_MS : TIMEOUT_MS;
  const started = Date.now();
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const load = new SupabaseSync(client)
    .load({ slug, clubIds: [], skip: NOT_SERVER_RENDERED })
    .then(({ data, errors }) => {
      const ms = Date.now() - started;
      if (ms > SLOW_LOG_MS || errors.length) {
        console.warn(`server data "${slug || '(platform)'}": ${ms} ms${ms > limit ? ` (over the ${limit} ms limit)` : ''}${errors.length ? `, errors: ${errors.join('; ')}` : ''}`);
      }
      return data;
    })
    .catch(err => {
      console.warn(`server data "${slug || '(platform)'}" failed after ${Date.now() - started} ms`, err);
      return null;
    });
  let done = false;
  load.finally(() => (done = true));
  const timeout = new Promise<null>(resolve =>
    setTimeout(() => {
      // The finishing time above may never be logged: the worker can stop once the page is sent
      if (!done) console.warn(`server data "${slug || '(platform)'}": timed out at ${limit} ms${crawler ? ' (crawler)' : ''}`);
      resolve(null);
    }, limit)
  );
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
