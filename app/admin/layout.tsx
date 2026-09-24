import type { Metadata } from 'next';
import { fitDescription, pageMetadata } from '@/lib/seo';

// /admin just redirects to My Clubs; kept out of the index (self-canonical, as Google advises for noindex pages)
export const metadata: Metadata = pageMetadata({
  title: 'Club Admin | itsfootball.club',
  description: fitDescription(
    'Open the admin console for the football clubs you manage on itsfootball.club: fixtures, squad, branding and sponsors.',
    'Sign in now to continue.'
  ),
  path: '/admin',
  noIndex: true,
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
