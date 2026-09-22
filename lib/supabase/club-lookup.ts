// Lightweight server-side club lookup, used for:
//  - returning a real HTTP 404 for unknown club slugs (clubSlugExists), and
//  - generating server-rendered <title>/OG metadata for search engines and link
//    previews (findClubBySlug), which the client-rendered pages themselves can't
//    provide since they have no content until JS runs.
// Mirrors the slug/previous_slugs matching logic in lib/club-context.tsx's selectClubBySlug.

export interface ClubMetadataRow {
  name: string;
  short_name: string;
  motto: string | null;
  logo_url: string | null;
  banner_url: string | null;
  slug: string;
  previous_slugs: string[] | null;
}

async function fetchActiveClubs(): Promise<ClubMetadataRow[] | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) return null;

  try {
    const res = await fetch(
      `${url}/rest/v1/clubs?select=name,short_name,motto,logo_url,banner_url,slug,previous_slugs&is_active=eq.true`,
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
}

export async function findMatchById(matchId: string): Promise<MatchMetadataRow | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key || !matchId) return null;

  try {
    const res = await fetch(
      `${url}/rest/v1/matches?select=id,club_id,home_team_name,away_team_name,home_score,away_score,status,competition,match_date&id=eq.${encodeURIComponent(matchId)}`,
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

export async function clubSlugExists(slug: string): Promise<boolean> {
  if (!slug) return true; // fail open on an empty slug; let client-side handle it
  const clubs = await fetchActiveClubs();
  if (!clubs) return true; // fail open: unconfigured Supabase or a transient/network error
  const clean = slug.toLowerCase();
  return clubs.some(
    c =>
      c.slug?.toLowerCase() === clean ||
      c.previous_slugs?.some(prev => prev?.toLowerCase() === clean)
  );
}
