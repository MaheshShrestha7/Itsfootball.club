import type { Metadata } from 'next';
import { findEventById } from '@/lib/supabase/club-lookup';
import { clubImage, clubName, clubPageMetadata, fitDescription, fitTitle, pageMetadata } from '@/lib/seo';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ clubSlug: string; eventId: string }>;
}): Promise<Metadata> {
  const { clubSlug, eventId } = await params;
  const event = await findEventById(eventId);

  return clubPageMetadata(clubSlug, club => {
    const path = `/${club.slug}/events/${eventId}`;
    // Not found, or a private event the public can't read
    if (!event || event.club_id !== club.id) {
      return pageMetadata({
        title: fitTitle('Club Event', clubName(club)),
        description: fitDescription(`Event details for ${club.name}, including date, venue and how to RSVP.`, 'See the club website for fixtures, events and news.', 'RSVP now.'),
        path,
        ...clubImage(club),
        noIndex: true,
      });
    }
    const date = event.start_time
      ? new Date(event.start_time).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
      : null;
    return pageMetadata({
      title: fitTitle(event.title, clubName(club)),
      description: fitDescription(
        `${event.title}, a ${club.name} event${date ? ` on ${date}` : ''}${event.location ? ` at ${event.location}` : ''}.`,
        'See the details, meet the event sponsors and RSVP to save your place.',
        'RSVP to save your place.',
        'RSVP now.'
      ),
      path,
      type: 'article',
      ...clubImage(club),
    });
  });
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
