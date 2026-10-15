import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';
import { tournamentManagePath } from '@/lib/public-tournaments';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return pageMetadata({ title: 'Manage tournament | itsfootball.club', description: 'Enter scores and update your tournament.', path: tournamentManagePath(slug), noIndex: true });
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
