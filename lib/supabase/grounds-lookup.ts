// Server-side reads for the grounds directory (app/grounds), with the public key so row level security
// applies: only published grounds, active clubs and active teams. Every read returns [] on failure
// (including before migration 20261109_grounds.sql has run), so the pages degrade to "not found"
// rather than erroring, and nothing outside /grounds depends on these tables.
import {
  FIXTURE_DAYS_AHEAD, FIXTURE_DAYS_BACK, mergeFixtures, venueMatchesGround,
  type GroundClub, type GroundFixture, type GroundRow,
} from '../grounds';
import { CURATED_GROUNDS } from '../curated-grounds';

async function rows<T>(query: string): Promise<T[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return [];
  try {
    const res = await fetch(`${url}/rest/v1/${query}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      next: { revalidate: 60 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

// Every column: includes grounds.source once migration 20261114 has run (for the OpenStreetMap credit),
// without failing before it has
const GROUND_COLUMNS = '*';

/** Every published ground, by suburb then name (merged with curated community grounds for Liverpool, Fairfield, Penrith, Blacktown and Campbelltown) */
export async function listGrounds(): Promise<GroundRow[]> {
  const dbGrounds = await rows<GroundRow>(`grounds?select=${GROUND_COLUMNS}&is_published=eq.true&order=suburb_slug,slug&limit=5000`);
  const seen = new Set(dbGrounds.map(g => `${g.suburb_slug}/${g.slug}`));
  const merged = [...dbGrounds];
  for (const g of CURATED_GROUNDS) {
    if (!seen.has(`${g.suburb_slug}/${g.slug}`)) {
      merged.push(g);
      seen.add(`${g.suburb_slug}/${g.slug}`);
    }
  }
  return merged.sort((a, b) => a.suburb_slug.localeCompare(b.suburb_slug) || a.slug.localeCompare(b.slug));
}

interface ClubUse extends GroundClub {
  home_ground_id: string;
  grounds_directory_listed: boolean;
  config: { kind?: string } | null;
}

/** Active clubs (not tournament-only ones) that have a home ground in the directory */
export async function clubsWithHomeGrounds(): Promise<ClubUse[]> {
  const list = await rows<ClubUse>(
    'clubs?select=id,slug,name,short_name,logo_url,primary_color,home_ground_id,grounds_directory_listed,config&is_active=eq.true&home_ground_id=not.is.null&limit=5000'
  );
  // Only real clubs: a ground counts as "used" (and can be indexed) once a club on itsfootball.club plays there
  return list.filter(c => c.config?.kind !== 'event');
}

/** How many clubs use each ground (named or not), and the opted-in ones to show by name */
export function groundUse(clubs: ClubUse[]) {
  const count = new Map<string, number>();
  const listed = new Map<string, GroundClub[]>();
  for (const c of clubs) {
    count.set(c.home_ground_id, (count.get(c.home_ground_id) || 0) + 1);
    if (c.grounds_directory_listed) {
      const { id, slug, name, short_name, logo_url, primary_color } = c;
      listed.set(c.home_ground_id, [...(listed.get(c.home_ground_id) || []), { id, slug, name, short_name, logo_url, primary_color }]);
    }
  }
  return { count, listed };
}

export function findGround(grounds: GroundRow[], suburbSlug: string, slug: string): { ground: GroundRow | null; movedTo: GroundRow | null } {
  const s = suburbSlug.toLowerCase();
  const g = slug.toLowerCase();
  const ground = grounds.find(x => x.suburb_slug === s && x.slug === g) || null;
  if (ground) return { ground, movedTo: null };
  const movedTo = grounds.find(x => (x.previous_paths || []).includes(`${s}/${g}`)) || null;
  return { ground: null, movedTo };
}

interface MatchRow {
  id: string;
  club_id: string;
  home_team_name: string;
  away_team_name: string;
  match_date: string;
  status: string;
  home_score: number | null;
  away_score: number | null;
  competition: string | null;
  venue: string | null;
  team_id: string | null;
  pitch_label?: string | null;
}

interface TeamRow { id: string; club_id: string; is_default: boolean; is_junior: boolean; hide_public_scores: boolean }

const MATCH_COLUMNS = 'id,club_id,home_team_name,away_team_name,match_date,status,home_score,away_score,competition,venue,team_id';
const uuidList = (ids: string[]) => `in.(${[...new Set(ids)].filter(id => /^[0-9a-f-]{36}$/i.test(id)).join(',')})`;

function dateWindow() {
  const now = Date.now();
  return `match_date=gte.${new Date(now - FIXTURE_DAYS_BACK * 86400_000).toISOString()}&match_date=lte.${new Date(now + FIXTURE_DAYS_AHEAD * 86400_000).toISOString()}`;
}

/** Drops junior, hidden-score and inactive teams' matches (a match without a team follows the club's main team) */
async function publicFixtures(matches: MatchRow[], clubs: Pick<GroundClub, 'id' | 'slug'>[]): Promise<GroundFixture[]> {
  if (!matches.length) return [];
  const teams = await rows<TeamRow>(`club_teams?select=id,club_id,is_default,is_junior,hide_public_scores&club_id=${uuidList(clubs.map(c => c.id))}&is_active=eq.true&limit=1000`);
  const teamById = new Map(teams.map(t => [t.id, t]));
  const defaultTeam = new Map(teams.filter(t => t.is_default).map(t => [t.club_id, t]));
  const slugById = new Map(clubs.map(c => [c.id, c.slug]));
  const safe = (m: MatchRow) => {
    const team = m.team_id ? teamById.get(m.team_id) : defaultTeam.get(m.club_id);
    if (m.team_id && !team) return false; // an inactive team, or one we can't read
    return !team || (!team.is_junior && !team.hide_public_scores);
  };
  return matches
    .filter(m => safe(m) && slugById.has(m.club_id))
    .map(m => ({
      id: m.id,
      clubSlug: slugById.get(m.club_id)!,
      home: m.home_team_name,
      away: m.away_team_name,
      date: m.match_date,
      status: m.status,
      homeScore: m.home_score,
      awayScore: m.away_score,
      competition: m.competition,
      ...(m.pitch_label ? { pitch: m.pitch_label } : {}),
    }));
}

/** Home fixtures of the opted-in clubs based here whose venue text names the ground */
async function namedFixtures(ground: GroundRow, clubs: GroundClub[]): Promise<GroundFixture[]> {
  if (!clubs.length) return [];
  const matches = await rows<MatchRow>(
    `matches?select=${MATCH_COLUMNS}&club_id=${uuidList(clubs.map(c => c.id))}&is_club_home=eq.true&match_type=neq.internal&${dateWindow()}&order=match_date.desc&limit=200`
  );
  return publicFixtures(matches.filter(m => venueMatchesGround(m.venue, ground.name)), clubs);
}

/**
 * Fixtures linked to the ground from the match form (matches.ground_id, migration 20261110), home or
 * away, of any opted-in club. Before that migration the read fails and this is simply empty.
 */
async function linkedFixtures(ground: GroundRow): Promise<GroundFixture[]> {
  const matches = await rows<MatchRow>(
    `matches?select=${MATCH_COLUMNS},pitch_label&ground_id=eq.${ground.id}&match_type=neq.internal&${dateWindow()}&order=match_date.desc&limit=200`
  );
  if (!matches.length) return [];
  const clubs = (await rows<GroundClub & { config: { kind?: string } | null }>(
    `clubs?select=id,slug,name,short_name,logo_url,primary_color,config&id=${uuidList(matches.map(m => m.club_id))}&is_active=eq.true&grounds_directory_listed=eq.true&limit=1000`
  )).filter(c => c.config?.kind !== 'event');
  return publicFixtures(matches, clubs);
}

/**
 * Fixtures played (or due) at this ground, newest first: the opted-in home clubs' fixtures that name
 * it, plus any opted-in club's fixtures linked to it. Never: junior teams, teams that hide their
 * scores, inactive teams, internal matches, or anything past 60 days ahead.
 */
export async function groundFixtures(ground: GroundRow, homeClubs: GroundClub[]): Promise<GroundFixture[]> {
  const [named, linked] = await Promise.all([namedFixtures(ground, homeClubs), linkedFixtures(ground)]);
  return mergeFixtures(linked, named);
}
