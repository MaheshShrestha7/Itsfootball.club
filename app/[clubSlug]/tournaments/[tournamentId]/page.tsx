'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useClub } from '@/lib/club-context';
import TournamentBracketView from '@/components/tournament/TournamentBracketView';
import TournamentStandingsTable from '@/components/tournament/TournamentStandingsTable';
import TournamentMatchesList from '@/components/tournament/TournamentMatchesList';
import {
  Trophy,
  ArrowLeft,
  Calendar,
  Layers,
  Users,
  Radio,
  MapPin,
  Clock,
  Sparkles
} from 'lucide-react';

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
    getTournamentStandings,
  } = useClub();

  const club = selectClubBySlug(resolvedParams.clubSlug) || clubs[0];
  const tournament = tournaments.find(t => t.id === resolvedParams.tournamentId);

  const [activeTab, setActiveTab] = useState<'bracket' | 'standings' | 'fixtures' | 'teams'>('bracket');

  // Set initial default tab: if league, default to standings; otherwise bracket
  useEffect(() => {
    if (tournament && tournament.format === 'league') {
      setActiveTab('standings');
    }
  }, [tournament]);

  if (!tournament) {
    return (
      <div style={{ minHeight: '100vh', background: '#090D16', color: '#FFFFFF' }}>
        <div style={{ padding: '6rem 1.5rem', textAlign: 'center' }}>
          <h2>Tournament Not Found</h2>
          <p style={{ color: 'var(--text-secondary)' }}>The requested tournament does not exist or has concluded.</p>
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

  const formatLabel =
    tournament.format === 'knockout'
      ? 'Single-Elimination Knockout'
      : tournament.format === 'league'
      ? 'Round-Robin League'
      : 'Group Stage + Knockout';

  return (
    <div style={{ minHeight: '100vh', background: '#090D16', color: '#FFFFFF' }}>

      {/* Tournament Header */}
      <section
        style={{
          background: 'linear-gradient(180deg, rgba(16, 185, 129, 0.12) 0%, rgba(9, 13, 22, 0.95) 100%)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          padding: '2.5rem 1.5rem 1.5rem 1.5rem',
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
                  background: 'rgba(245, 158, 11, 0.15)',
                  border: '2px solid rgba(245, 158, 11, 0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#F59E0B',
                  boxShadow: '0 0 25px rgba(245, 158, 11, 0.25)',
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
                    <span
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        padding: '2px 8px',
                        borderRadius: '6px',
                        background: 'rgba(239, 68, 68, 0.2)',
                        color: '#EF4444',
                        border: '1px solid #EF4444',
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
                          background: '#EF4444',
                          animation: 'pulse 1.5s infinite',
                        }}
                      />
                      {liveCount} LIVE
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', color: 'var(--text-secondary)', fontSize: '0.85rem', flexWrap: 'wrap' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#10B981', fontWeight: 700 }}>
                    <Layers size={14} />
                    <span>{formatLabel}</span>
                  </span>
                  <span>•</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <Calendar size={14} />
                    <span>Season {tournament.season}</span>
                  </span>
                  <span>•</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <MapPin size={14} />
                    <span>{tournament.venue || 'Stadium Arena'}</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Live Feed Synced Pill */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                background: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                padding: '0.4rem 0.85rem',
                borderRadius: '20px',
                color: '#10B981',
                fontSize: '0.75rem',
                fontWeight: 800,
                letterSpacing: '0.04em',
              }}
            >
              <Sparkles size={13} />
              <span>LIVE BRACKET SYNCED</span>
            </div>
          </div>
        </div>
      </section>

      {/* Main Tabs and Content */}
      <main style={{ maxWidth: '1300px', margin: '0 auto', padding: '2rem 1.5rem 4rem 1.5rem' }}>
        {/* Navigation Tabs */}
        <div
          style={{
            display: 'flex',
            gap: '0.5rem',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            marginBottom: '1.75rem',
            overflowX: 'auto',
          }}
        >
          {tournament.format !== 'league' && (
            <button
              onClick={() => setActiveTab('bracket')}
              style={{
                padding: '0.85rem 1.5rem',
                background: 'transparent',
                border: 'none',
                borderBottom: activeTab === 'bracket' ? '2px solid #10B981' : '2px solid transparent',
                color: activeTab === 'bracket' ? '#10B981' : 'var(--text-secondary)',
                fontWeight: 800,
                fontSize: '0.92rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                whiteSpace: 'nowrap',
              }}
            >
              <Trophy size={16} />
              <span>Interactive Tiesheet Bracket</span>
            </button>
          )}

          {tournament.format !== 'knockout' && (
            <button
              onClick={() => setActiveTab('standings')}
              style={{
                padding: '0.85rem 1.5rem',
                background: 'transparent',
                border: 'none',
                borderBottom: activeTab === 'standings' ? '2px solid #10B981' : '2px solid transparent',
                color: activeTab === 'standings' ? '#10B981' : 'var(--text-secondary)',
                fontWeight: 800,
                fontSize: '0.92rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                whiteSpace: 'nowrap',
              }}
            >
              <Layers size={16} />
              <span>Live Points Table (Standings)</span>
            </button>
          )}

          <button
            onClick={() => setActiveTab('fixtures')}
            style={{
              padding: '0.85rem 1.5rem',
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'fixtures' ? '2px solid #10B981' : '2px solid transparent',
              color: activeTab === 'fixtures' ? '#10B981' : 'var(--text-secondary)',
              fontWeight: 800,
              fontSize: '0.92rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              whiteSpace: 'nowrap',
            }}
          >
            <Calendar size={16} />
            <span>Fixtures & Results ({tourneyMatches.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('teams')}
            style={{
              padding: '0.85rem 1.5rem',
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'teams' ? '2px solid #10B981' : '2px solid transparent',
              color: activeTab === 'teams' ? '#10B981' : 'var(--text-secondary)',
              fontWeight: 800,
              fontSize: '0.92rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              whiteSpace: 'nowrap',
            }}
          >
            <Users size={16} />
            <span>Teams & Rosters ({participants.length})</span>
          </button>
        </div>

        {/* Tab 1: Bracket */}
        {activeTab === 'bracket' && (
          <div>
            <TournamentBracketView matches={tourneyMatches} isAdmin={false} />
          </div>
        )}

        {/* Tab 2: Standings */}
        {activeTab === 'standings' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {tournament.format === 'group_knockout' ? (
              ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].slice(0, tournament.group_count ?? 1).map(groupLetter => {
                const groupStandings = getTournamentStandings(tournament.id, groupLetter);
                return (
                  <div key={groupLetter}>
                    <TournamentStandingsTable
                      standings={groupStandings}
                      groupTitle={tournament.group_count === 1 ? 'Group Stage Standings' : `Group ${groupLetter} Standings`}
                      advancingCount={tournament.teams_advancing_per_group ?? 2}
                    />
                  </div>
                );
              })
            ) : (
              <TournamentStandingsTable
                standings={getTournamentStandings(tournament.id)}
                groupTitle={`${tournament.name} Standings`}
                advancingCount={0}
              />
            )}
          </div>
        )}

        {/* Tab 3: Fixtures */}
        {activeTab === 'fixtures' && (
          <TournamentMatchesList
            matches={tourneyMatches}
            clubSlug={club.slug}
            isAdmin={false}
          />
        )}

        {/* Tab 4: Teams */}
        {activeTab === 'teams' && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))',
              gap: '1rem',
            }}
          >
            {participants.map(part => (
              <div
                key={part.id}
                style={{
                  background: 'rgba(15, 23, 42, 0.75)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '12px',
                  padding: '1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.85rem',
                }}
              >
                <img
                  src={part.logo_url || '/crests/apex-city.svg'}
                  alt=""
                  style={{ width: '42px', height: '42px', objectFit: 'contain' }}
                />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 800, color: '#FFFFFF', fontSize: '0.95rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {part.name}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '3px' }}>
                    <span
                      style={{
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        padding: '1px 6px',
                        borderRadius: '4px',
                        background:
                          part.team_type === 'internal'
                            ? 'rgba(16, 185, 129, 0.15)'
                            : 'rgba(59, 130, 246, 0.15)',
                        color: part.team_type === 'internal' ? '#10B981' : '#60A5FA',
                      }}
                    >
                      {part.team_type === 'internal' ? 'Internal Squad' : 'Guest Club'}
                    </span>
                    {part.seed && (
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        Seed #{part.seed}
                      </span>
                    )}
                    {part.group && (
                      <span style={{ fontSize: '0.7rem', color: '#F59E0B', fontWeight: 700 }}>
                        Group {part.group}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
