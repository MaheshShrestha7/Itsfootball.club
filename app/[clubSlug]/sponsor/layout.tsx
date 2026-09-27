import type { Metadata } from 'next';
import { SITE_NAME, clubImage, clubName, clubPageMetadata, fitDescription, fitTitle, pageMetadata } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ clubSlug: string }> }): Promise<Metadata> {
  const { clubSlug } = await params;
  return clubPageMetadata(clubSlug, club =>
    pageMetadata({
      title: fitTitle('Become a Sponsor', clubName(club), SITE_NAME),
      description: fitDescription(
        `Sponsor ${club.name}: pick a package, sign up online and pay by card or bank transfer.`,
        'Back your local club.'
      ),
      path: `/${club.slug}/sponsor`,
      ...clubImage(club),
    })
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
