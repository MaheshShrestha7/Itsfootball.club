import type { Metadata } from 'next';
import { fitDescription, pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'Football Clubs Directory | itsfootball.club',
  description: fitDescription(
    'Browse football clubs on itsfootball.club and follow their live match centers, fixtures, squads and club news.',
    'Find your club and join today.'
  ),
  path: '/clubs',
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
