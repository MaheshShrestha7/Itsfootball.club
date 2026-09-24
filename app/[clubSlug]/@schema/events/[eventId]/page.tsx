import JsonLd from '@/components/JsonLd';
import { eventSchema } from '@/lib/schema';
import { findClubBySlug, findEventById } from '@/lib/supabase/club-lookup';

export default async function EventSchema({ params }: { params: Promise<{ clubSlug: string; eventId: string }> }) {
  const { clubSlug, eventId } = await params;
  const [club, event] = await Promise.all([findClubBySlug(clubSlug), findEventById(eventId)]);
  if (!club || !event || event.club_id !== club.id) return null;
  return <JsonLd data={eventSchema(club, event)} />;
}
