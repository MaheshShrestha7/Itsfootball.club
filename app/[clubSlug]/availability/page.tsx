'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useClub } from '@/lib/club-context';
import { AvailabilityStatus } from '@/lib/supabase/types';
import ClubNavbar from '@/components/ClubNavbar';
import Footer from '@/components/Footer';
import {
  Calendar,
  Clock,
  MapPin,
  CheckCircle2,
  AlertCircle,
  XCircle,
  HelpCircle,
  Share2,
  Copy,
  Check,
  MessageSquare,
  Users,
  Shield,
  ChevronRight,
  Sparkles,
  ExternalLink,
  ArrowRight
} from 'lucide-react';

export default function PlayerAvailabilityPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = params?.clubSlug as string;
  const token = searchParams?.get('token') || '';

  const {
    selectClubBySlug,
    members,
    matches,
    events,
    availabilities,
    setPlayerAvailability,
    getAvailabilityByToken,
  } = useClub();

  const club = selectClubBySlug(slug);

  // Filter squad players for this club
  const squadPlayers = useMemo(() => {
    if (!club) return [];
    return members.filter(m => m.club_id === club.id && m.role === 'player');
  }, [club, members]);

  // Find next upcoming match or default to first match
  const upcomingMatches = useMemo(() => {
    if (!club) return [];
    return matches.filter(m => m.club_id === club.id && m.status === 'upcoming');
  }, [club, matches]);

  const [selectedMatchId, setSelectedMatchId] = useState<string>(() => {
    return upcomingMatches[0]?.id || matches[0]?.id || '';
  });

  // Selected player state
  const [activePlayerId, setActivePlayerId] = useState<string>('');
  const [rsvpStatus, setRsvpStatus] = useState<AvailabilityStatus>('available');
  const [rsvpNote, setRsvpNote] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [copiedText, setCopiedText] = useState<boolean>(false);
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Handle Token resolution if accessed via magic link
  useEffect(() => {
    if (token) {
      const resolved = getAvailabilityByToken(token);
      if (resolved) {
        setActivePlayerId(resolved.member.id);
        if (resolved.availability.match_id) {
          setSelectedMatchId(resolved.availability.match_id);
        }
        setRsvpStatus(resolved.availability.status);
        setRsvpNote(resolved.availability.note || '');
      }
    } else if (squadPlayers.length > 0 && !activePlayerId) {
      setActivePlayerId(squadPlayers[0].id);
    }
  }, [token, getAvailabilityByToken, squadPlayers, activePlayerId]);

  const targetMatch = matches.find(m => m.id === selectedMatchId) || matches[0];

  // Match Availabilities
  const matchAvailabilities = useMemo(() => {
    if (!targetMatch) return [];
    return availabilities.filter(a => a.match_id === targetMatch.id);
  }, [availabilities, targetMatch]);

  // Map squad players with their availability status
  const playerRosterWithStatus = useMemo(() => {
    return squadPlayers.map(player => {
      const record = matchAvailabilities.find(a => a.member_id === player.id);
      return {
        player,
        availability: record || {
          id: `tmp-${player.id}`,
          club_id: club?.id || '',
          match_id: targetMatch?.id,
          member_id: player.id,
          status: 'pending' as AvailabilityStatus,
          response_token: `tok-${player.id}`,
        },
      };
    });
  }, [squadPlayers, matchAvailabilities, club, targetMatch]);

  // Counts breakdown
  const confirmedCount = playerRosterWithStatus.filter(p => p.availability.status === 'available').length;
  const maybeCount = playerRosterWithStatus.filter(p => p.availability.status === 'maybe').length;
  const unavailableCount = playerRosterWithStatus.filter(p => p.availability.status === 'unavailable').length;
  const pendingCount = playerRosterWithStatus.filter(p => p.availability.status === 'pending').length;

  // Selected player entity
  const currentPlayer = squadPlayers.find(p => p.id === activePlayerId);
  const currentRecord = matchAvailabilities.find(a => a.member_id === activePlayerId);

  // Sync current record note/status when active player changes
  useEffect(() => {
    if (currentRecord) {
      setRsvpStatus(currentRecord.status);
      setRsvpNote(currentRecord.note || '');
    } else {
      setRsvpStatus('available');
      setRsvpNote('');
    }
  }, [activePlayerId, currentRecord]);

  if (!club) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p>Loading club...</p>
      </div>
    );
  }

  const handleSaveRsvp = (status: AvailabilityStatus) => {
    if (!activePlayerId || !targetMatch) return;
    setPlayerAvailability(targetMatch.id, activePlayerId, status, rsvpNote);
    setRsvpStatus(status);
    setFeedbackToast(`Availability confirmed: ${status.toUpperCase()}`);
    setTimeout(() => setFeedbackToast(null), 3500);
  };

  const shareableUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/${club.slug}/availability`
    : `https://itsfootball.club/${club.slug}/availability`;

  const playerMagicLink = currentPlayer
    ? `${shareableUrl}?token=${currentRecord?.response_token || `tok-${currentPlayer.id}`}`
    : shareableUrl;

  const whatsappMessage = encodeURIComponent(
    `⚽ *${club.name} Match Call-Up*\n` +
    `🆚 ${targetMatch?.home_team_name} vs ${targetMatch?.away_team_name}\n` +
    `📍 ${targetMatch?.venue}\n` +
    `📅 ${targetMatch ? new Date(targetMatch.match_date).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}\n\n` +
    `Squad members, please confirm your availability in 5 seconds (no WhatsApp clutter!):\n` +
    `${shareableUrl}`
  );

  const handleCopyLink = () => {
    if (typeof navigator !== 'undefined') {
      navigator.clipboard.writeText(shareableUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const handleCopyMagicLink = () => {
    if (typeof navigator !== 'undefined') {
      navigator.clipboard.writeText(playerMagicLink);
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2000);
    }
  };

  const filteredRoster = playerRosterWithStatus.filter(({ player, availability }) => {
    const matchesSearch = player.full_name.toLowerCase().includes(searchFilter.toLowerCase())
      || (player.player_position && player.player_position.toLowerCase().includes(searchFilter.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || availability.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)' }}>
      <ClubNavbar club={club} />

      <main style={{ flex: 1, padding: '2rem 1rem 4rem', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
        {/* Header Breadcrumbs & Title */}
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
            <Link href={`/${club.slug}`} style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>{club.name}</Link>
            <ChevronRight size={14} />
            <span style={{ color: '#FFFFFF' }}>Matchday Availability & RSVP</span>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
            <div>
              <h1 style={{ fontSize: 'clamp(1.6rem, 3vw, 2.2rem)', fontWeight: 900, color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <span>Pre-Match Availability Hub</span>
                <span className="badge badge-primary" style={{ fontSize: '0.75rem' }}>SquadGod RSVP</span>
              </h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', marginTop: '0.35rem' }}>
                One-tap availability responses for squad members without chaotic WhatsApp group clutter.
              </p>
            </div>

            {/* Quick Action Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <button
                onClick={handleCopyLink}
                className="btn btn-secondary btn-sm"
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                title="Copy general availability link"
              >
                {copiedLink ? <Check size={14} color="#10B981" /> : <Copy size={14} />}
                <span>{copiedLink ? 'Copied Link!' : 'Copy Team Link'}</span>
              </button>

              <a
                href={`https://api.whatsapp.com/send?text=${whatsappMessage}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary btn-sm"
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: '#25D366', color: '#FFFFFF', border: 'none' }}
              >
                <Share2 size={14} />
                <span>Call-Up via WhatsApp</span>
              </a>
            </div>
          </div>
        </div>

        {/* Feedback Toast */}
        {feedbackToast && (
          <div style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
            color: '#FFFFFF',
            padding: '0.85rem 1.4rem',
            borderRadius: '12px',
            fontWeight: 800,
            fontSize: '0.9rem',
            boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            animation: 'fadeIn 0.2s ease',
          }}>
            <CheckCircle2 size={18} />
            <span>{feedbackToast}</span>
          </div>
        )}

        {/* Main Grid: Left = Fixture & RSVP Card, Right = Roster Breakdown */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.75rem', alignItems: 'start' }}>
          
          {/* LEFT COLUMN: Fixture Details & 1-Tap Response */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            {/* 1. Upcoming Fixture Card */}
            {targetMatch && (
              <div className="glass-panel" style={{ padding: '1.5rem', border: `1.5px solid ${club.primary_color}40`, position: 'relative', overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <span className="badge badge-secondary" style={{ fontSize: '0.72rem' }}>
                    {targetMatch.competition}
                  </span>
                  <span style={{ fontSize: '0.78rem', color: '#F59E0B', fontWeight: 800 }}>
                    {targetMatch.period.toUpperCase().replace('_', ' ')}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 0', borderBottom: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <img src={targetMatch.home_team_logo} alt={targetMatch.home_team_name} style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }} />
                    <span style={{ fontWeight: 800, fontSize: '1.05rem', color: '#FFFFFF' }}>{targetMatch.home_team_name}</span>
                  </div>
                  <span style={{ fontSize: '0.85rem', fontWeight: 900, color: 'var(--text-muted)' }}>VS</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexDirection: 'row-reverse' }}>
                    <img src={targetMatch.away_team_logo} alt={targetMatch.away_team_name} style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }} />
                    <span style={{ fontWeight: 800, fontSize: '1.05rem', color: '#FFFFFF' }}>{targetMatch.away_team_name}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Calendar size={15} color={club.primary_color} />
                    <span>{new Date(targetMatch.match_date).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Clock size={15} color={club.primary_color} />
                    <span>Kickoff: {new Date(targetMatch.match_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <MapPin size={15} color={club.primary_color} />
                    <span>{targetMatch.venue}</span>
                  </div>
                </div>
              </div>
            )}

            {/* 2. Player 1-Tap Response Form */}
            <div className="glass-panel" style={{ padding: '1.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Shield size={18} color={club.primary_color} /> Confirm Your Status
                </h3>

                {token && (
                  <span className="badge badge-primary" style={{ fontSize: '0.68rem' }}>
                    ✨ Magic Link Verified
                  </span>
                )}
              </div>

              {/* Player Selector (if not locked by magic link) */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                  Responding Player:
                </label>
                <select
                  className="form-select"
                  value={activePlayerId}
                  onChange={e => setActivePlayerId(e.target.value)}
                  style={{ width: '100%', padding: '0.65rem 0.85rem', fontSize: '0.9rem' }}
                >
                  {squadPlayers.map(p => (
                    <option key={p.id} value={p.id}>
                      #{p.jersey_number || '-'} {p.full_name} ({p.player_position || 'Squad'})
                    </option>
                  ))}
                </select>
              </div>

              {/* 3 Large Tap Targets: Available, Maybe, Unavailable */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '1.25rem' }}>
                {/* Available */}
                <button
                  type="button"
                  onClick={() => handleSaveRsvp('available')}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    padding: '1.1rem 0.5rem',
                    borderRadius: '12px',
                    border: rsvpStatus === 'available' ? '2px solid #10B981' : '1px solid var(--border-subtle)',
                    background: rsvpStatus === 'available' ? 'rgba(16, 185, 129, 0.18)' : 'rgba(255, 255, 255, 0.03)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <CheckCircle2 size={24} color="#10B981" />
                  <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#FFFFFF' }}>I&apos;m In</span>
                  <span style={{ fontSize: '0.68rem', color: '#10B981', fontWeight: 700 }}>Available</span>
                </button>

                {/* Maybe */}
                <button
                  type="button"
                  onClick={() => handleSaveRsvp('maybe')}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    padding: '1.1rem 0.5rem',
                    borderRadius: '12px',
                    border: rsvpStatus === 'maybe' ? '2px solid #F59E0B' : '1px solid var(--border-subtle)',
                    background: rsvpStatus === 'maybe' ? 'rgba(245, 158, 11, 0.18)' : 'rgba(255, 255, 255, 0.03)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <AlertCircle size={24} color="#F59E0B" />
                  <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#FFFFFF' }}>Doubtful</span>
                  <span style={{ fontSize: '0.68rem', color: '#F59E0B', fontWeight: 700 }}>Maybe</span>
                </button>

                {/* Unavailable */}
                <button
                  type="button"
                  onClick={() => handleSaveRsvp('unavailable')}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    padding: '1.1rem 0.5rem',
                    borderRadius: '12px',
                    border: rsvpStatus === 'unavailable' ? '2px solid #EF4444' : '1px solid var(--border-subtle)',
                    background: rsvpStatus === 'unavailable' ? 'rgba(239, 68, 68, 0.18)' : 'rgba(255, 255, 255, 0.03)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <XCircle size={24} color="#EF4444" />
                  <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#FFFFFF' }}>Can&apos;t Make It</span>
                  <span style={{ fontSize: '0.68rem', color: '#EF4444', fontWeight: 700 }}>Out</span>
                </button>
              </div>

              {/* Optional Player Note */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                  Coach Note / Timing details (optional):
                </label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Can only play 2nd half, slight ankle sprain..."
                    value={rsvpNote}
                    onChange={e => setRsvpNote(e.target.value)}
                    style={{ flex: 1, padding: '0.55rem 0.85rem', fontSize: '0.85rem' }}
                  />
                  <button
                    type="button"
                    onClick={() => handleSaveRsvp(rsvpStatus)}
                    className="btn btn-secondary btn-sm"
                    style={{ padding: '0.55rem 0.9rem' }}
                  >
                    Update Note
                  </button>
                </div>
              </div>

              {/* Personal Magic Link Box for Player */}
              {currentPlayer && (
                <div style={{
                  background: 'rgba(0, 0, 0, 0.3)',
                  padding: '0.85rem',
                  borderRadius: '10px',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.75rem',
                  fontSize: '0.78rem',
                }}>
                  <div style={{ overflow: 'hidden' }}>
                    <div style={{ color: 'var(--text-muted)', fontWeight: 700 }}>Personal Magic RSVP Link:</div>
                    <div style={{ color: club.primary_color, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                      {playerMagicLink}
                    </div>
                  </div>

                  <button
                    onClick={handleCopyMagicLink}
                    className="btn btn-secondary btn-sm"
                    style={{ padding: '0.35rem 0.65rem', flexShrink: 0 }}
                    title="Copy unique one-tap magic link"
                  >
                    {copiedText ? <Check size={13} color="#10B981" /> : <Copy size={13} />}
                  </button>
                </div>
              )}
            </div>

            {/* Quick Link to Draft Lineup for Coaches */}
            <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#FFFFFF' }}>Coach Draft Workbench</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Experiment with tactical shapes and lineup rotations.</div>
              </div>
              <Link
                href={`/${club.slug}/admin/lineup/draft`}
                className="btn btn-secondary btn-sm"
                style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
              >
                <span>Draft Lineup</span>
                <ArrowRight size={14} />
              </Link>
            </div>
          </div>

          {/* RIGHT COLUMN: Real-Time Roster Breakdown */}
          <div className="glass-panel" style={{ padding: '1.75rem' }}>
            {/* Header & Metric Badges */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 900, color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Users size={20} color={club.primary_color} /> Squad Availability Breakdown
                </h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginTop: '0.2rem' }}>
                  Live headcount for this match fixture.
                </p>
              </div>
            </div>

            {/* 4 Status KPI Counters */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', marginBottom: '1.25rem' }}>
              <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '10px', padding: '0.75rem 0.5rem', textAlign: 'center' }}>
                <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#10B981' }}>{confirmedCount}</div>
                <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#10B981', textTransform: 'uppercase' }}>Confirmed</div>
              </div>

              <div style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '10px', padding: '0.75rem 0.5rem', textAlign: 'center' }}>
                <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#F59E0B' }}>{maybeCount}</div>
                <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#F59E0B', textTransform: 'uppercase' }}>Doubtful</div>
              </div>

              <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '10px', padding: '0.75rem 0.5rem', textAlign: 'center' }}>
                <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#EF4444' }}>{unavailableCount}</div>
                <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#EF4444', textTransform: 'uppercase' }}>Out</div>
              </div>

              <div style={{ background: 'rgba(255, 255, 255, 0.05)', border: '1px solid var(--border-subtle)', borderRadius: '10px', padding: '0.75rem 0.5rem', textAlign: 'center' }}>
                <div style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--text-muted)' }}>{pendingCount}</div>
                <div style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Pending</div>
              </div>
            </div>

            {/* Filter Bar */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.65rem', marginBottom: '1rem' }}>
              <input
                type="text"
                className="form-input"
                placeholder="Search player or position..."
                value={searchFilter}
                onChange={e => setSearchFilter(e.target.value)}
                style={{ flex: 1, minWidth: '160px', padding: '0.45rem 0.75rem', fontSize: '0.82rem' }}
              />

              <div style={{ display: 'flex', gap: '0.25rem', background: 'rgba(0,0,0,0.3)', padding: '2px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                {['all', 'available', 'maybe', 'unavailable'].map(st => (
                  <button
                    key={st}
                    onClick={() => setStatusFilter(st)}
                    style={{
                      padding: '0.25rem 0.55rem',
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      borderRadius: '5px',
                      border: 'none',
                      background: statusFilter === st ? club.primary_color : 'transparent',
                      color: statusFilter === st ? '#FFFFFF' : 'var(--text-muted)',
                      cursor: 'pointer',
                      textTransform: 'capitalize',
                    }}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            {/* Roster List Table */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '520px', overflowY: 'auto', paddingRight: '4px' }}>
              {filteredRoster.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                  No players match the current filter.
                </div>
              ) : (
                filteredRoster.map(({ player, availability }) => {
                  const statusColors = {
                    available: { bg: 'rgba(16, 185, 129, 0.15)', text: '#10B981', border: 'rgba(16, 185, 129, 0.4)', icon: CheckCircle2, label: 'Available' },
                    maybe: { bg: 'rgba(245, 158, 11, 0.15)', text: '#F59E0B', border: 'rgba(245, 158, 11, 0.4)', icon: AlertCircle, label: 'Doubtful' },
                    unavailable: { bg: 'rgba(239, 68, 68, 0.15)', text: '#EF4444', border: 'rgba(239, 68, 68, 0.4)', icon: XCircle, label: 'Out' },
                    pending: { bg: 'rgba(255, 255, 255, 0.05)', text: 'var(--text-muted)', border: 'var(--border-subtle)', icon: HelpCircle, label: 'Pending' },
                  };

                  const cfg = statusColors[availability.status] || statusColors.pending;
                  const Icon = cfg.icon;

                  return (
                    <div
                      key={player.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.65rem 0.85rem',
                        borderRadius: '10px',
                        background: 'rgba(15, 23, 42, 0.6)',
                        border: '1px solid var(--border-subtle)',
                        gap: '0.75rem',
                      }}
                    >
                      {/* Player Info */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
                        <img
                          src={player.photo_url}
                          alt={player.full_name}
                          style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                        />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <span style={{ fontWeight: 800, fontSize: '0.88rem', color: '#FFFFFF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {player.full_name}
                            </span>
                            <span style={{ fontSize: '0.68rem', color: club.primary_color, fontWeight: 900, fontFamily: 'var(--font-mono)' }}>
                              #{player.jersey_number || '-'}
                            </span>
                            <span className="badge badge-secondary" style={{ fontSize: '0.62rem', padding: '0.1rem 0.35rem' }}>
                              {player.player_position || 'Squad'}
                            </span>
                          </div>

                          {availability.note && (
                            <div style={{ fontSize: '0.74rem', color: '#F59E0B', fontStyle: 'italic', marginTop: '0.15rem' }}>
                              &ldquo;{availability.note}&rdquo;
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Status Pill */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        padding: '0.3rem 0.65rem',
                        borderRadius: '20px',
                        background: cfg.bg,
                        border: `1px solid ${cfg.border}`,
                        color: cfg.text,
                        fontSize: '0.74rem',
                        fontWeight: 800,
                        flexShrink: 0,
                      }}>
                        <Icon size={13} />
                        <span>{cfg.label}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>
      </main>

      <Footer club={club} />
    </div>
  );
}
