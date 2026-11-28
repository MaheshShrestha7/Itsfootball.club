'use client';

import React, { useState, useEffect, use } from 'react';
import LocalTime from '@/components/LocalTime';
import Link from 'next/link';
import { useClub } from '@/lib/club-context';
import TournamentBracketView from '@/components/tournament/TournamentBracketView';
import TournamentStandingsTable from '@/components/tournament/TournamentStandingsTable';
import TournamentMatchesList from '@/components/tournament/TournamentMatchesList';
import TournamentOverview from '@/components/tournament/TournamentOverview';
import {
  Trophy,
  ArrowLeft,
  Calendar,
  Layers,
  MapPin,
  Clock,
  Sparkles,
} from 'lucide-react';
import { TournamentTabRow, TournamentStatsTab, TournamentNewsTab, type TournamentTab } from '@/components/tournament/TournamentStatsNews';
import { tournamentWriteups, writeupSourceFor } from '@/lib/tournament-writeups';
import SupportedBy from '@/components/SupportedBy';
import { TournamentPresenter, TournamentSponsorStrip, TournamentSponsorList } from '@/components/tournament/TournamentSponsors';
import { useTournamentSponsors } from '@/lib/use-tournament-sponsors';
import { useTournamentLinks } from '@/lib/tournament-links';
import { AgeGroupTabs, TeamDetail } from '@/components/tournament/HostedPublic';
import { usePublicSquads } from '@/lib/use-tournament-entries';
import { juniorPublicName } from '@/lib/teams';
import { DEFAULT_CREST } from '@/lib/crest';
import { GROUP_LETTERS, knockoutStarted, parseTournamentDate } from '@/lib/tournament-engine';

export default function PublicTournamentDetailPage({
  params,
}: {
  params: Promise<{ clubSlug: string; tournamentId: string }>;
}) {
  const resolvedParams = use(params);
  const {
    clubs,
    selectClubBySlug,
    tournaments,
    tournamentParticipants,
    matches,
    members,
    getTournamentStandings,
    matchEvents,
    events,
  } = useClub();

  const club = selectClubBySlug(resolvedParams.clubSlug) || clubs[0];
  const tournament = tournaments.find(t => t.id === resolvedParams.tournamentId);

  const [activeTab, setActiveTab] = useState<TournamentTab>('overview');
  // Group + knockout cups: the Table tab holds both the groups and the knockout bracket
  const [tableView, setTableView] = useState<'groups' | 'knockout' | null>(null);
  // ?team=<id> opens one team's page (the link in its entry email and the share card)
  const [teamId, setTeamId] = useState<string | null>(null);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const id = q.get('team');
    if (id) { setTeamId(id); setActiveTab('teams'); }
    // ?tab=news: the way back from a write-up
    else if (q.get('tab') === 'news' || q.get('tab') === 'stats') setActiveTab(q.get('tab') as TournamentTab);
    else if (q.get('tab') === 'bracket') { setActiveTab('bracket'); setTableView('knockout'); }
  }, []);
  const showTab = (t: TournamentTab) => {
    setActiveTab(t);
    requestAnimationFrame(() => document.getElementById('tournament-tabs')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };
  const openTeam = (id: string | null) => {
    setTeamId(id);
    const u = new URL(window.location.href);
    if (id) u.searchParams.set('team', id); else u.searchParams.delete('team');
    window.history.replaceState(null, '', u);
  };
  // A team tapped in the live table: its page on the Teams tab, with its games and results
  const showTeamGames = (id: string) => {
    openTeam(id);
    setActiveTab('teams');
    requestAnimationFrame(() => document.getElementById('tournament-tabs')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };
  const squads = usePublicSquads(tournament?.id, !!tournament);
  const { sponsors: tournamentSponsors } = useTournamentSponsors(tournament?.id);
  // Teams that are clubs on itsfootball.club and accepted: their page links to the club's own site
  const { linkOf } = useTournamentLinks(tournament?.id);


  if (!tournament) {
    return (
      <div style={{ minHeight: '100vh', background: 'rgb(var(--dk-9-13-22))', color: 'var(--text-primary)' }}>
        <div style={{ padding: '6rem 1.5rem', textAlign: 'center' }}>
          <h2>Tournament Not Found</h2>
          <p className="text-secondary">The requested tournament does not exist or has concluded.</p>
          <Link href={`/${club.slug}/tournaments`} className="btn btn-primary" style={{ marginTop: '1rem', display: 'inline-block' }}>
            Back to Tournaments
          </Link>
        </div>
      </div>
    );
  }

  const participants = tournamentParticipants.filter(p => p.tournament_id === tournament.id);
  const tourneyMatches = matches.filter(m => m.tournament_id === tournament.id);
  const liveCount = tourneyMatches.filter(m => m.status === 'live').length;
  const anyPlayed = tourneyMatches.some(m => m.status === 'completed' || m.status === 'live' || m.status === 'halftime');
  // The Table tab opens on the knockout bracket once the host has started the knockout games
  const table = tableView ?? (knockoutStarted(tournament, tourneyMatches) ? 'knockout' : 'groups');
  // Old ?tab=bracket links: on a group + knockout cup the bracket lives inside the Table tab
  const tab: TournamentTab = activeTab === 'bracket' && tournament.format !== 'knockout' ? 'standings' : activeTab;
  const showName = (n: string) => (tournament.is_junior ? juniorPublicName(n) : n);
  const linkedEvent = tournament.event_id ? events.find(e => e.id === tournament.event_id) : undefined;
  const openTeamRow = teamId ? participants.find(p => p.id === teamId) : undefined;
  const writeups = tournamentWriteups(club.slug, tournament.id, writeupSourceFor({
    clubSlug: club.slug, tournament, matches, matchEvents, participants, getTournamentStandings, sponsors: tournamentSponsors,
  }));

  const formatLabel =
    tournament.format === 'knockout'
      ? 'Single-Elimination Knockout'
      : tournament.format === 'league'
      ? 'Round-Robin League'
      : 'Group Stage + Knockout';

  return (
    <div style={{ minHeight: '100vh', background: 'rgb(var(--dk-9-13-22))', color: 'var(--text-primary)' }}>

      {/* Tournament Header */}
      <section
        data-theme={tournament.banner_url ? 'dark' : undefined}
        style={{
          background: tournament.banner_url
            ? `linear-gradient(180deg, rgba(var(--dk-9-13-22), 0.75) 0%, rgba(var(--dk-9-13-22), 0.96) 100%), url(${tournament.banner_url}) center/cover no-repeat`
            : 'linear-gradient(180deg, rgba(var(--club-primary-rgb), 0.12) 0%, rgba(var(--dk-9-13-22), 0.95) 100%)',
          borderBottom: '1px solid rgba(var(--tint-rgb), 0.08)',
          padding: '2.5rem 1.5rem 1.5rem 1.5rem',
          position: 'relative',
        }}
      >
        <div style={{ maxWidth: '1300px', margin: '0 auto' }}>
          <Link
            href={`/${club.slug}/tournaments`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              color: 'var(--text-secondary)',
              fontSize: '0.82rem',
              textDecoration: 'none',
              marginBottom: '1rem',
            }}
          >
            <ArrowLeft size={14} />
            <span>All Tournaments</span>
          </Link>

          {/* The main sponsor, as on the poster: "<sponsor> presents" above the tournament name */}
          <TournamentPresenter sponsors={tournamentSponsors} />

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '1.25rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
              <div
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '16px',
                  background: 'rgba(var(--club-primary-rgb), 0.12)',
                  border: '1px solid rgba(var(--club-primary-rgb), 0.45)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--club-ink)',
                }}
              >
                <Trophy size={32} />
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.35rem' }}>
                  <h1 style={{ fontSize: 'clamp(1.5rem, 3.5vw, 2.25rem)', fontWeight: 900, margin: 0 }}>
                    {tournament.name}
                  </h1>
                  {liveCount > 0 && (
                    <button type="button" onClick={() => showTab('overview')} aria-label={`${liveCount} live, see what's on now`}
                      style={{
                        cursor: 'pointer',
                        font: 'inherit',
                        whiteSpace: 'nowrap',
                        flex: 'none',
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        padding: '2px 8px',
                        borderRadius: '6px',
                        background: 'rgba(239, 68, 68, 0.2)',
                        color: 'var(--c-red)',
                        border: '1px solid var(--c-red)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px',
                      }}
                    >
                      <span
                        style={{
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          background: 'var(--c-red)',
                          animation: 'pulse 1.5s infinite',
                        }}
                      />
                      {liveCount} LIVE
                    </button>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', columnGap: '1.25rem', rowGap: '0.4rem', color: 'var(--text-secondary)', fontSize: '0.85rem', flexWrap: 'wrap' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: 'var(--club-ink)', fontWeight: 700 }}>
                    <Layers size={14} />
                    <span>{formatLabel}</span>
                  </span>
                  <span className="row row-tight">
                    <Calendar size={14} />
                    <span>Season {tournament.season}</span>
                  </span>
                  <span className="row row-tight">
                    <Clock size={14} />
                    <span>{parseTournamentDate(tournament.start_date) ? <LocalTime value={parseTournamentDate(tournament.start_date)!} format="both" options={{ dateStyle: 'medium', timeStyle: 'short' }} /> : 'Date TBC'}</span>
                  </span>
                  {tournament.venue && (
                    <span className="row row-tight">
                      <MapPin size={14} />
                      <span>{tournament.venue}</span>
                    </span>
                  )}
                  {linkedEvent && (
                    <Link href={`/${club.slug}/events/${linkedEvent.id}`} className="row row-tight" style={{ color: 'var(--club-ink)', fontWeight: 700 }}>
                      <Sparkles size={14} />
                      <span>Part of {linkedEvent.title}</span>
                    </Link>
                  )}
                </div>
                <TournamentSponsorStrip sponsors={tournamentSponsors} />
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Main Tabs and Content */}
      <main style={{ maxWidth: '1300px', margin: '0 auto', padding: '2rem 1.5rem 4rem 1.5rem' }}>
        <AgeGroupTabs tournaments={tournaments} tournament={tournament} href={t => `/${club.slug}/tournaments/${t.id}`} />

        {/* Stats and News only once they have something in them */}
        <TournamentTabRow active={tab} onChange={setActiveTab} tabs={[
          { key: 'overview', label: 'Overview' },
          { key: 'teams', label: 'Teams', count: participants.length },
          { key: 'fixtures', label: 'Games', count: tourneyMatches.length },
          tournament.format === 'knockout' ? { key: 'bracket' as const, label: 'Bracket' } : { key: 'standings' as const, label: 'Table' },
          ...(anyPlayed ? [{ key: 'stats' as const, label: 'Stats' }] : []),
          ...(writeups.length ? [{ key: 'news' as const, label: 'News', count: writeups.length }] : []),
        ]} />

        {tab === 'overview' && (
          <TournamentOverview tournament={tournament} matches={tourneyMatches} events={matchEvents} participants={participants}
            members={members.filter(m => m.club_id === club.id)} clubSlug={club.slug} host={club} writeups={writeups}
            standings={g => getTournamentStandings(tournament.id, g)} showName={showName} onTeam={showTeamGames} onTab={showTab} />
        )}

        {/* Tab 1: Bracket */}
        {tab === 'bracket' && (
          <div>
            <TournamentBracketView matches={tourneyMatches} isAdmin={false} />
          </div>
        )}

        {/* Tab 2: Standings */}
        {tab === 'standings' && tournament.format === 'group_knockout' && (
          <div className="ht-seg tp-switch" role="group" aria-label="Show">
            <button type="button" aria-pressed={table === 'groups'} onClick={() => setTableView('groups')}>Groups</button>
            <button type="button" aria-pressed={table === 'knockout'} onClick={() => setTableView('knockout')}>Knockout</button>
          </div>
        )}
        {tab === 'standings' && tournament.format === 'group_knockout' && table === 'knockout' && (
          <TournamentBracketView matches={tourneyMatches} isAdmin={false} />
        )}
        {tab === 'standings' && !(tournament.format === 'group_knockout' && table === 'knockout') && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {tournament.format === 'group_knockout' ? (
              GROUP_LETTERS.slice(0, tournament.group_count ?? 1).map(groupLetter => {
                const groupStandings = getTournamentStandings(tournament.id, groupLetter);
                return (
                  <div key={groupLetter}>
                    <TournamentStandingsTable tieBreakers={tournament.tie_breakers ?? null}
                      standings={groupStandings}
                      groupTitle={tournament.group_count === 1 ? 'Group Stage Standings' : `Group ${groupLetter} Standings`}
                      advancingCount={tournament.teams_advancing_per_group ?? 2}
                      onTeamClick={showTeamGames}
                    />
                  </div>
                );
              })
            ) : (
              <TournamentStandingsTable tieBreakers={tournament.tie_breakers ?? null}
                standings={getTournamentStandings(tournament.id)}
                groupTitle={`${tournament.name} Standings`}
                advancingCount={0}
                onTeamClick={showTeamGames}
              />
            )}
          </div>
        )}

        {/* Tab 3: Fixtures */}
        {tab === 'fixtures' && (
          <TournamentMatchesList
            matches={tourneyMatches}
            clubSlug={club.slug}
            isAdmin={false}
          />
        )}

        {tab === 'stats' && (
          <TournamentStatsTab matches={tourneyMatches} events={matchEvents} participants={participants} clubSlug={club.slug} showName={showName} onTeam={showTeamGames} />
        )}

        {tab === 'news' && <TournamentNewsTab writeups={writeups} />}

        {tab === 'teams' && openTeamRow && (
          <TeamDetail team={openTeamRow} tournament={tournament} matches={tourneyMatches} events={matchEvents}
            squad={squads} participants={participants} clubSlug={club.slug} host={club} showName={showName} onClose={() => openTeam(null)}
            clubPage={(l => (l?.status === 'accepted' && l.linked ? { name: l.linked.name, href: `/${l.linked.slug}` } : undefined))(linkOf(openTeamRow.id))} />
        )}

        {/* Tab 4: Teams */}
        {tab === 'teams' && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))',
              gap: '1rem',
            }}
          >
            {participants.map(part => (
              <button
                type="button"
                key={part.id}
                onClick={() => { openTeam(part.id); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                aria-pressed={part.id === teamId}
                className="ht-team-card"
                style={{
                  '--ht-c1': part.color || 'rgba(var(--tint-rgb), 0.08)',
                  textAlign: 'left',
                  cursor: 'pointer',
                  font: 'inherit',
                  color: 'inherit',
                  width: '100%',
                  background: 'rgba(var(--dk-15-23-42), 0.75)',
                  border: '1px solid rgba(var(--tint-rgb), 0.08)',
                  borderLeft: '4px solid var(--ht-c1)',
                  borderRadius: '12px',
                  padding: '1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.85rem',
                } as React.CSSProperties}
              >
                <img loading="lazy" decoding="async" width={42} height={42}
                  src={part.logo_url || DEFAULT_CREST}
                  alt=""
                  style={{ width: '42px', height: '42px', objectFit: 'contain' }}
                />
                <div className="min-w-0">
                  <div style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '0.95rem', overflowWrap: 'anywhere' }}>
                    {part.name}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '3px' }}>
                    {part.seed && (
                      <span className="text-meta">
                        Seed #{part.seed}
                      </span>
                    )}
                    {part.group && (
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 700 }}>
                        Group {part.group}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
        {/* The tournament's own sponsors; without any, the event's or club's top sponsors as before */}
        <div style={{ marginTop: '2.5rem' }}>
          {tournamentSponsors.some(s => s.is_active)
            ? <TournamentSponsorList sponsors={tournamentSponsors} />
            : <SupportedBy clubId={club.id} eventId={tournament.event_id || undefined} />}
        </div>
      </main>
    </div>
  );
}
