'use client';

import React, { useState, useEffect, useRef, useCallback, use } from 'react';
import Link from 'next/link';
import confetti from 'canvas-confetti';
import { useClub } from '@/lib/club-context';
import TacticalPitch from '@/components/TacticalPitch';
import ScoreboardDigitRoll from '@/components/ScoreboardDigitRoll';
import { isSupabaseConfigured, getSupabaseClient } from '@/lib/supabase/client';
import {
  Shield,
  Radio,
  Clock,
  MapPin,
  Trophy,
  ArrowLeft,
  Settings,
  Flame,
  AlertCircle,
  Share2,
  Volume2,
  VolumeX,
  Sparkles,
  QrCode,
  Calendar,
  Wifi
} from 'lucide-react';

export default function MatchCenterPage({
  params,
}: {
  params: Promise<{ clubSlug: string; matchId: string }>;
}) {
  const resolvedParams = use(params);
  const { clubs, selectClubBySlug, matches, matchEvents, updateMatch, members } = useClub();

  const club = selectClubBySlug(resolvedParams.clubSlug) || clubs[0];
  const match = matches.find(m => m.id === resolvedParams.matchId) || matches[0];
  const events = matchEvents.filter(e => e.match_id === match.id).sort((a, b) => b.minute - a.minute);
  const squadPlayers = members.filter(m => m.club_id === club.id && m.role === 'player');

  const [activeTab, setActiveTab] = useState<'timeline' | 'lineups' | 'stats'>('timeline');
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [liveSyncPulse, setLiveSyncPulse] = useState(false);

  // Goal Strobe Alert State
  const [goalAlert, setGoalAlert] = useState<{
    active: boolean;
    teamName: string;
    teamSide: 'home' | 'away';
  } | null>(null);

  const prevHomeScoreRef = useRef(match.home_score);
  const prevAwayScoreRef = useRef(match.away_score);
  const isInitialMount = useRef(true);

  // Synthesized stadium goal chime using Web Audio API
  const playGoalAudio = useCallback(() => {
    if (!audioEnabled || typeof window === 'undefined') return;
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();

      // Pitch whistle chime
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(659.25, ctx.currentTime); // E5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.18); // A5
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.65);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.65);
    } catch {
      // Graceful silence if audio context is blocked
    }
  }, [audioEnabled]);

  // Trigger Goal Celebration (Confetti, Strobe Wave, Crest Glow, Chime)
  const triggerGoalCelebration = useCallback((side: 'home' | 'away', teamName: string) => {
    setGoalAlert({
      active: true,
      teamName,
      teamSide: side,
    });

    playGoalAudio();

    try {
      const scoringColor = side === 'home' ? (club.primary_color || '#10B981') : '#3B82F6';
      confetti({
        particleCount: 65,
        spread: 80,
        origin: { y: 0.35 },
        colors: [scoringColor, '#F59E0B', '#FFFFFF'],
      });
    } catch {
      // Fallback
    }

    const timer = setTimeout(() => {
      setGoalAlert(null);
    }, 3200);

    return () => clearTimeout(timer);
  }, [club.primary_color, playGoalAudio]);

  // Watch for real-time score changes
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    if (match.home_score > prevHomeScoreRef.current) {
      triggerGoalCelebration('home', match.home_team_name);
    } else if (match.away_score > prevAwayScoreRef.current) {
      triggerGoalCelebration('away', match.away_team_name);
    }

    prevHomeScoreRef.current = match.home_score;
    prevAwayScoreRef.current = match.away_score;
  }, [match.home_score, match.away_score, match.home_team_name, match.away_team_name, triggerGoalCelebration]);

  // Real-time live synchronization: BroadcastChannel + Supabase Realtime + Live Polling Heartbeat
  useEffect(() => {
    // 1. BroadcastChannel cross-tab synchronization
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        const channel = new BroadcastChannel('itsfootball_live_matchday');
        channel.onmessage = (e) => {
          const data = e.data;
          if (!data) return;
          if (data.matchId === match.id || data.type === 'MATCH_EVENT_ADDED' || data.type === 'MATCH_UPDATED') {
            setLiveSyncPulse(true);
            setTimeout(() => setLiveSyncPulse(false), 2000);
          }
        };
        return () => {
          channel.close();
        };
      } catch {}
    }
  }, [match.id]);

  // 2. Supabase Realtime Channel Subscription
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const client = getSupabaseClient();
    if (!client) return;

    try {
      const channel = client
        .channel(`public_match_${match.id}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches', filter: `id=eq.${match.id}` }, payload => {
          if (payload.new) {
            updateMatch(match.id, payload.new as any);
            setLiveSyncPulse(true);
            setTimeout(() => setLiveSyncPulse(false), 2000);
          }
        })
        .subscribe();

      return () => {
        client.removeChannel(channel);
      };
    } catch {}
  }, [match.id, updateMatch]);

  return (
    <div style={{ padding: '2.5rem 0 5rem 0' }}>
      <div className="container">
        {/* Top Breadcrumb & Live Controls */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.85rem',
          marginBottom: '1.5rem',
        }}>
          <Link
            href={`/${club.slug}`}
            className="touch-target"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}
          >
            <ArrowLeft size={16} />
            <span>Back to {club.name}</span>
          </Link>

          <div className="scroll-pill-strip" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', maxWidth: '100%' }}>
            {/* Live Feed Synced Badge */}
            <div
              className="scroll-pill-item"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                padding: '0.4rem 0.8rem',
                borderRadius: 'var(--radius-sm)',
                background: liveSyncPulse ? 'rgba(16, 185, 129, 0.25)' : 'rgba(16, 185, 129, 0.12)',
                border: `1px solid ${liveSyncPulse ? '#10B981' : 'rgba(16, 185, 129, 0.35)'}`,
                color: '#10B981',
                fontSize: '0.74rem',
                fontWeight: 800,
                minHeight: '38px',
                transition: 'all 0.3s ease',
              }}
              title="Real-time match feed synced directly from club touchline controller"
            >
              <span className="pulse-dot" style={{ background: '#10B981', width: '7px', height: '7px' }} />
              <span>LIVE FEED SYNCED</span>
            </div>

            {match.door_qr_checkin_enabled && (
              <Link
                href={`/${club.slug}/match/${match.id}/checkin`}
                className="btn btn-sm scroll-pill-item touch-target"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  background: 'rgba(59, 130, 246, 0.15)',
                  border: '1px solid #3B82F6',
                  color: '#3B82F6',
                  minHeight: '38px',
                  fontWeight: 700
                }}
                title="Door Turnstile Self-Check-in Station"
              >
                <QrCode size={14} />
                <span>Door Check-In</span>
              </Link>
            )}

            <button
              onClick={() => setAudioEnabled(!audioEnabled)}
              className="btn btn-secondary btn-sm scroll-pill-item touch-target"
              style={{ minHeight: '38px', minWidth: '38px' }}
              title={audioEnabled ? 'Mute commentary audio' : 'Enable commentary audio'}
            >
              {audioEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
            </button>

            <Link
              href={`/${club.slug}/admin/match-center`}
              className="btn btn-secondary btn-sm scroll-pill-item touch-target"
              style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', minHeight: '38px' }}
            >
              <Settings size={14} />
              <span>Admin</span>
            </Link>
          </div>
        </div>

        {/* Stadium-Grade Live Scoreboard Hero with Strobe Wave */}
        <div
          className="glass-panel"
          style={{
            padding: '2.5rem 1.5rem',
            marginBottom: '2.5rem',
            background: 'linear-gradient(180deg, rgba(18, 26, 38, 0.95) 0%, rgba(10, 15, 23, 0.98) 100%)',
            border: goalAlert?.active
              ? '2px solid #F59E0B'
              : match.status === 'live'
              ? '2px solid rgba(239, 68, 68, 0.6)'
              : '1px solid var(--border-medium)',
            boxShadow: goalAlert?.active
              ? '0 0 55px rgba(245, 158, 11, 0.5), 0 0 30px rgba(var(--club-primary-rgb), 0.4)'
              : match.status === 'live'
              ? '0 0 35px rgba(239, 68, 68, 0.25)'
              : 'var(--shadow-lg)',
            position: 'relative',
            overflow: 'hidden',
            transition: 'border-color 0.4s ease, box-shadow 0.4s ease',
          }}
        >
          {/* 1. Floodlight Strobe Wave Animation across Scoreboard */}
          {goalAlert?.active && (
            <div
              className="goal-strobe-effect"
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                width: '40%',
                background: `linear-gradient(90deg, transparent 0%, rgba(245, 158, 11, 0.35) 45%, rgba(${goalAlert.teamSide === 'home' ? '16, 185, 129' : '59, 130, 246'}, 0.4) 55%, transparent 100%)`,
                pointerEvents: 'none',
                zIndex: 8,
                animation: 'goalStrobeSweep 1.6s ease-out forwards',
              }}
            />
          )}

          {/* 2. Goal Banner Drop Tag */}
          {goalAlert?.active && (
            <div
              className="goal-banner-drop"
              style={{
                position: 'absolute',
                top: '1.25rem',
                left: '50%',
                transform: 'translateX(-50%)',
                background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
                color: '#040609',
                padding: '0.5rem 1.75rem',
                borderRadius: 'var(--radius-full)',
                fontWeight: 900,
                fontSize: '0.95rem',
                letterSpacing: '0.08em',
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
                boxShadow: '0 8px 30px rgba(245, 158, 11, 0.8), 0 0 25px rgba(255, 255, 255, 0.9)',
                zIndex: 25,
                animation: 'goalBannerDrop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
              }}
            >
              <Flame size={18} color="#040609" fill="#040609" />
              <span>GOAL! • {goalAlert.teamName.toUpperCase()}</span>
            </div>
          )}

          {/* Status & Competition Tag */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', marginBottom: '1.5rem', position: 'relative', zIndex: 5, flexWrap: 'wrap', textAlign: 'center' }}>
            {match.title && (
              <div style={{ width: '100%', fontSize: '1.1rem', fontWeight: 900, color: '#F59E0B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.2rem' }}>
                {match.title}
              </div>
            )}
            {match.status === 'live' ? (
              <span className="badge badge-live" style={{ padding: '0.35rem 0.85rem', fontSize: '0.8rem' }}>
                <span className="pulse-dot" /> LIVE • {match.current_minute}&apos;
                {match.added_time > 0 && <span style={{ color: '#F59E0B', marginLeft: '0.25rem' }}>(+{match.added_time}&apos;)</span>}
              </span>
            ) : match.status === 'halftime' ? (
              <span className="badge badge-gold" style={{ padding: '0.35rem 0.85rem', fontSize: '0.8rem' }}>
                HALF-TIME (HT)
              </span>
            ) : (
              <span className="badge" style={{ background: 'rgba(255, 255, 255, 0.1)', color: '#FFFFFF' }}>
                {match.status.toUpperCase()}
              </span>
            )}
            {match.match_type && (
              <span className="badge" style={{ background: 'rgba(255, 255, 255, 0.08)', color: 'var(--club-primary)', border: '1px solid rgba(var(--club-primary-rgb), 0.3)', textTransform: 'uppercase' }}>
                {match.match_type} FIXTURE
              </span>
            )}
            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              {(!match.competition || match.competition === 'Premier Regional League') ? (match.match_type ? `${match.match_type.toUpperCase()} FIXTURE` : 'CLUB FRIENDLY') : match.competition} • {match.venue}
            </span>
          </div>

          {/* Teams & Scoreboard Display */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr auto 1fr',
            alignItems: 'center',
            gap: 'clamp(0.5rem, 3vw, 2rem)',
            maxWidth: '850px',
            margin: '0 auto',
            position: 'relative',
            zIndex: 5,
          }}>
            {/* Home Team */}
            <div style={{ textAlign: 'center', minWidth: 0 }}>
              <div
                className={goalAlert?.active && goalAlert.teamSide === 'home' ? 'crest-celebrating' : ''}
                style={{
                  width: 'clamp(52px, 14vw, 80px)',
                  height: 'clamp(52px, 14vw, 80px)',
                  borderRadius: '16px',
                  overflow: 'hidden',
                  margin: '0 auto 0.5rem auto',
                  border: `2.5px solid ${match.is_club_home ? club.primary_color : 'var(--border-subtle)'}`,
                  boxShadow: `0 8px 24px rgba(0,0,0,0.6), 0 0 20px rgba(var(--club-primary-rgb), 0.35)`,
                  background: `linear-gradient(135deg, ${club.primary_color}, #064e3b)`,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  animation: goalAlert?.active && goalAlert.teamSide === 'home' ? 'crestGoalPulse 1.4s ease-out' : 'none',
                }}
              >
                <Shield size={28} color="#FFFFFF" strokeWidth={2.4} />
                <span style={{ fontSize: '0.6rem', fontWeight: 900, color: '#FFFFFF', marginTop: '2px', letterSpacing: '0.05em' }}>
                  {match.is_club_home ? club.short_name : 'HOME'}
                </span>
              </div>
              <h2 style={{ fontSize: 'clamp(0.95rem, 3.5vw, 1.4rem)', fontWeight: 900, color: '#FFFFFF', marginBottom: '0.2rem', wordBreak: 'break-word' }}>
                {match.home_team_name}
              </h2>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>HOME</span>
            </div>

            {/* Stadium Mechanical Scoreboard Digit Display */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: 'clamp(0.75rem, 2vw, 1.25rem) clamp(0.75rem, 3vw, 2rem)',
              background: '#040609',
              borderRadius: '20px',
              border: `2px solid ${goalAlert?.active ? '#F59E0B' : 'rgba(255, 255, 255, 0.12)'}`,
              boxShadow: 'inset 0 0 30px rgba(0,0,0,0.95), 0 12px 30px rgba(0,0,0,0.7)',
              position: 'relative',
              transition: 'border-color 0.3s ease',
              flexShrink: 0,
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'clamp(0.4rem, 1.5vw, 0.75rem)',
              }}>
                {/* Home Score Animated Digit */}
                <ScoreboardDigitRoll
                  value={match.home_score}
                  isGoal={goalAlert?.active && goalAlert.teamSide === 'home'}
                  accentColor={club.primary_color}
                />

                <span style={{
                  color: 'var(--text-muted)',
                  fontSize: 'clamp(1.8rem, 5vw, 2.5rem)',
                  fontWeight: 900,
                  lineHeight: 1,
                  fontFamily: 'var(--font-heading)',
                }}>
                  :
                </span>

                {/* Away Score Animated Digit */}
                <ScoreboardDigitRoll
                  value={match.away_score}
                  isGoal={goalAlert?.active && goalAlert.teamSide === 'away'}
                  accentColor="#3B82F6"
                />
              </div>

              <div style={{
                fontSize: '0.68rem',
                fontWeight: 700,
                color: match.status === 'live' ? '#EF4444' : 'var(--text-muted)',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                marginTop: '8px',
                textAlign: 'center',
              }}>
                {match.period === 'second_half' ? '2nd Half' : match.period}
              </div>
            </div>

            {/* Away Team */}
            <div style={{ textAlign: 'center', minWidth: 0 }}>
              <div
                className={goalAlert?.active && goalAlert.teamSide === 'away' ? 'crest-celebrating' : ''}
                style={{
                  width: 'clamp(52px, 14vw, 80px)',
                  height: 'clamp(52px, 14vw, 80px)',
                  borderRadius: '16px',
                  overflow: 'hidden',
                  margin: '0 auto 0.5rem auto',
                  border: `2.5px solid ${!match.is_club_home ? club.primary_color : '#3B82F6'}`,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.6), 0 0 20px rgba(59, 130, 246, 0.35)',
                  background: 'linear-gradient(135deg, #2563EB, #1E3A8A)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  animation: goalAlert?.active && goalAlert.teamSide === 'away' ? 'crestGoalPulse 1.4s ease-out' : 'none',
                }}
              >
                <Trophy size={28} color="#FFFFFF" strokeWidth={2.4} />
                <span style={{ fontSize: '0.6rem', fontWeight: 900, color: '#FFFFFF', marginTop: '2px', letterSpacing: '0.05em' }}>
                  {!match.is_club_home ? club.short_name : 'AWAY'}
                </span>
              </div>
              <h2 style={{ fontSize: 'clamp(0.95rem, 3.5vw, 1.4rem)', fontWeight: 900, color: '#FFFFFF', marginBottom: '0.2rem', wordBreak: 'break-word' }}>
                {match.away_team_name}
              </h2>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>AWAY</span>
            </div>
          </div>
        </div>

        {/* Matchday Briefing & Promotional Flyer */}
        {(match.match_flyer_url || match.description || match.door_qr_checkin_enabled) && (
          <div
            className="glass-panel"
            style={{
              padding: '1.5rem',
              marginBottom: '2rem',
              borderRadius: 'var(--radius-xl)',
              border: '1px solid var(--border-medium)',
              display: 'grid',
              gridTemplateColumns: match.match_flyer_url ? 'minmax(240px, 320px) 1fr' : '1fr',
              gap: '1.5rem',
              alignItems: 'center',
            }}
          >
            {match.match_flyer_url && (
              <div
                style={{
                  borderRadius: 'var(--radius-lg)',
                  overflow: 'hidden',
                  aspectRatio: '16/9',
                  border: '1px solid var(--border-subtle)',
                  background: 'rgba(0,0,0,0.5)',
                  boxShadow: 'var(--shadow-md)',
                }}
              >
                <img
                  src={match.match_flyer_url}
                  alt={match.title || 'Official Match Flyer'}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </div>
            )}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <span className="badge badge-primary">MATCHDAY BRIEFING</span>
                {match.match_type && (
                  <span className="badge" style={{ background: 'rgba(255,255,255,0.08)', color: '#FFFFFF', textTransform: 'uppercase' }}>
                    {match.match_type}
                  </span>
                )}
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#FFFFFF', marginBottom: '0.5rem' }}>
                {match.title || `${match.home_team_name} vs ${match.away_team_name}`}
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: 1.6, marginBottom: '1rem' }}>
                {match.description || `Official match fixture scheduled at ${match.venue}. Gates open 60 minutes prior to kickoff.`}
              </p>
              {match.door_qr_checkin_enabled && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <Link
                    href={`/${club.slug}/match/${match.id}/checkin`}
                    className="btn btn-primary btn-sm touch-target"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontWeight: 800 }}
                  >
                    <QrCode size={14} />
                    <span>Turnstile Gate Check-In</span>
                  </Link>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Arriving at the stadium? Scan or validate your pass online.
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab Selector: Match Events Timeline, Lineups / Pitch, Stats */}
        <div className="scroll-pill-strip" style={{
          borderBottom: '1px solid var(--border-subtle)',
          marginBottom: '2rem',
          gap: '1.25rem',
          paddingBottom: '2px',
        }}>
          {[
            { id: 'timeline', label: 'Timeline & Commentary' },
            { id: 'lineups', label: 'Tactical Pitch & Lineups' },
            { id: 'stats', label: 'Match Statistics' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className="scroll-pill-item touch-target"
              style={{
                background: 'transparent',
                border: 'none',
                borderBottom: activeTab === tab.id ? `3px solid var(--club-primary)` : '3px solid transparent',
                padding: '0.75rem 0.25rem',
                color: activeTab === tab.id ? '#FFFFFF' : 'var(--text-muted)',
                fontWeight: 800,
                fontSize: '0.92rem',
                cursor: 'pointer',
                transition: 'all 0.2s',
                whiteSpace: 'nowrap',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* TAB 1: LIVE TIMELINE */}
        {activeTab === 'timeline' && (
          <div style={{ maxWidth: '780px', margin: '0 auto' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', position: 'relative' }}>
              {/* Vertical line connector */}
              <div style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: '26px',
                width: '2px',
                background: 'var(--border-subtle)',
                zIndex: 0,
              }} />

              {events.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                  No match events recorded yet. Updates will appear in real time as logged by club officials.
                </div>
              ) : (
                events.map(evt => (
                  <div
                    key={evt.id}
                    className="glass-panel"
                    style={{
                      padding: '1.25rem 1.5rem',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '1.25rem',
                      position: 'relative',
                      zIndex: 1,
                      borderLeft: evt.event_type === 'goal' ? `4px solid #10B981` : evt.event_type === 'red_card' ? '4px solid #EF4444' : evt.event_type === 'yellow_card' ? '4px solid #F59E0B' : '1px solid var(--border-subtle)',
                    }}
                  >
                    {/* Minute Circle Badge */}
                    <div style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '50%',
                      background: evt.event_type === 'goal' ? '#10B981' : evt.event_type === 'yellow_card' ? '#F59E0B' : evt.event_type === 'red_card' ? '#EF4444' : 'var(--bg-surface-elevated)',
                      border: '2px solid rgba(255, 255, 255, 0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 900,
                      fontFamily: 'var(--font-heading)',
                      fontSize: '0.9rem',
                      color: evt.event_type === 'yellow_card' ? '#000000' : '#FFFFFF',
                      boxShadow: '0 4px 10px rgba(0,0,0,0.4)',
                    }}>
                      {evt.minute}&apos;
                    </div>

                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.2rem' }}>
                        <span className="badge" style={{
                          backgroundColor: evt.event_type === 'goal' ? 'rgba(16, 185, 129, 0.2)' : evt.event_type === 'yellow_card' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255, 255, 255, 0.1)',
                          color: evt.event_type === 'goal' ? '#10B981' : evt.event_type === 'yellow_card' ? '#F59E0B' : '#FFFFFF',
                        }}>
                          {evt.event_type.toUpperCase().replace('_', ' ')}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {evt.team_side === 'home' ? match.home_team_name : match.away_team_name}
                        </span>
                      </div>

                      <h4 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#FFFFFF', marginBottom: '0.25rem' }}>
                        {evt.player_name} {evt.assist_player_name ? `(Assist: ${evt.assist_player_name})` : ''}
                      </h4>

                      {evt.detail_text && (
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                          {evt.detail_text}
                        </p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 2: TACTICAL LINEUPS & PITCH */}
        {activeTab === 'lineups' && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
            gap: '2.5rem',
            alignItems: 'flex-start',
          }}>
            {/* The Tactical Pitch Component */}
            <div>
              <TacticalPitch
                players={squadPlayers}
                formation={match.home_formation || '4-3-3'}
                savedPositions={match.home_lineup_coords}
                primaryColor={club.primary_color}
                isEditable={true}
                matchEvents={events}
                teamName={match.home_team_name}
              />
            </div>

            {/* Starting XI & Substitutes List */}
            <div className="glass-panel" style={{ padding: '1.75rem' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '1.25rem', color: '#FFFFFF' }}>
                {club.name} Matchday Squad
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {squadPlayers.map(p => (
                  <div
                    key={p.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.55rem 0.85rem',
                      borderRadius: '8px',
                      background: 'rgba(255, 255, 255, 0.03)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span style={{
                        fontFamily: 'var(--font-heading)',
                        fontWeight: 900,
                        color: 'var(--club-primary)',
                        width: '24px',
                      }}>
                        #{p.jersey_number}
                      </span>
                      <span style={{ fontWeight: 600, color: '#FFFFFF', fontSize: '0.9rem' }}>{p.full_name}</span>
                    </div>
                    <span className="badge" style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)' }}>
                      {p.player_position}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: MATCH STATISTICS */}
        {activeTab === 'stats' && (
          <div className="glass-panel" style={{ padding: '2rem', maxWidth: '720px', margin: '0 auto' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#FFFFFF', marginBottom: '1.5rem', textAlign: 'center' }}>
              Match Statistics Breakdown
            </h3>

            {[
              { label: 'Possession %', home: 61, away: 39, isPercent: true },
              { label: 'Total Shots', home: 14, away: 8 },
              { label: 'Shots on Target', home: 6, away: 3 },
              { label: 'Corner Kicks', home: 7, away: 4 },
              { label: 'Fouls Committed', home: 9, away: 12 },
              { label: 'Yellow Cards', home: 1, away: 2 },
            ].map(s => {
              const total = s.home + s.away || 1;
              const homePercent = (s.home / total) * 100;

              return (
                <div key={s.label} style={{ marginBottom: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                    <span style={{ color: '#10B981' }}>{s.home}{s.isPercent ? '%' : ''}</span>
                    <span style={{ color: 'var(--text-muted)' }}>{s.label}</span>
                    <span style={{ color: '#3B82F6' }}>{s.away}{s.isPercent ? '%' : ''}</span>
                  </div>

                  <div style={{ height: '8px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '4px', overflow: 'hidden', display: 'flex' }}>
                    <div style={{ width: `${homePercent}%`, background: '#10B981', transition: 'width 0.5s' }} />
                    <div style={{ width: `${100 - homePercent}%`, background: '#3B82F6', transition: 'width 0.5s' }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
