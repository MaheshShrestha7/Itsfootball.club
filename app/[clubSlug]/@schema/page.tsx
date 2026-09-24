import JsonLd from '@/components/JsonLd';
import { clubSchema } from '@/lib/schema';
import { findClubBySlug, listClubNews } from '@/lib/supabase/club-lookup';

// Club home: the club (SportsTeam) plus a BlogPosting for each article in its News section
export default async function ClubHomeSchema({ params }: { params: Promise<{ clubSlug: string }> }) {
  const { clubSlug } = await params;
  const club = await findClubBySlug(clubSlug);
  if (!club) return null;
  return <JsonLd data={clubSchema(club, await listClubNews(club.id))} />;
}
