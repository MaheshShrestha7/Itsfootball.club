'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useClub } from '@/lib/club-context';
import { MatchFormat, PitchPosition, ClubMember, isPlayerMember } from '@/lib/supabase/types';
import TacticalPitch, { PlayerDragPayload, FORMAT_PRESETS } from '@/components/TacticalPitch';
import AdminGuard from '@/components/AdminGuard';
import PlayerAvatar from '@/components/PlayerAvatar';
import {
  Layers,
  Sparkles,
  Send,
  RotateCcw,
  Check,
  AlertTriangle,
  ArrowLeftRight,
  Shield,
  Eye,
  CheckCircle2,
  XCircle,
  HelpCircle,
  AlertCircle,
  Users,
  ChevronRight,
  ClipboardList,
  GripVertical
} from 'lucide-react';

export default function DraftLineupPage() {
  const params = useParams();
  const slug = params?.clubSlug as string;

  const {
    selectClubBySlug,
    members,
    matches,
    availabilities,
    draftLineups,
    saveDraftLineup,
    publishDraftLineup,
  } = useClub();

  const club = selectClubBySlug(slug);

  // Filter squad players
  const squadPlayers = useMemo(() => {
    if (!club) return [];
    return members.filter(m => m.club_id === club.id && isPlayerMember(m));
  }, [club, members]);

  // Upcoming matches for this club
  const clubMatches = useMemo(() => {
    if (!club) return [];
    return matches.filter(m => m.club_id === club.id);
  }, [club, matches]);

  const [selectedMatchId, setSelectedMatchId] = useState<string>(() => {
    const upcoming = clubMatches.find(m => m.status === 'upcoming');
    return upcoming?.id || clubMatches[0]?.id || '';
  });

  const activeMatch = clubMatches.find(m => m.id === selectedMatchId) || clubMatches[0];

  // Active Draft
  const currentDraft = draftLineups.find(d => d.match_id === activeMatch?.id);

  const [matchFormat, setMatchFormat] = useState<MatchFormat>(() => {
    return currentDraft?.format || activeMatch?.match_format || '11v11';
  });

  const [formation, setFormation] = useState<string>(() => {
    return currentDraft?.formation || activeMatch?.home_formation || '4-3-3';
  });

  const buildDefaultCoords = useCallback((fmt: MatchFormat, formName: string): PitchPosition[] => {
    const presetMap = FORMAT_PRESETS[fmt] || FORMAT_PRESETS['11v11'];
    const preset = presetMap[formName] || Object.values(presetMap)[0];
    if (!preset) return [];
    return preset.coords.map((coord, idx) => {
      const squadPlayer = squadPlayers[idx];
      return {
        id: squadPlayer?.id || `pos-${idx}`,
        member_id: squadPlayer?.id,
        name: squadPlayer?.full_name || `Player ${idx + 1}`,
        number: squadPlayer?.jersey_number || (idx === 0 ? 1 : idx + 1),
        position: squadPlayer?.player_position || coord.position,
        x: coord.x,
        y: coord.y,
        role: coord.role,
        is_captain: squadPlayer?.is_executive && !!squadPlayer && isPlayerMember(squadPlayer),
      };
    });
  }, [squadPlayers]);

  const [lineupCoords, setLineupCoords] = useState<PitchPosition[]>(() => {
    if (currentDraft?.lineup_coords?.length) return currentDraft.lineup_coords;
    if (activeMatch?.home_lineup_coords?.length) return activeMatch.home_lineup_coords;
    return [];
  });

  const [tacticalNotes, setTacticalNotes] = useState<string>(() => {
    return currentDraft?.tactical_notes || '';
  });

  // Bench Swap Modal & Selection
  const [swappingPitchPlayerId, setSwappingPitchPlayerId] = useState<string | null>(null);
  const [showPublishModal, setShowPublishModal] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);
  const [isBenchOver, setIsBenchOver] = useState<boolean>(false);

  // Sync draft when active match changes
  useEffect(() => {
    if (activeMatch) {
      const draft = draftLineups.find(d => d.match_id === activeMatch.id);
      if (draft && draft.lineup_coords?.length) {
        setMatchFormat(draft.format);
        setFormation(draft.formation);
        setLineupCoords(draft.lineup_coords);
        setTacticalNotes(draft.tactical_notes || '');
      } else if (activeMatch.home_lineup_coords?.length) {
        setMatchFormat(activeMatch.match_format || '11v11');
        setFormation(activeMatch.home_formation || '4-3-3');
        setLineupCoords(activeMatch.home_lineup_coords);
        setTacticalNotes('');
      } else {
        const fmt = activeMatch.match_format || '11v11';
        const form = activeMatch.home_formation || '4-3-3';
        setMatchFormat(fmt);
        setFormation(form);
        setLineupCoords(buildDefaultCoords(fmt, form));
        setTacticalNotes('');
      }
    }
  }, [activeMatch, draftLineups, buildDefaultCoords]);

  // Match Availabilities lookup
  const matchAvailabilities = useMemo(() => {
    if (!activeMatch) return [];
    return availabilities.filter(a => a.match_id === activeMatch.id);
  }, [availabilities, activeMatch]);

  const getPlayerAvailability = (memberId: string) => {
    return matchAvailabilities.find(a => a.member_id === memberId)?.status || 'pending';
  };

  const showFeedback = (text: string, type: 'success' | 'info' | 'error' = 'success') => {
    setFeedback({ text, type });
    setTimeout(() => setFeedback(null), 3500);
  };

  if (!club || !activeMatch) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem' }}>
        <p>Loading coach workbench...</p>
      </div>
    );
  }

  // Determine starting players vs bench players
  const startingMemberIds = lineupCoords.map(p => p.member_id).filter(Boolean) as string[];
  const benchPlayers = squadPlayers.filter(p => !startingMemberIds.includes(p.id));
  const startingPlayers = squadPlayers.filter(p => startingMemberIds.includes(p.id));

  // Save draft locally
  const handleSaveDraft = (newFormation: string, newPositions: PitchPosition[]) => {
    setFormation(newFormation);
    setLineupCoords(newPositions);

    const benchIds = squadPlayers
      .filter(p => !newPositions.some(pos => pos.member_id === p.id))
      .map(p => p.id);

    saveDraftLineup({
      club_id: club.id,
      match_id: activeMatch.id,
      format: matchFormat,
      formation: newFormation,
      lineup_coords: newPositions,
      bench_member_ids: benchIds,
      tactical_notes: tacticalNotes,
    });

    showFeedback('Draft lineup saved successfully! (Private to coaches)');
  };

  // Drag-and-drop replacement / swap handler (buildlineup.com style)
  const handlePlayerDropReplace = (targetPitchPosId: string, source: PlayerDragPayload) => {
    setLineupCoords(prev => {
      const currentList = prev.length > 0 ? prev : buildDefaultCoords(matchFormat, formation);
      const targetPos = currentList.find(p => p.id === targetPitchPosId || p.member_id === targetPitchPosId);
      if (!targetPos) return currentList;

      // Case 1: Dragging a starter onto another starter -> SWAP POSITIONS
      if (source.type === 'pitch') {
        if (!source.posId || source.posId === targetPitchPosId) return prev;
        const sourcePos = prev.find(p => p.id === source.posId);
        if (!sourcePos) return prev;

        const updated = prev.map(p => {
          if (p.id === targetPitchPosId) {
            return {
              ...p,
              member_id: sourcePos.member_id,
              name: sourcePos.name,
              number: sourcePos.number,
              position: sourcePos.position,
              is_captain: sourcePos.is_captain,
            };
          }
          if (p.id === source.posId) {
            return {
              ...p,
              member_id: targetPos.member_id,
              name: targetPos.name,
              number: targetPos.number,
              position: targetPos.position,
              is_captain: targetPos.is_captain,
            };
          }
          return p;
        });

        showFeedback(`Swapped ${sourcePos.name} and ${targetPos.name} on the pitch!`, 'success');
        return updated;
      }

      // Case 2: Dragging a bench player onto a starter -> REPLACE / SUBSTITUTE
      if (source.type === 'bench') {
        const benchPlayer = squadPlayers.find(p => p.id === source.memberId);
        const prevStarterName = targetPos.name;

        const updated = prev.map(p => {
          if (p.id === targetPitchPosId) {
            return {
              ...p,
              member_id: source.memberId,
              name: source.name || benchPlayer?.full_name || 'Player',
              number: source.number ?? benchPlayer?.jersey_number ?? p.number,
              position: source.position ?? benchPlayer?.player_position ?? p.position,
              is_captain: benchPlayer?.is_executive && !!benchPlayer && isPlayerMember(benchPlayer),
            };
          }
          return p;
        });

        showFeedback(`Substituted in ${source.name} for ${prevStarterName}!`, 'success');
        return updated;
      }

      return prev;
    });
  };

  // Move starter to bench
  const handleBenchStarter = (pitchPosId: string) => {
    setLineupCoords(prev => {
      const targetPos = prev.find(p => p.id === pitchPosId);
      if (!targetPos) return prev;
      const starterName = targetPos.name;

      const updated = prev.map(p => {
        if (p.id === pitchPosId) {
          return {
            ...p,
            member_id: undefined,
            name: `Position ${p.position}`,
            number: 0,
            is_captain: false,
          };
        }
        return p;
      });

      showFeedback(`Moved ${starterName} to the bench`, 'info');
      return updated;
    });
  };

  // Swap Starter with Bench Player
  const handlePerformSwap = (pitchPosId: string, benchPlayer: ClubMember) => {
    setLineupCoords(prev => {
      const targetPos = prev.find(p => p.id === pitchPosId);
      if (!targetPos) return prev;

      return prev.map(p => {
        if (p.id === pitchPosId) {
          return {
            ...p,
            member_id: benchPlayer.id,
            name: benchPlayer.full_name,
            number: benchPlayer.jersey_number || p.number,
            position: benchPlayer.player_position || p.position,
            is_captain: benchPlayer.is_executive && isPlayerMember(benchPlayer),
          };
        }
        return p;
      });
    });

    setSwappingPitchPlayerId(null);
    showFeedback(`Swapped in ${benchPlayer.full_name}!`);
  };

  // Publish to Live Match Center
  const handlePublish = () => {
    // 1. Ensure draft is saved
    const benchIds = squadPlayers
      .filter(p => !lineupCoords.some(pos => pos.member_id === p.id))
      .map(p => p.id);

    saveDraftLineup({
      club_id: club.id,
      match_id: activeMatch.id,
      format: matchFormat,
      formation,
      lineup_coords: lineupCoords,
      bench_member_ids: benchIds,
      tactical_notes: tacticalNotes,
    });

    // 2. Publish
    const res = publishDraftLineup(activeMatch.id);
    setShowPublishModal(false);
    if (res.success) {
      showFeedback(res.message, 'success');
    } else {
      showFeedback(res.message, 'error');
    }
  };

  const statusIcons = {
    available: { icon: CheckCircle2, color: '#10B981', label: 'Available' },
    maybe: { icon: AlertCircle, color: '#F59E0B', label: 'Doubtful' },
    unavailable: { icon: XCircle, color: '#EF4444', label: 'Out' },
    pending: { icon: HelpCircle, color: 'var(--text-muted)', label: 'Pending' },
  };

  return (
    <AdminGuard club={club}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem', paddingBottom: '3rem' }}>
        
        {/* Header Breadcrumbs & Action Bar */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
              <Link href={`/${club.slug}/admin`} style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>Admin</Link>
              <ChevronRight size={14} />
              <Link href={`/${club.slug}/admin/match-center`} style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>Match Center</Link>
              <ChevronRight size={14} />
              <span style={{ color: '#FFFFFF' }}>Draft Lineup Workbench</span>
            </div>

            <h1 style={{ fontSize: '1.75rem', fontWeight: 900, color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <Layers size={26} color="#F59E0B" />
              <span>Draft Lineup & Tactical Workbench</span>
              <span className="badge badge-gold" style={{ fontSize: '0.72rem' }}>Coach Sandbox</span>
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginTop: '0.2rem' }}>
              Experiment with starting lineups and substitutions during the week without publishing changes prematurely.
            </p>
          </div>

          {/* Action Buttons: Availability Link & Publish Button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Link
              href={`/${club.slug}/availability`}
              className="btn btn-secondary btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <Users size={14} color="#10B981" />
              <span>Availability Hub</span>
            </Link>

            <button
              onClick={() => setShowPublishModal(true)}
              className="btn btn-primary btn-sm"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                color: '#FFFFFF',
                border: 'none',
                boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)',
              }}
            >
              <Send size={15} />
              <span>Publish to Match Center</span>
            </button>
          </div>
        </div>

        {/* Feedback Toast */}
        {feedback && (
          <div style={{
            padding: '0.75rem 1.25rem',
            borderRadius: '10px',
            fontSize: '0.85rem',
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            background: feedback.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            border: `1px solid ${feedback.type === 'success' ? '#10B981' : '#EF4444'}`,
            color: feedback.type === 'success' ? '#10B981' : '#EF4444',
          }}>
            {feedback.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
            <span>{feedback.text}</span>
          </div>
        )}

        {/* Match & Format Selector Bar */}
        <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1.25rem' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                Fixture Target:
              </label>
              <select
                className="form-select"
                value={selectedMatchId}
                onChange={e => setSelectedMatchId(e.target.value)}
                style={{ padding: '0.45rem 0.75rem', fontSize: '0.85rem', minWidth: '240px' }}
              >
                {clubMatches.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.home_team_name} vs {m.away_team_name} ({m.competition})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                Match Format:
              </label>
              <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(0, 0, 0, 0.4)', padding: '2px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                {(['11v11', '9v9', '7v7'] as MatchFormat[]).map(fmt => (
                  <button
                    key={fmt}
                    type="button"
                    onClick={() => {
                      setMatchFormat(fmt);
                      const defaultForm = fmt === '7v7' ? '2-3-1' : fmt === '9v9' ? '3-2-3' : '4-3-3';
                      setFormation(defaultForm);
                    }}
                    style={{
                      padding: '0.35rem 0.75rem',
                      fontSize: '0.78rem',
                      fontWeight: matchFormat === fmt ? 800 : 600,
                      borderRadius: '6px',
                      background: matchFormat === fmt ? club.primary_color : 'transparent',
                      color: matchFormat === fmt ? '#FFFFFF' : 'var(--text-muted)',
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {fmt === '11v11' ? '11v11 Senior' : fmt === '9v9' ? '9v9 Academy' : '7v7 Junior'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.4rem 0.8rem',
              borderRadius: '20px',
              background: currentDraft?.is_published ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
              border: `1px solid ${currentDraft?.is_published ? '#10B981' : '#F59E0B'}`,
              fontSize: '0.78rem',
              fontWeight: 800,
              color: currentDraft?.is_published ? '#10B981' : '#F59E0B',
            }}>
              {currentDraft?.is_published ? <CheckCircle2 size={14} /> : <Shield size={14} />}
              <span>{currentDraft?.is_published ? 'Published Live' : 'Draft Mode (Private)'}</span>
            </div>
          </div>
        </div>

        {/* Workbench Layout: Pitch on Left, Bench & Availability Drawer on Right */}
        <div className="lineup-workbench-layout" style={{ display: 'grid', gap: '1.75rem', alignItems: 'start' }}>
          
          {/* Tactical Pitch Sandbox */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div className="glass-panel" style={{ padding: '1.5rem', overflow: 'hidden', maxWidth: '100%', boxSizing: 'border-box' }}>
              <TacticalPitch
                players={squadPlayers}
                formation={formation}
                matchFormat={matchFormat}
                savedPositions={lineupCoords.length ? lineupCoords : undefined}
                primaryColor={club.primary_color}
                isEditable={true}
                teamName={activeMatch.home_team_name}
                orientation="vertical"
                allowOrientationToggle={true}
                onSaveFormation={handleSaveDraft}
                onSwapWithBench={pitchPlayerId => setSwappingPitchPlayerId(pitchPlayerId)}
                onPlayerDropReplace={handlePlayerDropReplace}
              />
            </div>

            {/* Tactical Notes Box */}
            <div className="glass-panel" style={{ padding: '1.25rem' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#FFFFFF', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <ClipboardList size={16} color={club.primary_color} /> Coach Instructions & Tactical Cues
              </h3>
              <textarea
                className="form-input"
                rows={3}
                placeholder="Add team instructions, set-piece assignments, pressing triggers..."
                value={tacticalNotes}
                onChange={e => setTacticalNotes(e.target.value)}
                style={{ width: '100%', fontSize: '0.85rem', resize: 'vertical' }}
              />
            </div>
          </div>

          {/* Bench & Availability Drawer */}
          <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 900, color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Users size={18} color="#3B82F6" /> Substitutes & Reserves
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', marginTop: '0.2rem' }}>
                Drag any player card onto a pitch position to replace or substitute.
              </p>
            </div>

            {/* Drag Target Dropzone to bench starter */}
            <div
              onDragOver={e => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                if (!isBenchOver) setIsBenchOver(true);
              }}
              onDragLeave={() => setIsBenchOver(false)}
              onDrop={e => {
                e.preventDefault();
                setIsBenchOver(false);
                try {
                  let data: PlayerDragPayload | null = null;
                  try {
                    const raw = e.dataTransfer.getData('text/plain') || e.dataTransfer.getData('application/json');
                    if (raw) data = JSON.parse(raw);
                  } catch {}
                  if (!data && typeof window !== 'undefined') {
                    data = (window as any).__activePlayerDragPayload || null;
                  }
                  if (data && data.type === 'pitch' && data.posId) {
                    handleBenchStarter(data.posId);
                  }
                } catch (err) {
                  console.warn('Drop to bench failed', err);
                } finally {
                  if (typeof window !== 'undefined') {
                    (window as any).__activePlayerDragPayload = null;
                  }
                }
              }}
              style={{
                border: `2px dashed ${isBenchOver ? '#10B981' : 'var(--border-subtle)'}`,
                borderRadius: '8px',
                padding: '0.65rem 0.75rem',
                textAlign: 'center',
                background: isBenchOver ? 'rgba(16, 185, 129, 0.12)' : 'rgba(255, 255, 255, 0.02)',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.45rem',
              }}
            >
              <ArrowLeftRight size={14} color={isBenchOver ? '#10B981' : 'var(--text-muted)'} />
              <span style={{ fontSize: '0.74rem', fontWeight: 800, color: isBenchOver ? '#10B981' : 'var(--text-secondary)' }}>
                {isBenchOver ? 'Drop here to send player to Bench' : 'Drag player to Pitch or drop here to Bench'}
              </span>
            </div>

            {/* Bench List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '580px', overflowY: 'auto' }}>
              {benchPlayers.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                  All squad players are currently placed in the starting XI.
                </div>
              ) : (
                benchPlayers.map(player => {
                  const status = getPlayerAvailability(player.id);
                  const stConfig = statusIcons[status];
                  const Icon = stConfig.icon;

                  return (
                    <div
                      key={player.id}
                      draggable={true}
                      onDragStart={e => {
                        const payload: PlayerDragPayload = {
                          type: 'bench',
                          memberId: player.id,
                          name: player.full_name,
                          number: player.jersey_number,
                          position: player.player_position,
                        };
                        e.dataTransfer.setData('text/plain', JSON.stringify(payload));
                        e.dataTransfer.setData('application/json', JSON.stringify(payload));
                        e.dataTransfer.effectAllowed = 'copyMove';
                        if (typeof window !== 'undefined') {
                          (window as any).__activePlayerDragPayload = payload;
                        }
                      }}
                      onDragEnd={() => {
                        if (typeof window !== 'undefined') {
                          (window as any).__activePlayerDragPayload = null;
                        }
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.6rem 0.75rem',
                        borderRadius: '8px',
                        background: 'rgba(15, 23, 42, 0.65)',
                        border: '1px solid var(--border-subtle)',
                        gap: '0.5rem',
                        cursor: 'grab',
                        userSelect: 'none',
                        transition: 'all 0.15s ease',
                      }}
                      title="Drag to Pitch to substitute starter"
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
                        <GripVertical size={16} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                        <PlayerAvatar photoUrl={player.photo_url} name={player.full_name} size={32} />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 800, fontSize: '0.85rem', color: '#FFFFFF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {player.full_name}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            <span style={{ color: club.primary_color, fontWeight: 800 }}>#{player.jersey_number || '-'}</span>
                            <span>•</span>
                            <span>{player.player_position || 'Squad'}</span>
                          </div>
                        </div>
                      </div>

                      {/* Availability Tag */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          padding: '0.2rem 0.5rem',
                          borderRadius: '12px',
                          background: `${stConfig.color}20`,
                          border: `1px solid ${stConfig.color}40`,
                          color: stConfig.color,
                          fontSize: '0.68rem',
                          fontWeight: 800,
                          flexShrink: 0,
                        }}
                        title={`Availability: ${stConfig.label}`}
                      >
                        <Icon size={12} />
                        <span>{stConfig.label}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Quick Helper Note */}
            <div style={{
              background: 'rgba(59, 130, 246, 0.08)',
              border: '1px solid rgba(59, 130, 246, 0.25)',
              borderRadius: '8px',
              padding: '0.75rem',
              fontSize: '0.75rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.4,
            }}>
              💡 <strong>Coach Tip:</strong> Click any starting player on the pitch, then select <em>&quot;Swap with Bench&quot;</em> to substitute in 1 click.
            </div>
          </div>
        </div>

        {/* SWAP MODAL: Triggered from Tactical Pitch */}
        {swappingPitchPlayerId && (
          <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(8px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}>
            <div className="glass-panel" style={{ maxWidth: '440px', width: '100%', padding: '1.75rem', animation: 'fadeIn 0.2s ease' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 900, color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <ArrowLeftRight size={18} color="#3B82F6" /> Select Substitute
                </h3>
                <button
                  onClick={() => setSwappingPitchPlayerId(null)}
                  className="btn btn-secondary btn-sm"
                  style={{ padding: '0.25rem 0.5rem' }}
                >
                  ✕
                </button>
              </div>

              <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginBottom: '1rem' }}>
                Choose a bench player to swap into this position on the tactical board:
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '340px', overflowY: 'auto' }}>
                {benchPlayers.map(benchP => {
                  const status = getPlayerAvailability(benchP.id);
                  const stConfig = statusIcons[status];
                  const Icon = stConfig.icon;

                  return (
                    <button
                      key={benchP.id}
                      type="button"
                      onClick={() => handlePerformSwap(swappingPitchPlayerId, benchP)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.65rem 0.85rem',
                        borderRadius: '8px',
                        background: 'rgba(255, 255, 255, 0.04)',
                        border: '1px solid var(--border-subtle)',
                        cursor: 'pointer',
                        textAlign: 'left',
                        color: '#FFFFFF',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                        <PlayerAvatar photoUrl={benchP.photo_url} name={benchP.full_name} size={32} />
                        <div>
                          <div style={{ fontWeight: 800, fontSize: '0.85rem' }}>{benchP.full_name}</div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            #{benchP.jersey_number || '-'} • {benchP.player_position || 'Squad'}
                          </div>
                        </div>
                      </div>

                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                        fontSize: '0.7rem',
                        color: stConfig.color,
                        fontWeight: 800,
                      }}>
                        <Icon size={12} />
                        <span>{stConfig.label}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* PUBLISH CONFIRMATION MODAL */}
        {showPublishModal && (
          <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(8px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}>
            <div className="glass-panel" style={{ maxWidth: '480px', width: '100%', padding: '2rem', animation: 'fadeIn 0.25s ease' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
                <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.2)', border: '1px solid #10B981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Send size={22} color="#10B981" />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#FFFFFF' }}>Publish Lineup to Match Center?</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                    This will immediately update the live public match center for fans and players.
                  </p>
                </div>
              </div>

              <div style={{
                background: 'rgba(0, 0, 0, 0.4)',
                borderRadius: '10px',
                padding: '1rem',
                border: '1px solid var(--border-subtle)',
                marginBottom: '1.5rem',
                fontSize: '0.82rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.4rem',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Match:</span>
                  <span style={{ fontWeight: 800, color: '#FFFFFF' }}>{activeMatch.home_team_name} vs {activeMatch.away_team_name}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Format:</span>
                  <span style={{ fontWeight: 800, color: '#10B981' }}>{matchFormat}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Formation:</span>
                  <span style={{ fontWeight: 800, color: '#F59E0B' }}>{formation}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Starting Players:</span>
                  <span style={{ fontWeight: 800, color: '#FFFFFF' }}>{startingPlayers.length} placed on pitch</span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setShowPublishModal(false)}
                  className="btn btn-secondary btn-sm"
                  style={{ padding: '0.55rem 1rem' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handlePublish}
                  className="btn btn-primary btn-sm"
                  style={{
                    padding: '0.55rem 1.25rem',
                    background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                    border: 'none',
                    color: '#FFFFFF',
                    fontWeight: 800,
                  }}
                >
                  Confirm & Publish Live
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </AdminGuard>
  );
}
