import type { CalendarEvent, CalendarMatch } from '../calendar';
import { fetchPaged } from '../paged';
import type { SummaryMatch } from '../public-tournaments';

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
  /** config.kind 'event': a tournament-only club (lib/public-tournaments.ts) */
  config: { kind?: string; organiser?: string; team_size?: string } | null;
}

async function fetchActiveClubs(): Promise<ClubMetadataRow[] | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) return null;

  try {
    const res = await fetch(
      `${url}/rest/v1/clubs?select=id,name,short_name,motto,logo_url,banner_url,slug,previous_slugs,stadium_name,stadium_address,founded_year,config&is_active=eq.true`,
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
  match_time?: string | null;
  venue: string | null;
  ground_id?: string | null;
  is_club_home: boolean | null;
  home_team_logo: string | null;
  away_team_logo: string | null;
  team_id?: string | null;
  match_type?: string | null;
  tournament_id?: string | null;
  tournament_stage?: string | null;
  tournament_round?: number | null;
  /** Its team hides scores publicly (junior grassroots rules): metadata must not give the score away */
  score_hidden?: boolean;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * True only when Supabase answered and the row isn't there, so the page can return a real 404.
 * A failed lookup counts as found: a network blip must never 404 a real match or article.
 */
async function publicRowMissing(path: string): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return false;
  try {
    const res = await fetch(`${url}/rest/v1/${path}`, { headers: { apikey: key, Authorization: `Bearer ${key}` }, next: { revalidate: 30 } });
    if (!res.ok) return false;
    const rows: unknown = await res.json();
    return Array.isArray(rows) && rows.length === 0;
  } catch {
    return false;
  }
}

/** A match id that isn't this club's (matches are public to everyone by RLS) */
export async function matchMissing(clubSlug: string, matchId: string): Promise<boolean> {
  if (!UUID.test(matchId)) return true;
  const club = await findClubBySlug(clubSlug);
  if (!club) return false;
  return publicRowMissing(`matches?select=id&id=eq.${matchId}&club_id=eq.${club.id}&limit=1`);
}

/** A news slug this club has never used (news is public to everyone by RLS) */
export async function newsMissing(clubSlug: string, slug: string): Promise<boolean> {
  const club = await findClubBySlug(clubSlug);
  if (!club || !slug) return false;
  return publicRowMissing(`news_articles?select=id&club_id=eq.${club.id}&slug=eq.${encodeURIComponent(slug)}&limit=1`);
}

export async function findMatchById(matchId: string): Promise<MatchMetadataRow | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key || !matchId) return null;

  try {
    const res = await fetch(
      `${url}/rest/v1/matches?select=id,club_id,home_team_name,away_team_name,home_score,away_score,status,competition,match_date,match_time,venue,ground_id,is_club_home,home_team_logo,away_team_logo,team_id,match_type,tournament_id,tournament_stage,tournament_round&id=eq.${encodeURIComponent(matchId)}`,
      {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
        next: { revalidate: 30 },
      }
    );
    if (!res.ok) return null;
    const rows: MatchMetadataRow[] = await res.json();
    const row = rows[0];
    if (!row) return null;
    return { ...row, score_hidden: matchScoreHidden(row, await hiddenScoreTeams(row.club_id)) };
  } catch {
    return null;
  }
}

/** A club's live and upcoming match fixtures, for schema.org SportsEvent markup */
export async function listClubLiveMatches(clubId: string, limit = 5): Promise<MatchMetadataRow[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key || !/^[0-9a-f-]{36}$/i.test(clubId)) return [];

  try {
    const res = await fetch(
      `${url}/rest/v1/matches?select=id,club_id,home_team_name,away_team_name,home_score,away_score,status,competition,match_date,match_time,venue,ground_id,is_club_home,home_team_logo,away_team_logo,team_id,match_type,tournament_id,tournament_stage,tournament_round&club_id=eq.${encodeURIComponent(clubId)}&order=match_date.desc&limit=20`,
      {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
        next: { revalidate: 30 },
      }
    );
    if (!res.ok) return [];
    const rows: MatchMetadataRow[] = await res.json();
    const hidden = await hiddenScoreTeams(clubId);
    const enriched = rows.map(r => ({ ...r, score_hidden: matchScoreHidden(r, hidden) }));

    // Prioritise live fixtures ('live', 'halftime'), followed by upcoming fixtures
    const live = enriched.filter(m => m.status === 'live' || m.status === 'halftime');
    if (live.length > 0) return live.slice(0, limit);
    const upcoming = enriched.filter(m => m.status === 'upcoming');
    if (upcoming.length > 0) return upcoming.slice(0, limit);
    return enriched.slice(0, limit);
  } catch {
    return [];
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
  /** Missing until migration 20261115_event_flyers.sql runs */
  flyer_url?: string | null;
}

/** Public events only (row-level security hides private ones from the anon key).
 *  `*` rather than a column list, so the lookup still works before newer columns (flyer_url) exist. */
export const findEventById = (eventId: string) =>
  fetchOne<EventMetadataRow>('events', '*', eventId);

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

export interface EventTournamentRow extends TournamentMetadataRow {
  slug: string | null;
  status: string | null;
  /** Teams entered, for deciding whether the page is worth indexing */
  team_count: number;
  team_names: string[];
  /** Its matches, for the server-rendered summary and structured data */
  matches: EventMatchRow[];
}

export interface EventMatchRow extends SummaryMatch {
  id: string;
  venue: string | null;
}

/** The tournament of a tournament-only club (lib/public-tournaments.ts), with its teams and matches */
export async function findEventTournament(clubId: string): Promise<EventTournamentRow | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key || !/^[0-9a-f-]{36}$/i.test(clubId)) return null;
  const headers = { apikey: key, Authorization: `Bearer ${key}` };
  try {
    const res = await fetch(
      `${url}/rest/v1/tournaments?select=id,club_id,name,slug,status,season,format,venue,banner_url,start_date,end_date,description&club_id=eq.${clubId}&order=created_at&limit=1`,
      { headers, next: { revalidate: 60 } }
    );
    if (!res.ok) return null;
    const tournament = ((await res.json()) as Omit<EventTournamentRow, 'team_count'>[])[0];
    if (!tournament) return null;
    const [teams, matches] = await Promise.all([
      fetch(`${url}/rest/v1/tournament_participants?select=name&tournament_id=eq.${tournament.id}`, { headers, next: { revalidate: 60 } }),
      fetch(
        `${url}/rest/v1/matches?select=id,home_team_name,away_team_name,match_date,venue,status,home_score,away_score,home_penalty_score,away_penalty_score,winner_side,tournament_stage&tournament_id=eq.${tournament.id}&order=match_date`,
        { headers, next: { revalidate: 60 } }
      ),
    ]);
    const team_names = teams.ok ? ((await teams.json()) as { name: string }[]).map(t => t.name).filter(Boolean) : [];
    return { ...tournament, team_count: team_names.length, team_names, matches: matches.ok ? ((await matches.json()) as EventMatchRow[]) : [] };
  } catch {
    return null;
  }
}

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

export interface NewsArticleRow extends NewsMetadataRow {
  club_id: string;
  updated_at: string | null;
  /** Article body (plain text or HTML), the description's fallback when there's no summary */
  content: string | null;
}

/** One article of a club by its slug, for the article page's metadata and JSON-LD */
export async function findNewsBySlug(clubId: string, slug: string): Promise<NewsArticleRow | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key || !/^[0-9a-f-]{36}$/i.test(clubId) || !slug) return null;
  try {
    const res = await fetch(
      `${url}/rest/v1/news_articles?select=id,club_id,title,slug,summary,content,cover_image_url,author_name,tags,published_at,updated_at&club_id=eq.${clubId}&slug=eq.${encodeURIComponent(slug)}&limit=1`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` }, next: { revalidate: 60 } }
    );
    if (!res.ok) return null;
    const rows: NewsArticleRow[] = await res.json();
    return rows[0] || null;
  } catch {
    return null;
  }
}

export interface TeamMetadataRow {
  id: string;
  club_id: string;
  name: string;
  slug: string;
  age_group: string | null;
  description: string | null;
  logo_url: string | null;
}

/** One active club team by its slug, for the team page's metadata */
export async function findTeamBySlug(clubId: string, slug: string): Promise<TeamMetadataRow | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key || !/^[0-9a-f-]{36}$/i.test(clubId) || !slug) return null;
  try {
    const res = await fetch(
      `${url}/rest/v1/club_teams?select=id,club_id,name,slug,age_group,description,logo_url&club_id=eq.${clubId}&slug=eq.${encodeURIComponent(slug)}&is_active=eq.true&limit=1`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` }, next: { revalidate: 60 } }
    );
    if (!res.ok) return null;
    const rows: TeamMetadataRow[] = await res.json();
    return rows[0] || null;
  } catch {
    return null;
  }
}

/** Every active club, for the /clubs directory's schema */
/** Clubs for the directory: tournament-only clubs (lib/public-tournaments.ts) left out */
export async function listActiveClubs(): Promise<ClubMetadataRow[]> {
  return ((await fetchActiveClubs()) || []).filter(c => c.config?.kind !== 'event');
}

export interface ShopProductRow {
  name: string;
  description: string | null;
  photos: string[];
  price_cents: number;
}

/** A club's products on sale and the currency it charges in, for the shop's schema. Fresh within a minute,
 *  since Google expects schema prices to match the page. */
export async function listClubShop(clubId: string): Promise<{ products: ShopProductRow[]; currency: string }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const empty = { products: [], currency: 'AUD' };
  if (!url || !key || !/^[0-9a-f-]{36}$/i.test(clubId)) return empty;
  const get = async <T,>(query: string): Promise<T[]> => {
    const res = await fetch(`${url}/rest/v1/${query}`, { headers: { apikey: key, Authorization: `Bearer ${key}` }, next: { revalidate: 60 } });
    return res.ok ? res.json() : [];
  };
  try {
    const [products, settings] = await Promise.all([
      get<ShopProductRow>(`shop_products?select=name,description,photos,price_cents&club_id=eq.${clubId}&is_active=eq.true&order=sort_order`),
      get<{ currency: string | null }>(`club_payment_settings?select=currency&club_id=eq.${clubId}`),
    ]);
    // Same default as the shop page shows
    return { products, currency: settings[0]?.currency || 'AUD' };
  } catch {
    return empty;
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
  clubs: { id: string; slug: string; updated_at: string | null; config: { kind?: string } | null }[];
  matches: { id: string; club_id: string; status: string; match_date: string | null; created_at: string | null }[];
  events: { id: string; club_id: string; start_time: string | null; created_at: string | null }[];
  tournaments: { id: string; club_id: string; status: string | null; updated_at: string | null }[];
  news: { club_id: string; slug: string; published_at: string | null; updated_at: string | null }[];
  teams: { club_id: string; slug: string }[];
  shopClubIds: string[];
  galleryClubIds: string[];
  /** Clubs with at least one active sponsorship package (an empty sponsor page is thin) */
  sponsorClubIds: string[];
  /** Teams entered per tournament */
  teamCounts: Map<string, number>;
}

/** Everything the public can read that deserves a sitemap entry. Events are public-only by RLS. */
export async function listSitemapData(): Promise<SitemapData> {
  const [clubs, matches, events, tournaments, news, teams, products, photos, participants, packages] = await Promise.all([
    fetchRows<SitemapData['clubs'][number]>('clubs?select=id,slug,updated_at,config&is_active=eq.true&order=id'),
    fetchRows<SitemapData['matches'][number]>('matches?select=id,club_id,status,match_date,created_at&order=match_date.desc,id'),
    fetchRows<SitemapData['events'][number]>('events?select=id,club_id,start_time,created_at&is_public=eq.true&order=start_time.desc,id'),
    fetchRows<SitemapData['tournaments'][number]>('tournaments?select=id,club_id,status,updated_at&order=id'),
    // Published only: a scheduled article joins the sitemap once its time comes
    fetchRows<SitemapData['news'][number]>(`news_articles?select=club_id,slug,published_at,updated_at&published_at=lte.${new Date().toISOString().slice(0, 13)}:59:59Z&order=id`),
    fetchRows<SitemapData['teams'][number]>('club_teams?select=club_id,slug&is_active=eq.true&slug=not.is.null&order=id'),
    fetchRows<{ club_id: string }>('shop_products?select=club_id&is_active=eq.true&order=id'),
    // ponytail: reads one row per photo; a distinct-club_id view if galleries grow into the tens of thousands
    fetchRows<{ club_id: string }>('media_gallery?select=club_id&media_type=eq.image&order=id'),
    fetchRows<{ tournament_id: string }>('tournament_participants?select=tournament_id&order=id'),
    fetchRows<{ club_id: string }>('sponsorship_packages?select=club_id&is_active=eq.true&order=id'),
  ]);
  const teamCounts = new Map<string, number>();
  for (const p of participants) teamCounts.set(p.tournament_id, (teamCounts.get(p.tournament_id) || 0) + 1);
  return {
    clubs, matches, events, tournaments, news, teams,
    shopClubIds: Array.from(new Set(products.map(p => p.club_id))),
    galleryClubIds: Array.from(new Set(photos.map(p => p.club_id))),
    sponsorClubIds: Array.from(new Set(packages.map(p => p.club_id))),
    teamCounts,
  };
}

export interface HiddenScoreTeams {
  /** Teams with "hide scores publicly" on */
  hidden: Set<string>;
  /** The main team hides its scores (applies to team fixtures saved without a team) */
  defaultHidden: boolean;
}

/** Which of a club's teams hide their scores publicly (none if the teams table can't be read) */
export async function hiddenScoreTeams(clubId: string): Promise<HiddenScoreTeams> {
  const rows = /^[0-9a-f-]{36}$/i.test(clubId)
    ? await fetchRows<{ id: string; is_default: boolean; hide_public_scores: boolean }>(
        `club_teams?select=id,is_default,hide_public_scores&club_id=eq.${clubId}&is_active=eq.true&order=id`, 500)
    : [];
  return {
    hidden: new Set(rows.filter(t => t.hide_public_scores).map(t => t.id)),
    defaultHidden: rows.some(t => t.is_default && t.hide_public_scores),
  };
}

/** Same rule as publicScoreHidden in lib/teams.ts, for rows read on the server */
export function matchScoreHidden(
  m: { team_id?: string | null; match_type?: string | null; tournament_id?: string | null },
  teams: HiddenScoreTeams
): boolean {
  if (m.team_id) return teams.hidden.has(m.team_id);
  return teams.defaultHidden && !m.tournament_id && (m.match_type || 'friendly') !== 'internal';
}

/** A club's fixtures and public events from `sinceIso` on, for its calendar feed (public rows only, by RLS) */
export async function listCalendarData(clubId: string, sinceIso: string) {
  const id = encodeURIComponent(clubId);
  const since = encodeURIComponent(sinceIso);
  const [rows, events, hidden] = await Promise.all([
    fetchRows<CalendarMatch & { team_id?: string | null; match_type?: string | null; tournament_id?: string | null }>(`matches?select=id,title,competition,home_team_name,away_team_name,match_date,match_time,venue,status,home_score,away_score,team_id,match_type,tournament_id&club_id=eq.${id}&match_date=gte.${since}&order=match_date,id`, 2000),
    fetchRows<CalendarEvent>(`events?select=id,title,description,start_time,end_time,location&club_id=eq.${id}&is_public=eq.true&start_time=gte.${since}&order=start_time,id`, 2000),
    hiddenScoreTeams(clubId),
  ]);
  const matches: CalendarMatch[] = rows.map(m => ({ ...m, score_hidden: matchScoreHidden(m, hidden) }));
  return { matches, events };
}

export interface ClubAppIconsRow {
  slug: string;
  app_icons: { icon192?: string; icon512?: string; maskable512?: string } | null;
}

/** The club's home-screen icons (null: none made yet, or the column isn't there yet) */
export async function findClubAppIcons(slug: string): Promise<ClubAppIconsRow['app_icons']> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const club = await findClubBySlug(slug);
  if (!url || !key || !club) return null;
  try {
    const res = await fetch(`${url}/rest/v1/clubs?select=app_icons&id=eq.${club.id}&is_active=eq.true`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      next: { revalidate: 30 },
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as ClubAppIconsRow[];
    return rows[0]?.app_icons ?? null;
  } catch {
    return null;
  }
}
