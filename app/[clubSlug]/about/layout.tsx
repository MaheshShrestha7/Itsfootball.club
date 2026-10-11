import type { Metadata } from 'next';
import { SITE_NAME, clubImage, clubName, clubPageMetadata, fitDescription, fitTitle, pageMetadata } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ clubSlug: string }> }): Promise<Metadata> {
  const { clubSlug } = await params;
  return clubPageMetadata(clubSlug, club =>
    pageMetadata({
      title: fitTitle('About', clubName(club), SITE_NAME),
      description: fitDescription(
        `The story of ${club.name}${club.founded_year ? `, founded in ${club.founded_year}` : ''}: where the club came from, its home ground and the people who run it.`,
        'Our story.'
      ),
      path: `/${club.slug}/about`,
      ...clubImage(club),
    })
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
