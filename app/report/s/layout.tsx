import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'Season review | itsfootball.club',
  description: 'A season review shared by a football club on itsfootball.club.',
  path: '/report/s',
  noIndex: true,
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
