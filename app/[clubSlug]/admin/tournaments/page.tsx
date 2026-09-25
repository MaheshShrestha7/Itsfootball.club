'use client';

import React, { useState, use, useEffect } from 'react';
import Link from 'next/link';
import { useClub } from '@/lib/club-context';
import { Tournament } from '@/lib/supabase/types';
import InternalTeamsManager from '@/components/tournament/InternalTeamsManager';
import TournamentFormModal from '@/components/tournament/TournamentFormModal';
import { Trophy, Swords, Users, Plus, Calendar, Layers, ArrowRight, Trash2, Pencil, Shield } from 'lucide-react';
import { parseTournamentDate } from '@/lib/tournament-engine';

export default function AdminTournamentsPage({
  params,
}: {
  params: Promise<{ clubSlug: string }>;
}) {
  const resolvedParams = use(params);
  const {
    clubs,
    selectClubBySlug,
    tournaments,
    internalTeams,
    tournamentParticipants,
    deleteTournament,
    matches,
    getActiveSeason,
    repairTournaments,
  } = useClub();

  const club = selectClubBySlug(resolvedParams.clubSlug) || clubs[0];
  const activeSeason = getActiveSeason(club.id);

  const clubTournaments = tournaments.filter(t => t.club_id === club.id);
  const clubInternalTeams = internalTeams.filter(t => t.club_id === club.id);

  const [activeTab, setActiveTab] = useState<'tournaments' | 'internal_teams'>('tournaments');
  // Upgrade tournaments made by older versions (missing fixtures, old 3rd place slots)
  useEffect(() => repairTournaments(club.id), [repairTournaments, club.id]);

  const [formTarget, setFormTarget] = useState<Tournament | 'new' | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const handleOpenWizard = () => setFormTarget('new');

  const handleDeleteTourn = (tournId: string, tournName: string) => {
    if (confirm(`Are you sure you want to delete tournament "${tournName}" and its fixtures?`)) {
      deleteTournament(tournId);
      setFeedback(`✓ Deleted ${tournName}`);
      setTimeout(() => setFeedback(null), 3000);
    }
  };

  // KPIs
  const totalTournaments = clubTournaments.length;
  const activeTournaments = clubTournaments.filter(t => t.status === 'ongoing').length;
  const totalMatchesInTourneys = matches.filter(m => !!m.tournament_id).length;

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', paddingBottom: '3rem' }}>
      {/* Page Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: 800,
                color: '#10B981',
                background: 'rgba(16, 185, 129, 0.12)',
                padding: '2px 8px',
                borderRadius: '6px',
                textTransform: 'uppercase',
              }}
            >
              Challonge Engine for Football
            </span>
            {activeSeason && (
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                Season {activeSeason.name}
              </span>
            )}
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 900, color: '#FFFFFF', margin: 0 }}>
            Tournaments & Cups
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', margin: '0.25rem 0 0 0' }}>
            Design knockout brackets, round-robin leagues, and group-stage cups with live auto-updating points tables.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            onClick={handleOpenWizard}
            className="btn btn-primary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontWeight: 800,
              padding: '0.75rem 1.25rem',
              borderRadius: '10px',
              boxShadow: '0 4px 15px rgba(16, 185, 129, 0.3)',
            }}
          >
            <Trophy size={18} />
            <span>Setup Tournament</span>
          </button>
        </div>
      </div>

      {feedback && (
        <div
          style={{
            background: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid rgba(16, 185, 129, 0.35)',
            color: '#10B981',
            padding: '0.85rem 1.25rem',
            borderRadius: '10px',
            marginBottom: '1.5rem',
            fontWeight: 700,
            fontSize: '0.88rem',
          }}
        >
          {feedback}
        </div>
      )}

      {/* KPI Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))',
          gap: '1rem',
          marginBottom: '1.75rem',
        }}
      >
        <div style={{ background: 'rgba(15, 23, 42, 0.75)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '12px', padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>Total Tournaments</span>
            <Trophy size={18} color="#F59E0B" />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#FFFFFF' }}>{totalTournaments}</div>
          <span style={{ fontSize: '0.75rem', color: '#10B981' }}>{activeTournaments} Currently Active</span>
        </div>

        <div style={{ background: 'rgba(15, 23, 42, 0.75)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '12px', padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>Internal Teams</span>
            <Shield size={18} color="#3B82F6" />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#FFFFFF' }}>{clubInternalTeams.length}</div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Ready for Tournament Draw</span>
        </div>

        <div style={{ background: 'rgba(15, 23, 42, 0.75)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '12px', padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>Tournament Matches</span>
            <Swords size={18} color="#10B981" />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#FFFFFF' }}>{totalMatchesInTourneys}</div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Tiesheet & Bracket Fixtures</span>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          marginBottom: '1.5rem',
        }}
      >
        <button
          onClick={() => setActiveTab('tournaments')}
          style={{
            padding: '0.75rem 1.25rem',
            background: 'transparent',
            border: 'none',
            borderBottom: activeTab === 'tournaments' ? '2px solid #10B981' : '2px solid transparent',
            color: activeTab === 'tournaments' ? '#10B981' : 'var(--text-secondary)',
            fontWeight: 800,
            fontSize: '0.9rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.45rem',
          }}
        >
          <Trophy size={16} />
          <span>Tournaments List ({clubTournaments.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('internal_teams')}
          style={{
            padding: '0.75rem 1.25rem',
            background: 'transparent',
            border: 'none',
            borderBottom: activeTab === 'internal_teams' ? '2px solid #10B981' : '2px solid transparent',
            color: activeTab === 'internal_teams' ? '#10B981' : 'var(--text-secondary)',
            fontWeight: 800,
            fontSize: '0.9rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.45rem',
          }}
        >
          <Users size={16} />
          <span>Internal Teams & Squads ({clubInternalTeams.length})</span>
        </button>
      </div>

      {/* Tab 1: Tournaments List */}
      {activeTab === 'tournaments' && (
        <div>
          {clubTournaments.length === 0 ? (
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '16px',
                padding: '3.5rem 1.5rem',
                textAlign: 'center',
                color: 'var(--text-secondary)',
              }}
            >
              <Trophy size={42} style={{ opacity: 0.3, margin: '0 auto 1rem auto' }} />
              <h3 style={{ margin: '0 0 0.5rem 0', color: '#FFFFFF', fontWeight: 800 }}>
                No Tournaments Scheduled Yet
              </h3>
              <p style={{ margin: '0 0 1.5rem 0', fontSize: '0.88rem' }}>
                Launch your first single elimination cup, league, or group stage championship with automated tiesheet generation.
              </p>
              <button
                onClick={handleOpenWizard}
                className="btn btn-primary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontWeight: 800 }}
              >
                <Plus size={16} />
                <span>Launch First Tournament</span>
              </button>
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 360px), 1fr))',
                gap: '1.25rem',
              }}
            >
              {clubTournaments.map(tourn => {
                const participants = tournamentParticipants.filter(p => p.tournament_id === tourn.id);
                const tourneyMatches = matches.filter(m => m.tournament_id === tourn.id);
                const completedMatches = tourneyMatches.filter(m => m.status === 'completed').length;

                const formatLabel =
                  tourn.format === 'knockout'
                    ? 'Single-Elimination Knockout'
                    : tourn.format === 'league'
                    ? 'Round-Robin League'
                    : 'Group Stage + Knockout';

                return (
                  <div
                    key={tourn.id}
                    style={{
                      background: 'linear-gradient(145deg, #111827 0%, #0F172A 100%)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '14px',
                      overflow: 'hidden',
                      display: 'flex',
                      flexDirection: 'column',
                    }}
                  >
                    {/* Banner Image or Graphic Header */}
                    <div
                      style={{
                        height: '110px',
                        background: `linear-gradient(rgba(15, 23, 42, 0.4), rgba(15, 23, 42, 0.95)), url(${tourn.banner_url || 'https://images.unsplash.com/photo-1522778119026-d647f0596c20?w=800&q=80'})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        padding: '1rem',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span
                          style={{
                            fontSize: '0.7rem',
                            fontWeight: 800,
                            padding: '2px 8px',
                            borderRadius: '6px',
                            background:
                              tourn.status === 'ongoing'
                                ? 'rgba(16, 185, 129, 0.25)'
                                : tourn.status === 'completed'
                                ? 'rgba(59, 130, 246, 0.25)'
                                : 'rgba(255, 255, 255, 0.15)',
                            color:
                              tourn.status === 'ongoing'
                                ? '#10B981'
                                : tourn.status === 'completed'
                                ? '#3B82F6'
                                : '#CBD5E1',
                            border:
                              tourn.status === 'ongoing'
                                ? '1px solid #10B981'
                                : '1px solid rgba(255,255,255,0.2)',
                            textTransform: 'uppercase',
                          }}
                        >
                          {tourn.status}
                        </span>

                        <div style={{ display: 'flex', gap: '0.35rem' }}>
                        <button
                          onClick={() => setFormTarget(tourn)}
                          style={{
                            background: 'rgba(0, 0, 0, 0.5)',
                            border: 'none',
                            color: '#FFFFFF',
                            padding: '0.35rem',
                            borderRadius: '6px',
                            cursor: 'pointer',
                          }}
                          title="Edit Tournament"
                          aria-label={`Edit ${tourn.name}`}
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => handleDeleteTourn(tourn.id, tourn.name)}
                          style={{
                            background: 'rgba(0, 0, 0, 0.5)',
                            border: 'none',
                            color: '#EF4444',
                            padding: '0.35rem',
                            borderRadius: '6px',
                            cursor: 'pointer',
                          }}
                          title="Delete Tournament"
                          aria-label={`Delete ${tourn.name}`}
                        >
                          <Trash2 size={14} />
                        </button>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Trophy size={16} color="#F59E0B" />
                        <h3
                          style={{
                            margin: 0,
                            fontSize: '1.05rem',
                            fontWeight: 900,
                            color: '#FFFFFF',
                            textShadow: '0 2px 4px rgba(0,0,0,0.8)',
                          }}
                        >
                          {tourn.name}
                        </h3>
                      </div>
                    </div>

                    {/* Details Body */}
                    <div style={{ padding: '1rem 1.25rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', color: '#10B981', fontWeight: 700 }}>
                        <Layers size={14} />
                        <span>{formatLabel}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        <Calendar size={13} />
                        <span>{parseTournamentDate(tourn.start_date)?.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) || 'Date TBC'}</span>
                      </div>

                      <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                        {tourn.description || 'Official club championship tournament.'}
                      </p>

                      <div
                        style={{
                          background: 'rgba(0, 0, 0, 0.3)',
                          borderRadius: '8px',
                          padding: '0.65rem 0.85rem',
                          display: 'grid',
                          gridTemplateColumns: 'repeat(3, 1fr)',
                          gap: '0.5rem',
                          textAlign: 'center',
                          fontSize: '0.75rem',
                        }}
                      >
                        <div>
                          <div style={{ color: 'var(--text-muted)' }}>Teams</div>
                          <div style={{ fontWeight: 800, color: '#FFFFFF', fontSize: '0.9rem' }}>
                            {participants.length}
                          </div>
                        </div>
                        <div>
                          <div style={{ color: 'var(--text-muted)' }}>Fixtures</div>
                          <div style={{ fontWeight: 800, color: '#FFFFFF', fontSize: '0.9rem' }}>
                            {tourneyMatches.length}
                          </div>
                        </div>
                        <div>
                          <div style={{ color: 'var(--text-muted)' }}>Completed</div>
                          <div style={{ fontWeight: 800, color: '#10B981', fontSize: '0.9rem' }}>
                            {completedMatches}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Actions Footer */}
                    <div
                      style={{
                        padding: '0.75rem 1.25rem',
                        background: 'rgba(0, 0, 0, 0.3)',
                        borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <Link
                        href={`/${club.slug}/tournaments/${tourn.id}`}
                        target="_blank"
                        style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textDecoration: 'none' }}
                      >
                        Public Spectator View ↗
                      </Link>

                      <Link
                        href={`/${club.slug}/admin/tournaments/${tourn.id}`}
                        className="btn btn-sm btn-primary"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          fontWeight: 700,
                          fontSize: '0.8rem',
                          padding: '0.45rem 0.85rem',
                          borderRadius: '8px',
                        }}
                      >
                        <span>Manage Bracket</span>
                        <ArrowRight size={13} />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Internal Teams Manager */}
      {activeTab === 'internal_teams' && (
        <InternalTeamsManager clubSlug={club.slug} />
      )}

      {formTarget && (
        <TournamentFormModal
          club={club}
          tournament={formTarget === 'new' ? undefined : formTarget}
          onClose={() => setFormTarget(null)}
          onSaved={msg => {
            setFormTarget(null);
            setFeedback(msg);
            setTimeout(() => setFeedback(null), 4000);
          }}
        />
      )}
    </div>
  );
}
