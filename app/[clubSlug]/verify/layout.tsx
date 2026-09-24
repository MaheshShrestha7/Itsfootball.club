import type { Metadata } from 'next';
import { SITE_NAME, clubImage, clubName, clubPageMetadata, fitDescription, fitTitle, pageMetadata } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ clubSlug: string }> }): Promise<Metadata> {
  const { clubSlug } = await params;
  return clubPageMetadata(clubSlug, club =>
    pageMetadata({
      title: fitTitle('Verify a Member Pass', clubName(club), SITE_NAME),
      description: fitDescription(
        `Check that a digital member pass from ${club.name} is genuine and current by scanning its QR code or entering its pass code.`,
        'Verify a pass now.',
        'Verify now.'
      ),
      path: `/${club.slug}/verify`,
      ...clubImage(club),
      noIndex: true,
    })
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
