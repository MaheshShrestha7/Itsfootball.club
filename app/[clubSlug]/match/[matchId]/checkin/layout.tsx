import type { Metadata } from 'next';
import { SITE_NAME, clubImage, clubName, clubPageMetadata, fitDescription, fitTitle, pageMetadata } from '@/lib/seo';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ clubSlug: string; matchId: string }>;
}): Promise<Metadata> {
  const { clubSlug, matchId } = await params;
  return clubPageMetadata(clubSlug, club =>
    pageMetadata({
      title: fitTitle('Matchday Check-In', clubName(club), SITE_NAME),
      description: fitDescription(
        `Check in at the ground for this ${club.name} match: scan your digital member pass or enter your details to record your attendance.`,
        'Check in now.'
      ),
      path: `/${club.slug}/match/${matchId}/checkin`,
      ...clubImage(club),
      noIndex: true,
    })
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
