import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'Email preferences | itsfootball.club',
  description: 'Unsubscribe from a club\'s emails on itsfootball.club.',
  path: '/unsubscribe',
  noIndex: true,
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
