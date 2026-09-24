import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';
import { listSitemapData } from '@/lib/supabase/club-lookup';

// Generated per request from live data. Not ISR: open-next.config.ts has no incremental cache store,
// so on Cloudflare a revalidated sitemap would never be saved and the build-time copy would be served forever.
export const dynamic = 'force-dynamic';

// Only indexable pages. noindex routes (admin, check-in, availability, pass verification, My Clubs)
// are deliberately left out: listing them here would contradict their robots meta tag.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = Date.now();
  const { clubs, matches, events, tournaments } = await listSitemapData();
  const slugById = new Map(clubs.map(c => [c.id, c.slug]));
  const url = (path: string) => `${SITE_URL}${path}`;
  const date = (...values: (string | null | undefined)[]) => {
    const t = values.map(v => (v ? Date.parse(v) : NaN)).filter(n => !isNaN(n) && n <= now);
    return t.length ? new Date(Math.max(...t)) : undefined;
  };

  const entries: MetadataRoute.Sitemap = [
    { url: url('/'), changeFrequency: 'weekly', priority: 1 },
    { url: url('/clubs'), changeFrequency: 'daily', priority: 0.8 },
    { url: url('/create-club'), changeFrequency: 'monthly', priority: 0.7 },
  ];

  for (const club of clubs) {
    const lastModified = date(club.updated_at);
    entries.push(
      { url: url(`/${club.slug}`), lastModified, changeFrequency: 'daily', priority: 0.9 },
      { url: url(`/${club.slug}/member`), lastModified, changeFrequency: 'monthly', priority: 0.5 },
      { url: url(`/${club.slug}/tournaments`), lastModified, changeFrequency: 'weekly', priority: 0.6 },
    );
  }

  for (const m of matches) {
    const slug = slugById.get(m.club_id);
    if (!slug) continue; // match of an inactive club
    const kickoff = m.match_date ? Date.parse(m.match_date) : NaN;
    const live = m.status === 'live' || m.status === 'halftime';
    const upcoming = !live && !['completed', 'full_time', 'cancelled'].includes(m.status) && (isNaN(kickoff) || kickoff > now - 3 * 3600 * 1000);
    entries.push({
      url: url(`/${slug}/match/${m.id}`),
      lastModified: date(m.created_at, m.match_date),
      changeFrequency: live ? 'always' : upcoming ? 'hourly' : 'monthly',
      priority: live ? 0.9 : upcoming ? 0.8 : 0.6,
    });
  }

  for (const e of events) {
    const slug = slugById.get(e.club_id);
    if (!slug) continue;
    const future = e.start_time ? Date.parse(e.start_time) > now : true;
    entries.push({
      url: url(`/${slug}/events/${e.id}`),
      lastModified: date(e.created_at),
      changeFrequency: future ? 'weekly' : 'yearly',
      priority: future ? 0.7 : 0.4,
    });
  }

  for (const t of tournaments) {
    const slug = slugById.get(t.club_id);
    if (!slug) continue;
    const running = !t.status || !['completed', 'archived', 'cancelled'].includes(t.status);
    entries.push({
      url: url(`/${slug}/tournaments/${t.id}`),
      lastModified: date(t.updated_at),
      changeFrequency: running ? 'daily' : 'monthly',
      priority: running ? 0.7 : 0.5,
    });
  }

  return entries;
}
