'use client';

import React, { useState, useEffect, useRef, useCallback, use } from 'react';
import dynamic from 'next/dynamic';
import LocalTime from '@/components/LocalTime';
import Link from 'next/link';
import { useClub } from '@/lib/club-context';
import { useAuth } from '@/lib/auth-context';
import ScoreboardDigitRoll from '@/components/ScoreboardDigitRoll';
import PlayerAvatar from '@/components/PlayerAvatar';
import SponsorMarquee from '@/components/SponsorMarquee';
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
import MatchShareButton from '@/components/MatchShareButton';
import { periodLabel } from '@/lib/match-clock';
import { OPPONENT_COLOR, clubLineupSide, clubSidePlayers, sideColor, sideShortName } from '@/lib/tournament-engine';

// Only needed once the lineups tab opens
const TacticalPitch = dynamic(() => import('@/components/TacticalPitch'), {
  loading: () => <p className="text-note" style={{ textAlign: 'center', padding: '2rem' }}>Loading pitch…</p>,
});

type Side = 'home' | 'away';

export default function MatchCenterPage({
  params,
}: {
  params: Promise<{ clubSlug: string; matchId: string }>;
}) {
  const resolvedParams = use(params);
  const { selectClubBySlug, matches, matchEvents, members, isHydrated, syncStatus, getMatchAvailabilities, activityLogs, sponsors, tournamentParticipants, internalTeams } = useClub();

  // No fallback to another club, and only this club's own fixtures: a match cached from another
  // club's site must not show under this club's name
  const club = selectClubBySlug(resolvedParams.clubSlug);

  // Same rule as AdminGuard, so the shortcut only appears for people who can actually open the admin area
  const { user, hasClubAdminAccess } = useAuth();
  const isClubAdmin = !!club && !!user && (hasClubAdminAccess(club.id) || (!!club.owner_id && club.owner_id === user.id));
  const match = club ? matches.find(m => m.id === resolvedParams.matchId && m.club_id === club.id) : undefined;
  const events = match ? matchEvents.filter(e => e.match_id === match.id).sort((a, b) => b.minute - a.minute) : [];
  const allSquadPlayers = club ? members.filter(m => m.club_id === club.id && isPlayerMember(m)) : [];

  // Only players explicitly marked "available" for this fixture are shown as the matchday squad
  const matchAvailabilities = match ? getMatchAvailabilities(match.id) : [];
  const attendingIds = new Set(matchAvailabilities.filter(a => a.status === 'available').map(a => a.member_id));
  const squadPlayers = allSquadPlayers.filter(p => attendingIds.has(p.id));

  // Club-wide partners (event-scoped sponsors belong to their event's page)
  const matchSponsors = club ? sponsors.filter(s => s.club_id === club.id && !s.event_id && s.is_active) : [];

  // Man of the Match, resolved from the verified audit ledger for this fixture
  const motmLog = match ? activityLogs.find(l => l.event_type === 'match_motm' && l.reference_id === match.id) : undefined;
  const motmMember = motmLog ? members.find(m => m.id === motmLog.member_id) : undefined;
  const goalEvents = events.filter(e => e.event_type === 'goal' || e.event_type === 'penalty').slice().sort((a, b) => a.minute - b.minute);

  // Each side's color: the club's goes to the club's own side, not simply to "home"
  const clubColor = club?.primary_color || '#10B981';
  const homeColor = match ? sideColor(match, 'home', clubColor, tournamentParticipants, internalTeams) : clubColor;
  const awayColor = match ? sideColor(match, 'away', clubColor, tournamentParticipants, internalTeams) : OPPONENT_COLOR;
  const isLive = match?.status === 'live' || match?.status === 'halftime';
  // Tournament fixtures store is_club_home = true for every match, so neither side is "the club" there
  const isClubSide = (side: Side) => !!match && !match.tournament_id && (side === 'home') === (match.is_club_home ?? true);

  const [logoFailed, setLogoFailed] = useState({ home: false, away: false });
  const [activeTab, setActiveTab] = useState<'timeline' | 'lineups' | 'stats'>('timeline');
  // Off until the visitor turns it on: browsers only let a click start audio, so "on" by default would be silent
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [liveSyncPulse, setLiveSyncPulse] = useState(false);
  const [titleColors, setTitleColors] = useState<{ home: string; away: string }>({ home: homeColor, away: awayColor });

  // Goal Strobe Alert State
  const [goalAlert, setGoalAlert] = useState<{
    active: boolean;
    teamName: string;
    teamSide: Side;
  } | null>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const goalQueueRef = useRef<{ side: Side; teamName: string }[]>([]);
  const goalTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevScoresRef = useRef<{ id: string; home: number; away: number } | null>(null);

  // One AudioContext for the page, started by the click that turns sound on and suspended when muted
  const toggleAudio = () => {
    const next = !audioEnabled;
    setAudioEnabled(next);
    try {
      if (next && !audioCtxRef.current) {
        const Ctx = window.AudioContext || (window as any).webkitAudioContext;
        if (Ctx) audioCtxRef.current = new Ctx();
      }
      if (next) audioCtxRef.current?.resume();
      else audioCtxRef.current?.suspend();
    } catch {
      // Audio unavailable: the page works silently
    }
  };

  useEffect(() => () => {
    audioCtxRef.current?.close();
    if (goalTimerRef.current) clearTimeout(goalTimerRef.current);
  }, []);

  // Synthesized stadium goal chime, only while sound is switched on
  const playGoalAudio = useCallback(() => {
    const ctx = audioCtxRef.current;
    if (!ctx || ctx.state !== 'running') return;
    try {
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
      // Graceful silence if audio is blocked
    }
  }, []);

  // Goals celebrate one at a time (Confetti, Strobe Wave, Crest Glow, Chime), each for its full 3.2s
  const showNextGoal = useCallback(function next() {
    const goal = goalQueueRef.current.shift();
    if (!goal) {
      goalTimerRef.current = null;
      setGoalAlert(null);
      return;
    }
    setGoalAlert({ active: true, teamName: goal.teamName, teamSide: goal.side });
    playGoalAudio();
    const color = goal.side === 'home' ? homeColor : awayColor;
    import('canvas-confetti')
      .then(({ default: confetti }) => confetti({
        particleCount: 65,
        spread: 80,
        origin: { y: 0.35 },
        colors: [color, '#F59E0B', '#FFFFFF'],
        disableForReducedMotion: true,
      }))
      .catch(() => {});
    goalTimerRef.current = setTimeout(next, 3200);
  }, [playGoalAudio, homeColor, awayColor]);

  // Celebrate each goal as the live score moves, for both sides. Only during play, so a stale cached
  // score being corrected after the page loads isn't mistaken for a goal.
  useEffect(() => {
    if (!match) return;
    const prev = prevScoresRef.current;
    prevScoresRef.current = { id: match.id, home: match.home_score, away: match.away_score };
    if (!prev || prev.id !== match.id || !isLive) return;
    for (let i = prev.home; i < match.home_score; i++) goalQueueRef.current.push({ side: 'home', teamName: match.home_team_name });
    for (let i = prev.away; i < match.away_score; i++) goalQueueRef.current.push({ side: 'away', teamName: match.away_team_name });
    if (!goalTimerRef.current) showNextGoal();
  }, [match?.id, match?.home_score, match?.away_score, match?.home_team_name, match?.away_team_name, isLive, showNextGoal]);

  // Cross-tab pulse for the live badge. Goals themselves come from the score above, so a goal logged
  // in another tab isn't celebrated twice (once from the message, again when the score arrives).
  useEffect(() => {
    if (!match?.id || typeof window === 'undefined' || !('BroadcastChannel' in window)) return;
    const matchId = match.id;
    let pulseTimer: ReturnType<typeof setTimeout> | undefined;
    const channel = new BroadcastChannel('itsfootball_live_matchday');
    channel.onmessage = e => {
      if (e.data?.matchId !== matchId) return;
      setLiveSyncPulse(true);
      clearTimeout(pulseTimer);
      pulseTimer = setTimeout(() => setLiveSyncPulse(false), 2000);
    };
    return () => {
      channel.close();
      clearTimeout(pulseTimer);
    };
  }, [match?.id]);

  // Derive each team's title/scoreboard text color from its crest; falls back to that side's color
  // if the crest can't be sampled.
  useEffect(() => {
    if (!match) return;
    let cancelled = false;
    const homeLogo = match.home_team_logo || (isClubSide('home') ? club?.logo_url : undefined);
    const awayLogo = match.away_team_logo || (isClubSide('away') ? club?.logo_url : undefined);
    extractCrestTextColor(homeLogo).then(c => { if (!cancelled && c) setTitleColors(prev => ({ ...prev, home: c })); });
    extractCrestTextColor(awayLogo).then(c => { if (!cancelled && c) setTitleColors(prev => ({ ...prev, away: c })); });
    return () => { cancelled = true; };
  }, [match?.id, match?.home_team_logo, match?.away_team_logo, match?.is_club_home, match?.tournament_id, club?.logo_url]);

  // The server already has the club's public data, so the page renders straight into the first HTML.
  // Without the fixture yet, wait for the browser's own load before calling it missing.
  if (!club || !match) {
    if (!isHydrated || syncStatus.phase === 'loading') {
      return (
        <div style={{ minHeight: '100dvh', background: 'var(--bg-pitch)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-primary)', padding: '2rem' }}>
          <div style={{
            width: '50px',
            height: '50px',
            borderRadius: '50%',
            border: '3px solid rgba(var(--tint-rgb), 0.1)',
            borderTopColor: '#10B981',
            animation: 'spin 0.8s linear infinite',
            marginBottom: '1rem',
          }} />
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Loading match fixture...</p>
        </div>
      );
    }
    return (
      <div style={{ minHeight: '100dvh', background: 'var(--bg-pitch)', color: 'var(--text-primary)', padding: '6rem 1.5rem', textAlign: 'center' }}>
        <Shield size={48} style={{ opacity: 0.3, margin: '0 auto 1.25rem auto' }} />
        <h2 style={{ fontSize: '1.8rem', fontWeight: 900, marginBottom: '0.5rem' }}>Match Fixture Not Found</h2>
        <p style={{ color: 'var(--text-secondary)', maxWidth: '420px', margin: '0 auto 1.5rem auto', fontSize: '0.9rem' }}>
          The requested fixture does not exist or may have been rescheduled.
        </p>
        <Link href={club ? `/${club.slug}` : '/'} className="btn btn-primary">
          Return to Club Headquarters
        </Link>
      </div>
    );
  }

  // Short team names for narrow screens
  const homeShort = sideShortName(match, 'home', club.short_name, tournamentParticipants);
  const awayShort = sideShortName(match, 'away', club.short_name, tournamentParticipants);
  const titleIsTeams = match.title === `${match.home_team_name} vs ${match.away_team_name}`;
  // Door check-in is for arriving spectators, so it goes once the match is over
  const checkInOpen = match.door_qr_checkin_enabled && ['upcoming', 'live', 'halftime'].includes(match.status);

  // Lineups for each side that fields the club's own players: the club's side in a league fixture,
  // both internal teams in a tournament. Tournament teams without availability use their roster.
  const lineupSquad = match.tournament_id && attendingIds.size === 0 ? allSquadPlayers : squadPlayers;
  const lineupSides = (match.tournament_id ? ['home', 'away'] as Side[] : [clubLineupSide(match)])
    .map(side => ({
      side,
      teamName: side === 'home' ? match.home_team_name : match.away_team_name,
      color: side === 'home' ? homeColor : awayColor,
      players: clubSidePlayers(match, side, lineupSquad, tournamentParticipants, internalTeams),
    }))
    .filter((s): s is typeof s & { players: NonNullable<typeof s.players> } => s.players !== null);

  // One team's crest and name. The club's crest only stands in on the club's own side.
  const teamBlock = (side: Side) => {
    const name = side === 'home' ? match.home_team_name : match.away_team_name;
    const logo = side === 'home' ? match.home_team_logo : match.away_team_logo;
    const color = side === 'home' ? homeColor : awayColor;
    const celebrating = !!goalAlert?.active && goalAlert.teamSide === side;
    const crest = logo && !logoFailed[side] ? logo : isClubSide(side) ? club.logo_url : undefined;
    const FallbackIcon = side === 'home' ? Shield : Trophy;
    const markFailed = () => setLogoFailed(prev => (prev[side] ? prev : { ...prev, [side]: true }));
    return (
      <div style={{ textAlign: 'center', minWidth: 0 }}>
        <div
          className={celebrating ? 'crest-celebrating' : ''}
          style={{
            width: 'clamp(44px, 12vw, 80px)',
            height: 'clamp(44px, 12vw, 80px)',
            borderRadius: '16px',
            overflow: 'hidden',
            margin: '0 auto 0.5rem auto',
            border: `2.5px solid ${color}`,
            boxShadow: `0 8px 24px rgba(0,0,0,0.6), 0 0 20px color-mix(in srgb, ${color} 35%, transparent)`,
            background: `linear-gradient(135deg, ${color}, color-mix(in srgb, ${color} 35%, #000))`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '6px',
            animation: celebrating ? 'crestGoalPulse 1.4s ease-out' : 'none',
          }}
        >
          {crest ? (
            <img loading="eager" decoding="async"
              src={crest}
              alt={`${name} crest`}
              onError={crest === logo ? markFailed : undefined}
              // A server-rendered image can fail before React attaches onError, so check it on mount too
              ref={el => { if (crest === logo && el?.complete) el.decode().catch(markFailed); }}
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
          ) : (
            <>
              <FallbackIcon size={20} color="#FFFFFF" strokeWidth={2.4} aria-hidden="true" />
              <span style={{ fontSize: '0.62rem', fontWeight: 900, color: '#FFFFFF', marginTop: '2px', letterSpacing: '0.05em' }}>
                {(side === 'home' ? homeShort : awayShort).slice(0, 4)}
              </span>
            </>
          )}
        </div>
        <h2 className="scoreboard-team-name" title={name} style={{ fontSize: 'clamp(0.95rem, 3.5vw, 1.4rem)', fontWeight: 900, color: 'var(--text-primary)', marginBottom: '0.2rem', overflowWrap: 'anywhere' }}>
          <span className="team-name-full">{name}</span>
          <span className="team-name-short">{side === 'home' ? homeShort : awayShort}</span>
        </h2>
        <span className="text-meta">{side === 'home' ? 'HOME' : 'AWAY'}</span>
      </div>
    );
  };

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
            {/* Live Feed Synced Badge, only while the match is being played */}
            {isLive && <div
              className="scroll-pill-item"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                padding: '0.4rem 0.8rem',
                borderRadius: 'var(--radius-sm)',
                background: liveSyncPulse ? 'rgba(16, 185, 129, 0.25)' : 'rgba(16, 185, 129, 0.12)',
                border: `1px solid ${liveSyncPulse ? '#10B981' : 'rgba(16, 185, 129, 0.35)'}`,
                color: 'var(--c-green)',
                fontSize: '0.74rem',
                fontWeight: 800,
                minHeight: '44px',
                transition: 'all 0.3s ease',
              }}
              title="Real-time match feed synced directly from club touchline controller"
            >
              <span className="pulse-dot" style={{ background: '#10B981', width: '7px', height: '7px' }} />
              <span>LIVE FEED SYNCED</span>
            </div>}

            {checkInOpen && (
              <Link
                href={`/${club.slug}/match/${match.id}/checkin`}
                className="btn btn-sm scroll-pill-item touch-target"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  background: 'rgba(59, 130, 246, 0.15)',
                  border: '1px solid #3B82F6',
                  color: 'var(--c-blue)',
                  minHeight: '44px',
                  fontWeight: 700
                }}
                title="Door Turnstile Self-Check-in Station"
              >
                <QrCode size={14} />
                <span>Door Check-In</span>
              </Link>
            )}

            <button
              type="button"
              onClick={toggleAudio}
              className="btn btn-secondary btn-sm scroll-pill-item touch-target"
              style={{ minHeight: '44px', minWidth: '44px' }}
              title={audioEnabled ? 'Mute goal sound' : 'Play a sound on goals'}
              aria-label={audioEnabled ? 'Mute goal sound' : 'Play a sound on goals'}
              aria-pressed={audioEnabled}
            >
              {audioEnabled ? <Volume2 size={15} aria-hidden="true" /> : <VolumeX size={15} aria-hidden="true" />}
            </button>

            <MatchShareButton match={match} club={club} />

            {isClubAdmin && (
              <Link
                href={`/${club.slug}/admin/match-center`}
                className="btn btn-secondary btn-sm scroll-pill-item touch-target"
                style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', minHeight: '44px' }}
              >
                <Settings size={14} />
                <span>Admin</span>
              </Link>
            )}
          </div>
        </div>

        {/* Stadium-Grade Live Scoreboard Hero with Strobe Wave */}
        <div
          className="glass-panel"
          style={{
            padding: 'clamp(1.5rem, 6vw, 2.5rem) clamp(0.75rem, 4vw, 1.5rem)',
            marginBottom: '2.5rem',
            background: 'linear-gradient(180deg, rgba(var(--dk-18-26-38), 0.95) 0%, rgba(var(--dk-10-15-23), 0.98) 100%)',
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
                background: `linear-gradient(90deg, transparent 0%, rgba(245, 158, 11, 0.35) 45%, color-mix(in srgb, ${goalAlert.teamSide === 'home' ? homeColor : awayColor} 40%, transparent) 55%, transparent 100%)`,
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
                boxShadow: '0 8px 30px rgba(245, 158, 11, 0.8), 0 0 25px rgba(var(--tint-rgb), 0.9)',
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
                      <span className="text-muted"> vs </span>
                      <span style={{ color: titleColors.away }}>{match.away_team_name}</span>
                    </span>
                    <span className="team-name-short">
                      <span style={{ color: titleColors.home }}>{homeShort}</span>
                      <span className="text-muted"> vs </span>
                      <span style={{ color: titleColors.away }}>{awayShort}</span>
                    </span>
                  </>
                ) : (
                  <span style={{ color: 'var(--c-amber)' }}>{match.title}</span>
                )}
              </div>
            )}
            {match.status === 'live' ? (
              <span className="badge badge-live" style={{ padding: '0.35rem 0.85rem', fontSize: '0.8rem' }}>
                <span className="pulse-dot" /> {match.is_paused ? 'PAUSED' : 'LIVE'} • <LiveMinute match={match} />&apos;
                {match.added_time > 0 && <span style={{ color: 'var(--c-amber)', marginLeft: '0.25rem' }}>(+{match.added_time}&apos;)</span>}
              </span>
            ) : match.status === 'halftime' ? (
              <span className="badge badge-gold" style={{ padding: '0.35rem 0.85rem', fontSize: '0.8rem' }}>
                HALF-TIME (HT)
              </span>
            ) : (
              <span className="badge" style={{ background: 'rgba(var(--tint-rgb), 0.1)', color: 'var(--text-primary)' }}>
                {match.status.toUpperCase()}
              </span>
            )}
            {match.match_type && (
              <span className="badge" style={{ background: 'rgba(var(--tint-rgb), 0.08)', color: 'var(--club-primary)', border: '1px solid rgba(var(--club-primary-rgb), 0.3)', textTransform: 'uppercase' }}>
                {match.match_type} FIXTURE
              </span>
            )}
            <span style={{ width: '100%', color: 'var(--text-muted)', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
              <Calendar size={12} />
              <LocalTime value={match.match_date} locale="en-US" options={{ weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }} />
              {match.match_time && (
                <>
                  <Clock size={12} style={{ marginLeft: '0.2rem' }} />
                  {match.match_time}
                </>
              )}
            </span>
            <span className="text-note">
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
            {teamBlock('home')}

            {/* Stadium Mechanical Scoreboard Digit Display */}
            <div data-theme="dark" style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: 'clamp(0.75rem, 2vw, 1.25rem) clamp(0.5rem, 2.5vw, 2rem)',
              background: 'rgb(var(--dk-4-6-9))',
              borderRadius: '20px',
              border: `2px solid ${goalAlert?.active ? '#F59E0B' : 'rgba(var(--tint-rgb), 0.12)'}`,
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
                  accentColor={homeColor}
                  size="clamp(2rem, 10vw, 3.6rem)"
                />

                <span style={{
                  color: 'var(--text-muted)',
                  fontSize: 'clamp(1.4rem, 5vw, 2.5rem)',
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
                  accentColor={awayColor}
                  size="clamp(2rem, 10vw, 3.6rem)"
                />
              </div>

              <div style={{
                fontSize: '0.7rem',
                fontWeight: 700,
                color: match.status === 'live' ? 'var(--c-red)' : 'var(--text-muted)',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                marginTop: '8px',
                textAlign: 'center',
              }}>
                {periodLabel(match.period)}
              </div>
            </div>

            {teamBlock('away')}
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
                <div className="min-w-0">
                  <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--c-amber)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Player of the Match
                  </div>
                  <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', overflowWrap: 'anywhere' }}>
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
                      <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', flexShrink: 0, minWidth: '2.2em' }}>{evt.minute}&apos;</span>
                      <span style={{ minWidth: 0 }}>
                        <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>
                          {evt.player_name}{evt.event_type === 'penalty' ? ' (pen.)' : ''}
                        </span>
                        {evt.assist_player_name && (
                          <span className="text-secondary"> (Assist: {evt.assist_player_name})</span>
                        )}
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                          {' · '}
                          <span className="team-name-full">{evt.team_side === 'home' ? match.home_team_name : match.away_team_name}</span>
                          <span className="team-name-short">{evt.team_side === 'home' ? homeShort : awayShort}</span>
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
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
                color: activeTab === tab.id ? 'var(--text-primary)' : 'var(--text-muted)',
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
                events.map(evt => {
                  const isGoal = evt.event_type === 'goal' || evt.event_type === 'penalty';
                  return (
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
                      borderLeft: isGoal ? `4px solid #10B981` : evt.event_type === 'red_card' ? '4px solid #EF4444' : evt.event_type === 'yellow_card' ? '4px solid #F59E0B' : '1px solid var(--border-subtle)',
                    }}
                  >
                    {/* Minute Circle Badge */}
                    <div style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '50%',
                      background: isGoal ? '#10B981' : evt.event_type === 'yellow_card' ? '#F59E0B' : evt.event_type === 'red_card' ? '#EF4444' : 'var(--bg-surface-elevated)',
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
                          backgroundColor: isGoal ? 'rgba(16, 185, 129, 0.2)' : evt.event_type === 'yellow_card' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(var(--tint-rgb), 0.1)',
                          color: isGoal ? 'var(--c-green)' : evt.event_type === 'yellow_card' ? 'var(--c-amber)' : 'var(--text-primary)',
                        }}>
                          {evt.event_type.toUpperCase().replace(/_/g, ' ')}
                        </span>
                        <span className="text-meta">
                          {evt.team_side === 'home' ? match.home_team_name : match.away_team_name}
                        </span>
                      </div>

                      <h4 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                        {evt.player_name} {evt.assist_player_name ? `(Assist: ${evt.assist_player_name})` : ''}
                      </h4>

                      {evt.detail_text && (
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                          {evt.detail_text}
                        </p>
                      )}
                    </div>
                  </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* TAB 2: TACTICAL LINEUPS & PITCH, one per side that fields the club's own players */}
        {activeTab === 'lineups' && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '2rem',
          }}>
            {lineupSides.map(({ side, teamName, color, players }) => (
              <React.Fragment key={side}>
                {/* The Tactical Pitch Component */}
                <div>
                  <TacticalPitch
                    players={players}
                    formation={(side === 'home' ? match.home_formation : match.away_formation) || '4-3-3'}
                    matchFormat={match.match_format}
                    savedPositions={side === 'home' ? match.home_lineup_coords : match.away_lineup_coords}
                    primaryColor={color}
                    isEditable={false}
                    allowOrientationToggle={true}
                    showFormationControls={false}
                    matchEvents={events.filter(e => e.team_side === side)}
                    teamName={teamName}
                  />
                </div>

                {/* Starting XI & Substitutes List */}
                <div className="glass-panel" style={{ padding: '1.75rem' }}>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '1.25rem', color: 'var(--text-primary)' }}>
                    {teamName} Matchday Squad
                  </h3>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    {players.length === 0 && (
                      <p style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        No players have confirmed their availability for this match yet.
                      </p>
                    )}
                    {players.map(p => (
                      <div
                        key={p.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0.55rem 0.85rem',
                          borderRadius: '8px',
                          background: 'rgba(var(--tint-rgb), 0.03)',
                        }}
                      >
                        <div className="row row-loose">
                          <PlayerAvatar photoUrl={p.photo_url} name={p.full_name} size={32} />
                          <span style={{
                            fontFamily: 'var(--font-heading)',
                            fontWeight: 900,
                            color: 'var(--club-primary)',
                            width: '24px',
                          }}>
                            {p.jersey_number ? `#${p.jersey_number}` : ''}
                          </span>
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem' }}>{p.full_name}</span>
                        </div>
                        <span className="badge" style={{ background: 'rgba(var(--tint-rgb), 0.06)', color: 'var(--text-secondary)' }}>
                          {p.player_position}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </React.Fragment>
            ))}
            {lineupSides.length === 0 && (
              <p style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                No club lineups for this match.
              </p>
            )}
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
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.5rem', textAlign: 'center' }}>
                Match Statistics
              </h3>
              <p style={{ textAlign: 'center', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '1.75rem' }}>
                Live-tracked from the official event log
              </p>

              {/* Home vs Away header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.25rem', padding: '0 0.25rem' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 800, color: titleColors.home, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {match.home_team_name}
                </span>
                <span style={{ fontSize: '0.8rem', fontWeight: 800, color: titleColors.away, textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>
                  {match.away_team_name}
                </span>
              </div>

              {trackedStats.map(s => {
                const total = s.home + s.away || 1;
                const homePercent = (s.home / total) * 100;

                return (
                  <div key={s.label} style={{ marginBottom: '1.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                      <span style={{ color: titleColors.home, minWidth: '24px' }}>{s.home}</span>
                      <span className="text-muted">{s.label}</span>
                      <span style={{ color: titleColors.away, minWidth: '24px', textAlign: 'right' }}>{s.away}</span>
                    </div>
                    <div style={{ height: '8px', background: 'rgba(var(--tint-rgb), 0.08)', borderRadius: '4px', overflow: 'hidden', display: 'flex' }}>
                      <div style={{ width: `${homePercent}%`, background: homeColor, transition: 'width 0.6s ease' }} />
                      <div style={{ width: `${100 - homePercent}%`, background: awayColor, transition: 'width 0.6s ease' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}

        {/* Club partners, under whichever tab is open */}
        {matchSponsors.length > 0 && (
          <div style={{ marginTop: '2rem' }}>
            <SponsorMarquee sponsors={matchSponsors} placement="match_center_marquee" />
          </div>
        )}
      </div>
    </div>
  );
}
