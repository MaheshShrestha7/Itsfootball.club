import type { Metadata } from 'next';
import { findTournamentById } from '@/lib/supabase/club-lookup';
import { clubImage, clubName, clubPageMetadata, fitDescription, fitTitle, pageMetadata } from '@/lib/seo';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ clubSlug: string; tournamentId: string }>;
}): Promise<Metadata> {
  const { clubSlug, tournamentId } = await params;
  const tournament = await findTournamentById(tournamentId);

  return clubPageMetadata(clubSlug, club => {
    const path = `/${club.slug}/tournaments/${tournamentId}`;
    if (!tournament || tournament.club_id !== club.id) {
      return pageMetadata({
        title: fitTitle('Tournament not found', clubName(club)),
        description: fitDescription(`This tournament could not be found. Browse all ${club.name} tournaments and cup competitions for fixtures, tables and results.`, 'See all tournaments.'),
        path,
        ...clubImage(club),
        noIndex: true,
      });
    }
    return pageMetadata({
      title: fitTitle(`${tournament.name}${tournament.season ? ` ${tournament.season}` : ''}`, 'Fixtures & Table', clubName(club)),
      description: fitDescription(
        `${tournament.name}${tournament.season ? ` ${tournament.season}` : ''} hosted by ${club.name}${tournament.venue ? ` at ${tournament.venue}` : ''}.`,
        'See fixtures, live results, group tables and the knockout bracket.',
        'Follow every match live.',
        'Follow live.'
      ),
      path,
      ...(tournament.banner_url ? { image: tournament.banner_url, imageIsSquare: false } : clubImage(club)),
    });
  });
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
