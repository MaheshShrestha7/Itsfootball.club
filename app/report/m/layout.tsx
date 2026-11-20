import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'Meeting minutes | itsfootball.club',
  description: 'Committee meeting minutes shared by a football club on itsfootball.club.',
  path: '/report/m',
  noIndex: true,
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
