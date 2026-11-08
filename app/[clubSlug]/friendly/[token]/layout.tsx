import type { Metadata } from 'next';
import { SITE_NAME, clubName, clubPageMetadata, fitTitle, pageMetadata } from '@/lib/seo';

// The private link in a "would one of these dates suit?" email: kept out of search results
export async function generateMetadata({ params }: { params: Promise<{ clubSlug: string }> }): Promise<Metadata> {
  const { clubSlug } = await params;
  return clubPageMetadata(clubSlug, club =>
    pageMetadata({
      title: fitTitle('Pick a date for your friendly', clubName(club), SITE_NAME),
      description: `Pick one of the dates ${club.name} suggested for your friendly.`,
      path: `/${club.slug}`,
      noIndex: true,
    })
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
