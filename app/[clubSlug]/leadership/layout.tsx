import type { Metadata } from 'next';
import { SITE_NAME, clubImage, clubName, clubPageMetadata, fitDescription, fitTitle, pageMetadata } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ clubSlug: string }> }): Promise<Metadata> {
  const { clubSlug } = await params;
  return clubPageMetadata(clubSlug, club =>
    pageMetadata({
      title: fitTitle('Leadership', clubName(club), SITE_NAME),
      description: fitDescription(
        `Meet the executive committee of ${club.name}: the people who run the club, their roles and their season.`,
        'Our committee.'
      ),
      path: `/${club.slug}/leadership`,
      ...clubImage(club),
    })
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
