import JsonLd from '@/components/JsonLd';
import { matchSchema } from '@/lib/schema';
import { findClubBySlug, findMatchById } from '@/lib/supabase/club-lookup';

export default async function MatchSchema({ params }: { params: Promise<{ clubSlug: string; matchId: string }> }) {
  const { clubSlug, matchId } = await params;
  const [club, match] = await Promise.all([findClubBySlug(clubSlug), findMatchById(matchId)]);
  if (!club || !match || match.club_id !== club.id) return null;
  return <JsonLd data={matchSchema(club, match)} />;
}
