import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'Event summary | itsfootball.club',
  description: 'An event summary shared by a football club on itsfootball.club.',
  path: '/report/e',
  noIndex: true,
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
