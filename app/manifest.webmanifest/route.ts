import { NextResponse } from 'next/server';
import { SITE_NAME } from '@/lib/seo';

// Makes the site installable ("Add to Home Screen"). A route rather than app/manifest.ts so a club's
// pages can point at their own manifest instead (app/[clubSlug]/manifest.webmanifest): Next lets a
// file-based manifest override every page's metadata. start_url '/' is the club's own home page on a
// club domain (middleware.ts) and the platform home on itsfootball.club.
export function GET() {
  return NextResponse.json(
    {
      name: SITE_NAME,
      short_name: 'itsfootball',
      description: 'Club websites, live match centre and digital member passes for football clubs.',
      start_url: '/',
      scope: '/',
      display: 'standalone',
      background_color: '#070A0F',
      theme_color: '#070A0F',
      icons: [
        { src: '/icon.png', sizes: '192x192', type: 'image/png' },
        { src: '/logo.png', sizes: '512x512', type: 'image/png' },
        { src: '/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    { headers: { 'Content-Type': 'application/manifest+json' } }
  );
}
