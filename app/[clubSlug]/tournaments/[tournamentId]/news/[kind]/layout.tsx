import type { Metadata } from 'next';
import { findTournamentById } from '@/lib/supabase/club-lookup';
import { clubImage, clubName, clubPageMetadata, fitDescription, fitTitle, pageMetadata } from '@/lib/seo';
import { WRITEUP_LABELS, isWriteupKind } from '@/lib/tournament-writeups';

export async function generateMetadata({ params }: { params: Promise<{ clubSlug: string; tournamentId: string; kind: string }> }): Promise<Metadata> {
  const { clubSlug, tournamentId, kind } = await params;
  const tournament = await findTournamentById(tournamentId);
  return clubPageMetadata(clubSlug, club => {
    const path = `/${club.slug}/tournaments/${tournamentId}/news/${kind}`;
    if (!tournament || tournament.club_id !== club.id || !isWriteupKind(kind)) {
      return pageMetadata({ title: fitTitle('Tournament news not found', clubName(club)), description: fitDescription(`Tournament news from ${club.name}.`), path, ...clubImage(club), noIndex: true });
    }
    const label = WRITEUP_LABELS[kind];
    return pageMetadata({
      title: fitTitle(`${tournament.name}: ${kind === 'round-up' ? 'tournament round-up' : `${label.toLowerCase()} report`}`, clubName(club)),
      description: fitDescription(
        kind === 'round-up' ? `How the ${tournament.name} went, hosted by ${club.name}${tournament.venue ? ` at ${tournament.venue}` : ''}.` : `${label} report from the ${tournament.name}, hosted by ${club.name}.`,
        'Results, goalscorers and who goes through.',
      ),
      path,
      ...(tournament.banner_url ? { image: tournament.banner_url, imageIsSquare: false } : clubImage(club)),
    });
  });
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
