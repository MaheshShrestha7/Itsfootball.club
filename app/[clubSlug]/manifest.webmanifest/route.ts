import { NextResponse } from 'next/server';
import { findClubAppIcons, findClubBySlug } from '@/lib/supabase/club-lookup';

// A club's own installable app: its name on the home screen, opening on its "My Club" page.
// The platform-wide manifest is app/manifest.webmanifest/route.ts.
export async function GET(_req: Request, { params }: { params: Promise<{ clubSlug: string }> }) {
  const { clubSlug } = await params;
  const club = await findClubBySlug(clubSlug);
  if (!club) return NextResponse.json({ error: 'Club not found' }, { status: 404 });
  // The crest icons once the admin area has drawn them (lib/app-icons.ts), else the platform's
  const own = await findClubAppIcons(club.slug);
  return NextResponse.json(
    {
      id: `/${club.slug}/app`,
      name: club.name,
      short_name: club.short_name || club.name,
      description: `${club.name}: fixtures, live scores, your member pass and your club tools.`,
      start_url: `/${club.slug}/app`,
      scope: '/',
      display: 'standalone',
      background_color: '#070A0F',
      theme_color: '#070A0F',
      icons: [
        { src: own?.icon192 || '/icon.png', sizes: '192x192', type: 'image/png' },
        { src: own?.icon512 || '/logo.png', sizes: '512x512', type: 'image/png' },
        { src: own?.maskable512 || '/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    { headers: { 'Content-Type': 'application/manifest+json', 'Cache-Control': 'public, max-age=300' } }
  );
}
