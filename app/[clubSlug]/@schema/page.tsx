import JsonLd from '@/components/JsonLd';
import { clubSchema } from '@/lib/schema';
import { findClubBySlug, listClubLiveMatches, listClubNews } from '@/lib/supabase/club-lookup';

// Club home: the club (SportsClub / SportsOrganization) plus a BlogPosting for each article in its News section and SportsEvent schema on live match fixtures
export default async function ClubHomeSchema({ params }: { params: Promise<{ clubSlug: string }> }) {
  const { clubSlug } = await params;
  const club = await findClubBySlug(clubSlug);
  if (!club) return null;
  const [news, liveMatches] = await Promise.all([
    listClubNews(club.id),
    listClubLiveMatches(club.id),
  ]);
  return <JsonLd data={clubSchema(club, news, liveMatches)} />;
}
