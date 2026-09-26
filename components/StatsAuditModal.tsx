'use client';

import React, { useState, useMemo } from 'react';
import { Match, MatchEvent, ClubMember, MatchAuditPayload, MatchAuditItem } from '@/lib/supabase/types';
import { useClub } from '@/lib/club-context';
import PlayerSearchSelect from '@/components/PlayerSearchSelect';
import PlayerAvatar from '@/components/PlayerAvatar';
import {
  ShieldCheck,
  Star,
  CheckCircle2,
  Flame,
  User,
  Check,
  X,
  Trash2,
  Sparkles
} from 'lucide-react';

interface StatsAuditModalProps {
  match: Match;
  events: MatchEvent[];
  squadPlayers: ClubMember[];
  isOpen: boolean;
  onClose: () => void;
  onAuditCompleted?: () => void;
}

export default function StatsAuditModal({
  match,
  events,
  squadPlayers,
  isOpen,
  onClose,
  onAuditCompleted,
}: StatsAuditModalProps) {
  const { auditAndBakeMatchStats } = useClub();

  // Filter home events (club's own events)
  const initialAuditEvents: MatchAuditItem[] = useMemo(() => {
    return events
      .filter(e => e.team_side === 'home' && ['goal', 'penalty', 'yellow_card', 'red_card'].includes(e.event_type))
      .map(e => {
        const resolvedPlayer = squadPlayers.find(p => p.full_name.toLowerCase() === e.player_name.toLowerCase());
        const resolvedAssist = e.assist_player_name
          ? squadPlayers.find(p => p.full_name.toLowerCase() === e.assist_player_name?.toLowerCase())
          : undefined;

        return {
          id: e.id,
          minute: e.minute,
          event_type: e.event_type as 'goal' | 'penalty' | 'yellow_card' | 'red_card',
          team_side: 'home' as const,
          player_name: e.player_name,
          player_id: resolvedPlayer?.id,
          assist_player_name: e.assist_player_name,
          assist_player_id: resolvedAssist?.id,
        };
      });
  }, [events, squadPlayers]);

  const [auditedEvents, setAuditedEvents] = useState<MatchAuditItem[]>(initialAuditEvents);

  // Clean sheet eligible: GK and defenders if opponent goals scored === 0
  const isCleanSheetGame = match.away_score === 0;
  const eligibleDefenders = useMemo(() => {
    return squadPlayers.filter(p => p.player_position === 'GK' || p.player_position === 'CB' || p.player_position === 'LB' || p.player_position === 'RB');
  }, [squadPlayers]);

  const [cleanSheetMemberIds, setCleanSheetMemberIds] = useState<string[]>(() => {
    if (isCleanSheetGame) {
      // Default to first 4 defenders/gk
      return eligibleDefenders.slice(0, 5).map(p => p.id);
    }
    return [];
  });

  // MOTM selection
  const [motmMemberId, setMotmMemberId] = useState<string>(() => {
    // Default to first goal scorer or first player
    const scorer = auditedEvents.find(e => e.event_type === 'goal' && e.player_id);
    return scorer?.player_id || squadPlayers[0]?.id || '';
  });

  // Participating appearances (default to starting 11/squad)
  const [appearanceMemberIds, setAppearanceMemberIds] = useState<string[]>(() => {
    return squadPlayers.slice(0, 14).map(p => p.id);
  });

  const auditNotes = '';
  const [isBaking, setIsBaking] = useState<boolean>(false);
  const [auditResult, setAuditResult] = useState<{ totalXP: number; message: string } | null>(null);
  const [auditError, setAuditError] = useState<string | null>(null);

  if (!isOpen) return null;

  // Toggle clean sheet recipient
  const handleToggleCleanSheet = (memberId: string) => {
    setCleanSheetMemberIds(prev =>
      prev.includes(memberId) ? prev.filter(id => id !== memberId) : [...prev, memberId]
    );
  };

  // Toggle appearance recipient
  const handleToggleAppearance = (memberId: string) => {
    setAppearanceMemberIds(prev =>
      prev.includes(memberId) ? prev.filter(id => id !== memberId) : [...prev, memberId]
    );
  };

  // Update an event's player or assist
  const handleUpdateEvent = (eventId: string, field: 'player_id' | 'assist_player_id', memberId: string) => {
    const selectedPlayer = squadPlayers.find(p => p.id === memberId);
    setAuditedEvents(prev =>
      prev.map(e => {
        if (e.id === eventId) {
          if (field === 'player_id') {
            return {
              ...e,
              player_id: memberId || undefined,
              player_name: selectedPlayer?.full_name || e.player_name,
            };
          } else {
            return {
              ...e,
              assist_player_id: memberId || undefined,
              assist_player_name: selectedPlayer?.full_name || undefined,
            };
          }
        }
        return e;
      })
    );
  };

  // Remove event from audit
  const handleRemoveEvent = (eventId: string) => {
    setAuditedEvents(prev => prev.filter(e => e.id !== eventId));
  };

  // Commit and Bake into Season Records
  const handleBakeStats = () => {
    setIsBaking(true);
    const payload: MatchAuditPayload = {
      match_id: match.id,
      clean_sheet_member_ids: cleanSheetMemberIds,
      motm_member_id: motmMemberId || undefined,
      appearance_member_ids: appearanceMemberIds,
      audited_events: auditedEvents,
      notes: auditNotes,
    };

    const res = auditAndBakeMatchStats(match.id, payload);
    setIsBaking(false);

    if (res.success) {
      setAuditResult({ totalXP: res.totalPointsAwarded, message: res.message });
      if (onAuditCompleted) onAuditCompleted();
    } else {
      setAuditError(res.message);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0, 0, 0, 0.85)',
      backdropFilter: 'blur(10px)',
      zIndex: 99999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1.25rem',
      overflowY: 'auto',
    }}>
      <div
        className="glass-panel"
        style={{
          maxWidth: '720px',
          width: '100%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
          overflow: 'hidden',
          animation: 'fadeIn 0.2s ease',
          border: '1.5px solid #F59E0B',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.8)',
        }}
      >
        {/* Modal Header */}
        <div style={{
          padding: '1.25rem 1.75rem',
          background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(15, 23, 42, 0.9) 100%)',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'rgba(245, 158, 11, 0.2)',
              border: '1px solid #F59E0B',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <ShieldCheck size={22} color="#F59E0B" />
            </div>
            <div>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 900, color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                Post-Match Stats Audit
                <span className="badge badge-gold" style={{ fontSize: '0.7rem' }}>30s Verification</span>
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '0.15rem' }}>
                {match.home_team_name} {match.home_score} - {match.away_score} {match.away_team_name} • {match.competition}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '0.35rem',
              borderRadius: '6px',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '1.5rem 1.75rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* If already baked, show celebration banner */}
          {auditResult ? (
            <div style={{
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(5, 150, 105, 0.1) 100%)',
              border: '1.5px solid #10B981',
              borderRadius: '12px',
              padding: '1.75rem',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.75rem',
            }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#10B981', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 20px rgba(16, 185, 129, 0.6)' }}>
                <CheckCircle2 size={32} color="#FFFFFF" />
              </div>

              <h3 style={{ fontSize: '1.35rem', fontWeight: 900, color: '#FFFFFF' }}>
                Stats Successfully Baked into Season Records!
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', maxWidth: '480px' }}>
                {auditResult.message}
              </p>

              <div style={{
                marginTop: '0.5rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.45rem 1.1rem',
                borderRadius: '20px',
                background: 'rgba(245, 158, 11, 0.2)',
                border: '1px solid #F59E0B',
                color: '#F59E0B',
                fontWeight: 900,
                fontSize: '0.9rem',
              }}>
                <Flame size={16} />
                <span>+{auditResult.totalXP} Total ClubScore XP Granted</span>
              </div>

              <button
                onClick={onClose}
                className="btn btn-primary btn-sm"
                style={{ marginTop: '1rem', padding: '0.6rem 1.75rem' }}
              >
                Close Audit Screen
              </button>
            </div>
          ) : (
            <>
              {/* 1. Review Goals & Cards */}
              <div>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#FFFFFF', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Flame size={16} color="#F59E0B" /> 1. Verify Recorded Goals & Cards ({auditedEvents.length})
                </h4>

                {auditedEvents.length === 0 ? (
                  <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '1rem', borderRadius: '8px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    No home goals or disciplinary cards were logged during this match.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {auditedEvents.map(evt => (
                      <div
                        key={evt.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          background: 'rgba(15, 23, 42, 0.7)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: '8px',
                          padding: '0.6rem 0.85rem',
                          gap: '0.65rem',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: '80px' }}>
                          <span style={{ fontSize: '0.78rem', fontWeight: 900, color: '#F59E0B', fontFamily: 'var(--font-mono)' }}>
                            {evt.minute}&apos;
                          </span>
                          <span className={`badge ${evt.event_type.includes('card') ? 'badge-secondary' : 'badge-primary'}`} style={{ fontSize: '0.7rem' }}>
                            {evt.event_type.toUpperCase()}
                          </span>
                        </div>

                        {/* Player Picker */}
                        <div style={{ flex: 1, minWidth: '140px' }}>
                          <select aria-label="Player"
                            className="form-select"
                            value={evt.player_id || ''}
                            onChange={e => handleUpdateEvent(evt.id, 'player_id', e.target.value)}
                            style={{ padding: '0.35rem 0.6rem', fontSize: '0.8rem', width: '100%' }}
                          >
                            <option value="">{evt.player_name} (Unlinked)</option>
                            {squadPlayers.map(p => (
                              <option key={p.id} value={p.id}>
                                #{p.jersey_number || '-'} {p.full_name}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Assist Picker if Goal */}
                        {(evt.event_type === 'goal' || evt.event_type === 'penalty') && (
                          <div style={{ flex: 1, minWidth: '140px' }}>
                            <select aria-label="Assisted by"
                              className="form-select"
                              value={evt.assist_player_id || ''}
                              onChange={e => handleUpdateEvent(evt.id, 'assist_player_id', e.target.value)}
                              style={{ padding: '0.35rem 0.6rem', fontSize: '0.8rem', width: '100%' }}
                            >
                              <option value="">No Assist Assigned</option>
                              {squadPlayers.map(p => (
                                <option key={p.id} value={p.id}>
                                  Assist: #{p.jersey_number || '-'} {p.full_name}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={() => handleRemoveEvent(evt.id)}
                          style={{ background: 'transparent', border: 'none', color: '#EF4444', cursor: 'pointer', padding: '0.3rem' }}
                          title="Discard event from records"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 2. Clean Sheet Bonus */}
              <div>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#FFFFFF', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <ShieldCheck size={16} color="#10B981" /> 2. Clean Sheet Verification (+10 XP)
                </h4>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', marginBottom: '0.65rem' }}>
                  {isCleanSheetGame
                    ? `Opponent scored 0 goals! Select goalkeepers and defenders who earned the Clean Sheet bonus:`
                    : `Opponent scored ${match.away_score} goal(s). Clean sheet bonus is typically disabled unless adjusted by coach.`}
                </p>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                  {eligibleDefenders.map(p => {
                    const isChecked = cleanSheetMemberIds.includes(p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleToggleCleanSheet(p.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          padding: '0.35rem 0.75rem',
                          borderRadius: '20px',
                          fontSize: '0.76rem',
                          fontWeight: 800,
                          cursor: 'pointer',
                          background: isChecked ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                          border: `1px solid ${isChecked ? '#10B981' : 'var(--border-subtle)'}`,
                          color: isChecked ? '#10B981' : 'var(--text-muted)',
                        }}
                      >
                        <PlayerAvatar photoUrl={p.photo_url} name={p.full_name} size={20} />
                        {isChecked ? <Check size={12} /> : null}
                        <span>#{p.jersey_number || '-'} {p.full_name} ({p.player_position})</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 3. Man of the Match (MOTM) */}
              <div>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#FFFFFF', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Star size={16} color="#F59E0B" /> 3. Man of the Match Award (+15 XP)
                </h4>
                <PlayerSearchSelect
                  id="motm-search"
                  players={squadPlayers}
                  value={motmMemberId}
                  onChange={setMotmMemberId}
                  extraOptions={[{ value: '', label: '-- Select Official MOTM --' }]}
                />
              </div>

              {/* 4. Match Appearances Verification */}
              <div>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#FFFFFF', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <User size={16} color="#3B82F6" /> 4. Matchday Appearances (+5 XP)
                </h4>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', marginBottom: '0.65rem' }}>
                  Select squad members who played minutes in this fixture ({appearanceMemberIds.length} checked):
                </p>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', maxHeight: '140px', overflowY: 'auto' }}>
                  {squadPlayers.map(p => {
                    const isChecked = appearanceMemberIds.includes(p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleToggleAppearance(p.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          padding: '0.25rem 0.6rem',
                          borderRadius: '6px',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          background: isChecked ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255, 255, 255, 0.03)',
                          border: `1px solid ${isChecked ? '#3B82F6' : 'var(--border-subtle)'}`,
                          color: isChecked ? '#93C5FD' : 'var(--text-muted)',
                        }}
                      >
                        <PlayerAvatar photoUrl={p.photo_url} name={p.full_name} size={18} />
                        {isChecked ? <Check size={11} /> : null}
                        <span>#{p.jersey_number || '-'} {p.full_name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Notice */}
              <div style={{
                background: 'rgba(245, 158, 11, 0.08)',
                border: '1px solid rgba(245, 158, 11, 0.25)',
                borderRadius: '8px',
                padding: '0.85rem',
                fontSize: '0.78rem',
                color: 'var(--text-secondary)',
                lineHeight: 1.45,
              }}>
                ⚡ <strong>Production Guarantee:</strong> Clicking <em>&quot;Bake into Season Records&quot;</em> atomically updates cumulative <code style={{ color: '#FFFFFF' }}>player_stats</code>, deposits ClubScore fantasy points into player profiles, and records audit entries in the immutable ledger.
              </div>
            </>
          )}

        </div>

        {auditError && (
          <div role="alert" style={{ padding: '0.75rem 1.75rem', color: '#EF4444', fontSize: '0.85rem', fontWeight: 600 }}>
            {auditError}
          </div>
        )}

        {/* Modal Footer */}
        {!auditResult && (
          <div style={{
            padding: '1.25rem 1.75rem',
            background: 'rgba(10, 15, 23, 0.95)',
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
          }}>
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary btn-sm"
              style={{ padding: '0.55rem 1.1rem' }}
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleBakeStats}
              disabled={isBaking}
              className="btn btn-primary btn-sm"
              style={{
                padding: '0.55rem 1.5rem',
                background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
                border: 'none',
                color: '#000000',
                fontWeight: 900,
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              <Sparkles size={16} />
              <span>{isBaking ? 'Baking Records...' : 'Bake into Season Records'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
