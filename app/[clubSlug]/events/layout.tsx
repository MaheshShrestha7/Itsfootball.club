import type { Metadata } from 'next';
import { SITE_NAME, clubImage, clubName, clubPageMetadata, fitDescription, fitTitle, pageMetadata } from '@/lib/seo';

// The events list (/club/events). A single event's own layout sets that page's details.
export async function generateMetadata({ params }: { params: Promise<{ clubSlug: string }> }): Promise<Metadata> {
  const { clubSlug } = await params;
  return clubPageMetadata(clubSlug, club =>
    pageMetadata({
      title: fitTitle('Events & Tickets', clubName(club), SITE_NAME),
      description: fitDescription(
        `What's on at ${club.name}: socials, presentation nights, trials and club events, with tickets.`,
        'See what\'s coming up.'
      ),
      path: `/${club.slug}/events`,
      ...clubImage(club),
    })
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
