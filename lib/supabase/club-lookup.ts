import { fetchPaged } from '../paged';

// Lightweight server-side lookups for <title>/OG metadata (findClubBySlug and friends) and the sitemap.
// Mirrors the slug/previous_slugs matching logic in lib/club-context.tsx's selectClubBySlug.

export interface ClubMetadataRow {
  id: string;
  name: string;
  short_name: string;
  motto: string | null;
  logo_url: string | null;
  banner_url: string | null;
  slug: string;
  previous_slugs: string[] | null;
  stadium_name: string | null;
  stadium_address: string | null;
  founded_year: number | null;
}

async function fetchActiveClubs(): Promise<ClubMetadataRow[] | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) return null;

  try {
    const res = await fetch(
      `${url}/rest/v1/clubs?select=id,name,short_name,motto,logo_url,banner_url,slug,previous_slugs,stadium_name,stadium_address,founded_year&is_active=eq.true`,
      {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
        next: { revalidate: 30 },
      }
    );
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function findClubBySlug(slug: string): Promise<ClubMetadataRow | null> {
  if (!slug) return null;
  const clubs = await fetchActiveClubs();
  if (!clubs) return null;
  const clean = slug.toLowerCase();
  return (
    clubs.find(c => c.slug?.toLowerCase() === clean) ||
    clubs.find(c => c.previous_slugs?.some(prev => prev?.toLowerCase() === clean)) ||
    null
  );
}

export interface MatchMetadataRow {
  id: string;
  club_id: string;
  home_team_name: string;
  away_team_name: string;
  home_score: number;
  away_score: number;
  status: string;
  competition: string | null;
  match_date: string;
  venue: string | null;
  is_club_home: boolean | null;
  home_team_logo: string | null;
  away_team_logo: string | null;
}

export async function findMatchById(matchId: string): Promise<MatchMetadataRow | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key || !matchId) return null;

  try {
    const res = await fetch(
      `${url}/rest/v1/matches?select=id,club_id,home_team_name,away_team_name,home_score,away_score,status,competition,match_date,venue,is_club_home,home_team_logo,away_team_logo&id=eq.${encodeURIComponent(matchId)}`,
      {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
        next: { revalidate: 30 },
      }
    );
    if (!res.ok) return null;
    const rows: MatchMetadataRow[] = await res.json();
    return rows[0] || null;
  } catch {
    return null;
  }
}

async function fetchOne<T>(table: string, select: string, id: string): Promise<T | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  try {
    const res = await fetch(`${url}/rest/v1/${table}?select=${select}&id=eq.${id}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    const rows: T[] = await res.json();
    return rows[0] || null;
  } catch {
    return null;
  }
}

export interface EventMetadataRow {
  id: string;
  club_id: string;
  title: string;
  category: string | null;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  description: string | null;
}

/** Public events only (row-level security hides private ones from the anon key). */
export const findEventById = (eventId: string) =>
  fetchOne<EventMetadataRow>('events', 'id,club_id,title,category,start_time,end_time,location,description', eventId);

export interface TournamentMetadataRow {
  id: string;
  club_id: string;
  name: string;
  season: string | null;
  format: string | null;
  venue: string | null;
  banner_url: string | null;
  start_date: string | null;
  end_date: string | null;
  description: string | null;
}

export const findTournamentById = (tournamentId: string) =>
  fetchOne<TournamentMetadataRow>('tournaments', 'id,club_id,name,season,format,venue,banner_url,start_date,end_date,description', tournamentId);

export interface NewsMetadataRow {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  cover_image_url: string | null;
  author_name: string | null;
  tags: string[] | null;
  published_at: string;
}

/** A club's published news, newest first */
export async function listClubNews(clubId: string, limit = 20): Promise<NewsMetadataRow[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key || !/^[0-9a-f-]{36}$/i.test(clubId)) return [];
  try {
    const res = await fetch(
      `${url}/rest/v1/news_articles?select=id,title,slug,summary,cover_image_url,author_name,tags,published_at&club_id=eq.${clubId}&published_at=lte.${new Date().toISOString().slice(0, 13)}:59:59Z&order=published_at.desc&limit=${limit}`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` }, next: { revalidate: 60 } }
    );
    return res.ok ? await res.json() : [];
  } catch {
    return [];
  }
}

/** Up to 5,000 rows of a REST query, a page at a time (Supabase returns at most 1,000 per request) */
async function fetchRows<T>(query: string, max = 5000): Promise<T[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return [];
  const { data } = await fetchPaged<T>(async (from, to) => {
    try {
      const res = await fetch(`${url}/rest/v1/${query}&offset=${from}&limit=${to - from + 1}`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
        next: { revalidate: 3600 },
      });
      return res.ok ? { data: await res.json(), error: null } : { data: null, error: { message: res.statusText } };
    } catch (err) {
      return { data: null, error: { message: String(err) } };
    }
  }, max);
  return data;
}

export interface SitemapData {
  clubs: { id: string; slug: string; updated_at: string | null }[];
  matches: { id: string; club_id: string; status: string; match_date: string | null; created_at: string | null }[];
  events: { id: string; club_id: string; start_time: string | null; created_at: string | null }[];
  tournaments: { id: string; club_id: string; status: string | null; updated_at: string | null }[];
}

/** Everything the public can read that deserves a sitemap entry. Events are public-only by RLS. */
export async function listSitemapData(): Promise<SitemapData> {
  const [clubs, matches, events, tournaments] = await Promise.all([
    fetchRows<SitemapData['clubs'][number]>('clubs?select=id,slug,updated_at&is_active=eq.true&order=id'),
    fetchRows<SitemapData['matches'][number]>('matches?select=id,club_id,status,match_date,created_at&order=match_date.desc,id'),
    fetchRows<SitemapData['events'][number]>('events?select=id,club_id,start_time,created_at&is_public=eq.true&order=start_time.desc,id'),
    fetchRows<SitemapData['tournaments'][number]>('tournaments?select=id,club_id,status,updated_at&order=id'),
  ]);
  return { clubs, matches, events, tournaments };
}
