import type { Metadata } from 'next';
import { SITE_NAME, clubImage, clubName, clubPageMetadata, fitDescription, fitTitle, pageMetadata } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ clubSlug: string }> }): Promise<Metadata> {
  const { clubSlug } = await params;
  return clubPageMetadata(clubSlug, club =>
    pageMetadata({
      title: fitTitle('Our Teams', clubName(club), SITE_NAME),
      description: fitDescription(
        `Every ${club.name} team: first team, reserves, academy and youth sides, with squads, coaches and fixtures.`,
        'Follow every game live on the club match centre.'
      ),
      path: `/${club.slug}/teams`,
      ...clubImage(club),
    })
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
