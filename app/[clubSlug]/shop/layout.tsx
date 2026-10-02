import type { Metadata } from 'next';
import { SITE_NAME, clubImage, clubName, clubPageMetadata, fitDescription, fitTitle, pageMetadata } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ clubSlug: string }> }): Promise<Metadata> {
  const { clubSlug } = await params;
  return clubPageMetadata(clubSlug, club =>
    pageMetadata({
      title: fitTitle('Club Shop', clubName(club), SITE_NAME),
      description: fitDescription(
        `Official ${club.name} merchandise: order online, pay by card and collect from the club.`,
        'Wear the colours.'
      ),
      path: `/${club.slug}/shop`,
      ...clubImage(club),
    })
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
