'use client';

import React, { useState, useEffect, useRef, useCallback, use } from 'react';
import Link from 'next/link';
import confetti from 'canvas-confetti';
import { useClub } from '@/lib/club-context';
import TacticalPitch from '@/components/TacticalPitch';
import ScoreboardDigitRoll from '@/components/ScoreboardDigitRoll';
import PlayerAvatar from '@/components/PlayerAvatar';
import { isSupabaseConfigured, getSupabaseClient } from '@/lib/supabase/client';
import { isPlayerMember } from '@/lib/supabase/types';
import { extractCrestTextColor } from '@/lib/image-color';
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
  Wifi,
  Star,
  Target
} from 'lucide-react';
import LiveMinute from '@/components/LiveMinute';

export default function MatchCenterPage({
  params,
}: {
  params: Promise<{ clubSlug: string; matchId: string }>;
}) {
  const resolvedParams = use(params);
  const { clubs, selectClubBySlug, matches, matchEvents, updateMatch, members, isHydrated, getMatchAvailabilities, activityLogs } = useClub();

  const club = selectClubBySlug(resolvedParams.clubSlug) || clubs[0];
  const match = matches.find(m => m.id === resolvedParams.matchId);
  const events = match ? matchEvents.filter(e => e.match_id === match.id).sort((a, b) => b.minute - a.minute) : [];
  const allSquadPlayers = members.filter(m => m.club_id === club.id && isPlayerMember(m));

  // Only players explicitly marked "available" for this fixture count as the matchday squad.
  // If the club never used the availability/RSVP feature for this match, fall back to the full
  // squad rather than showing an empty pitch.
  const matchAvailabilities = match ? getMatchAvailabilities(match.id) : [];
  const attendingIds = new Set(matchAvailabilities.filter(a => a.status === 'available').map(a => a.member_id));
  const squadPlayers = matchAvailabilities.length > 0
    ? allSquadPlayers.filter(p => attendingIds.has(p.id))
    : allSquadPlayers;

  // Man of the Match, resolved from the verified audit ledger for this fixture
  const motmLog = match ? activityLogs.find(l => l.event_type === 'match_motm' && l.reference_id === match.id) : undefined;
  const motmMember = motmLog ? members.find(m => m.id === motmLog.member_id) : undefined;
  const goalEvents = events.filter(e => e.event_type === 'goal' || e.event_type === 'penalty').slice().sort((a, b) => a.minute - b.minute);

  const [logoFailed, setLogoFailed] = useState({ home: false, away: false });
  const [activeTab, setActiveTab] = useState<'timeline' | 'lineups' | 'stats'>('timeline');
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [liveSyncPulse, setLiveSyncPulse] = useState(false);
  const [titleColors, setTitleColors] = useState<{ home: string; away: string }>({
    home: match?.is_club_home !== false ? (club.primary_color || '#10B981') : '#3B82F6',
    away: match?.is_club_home === false ? (club.primary_color || '#10B981') : '#3B82F6',
  });

  // Goal Strobe Alert State
  const [goalAlert, setGoalAlert] = useState<{
    active: boolean;
    teamName: string;
    teamSide: 'home' | 'away';
  } | null>(null);

  const prevHomeScoreRef = useRef(match?.home_score ?? 0);
  const prevAwayScoreRef = useRef(match?.away_score ?? 0);
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
    if (!match) return;
    if (isInitialMount.current) {
      isInitialMount.current = false;
      prevHomeScoreRef.current = match.home_score;
      prevAwayScoreRef.current = match.away_score;
      return;
    }

    if (match.home_score > prevHomeScoreRef.current) {
      triggerGoalCelebration('home', match.home_team_name);
    } else if (match.away_score > prevAwayScoreRef.current) {
      triggerGoalCelebration('away', match.away_team_name);
    }

    prevHomeScoreRef.current = match.home_score;
    prevAwayScoreRef.current = match.away_score;
  }, [match?.home_score, match?.away_score, match?.home_team_name, match?.away_team_name, triggerGoalCelebration]);

  // Real-time live synchronization: BroadcastChannel + Supabase Realtime + Live Polling Heartbeat
  useEffect(() => {
    if (!match) return;
    // 1. BroadcastChannel cross-tab synchronization
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        const channel = new BroadcastChannel('itsfootball_live_matchday');
        channel.onmessage = (e) => {
          const data = e.data;
          if (!data) return;
          if (data.matchId === match.id) {
            setLiveSyncPulse(true);
            setTimeout(() => setLiveSyncPulse(false), 2000);
            if (data.type === 'MATCH_EVENT_ADDED' && data.event) {
              if (data.event.event_type === 'goal' || data.event.event_type === 'penalty') {
                const scoringTeam = data.event.team_side === 'home' ? match.home_team_name : match.away_team_name;
                triggerGoalCelebration(data.event.team_side, scoringTeam);
              }
            }
          }
        };
        return () => {
          channel.close();
        };
      } catch {}
    }
  }, [match?.id, match?.home_team_name, match?.away_team_name, triggerGoalCelebration]);

  // Derive each team's title/scoreboard text color from its crest; falls back to the club's
  // brand color (for our own side) or a neutral blue (opponent) if the crest can't be sampled.
  useEffect(() => {
    if (!match) return;
    let cancelled = false;
    const homeLogo = match.home_team_logo || (match.is_club_home ? club.logo_url : undefined);
    const awayLogo = match.away_team_logo || (!match.is_club_home ? club.logo_url : undefined);
    extractCrestTextColor(homeLogo).then(c => { if (!cancelled && c) setTitleColors(prev => ({ ...prev, home: c })); });
    extractCrestTextColor(awayLogo).then(c => { if (!cancelled && c) setTitleColors(prev => ({ ...prev, away: c })); });
    return () => { cancelled = true; };
  }, [match?.id, match?.home_team_logo, match?.away_team_logo, match?.is_club_home, club.logo_url]);

  if (!isHydrated) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-pitch)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#FFFFFF', padding: '2rem' }}>
        <div style={{
          width: '50px',
          height: '50px',
          borderRadius: '50%',
          border: '3px solid rgba(255,255,255,0.1)',
          borderTopColor: '#10B981',
          animation: 'spin 0.8s linear infinite',
          marginBottom: '1rem',
        }} />
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Loading match fixture...</p>
      </div>
    );
  }

  if (!match) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-pitch)', color: '#FFFFFF', padding: '6rem 1.5rem', textAlign: 'center' }}>
        <Shield size={48} style={{ opacity: 0.3, margin: '0 auto 1.25rem auto' }} />
        <h2 style={{ fontSize: '1.8rem', fontWeight: 900, marginBottom: '0.5rem' }}>Match Fixture Not Found</h2>
        <p style={{ color: 'var(--text-secondary)', maxWidth: '420px', margin: '0 auto 1.5rem auto', fontSize: '0.9rem' }}>
          The requested fixture does not exist or may have been rescheduled.
        </p>
        <Link href={`/${club.slug}`} className="btn btn-primary">
          Return to Club Headquarters
        </Link>
      </div>
    );
  }

  // Short team names for narrow screens: the club's / opponent's own short name, else initials
  const abbreviate = (name: string) => {
    const words = (name || '').trim().split(/\s+/).filter(Boolean);
    if (words.length > 1) return words.map(w => w[0]).join('').slice(0, 4);
    return (words[0] || '').slice(0, 4);
  };
  const shortTeamName = (side: 'home' | 'away') => {
    const isClubSide = side === 'home' ? match.is_club_home : !match.is_club_home;
    const explicit = isClubSide ? club.short_name : match.opponent_short_name;
    return (explicit || abbreviate(side === 'home' ? match.home_team_name : match.away_team_name)).toUpperCase();
  };
  const homeShort = shortTeamName('home');
  const awayShort = shortTeamName('away');
  const titleIsTeams = match.title === `${match.home_team_name} vs ${match.away_team_name}`;

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
              <div style={{ width: '100%', fontSize: 'clamp(0.95rem, 4vw, 1.1rem)', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.2rem', overflowWrap: 'anywhere' }}>
                {titleIsTeams ? (
                  <>
                    <span className="team-name-full">
                      <span style={{ color: titleColors.home }}>{match.home_team_name}</span>
                      <span style={{ color: 'var(--text-muted)' }}> vs </span>
                      <span style={{ color: titleColors.away }}>{match.away_team_name}</span>
                    </span>
                    <span className="team-name-short">
                      <span style={{ color: titleColors.home }}>{homeShort}</span>
                      <span style={{ color: 'var(--text-muted)' }}> vs </span>
                      <span style={{ color: titleColors.away }}>{awayShort}</span>
                    </span>
                  </>
                ) : (
                  <span style={{ color: '#F59E0B' }}>{match.title}</span>
                )}
              </div>
            )}
            {match.status === 'live' ? (
              <span className="badge badge-live" style={{ padding: '0.35rem 0.85rem', fontSize: '0.8rem' }}>
                <span className="pulse-dot" /> {match.is_paused ? 'PAUSED' : 'LIVE'} • <LiveMinute match={match} />&apos;
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
            <span style={{ width: '100%', color: 'var(--text-muted)', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
              <Calendar size={12} />
              {new Date(match.match_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
              {match.match_time && (
                <>
                  <Clock size={12} style={{ marginLeft: '0.2rem' }} />
                  {match.match_time}
                </>
              )}
            </span>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              {(!match.competition || match.competition === 'Premier Regional League') ? (match.match_type ? `${match.match_type.toUpperCase()} FIXTURE` : 'CLUB FRIENDLY') : match.competition} • {match.venue}
            </span>
          </div>

          {/* Teams & Scoreboard Display */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) auto minmax(0, 1fr)',
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
                  padding: '6px',
                  animation: goalAlert?.active && goalAlert.teamSide === 'home' ? 'crestGoalPulse 1.4s ease-out' : 'none',
                }}
              >
                {match.home_team_logo && !logoFailed.home ? (
                  <img
                    src={match.home_team_logo}
                    alt={match.home_team_name}
                    onError={() => setLogoFailed(prev => ({ ...prev, home: true }))}
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  />
                ) : match.is_club_home && club.logo_url ? (
                  <img
                    src={club.logo_url}
                    alt={match.home_team_name}
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  />
                ) : (
                  <>
                    <Shield size={28} color="#FFFFFF" strokeWidth={2.4} />
                    <span style={{ fontSize: '0.6rem', fontWeight: 900, color: '#FFFFFF', marginTop: '2px', letterSpacing: '0.05em' }}>
                      {match.home_team_name ? match.home_team_name.slice(0, 3).toUpperCase() : 'HOM'}
                    </span>
                  </>
                )}
              </div>
              <h2 className="scoreboard-team-name" title={match.home_team_name} style={{ fontSize: 'clamp(0.95rem, 3.5vw, 1.4rem)', fontWeight: 900, color: '#FFFFFF', marginBottom: '0.2rem', overflowWrap: 'anywhere' }}>
                <span className="team-name-full">{match.home_team_name}</span>
                <span className="team-name-short">{homeShort}</span>
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
                  padding: '6px',
                  animation: goalAlert?.active && goalAlert.teamSide === 'away' ? 'crestGoalPulse 1.4s ease-out' : 'none',
                }}
              >
                {match.away_team_logo && !logoFailed.away ? (
                  <img
                    src={match.away_team_logo}
                    alt={match.away_team_name}
                    onError={() => setLogoFailed(prev => ({ ...prev, away: true }))}
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  />
                ) : !match.is_club_home && club.logo_url ? (
                  <img
                    src={club.logo_url}
                    alt={match.away_team_name}
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  />
                ) : (
                  <>
                    <Trophy size={28} color="#FFFFFF" strokeWidth={2.4} />
                    <span style={{ fontSize: '0.6rem', fontWeight: 900, color: '#FFFFFF', marginTop: '2px', letterSpacing: '0.05em' }}>
                      {match.away_team_name ? match.away_team_name.slice(0, 3).toUpperCase() : 'AWY'}
                    </span>
                  </>
                )}
              </div>
              <h2 className="scoreboard-team-name" title={match.away_team_name} style={{ fontSize: 'clamp(0.95rem, 3.5vw, 1.4rem)', fontWeight: 900, color: '#FFFFFF', marginBottom: '0.2rem', overflowWrap: 'anywhere' }}>
                <span className="team-name-full">{match.away_team_name}</span>
                <span className="team-name-short">{awayShort}</span>
              </h2>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>AWAY</span>
            </div>
          </div>
        </div>

        {/* Player of the Match & Goal Scorers */}
        {(motmMember || goalEvents.length > 0) && (
          <div
            className="glass-panel"
            style={{
              padding: '1.5rem',
              marginBottom: '2rem',
              borderRadius: 'var(--radius-xl)',
              border: '1px solid var(--border-medium)',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '1.5rem',
            }}
          >
            {motmMember && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flex: '1 1 220px' }}>
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <PlayerAvatar photoUrl={motmMember.photo_url} name={motmMember.full_name} size={44} />
                  <div style={{
                    position: 'absolute',
                    bottom: '-4px',
                    right: '-4px',
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
                    border: '2px solid #0A0F17',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <Star size={11} color="#040609" fill="#040609" />
                  </div>
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#F59E0B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Player of the Match
                  </div>
                  <div style={{ fontSize: '1rem', fontWeight: 800, color: '#FFFFFF', overflowWrap: 'anywhere' }}>
                    {motmMember.full_name}
                    {motmMember.jersey_number ? ` (#${motmMember.jersey_number})` : ''}
                  </div>
                </div>
              </div>
            )}

            {goalEvents.length > 0 && (
              <div style={{ flex: '2 1 320px', minWidth: 0 }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Target size={13} />
                  <span>Goal Scorers</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  {goalEvents.map(evt => (
                    <div key={evt.id} style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', fontSize: '0.85rem' }}>
                      <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>{evt.minute}&apos;</span>
                      <span style={{ color: '#FFFFFF', fontWeight: 700 }}>
                        {evt.player_name}{evt.event_type === 'penalty' ? ' (pen.)' : ''}
                      </span>
                      {evt.assist_player_name && (
                        <span style={{ color: 'var(--text-secondary)' }}>(Assist: {evt.assist_player_name})</span>
                      )}
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                        {evt.team_side === 'home' ? match.home_team_name : match.away_team_name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Matchday Briefing & Promotional Flyer */}
        {(match.match_flyer_url || match.description) && (
          <div
            className={`glass-panel match-briefing-grid${match.match_flyer_url ? ' has-flyer' : ''}`}
            style={{
              marginBottom: '2rem',
              borderRadius: 'var(--radius-xl)',
              border: '1px solid var(--border-medium)',
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
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <span className="badge badge-primary">MATCHDAY BRIEFING</span>
                {match.match_type && (
                  <span className="badge" style={{ background: 'rgba(255,255,255,0.08)', color: '#FFFFFF', textTransform: 'uppercase' }}>
                    {match.match_type}
                  </span>
                )}
              </div>
              <h3 style={{ fontSize: 'clamp(1.05rem, 4.5vw, 1.25rem)', fontWeight: 900, color: '#FFFFFF', marginBottom: '0.5rem', overflowWrap: 'anywhere' }}>
                {match.title || `${match.home_team_name} vs ${match.away_team_name}`}
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: 1.6, marginBottom: '1rem' }}>
                {match.description || `Official match fixture scheduled at ${match.venue}. Gates open 60 minutes prior to kickoff.`}
              </p>
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
            display: 'flex',
            flexDirection: 'column',
            gap: '2rem',
          }}>
            {/* The Tactical Pitch Component */}
            <div>
              <TacticalPitch
                players={squadPlayers}
                formation={match.home_formation || '4-3-3'}
                savedPositions={match.home_lineup_coords}
                primaryColor={club.primary_color}
                isEditable={false}
                allowOrientationToggle={true}
                showFormationControls={false}
                matchEvents={events}
                teamName={match.is_club_home ? match.home_team_name : match.away_team_name}
              />
            </div>

            {/* Starting XI & Substitutes List */}
            <div className="glass-panel" style={{ padding: '1.75rem' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '1.25rem', color: '#FFFFFF' }}>
                {club.name} Matchday Squad
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {squadPlayers.length === 0 && (
                  <p style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    No confirmed matchday squad yet.
                  </p>
                )}
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
                      <PlayerAvatar photoUrl={p.photo_url} name={p.full_name} size={32} />
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
        {activeTab === 'stats' && (() => {
          // Derive real stats from the logged event array
          const homeGoals = match.home_score;
          const awayGoals = match.away_score;
          const homeYellows = events.filter(e => e.event_type === 'yellow_card' && e.team_side === 'home').length;
          const awayYellows = events.filter(e => e.event_type === 'yellow_card' && e.team_side === 'away').length;
          const homeReds = events.filter(e => e.event_type === 'red_card' && e.team_side === 'home').length;
          const awayReds = events.filter(e => e.event_type === 'red_card' && e.team_side === 'away').length;
          const homeSubs = events.filter(e => e.event_type === 'sub' && e.team_side === 'home').length;
          const awaySubs = events.filter(e => e.event_type === 'sub' && e.team_side === 'away').length;

          const trackedStats = [
            { label: 'Goals Scored', home: homeGoals, away: awayGoals },
            { label: 'Yellow Cards', home: homeYellows, away: awayYellows },
            { label: 'Red Cards', home: homeReds, away: awayReds },
            { label: 'Substitutions', home: homeSubs, away: awaySubs },
          ];

          return (
            <div className="glass-panel" style={{ padding: '2rem', maxWidth: '720px', margin: '0 auto' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#FFFFFF', marginBottom: '0.5rem', textAlign: 'center' }}>
                Match Statistics
              </h3>
              <p style={{ textAlign: 'center', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '1.75rem' }}>
                Live-tracked from the official event log
              </p>

              {/* Home vs Away header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.25rem', padding: '0 0.25rem' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#10B981', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {match.home_team_name}
                </span>
                <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#3B82F6', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {match.away_team_name}
                </span>
              </div>

              {trackedStats.map(s => {
                const total = s.home + s.away || 1;
                const homePercent = (s.home / total) * 100;

                return (
                  <div key={s.label} style={{ marginBottom: '1.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                      <span style={{ color: '#10B981', minWidth: '24px' }}>{s.home}</span>
                      <span style={{ color: 'var(--text-muted)' }}>{s.label}</span>
                      <span style={{ color: '#3B82F6', minWidth: '24px', textAlign: 'right' }}>{s.away}</span>
                    </div>
                    <div style={{ height: '8px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '4px', overflow: 'hidden', display: 'flex' }}>
                      <div style={{ width: `${homePercent}%`, background: '#10B981', transition: 'width 0.6s ease' }} />
                      <div style={{ width: `${100 - homePercent}%`, background: '#3B82F6', transition: 'width 0.6s ease' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}

        {/* Turnstile Gate Self Check-In */}
        {match.door_qr_checkin_enabled && (
          <div
            className="glass-panel"
            style={{
              marginTop: '2.5rem',
              padding: '1.75rem',
              borderRadius: 'var(--radius-xl)',
              border: '1px solid var(--border-medium)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ minWidth: 0 }}>
              <span className="badge badge-primary" style={{ marginBottom: '0.4rem' }}>TURNSTILE GATE CHECK-IN</span>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
                Arriving at the stadium? Scan or validate your pass online for a faster entry.
              </p>
            </div>
            <Link
              href={`/${club.slug}/match/${match.id}/checkin`}
              className="btn btn-primary btn-sm touch-target"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontWeight: 800, flexShrink: 0 }}
            >
              <QrCode size={14} />
              <span>Turnstile Gate Check-In</span>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
