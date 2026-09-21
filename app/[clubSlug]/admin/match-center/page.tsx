'use client';

import React, { useState, use } from 'react';
import Link from 'next/link';
import { useClub } from '@/lib/club-context';
import { MatchEventType, MatchPeriod, PitchPosition } from '@/lib/supabase/types';
import TacticalPitch from '@/components/TacticalPitch';
import {
  Radio,
  Play,
  Pause,
  Plus,
  Minus,
  CheckCircle2,
  AlertCircle,
  Clock,
  Shield,
  Send,
  Trash2,
  ExternalLink,
  Layers,
  Move,
  Users,
  Timer,
  RotateCcw,
  Sparkles,
  ShieldCheck,
  CalendarDays,
  X,
  Calendar,
  QrCode
} from 'lucide-react';
import StatsAuditModal from '@/components/StatsAuditModal';
import QRScannerModal from '@/components/QRScannerModal';
import LiveMinute from '@/components/LiveMinute';
import { getLiveMinute } from '@/lib/match-clock';

export default function AdminMatchCenterControllerPage({
  params,
}: {
  params: Promise<{ clubSlug: string }>;
}) {
  const resolvedParams = use(params);
  const {
    clubs,
    selectClubBySlug,
    matches,
    matchEvents,
    updateMatch,
    addMatch,
    deleteMatch,
    addMatchEvent,
    deleteMatchEvent,
    members,
    seasons,
    getActiveSeason
  } = useClub();

  const club = selectClubBySlug(resolvedParams.clubSlug) || clubs[0];
  const clubMatches = matches.filter(m => m.club_id === club.id);
  const clubSeasons = seasons.filter(s => s.club_id === club.id);
  const activeSeason = getActiveSeason ? getActiveSeason(club.id) : null;

  const [seasonFilter, setSeasonFilter] = useState<string>('ALL');

  const filteredMatches = clubMatches.filter(m => {
    if (seasonFilter === 'ALL') return true;
    return m.season === seasonFilter;
  });

  const [selectedMatchId, setSelectedMatchId] = useState<string>(clubMatches[0]?.id || '');

  const match = filteredMatches.find(m => m.id === selectedMatchId) || filteredMatches[0] || clubMatches[0];
  const events = matchEvents.filter(e => e.match_id === match?.id).sort((a, b) => b.minute - a.minute);
  const squadPlayers = members.filter(m => m.club_id === club.id && m.role === 'player');

  // Active Admin Sub-Tab
  const [adminTab, setAdminTab] = useState<'events' | 'tactics' | 'clock'>('events');

  // New Fixture Modal state
  const [isCreateFixtureOpen, setIsCreateFixtureOpen] = useState(false);
  const [fixtureOpponent, setFixtureOpponent] = useState('');
  const [fixtureCompetition, setFixtureCompetition] = useState('Club Friendly');
  const [fixtureSeason, setFixtureSeason] = useState(activeSeason?.name || '2026/27');
  const [fixtureDate, setFixtureDate] = useState(new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 16));
  const [fixtureVenue, setFixtureVenue] = useState(club.stadium_name);
  const [fixtureIsHome, setFixtureIsHome] = useState(true);

  // Match Check-in & Scanner Modal
  const [isCheckinModalOpen, setIsCheckinModalOpen] = useState(false);

  // Quick event form states
  const [eventType, setEventType] = useState<MatchEventType>('goal');
  const [teamSide, setTeamSide] = useState<'home' | 'away'>('home');
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>(squadPlayers[1]?.id || 'custom');
  const [customPlayerName, setCustomPlayerName] = useState('');
  const [selectedSubOffId, setSelectedSubOffId] = useState<string>(squadPlayers[0]?.id || '');
  const [assistName, setAssistName] = useState('');
  const [eventMinute, setEventMinute] = useState(match ? getLiveMinute(match) : 75);
  const [eventDetail, setEventDetail] = useState('');
  const [feedback, setFeedback] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState<boolean>(false);

  const showFeedback = (text: string, type: 'success' | 'info' | 'error' = 'success') => {
    setFeedback({ text, type });
    setTimeout(() => setFeedback(null), 3000);
  };

  const handleCreateFixture = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fixtureOpponent.trim()) return;

    const newFixture = addMatch({
      club_id: club.id,
      competition: fixtureCompetition,
      season: fixtureSeason,
      home_team_name: fixtureIsHome ? club.name : fixtureOpponent.trim(),
      away_team_name: fixtureIsHome ? fixtureOpponent.trim() : club.name,
      home_team_logo: fixtureIsHome ? club.logo_url : 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=100&auto=format&fit=crop&q=80',
      away_team_logo: fixtureIsHome ? 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=100&auto=format&fit=crop&q=80' : club.logo_url,
      is_club_home: fixtureIsHome,
      match_date: new Date(fixtureDate).toISOString(),
      venue: fixtureVenue,
      status: 'upcoming',
      home_score: 0,
      away_score: 0,
      current_minute: 0,
      added_time: 0,
      period: 'pre_match',
      home_formation: '4-3-3',
      away_formation: '4-4-2',
      match_format: '11v11',
    });

    setSelectedMatchId(newFixture.id);
    setIsCreateFixtureOpen(false);
    setFixtureOpponent('');
    showFeedback(`✓ Scheduled new fixture against ${fixtureOpponent} for ${fixtureSeason} season!`);
  };

  if (!match) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem' }}>
        <h2 style={{ color: '#FFFFFF', fontWeight: 800 }}>No match fixtures found for this club.</h2>
        <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', marginBottom: '1.5rem' }}>
          Schedule a match fixture associated with a season to operate live matchday reporting.
        </p>
        <Link
          href={`/${club.slug}/admin/matches`}
          className="btn btn-primary"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <Plus size={16} />
          <span>Schedule First Fixture</span>
        </Link>

        {isCreateFixtureOpen && (
          <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem',
          }}>
            <div className="glass-panel" style={{ width: '100%', maxWidth: '520px', padding: '2rem', textAlign: 'left', background: 'var(--bg-surface)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#FFFFFF' }}>Schedule New Fixture</h3>
                <button onClick={() => setIsCreateFixtureOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)' }}><X size={20} /></button>
              </div>
              <form onSubmit={handleCreateFixture}>
                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label className="form-label">Opponent Team *</label>
                  <input type="text" required className="form-input" placeholder="e.g. Metro Rovers" value={fixtureOpponent} onChange={e => setFixtureOpponent(e.target.value)} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Competition</label>
                    <input type="text" className="form-input" value={fixtureCompetition} onChange={e => setFixtureCompetition(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Season</label>
                    <select className="form-select" value={fixtureSeason} onChange={e => setFixtureSeason(e.target.value)}>
                      {clubSeasons.map(s => (<option key={s.id} value={s.name}>{s.name}</option>))}
                      {!clubSeasons.some(s => s.name === fixtureSeason) && (<option value={fixtureSeason}>{fixtureSeason}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                  <button type="button" onClick={() => setIsCreateFixtureOpen(false)} className="btn btn-secondary">Cancel</button>
                  <button type="submit" className="btn btn-primary">Schedule Fixture</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Adjust score
  const handleScoreAdjust = (side: 'home' | 'away', delta: number) => {
    if (side === 'home') {
      const newScore = Math.max(0, match.home_score + delta);
      updateMatch(match.id, { home_score: newScore });
      showFeedback(`Updated ${match.home_team_name} score to ${newScore}`);
    } else {
      const newScore = Math.max(0, match.away_score + delta);
      updateMatch(match.id, { away_score: newScore });
      showFeedback(`Updated ${match.away_team_name} score to ${newScore}`);
    }
  };

  // Adjust match period
  const handlePeriodTransition = (period: MatchPeriod, status: any, defaultMin?: number) => {
    const updates: any = { period, status };
    if (typeof defaultMin === 'number') {
      updates.current_minute = defaultMin;
      setEventMinute(defaultMin);
    }
    updateMatch(match.id, updates);
    showFeedback(`Match transitioned to ${period.toUpperCase().replace('_', ' ')} (${status.toUpperCase()})`);
  };

  // Adjust match minute
  const handleMinuteAdjust = (delta: number) => {
    const newMin = Math.max(0, Math.min(120, getLiveMinute(match) + delta));
    updateMatch(match.id, { current_minute: newMin });
    setEventMinute(newMin);
  };

  // Set stoppage time
  const handleSetAddedTime = (minutes: number) => {
    updateMatch(match.id, { added_time: minutes });
    showFeedback(`Stoppage time board set to +${minutes} minute${minutes > 1 ? 's' : ''}`);
  };

  // Handle Event Logging
  const handleLogEvent = (e: React.FormEvent) => {
    e.preventDefault();

    const isClubHome = match?.is_club_home ?? true;
    const isClubSelected = (isClubHome && teamSide === 'home') || (!isClubHome && teamSide === 'away');

    let resolvedPlayerName = '';
    if (isClubSelected) {
      if (selectedPlayerId === 'custom') {
        resolvedPlayerName = customPlayerName.trim();
      } else {
        const found = squadPlayers.find(p => p.id === selectedPlayerId);
        resolvedPlayerName = found ? found.full_name : customPlayerName.trim();
      }
    } else {
      const oppTeamName = teamSide === 'home' ? match.home_team_name : match.away_team_name;
      resolvedPlayerName = customPlayerName.trim() || `${oppTeamName} Player`;
    }

    if (!resolvedPlayerName) {
      showFeedback('Please enter or select a player name.', 'error');
      return;
    }

    let detail = eventDetail.trim();
    let assist = assistName.trim();

    if (eventType === 'sub') {
      const offPlayer = squadPlayers.find(p => p.id === selectedSubOffId);
      const offName = offPlayer ? offPlayer.full_name : 'Player';
      detail = `Substitution: ${resolvedPlayerName} ON, ${offName} OFF. ${detail}`.trim();
    }

    addMatchEvent({
      match_id: match.id,
      club_id: club.id,
      minute: Number(eventMinute),
      event_type: eventType,
      team_side: teamSide,
      player_name: resolvedPlayerName,
      assist_player_name: assist || undefined,
      detail_text: detail || undefined,
    });

    showFeedback(`Logged ${eventType.toUpperCase()} for ${resolvedPlayerName} (${eventMinute}')`);
    setEventDetail('');
    setAssistName('');
    if (selectedPlayerId === 'custom') setCustomPlayerName('');
  };

  // Delete event with automatic score reversal
  const handleDeleteEvent = (eventId: string, eventSummary: string) => {
    deleteMatchEvent(eventId);
    showFeedback(`Removed event: ${eventSummary}`);
  };

  // Save Tactical Lineup to Match
  const handleSaveTacticalLineup = (formationName: string, positions: PitchPosition[]) => {
    updateMatch(match.id, {
      home_formation: formationName,
      home_lineup_coords: positions,
    });
    showFeedback(`Tactical lineup & ${formationName} formation published live to Match Center!`);
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1.25rem',
        marginBottom: '1.75rem',
      }}>
        <div style={{ minWidth: 0, maxWidth: '100%' }}>
          <span className="badge badge-live" style={{ marginBottom: '0.4rem' }}>
            <span className="pulse-dot" /> MATCHDAY COMMAND CENTER
          </span>
          <h1 style={{ fontSize: 'clamp(1.4rem, 4vw, 2.1rem)', fontWeight: 900, color: '#FFFFFF', lineHeight: 1.25 }}>
            Live Match-Day Reporting & Tactical Hub
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginTop: '0.35rem' }}>
            Broadcast real-time score updates, stoppage time, substitutions, and custom tactical formations.
          </p>
        </div>

        <div className="admin-match-center-actions">
          <button
            type="button"
            onClick={() => setIsCheckinModalOpen(true)}
            className="btn btn-sm touch-target"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem',
              background: 'rgba(59, 130, 246, 0.16)',
              border: '1px solid #3B82F6',
              color: '#3B82F6',
              fontWeight: 800,
            }}
            title="Scan pass QR code via camera or enter token to check in attendees"
          >
            <QrCode size={15} />
            <span>Turnstile Check-In ({match.checkin_count || 0})</span>
          </button>

          <button
            type="button"
            onClick={() => setIsAuditModalOpen(true)}
            className="btn btn-sm touch-target"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem',
              background: match.is_audited
                ? 'rgba(16, 185, 129, 0.15)'
                : 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
              color: match.is_audited ? '#10B981' : '#000000',
              fontWeight: 800,
              border: match.is_audited ? '1px solid #10B981' : 'none',
              boxShadow: match.is_audited ? 'none' : '0 4px 14px rgba(245, 158, 11, 0.4)',
            }}
          >
            <ShieldCheck size={15} />
            <span>{match.is_audited ? 'Stats Audited ✓' : 'Audit & Finalize'}</span>
          </button>

          <Link
            href={`/${club.slug}/admin/lineup/draft`}
            className="btn btn-secondary btn-sm touch-target"
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
          >
            <Layers size={14} color="#F59E0B" />
            <span>Draft Workbench</span>
          </Link>

          <Link
            href={`/${club.slug}/match/${match.id}`}
            target="_blank"
            className="btn btn-secondary btn-sm touch-target"
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', border: '1px solid rgba(255, 255, 255, 0.15)' }}
          >
            <span>Public Match Center</span>
            <ExternalLink size={14} />
          </Link>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div style={{
          background: feedback.type === 'error' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
          border: `1px solid ${feedback.type === 'error' ? '#EF4444' : '#10B981'}`,
          padding: '0.85rem 1.25rem',
          borderRadius: 'var(--radius-md)',
          color: feedback.type === 'error' ? '#EF4444' : '#10B981',
          fontWeight: 700,
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          animation: 'fadeIn 0.2s ease',
        }}>
          {feedback.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Fixture Selector Dropdown & Season Controls */}
      <div className="glass-panel" style={{ padding: 'clamp(0.85rem, 2.5vw, 1.25rem)', marginBottom: '1.75rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.85rem', flex: 1, minWidth: 0 }}>
            {/* Season Filter Dropdown */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: '160px' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.3rem', flexShrink: 0 }}>
                <CalendarDays size={14} color="var(--club-primary)" /> Season:
              </span>
              <select
                className="form-select"
                style={{ width: '100%', maxWidth: '140px', padding: '0.4rem 0.65rem', fontSize: '0.82rem' }}
                value={seasonFilter}
                onChange={e => setSeasonFilter(e.target.value)}
              >
                <option value="ALL">All Seasons</option>
                {clubSeasons.map(s => (
                  <option key={s.id} value={s.name}>
                    {s.name} {s.is_current ? '★' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: '200px', maxWidth: '100%' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)', flexShrink: 0 }}>
                Fixture:
              </span>
              <select
                className="form-select"
                style={{ width: '100%', maxWidth: '100%' }}
                value={selectedMatchId}
                onChange={e => setSelectedMatchId(e.target.value)}
              >
                {filteredMatches.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.home_team_name} vs {m.away_team_name} ({m.season}) [{m.status.toUpperCase()}]
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', width: 'auto' }}>
            <span className="badge" style={{ backgroundColor: 'rgba(59, 130, 246, 0.15)', color: '#3B82F6', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <CalendarDays size={12} /> {match.season}
            </span>
            <span className="badge badge-primary" style={{ fontSize: '0.75rem' }}>
              Formation: {match.home_formation || '4-3-3'}
            </span>
            {match.added_time > 0 && (
              <span className="badge badge-gold" style={{ fontSize: '0.75rem' }}>
                +{match.added_time}&apos; Stoppage
              </span>
            )}
            <Link
              href={`/${club.slug}/admin/matches`}
              className="btn btn-primary btn-sm touch-target"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
            >
              <CalendarDays size={14} />
              <span>Schedule Fixture</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Sub-Tabs: Event Console vs Tactical Pitch vs Clock & Periods */}
      <div className="scroll-pill-strip" style={{
        display: 'flex',
        gap: '0.5rem',
        marginBottom: '2rem',
        borderBottom: '1px solid var(--border-subtle)',
        paddingBottom: '0.75rem',
        overflowX: 'auto',
        maxWidth: '100%',
      }}>
        {[
          { id: 'events', label: 'Score & Event Console', icon: Radio },
          { id: 'tactics', label: 'Tactical Pitch & Free-Form Lineups', icon: Move },
          { id: 'clock', label: 'Match Clock & Stoppage Board', icon: Timer },
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = adminTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setAdminTab(tab.id as any)}
              className="btn btn-sm"
              style={{
                background: isActive ? 'rgba(255, 255, 255, 0.12)' : 'transparent',
                color: isActive ? '#FFFFFF' : 'var(--text-muted)',
                fontWeight: 800,
                fontSize: '0.9rem',
                border: '1px solid',
                borderColor: isActive ? 'var(--border-medium)' : 'transparent',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.55rem 1rem',
              }}
            >
              <Icon size={16} color={isActive ? club.primary_color : 'currentColor'} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: LIVE SCORE & EVENT CONSOLE */}
      {/* ========================================================================= */}
      {adminTab === 'events' && (
        <div>
          {/* Main Scoreboard Command Hub */}
          <div className="glass-panel" style={{
            padding: 'clamp(1rem, 2.5vw, 2rem)',
            marginBottom: '2rem',
            background: 'linear-gradient(180deg, #0e1624 0%, #080d15 100%)',
            border: '2px solid rgba(255, 255, 255, 0.15)',
            overflow: 'hidden',
          }}>
            {/* Quick Period & Minute Bar */}
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.75rem',
              marginBottom: '1.5rem',
              borderBottom: '1px solid var(--border-subtle)',
              paddingBottom: '1rem',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <div style={{
                  fontFamily: 'var(--font-heading)',
                  fontSize: 'clamp(1.5rem, 3.5vw, 2.2rem)',
                  fontWeight: 900,
                  color: match.status === 'live' ? '#EF4444' : '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                }}>
                  <Clock size={22} color={match.status === 'live' ? '#EF4444' : 'var(--text-muted)'} />
                  <span><LiveMinute match={match} />&apos;</span>
                  {match.added_time > 0 && (
                    <span style={{ fontSize: '1rem', color: '#F59E0B' }}>
                      (+{match.added_time}&apos;)
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '0.35rem' }}>
                  <button onClick={() => handleMinuteAdjust(-1)} className="btn btn-secondary btn-sm" style={{ padding: '0.3rem 0.55rem', fontSize: '0.78rem' }} title="-1 minute">
                    <Minus size={13} /> 1m
                  </button>
                  <button onClick={() => handleMinuteAdjust(1)} className="btn btn-secondary btn-sm" style={{ padding: '0.3rem 0.55rem', fontSize: '0.78rem' }} title="+1 minute">
                    <Plus size={13} /> 1m
                  </button>
                </div>
              </div>

              {/* Quick Period Status Indicators */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                <button
                  onClick={() => handlePeriodTransition('first_half', 'live', 1)}
                  className="btn btn-sm"
                  style={{ background: match.period === 'first_half' ? '#10B981' : 'rgba(255,255,255,0.06)', color: '#FFF', padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}
                >
                  1st Half
                </button>
                <button
                  onClick={() => handlePeriodTransition('halftime', 'halftime', 45)}
                  className="btn btn-sm"
                  style={{ background: match.period === 'halftime' ? '#F59E0B' : 'rgba(255,255,255,0.06)', color: '#FFF', padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}
                >
                  HT (45&apos;)
                </button>
                <button
                  onClick={() => handlePeriodTransition('second_half', 'live', 46)}
                  className="btn btn-sm"
                  style={{ background: match.period === 'second_half' ? '#10B981' : 'rgba(255,255,255,0.06)', color: '#FFF', padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}
                >
                  2nd Half
                </button>
                <button
                  onClick={() => handlePeriodTransition('full_time', 'completed', 90)}
                  className="btn btn-sm"
                  style={{ background: match.status === 'completed' ? '#3B82F6' : 'rgba(255,255,255,0.06)', color: '#FFF', padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}
                >
                  FT (90&apos;)
                </button>
              </div>
            </div>

            {/* Live Score Controls Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr auto 1fr',
              alignItems: 'center',
              gap: 'clamp(0.4rem, 2vw, 1.5rem)',
            }}>
              {/* Home Team Score */}
              <div style={{ textAlign: 'center', minWidth: 0 }}>
                <div style={{
                  fontWeight: 800,
                  fontSize: 'clamp(0.9rem, 2.5vw, 1.25rem)',
                  color: '#FFFFFF',
                  marginBottom: '0.4rem',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  lineHeight: 1.2,
                }}>
                  {match.home_team_name}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'clamp(0.35rem, 1.5vw, 0.75rem)', marginTop: '0.5rem' }}>
                  <button
                    onClick={() => handleScoreAdjust('home', -1)}
                    className="btn btn-secondary btn-sm touch-target"
                    style={{ borderRadius: '50%', width: 'clamp(34px, 4.5vw, 40px)', height: 'clamp(34px, 4.5vw, 40px)', padding: 0, flexShrink: 0 }}
                    title="Subtract 1 goal"
                  >
                    <Minus size={15} />
                  </button>
                  <span style={{ fontFamily: 'var(--font-heading)', fontSize: 'clamp(2.2rem, 5vw, 3.4rem)', fontWeight: 900, color: '#FFFFFF', minWidth: '36px', textAlign: 'center' }}>
                    {match.home_score}
                  </span>
                  <button
                    onClick={() => handleScoreAdjust('home', 1)}
                    className="btn btn-primary btn-sm touch-target"
                    style={{ borderRadius: '50%', width: 'clamp(34px, 4.5vw, 40px)', height: 'clamp(34px, 4.5vw, 40px)', padding: 0, background: club.primary_color, flexShrink: 0 }}
                    title="Add 1 goal"
                  >
                    <Plus size={15} />
                  </button>
                </div>
              </div>

              <div style={{ fontSize: 'clamp(1.6rem, 3.5vw, 2.5rem)', fontWeight: 900, color: 'var(--text-muted)', userSelect: 'none' }}>
                :
              </div>

              {/* Away Team Score */}
              <div style={{ textAlign: 'center', minWidth: 0 }}>
                <div style={{
                  fontWeight: 800,
                  fontSize: 'clamp(0.9rem, 2.5vw, 1.25rem)',
                  color: '#FFFFFF',
                  marginBottom: '0.4rem',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  lineHeight: 1.2,
                }}>
                  {match.away_team_name}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'clamp(0.35rem, 1.5vw, 0.75rem)', marginTop: '0.5rem' }}>
                  <button
                    onClick={() => handleScoreAdjust('away', -1)}
                    className="btn btn-secondary btn-sm touch-target"
                    style={{ borderRadius: '50%', width: 'clamp(34px, 4.5vw, 40px)', height: 'clamp(34px, 4.5vw, 40px)', padding: 0, flexShrink: 0 }}
                    title="Subtract 1 goal"
                  >
                    <Minus size={15} />
                  </button>
                  <span style={{ fontFamily: 'var(--font-heading)', fontSize: 'clamp(2.2rem, 5vw, 3.4rem)', fontWeight: 900, color: '#FFFFFF', minWidth: '36px', textAlign: 'center' }}>
                    {match.away_score}
                  </span>
                  <button
                    onClick={() => handleScoreAdjust('away', 1)}
                    className="btn btn-primary btn-sm touch-target"
                    style={{ borderRadius: '50%', width: 'clamp(34px, 4.5vw, 40px)', height: 'clamp(34px, 4.5vw, 40px)', padding: 0, background: '#3B82F6', flexShrink: 0 }}
                    title="Add 1 goal"
                  >
                    <Plus size={15} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Event Logger Form */}
          {(() => {
            const isClubHome = match?.is_club_home ?? true;
            const isClubSelected = (isClubHome && teamSide === 'home') || (!isClubHome && teamSide === 'away');

            return (
              <div className="glass-panel" style={{ padding: 'clamp(1rem, 2.5vw, 2rem)', marginBottom: '2.5rem' }}>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#FFFFFF', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Radio size={18} color="#10B981" /> Broadcast Live Match Event
                </h3>

                <form onSubmit={handleLogEvent}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
                    <div className="form-group">
                      <label className="form-label">Event Type</label>
                      <select
                        className="form-select"
                        value={eventType}
                        onChange={e => setEventType(e.target.value as MatchEventType)}
                      >
                        <option value="goal">⚽ Goal (Regular)</option>
                        <option value="penalty">🎯 Goal (Penalty)</option>
                        <option value="yellow_card">🟨 Yellow Card</option>
                        <option value="red_card">🟥 Red Card</option>
                        <option value="sub">🔄 Substitution</option>
                        <option value="var">🖥️ VAR Review</option>
                        <option value="commentary">🎙️ Tactical Commentary</option>
                        <option value="whistle">📢 Period Whistle</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Team Side</label>
                      <select
                        className="form-select"
                        value={teamSide}
                        onChange={e => setTeamSide(e.target.value as any)}
                      >
                        <option value="home">{match.home_team_name} ({isClubHome ? 'Our Club - Home' : 'Opponent - Home'})</option>
                        <option value="away">{match.away_team_name} ({!isClubHome ? 'Our Club - Away' : 'Opponent - Away'})</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Match Minute</label>
                      <input
                        type="number"
                        min={0}
                        max={120}
                        className="form-input"
                        value={eventMinute}
                        onChange={e => setEventMinute(Number(e.target.value))}
                      />
                    </div>
                  </div>

                  {/* Dynamic Player Selector */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
                    {isClubSelected ? (
                      <div className="form-group">
                        <label className="form-label">
                          {eventType === 'sub' ? 'Player Coming ON *' : 'Squad Player Involved *'}
                        </label>
                        <select
                          className="form-select"
                          value={selectedPlayerId}
                          onChange={e => setSelectedPlayerId(e.target.value)}
                        >
                          {squadPlayers.map(p => (
                            <option key={p.id} value={p.id}>
                              #{p.jersey_number} {p.full_name} ({p.player_position})
                            </option>
                          ))}
                          <option value="custom">-- Custom Name / Other Player --</option>
                        </select>

                        {selectedPlayerId === 'custom' && (
                          <input
                            type="text"
                            required
                            className="form-input"
                            placeholder="Enter player name"
                            style={{ marginTop: '0.5rem' }}
                            value={customPlayerName}
                            onChange={e => setCustomPlayerName(e.target.value)}
                          />
                        )}
                      </div>
                    ) : (
                      <div className="form-group">
                        <label className="form-label">Opponent Player Name *</label>
                        <input
                          type="text"
                          required
                          className="form-input"
                          placeholder="e.g. Leo Silva"
                          value={customPlayerName}
                          onChange={e => setCustomPlayerName(e.target.value)}
                        />
                      </div>
                    )}

                    {/* If Substitution: Select player coming OFF */}
                    {eventType === 'sub' && isClubSelected ? (
                      <div className="form-group">
                        <label className="form-label">Player Coming OFF *</label>
                        <select
                          className="form-select"
                          value={selectedSubOffId}
                          onChange={e => setSelectedSubOffId(e.target.value)}
                        >
                          {squadPlayers.map(p => (
                            <option key={p.id} value={p.id}>
                              #{p.jersey_number} {p.full_name} ({p.player_position})
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <div className="form-group">
                        <label className="form-label">Assist / Involved Secondary (Optional)</label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="Player name"
                          value={assistName}
                          onChange={e => setAssistName(e.target.value)}
                        />
                      </div>
                    )}
                  </div>

                  <div className="form-group">
                    <label className="form-label">Event Detail / Tactical Notes</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Curling strike into top corner after neat combination play."
                      value={eventDetail}
                      onChange={e => setEventDetail(e.target.value)}
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                    <button type="submit" className="btn btn-primary touch-target" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', background: club.primary_color, minWidth: '180px' }}>
                      <Send size={16} />
                      <span>Broadcast Event Live</span>
                    </button>
                  </div>
                </form>
              </div>
            );
          })()}

          {/* Logged Events List with Deletion */}
          <div className="glass-panel" style={{ padding: 'clamp(1rem, 2.5vw, 2rem)' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#FFFFFF', marginBottom: '1.25rem' }}>
              Logged Match Events ({events.length})
            </h3>

            {events.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                No events recorded yet. Log goals, substitutions, and cards above.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {events.map(evt => (
                  <div
                    key={evt.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: 'clamp(0.6rem, 2vw, 0.85rem) clamp(0.75rem, 2.5vw, 1.15rem)',
                      borderRadius: '8px',
                      background: 'rgba(0, 0, 0, 0.35)',
                      border: '1px solid var(--border-subtle)',
                      gap: '0.75rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0, flex: 1 }}>
                      <span className="badge" style={{
                        backgroundColor: evt.event_type === 'goal' ? '#10B981' : evt.event_type === 'yellow_card' ? '#F59E0B' : evt.event_type === 'red_card' ? '#EF4444' : 'rgba(255,255,255,0.1)',
                        color: evt.event_type === 'yellow_card' ? '#000000' : '#FFFFFF',
                        fontWeight: 900,
                        minWidth: '38px',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}>
                        {evt.minute}&apos;
                      </span>

                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 800, color: '#FFFFFF', fontSize: '0.88rem' }}>
                            {evt.event_type.toUpperCase().replace('_', ' ')}
                          </span>
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>•</span>
                          <span style={{ fontWeight: 700, color: '#FFFFFF', fontSize: '0.88rem' }}>
                            {evt.player_name}
                          </span>
                          {evt.assist_player_name && (
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              (Ast: {evt.assist_player_name})
                            </span>
                          )}
                          <span className="badge" style={{ fontSize: '0.65rem', background: 'rgba(255, 255, 255, 0.08)', color: 'var(--text-secondary)', flexShrink: 0 }}>
                            {evt.team_side === 'home' ? match.home_team_name : match.away_team_name}
                          </span>
                        </div>
                        {evt.detail_text && (
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.2rem', wordBreak: 'break-word' }}>
                            {evt.detail_text}
                          </div>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => handleDeleteEvent(evt.id, `${evt.event_type} (${evt.minute}')`)}
                      className="btn btn-secondary btn-sm touch-target"
                      style={{ padding: '0.35rem 0.65rem', color: '#EF4444', borderColor: 'rgba(239, 68, 68, 0.3)', flexShrink: 0 }}
                      title="Delete event and revert score if goal"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: TACTICAL PITCH & FREE-FORM FORMATIONS */}
      {/* ========================================================================= */}
      {adminTab === 'tactics' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="glass-panel" style={{ padding: 'clamp(1rem, 2.5vw, 1.5rem) clamp(1rem, 3vw, 2rem)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <div>
                <h3 style={{ fontSize: '1.3rem', fontWeight: 900, color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Move size={20} color="#F59E0B" /> Tactical Pitch & Free-Form Manager
                </h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginTop: '0.2rem' }}>
                  Coaches can choose a tactical preset (4-3-3, 4-2-3-1, 4-4-2, 3-5-2, 3-2-4-1) or freely drag and drop any player node into custom shapes. Click &quot;Save Shape&quot; to publish directly to the live match center.
                </p>
              </div>
            </div>
          </div>

          {/* Interactive Tactical Pitch */}
          <div className="glass-panel" style={{ padding: 'clamp(0.75rem, 2vw, 1.75rem)' }}>
            <TacticalPitch
              players={squadPlayers}
              formation={match.home_formation || '4-3-3'}
              savedPositions={match.home_lineup_coords}
              primaryColor={club.primary_color}
              isEditable={true}
              matchEvents={events}
              onSaveFormation={handleSaveTacticalLineup}
              teamName={match.is_club_home ? match.home_team_name : match.away_team_name}
              allowOrientationToggle={true}
            />
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: CLOCK & STOPPAGE TIME BOARD */}
      {/* ========================================================================= */}
      {adminTab === 'clock' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem' }}>
          {/* Stoppage Time Board (4th Official LED) */}
          <div className="glass-panel" style={{ padding: '2rem' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#FFFFFF', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Timer size={18} color="#F59E0B" /> 4th Official Stoppage Board
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
              Select additional stoppage time indicated by the match referee.
            </p>

            {/* LED Display Box */}
            <div style={{
              background: '#040609',
              border: '2px solid #F59E0B',
              borderRadius: '16px',
              padding: '1.5rem',
              textAlign: 'center',
              marginBottom: '1.5rem',
              boxShadow: '0 0 25px rgba(245, 158, 11, 0.3)',
            }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#F59E0B', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                Official Stoppage Time
              </span>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '3.5rem', fontWeight: 900, color: '#F59E0B', marginTop: '0.2rem' }}>
                +{match.added_time}&apos;
              </div>
            </div>

            {/* Quick Added Time Buttons */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(48px, 1fr))', gap: '0.5rem' }}>
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 10].map(mins => (
                <button
                  key={mins}
                  onClick={() => handleSetAddedTime(mins)}
                  className="btn btn-sm"
                  style={{
                    background: match.added_time === mins ? '#F59E0B' : 'rgba(255, 255, 255, 0.05)',
                    color: match.added_time === mins ? '#000000' : '#FFFFFF',
                    fontWeight: 800,
                    border: '1px solid',
                    borderColor: match.added_time === mins ? '#F59E0B' : 'var(--border-subtle)',
                  }}
                >
                  +{mins}&apos;
                </button>
              ))}
            </div>
          </div>

          {/* Period Transition Manager */}
          <div className="glass-panel" style={{ padding: '2rem' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#FFFFFF', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Clock size={18} color="#10B981" /> Match Period Transition
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
              Trigger whistle transitions to control live status on supporter feeds.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <button
                onClick={() => handlePeriodTransition('first_half', 'live', 1)}
                className="btn btn-secondary"
                style={{ justifyContent: 'space-between', padding: '0.85rem 1.25rem' }}
              >
                <span>Kickoff (1st Half Start)</span>
                <span className="badge badge-primary">1&apos;</span>
              </button>

              <button
                onClick={() => handlePeriodTransition('halftime', 'halftime', 45)}
                className="btn btn-secondary"
                style={{ justifyContent: 'space-between', padding: '0.85rem 1.25rem' }}
              >
                <span>Half Time Whistle</span>
                <span className="badge badge-gold">HT 45&apos;</span>
              </button>

              <button
                onClick={() => handlePeriodTransition('second_half', 'live', 46)}
                className="btn btn-secondary"
                style={{ justifyContent: 'space-between', padding: '0.85rem 1.25rem' }}
              >
                <span>2nd Half Kickoff</span>
                <span className="badge badge-primary">46&apos;</span>
              </button>

              <button
                onClick={() => handlePeriodTransition('extra_time', 'live', 91)}
                className="btn btn-secondary"
                style={{ justifyContent: 'space-between', padding: '0.85rem 1.25rem' }}
              >
                <span>Extra Time (Cup/Knockout)</span>
                <span className="badge badge-primary">ET 91&apos;</span>
              </button>

              <button
                onClick={() => handlePeriodTransition('penalties', 'live', 120)}
                className="btn btn-secondary"
                style={{ justifyContent: 'space-between', padding: '0.85rem 1.25rem' }}
              >
                <span>Penalty Shootout</span>
                <span className="badge badge-gold">PSO</span>
              </button>

              <button
                onClick={() => {
                  handlePeriodTransition('full_time', 'completed', 90);
                  setIsAuditModalOpen(true);
                }}
                className="btn btn-primary"
                style={{ justifyContent: 'space-between', padding: '0.85rem 1.25rem', background: '#3B82F6' }}
              >
                <span>Full Time (Final Whistle & Audit)</span>
                <span className="badge" style={{ background: 'rgba(255,255,255,0.2)', color: '#FFF' }}>FT</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Post-Match Stats Audit Modal */}
      <StatsAuditModal
        match={match}
        events={events}
        squadPlayers={squadPlayers}
        isOpen={isAuditModalOpen}
        onClose={() => setIsAuditModalOpen(false)}
        onAuditCompleted={() => {
          showFeedback('Match stats successfully verified and baked into season records!');
        }}
      />

      {/* Matchday Turnstile Gate Check-In & Scanner Modal */}
      <QRScannerModal
        isOpen={isCheckinModalOpen}
        onClose={() => setIsCheckinModalOpen(false)}
        mode="match_checkin"
        targetMatch={match}
      />

      {/* Schedule Fixture Modal */}
      {isCreateFixtureOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1rem',
        }}>
          <div className="glass-panel" style={{
            width: '100%',
            maxWidth: '560px',
            padding: '2rem',
            borderRadius: '16px',
            border: '1px solid var(--border-subtle)',
            background: 'var(--bg-surface)',
            boxShadow: '0 24px 48px rgba(0,0,0,0.6)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.3rem', fontWeight: 900, color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <CalendarDays size={20} color="var(--club-primary)" />
                Schedule Match Fixture
              </h3>
              <button
                onClick={() => setIsCreateFixtureOpen(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateFixture}>
              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label className="form-label">Opponent Club Name *</label>
                <input
                  type="text"
                  required
                  className="form-input"
                  placeholder="e.g. Metro Rovers, St. Jude United"
                  value={fixtureOpponent}
                  onChange={e => setFixtureOpponent(e.target.value)}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                <div className="form-group">
                  <label className="form-label">Competition</label>
                  <input
                    type="text"
                    className="form-input"
                    value={fixtureCompetition}
                    onChange={e => setFixtureCompetition(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Associated Season *</label>
                  <select
                    className="form-select"
                    value={fixtureSeason}
                    onChange={e => setFixtureSeason(e.target.value)}
                  >
                    {clubSeasons.map(s => (
                      <option key={s.id} value={s.name}>
                        {s.name} {s.is_current ? '(Current Active)' : ''}
                      </option>
                    ))}
                    {!clubSeasons.some(s => s.name === fixtureSeason) && (
                      <option value={fixtureSeason}>{fixtureSeason}</option>
                    )}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                <div className="form-group">
                  <label className="form-label">Kickoff Date & Time *</label>
                  <input
                    type="datetime-local"
                    required
                    className="form-input"
                    value={fixtureDate}
                    onChange={e => setFixtureDate(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Venue / Stadium</label>
                  <input
                    type="text"
                    className="form-input"
                    value={fixtureVenue}
                    onChange={e => setFixtureVenue(e.target.value)}
                  />
                </div>
              </div>

              <div style={{
                background: 'rgba(255, 255, 255, 0.03)',
                padding: '0.85rem 1rem',
                borderRadius: '8px',
                border: '1px solid var(--border-subtle)',
                marginBottom: '1.5rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                cursor: 'pointer',
              }} onClick={() => setFixtureIsHome(!fixtureIsHome)}>
                <input
                  type="checkbox"
                  id="fixtureHomeCheck"
                  checked={fixtureIsHome}
                  onChange={e => setFixtureIsHome(e.target.checked)}
                  style={{ width: '18px', height: '18px', accentColor: 'var(--club-primary)', cursor: 'pointer' }}
                />
                <label htmlFor="fixtureHomeCheck" style={{ cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600, color: '#FFFFFF' }}>
                  {club.name} is the Home Team (Playing at {club.stadium_name})
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setIsCreateFixtureOpen(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                >
                  Schedule Fixture
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
