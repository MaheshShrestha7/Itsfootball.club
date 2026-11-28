'use client';

// One tournament write-up (lib/tournament-writeups.ts): group stage, semi-finals, final or round-up.
// Laid out like the club's match reports; written from the day's results, so it fills in by itself.
import React, { use } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useClub } from '@/lib/club-context';
import MatchReport from '@/components/MatchReport';
import { PageSkeleton } from '@/components/Skeleton';
import { useTournamentSponsors } from '@/lib/use-tournament-sponsors';
import { WRITEUP_LABELS, isWriteupKind, tournamentWriteup, writeupSourceFor, writeupTime } from '@/lib/tournament-writeups';

export default function TournamentWriteupPage({ params }: { params: Promise<{ clubSlug: string; tournamentId: string; kind: string }> }) {
  const { clubSlug, tournamentId, kind } = use(params);
  const { clubs, selectClubBySlug, tournaments, tournamentParticipants, matches, matchEvents, getTournamentStandings, isHydrated } = useClub();
  const club = selectClubBySlug(clubSlug) || clubs[0];
  const tournament = tournaments.find(t => t.id === tournamentId && t.club_id === club?.id);
  const { sponsors } = useTournamentSponsors(tournament?.id);
  const back = `/${club?.slug || clubSlug}/tournaments/${tournamentId}`;

  const src = tournament && writeupSourceFor({ clubSlug: club.slug, tournament, matches, matchEvents, participants: tournamentParticipants, getTournamentStandings, sponsors });
  const writeup = src && isWriteupKind(kind) ? tournamentWriteup(kind, src) : null;

  if (!writeup && !isHydrated) return <PageSkeleton label="Loading the write-up" />;
  return (
    <div style={{ minHeight: '100vh', background: 'rgb(var(--dk-9-13-22))', color: 'var(--text-primary)' }}>
      <main style={{ maxWidth: 860, margin: '0 auto', padding: '2rem 1rem 4rem' }}>
        <Link href={tournament ? `${back}?tab=news` : `/${club?.slug || clubSlug}/tournaments`} className="row row-tight text-meta" style={{ textDecoration: 'none', marginBottom: '1rem', display: 'inline-flex' }}>
          <ArrowLeft size={14} aria-hidden="true" /> {tournament ? `${tournament.name} news` : 'All tournaments'}
        </Link>
        {writeup && tournament && src ? (
          <MatchReport
            label={WRITEUP_LABELS[writeup.kind]}
            article={writeup}
            clubName={club.name}
            coverUrl={tournament.banner_url || undefined}
            crestUrl={club.logo_url || undefined}
            tags={[WRITEUP_LABELS[writeup.kind], tournament.name]}
            publishedAt={writeupTime(writeup.kind, src.matches) || undefined}
            shareUrl={`/${club.slug}/tournaments/${tournament.id}/news/${writeup.kind}`}
            factsTitle={writeup.kind === 'round-up' ? 'Tournament facts' : 'Facts'}
            facts={writeup.facts}
            source="Written from the results, goals and cards logged on the day."
            moreHref={`${back}?tab=stats`}
            moreText="See the tables, bracket and tournament stats"
          />
        ) : (
          <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center' }}>
            <h1 style={{ fontSize: '1.4rem', margin: '0 0 0.5rem' }}>{tournament ? 'Not written yet' : 'Tournament not found'}</h1>
            <p className="text-secondary" style={{ margin: 0 }}>
              {tournament ? 'This write-up appears once those games are played.' : 'It may have been removed.'}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
