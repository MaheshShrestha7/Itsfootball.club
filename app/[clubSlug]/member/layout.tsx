import type { Metadata } from 'next';
import { SITE_NAME, clubImage, clubName, clubPageMetadata, fitDescription, fitTitle, pageMetadata } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ clubSlug: string }> }): Promise<Metadata> {
  const { clubSlug } = await params;
  return clubPageMetadata(clubSlug, club =>
    pageMetadata({
      title: fitTitle('Membership & Member Portal', clubName(club), SITE_NAME),
      description: fitDescription(
        `Become a member of ${club.name}: apply online, get your digital member pass and follow your season stats.`,
        'Apply for membership today.',
        'Join today.'
      ),
      path: `/${club.slug}/member`,
      ...clubImage(club),
    })
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
