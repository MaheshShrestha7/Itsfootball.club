import type { Metadata } from 'next';
import { fitDescription, pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'FAQ | itsfootball.club',
  description: fitDescription(
    'Answers for club representatives, admins, managers, coaches, players, supporters and sponsors. Free to sign up, every feature included.'
  ),
  path: '/faq',
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
