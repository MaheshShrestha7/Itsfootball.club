import type { Metadata } from 'next';
import { fitDescription, pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'FAQ | itsfootball.club',
  description: fitDescription(
    'Answers for club representatives, club admins, managers, coaches, players, supporters and sponsors using itsfootball.club.',
    'Free forever for at least the first 10 clubs.'
  ),
  path: '/faq',
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
