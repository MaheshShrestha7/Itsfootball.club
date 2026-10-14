import JsonLd from '@/components/JsonLd';
import { clubAboutSchema } from '@/lib/schema';
import { findClubBySlug } from '@/lib/supabase/club-lookup';

export default async function ClubAboutSchema({ params }: { params: Promise<{ clubSlug: string }> }) {
  const club = await findClubBySlug((await params).clubSlug);
  return club ? <JsonLd data={clubAboutSchema(club)} /> : null;
}
