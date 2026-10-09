import type { Metadata } from 'next';
import { SITE_NAME, clubName, clubPageMetadata, fitTitle, pageMetadata } from '@/lib/seo';

// The installed app's start page: personal, so not indexed
export async function generateMetadata({ params }: { params: Promise<{ clubSlug: string }> }): Promise<Metadata> {
  const { clubSlug } = await params;
  return clubPageMetadata(clubSlug, club =>
    pageMetadata({
      title: fitTitle('My Club', clubName(club), SITE_NAME),
      description: `Your ${club.name} app: what's coming up, your availability, your pass and your club tools.`,
      path: `/${club.slug}/app`,
      noIndex: true,
    })
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
