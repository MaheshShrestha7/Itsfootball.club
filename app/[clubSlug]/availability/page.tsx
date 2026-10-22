'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useClub } from '@/lib/club-context';
import { useAuth } from '@/lib/auth-context';
import { AvailabilityStatus, isPlayerMember } from '@/lib/supabase/types';
import PlayerAvatar from '@/components/PlayerAvatar';
import { periodLabel } from '@/lib/match-clock';
import { DEFAULT_CREST, crestOnError } from '@/lib/crest';
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
  ChevronRight,
  Sparkles,
  ExternalLink,
  ArrowRight
} from 'lucide-react';
import { squadForMatch } from '@/lib/teams';
import { defaultFixture } from '@/lib/fixtures';
import { DATE_LOCALE } from '@/lib/dates';

function AvailabilityHub() {
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
    ensureAvailability,
    syncStatus,
    clubTeams,
    clubTeamMembers,
    tournamentParticipants,
  } = useClub();

  const club = selectClubBySlug(slug);

  // Filter squad players for this club
  const squadPlayers = useMemo(() => {
    if (!club) return [];
    return members.filter(m => m.club_id === club.id && isPlayerMember(m));
  }, [club, members]);

  // Every fixture for this club, soonest first, so the coach can pick which one to RSVP for
  const clubMatches = useMemo(() => {
    if (!club) return [];
    return matches
      .filter(m => m.club_id === club.id)
      .sort((a, b) => new Date(a.match_date).getTime() - new Date(b.match_date).getTime());
  }, [club, matches]);

  // Opens on the club's next fixture (not another club's game in a cup it hosts); recomputed as data arrives
  const defaultMatch = useMemo(
    () => (club ? defaultFixture(clubMatches, tournamentParticipants, club.name, { skipLive: true }) : undefined),
    [club, clubMatches, tournamentParticipants]
  );

  const [selectedMatchId, setSelectedMatchId] = useState<string>(() => {
    return defaultMatch?.id || '';
  });

  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  // Roster row whose personal RSVP link was just copied, and the row whose note is open for editing
  const [copiedPlayerId, setCopiedPlayerId] = useState<string | null>(null);
  const [notePlayerId, setNotePlayerId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState<string>('');
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const targetMatch = clubMatches.find(m => m.id === selectedMatchId) || defaultMatch;
  // The fixture's team squad once the club has several teams (everyone otherwise)
  const matchSquad = useMemo(
    () => squadForMatch(squadPlayers, targetMatch, clubTeams, clubTeamMembers),
    [squadPlayers, targetMatch, clubTeams, clubTeamMembers]
  );

  // Opened from a player's personal link: show that link's fixture
  useEffect(() => {
    if (!token) return;
    const matchId = getAvailabilityByToken(token)?.availability.match_id;
    if (matchId) setSelectedMatchId(matchId);
  }, [token, getAvailabilityByToken]);

  // Give every squad player a personal, unguessable RSVP link for this match. Only once the
  // admin's own data has loaded: until then only the public view is here (available players,
  // no tokens), and rows that already exist would be created again as duplicates.
  const dataLoaded = ['off', 'idle', 'saving', 'readonly'].includes(syncStatus.phase);
  useEffect(() => {
    if (!targetMatch || !dataLoaded) return;
    matchSquad.forEach(p => ensureAvailability(targetMatch.id, p.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetMatch?.id, matchSquad.length, dataLoaded]);

  // Match Availabilities
  const matchAvailabilities = useMemo(() => {
    if (!targetMatch) return [];
    return availabilities.filter(a => a.match_id === targetMatch.id);
  }, [availabilities, targetMatch]);

  // Map squad players with their availability status
  const playerRosterWithStatus = useMemo(() => {
    return matchSquad.map(player => {
      const record = matchAvailabilities.find(a => a.member_id === player.id);
      return {
        player,
        availability: record || {
          id: `tmp-${player.id}`,
          club_id: club?.id || '',
          match_id: targetMatch?.id,
          member_id: player.id,
          status: 'pending' as AvailabilityStatus,
          response_token: '',
        },
      };
    });
  }, [matchSquad, matchAvailabilities, club, targetMatch]);

  // Counts breakdown
  const confirmedCount = playerRosterWithStatus.filter(p => p.availability.status === 'available').length;
  const maybeCount = playerRosterWithStatus.filter(p => p.availability.status === 'maybe').length;
  const unavailableCount = playerRosterWithStatus.filter(p => p.availability.status === 'unavailable').length;
  const pendingCount = playerRosterWithStatus.filter(p => p.availability.status === 'pending').length;

  if (!club) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p>Loading club...</p>
      </div>
    );
  }

  // Admin-only manual override: set a player's answer directly from the roster,
  // regardless of what (or whether) that player has responded themselves.
  const handleAdminSetStatus = (memberId: string, status: AvailabilityStatus) => {
    if (!targetMatch) return;
    const player = squadPlayers.find(p => p.id === memberId);
    const existingNote = matchAvailabilities.find(a => a.member_id === memberId)?.note;
    setPlayerAvailability(targetMatch.id, memberId, status, existingNote);
    setFeedbackToast(`${player?.full_name || 'Player'} manually marked ${status.toUpperCase()} by admin`);
    setTimeout(() => setFeedbackToast(null), 3500);
  };

  const openNote = (memberId: string, note?: string) => {
    setNotePlayerId(notePlayerId === memberId ? null : memberId);
    setNoteDraft(note || '');
  };

  // Saves the note and keeps the player's current answer (a player with no answer yet stays pending)
  const handleSaveNote = (memberId: string, status: AvailabilityStatus) => {
    if (!targetMatch) return;
    setPlayerAvailability(targetMatch.id, memberId, status, noteDraft);
    setNotePlayerId(null);
    setFeedbackToast('Note saved');
    setTimeout(() => setFeedbackToast(null), 3500);
  };

  const shareableUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/${club.slug}/availability`
    : `https://itsfootball.club/${club.slug}/availability`;

  const whatsappMessage = encodeURIComponent(
    `⚽ *${club.name} Match Call-Up*\n` +
    `🆚 ${targetMatch?.home_team_name} vs ${targetMatch?.away_team_name}\n` +
    `📍 ${targetMatch?.venue}\n` +
    `📅 ${targetMatch ? new Date(targetMatch.match_date).toLocaleDateString(DATE_LOCALE, { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}\n\n` +
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

  // Copies one player's personal link, which opens their own one-tap RSVP page
  const handleCopyPlayerLink = (memberId: string, responseToken: string) => {
    if (!responseToken || typeof navigator === 'undefined') return;
    navigator.clipboard.writeText(`${shareableUrl}?token=${responseToken}`);
    setCopiedPlayerId(memberId);
    setTimeout(() => setCopiedPlayerId(null), 2000);
  };

  // The answers an admin can set from a roster row
  const overrideOptions: { value: AvailabilityStatus; label: string; title: string; icon: typeof CheckCircle2; color: string; border: string; bg: string }[] = [
    { value: 'available', label: 'In', title: 'available', icon: CheckCircle2, color: 'var(--c-green)', border: '#10B981', bg: 'rgba(16, 185, 129, 0.2)' },
    { value: 'maybe', label: 'Maybe', title: 'doubtful', icon: AlertCircle, color: 'var(--c-amber)', border: '#F59E0B', bg: 'rgba(245, 158, 11, 0.2)' },
    { value: 'unavailable', label: 'Out', title: 'unavailable', icon: XCircle, color: 'var(--c-red)', border: '#EF4444', bg: 'rgba(239, 68, 68, 0.2)' },
  ];
  const rowButtonStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '0.3rem',
    padding: '0.35rem 0.6rem',
    borderRadius: '8px',
    fontSize: '0.7rem',
    fontWeight: 800,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  };

  const filteredRoster = playerRosterWithStatus.filter(({ player, availability }) => {
    const matchesSearch = player.full_name.toLowerCase().includes(searchFilter.toLowerCase())
      || (player.player_position && player.player_position.toLowerCase().includes(searchFilter.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || availability.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div style={{ minHeight: '100vh' }}>
      <main style={{ padding: '2rem 1rem 4rem', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
        {/* Header Breadcrumbs & Title */}
        <div style={{ marginBottom: '2rem' }}>
          {/* Short labels kept on one line each, so the trail reads as one line on a phone */}
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
            <Link href={`/${club.slug}`} title={club.name} style={{ color: 'var(--text-secondary)', textDecoration: 'none', whiteSpace: 'nowrap' }}>{club.short_name || club.name}</Link>
            <ChevronRight size={14} />
            <span className="text-primary" style={{ whiteSpace: 'nowrap' }}>Availability &amp; RSVP</span>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
            <div>
              <h1 style={{ fontSize: 'clamp(1.6rem, 3vw, 2.2rem)', fontWeight: 900, color: 'var(--text-primary)' }}>
                Pre-Match Availability Hub
              </h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', marginTop: '0.35rem' }}>
                One-tap availability responses for squad members without chaotic WhatsApp group clutter.
              </p>
            </div>

            {/* Quick Action Buttons */}
            <div className="row row-loose">
              <button
                onClick={handleCopyLink}
                className="btn btn-secondary btn-sm row"
                title="Copy general availability link"
              >
                {copiedLink ? <Check size={14} color="var(--c-green)" /> : <Copy size={14} />}
                <span>{copiedLink ? 'Copied Link!' : 'Copy Team Link'}</span>
              </button>

              <a
                href={`https://api.whatsapp.com/send?text=${whatsappMessage}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary btn-sm"
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: '#25D366', color: '#062814', border: 'none' }}
              >
                <Share2 size={14} />
                <span>Call-Up via WhatsApp</span>
              </a>
            </div>
          </div>
        </div>

        {/* Feedback Toast */}
        {feedbackToast && (
          <div role="status" className="admin-save-toast" style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
            color: 'var(--text-primary)',
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

        {/* Main Grid: Left = Fixture Card, Right = Roster Breakdown */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(340px, 100%), 1fr))', gap: '1.75rem', alignItems: 'start' }}>
          
          {/* LEFT COLUMN: Fixture Details */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

            {/* Match Selector */}
            {clubMatches.length > 0 && (
              <div>
                <label htmlFor="availability-availability-for" style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                  Availability For:
                </label>
                <select data-view-ok id="availability-availability-for"
                  className="form-select"
                  value={targetMatch?.id || selectedMatchId}
                  onChange={e => setSelectedMatchId(e.target.value)}
                  style={{ width: '100%', padding: '0.65rem 0.85rem', fontSize: '0.9rem' }}
                >
                  {clubMatches.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.home_team_name} vs {m.away_team_name} — {new Date(m.match_date).toLocaleDateString(DATE_LOCALE, { day: 'numeric', month: 'short', year: 'numeric' })} ({m.status})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* 1. Upcoming Fixture Card */}
            {targetMatch && (
              <div className="glass-panel" style={{ padding: '1.5rem', border: `1.5px solid ${club.primary_color}40`, position: 'relative', overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <span className="badge badge-secondary" style={{ fontSize: '0.72rem' }}>
                    {targetMatch.competition}
                  </span>
                  <span style={{ fontSize: '0.78rem', color: 'var(--c-amber)', fontWeight: 800 }}>
                    {periodLabel(targetMatch.period).toUpperCase()}
                  </span>
                </div>

                {/* Each side gets an equal share and wraps its name, so long names never crowd the VS */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', padding: '0.75rem 0', borderBottom: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flex: '1 1 0', minWidth: 0 }}>
                    <img loading="eager" decoding="async" width={40} height={40} src={targetMatch.home_team_logo || DEFAULT_CREST} onError={crestOnError} alt={`${targetMatch.home_team_name} crest`} style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                    <span style={{ fontWeight: 800, fontSize: '1rem', lineHeight: 1.25, color: 'var(--text-primary)', overflowWrap: 'anywhere', minWidth: 0 }}>{targetMatch.home_team_name}</span>
                  </div>
                  <span style={{ fontSize: '0.85rem', fontWeight: 900, color: 'var(--text-muted)', flexShrink: 0, padding: '0 0.25rem' }}>VS</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexDirection: 'row-reverse', flex: '1 1 0', minWidth: 0 }}>
                    <img loading="eager" decoding="async" width={40} height={40} src={targetMatch.away_team_logo || DEFAULT_CREST} onError={crestOnError} alt={`${targetMatch.away_team_name} crest`} style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                    <span style={{ fontWeight: 800, fontSize: '1rem', lineHeight: 1.25, color: 'var(--text-primary)', overflowWrap: 'anywhere', minWidth: 0, textAlign: 'right' }}>{targetMatch.away_team_name}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  <div className="row">
                    <Calendar size={15} color={club.primary_color} />
                    <span>{new Date(targetMatch.match_date).toLocaleDateString(DATE_LOCALE, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</span>
                  </div>
                  <div className="row">
                    <Clock size={15} color={club.primary_color} />
                    <span>Kickoff: {new Date(targetMatch.match_date).toLocaleTimeString(DATE_LOCALE, { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <div className="row">
                    <MapPin size={15} color={club.primary_color} />
                    <span>{targetMatch.venue}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Quick Link to Draft Lineup for Coaches */}
            <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-primary)' }}>Coach Draft Workbench</div>
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
                <h3 style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
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
                <div style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--c-green)' }}>{confirmedCount}</div>
                <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--c-green)', textTransform: 'uppercase' }}>Confirmed</div>
              </div>

              <div style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '10px', padding: '0.75rem 0.5rem', textAlign: 'center' }}>
                <div style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--c-amber)' }}>{maybeCount}</div>
                <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--c-amber)', textTransform: 'uppercase' }}>Doubtful</div>
              </div>

              <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '10px', padding: '0.75rem 0.5rem', textAlign: 'center' }}>
                <div style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--c-red)' }}>{unavailableCount}</div>
                <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--c-red)', textTransform: 'uppercase' }}>Out</div>
              </div>

              <div style={{ background: 'rgba(var(--tint-rgb), 0.05)', border: '1px solid var(--border-subtle)', borderRadius: '10px', padding: '0.75rem 0.5rem', textAlign: 'center' }}>
                <div style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--text-muted)' }}>{pendingCount}</div>
                <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Pending</div>
              </div>
            </div>

            {/* Filter Bar */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.65rem', marginBottom: '1rem' }}>
              <input data-view-ok aria-label="Search players"
                type="text"
                className="form-input"
                placeholder="Search player or position..."
                value={searchFilter}
                onChange={e => setSearchFilter(e.target.value)}
                style={{ flex: 1, minWidth: '160px', padding: '0.45rem 0.75rem', fontSize: '0.82rem' }}
              />

              <div style={{ display: 'flex', gap: '0.25rem', background: 'rgba(var(--shade-rgb), 0.3)', padding: '2px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                {['all', 'available', 'maybe', 'unavailable'].map(st => (
                  <button data-view-ok
                    key={st}
                    onClick={() => setStatusFilter(st)}
                    style={{
                      padding: '0.25rem 0.55rem',
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      borderRadius: '5px',
                      border: 'none',
                      background: statusFilter === st ? club.primary_color : 'transparent',
                      color: statusFilter === st ? 'var(--club-primary-contrast, #090D16)' : 'var(--text-muted)',
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
                    available: { bg: 'rgba(16, 185, 129, 0.15)', text: 'var(--c-green)', border: 'rgba(16, 185, 129, 0.4)', icon: CheckCircle2, label: 'Available' },
                    maybe: { bg: 'rgba(245, 158, 11, 0.15)', text: 'var(--c-amber)', border: 'rgba(245, 158, 11, 0.4)', icon: AlertCircle, label: 'Doubtful' },
                    unavailable: { bg: 'rgba(239, 68, 68, 0.15)', text: 'var(--c-red)', border: 'rgba(239, 68, 68, 0.4)', icon: XCircle, label: 'Out' },
                    pending: { bg: 'rgba(var(--tint-rgb), 0.05)', text: 'var(--text-muted)', border: 'var(--border-subtle)', icon: HelpCircle, label: 'Pending' },
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
                        background: 'rgba(var(--dk-15-23-42), 0.6)',
                        border: '1px solid var(--border-subtle)',
                        gap: '0.75rem',
                        flexWrap: 'wrap',
                      }}
                    >
                      {/* Player Info: takes the whole first line on narrow screens, status + actions wrap below */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0, flex: '1 1 12rem' }}>
                        <PlayerAvatar photoUrl={player.photo_url} name={player.full_name} size={36} />
                        <div className="min-w-0">
                          <div className="row">
                            <span style={{ fontWeight: 800, fontSize: '0.88rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>
                              {player.full_name}
                            </span>
                            <span className="shrink-0" style={{ fontSize: '0.7rem', color: 'var(--club-ink)', fontWeight: 900, fontFamily: 'var(--font-mono)' }}>
                              #{player.jersey_number || '-'}
                            </span>
                            <span className="badge badge-secondary shrink-0" style={{ fontSize: '0.7rem', padding: '0.1rem 0.35rem' }}>
                              {player.player_position || 'Squad'}
                            </span>
                          </div>

                          {availability.note && (
                            <div style={{ fontSize: '0.74rem', color: 'var(--c-amber)', fontStyle: 'italic', marginTop: '0.15rem' }}>
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

                      {/* Admin Manual Override: set the answer, add a note, or copy the player's own RSVP link */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', flexWrap: 'wrap', minWidth: 0 }}>
                        {overrideOptions.map(o => {
                          const OptionIcon = o.icon;
                          const active = availability.status === o.value;
                          return (
                            <button
                              key={o.value}
                              type="button"
                              onClick={() => handleAdminSetStatus(player.id, o.value)}
                              title={`Mark ${player.full_name} ${o.title}`}
                              style={{
                                ...rowButtonStyle,
                                border: `1px solid ${active ? o.border : 'var(--border-subtle)'}`,
                                background: active ? o.bg : 'rgba(var(--tint-rgb), 0.03)',
                                color: o.color,
                              }}
                            >
                              <OptionIcon size={13} />
                              <span>{o.label}</span>
                            </button>
                          );
                        })}
                        <button
                          type="button"
                          onClick={() => openNote(player.id, availability.note)}
                          title={`${availability.note ? 'Edit' : 'Add'} a note for ${player.full_name}`}
                          style={{ ...rowButtonStyle, border: '1px solid var(--border-subtle)', background: notePlayerId === player.id ? 'rgba(var(--tint-rgb), 0.1)' : 'rgba(var(--tint-rgb), 0.03)', color: 'var(--text-secondary)' }}
                        >
                          <MessageSquare size={13} />
                          <span>Note</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCopyPlayerLink(player.id, availability.response_token)}
                          disabled={!availability.response_token}
                          title={`Copy ${player.full_name}'s personal RSVP link`}
                          style={{ ...rowButtonStyle, border: '1px solid var(--border-subtle)', background: 'rgba(var(--tint-rgb), 0.03)', color: 'var(--text-secondary)', opacity: availability.response_token ? 1 : 0.5, cursor: availability.response_token ? 'pointer' : 'not-allowed' }}
                        >
                          {copiedPlayerId === player.id ? <Check size={13} color="var(--c-green)" /> : <Copy size={13} />}
                          <span>{copiedPlayerId === player.id ? 'Copied' : 'Link'}</span>
                        </button>
                      </div>

                      {/* Note editor, opened from the row's Note button */}
                      {notePlayerId === player.id && (
                        <div style={{ display: 'flex', gap: '0.5rem', flexBasis: '100%' }}>
                          <input aria-label={`Note for ${player.full_name}`}
                            type="text"
                            className="form-input"
                            placeholder="e.g. Can only play 2nd half, slight ankle sprain..."
                            value={noteDraft}
                            onChange={e => setNoteDraft(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') handleSaveNote(player.id, availability.status); }}
                            autoFocus
                            style={{ flex: 1, minWidth: 0, padding: '0.45rem 0.75rem', fontSize: '0.82rem' }}
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveNote(player.id, availability.status)}
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '0.45rem 0.8rem' }}
                          >
                            Save
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}


// ---------------------------------------------------------------------------
// Player view: a personal link (?token=...) lets one player answer for themselves
// ---------------------------------------------------------------------------
function PlayerRsvp({ slug, token }: { slug: string; token: string }) {
  const { selectClubBySlug, resolveAvailabilityToken, respondToAvailabilityToken, members } = useClub();
  const { user } = useAuth();
  const router = useRouter();
  const club = selectClubBySlug(slug);

  // The shared team link (no personal code): signed-in members answer in the club app instead
  const isMember = !!club && !!user && members.some(m => m.club_id === club.id && m.user_id === user.id
    && (m.membership_status || 'approved') === 'approved');
  useEffect(() => {
    if (!token && isMember) router.replace(`/${slug}/app`);
  }, [token, isMember, slug, router]);

  const [state, setState] = useState<'loading' | 'invalid' | 'ready'>('loading');
  const [record, setRecord] = useState<Awaited<ReturnType<typeof resolveAvailabilityToken>>>(null);
  const [status, setStatus] = useState<AvailabilityStatus>('pending');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!token) {
      setState('invalid');
      return;
    }
    resolveAvailabilityToken(token).then(res => {
      if (cancelled) return;
      if (!res) {
        setState('invalid');
        return;
      }
      setRecord(res);
      setStatus(res.availability.status);
      setNote(res.availability.note || '');
      setState('ready');
    });
    return () => {
      cancelled = true;
    };
    // resolve once per link; the context lookups it uses change as data loads
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, club?.id]);

  const respond = async (next: AvailabilityStatus) => {
    setSaving(true);
    setMessage(null);
    const res = await respondToAvailabilityToken(token, next, note);
    setSaving(false);
    if (res.success) {
      setStatus(next);
      setMessage({ ok: true, text: 'Thanks, your answer has been saved.' });
    } else {
      setMessage({ ok: false, text: res.error || 'Could not save your answer.' });
    }
  };

  const match = record?.match;
  const options: { value: AvailabilityStatus; label: string }[] = [
    { value: 'available', label: "I'm available" },
    { value: 'maybe', label: 'Maybe' },
    { value: 'unavailable', label: "Can't make it" },
  ];

  return (
    <div style={{ minHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem 1rem' }}>
      <div className="glass-panel" style={{ maxWidth: '520px', width: '100%', padding: '2rem' }}>
        {state === 'loading' && <p className="text-muted">Checking your link...</p>}

        {state === 'invalid' && !token && (
          <div className="text-center">
            <h2 style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
              {isMember ? 'Opening your matches...' : 'Sign in to answer'}
            </h2>
            {!isMember && (
              <>
                <p className="text-body" style={{ marginBottom: '1.25rem' }}>
                  Sign in to {club?.name || 'the club'} to say whether you can play. You can also use the personal link in your reminder email.
                </p>
                <Link href={`/${slug}/member?next=${encodeURIComponent(`/${slug}/app`)}`} className="btn btn-primary" style={{ justifyContent: 'center' }}>
                  Sign in
                </Link>
              </>
            )}
          </div>
        )}

        {state === 'invalid' && token && (
          <div className="text-center">
            <h2 style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Link not recognised</h2>
            <p className="text-body">
              This availability link is missing or no longer valid. Ask your club for your personal link.
            </p>
          </div>
        )}

        {state === 'ready' && record && (
          <>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
              {record.member ? `Hi ${record.member.full_name.split(' ')[0]}, are you in?` : 'Are you available?'}
            </h2>
            {match && (
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
                {match.home_team_name} vs {match.away_team_name}
                <br />
                {new Date(match.match_date).toLocaleString(DATE_LOCALE, { dateStyle: 'full', timeStyle: 'short' })} · {match.venue}
              </p>
            )}

            <div style={{ display: 'grid', gap: '0.6rem', marginBottom: '1rem' }}>
              {options.map(o => (
                <button
                  key={o.value}
                  type="button"
                  disabled={saving}
                  onClick={() => respond(o.value)}
                  aria-pressed={status === o.value}
                  className={`answer-pop ${status === o.value ? 'btn btn-primary' : 'btn btn-secondary'}`}
                  style={{ justifyContent: 'center' }}
                >
                  {o.label}
                </button>
              ))}
            </div>

            <textarea aria-label="Note (optional)"
              className="form-textarea"
              rows={2}
              maxLength={500}
              placeholder="Add a note (optional)"
              value={note}
              onChange={e => setNote(e.target.value)}
            />

            {message && (
              <div role="status" style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: message.ok ? 'var(--c-green)' : 'var(--c-red)' }}>
                {message.text}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function PlayerAvailabilityPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  // The admin menu re-uses this page; only there does it lock controls for view-only roles
  const inAdmin = usePathname()?.includes('/admin/') ?? false;
  const slug = params?.clubSlug as string;
  const token = searchParams?.get('token') || '';
  const { selectClubBySlug } = useClub();
  const { isLoading, can } = useAuth();
  const club = selectClubBySlug(slug);

  if (isLoading) {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
        Loading...
      </div>
    );
  }

  // Coaches / admins get the full squad hub; everyone else only their own personal link
  if (club && can(club.id, 'availability', inAdmin ? 'view' : 'edit')) return <AvailabilityHub />;
  return <PlayerRsvp slug={slug} token={token} />;
}
