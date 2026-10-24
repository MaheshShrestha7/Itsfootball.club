'use client';

import React, { useState, useMemo } from 'react';
import { useDialog } from '@/lib/use-escape-to-close';
import { Match, MatchEvent, ClubMember, MatchAuditPayload, MatchAuditItem } from '@/lib/supabase/types';
import { useClub } from '@/lib/club-context';
import { getDefaultClubScoreRules } from '@/lib/clubscore-defaults';
import { clubLineupSide } from '@/lib/tournament-engine';
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
  const { auditAndBakeMatchStats, clubScoreRules } = useClub();
  const rules = clubScoreRules[match.club_id] || getDefaultClubScoreRules(match.club_id);

  // The club's own side: away when it played away (its goals and cards are logged on that side)
  const clubSide = clubLineupSide(match);
  const opponentScore = clubSide === 'home' ? match.away_score : match.home_score;
  const isFinished = match.status === 'completed';

  // The club's own events
  const initialAuditEvents: MatchAuditItem[] = useMemo(() => {
    return events
      .filter(e => e.team_side === clubSide && ['goal', 'penalty', 'yellow_card', 'red_card'].includes(e.event_type))
      .map(e => {
        const resolvedPlayer = squadPlayers.find(p => p.full_name.toLowerCase() === e.player_name.toLowerCase());
        const resolvedAssist = e.assist_player_name
          ? squadPlayers.find(p => p.full_name.toLowerCase() === e.assist_player_name?.toLowerCase())
          : undefined;

        return {
          id: e.id,
          minute: e.minute,
          event_type: e.event_type as 'goal' | 'penalty' | 'yellow_card' | 'red_card',
          team_side: clubSide,
          player_name: e.player_name,
          player_id: resolvedPlayer?.id,
          assist_player_name: e.assist_player_name,
          assist_player_id: resolvedAssist?.id,
        };
      });
  }, [events, squadPlayers, clubSide]);

  const [auditedEvents, setAuditedEvents] = useState<MatchAuditItem[]>(initialAuditEvents);

  // Who played: the club's lineup on the pitch for this match, subs who came on, plus anyone who
  // scored, assisted or was booked. Nobody is ticked when there's no lineup, so nothing is credited by guesswork.
  const playedIds = useMemo(() => {
    const coords = (clubSide === 'home' ? match.home_lineup_coords : match.away_lineup_coords) || [];
    const ids = new Set(coords.map(c => c.member_id).filter((id): id is string => !!id && squadPlayers.some(p => p.id === id)));
    initialAuditEvents.forEach(e => { if (e.player_id) ids.add(e.player_id); if (e.assist_player_id) ids.add(e.assist_player_id); });
    // Subs who came on
    events.filter(e => e.event_type === 'sub' && e.team_side === clubSide).forEach(e => {
      const sub = squadPlayers.find(p => p.full_name.toLowerCase() === (e.player_name || '').trim().toLowerCase());
      if (sub) ids.add(sub.id);
    });
    return [...ids];
  }, [match.home_lineup_coords, match.away_lineup_coords, clubSide, squadPlayers, initialAuditEvents, events]);

  // Clean sheet eligible: GK and defenders, once the match is over and the opponent didn't score
  const isCleanSheetGame = isFinished && opponentScore === 0;
  const eligibleDefenders = useMemo(() => {
    return squadPlayers.filter(p => p.player_position === 'GK' || p.player_position === 'CB' || p.player_position === 'LB' || p.player_position === 'RB');
  }, [squadPlayers]);

  // Pre-ticked only for defenders who played
  const [cleanSheetMemberIds, setCleanSheetMemberIds] = useState<string[]>(() =>
    isCleanSheetGame ? eligibleDefenders.filter(p => playedIds.includes(p.id)).map(p => p.id) : []);

  // Player of the Match is the coach's call (it's published on the match page), so it starts empty
  const [motmMemberId, setMotmMemberId] = useState<string>('');

  const [appearanceMemberIds, setAppearanceMemberIds] = useState<string[]>(() => playedIds);

  const auditNotes = '';
  const [isBaking, setIsBaking] = useState<boolean>(false);
  const [auditResult, setAuditResult] = useState<{ totalXP: number; message: string } | null>(null);
  const [auditError, setAuditError] = useState<string | null>(null);

  const dialogRef = useDialog(isOpen, onClose);

  // Minutes from what was recorded: starters (the lineup on the pitch) play the whole match unless
  // subbed off, a sub plays from the minute they came on. Anyone else ticked gets the appearance only.
  const minutesByMember = useMemo(() => {
    const full = match.match_format === '7v7' ? 50 : match.match_format === '9v9' ? 60 : 90;
    const byName = (name: string) => squadPlayers.find(p => p.full_name.toLowerCase() === name.trim().toLowerCase())?.id;
    const coords = (clubSide === 'home' ? match.home_lineup_coords : match.away_lineup_coords) || [];
    const on = new Map<string, number>();
    coords.forEach(c => { if (c.member_id) on.set(c.member_id, 0); });
    const off = new Map<string, number>();
    events.filter(e => e.event_type === 'sub' && e.team_side === clubSide).forEach(e => {
      const minute = Math.min(Math.max(e.minute, 0), full);
      const inId = byName(e.player_name || '');
      if (inId && !on.has(inId)) on.set(inId, minute);
      const offName = /,\s*(.+?) OFF\./.exec(e.detail_text || '')?.[1];
      const offId = offName ? byName(offName) : undefined;
      if (offId) off.set(offId, minute);
    });
    const minutes: Record<string, number> = {};
    on.forEach((start, id) => { minutes[id] = Math.max(0, (off.get(id) ?? full) - start); });
    return minutes;
  }, [match.match_format, match.home_lineup_coords, match.away_lineup_coords, clubSide, events, squadPlayers]);

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

  // Save into the players' season stats
  const handleBakeStats = () => {
    if (!isFinished) {
      setAuditError('This match hasn\'t finished yet. Press full time first, then save the stats.');
      return;
    }
    setIsBaking(true);
    const payload: MatchAuditPayload = {
      match_id: match.id,
      clean_sheet_member_ids: cleanSheetMemberIds,
      motm_member_id: motmMemberId || undefined,
      appearance_member_ids: appearanceMemberIds,
      minutes_by_member: minutesByMember,
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
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Save player stats"
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
          background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(var(--dk-15-23-42), 0.9) 100%)',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div className="row row-loose">
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
              <ShieldCheck size={22} color="var(--c-amber)" />
            </div>
            <div>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 900, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                Save Player Stats
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

              <h3 style={{ fontSize: '1.35rem', fontWeight: 900, color: 'var(--text-primary)' }}>
                Player Stats Saved
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
                color: 'var(--c-amber)',
                fontWeight: 900,
                fontSize: '0.9rem',
              }}>
                <Flame size={16} />
                <span>+{auditResult.totalXP} ClubScore points</span>
              </div>

              <button
                onClick={onClose}
                className="btn btn-primary btn-sm"
                style={{ marginTop: '1rem', padding: '0.6rem 1.75rem' }}
              >
                Done
              </button>
            </div>
          ) : (
            <>
              {/* 1. Review Goals & Cards */}
              <div>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Flame size={16} color="var(--c-amber)" /> 1. Check Goals & Cards ({auditedEvents.length})
                </h4>

                {auditedEvents.length === 0 ? (
                  <div style={{ background: 'rgba(var(--tint-rgb), 0.03)', padding: '1rem', borderRadius: '8px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    No goals or cards were logged for {clubSide === 'home' ? match.home_team_name : match.away_team_name} in this match.
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
                          background: 'rgba(var(--dk-15-23-42), 0.7)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: '8px',
                          padding: '0.6rem 0.85rem',
                          gap: '0.65rem',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: '80px' }}>
                          <span style={{ fontSize: '0.78rem', fontWeight: 900, color: 'var(--c-amber)', fontFamily: 'var(--font-mono)' }}>
                            {evt.minute}&apos;
                          </span>
                          <span className={`badge ${evt.event_type.includes('card') ? 'badge-secondary' : 'badge-primary'}`} style={{ fontSize: '0.7rem' }}>
                            {evt.event_type.toUpperCase()}
                          </span>
                        </div>

                        {/* Player Picker */}
                        <div style={{ flex: 1, minWidth: 'min(140px, 100%)' }}>
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
                          <div style={{ flex: 1, minWidth: 'min(140px, 100%)' }}>
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
                          style={{ background: 'transparent', border: 'none', color: 'var(--c-red)', cursor: 'pointer', padding: '0.3rem' }}
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
                <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <ShieldCheck size={16} color="var(--c-green)" /> 2. Clean Sheet (+{rules.points_clean_sheet_gk_def ?? 10} points)
                </h4>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', marginBottom: '0.65rem' }}>
                  {!isFinished
                    ? 'The match hasn\'t finished yet, so there\'s no clean sheet to give.'
                    : isCleanSheetGame
                      ? 'The other team didn\'t score. Tick the goalkeepers and defenders who earned the clean sheet:'
                      : `The other team scored ${opponentScore}, so there's no clean sheet. Tick a player only if the coach wants to give one anyway.`}
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
                          background: isChecked ? 'rgba(16, 185, 129, 0.2)' : 'rgba(var(--tint-rgb), 0.04)',
                          border: `1px solid ${isChecked ? '#10B981' : 'var(--border-subtle)'}`,
                          color: isChecked ? 'var(--c-green)' : 'var(--text-muted)',
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
                <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Star size={16} color="var(--c-amber)" /> 3. Player of the Match (+{rules.points_motm ?? 15} points)
                </h4>
                <PlayerSearchSelect
                  id="motm-search"
                  players={squadPlayers}
                  value={motmMemberId}
                  onChange={setMotmMemberId}
                  extraOptions={[{ value: '', label: 'No Player of the Match' }]}
                />
              </div>

              {/* 4. Match Appearances Verification */}
              <div>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <User size={16} color="var(--c-blue)" /> 4. Who Played (+{rules.points_match_appearance ?? 5} points each)
                </h4>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', marginBottom: '0.65rem' }}>
                  {playedIds.length > 0
                    ? `Ticked from the lineup and the match events. Add anyone else who came on (${appearanceMemberIds.length} ticked):`
                    : `No lineup was saved for this match, so tick everyone who played (${appearanceMemberIds.length} ticked):`}
                  {' '}
                  <button type="button" className="btn btn-secondary btn-sm" style={{ padding: '0.15rem 0.5rem', fontSize: '0.72rem' }}
                    onClick={() => setAppearanceMemberIds(appearanceMemberIds.length === squadPlayers.length ? [] : squadPlayers.map(p => p.id))}>
                    {appearanceMemberIds.length === squadPlayers.length ? 'Untick all' : 'Tick all'}
                  </button>
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
                          background: isChecked ? 'rgba(59, 130, 246, 0.2)' : 'rgba(var(--tint-rgb), 0.03)',
                          border: `1px solid ${isChecked ? '#3B82F6' : 'var(--border-subtle)'}`,
                          color: isChecked ? 'var(--c-sky)' : 'var(--text-muted)',
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
                Saving adds these goals, assists, cards and appearances to each player&apos;s season stats and gives their ClubScore points. You can only save a match once.
              </div>
            </>
          )}

        </div>

        {auditError && (
          <div role="alert" style={{ padding: '0.75rem 1.75rem', color: 'var(--c-red)', fontSize: '0.85rem', fontWeight: 600 }}>
            {auditError}
          </div>
        )}

        {/* Modal Footer */}
        {!auditResult && (
          <div style={{
            padding: '1.25rem 1.75rem',
            background: 'rgba(var(--dk-10-15-23), 0.95)',
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
              <span>{isBaking ? 'Saving...' : 'Save Player Stats'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
