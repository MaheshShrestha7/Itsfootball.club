import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'Tournament report | itsfootball.club',
  description: 'A tournament report shared by a football club on itsfootball.club.',
  path: '/report',
  noIndex: true,
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
