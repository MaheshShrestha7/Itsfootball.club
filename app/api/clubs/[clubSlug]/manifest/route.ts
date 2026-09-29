import { NextRequest, NextResponse } from 'next/server';

// The web app manifest for one club, so "Add to home screen" installs the club's own site: its name,
// colours and crest, opening at the club home page. Linked from app/[clubSlug]/layout.tsx.

const HEX_COLOR = /^#[0-9a-f]{3,8}$/i;
const FALLBACK_BACKGROUND = '#070A0F';

interface ManifestClubRow {
  slug: string;
  name: string;
  short_name: string | null;
  logo_url: string | null;
  secondary_color: string | null;
}

async function findClub(slug: string): Promise<ManifestClubRow | null | undefined> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return undefined;
  try {
    const res = await fetch(
      `${url}/rest/v1/clubs?select=slug,name,short_name,logo_url,secondary_color&is_active=eq.true&slug=eq.${encodeURIComponent(slug)}`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` }, next: { revalidate: 300 } }
    );
    if (!res.ok) return undefined;
    return ((await res.json()) as ManifestClubRow[])[0] ?? null;
  } catch {
    return undefined;
  }
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ clubSlug: string }> }) {
  const { clubSlug } = await params;
  const club = await findClub(clubSlug.toLowerCase());
  if (club === undefined) return new NextResponse('Temporarily unavailable', { status: 503 });
  if (!club) return new NextResponse('Not found', { status: 404 });

  const background = club.secondary_color && HEX_COLOR.test(club.secondary_color) ? club.secondary_color : FALLBACK_BACKGROUND;
  const crest = club.logo_url?.startsWith('https://') ? club.logo_url : null;

  const manifest = {
    // Same id and start page on itsfootball.club and on the club's own domain (the middleware passes
    // /{slug} paths straight through there)
    id: `/${club.slug}`,
    name: club.name,
    short_name: (club.short_name || club.name).slice(0, 12),
    description: `${club.name}: live match center, fixtures, results and your digital member pass.`,
    start_url: `/${club.slug}`,
    display: 'standalone',
    background_color: background,
    theme_color: background,
    icons: [
      // Crest sizes aren't known, so it is offered at any size; the platform logo stays as a known-good fallback
      ...(crest ? [{ src: crest, sizes: 'any', purpose: 'any' }] : []),
      { src: '/logo-96.png', sizes: '96x96', type: 'image/png' },
      { src: '/logo.png', sizes: '512x512', type: 'image/png' },
    ],
  };

  return NextResponse.json(manifest, {
    headers: {
      'Content-Type': 'application/manifest+json',
      'Cache-Control': 'public, max-age=300',
    },
  });
}
