import type { Metadata } from 'next';
import { SITE_NAME, clubImage, clubName, clubPageMetadata, fitDescription, fitTitle, pageMetadata } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ clubSlug: string }> }): Promise<Metadata> {
  const { clubSlug } = await params;
  return clubPageMetadata(clubSlug, club =>
    pageMetadata({
      title: fitTitle('Fixtures & Results', clubName(club), SITE_NAME),
      description: fitDescription(
        `${club.name} fixtures, kick-off times, venues and results for every team.`,
        'Add them to your calendar.'
      ),
      path: `/${club.slug}/fixtures`,
      ...clubImage(club),
    })
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
