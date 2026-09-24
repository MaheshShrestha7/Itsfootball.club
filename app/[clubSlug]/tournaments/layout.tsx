import type { Metadata } from 'next';
import { SITE_NAME, clubImage, clubName, clubPageMetadata, fitDescription, fitTitle, pageMetadata } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ clubSlug: string }> }): Promise<Metadata> {
  const { clubSlug } = await params;
  return clubPageMetadata(clubSlug, club =>
    pageMetadata({
      title: fitTitle('Tournaments & Cups', clubName(club), SITE_NAME),
      description: fitDescription(
        `Follow ${club.name} tournaments and cup competitions: fixtures, group tables, knockout brackets and results.`,
        'See the latest standings now.',
        'See standings.'
      ),
      path: `/${club.slug}/tournaments`,
      ...clubImage(club),
    })
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
