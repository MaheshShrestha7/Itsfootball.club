'use client';

import React, { use } from 'react';
import Link from 'next/link';
import { Trophy, Calendar, Layers, ChevronRight } from 'lucide-react';
import LocalTime from '@/components/LocalTime';
import { useClub } from '@/lib/club-context';
import { parseTournamentDate } from '@/lib/tournament-engine';
import { isPastTournament } from '@/lib/club-lists';
import { useUrlTab } from '@/lib/use-url-tab';
import type { Tournament } from '@/lib/supabase/types';
import ClubSubPage, { EmptyState, ListSkeleton, UpcomingPastTabs } from '@/components/ClubSubPage';

const VIEWS = ['upcoming', 'past'] as const;
const FORMAT: Record<string, string> = { knockout: 'Knockout', league: 'League (round robin)' };
const startOf = (t: Pick<Tournament, 'start_date'>) => parseTournamentDate(t.start_date)?.getTime() ?? 0;

/** /club/tournaments: Live & upcoming (live first) | Past (finished, newest first), ?view=past in the URL */
export default function PublicTournamentsPage({ params }: { params: Promise<{ clubSlug: string }> }) {
  const { clubSlug } = use(params);
  const { clubs, selectClubBySlug, tournaments, tournamentParticipants, matches, isHydrated } = useClub();
  const club = selectClubBySlug(clubSlug) || clubs[0];
  const [view, setView] = useUrlTab(VIEWS, 'view');

  const clubTournaments = tournaments.filter(t => t.club_id === club.id);
  const upcoming = clubTournaments.filter(t => !isPastTournament(t))
    .sort((a, b) => Number(b.status === 'ongoing') - Number(a.status === 'ongoing') || startOf(a) - startOf(b));
  const past = clubTournaments.filter(t => isPastTournament(t)).sort((a, b) => startOf(b) - startOf(a));
  const list = view === 'upcoming' ? upcoming : past;

  const card = (t: Tournament) => {
    const teams = tournamentParticipants.filter(p => p.tournament_id === t.id).length;
    const games = matches.filter(m => m.tournament_id === t.id);
    const played = games.filter(m => m.status === 'completed').length;
    const live = t.status === 'ongoing';
    const done = isPastTournament(t);
    const start = parseTournamentDate(t.start_date);
    return (
      <Link key={t.id} href={`/${club.slug}/tournaments/${t.id}`} className="glass-panel glass-panel-interactive club-tourn-card">
        <div className="club-tourn-banner" style={{ backgroundImage: t.banner_url ? `url(${t.banner_url})` : undefined }}>
          <span className={`badge ${live ? 'badge-live' : ''}`} style={live ? undefined : { background: 'rgba(0,0,0,0.45)', color: '#fff' }}>
            {live ? <><span className="pulse-dot" /> Live</> : done ? 'Finished' : 'Upcoming'}
          </span>
        </div>
        <div className="club-tourn-body">
          <h2 className="club-tourn-name"><Trophy size={17} color="var(--c-amber)" aria-hidden="true" className="shrink-0" /> {t.name}</h2>
          <div className="text-meta" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem 0.9rem' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}><Calendar size={13} aria-hidden="true" />{start ? <LocalTime value={start} options={{ day: 'numeric', month: 'short', year: 'numeric' }} /> : 'Date to be confirmed'}</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}><Layers size={13} aria-hidden="true" />{FORMAT[t.format] || 'Groups + knockout'}</span>
          </div>
          {t.description && <p className="text-note club-tourn-desc">{t.description}</p>}
          <div className="club-tourn-stats">
            <span><strong>{teams}</strong> teams</span>
            <span><strong>{games.length}</strong> games</span>
            <span><strong>{played}</strong> played</span>
            <ChevronRight size={18} color="var(--text-muted)" aria-hidden="true" style={{ marginLeft: 'auto' }} />
          </div>
        </div>
      </Link>
    );
  };

  return (
    <ClubSubPage club={club} title="Tournaments & cups" intro={`Follow ${club.name}'s cups and tournaments: draws, brackets, tables and results.`}>
      <div className="club-toolbar">
        <UpcomingPastTabs view={view} onView={setView} upcoming={upcoming.length} past={past.length} labels={['Live & upcoming', 'Past']} />
      </div>
      {!isHydrated ? (
        <ListSkeleton rows={3} height={220} label="Loading tournaments" />
      ) : list.length === 0 ? (
        view === 'upcoming' ? (
          <EmptyState title="No tournaments on right now"
            action={past.length > 0 ? <button type="button" className="btn btn-secondary btn-sm" onClick={() => setView('past')}>See past tournaments</button> : undefined} />
        ) : (
          <EmptyState title="No finished tournaments yet" />
        )
      ) : (
        <div className="club-tourn-grid">{list.map(card)}</div>
      )}
    </ClubSubPage>
  );
}
