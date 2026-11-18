import type { Metadata } from 'next';
import { SITE_NAME, clubName, clubPageMetadata, fitTitle, pageMetadata } from '@/lib/seo';

// A guest club's private team entry link: kept out of search results
export async function generateMetadata({ params }: { params: Promise<{ clubSlug: string }> }): Promise<Metadata> {
  const { clubSlug } = await params;
  return clubPageMetadata(clubSlug, club =>
    pageMetadata({
      title: fitTitle('Enter your team', clubName(club), SITE_NAME),
      description: `Add your team's crest, colours, staff and players for a ${club.name} tournament.`,
      path: `/${club.slug}`,
      noIndex: true,
    })
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
