import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';
import { listSitemapData } from '@/lib/supabase/club-lookup';
import { FORMAT_PAGES } from '@/lib/tool-pages';
import { GUIDES } from '@/lib/guides';
import { newsPath } from '@/lib/slugs';
import { COMPETITORS } from '@/lib/competitors';
import { MIN_INDEXABLE_TEAMS, isEventClub, tournamentPagePath } from '@/lib/public-tournaments';
import { groundSitemapEntries } from '@/lib/grounds';
import { clubsWithHomeGrounds, groundUse, listGrounds } from '@/lib/supabase/grounds-lookup';

// Generated per request from live data. Not ISR: open-next.config.ts has no incremental cache store,
// so on Cloudflare a revalidated sitemap would never be saved and the build-time copy would be served forever.
export const dynamic = 'force-dynamic';

// Only indexable pages. noindex routes (admin, check-in, availability, pass verification, My Clubs)
// are deliberately left out: listing them here would contradict their robots meta tag.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = Date.now();
  const [data, grounds, groundClubs] = await Promise.all([listSitemapData(), listGrounds(), clubsWithHomeGrounds()]);
  const { matches, events, news, teams, shopClubIds, galleryClubIds, teamCounts } = data;
  // Tournament-only clubs have no club pages, only their public tournament page (added below)
  const eventSlugById = new Map(data.clubs.filter(isEventClub).map(c => [c.id, c.slug]));
  const clubs = data.clubs.filter(c => !isEventClub(c));
  const tournaments = data.tournaments.filter(t => !eventSlugById.has(t.club_id));
  const slugById = new Map(clubs.map(c => [c.id, c.slug]));
  const url = (path: string) => `${SITE_URL}${path}`;
  const date = (...values: (string | null | undefined)[]) => {
    const t = values.map(v => (v ? Date.parse(v) : NaN)).filter(n => !isNaN(n) && n <= now);
    return t.length ? new Date(Math.max(...t)) : undefined;
  };

  const staticDate = new Date('2026-10-18T00:00:00Z');

  const entries: MetadataRoute.Sitemap = [
    { url: url('/'), lastModified: staticDate, changeFrequency: 'weekly', priority: 1 },
    { url: url('/pricing'), lastModified: staticDate, changeFrequency: 'monthly', priority: 0.8 },
    { url: url('/grounds'), lastModified: staticDate, changeFrequency: 'daily', priority: 0.8 },
    { url: url('/clubs'), lastModified: staticDate, changeFrequency: 'daily', priority: 0.8 },
    { url: url('/about'), lastModified: staticDate, changeFrequency: 'yearly', priority: 0.5 },
    { url: url('/create-club'), lastModified: staticDate, changeFrequency: 'monthly', priority: 0.7 },
    { url: url('/faq'), lastModified: staticDate, changeFrequency: 'monthly', priority: 0.5 },
    { url: url('/live-scores'), lastModified: staticDate, changeFrequency: 'monthly', priority: 0.6 },
    { url: url('/tools'), lastModified: staticDate, changeFrequency: 'monthly', priority: 0.7 },
    { url: url('/tools/lineup-builder'), lastModified: staticDate, changeFrequency: 'monthly', priority: 0.6 },
    { url: url('/tools/tournament-maker'), lastModified: staticDate, changeFrequency: 'monthly', priority: 0.6 },
    { url: url('/tools/match-result-graphic-maker'), lastModified: staticDate, changeFrequency: 'monthly', priority: 0.6 },
    { url: url('/tools/player-card-maker'), lastModified: staticDate, changeFrequency: 'monthly', priority: 0.6 },
    { url: url('/tools/equal-playing-time-calculator'), lastModified: staticDate, changeFrequency: 'monthly', priority: 0.6 },
    { url: url('/tools/season-fee-calculator'), lastModified: staticDate, changeFrequency: 'monthly', priority: 0.6 },
    ...FORMAT_PAGES.map(t => ({ url: url(t.path), lastModified: staticDate, changeFrequency: 'monthly' as const, priority: 0.5 })),
    { url: url('/guides'), lastModified: staticDate, changeFrequency: 'monthly', priority: 0.6 },
    ...GUIDES.map(g => ({ url: url(g.path), lastModified: staticDate, changeFrequency: 'monthly' as const, priority: 0.5 })),
    { url: url('/compare'), lastModified: staticDate, changeFrequency: 'monthly', priority: 0.7 },
    { url: url('/best-free-football-club-website-builders-australia'), lastModified: staticDate, changeFrequency: 'monthly', priority: 0.7 },
    ...COMPETITORS.map(c => ({ url: url(`/compare/${c.alternativeSlug}`), lastModified: staticDate, changeFrequency: 'monthly' as const, priority: 0.7 })),
    { url: url('/vs'), lastModified: staticDate, changeFrequency: 'monthly', priority: 0.6 },
    ...COMPETITORS.map(c => ({ url: url(`/vs/${c.slug}`), lastModified: staticDate, changeFrequency: 'monthly' as const, priority: 0.5 })),
    { url: url('/privacy'), lastModified: staticDate, changeFrequency: 'yearly', priority: 0.2 },
    { url: url('/terms'), lastModified: staticDate, changeFrequency: 'yearly', priority: 0.2 },
  ];

  for (const club of clubs) {
    const lastModified = date(club.updated_at);
    entries.push(
      { url: url(`/${club.slug}`), lastModified, changeFrequency: 'daily', priority: 0.9 },
      { url: url(`/${club.slug}/member`), lastModified, changeFrequency: 'monthly', priority: 0.5 },
      { url: url(`/${club.slug}/tournaments`), lastModified, changeFrequency: 'weekly', priority: 0.6 },
      { url: url(`/${club.slug}/about`), lastModified, changeFrequency: 'monthly', priority: 0.5 },
      { url: url(`/${club.slug}/sponsor`), changeFrequency: 'monthly', priority: 0.4 },
    );
    const clubTeams = teams.filter(t => t.club_id === club.id);
    if (clubTeams.length) entries.push({ url: url(`/${club.slug}/teams`), changeFrequency: 'weekly', priority: 0.6 });
    for (const t of clubTeams) entries.push({ url: url(`/${club.slug}/teams/${t.slug}`), changeFrequency: 'weekly', priority: 0.6 });
    if (shopClubIds.includes(club.id)) entries.push({ url: url(`/${club.slug}/shop`), changeFrequency: 'weekly', priority: 0.5 });
    if (galleryClubIds.includes(club.id)) entries.push({ url: url(`/${club.slug}/gallery`), changeFrequency: 'weekly', priority: 0.4 });
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

  for (const n of news) {
    const slug = slugById.get(n.club_id);
    if (!slug || !n.slug) continue;
    entries.push({
      url: url(newsPath(slug, n.slug)),
      lastModified: date(n.published_at, n.updated_at),
      changeFrequency: 'monthly',
      priority: 0.6,
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

  // Public tournament pages (/tournaments/{slug})
  for (const t of data.tournaments) {
    const slug = eventSlugById.get(t.club_id);
    if (!slug) continue;
    const running = !t.status || !['completed', 'archived', 'cancelled'].includes(t.status);
    entries.push({
      url: url(tournamentPagePath(slug)),
      lastModified: date(t.updated_at) || staticDate,
      changeFrequency: running ? 'daily' : 'monthly',
      priority: running ? 0.7 : 0.5,
    });
  }

  // Ground guides (lib/grounds.ts): only pages that pass their own indexing rule
  for (const g of groundSitemapEntries(grounds, groundUse(groundClubs).count)) {
    if (g.path === '/grounds' && entries.some(e => e.url === url('/grounds'))) continue;
    entries.push({ url: url(g.path), lastModified: date(g.lastModified) || staticDate, changeFrequency: 'weekly', priority: g.priority });
  }

  return entries;
}
