import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'Club invite | itsfootball.club',
  description: 'Accept an invite to run a football club on itsfootball.club as its Owner or a Club Admin. No club membership needed.',
  path: '/invite',
  noIndex: true,
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
