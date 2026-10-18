import JsonLd from '@/components/JsonLd';
import { matchSchema } from '@/lib/schema';
import { findClubBySlug, findMatchById } from '@/lib/supabase/club-lookup';
import { listGrounds } from '@/lib/supabase/grounds-lookup';
import { groundForMatch } from '@/lib/grounds';

export default async function MatchSchema({ params }: { params: Promise<{ clubSlug: string; matchId: string }> }) {
  const { clubSlug, matchId } = await params;
  const [club, match, grounds] = await Promise.all([findClubBySlug(clubSlug), findMatchById(matchId), listGrounds()]);
  if (!club || !match || match.club_id !== club.id) return null;
  const homeGround = grounds.find(g => g.id === club.stadium_name || g.name.toLowerCase() === (club.stadium_name || '').toLowerCase()) || null;
  const ground = groundForMatch(match, null, homeGround) || (match.venue ? grounds.find(g => g.name.toLowerCase() === match.venue!.toLowerCase()) : null);
  return <JsonLd data={matchSchema(club, match, ground)} />;
}
