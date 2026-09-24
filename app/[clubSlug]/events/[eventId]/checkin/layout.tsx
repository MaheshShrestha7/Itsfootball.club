import type { Metadata } from 'next';
import { SITE_NAME, clubImage, clubName, clubPageMetadata, fitDescription, fitTitle, pageMetadata } from '@/lib/seo';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ clubSlug: string; eventId: string }>;
}): Promise<Metadata> {
  const { clubSlug, eventId } = await params;
  return clubPageMetadata(clubSlug, club =>
    pageMetadata({
      title: fitTitle('Event Check-In', clubName(club), SITE_NAME),
      description: fitDescription(
        `Check in at the door of an event hosted by ${club.name}: scan your digital member pass or enter your details to register attendance.`,
        'Check in now.'
      ),
      path: `/${club.slug}/events/${eventId}/checkin`,
      ...clubImage(club),
      noIndex: true,
    })
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
