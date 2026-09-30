import type { MetadataRoute } from 'next';
import { SITE_NAME } from '@/lib/seo';

// Makes the site installable ("Add to Home Screen"). start_url '/' is the club's own home page on
// a club domain (middleware.ts) and the platform home on itsfootball.club.
export default function manifest(): MetadataRoute.Manifest {
  return {
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
    ],
  };
}
