'use client';

import React, { useState, use, useEffect } from 'react';
import Link from 'next/link';
import { useClub } from '@/lib/club-context';
import { Match } from '@/lib/supabase/types';
import TournamentBracketView from '@/components/tournament/TournamentBracketView';
import TournamentStandingsTable from '@/components/tournament/TournamentStandingsTable';
import TournamentMatchesList from '@/components/tournament/TournamentMatchesList';
import TournamentScoreModal from '@/components/tournament/TournamentScoreModal';
import TournamentFormModal from '@/components/tournament/TournamentFormModal';
import { Trophy, ArrowLeft, Calendar, Layers, Shuffle, RefreshCw, Plus, Users, ExternalLink, Clock, Sparkles, Pencil } from 'lucide-react';
import { DEFAULT_CREST } from '@/lib/crest';
import { GROUP_LETTERS, parseTournamentDate } from '@/lib/tournament-engine';

export default function AdminTournamentDetailPage({
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
    updateMatch,
    generateTournamentTiesheet,
    updateTournamentMatchScore,
    progressKnockoutStage,
    getTournamentStandings,
    addTournamentParticipant,
    repairTournaments,
  } = useClub();

  const club = selectClubBySlug(resolvedParams.clubSlug) || clubs[0];
  const tournament = tournaments.find(t => t.id === resolvedParams.tournamentId);

  const [activeTab, setActiveTab] = useState<'bracket' | 'standings' | 'fixtures' | 'teams'>('bracket');
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [feedbackTone, setFeedbackTone] = useState<'success' | 'error'>('success');
  const [addTeamModalOpen, setAddTeamModalOpen] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamCode, setNewTeamCode] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  useEffect(() => repairTournaments(club.id), [repairTournaments, club.id]);

  if (!tournament) {
    return (
      <div style={{ padding: '4rem', textAlign: 'center', color: '#FFFFFF' }}>
        <h2>Tournament not found.</h2>
        <p style={{ color: 'var(--text-secondary)' }}>The requested tournament does not exist or has been deleted.</p>
        <Link href={`/${club.slug}/admin/tournaments`} className="btn btn-primary" style={{ marginTop: '1rem', display: 'inline-block' }}>
          Back to Tournaments
        </Link>
      </div>
    );
  }

  const participants = tournamentParticipants.filter(p => p.tournament_id === tournament.id);
  const tourneyMatches = matches.filter(m => m.tournament_id === tournament.id);

  const handleGenerateTiesheet = (shuffle = false) => {
    if (participants.length < 2) {
      setFeedbackTone('error');
      setFeedback('⚠ Add at least 2 teams before generating a tiesheet.');
      setTimeout(() => setFeedback(null), 3500);
      return;
    }
    if (tourneyMatches.length > 0) {
      if (!confirm('Regenerating the tiesheet will reset current tournament fixtures and scores. Proceed?')) {
        return;
      }
    }
    const generated = generateTournamentTiesheet(tournament.id, { shuffle });
    setFeedbackTone('success');
    setFeedback(`✓ Tiesheet generated! Created ${generated.length} tournament fixtures.`);
    setTimeout(() => setFeedback(null), 3500);
  };

  const handleProgressStage = () => {
    progressKnockoutStage(tournament.id);
    setFeedbackTone('success');
    setFeedback('✓ Evaluated completed matches and advanced winners in knockout bracket!');
    setTimeout(() => setFeedback(null), 3500);
  };

  const handleAddGuestTeam = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamName.trim()) return;
    if (participants.some(p => p.name.toLowerCase() === newTeamName.trim().toLowerCase())) {
      setFeedbackTone('error');
      setFeedback(`⚠ "${newTeamName.trim()}" is already in this tournament. Team names must be unique.`);
      setTimeout(() => setFeedback(null), 3500);
      return;
    }

    addTournamentParticipant({
      tournament_id: tournament.id,
      team_type: 'external',
      name: newTeamName.trim(),
      short_name: newTeamCode.trim() || newTeamName.slice(0, 3).toUpperCase(),
      logo_url: DEFAULT_CREST,
      color: '#3B82F6',
      seed: participants.length + 1,
    });

    setNewTeamName('');
    setNewTeamCode('');
    setAddTeamModalOpen(false);
    setFeedbackTone('success');
    setFeedback(`✓ Added guest team "${newTeamName.trim()}"! Remember to regenerate tiesheet to include them.`);
    setTimeout(() => setFeedback(null), 4000);
  };

  const formatLabel =
    tournament.format === 'knockout'
      ? 'Single-Elimination Knockout'
      : tournament.format === 'league'
      ? 'Round-Robin League'
      : 'Group Stage + Knockout';

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', paddingBottom: '3rem' }}>
      {/* Top Breadcrumb & Actions */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '1rem',
          flexWrap: 'wrap',
          gap: '0.75rem',
        }}
      >
        <Link
          href={`/${club.slug}/admin/tournaments`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            color: 'var(--text-secondary)',
            fontSize: '0.85rem',
            textDecoration: 'none',
          }}
        >
          <ArrowLeft size={16} />
          <span>Back to Tournaments</span>
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <Link
            href={`/${club.slug}/tournaments/${tournament.id}`}
            target="_blank"
            className="btn btn-sm btn-secondary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              fontSize: '0.8rem',
              borderRadius: '8px',
            }}
          >
            <span>Spectator Hub</span>
            <ExternalLink size={13} />
          </Link>

          <button
            onClick={() => setEditOpen(true)}
            className="btn btn-sm btn-secondary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              fontSize: '0.8rem',
              borderRadius: '8px',
            }}
            title="Edit name, dates, venue, cover, format and teams"
          >
            <Pencil size={14} />
            <span>Edit Tournament</span>
          </button>

          <button
            onClick={handleProgressStage}
            className="btn btn-sm btn-secondary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              fontSize: '0.8rem',
              borderRadius: '8px',
            }}
            title="Advance knockout round winners"
          >
            <Sparkles size={14} color="#10B981" />
            <span>Progress Bracket</span>
          </button>

          <button
            onClick={() => handleGenerateTiesheet(true)}
            className="btn btn-sm btn-secondary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              fontSize: '0.8rem',
              borderRadius: '8px',
            }}
            title="Randomize draw and regenerate fixtures"
          >
            <Shuffle size={14} />
            <span>Shuffle Draw</span>
          </button>

          <button
            onClick={() => handleGenerateTiesheet(false)}
            className="btn btn-sm btn-primary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              fontSize: '0.8rem',
              fontWeight: 800,
              borderRadius: '8px',
            }}
          >
            <RefreshCw size={14} />
            <span>Generate Tiesheet</span>
          </button>
        </div>
      </div>

      {feedback && (
        <div
          style={{
            background: feedbackTone === 'error' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
            border: feedbackTone === 'error' ? '1px solid rgba(239, 68, 68, 0.35)' : '1px solid rgba(16, 185, 129, 0.35)',
            color: feedbackTone === 'error' ? '#EF4444' : '#10B981',
            padding: '0.85rem 1.25rem',
            borderRadius: '10px',
            marginBottom: '1.25rem',
            fontWeight: 700,
            fontSize: '0.88rem',
          }}
        >
          {feedback}
        </div>
      )}

      {/* Tournament Header Banner */}
      <div
        style={{
          position: 'relative',
          overflow: 'hidden',
          background: tournament.banner_url
            ? `linear-gradient(135deg, rgba(17, 24, 39, 0.88) 0%, rgba(15, 23, 42, 0.94) 100%), url(${tournament.banner_url}) center/cover no-repeat`
            : 'linear-gradient(135deg, rgba(17, 24, 39, 0.95) 0%, rgba(15, 23, 42, 0.95) 100%)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '16px',
          padding: '1.5rem',
          marginBottom: '1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1.25rem',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <div
            style={{
              width: '60px',
              height: '60px',
              borderRadius: '14px',
              background: 'rgba(245, 158, 11, 0.15)',
              border: '2px solid rgba(245, 158, 11, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#F59E0B',
              boxShadow: '0 0 20px rgba(245, 158, 11, 0.2)',
            }}
          >
            <Trophy size={30} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.25rem' }}>
              <h1 style={{ fontSize: '1.6rem', fontWeight: 900, color: '#FFFFFF', margin: 0 }}>
                {tournament.name}
              </h1>
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: '6px',
                  background: 'rgba(16, 185, 129, 0.15)',
                  color: '#10B981',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  textTransform: 'uppercase',
                }}
              >
                {tournament.status}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', color: 'var(--text-secondary)', fontSize: '0.82rem', flexWrap: 'wrap' }}>
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
                <Clock size={14} />
                <span>{parseTournamentDate(tournament.start_date)?.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) || 'Date TBC'}</span>
              </span>
              <span>•</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <Users size={14} />
                <span>{participants.length} Teams Enrolled</span>
              </span>
            </div>
          </div>
        </div>

        {/* Quick Stats Block */}
        <div style={{ display: 'flex', gap: '1rem', background: 'rgba(0, 0, 0, 0.3)', padding: '0.75rem 1.25rem', borderRadius: '12px' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#FFFFFF' }}>{tourneyMatches.length}</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Fixtures</div>
          </div>
          <div style={{ width: '1px', background: 'rgba(255, 255, 255, 0.1)' }} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#10B981' }}>
              {tourneyMatches.filter(m => m.status === 'completed').length}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Completed</div>
          </div>
          <div style={{ width: '1px', background: 'rgba(255, 255, 255, 0.1)' }} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#EF4444' }}>
              {tourneyMatches.filter(m => m.status === 'live').length}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Live Now</div>
          </div>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          marginBottom: '1.5rem',
          overflowX: 'auto',
        }}
      >
        {tournament.format !== 'league' && (
          <button
            onClick={() => setActiveTab('bracket')}
            style={{
              padding: '0.75rem 1.25rem',
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'bracket' ? '2px solid #10B981' : '2px solid transparent',
              color: activeTab === 'bracket' ? '#10B981' : 'var(--text-secondary)',
              fontWeight: 800,
              fontSize: '0.88rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              whiteSpace: 'nowrap',
            }}
          >
            <Trophy size={16} />
            <span>Knockout Bracket (Tiesheet)</span>
          </button>
        )}

        {tournament.format !== 'knockout' && (
          <button
            onClick={() => setActiveTab('standings')}
            style={{
              padding: '0.75rem 1.25rem',
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'standings' ? '2px solid #10B981' : '2px solid transparent',
              color: activeTab === 'standings' ? '#10B981' : 'var(--text-secondary)',
              fontWeight: 800,
              fontSize: '0.88rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              whiteSpace: 'nowrap',
            }}
          >
            <Layers size={16} />
            <span>Points Table / Standings</span>
          </button>
        )}

        <button
          onClick={() => setActiveTab('fixtures')}
          style={{
            padding: '0.75rem 1.25rem',
            background: 'transparent',
            border: 'none',
            borderBottom: activeTab === 'fixtures' ? '2px solid #10B981' : '2px solid transparent',
            color: activeTab === 'fixtures' ? '#10B981' : 'var(--text-secondary)',
            fontWeight: 800,
            fontSize: '0.88rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            whiteSpace: 'nowrap',
          }}
        >
          <Calendar size={16} />
          <span>Fixtures & Results ({tourneyMatches.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('teams')}
          style={{
            padding: '0.75rem 1.25rem',
            background: 'transparent',
            border: 'none',
            borderBottom: activeTab === 'teams' ? '2px solid #10B981' : '2px solid transparent',
            color: activeTab === 'teams' ? '#10B981' : 'var(--text-secondary)',
            fontWeight: 800,
            fontSize: '0.88rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            whiteSpace: 'nowrap',
          }}
        >
          <Users size={16} />
          <span>Enrolled Teams ({participants.length})</span>
        </button>
      </div>

      {/* Tab 1: Bracket / Tiesheet */}
      {activeTab === 'bracket' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Click any match card below to enter full-time score, penalties, or open in Match Center.
            </span>
          </div>
          <TournamentBracketView
            matches={tourneyMatches}
            onSelectMatch={m => setSelectedMatch(m)}
            isAdmin={true}
          />
        </div>
      )}

      {/* Tab 2: Standings / Points Table */}
      {activeTab === 'standings' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {tournament.format === 'group_knockout' ? (
            // Render each group
            GROUP_LETTERS.slice(0, tournament.group_count ?? 1).map(groupLetter => {
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
            // League standings
            <TournamentStandingsTable
              standings={getTournamentStandings(tournament.id)}
              groupTitle={`${tournament.name} Standings`}
              advancingCount={0}
            />
          )}
        </div>
      )}

      {/* Tab 3: Fixtures & Results List */}
      {activeTab === 'fixtures' && (
        <TournamentMatchesList
          matches={tourneyMatches}
          clubSlug={club.slug}
          onSelectMatch={m => setSelectedMatch(m)}
          isAdmin={true}
        />
      )}

      {/* Tab 4: Teams & Roster */}
      {activeTab === 'teams' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Teams currently registered in this tournament. Internal club teams link to club members.
            </span>
            <button
              onClick={() => setAddTeamModalOpen(true)}
              className="btn btn-sm btn-primary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontWeight: 700 }}
            >
              <Plus size={14} />
              <span>Add Guest Team</span>
            </button>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 260px), 1fr))',
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
                  padding: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                }}
              >
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '10px',
                    background: 'rgba(0, 0, 0, 0.35)',
                    border: `2px solid ${part.color || '#10B981'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    padding: '3px',
                  }}
                >
                  <img loading="lazy" decoding="async"
                    src={part.logo_url || DEFAULT_CREST}
                    alt=""
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  />
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 800, color: '#FFFFFF', fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {part.name}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '3px' }}>
                    <span
                      style={{
                        fontSize: '0.65rem',
                        fontWeight: 800,
                        padding: '1px 5px',
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
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                        Seed #{part.seed}
                      </span>
                    )}
                    {part.group && (
                      <span style={{ fontSize: '0.68rem', color: '#F59E0B', fontWeight: 700 }}>
                        Group {part.group}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Score Modal */}
      {selectedMatch && (
        <TournamentScoreModal
          match={selectedMatch}
          clubSlug={club.slug}
          isOpen={!!selectedMatch}
          onClose={() => setSelectedMatch(null)}
          onSaveSchedule={(matchId, schedule) => updateMatch(matchId, schedule)}
          onSaveScore={(matchId, homeScore, awayScore, homePens, awayPens, status) => {
            updateTournamentMatchScore(matchId, homeScore, awayScore, homePens, awayPens, status);
            setFeedbackTone('success');
            setFeedback('✓ Match score updated and points table / knockout progression recomputed!');
            setTimeout(() => setFeedback(null), 3500);
          }}
        />
      )}

      {/* Add Guest Team Modal */}
      {addTeamModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(5, 10, 20, 0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem',
          }}
          onClick={() => setAddTeamModalOpen(false)}
        >
          <div
            style={{
              background: '#111827',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '14px',
              width: '100%',
              maxWidth: '420px',
              padding: '1.5rem',
              color: '#FFFFFF',
            }}
            onClick={e => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 1rem 0', fontWeight: 800 }}>Add Guest Team</h3>
            <form onSubmit={handleAddGuestTeam}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.4rem' }}>
                  Team Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Northern United"
                  value={newTeamName}
                  onChange={e => setNewTeamName(e.target.value)}
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

              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.4rem' }}>
                  Short Code
                </label>
                <input
                  type="text"
                  maxLength={4}
                  placeholder="e.g. NUFC"
                  value={newTeamCode}
                  onChange={e => setNewTeamCode(e.target.value.toUpperCase())}
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

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setAddTeamModalOpen(false)}
                  className="btn btn-secondary"
                  style={{ padding: '0.5rem 1rem' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ padding: '0.5rem 1.25rem', fontWeight: 800 }}
                >
                  Enroll Team
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editOpen && (
        <TournamentFormModal
          club={club}
          tournament={tournament}
          onClose={() => setEditOpen(false)}
          onSaved={msg => {
            setEditOpen(false);
            setFeedbackTone('success');
            setFeedback(msg);
            setTimeout(() => setFeedback(null), 4000);
          }}
        />
      )}
    </div>
  );
}
