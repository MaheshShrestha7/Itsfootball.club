'use client';

import React, { useState, use } from 'react';
import Link from 'next/link';
import { useClub } from '@/lib/club-context';
import { Match, TournamentParticipant } from '@/lib/supabase/types';
import TournamentBracketView from '@/components/tournament/TournamentBracketView';
import TournamentStandingsTable from '@/components/tournament/TournamentStandingsTable';
import TournamentMatchesList from '@/components/tournament/TournamentMatchesList';
import TournamentScoreModal from '@/components/tournament/TournamentScoreModal';
import {
  Trophy,
  ArrowLeft,
  Calendar,
  Layers,
  Shuffle,
  RefreshCw,
  Plus,
  Users,
  CheckCircle2,
  ExternalLink,
  Shield,
  Clock,
  Sparkles,
  Settings,
  X,
  Image as ImageIcon
} from 'lucide-react';
import ImageUploadZone from '@/components/ImageUploadZone';
import { DEFAULT_CREST } from '@/lib/crest';

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
    updateTournament,
    generateTournamentTiesheet,
    updateTournamentMatchScore,
    progressKnockoutStage,
    getTournamentStandings,
    addTournamentParticipant,
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
  const [editFormatModalOpen, setEditFormatModalOpen] = useState(false);
  const [editGroupCount, setEditGroupCount] = useState(tournament?.group_count ?? 1);
  const [editTeamsAdvancing, setEditTeamsAdvancing] = useState(tournament?.teams_advancing_per_group ?? 2);
  const [editThirdPlace, setEditThirdPlace] = useState(tournament?.has_third_place_match ?? false);
  const [editBannerModalOpen, setEditBannerModalOpen] = useState(false);
  const [editBannerUrl, setEditBannerUrl] = useState(tournament?.banner_url ?? '');

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

  const handleSaveFormat = (e: React.FormEvent) => {
    e.preventDefault();
    updateTournament(tournament.id, {
      group_count: editGroupCount,
      teams_advancing_per_group: editTeamsAdvancing,
      has_third_place_match: editThirdPlace,
    });
    // Regenerate tiesheet with new structure
    generateTournamentTiesheet(tournament.id);
    setEditFormatModalOpen(false);
    setFeedbackTone('success');
    setFeedback(`✓ Updated structure: ${editGroupCount === 1 ? '1 Group' : `${editGroupCount} Groups`} with ${editTeamsAdvancing} advancing teams per group!`);
    setTimeout(() => setFeedback(null), 4000);
  };

  const handleSaveBanner = (e: React.FormEvent) => {
    e.preventDefault();
    updateTournament(tournament.id, {
      banner_url: editBannerUrl.trim(),
    });
    setEditBannerModalOpen(false);
    setFeedbackTone('success');
    setFeedback('✓ Updated tournament cover photo!');
    setTimeout(() => setFeedback(null), 3500);
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
            onClick={() => {
              setEditBannerUrl(tournament.banner_url || '');
              setEditBannerModalOpen(true);
            }}
            className="btn btn-sm btn-secondary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              fontSize: '0.8rem',
              borderRadius: '8px',
            }}
            title="Update tournament cover photo"
          >
            <ImageIcon size={14} />
            <span>Cover Photo</span>
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

          {tournament.format === 'group_knockout' && (
            <button
              onClick={() => {
                setEditGroupCount(tournament.group_count ?? 1);
                setEditTeamsAdvancing(tournament.teams_advancing_per_group ?? 2);
                setEditThirdPlace(tournament.has_third_place_match ?? false);
                setEditFormatModalOpen(true);
              }}
              className="btn btn-sm btn-secondary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                fontSize: '0.8rem',
                borderRadius: '8px',
              }}
              title="Configure group count and advancing rules"
            >
              <Settings size={14} />
              <span>Format Rules</span>
            </button>
          )}

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
          onSaveScore={(matchId, homeScore, awayScore, homePens, awayPens, isCompleted) => {
            updateTournamentMatchScore(matchId, homeScore, awayScore, homePens, awayPens, isCompleted);
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

      {/* Modal: Edit Group Stage & Knockout Rules */}
      {editFormatModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
          }}
          onClick={() => setEditFormatModalOpen(false)}
        >
          <div
            style={{
              background: '#111827',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '14px',
              width: '100%',
              maxWidth: '480px',
              padding: '1.75rem',
              color: '#FFFFFF',
              boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0, fontWeight: 800, fontSize: '1.15rem' }}>Group Stage & Knockout Rules</h3>
              <button
                type="button"
                onClick={() => setEditFormatModalOpen(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveFormat}>
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.4rem', color: 'var(--text-secondary)' }}>
                  Number of Groups
                </label>
                <select
                  value={editGroupCount}
                  onChange={e => {
                    const newCount = parseInt(e.target.value, 10);
                    setEditGroupCount(newCount);
                    if (newCount === 1 && editTeamsAdvancing < 2) {
                      setEditTeamsAdvancing(2);
                    }
                  }}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    background: 'rgba(0, 0, 0, 0.4)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: '8px',
                    color: '#FFFFFF',
                    fontSize: '0.88rem',
                  }}
                >
                  <option value={1}>1 Group (Single Pool • Group A)</option>
                  <option value={2}>2 Groups (Group A & B)</option>
                  <option value={3}>3 Groups (Group A, B, C)</option>
                  <option value={4}>4 Groups (Group A, B, C, D)</option>
                  <option value={8}>8 Groups (Group A - H)</option>
                </select>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
                  {editGroupCount === 1 ? 'All enrolled squads compete in one pool (Group A)' : `Squads are divided into ${editGroupCount} round-robin pools`}
                </span>
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.4rem', color: 'var(--text-secondary)' }}>
                  {editGroupCount === 1 ? 'Teams Advancing to Knockout' : 'Teams Advancing Per Group'}
                </label>
                <select
                  value={editTeamsAdvancing}
                  onChange={e => setEditTeamsAdvancing(parseInt(e.target.value, 10))}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    background: 'rgba(0, 0, 0, 0.4)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: '8px',
                    color: '#FFFFFF',
                    fontSize: '0.88rem',
                  }}
                >
                  {editGroupCount === 1 ? (
                    <>
                      <option value={2}>Min 2 Teams (Direct to Grand Final)</option>
                      <option value={4}>4 Teams (Semi-Finals & Final)</option>
                      <option value={8}>8 Teams (Quarter-Finals & Final)</option>
                      <option value={16}>Max 16 Teams (Round of 16 & Final)</option>
                    </>
                  ) : editGroupCount === 2 ? (
                    <>
                      <option value={1}>Top 1 per Group (2 Teams Total • Grand Final)</option>
                      <option value={2}>Top 2 per Group (4 Teams Total • Semi-Finals)</option>
                      <option value={4}>Top 4 per Group (8 Teams Total • Quarter-Finals)</option>
                      <option value={8}>Top 8 per Group (16 Teams Total • Round of 16)</option>
                    </>
                  ) : editGroupCount === 4 ? (
                    <>
                      <option value={1}>Top 1 per Group (4 Teams Total • Semi-Finals)</option>
                      <option value={2}>Top 2 per Group (8 Teams Total • Quarter-Finals)</option>
                      <option value={4}>Top 4 per Group (16 Teams Total • Round of 16)</option>
                    </>
                  ) : (
                    <>
                      <option value={1}>Top 1 per Group</option>
                      <option value={2}>Top 2 per Group</option>
                      <option value={4}>Top 4 per Group</option>
                    </>
                  )}
                </select>
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.82rem' }}>
                  <input
                    type="checkbox"
                    checked={editThirdPlace}
                    onChange={e => setEditThirdPlace(e.target.checked)}
                  />
                  <span>Include 3rd Place Playoff Match</span>
                </label>
              </div>

              <div
                style={{
                  fontSize: '0.75rem',
                  color: '#10B981',
                  background: 'rgba(16, 185, 129, 0.08)',
                  padding: '0.65rem 0.85rem',
                  borderRadius: '8px',
                  border: '1px solid rgba(16, 185, 129, 0.2)',
                  marginBottom: '1.5rem',
                }}
              >
                Knockout Pathway: {editGroupCount === 1 ? 'Single Group A' : `${editGroupCount} Groups`} &rarr;{' '}
                {editGroupCount * editTeamsAdvancing <= 2
                  ? 'Min 2 teams advance straight to Championship Grand Final (1st vs 2nd)'
                  : editGroupCount * editTeamsAdvancing <= 5
                  ? '4 teams advance to Semi-Finals (1st vs 4th, 2nd vs 3rd) then Grand Final'
                  : editGroupCount * editTeamsAdvancing <= 11
                  ? '8 teams advance to Quarter-Finals then Semi-Finals & Grand Final'
                  : '16 teams advance to Round of 16'}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setEditFormatModalOpen(false)}
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
                  Save & Regenerate Tiesheet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Edit Banner Modal */}
      {editBannerModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
          }}
        >
          <div
            style={{
              background: '#0F172A',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '560px',
              overflow: 'hidden',
              boxShadow: '0 25px 50px rgba(0, 0, 0, 0.7)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '1.25rem 1.5rem',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ImageIcon size={20} color="#10B981" />
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#FFFFFF' }}>
                  Tournament Cover Photo
                </h3>
              </div>
              <button
                onClick={() => setEditBannerModalOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveBanner} style={{ padding: '1.5rem' }}>
              <ImageUploadZone
                label="Tournament Cover Photo (16:9)"
                recommendedText="Wide 16:9 hero image for tournament bracket and spectator page"
                currentImageUrl={editBannerUrl}
                onUploadComplete={url => setEditBannerUrl(url)}
                folder="tournaments"
                aspectRatio="16:9"
              />
              <div style={{ marginTop: '0.65rem', display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Stadium Presets:</span>
                {[
                  { label: 'Champions Stadium', url: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=1600&auto=format&fit=crop&q=80' },
                  { label: 'Floodlit Arena', url: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=1600&auto=format&fit=crop&q=80' },
                  { label: 'Derby Night', url: 'https://images.unsplash.com/photo-1522778119026-d647f0596c20?w=1600&auto=format&fit=crop&q=80' },
                  { label: 'Metro Pitch', url: 'https://images.unsplash.com/photo-1577223625816-7546f13df25d?w=1600&auto=format&fit=crop&q=80' },
                ].map(p => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => setEditBannerUrl(p.url)}
                    className="btn btn-sm"
                    style={{
                      fontSize: '0.7rem',
                      padding: '2px 7px',
                      background: editBannerUrl === p.url ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.06)',
                      color: editBannerUrl === p.url ? '#10B981' : '#FFF',
                      border: editBannerUrl === p.url ? '1px solid #10B981' : '1px solid rgba(255,255,255,0.1)'
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.5rem' }}>
                <button
                  type="button"
                  onClick={() => setEditBannerModalOpen(false)}
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
                  Save Cover Photo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
