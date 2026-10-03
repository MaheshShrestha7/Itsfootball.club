import type { Metadata } from 'next';
import { SITE_NAME, clubName, clubPageMetadata, fitDescription, fitTitle, pageMetadata } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ clubSlug: string; orderId: string }> }): Promise<Metadata> {
  const { clubSlug } = await params;
  // A private page: the order id in the URL is what unlocks the tickets, so it's never indexed or shared
  return clubPageMetadata(clubSlug, club => ({
    // Links out of this page must not carry its URL in the Referer header
    referrer: 'no-referrer',
    ...pageMetadata({
      title: fitTitle('Your Tickets', clubName(club), SITE_NAME),
      description: fitDescription(`Your ${club.name} event tickets.`),
      path: `/${club.slug}`,
      noIndex: true,
    }),
  }));
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
