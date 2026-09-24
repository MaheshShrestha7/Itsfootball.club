import JsonLd from '@/components/JsonLd';
import { tournamentSchema } from '@/lib/schema';
import { findClubBySlug, findTournamentById } from '@/lib/supabase/club-lookup';

export default async function TournamentSchema({ params }: { params: Promise<{ clubSlug: string; tournamentId: string }> }) {
  const { clubSlug, tournamentId } = await params;
  const [club, tournament] = await Promise.all([findClubBySlug(clubSlug), findTournamentById(tournamentId)]);
  if (!club || !tournament || tournament.club_id !== club.id) return null;
  return <JsonLd data={tournamentSchema(club, tournament)} />;
}
