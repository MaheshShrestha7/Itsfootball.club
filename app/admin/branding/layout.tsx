import type { Metadata } from 'next';
import { fitDescription, pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'Club Branding Admin | itsfootball.club',
  description: fitDescription(
    'Customise your football club crest, colours and kit on itsfootball.club, then preview the look across your whole club site.',
    'Sign in to continue.'
  ),
  path: '/admin/branding',
  noIndex: true,
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
