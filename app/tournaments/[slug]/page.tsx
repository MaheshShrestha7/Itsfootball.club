import type { Metadata } from 'next';
import PlatformNavbar from '@/components/PlatformNavbar';
import Footer from '@/components/Footer';
import JsonLd from '@/components/JsonLd';
import PublicTournamentView from '@/components/tournament/PublicTournamentView';
import { findClubBySlug, findEventTournament } from '@/lib/supabase/club-lookup';
import { fitDescription, fitTitle, pageMetadata } from '@/lib/seo';
import { publicTournamentSchema } from '@/lib/schema';
import { TIME_ZONE } from '@/lib/email/format';
import { parseTournamentDate } from '@/lib/tournament-engine';
import { MIN_INDEXABLE_TEAMS, tournamentPagePath, tournamentProgress, tournamentSummary, tournamentSummaryParts } from '@/lib/public-tournaments';
import type { ClubMetadataRow, EventTournamentRow } from '@/lib/supabase/club-lookup';

async function lookup(slug: string) {
  const club = await findClubBySlug(slug);
  const tournament = club ? await findEventTournament(club.id) : null;
  return { club, tournament };
}

const summaryInput = (club: ClubMetadataRow, tournament: EventTournamentRow) => ({
  name: tournament.name,
  format: tournament.format,
  teamSize: club.config?.team_size,
  teamCount: tournament.team_count,
  venue: tournament.venue,
  organiser: club.config?.organiser,
  progress: tournamentProgress(tournament.matches),
});
const summaryOf = (club: ClubMetadataRow, tournament: EventTournamentRow) => tournamentSummary(summaryInput(club, tournament));

/** "18 Oct 2026" or "18-19 Oct 2026", in the platform's time zone (as match titles are) */
function dateText(start?: string | null, end?: string | null): string {
  const s = parseTournamentDate(start || undefined);
  if (!s) return '';
  // A date-only value has no time zone to convert from
  const timeZone = /^\d{4}-\d{2}-\d{2}$/.test(start || '') ? 'UTC' : TIME_ZONE;
  const fmt = (d: Date) => d.toLocaleDateString('en-AU', { timeZone, day: 'numeric', month: 'short', year: 'numeric' });
  const e = parseTournamentDate(end || undefined);
  return e && fmt(e) !== fmt(s) ? `${fmt(s)} to ${fmt(e)}` : fmt(s);
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const { club, tournament } = await lookup(slug);
  const path = tournamentPagePath(club?.slug || slug);
  if (!club || !tournament) {
    return pageMetadata({ title: 'Tournament | itsfootball.club', description: 'Live fixtures, tables and bracket for a soccer tournament.', path, noIndex: true });
  }
  const input = summaryInput(club, tournament);
  const { progress, organiser, venue } = input;
  const { what, result } = tournamentSummaryParts(input);
  const when = dateText(tournament.start_date, tournament.end_date);
  return pageMetadata({
    title: fitTitle(tournament.name, progress.champion ? 'Results & Bracket' : 'Fixtures, Table & Bracket', 'itsfootball.club'),
    description: fitDescription(
      // Most useful first (the winner once there is one), so it survives the snippet length limit
      ...(progress.champion ? [`${tournament.name}: ${result}`] : []),
      `${progress.champion ? what[0].toUpperCase() + what.slice(1) : `${tournament.name}: ${what}`}${venue ? ` at ${venue}` : ''}.`,
      progress.champion ? null : result,
      when ? `${progress.champion ? 'Played' : 'On'} ${when}.` : null,
      organiser ? `Organised by ${organiser}.` : null,
      'Live scores, fixtures, tables and the bracket.'
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
      {club && tournament && <JsonLd data={publicTournamentSchema(club, tournament, summaryOf(club, tournament))} />}
      <PlatformNavbar />
      <PublicTournamentView slug={slug.toLowerCase()} fallbackName={tournament?.name} />
      <Footer />
    </div>
  );
}
