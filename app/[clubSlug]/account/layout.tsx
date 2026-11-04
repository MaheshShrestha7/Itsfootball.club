import type { Metadata } from 'next';
import { SITE_NAME, clubName, clubPageMetadata, fitTitle, pageMetadata } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ clubSlug: string }> }): Promise<Metadata> {
  const { clubSlug } = await params;
  return clubPageMetadata(clubSlug, club =>
    pageMetadata({
      title: fitTitle('Account settings', clubName(club), SITE_NAME),
      description: 'Your account: name, photo, email, password, two-step sign-in, club emails and notifications.',
      path: `/${club.slug}/account`,
      noIndex: true,
    })
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
