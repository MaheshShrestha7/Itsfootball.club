import type { Metadata } from 'next';
import { findNewsBySlug } from '@/lib/supabase/club-lookup';
import { clubImage, clubName, clubPageMetadata, fitDescription, fitTitle, pageMetadata } from '@/lib/seo';
import { decodeSlugParam, newsPath } from '@/lib/slugs';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ clubSlug: string; newsSlug: string }>;
}): Promise<Metadata> {
  const { clubSlug, newsSlug } = await params;
  const slug = decodeSlugParam(newsSlug);

  return clubPageMetadata(clubSlug, async club => {
    const article = await findNewsBySlug(club.id, slug);
    const path = newsPath(club.slug, article?.slug || slug);
    if (!article) {
      return pageMetadata({
        title: fitTitle('Club News', clubName(club)),
        description: fitDescription(`News from ${club.name}.`, 'This article may have been moved or removed. See the club website for the latest news, fixtures and results.'),
        path,
        ...clubImage(club),
        noIndex: true,
      });
    }
    return pageMetadata({
      title: fitTitle(article.title, clubName(club)),
      description: fitDescription(
        article.summary,
        `The latest news from ${club.name}.`,
        'Read the full story on the club website.',
        'Read the full story.'
      ),
      path,
      type: 'article',
      ...(article.cover_image_url ? { image: article.cover_image_url, imageIsSquare: false } : clubImage(club)),
    });
  });
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
