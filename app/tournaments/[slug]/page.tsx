import type { Metadata } from 'next';
import PlatformNavbar from '@/components/PlatformNavbar';
import Footer from '@/components/Footer';
import JsonLd from '@/components/JsonLd';
import PublicTournamentView from '@/components/tournament/PublicTournamentView';
import { findClubBySlug, findEventTournament } from '@/lib/supabase/club-lookup';
import { fitDescription, fitTitle, pageMetadata } from '@/lib/seo';
import { publicTournamentSchema } from '@/lib/schema';
import { MIN_INDEXABLE_TEAMS, tournamentPagePath } from '@/lib/public-tournaments';

const FORMATS: Record<string, string> = { knockout: 'knockout cup', league: 'league', group_knockout: 'group stage and knockout cup' };

async function lookup(slug: string) {
  const club = await findClubBySlug(slug);
  const tournament = club ? await findEventTournament(club.id) : null;
  return { club, tournament };
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const { club, tournament } = await lookup(slug);
  const path = tournamentPagePath(club?.slug || slug);
  if (!club || !tournament) {
    return pageMetadata({ title: 'Tournament | itsfootball.club', description: 'Live fixtures, tables and bracket for a soccer tournament.', path, noIndex: true });
  }
  const format = FORMATS[tournament.format || ''] || 'tournament';
  const size = club.config?.team_size ? ` ${club.config.team_size}` : '';
  return pageMetadata({
    title: fitTitle(tournament.name, 'Fixtures, Table & Bracket', 'itsfootball.club'),
    description: fitDescription(
      `${tournament.name}: a${size} ${format}${tournament.venue ? ` at ${tournament.venue}` : ''}${club.config?.organiser ? `, organised by ${club.config.organiser}` : ''}.`,
      `${tournament.team_count} teams. See live scores, fixtures, results, tables and the knockout bracket.`,
      'Follow every match live.'
    ),
    path,
    ...(tournament.banner_url ? { image: tournament.banner_url, imageIsSquare: false } : {}),
    // Kept out of search until it's a real tournament (a draft or test page would be thin content)
    noIndex: tournament.team_count < MIN_INDEXABLE_TEAMS || !tournament.start_date,
  });
}

export default async function PublicTournamentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { club, tournament } = await lookup(slug);
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'rgb(var(--dk-9-13-22))' }}>
      {club && tournament && <JsonLd data={publicTournamentSchema(club, tournament)} />}
      <PlatformNavbar />
      <PublicTournamentView slug={slug.toLowerCase()} fallbackName={tournament?.name} />
      <Footer />
    </div>
  );
}
