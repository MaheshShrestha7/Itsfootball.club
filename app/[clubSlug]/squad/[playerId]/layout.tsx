import type { Metadata } from 'next';
import { SITE_NAME, clubImage, clubName, clubPageMetadata, fitDescription, fitTitle, pageMetadata } from '@/lib/seo';

// Player pages hold little text of their own and name people: linked from the squad, kept out of search
export async function generateMetadata({ params }: { params: Promise<{ clubSlug: string; playerId: string }> }): Promise<Metadata> {
  const { clubSlug, playerId } = await params;
  return clubPageMetadata(clubSlug, club =>
    pageMetadata({
      title: fitTitle('Player', clubName(club), SITE_NAME),
      description: fitDescription(`A ${club.name} player: shirt number, position and this season's games, goals and assists.`, 'Player profile.'),
      path: `/${club.slug}/squad/${playerId}`,
      noIndex: true,
      ...clubImage(club),
    })
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
