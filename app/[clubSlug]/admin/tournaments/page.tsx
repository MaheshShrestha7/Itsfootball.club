'use client';

import React, { useState, use } from 'react';
import Link from 'next/link';
import { useClub } from '@/lib/club-context';
import { Tournament, TournamentFormat, TournamentParticipant } from '@/lib/supabase/types';
import InternalTeamsManager from '@/components/tournament/InternalTeamsManager';
import {
  Trophy,
  Swords,
  Users,
  Plus,
  Calendar,
  Layers,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  X,
  Trash2,
  Settings,
  Sparkles,
  Shuffle,
  Shield
} from 'lucide-react';

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
    createTournament,
    deleteTournament,
    generateTournamentTiesheet,
    matches,
    seasons,
    getActiveSeason,
  } = useClub();

  const club = selectClubBySlug(resolvedParams.clubSlug) || clubs[0];
  const activeSeason = getActiveSeason(club.id);

  const clubTournaments = tournaments.filter(t => t.club_id === club.id);
  const clubInternalTeams = internalTeams.filter(t => t.club_id === club.id);

  const [activeTab, setActiveTab] = useState<'tournaments' | 'internal_teams'>('tournaments');
  const [wizardOpen, setWizardOpen] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Wizard Form State
  const [name, setName] = useState('');
  const [season, setSeason] = useState(activeSeason?.name || '2026/27');
  const [format, setFormat] = useState<TournamentFormat>('group_knockout');
  const [venue, setVenue] = useState(club.stadium_name || 'Apex Park Stadium Arena');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(
    new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)
  );
  const [description, setDescription] = useState('');
  const [pointsWin, setPointsWin] = useState(3);
  const [groupCount, setGroupCount] = useState(2);
  const [teamsAdvancing, setTeamsAdvancing] = useState(2);
  const [hasThirdPlace, setHasThirdPlace] = useState(true);

  // Participant selection: which internal teams are included
  const [selectedInternalTeamIds, setSelectedInternalTeamIds] = useState<string[]>([]);
  // External guest teams
  const [externalTeams, setExternalTeams] = useState<{ name: string; short_name: string }[]>([
    { name: 'St. Jude United', short_name: 'STJ' },
    { name: 'Metro Rovers', short_name: 'ROV' },
  ]);
  const [newExternalName, setNewExternalName] = useState('');
  const [newExternalCode, setNewExternalCode] = useState('');

  const handleOpenWizard = () => {
    setName('');
    setSeason(activeSeason?.name || '2026/27');
    setFormat('group_knockout');
    setVenue(club.stadium_name || 'Home Stadium Arena');
    setStartDate(new Date().toISOString().slice(0, 10));
    setEndDate(new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10));
    setDescription('Championship cup featuring internal club teams and regional guest clubs.');
    setPointsWin(3);
    setGroupCount(2);
    setTeamsAdvancing(2);
    setHasThirdPlace(true);
    setSelectedInternalTeamIds(clubInternalTeams.map(t => t.id));
    setWizardOpen(true);
  };

  const handleAddExternalTeam = () => {
    if (!newExternalName.trim()) return;
    setExternalTeams(prev => [
      ...prev,
      {
        name: newExternalName.trim(),
        short_name: newExternalCode.trim() || newExternalName.slice(0, 3).toUpperCase(),
      },
    ]);
    setNewExternalName('');
    setNewExternalCode('');
  };

  const handleRemoveExternalTeam = (idx: number) => {
    setExternalTeams(prev => prev.filter((_, i) => i !== idx));
  };

  const handleCreateTournamentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    // Build participant list
    const participantInputs: Omit<TournamentParticipant, 'id' | 'tournament_id'>[] = [];

    // 1. Add selected internal teams
    selectedInternalTeamIds.forEach((tId, idx) => {
      const team = clubInternalTeams.find(t => t.id === tId);
      if (team) {
        participantInputs.push({
          team_type: 'internal',
          internal_team_id: team.id,
          name: team.name,
          short_name: team.short_name,
          logo_url: team.logo_url || '/crests/apex-city.svg',
          color: team.color || '#10B981',
          seed: idx + 1,
        });
      }
    });

    // 2. Add external teams
    externalTeams.forEach((ext, idx) => {
      participantInputs.push({
        team_type: 'external',
        name: ext.name,
        short_name: ext.short_name,
        logo_url: '/crests/red-lions.svg',
        color: '#2563EB',
        seed: selectedInternalTeamIds.length + idx + 1,
      });
    });

    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    const newTourn = createTournament(
      {
        club_id: club.id,
        name: name.trim(),
        slug: `${slug}-${Date.now().toString().slice(-4)}`,
        season,
        format,
        status: 'draft',
        points_win: Number(pointsWin),
        points_draw: 1,
        points_loss: 0,
        group_count: format === 'group_knockout' ? Number(groupCount) : undefined,
        teams_advancing_per_group: format === 'group_knockout' ? Number(teamsAdvancing) : undefined,
        has_third_place_match: hasThirdPlace,
        start_date: startDate,
        end_date: endDate,
        venue,
        description,
        banner_url: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=1600&auto=format&fit=crop&q=80',
      },
      participantInputs
    );

    // Auto-generate tiesheet if participants >= 2
    if (participantInputs.length >= 2) {
      generateTournamentTiesheet(newTourn.id);
    }

    setFeedback(`✓ Created tournament "${newTourn.name}" with tiesheet & ${participantInputs.length} teams!`);
    setWizardOpen(false);
    setTimeout(() => setFeedback(null), 4000);
  };

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
                        background: `linear-gradient(rgba(15, 23, 42, 0.4), rgba(15, 23, 42, 0.95)), url(${tourn.banner_url || 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=800&q=80'})`,
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
                        >
                          <Trash2 size={14} />
                        </button>
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

      {/* Setup Tournament Wizard Modal */}
      {wizardOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(5, 10, 20, 0.88)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem',
          }}
          onClick={() => setWizardOpen(false)}
        >
          <div
            style={{
              background: 'linear-gradient(135deg, #111827 0%, #0F172A 100%)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '680px',
              maxHeight: '92vh',
              overflowY: 'auto',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.9), 0 0 30px rgba(16, 185, 129, 0.15)',
              color: '#FFFFFF',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '1.25rem 1.5rem',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Trophy size={20} color="#10B981" />
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>
                  Tournament Setup Wizard
                </h3>
              </div>
              <button
                onClick={() => setWizardOpen(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCreateTournamentSubmit} style={{ padding: '1.5rem' }}>
              {/* Basic Info */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.4rem' }}>
                    Tournament Title *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Apex Summer Intra-Club Cup"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.85rem',
                      background: 'rgba(0, 0, 0, 0.4)',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      borderRadius: '8px',
                      color: '#FFFFFF',
                      fontSize: '0.88rem',
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.4rem' }}>
                    Season
                  </label>
                  <input
                    type="text"
                    value={season}
                    onChange={e => setSeason(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.85rem',
                      background: 'rgba(0, 0, 0, 0.4)',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      borderRadius: '8px',
                      color: '#FFFFFF',
                      fontSize: '0.88rem',
                    }}
                  />
                </div>
              </div>

              {/* Tournament Format Selector */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                  Tournament Format (Soccer Specific)
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.65rem' }}>
                  {[
                    {
                      id: 'knockout',
                      label: 'Knockout Bracket',
                      desc: 'Single elimination with optional 3rd place',
                    },
                    {
                      id: 'group_knockout',
                      label: 'Group Stage + KO',
                      desc: 'World Cup / UCL: Round-robin groups into knockout',
                    },
                    {
                      id: 'league',
                      label: 'Round-Robin League',
                      desc: 'All-play-all points table & standings',
                    },
                  ].map(f => (
                    <div
                      key={f.id}
                      onClick={() => setFormat(f.id as TournamentFormat)}
                      style={{
                        padding: '0.85rem',
                        borderRadius: '10px',
                        border: format === f.id ? '2px solid #10B981' : '1px solid rgba(255, 255, 255, 0.08)',
                        background: format === f.id ? 'rgba(16, 185, 129, 0.12)' : 'rgba(0, 0, 0, 0.35)',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ fontWeight: 800, fontSize: '0.85rem', color: format === f.id ? '#10B981' : '#FFFFFF' }}>
                        {f.label}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '3px' }}>
                        {f.desc}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Format-Specific Rules */}
              {format === 'group_knockout' && (
                <div
                  style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '10px',
                    padding: '1rem',
                    marginBottom: '1.25rem',
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr 1fr',
                    gap: '1rem',
                  }}
                >
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Group Count</label>
                    <select
                      value={groupCount}
                      onChange={e => setGroupCount(parseInt(e.target.value, 10))}
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        background: '#1F2937',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        borderRadius: '6px',
                        color: '#FFFFFF',
                        marginTop: '3px',
                      }}
                    >
                      <option value={2}>2 Groups (A & B)</option>
                      <option value={4}>4 Groups (A, B, C, D)</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Teams Advance / Group</label>
                    <select
                      value={teamsAdvancing}
                      onChange={e => setTeamsAdvancing(parseInt(e.target.value, 10))}
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        background: '#1F2937',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        borderRadius: '6px',
                        color: '#FFFFFF',
                        marginTop: '3px',
                      }}
                    >
                      <option value={1}>Top 1 (Group Winners only)</option>
                      <option value={2}>Top 2 (Winners & Runners-up)</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', marginTop: '1rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.78rem' }}>
                      <input
                        type="checkbox"
                        checked={hasThirdPlace}
                        onChange={e => setHasThirdPlace(e.target.checked)}
                      />
                      Include 3rd Place Match
                    </label>
                  </div>
                </div>
              )}

              {/* Internal Teams Selection */}
              <div style={{ marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700 }}>
                    Include Internal Teams ({selectedInternalTeamIds.length} Selected)
                  </label>
                  <span style={{ fontSize: '0.72rem', color: '#10B981' }}>
                    From Your Club Squads
                  </span>
                </div>

                {clubInternalTeams.length === 0 ? (
                  <div style={{ padding: '0.75rem', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '8px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    No internal teams created yet. Switch to the &quot;Internal Teams&quot; tab to set up squads first.
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.5rem' }}>
                    {clubInternalTeams.map(t => {
                      const isSelected = selectedInternalTeamIds.includes(t.id);
                      return (
                        <div
                          key={t.id}
                          onClick={() =>
                            setSelectedInternalTeamIds(prev =>
                              prev.includes(t.id) ? prev.filter(id => id !== t.id) : [...prev, t.id]
                            )
                          }
                          style={{
                            padding: '0.5rem 0.75rem',
                            borderRadius: '8px',
                            background: isSelected ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                            border: isSelected ? '1px solid #10B981' : '1px solid rgba(255, 255, 255, 0.08)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                          }}
                        >
                          <input type="checkbox" checked={isSelected} onChange={() => {}} />
                          <img src={t.logo_url || '/crests/apex-city.svg'} alt="" style={{ width: '20px', height: '20px' }} />
                          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#FFFFFF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {t.name}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Guest / External Teams */}
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.4rem' }}>
                  External Guest Teams ({externalTeams.length})
                </label>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <input
                    type="text"
                    placeholder="Guest Club Name (e.g. Titan Athletic FC)"
                    value={newExternalName}
                    onChange={e => setNewExternalName(e.target.value)}
                    style={{
                      flex: 2,
                      padding: '0.5rem 0.75rem',
                      background: 'rgba(0, 0, 0, 0.4)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '6px',
                      color: '#FFFFFF',
                      fontSize: '0.82rem',
                    }}
                  />
                  <input
                    type="text"
                    maxLength={4}
                    placeholder="Code"
                    value={newExternalCode}
                    onChange={e => setNewExternalCode(e.target.value.toUpperCase())}
                    style={{
                      width: '70px',
                      padding: '0.5rem',
                      textAlign: 'center',
                      background: 'rgba(0, 0, 0, 0.4)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '6px',
                      color: '#FFFFFF',
                      fontSize: '0.82rem',
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleAddExternalTeam}
                    className="btn btn-secondary"
                    style={{ padding: '0.5rem 0.85rem', fontSize: '0.8rem' }}
                  >
                    Add
                  </button>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                  {externalTeams.map((ext, idx) => (
                    <span
                      key={idx}
                      style={{
                        padding: '3px 8px',
                        background: 'rgba(59, 130, 246, 0.12)',
                        border: '1px solid rgba(59, 130, 246, 0.3)',
                        borderRadius: '12px',
                        color: '#93C5FD',
                        fontSize: '0.75rem',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                      }}
                    >
                      {ext.name} ({ext.short_name})
                      <button
                        type="button"
                        onClick={() => handleRemoveExternalTeam(idx)}
                        style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', padding: 0 }}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              {/* Submit Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setWizardOpen(false)}
                  className="btn btn-secondary"
                  style={{ padding: '0.65rem 1.25rem' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ padding: '0.65rem 1.5rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                >
                  <Sparkles size={16} />
                  <span>Generate Tiesheet & Launch</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
