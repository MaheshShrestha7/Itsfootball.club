import type { Metadata } from 'next';
import { SITE_NAME, clubImage, clubName, clubPageMetadata, fitDescription, fitTitle, pageMetadata } from '@/lib/seo';
import { findPublicPlayerName } from '@/lib/supabase/club-lookup';

// Player pages hold little text of their own and name people: linked from the squad, kept out of search.
// The title names adults who have a public page, for browser tabs and shared links; anyone else gets "Player".
export async function generateMetadata({ params }: { params: Promise<{ clubSlug: string; playerId: string }> }): Promise<Metadata> {
  const { clubSlug, playerId } = await params;
  return clubPageMetadata(clubSlug, async club => {
    const name = await findPublicPlayerName(club.id, playerId);
    return pageMetadata({
      title: fitTitle(name || 'Player', clubName(club), SITE_NAME),
      description: fitDescription(`${name || `A ${club.name} player`}${name ? ` of ${club.name}` : ''}: position and this season's games, goals and assists.`, !name && 'Player profile.'),
      path: `/${club.slug}/squad/${playerId}`,
      noIndex: true,
      ...clubImage(club),
    });
  });
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
