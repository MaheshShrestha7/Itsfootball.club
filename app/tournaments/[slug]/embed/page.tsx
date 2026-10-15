import type { Metadata } from 'next';
import { TournamentEmbedView } from '@/components/tournament/PublicTournamentView';
import { pageMetadata } from '@/lib/seo';
import { tournamentPagePath } from '@/lib/public-tournaments';

// Framed by other sites (next.config.ts and middleware.ts allow it for this path only)
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return pageMetadata({ title: 'Live tournament bracket | itsfootball.club', description: 'Live fixtures, tables and bracket.', path: tournamentPagePath(slug), noIndex: true });
}

export default async function TournamentEmbedPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const [{ slug }, { view }] = await Promise.all([params, searchParams]);
  return (
    <div style={{ minHeight: '100vh', background: 'rgb(var(--dk-9-13-22))' }}>
      <TournamentEmbedView slug={slug.toLowerCase()} view={view || ''} />
    </div>
  );
}
