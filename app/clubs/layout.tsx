import type { Metadata } from 'next';
import JsonLd from '@/components/JsonLd';
import { fitDescription, pageMetadata } from '@/lib/seo';
import { clubsDirectorySchema } from '@/lib/schema';
import { listActiveClubs } from '@/lib/supabase/club-lookup';

export const metadata: Metadata = pageMetadata({
  title: 'Football Clubs Directory | itsfootball.club',
  description: fitDescription(
    'Browse football clubs on itsfootball.club and follow their live match centres, fixtures, squads and club news.',
    'Find your club and join today.'
  ),
  path: '/clubs',
});

export default async function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <JsonLd data={clubsDirectorySchema(await listActiveClubs())} />
      {children}
    </>
  );
}
