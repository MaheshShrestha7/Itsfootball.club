import JsonLd from '@/components/JsonLd';
import { newsArticleSchema } from '@/lib/schema';
import { findClubBySlug, findNewsBySlug } from '@/lib/supabase/club-lookup';
import { decodeSlugParam } from '@/lib/slugs';

export default async function NewsArticleSchema({ params }: { params: Promise<{ clubSlug: string; newsSlug: string }> }) {
  const { clubSlug, newsSlug } = await params;
  const club = await findClubBySlug(clubSlug);
  const article = club && (await findNewsBySlug(club.id, decodeSlugParam(newsSlug)));
  if (!club || !article) return null;
  return <JsonLd data={newsArticleSchema(club, article)} />;
}
