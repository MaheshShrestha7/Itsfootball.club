import type { Metadata } from 'next';
import { SITE_NAME, clubImage, clubName, clubPageMetadata, fitDescription, fitTitle, pageMetadata } from '@/lib/seo';

// Players respond through private links, so this page is kept out of search results
export async function generateMetadata({ params }: { params: Promise<{ clubSlug: string }> }): Promise<Metadata> {
  const { clubSlug } = await params;
  return clubPageMetadata(clubSlug, club =>
    pageMetadata({
      title: fitTitle('Player Availability', clubName(club), SITE_NAME),
      description: fitDescription(
        `Let ${club.name} know whether you can play: confirm your availability for upcoming matches and events.`,
        'Respond now so your coach can pick the squad.',
        'Please respond before matchday.',
        'Respond now.'
      ),
      path: `/${club.slug}/availability`,
      ...clubImage(club),
      noIndex: true,
    })
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
