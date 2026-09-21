'use client';

import React, { useState, use, useMemo } from 'react';
import Link from 'next/link';
import { useClub } from '@/lib/club-context';
import { Match, MatchType, MatchStatus } from '@/lib/supabase/types';
import ImageUploadZone from '@/components/ImageUploadZone';
import { QRCodeSVG } from 'qrcode.react';
import {
  Calendar,
  Clock,
  MapPin,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  QrCode,
  Sparkles,
  Search,
  Filter,
  Star,
  ExternalLink,
  Copy,
  Printer,
  Shield,
  Radio,
  Trophy,
  Users,
  Eye,
  Check,
  X,
  AlertTriangle,
  Info,
  CalendarDays,
  Layers,
  ArrowRight
} from 'lucide-react';

const FLYER_PRESETS = [
  {
    name: 'Derby Clash Banner',
    url: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=1600&auto=format&fit=crop&q=80'
  },
  {
    name: 'Night Lights Stadium',
    url: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=1600&auto=format&fit=crop&q=80'
  },
  {
    name: 'Action Pitch Banner',
    url: 'https://images.unsplash.com/photo-1517466787929-bc90951d0974?w=1600&auto=format&fit=crop&q=80'
  },
  {
    name: 'Home Fortress Arena',
    url: 'https://images.unsplash.com/photo-1522778119026-d647f0596c20?w=1600&auto=format&fit=crop&q=80'
  }
];

export default function AdminMatchesPage({
  params,
}: {
  params: Promise<{ clubSlug: string }>;
}) {
  const resolvedParams = use(params);
  const {
    clubs,
    selectClubBySlug,
    matches,
    addMatch,
    updateMatch,
    deleteMatch,
    seasons,
    getActiveSeason
  } = useClub();

  const club = selectClubBySlug(resolvedParams.clubSlug) || clubs[0];
  const clubMatches = useMemo(() => matches.filter(m => m.club_id === club.id), [matches, club.id]);
  const activeSeason = getActiveSeason ? getActiveSeason(club.id) : null;
  const clubSeasons = seasons.filter(s => s.club_id === club.id);

  // Filters state
  const [statusTab, setStatusTab] = useState<'all' | 'upcoming' | 'completed' | 'live'>('all');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [seasonFilter, setSeasonFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingMatchId, setEditingMatchId] = useState<string | null>(null);
  const [qrModalMatch, setQrModalMatch] = useState<Match | null>(null);
  const [printPosterMatch, setPrintPosterMatch] = useState<Match | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Form State
  const defaultDate = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
  const [form, setForm] = useState<{
    title: string;
    match_type: MatchType;
    opponent_name: string;
    opponent_short_name: string;
    is_club_home: boolean;
    match_date: string;
    match_time: string;
    venue: string;
    match_flyer_url: string;
    description: string;
    competition: string;
    season: string;
    status: MatchStatus;
    is_completed: boolean;
    featured_on_hero: boolean;
    door_qr_checkin_enabled: boolean;
    home_score: number;
    away_score: number;
  }>({
    title: '',
    match_type: 'friendly',
    opponent_name: '',
    opponent_short_name: '',
    is_club_home: true,
    match_date: defaultDate,
    match_time: '15:00',
    venue: club.stadium_name || 'Home Stadium',
    match_flyer_url: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=1600&auto=format&fit=crop&q=80',
    description: '',
    competition: 'Club Friendly',
    season: activeSeason?.name || '2026/27',
    status: 'upcoming',
    is_completed: false,
    featured_on_hero: false,
    door_qr_checkin_enabled: true,
    home_score: 0,
    away_score: 0,
  });

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Open modal for creating match
  const handleOpenAddModal = () => {
    setEditingMatchId(null);
    setForm({
      title: '',
      match_type: 'friendly',
      opponent_name: '',
      opponent_short_name: '',
      is_club_home: true,
      match_date: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10),
      match_time: '15:00',
      venue: club.stadium_name || 'Home Stadium',
      match_flyer_url: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=1600&auto=format&fit=crop&q=80',
      description: 'Official club fixture. Gates open 60 minutes prior to kickoff.',
      competition: 'Club Friendly',
      season: activeSeason?.name || '2026/27',
      status: 'upcoming',
      is_completed: false,
      featured_on_hero: false,
      door_qr_checkin_enabled: true,
      home_score: 0,
      away_score: 0,
    });
    setIsFormModalOpen(true);
  };

  // Open modal for editing match
  const handleOpenEditModal = (m: Match) => {
    setEditingMatchId(m.id);
    let parsedDate = '';
    let parsedTime = m.match_time || '15:00';
    try {
      const dt = new Date(m.match_date);
      if (!isNaN(dt.getTime())) {
        parsedDate = dt.toISOString().slice(0, 10);
        if (!m.match_time) {
          parsedTime = dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
        }
      }
    } catch {
      parsedDate = defaultDate;
    }

    setForm({
      title: m.title || '',
      match_type: m.match_type || (m.competition.toLowerCase().includes('cup') ? 'tournament' : 'friendly'),
      opponent_name: m.opponent_name || (m.is_club_home ? m.away_team_name : m.home_team_name) || '',
      opponent_short_name: m.opponent_short_name || '',
      is_club_home: m.is_club_home,
      match_date: parsedDate,
      match_time: parsedTime,
      venue: m.venue || club.stadium_name,
      match_flyer_url: m.match_flyer_url || 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=1600&auto=format&fit=crop&q=80',
      description: m.description || '',
      competition: m.competition || (m.match_type === 'internal' ? 'Intra-Squad Match' : 'Club Friendly'),
      season: m.season || activeSeason?.name || '2026/27',
      status: m.status || 'upcoming',
      is_completed: m.status === 'completed',
      featured_on_hero: !!m.featured_on_hero,
      door_qr_checkin_enabled: m.door_qr_checkin_enabled ?? true,
      home_score: m.home_score ?? 0,
      away_score: m.away_score ?? 0,
    });
    setIsFormModalOpen(true);
  };

  // Quick Preset Handlers for Internal Match Type
  const handleInternalPreset = (presetName: string, shortName: string) => {
    setForm(prev => ({
      ...prev,
      match_type: 'internal',
      opponent_name: presetName,
      opponent_short_name: shortName,
      title: `${club.name} Intra-Squad: First Team vs ${presetName}`,
      competition: 'Intra-Squad Friendly',
      is_club_home: true,
      venue: club.stadium_name || 'Training Ground'
    }));
  };

  // Submit Match Form (Create or Update)
  const handleSubmitMatch = (e: React.FormEvent) => {
    e.preventDefault();

    // Sanitize user inputs
    const cleanTitle = form.title.replace(/<[^>]*>?/gm, '').trim();
    const cleanOpponent = form.opponent_name.replace(/<[^>]*>?/gm, '').trim();
    const cleanOpponentShort = form.opponent_short_name.replace(/<[^>]*>?/gm, '').trim().toUpperCase().slice(0, 8);
    const cleanVenue = form.venue.replace(/<[^>]*>?/gm, '').trim() || club.stadium_name;
    const cleanDescription = form.description.replace(/<[^>]*>?/gm, '').trim();
    const cleanCompetition = form.competition.replace(/<[^>]*>?/gm, '').trim() || (form.match_type === 'internal' ? 'Intra-Squad Match' : form.match_type === 'tournament' ? 'Cup Tournament' : 'Club Friendly');

    if (!cleanOpponent) {
      alert('Please provide an Opponent Name or internal squad name.');
      return;
    }

    const homeTeam = form.is_club_home ? club.name : cleanOpponent;
    const awayTeam = form.is_club_home ? cleanOpponent : club.name;
    const homeLogo = form.is_club_home ? (club.logo_url || '') : 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=100&auto=format&fit=crop&q=80';
    const awayLogo = form.is_club_home ? 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=100&auto=format&fit=crop&q=80' : (club.logo_url || '');

    // Combine date and time to ISO string
    let combinedDateIso = new Date().toISOString();
    try {
      const [year, month, day] = form.match_date.split('-').map(Number);
      const [hours, minutes] = (form.match_time || '15:00').split(':').map(Number);
      const dateObj = new Date(year, (month || 1) - 1, day || 1, hours || 0, minutes || 0);
      combinedDateIso = dateObj.toISOString();
    } catch {
      combinedDateIso = new Date(Date.now() + 3 * 86400000).toISOString();
    }

    const resolvedStatus: MatchStatus = form.status;
    const homeScore = Number(form.home_score) || 0;
    const awayScore = Number(form.away_score) || 0;

    if (editingMatchId) {
      // Update existing fixture - PRESERVE status & scores
      updateMatch(editingMatchId, {
        title: cleanTitle || `${homeTeam} vs ${awayTeam}`,
        match_type: form.match_type,
        opponent_name: cleanOpponent,
        opponent_short_name: cleanOpponentShort,
        competition: cleanCompetition,
        season: form.season,
        home_team_name: homeTeam,
        away_team_name: awayTeam,
        home_team_logo: homeLogo,
        away_team_logo: awayLogo,
        is_club_home: form.is_club_home,
        match_date: combinedDateIso,
        match_time: form.match_time,
        venue: cleanVenue,
        match_flyer_url: form.match_flyer_url,
        description: cleanDescription,
        status: resolvedStatus,
        featured_on_hero: form.featured_on_hero,
        door_qr_checkin_enabled: form.door_qr_checkin_enabled,
        home_score: homeScore,
        away_score: awayScore,
        ...(resolvedStatus === 'completed' ? { period: 'full_time' } : {}),
      });
      showToast(`Updated fixture: ${cleanTitle || cleanOpponent}`);
    } else {
      // Add new match
      const created = addMatch({
        club_id: club.id,
        title: cleanTitle || `${homeTeam} vs ${awayTeam}`,
        match_type: form.match_type,
        opponent_name: cleanOpponent,
        opponent_short_name: cleanOpponentShort,
        competition: cleanCompetition,
        season: form.season,
        home_team_name: homeTeam,
        away_team_name: awayTeam,
        home_team_logo: homeLogo,
        away_team_logo: awayLogo,
        is_club_home: form.is_club_home,
        match_date: combinedDateIso,
        match_time: form.match_time,
        venue: cleanVenue,
        match_flyer_url: form.match_flyer_url,
        description: cleanDescription,
        status: resolvedStatus,
        featured_on_hero: form.featured_on_hero,
        door_qr_checkin_enabled: form.door_qr_checkin_enabled,
        home_score: resolvedStatus === 'upcoming' ? 0 : homeScore,
        away_score: resolvedStatus === 'upcoming' ? 0 : awayScore,
        current_minute: 0,
        added_time: 0,
        period: resolvedStatus === 'completed' ? 'full_time' : 'pre_match',
      });
      showToast(`Scheduled new match: ${created.title || cleanOpponent}`);
    }

    setIsFormModalOpen(false);
  };

  // 1-Click Status Switcher (Upcoming <-> Completed)
  const handleToggleCompleted = (m: Match) => {
    const nextStatus: MatchStatus = m.status === 'completed' ? 'upcoming' : 'completed';
    updateMatch(m.id, {
      status: nextStatus,
      ...(nextStatus === 'completed' ? { period: 'full_time' } : {})
    });
    if (nextStatus === 'completed') {
      showToast(`Marked "${m.title || m.opponent_name || 'Match'}" as Completed. Hidden from live site upcoming view.`);
    } else {
      showToast(`Restored "${m.title || m.opponent_name || 'Match'}" to Upcoming Fixtures.`);
    }
  };

  // 1-Click Hero Slider Pin Toggle
  const handleToggleHeroSlider = (m: Match) => {
    const nextFeatured = !m.featured_on_hero;
    updateMatch(m.id, { featured_on_hero: nextFeatured });
    if (nextFeatured) {
      showToast(`Spotlighted "${m.title || m.opponent_name || 'Match'}" on Home Page Hero Slider!`);
    } else {
      showToast(`Removed "${m.title || m.opponent_name || 'Match'}" from Hero Slider.`);
    }
  };

  // 1-Click Delete Confirmation
  const handleDeleteMatch = (m: Match) => {
    if (confirm(`Are you sure you want to delete fixture "${m.title || m.opponent_name || m.home_team_name}"?`)) {
      deleteMatch(m.id);
      showToast(`Deleted fixture record.`);
    }
  };

  // Filtered Matches Calculation
  const filteredMatches = useMemo(() => {
    return clubMatches.filter(m => {
      // Status filter
      if (statusTab === 'upcoming' && m.status !== 'upcoming') return false;
      if (statusTab === 'completed' && m.status !== 'completed') return false;
      if (statusTab === 'live' && m.status !== 'live' && m.status !== 'halftime') return false;

      // Type filter
      if (typeFilter !== 'ALL') {
        if ((m.match_type || 'friendly') !== typeFilter) return false;
      }

      // Season filter
      if (seasonFilter !== 'ALL') {
        if (m.season !== seasonFilter) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = m.title?.toLowerCase().includes(q);
        const matchesOpponent = m.opponent_name?.toLowerCase().includes(q) || m.away_team_name.toLowerCase().includes(q) || m.home_team_name.toLowerCase().includes(q);
        const matchesVenue = m.venue.toLowerCase().includes(q);
        const matchesComp = m.competition.toLowerCase().includes(q);
        if (!matchesTitle && !matchesOpponent && !matchesVenue && !matchesComp) return false;
      }

      return true;
    }).sort((a, b) => new Date(b.match_date).getTime() - new Date(a.match_date).getTime());
  }, [clubMatches, statusTab, typeFilter, seasonFilter, searchQuery]);

  // Counts for KPI Cards
  const totalCount = clubMatches.length;
  const upcomingCount = clubMatches.filter(m => m.status === 'upcoming').length;
  const completedCount = clubMatches.filter(m => m.status === 'completed').length;
  const liveCount = clubMatches.filter(m => m.status === 'live' || m.status === 'halftime').length;
  const heroFeaturedCount = clubMatches.filter(m => m.featured_on_hero).length;
  const qrEnabledCount = clubMatches.filter(m => m.door_qr_checkin_enabled).length;

  const getCheckinUrl = (m: Match) => {
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/${club.slug}/match/${m.id}/checkin`;
    }
    return `/${club.slug}/match/${m.id}/checkin`;
  };

  const copyQrLink = (url: string) => {
    navigator.clipboard?.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  return (
    <div style={{ paddingBottom: '4rem' }}>
      {/* Toast Notification */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            bottom: '2rem',
            right: '2rem',
            background: 'var(--bg-surface-elevated)',
            color: '#FFFFFF',
            border: '1px solid var(--club-primary)',
            borderRadius: 'var(--radius-lg)',
            padding: '0.85rem 1.4rem',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
            fontSize: '0.88rem',
            fontWeight: 700,
            animation: 'fadeIn 0.2s ease-out'
          }}
        >
          <CheckCircle2 size={18} color="var(--club-primary)" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header Banner */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          marginBottom: '2rem'
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
            <span className="badge badge-primary">MATCHDAY OPERATIONS</span>
            <span className="badge" style={{ background: 'rgba(255, 255, 255, 0.08)', color: 'var(--text-muted)' }}>
              {activeSeason?.name || '2026/27'}
            </span>
          </div>
          <h1 style={{ fontSize: '2.2rem', fontWeight: 900, color: '#FFFFFF', lineHeight: 1.15 }}>
            Match Fixtures & Scheduling Hub
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '650px', marginTop: '0.35rem' }}>
            Schedule fixtures, assign match types, customize promotional flyers, spotlight matches on the homepage hero carousel, and configure door QR self-check-in stations.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <Link
            href={`/${club.slug}/admin/match-center`}
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <Radio size={16} color="#EF4444" />
            <span>Match Command Center</span>
          </Link>

          <button
            onClick={handleOpenAddModal}
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 800 }}
          >
            <Plus size={18} />
            <span>Schedule New Match</span>
          </button>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
          gap: '1rem',
          marginBottom: '2rem'
        }}
      >
        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>Total Matches</span>
            <CalendarDays size={18} />
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 900, color: '#FFFFFF' }}>{totalCount}</div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>All recorded fixtures</div>
        </div>

        <div className="glass-panel" style={{ padding: '1.25rem', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#10B981', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>Upcoming</span>
            <Calendar size={18} />
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 900, color: '#10B981' }}>{upcomingCount}</div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>Live on public site view</div>
        </div>

        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>Completed</span>
            <CheckCircle2 size={18} />
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 900, color: '#FFFFFF' }}>{completedCount}</div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>Archived to past results</div>
        </div>

        <div className="glass-panel" style={{ padding: '1.25rem', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#F59E0B', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>Hero Spotlight</span>
            <Sparkles size={18} />
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 900, color: '#F59E0B' }}>{heroFeaturedCount}</div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>Pinned to homepage hero</div>
        </div>

        <div className="glass-panel" style={{ padding: '1.25rem', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#3B82F6', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>Door QR Check-in</span>
            <QrCode size={18} />
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 900, color: '#3B82F6' }}>{qrEnabledCount}</div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>Gate turnstiles enabled</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div
        className="glass-panel"
        style={{
          padding: '1rem',
          borderRadius: 'var(--radius-lg)',
          marginBottom: '1.5rem',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem'
        }}
      >
        {/* Status Tabs */}
        <div style={{ display: 'flex', gap: '0.35rem', background: 'rgba(0, 0, 0, 0.3)', padding: '0.25rem', borderRadius: 'var(--radius-md)' }}>
          {(['all', 'upcoming', 'completed', 'live'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setStatusTab(tab)}
              style={{
                border: 'none',
                background: statusTab === tab ? club.primary_color : 'transparent',
                color: '#FFFFFF',
                padding: '0.45rem 0.9rem',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: 'pointer',
                textTransform: 'capitalize',
                transition: 'background 0.2s'
              }}
            >
              {tab === 'all' ? 'All Fixtures' : tab === 'live' ? `Live (${liveCount})` : tab}
            </button>
          ))}
        </div>

        {/* Filters and Search Input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          {/* Match Type Dropdown */}
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            className="form-input"
            style={{ width: 'auto', padding: '0.45rem 0.75rem', fontSize: '0.82rem' }}
          >
            <option value="ALL">All Match Types</option>
            <option value="internal">Internal / Intra-Squad</option>
            <option value="friendly">Friendly Fixture</option>
            <option value="tournament">Tournament / Cup</option>
          </select>

          {/* Season Dropdown */}
          <select
            value={seasonFilter}
            onChange={e => setSeasonFilter(e.target.value)}
            className="form-input"
            style={{ width: 'auto', padding: '0.45rem 0.75rem', fontSize: '0.82rem' }}
          >
            <option value="ALL">All Seasons</option>
            {clubSeasons.map(s => (
              <option key={s.id} value={s.name}>{s.name} {s.is_current ? '(Active)' : ''}</option>
            ))}
          </select>

          {/* Search Box */}
          <div style={{ position: 'relative', minWidth: '220px' }}>
            <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search opponent, title, venue..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="form-input"
              style={{ paddingLeft: '2.2rem', fontSize: '0.82rem', padding: '0.45rem 0.75rem 0.45rem 2.2rem' }}
            />
          </div>
        </div>
      </div>

      {/* Matches Grid / List */}
      {filteredMatches.length === 0 ? (
        <div className="glass-panel text-center" style={{ padding: '4rem 2rem' }}>
          <Calendar size={48} color="var(--text-muted)" style={{ margin: '0 auto 1rem auto' }} />
          <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#FFFFFF', marginBottom: '0.4rem' }}>
            No Matches Found
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
            {searchQuery || statusTab !== 'all' || typeFilter !== 'ALL'
              ? 'Try changing your search keywords or clearing active filters.'
              : 'Start by scheduling your first club fixture or friendly match.'}
          </p>
          <button onClick={handleOpenAddModal} className="btn btn-primary btn-sm">
            <Plus size={14} style={{ marginRight: '4px' }} />
            Schedule a Match
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {filteredMatches.map(m => {
            const isCompleted = m.status === 'completed';
            const isLive = m.status === 'live' || m.status === 'halftime';
            const matchType = m.match_type || 'friendly';
            const checkinUrl = getCheckinUrl(m);

            return (
              <div
                key={m.id}
                className="glass-panel admin-match-card-grid"
                style={{
                  padding: '1.25rem',
                  borderRadius: 'var(--radius-lg)',
                  border: isLive ? '1px solid #EF4444' : m.featured_on_hero ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid var(--border-medium)',
                  position: 'relative'
                }}
              >
                {/* Flyer Thumbnail or Visual Badge */}
                <div
                  className="match-flyer-thumb"
                  style={{
                    height: '100px',
                    borderRadius: 'var(--radius-md)',
                    overflow: 'hidden',
                    position: 'relative',
                    background: 'rgba(0,0,0,0.5)',
                    border: '1px solid var(--border-subtle)'
                  }}
                >
                  <img
                    src={m.match_flyer_url || 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&auto=format&fit=crop&q=80'}
                    alt={m.title || 'Match Flyer'}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      top: '6px',
                      left: '6px',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      background: 'rgba(0,0,0,0.75)',
                      fontSize: '0.65rem',
                      fontWeight: 800,
                      color: '#FFFFFF',
                      textTransform: 'uppercase'
                    }}
                  >
                    {matchType}
                  </div>
                  {m.is_club_home && (
                    <div
                      style={{
                        position: 'absolute',
                        bottom: '6px',
                        left: '6px',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        background: 'var(--club-primary)',
                        fontSize: '0.62rem',
                        fontWeight: 800,
                        color: '#FFFFFF'
                      }}
                    >
                      HOME
                    </div>
                  )}
                </div>

                {/* Match Details */}
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.35rem' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--club-primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {m.competition}
                    </span>
                    {m.season && (
                      <span className="badge" style={{ fontSize: '0.65rem', background: 'rgba(255,255,255,0.06)' }}>
                        {m.season}
                      </span>
                    )}

                    {/* Status Badge */}
                    {m.status === 'live' ? (
                      <span className="badge" style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#EF4444', border: '1px solid #EF4444', fontWeight: 800 }}>
                        <Radio size={10} className="animate-pulse" style={{ marginRight: '4px', verticalAlign: '-1px' }} />
                        LIVE • {m.current_minute}&apos; IN PLAY
                      </span>
                    ) : m.status === 'halftime' ? (
                      <span className="badge" style={{ background: 'rgba(245, 158, 11, 0.2)', color: '#F59E0B', border: '1px solid #F59E0B', fontWeight: 800 }}>
                        <Clock size={10} style={{ marginRight: '4px', verticalAlign: '-1px' }} />
                        HALF-TIME BREAK
                      </span>
                    ) : isCompleted ? (
                      <span className="badge" style={{ background: 'rgba(255, 255, 255, 0.1)', color: 'var(--text-muted)' }}>
                        COMPLETED
                      </span>
                    ) : m.status === 'postponed' ? (
                      <span className="badge" style={{ background: 'rgba(234, 179, 8, 0.2)', color: '#EAB308', border: '1px solid #EAB308' }}>
                        POSTPONED
                      </span>
                    ) : m.status === 'cancelled' ? (
                      <span className="badge" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#EF4444', border: '1px solid #EF4444' }}>
                        CANCELLED
                      </span>
                    ) : (
                      <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10B981', border: '1px solid #10B981' }}>
                        UPCOMING FIXTURE
                      </span>
                    )}

                    {m.featured_on_hero && (
                      <span className="badge" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#F59E0B', border: '1px solid #F59E0B' }}>
                        <Star size={10} style={{ marginRight: '3px', verticalAlign: '-1px' }} />
                        HERO PINNED
                      </span>
                    )}

                    {m.door_qr_checkin_enabled && (
                      <span className="badge" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#3B82F6', border: '1px solid #3B82F6' }}>
                        <QrCode size={10} style={{ marginRight: '3px', verticalAlign: '-1px' }} />
                        DOOR QR ({m.checkin_count || 0})
                      </span>
                    )}
                  </div>

                  <h3 style={{ fontSize: '1.2rem', fontWeight: 900, color: '#FFFFFF', marginBottom: '0.4rem', wordBreak: 'break-word' }}>
                    {m.title ? (
                      <span>{m.title} <span style={{ color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.95rem' }}>({m.home_team_name} vs {m.away_team_name})</span></span>
                    ) : (
                      `${m.home_team_name} vs ${m.away_team_name}`
                    )}
                  </h3>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                      <Calendar size={13} color="var(--club-primary)" />
                      {new Date(m.match_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                      <Clock size={13} color="var(--club-primary)" />
                      {m.match_time || new Date(m.match_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                      <MapPin size={13} color="var(--club-primary)" />
                      {m.venue}
                    </span>
                    {(isCompleted || isLive || (m.home_score !== undefined && m.home_score !== null && (m.home_score > 0 || m.away_score > 0))) && (
                      <span style={{ fontWeight: 800, color: '#FFFFFF', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                        <Trophy size={13} color="var(--club-primary)" />
                        Score: {m.home_score ?? 0} - {m.away_score ?? 0}
                      </span>
                    )}
                  </div>

                  {m.description && (
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.4rem', lineClamp: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {m.description}
                    </p>
                  )}
                </div>

                {/* Operations & Quick Actions */}
                <div className="match-card-actions" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', minWidth: 'min(100%, 170px)' }}>
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    {/* Hero Slider Feature Toggle */}
                    <button
                      type="button"
                      onClick={() => handleToggleHeroSlider(m)}
                      title={m.featured_on_hero ? 'Unpin from Homepage Hero Slider' : 'Spotlight on Homepage Hero Slider'}
                      style={{
                        flex: 1,
                        padding: '0.4rem 0.6rem',
                        borderRadius: 'var(--radius-sm)',
                        border: m.featured_on_hero ? '1px solid #F59E0B' : '1px solid var(--border-medium)',
                        background: m.featured_on_hero ? 'rgba(245, 158, 11, 0.15)' : 'rgba(0,0,0,0.3)',
                        color: m.featured_on_hero ? '#F59E0B' : 'var(--text-muted)',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.3rem'
                      }}
                    >
                      <Star size={13} fill={m.featured_on_hero ? '#F59E0B' : 'none'} />
                      <span>{m.featured_on_hero ? 'Featured' : 'Feature'}</span>
                    </button>

                    {/* Door QR Modal Button */}
                    <button
                      type="button"
                      onClick={() => setQrModalMatch(m)}
                      title="View Door Turnstile QR Code & Kiosk"
                      style={{
                        padding: '0.4rem 0.6rem',
                        borderRadius: 'var(--radius-sm)',
                        border: m.door_qr_checkin_enabled ? '1px solid #3B82F6' : '1px solid var(--border-medium)',
                        background: m.door_qr_checkin_enabled ? 'rgba(59, 130, 246, 0.15)' : 'rgba(0,0,0,0.3)',
                        color: m.door_qr_checkin_enabled ? '#3B82F6' : 'var(--text-muted)',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.3rem'
                      }}
                    >
                      <QrCode size={13} />
                      <span>QR Gate</span>
                    </button>
                  </div>

                  {/* Status Toggle (Upcoming <-> Completed) */}
                  <button
                    type="button"
                    onClick={() => handleToggleCompleted(m)}
                    style={{
                      padding: '0.45rem 0.75rem',
                      borderRadius: 'var(--radius-sm)',
                      border: isCompleted ? '1px solid rgba(255,255,255,0.2)' : '1px solid #10B981',
                      background: isCompleted ? 'rgba(255,255,255,0.06)' : 'rgba(16, 185, 129, 0.15)',
                      color: isCompleted ? 'var(--text-muted)' : '#10B981',
                      fontSize: '0.76rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.35rem'
                    }}
                  >
                    <CheckCircle2 size={13} />
                    <span>{isCompleted ? 'Mark as Upcoming' : 'Mark as Completed'}</span>
                  </button>

                  {/* Live Controller Quick Shortcut */}
                  {isLive && (
                    <Link
                      href={`/${club.slug}/admin/match-center`}
                      style={{
                        padding: '0.45rem 0.75rem',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid #EF4444',
                        background: 'rgba(239, 68, 68, 0.15)',
                        color: '#EF4444',
                        fontSize: '0.76rem',
                        fontWeight: 800,
                        textDecoration: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.35rem'
                      }}
                    >
                      <Radio size={13} className="animate-pulse" />
                      <span>Live Controller</span>
                    </Link>
                  )}

                  {/* Edit / Delete / View Links */}
                  <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                    <Link
                      href={`/${club.slug}/match/${m.id}`}
                      target="_blank"
                      className="btn btn-secondary btn-sm"
                      title="View Public Match Page"
                      style={{ padding: '0.35rem 0.6rem' }}
                    >
                      <ExternalLink size={13} />
                    </Link>

                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(m)}
                      className="btn btn-secondary btn-sm"
                      title="Edit Match Details"
                      style={{ padding: '0.35rem 0.6rem' }}
                    >
                      <Edit2 size={13} />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteMatch(m)}
                      className="btn btn-secondary btn-sm"
                      title="Delete Match"
                      style={{ padding: '0.35rem 0.6rem', color: '#EF4444' }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. ADD / EDIT MATCH FORM MODAL                                            */}
      {/* ========================================================================= */}
      {isFormModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1.5rem'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsFormModalOpen(false);
          }}
        >
          <div
            className="glass-panel"
            style={{
              maxWidth: 'min(780px, calc(100vw - 2rem))',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: 'clamp(1rem, 3vw, 2rem)',
              borderRadius: 'var(--radius-xl)',
              border: '1px solid var(--border-medium)',
              background: 'var(--bg-surface-elevated)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <div>
                <span className="badge badge-primary" style={{ marginBottom: '0.25rem' }}>
                  {editingMatchId ? 'EDIT MATCH' : 'NEW SCHEDULED FIXTURE'}
                </span>
                <h2 style={{ fontSize: '1.6rem', fontWeight: 900, color: '#FFFFFF' }}>
                  {editingMatchId ? 'Update Match Details' : 'Schedule Match Fixture'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsFormModalOpen(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={22} />
              </button>
            </div>

            <form onSubmit={handleSubmitMatch}>
              {/* Field: Match Title */}
              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label className="form-label" htmlFor="form-title">
                  Match Title (Optional / Custom Headline)
                </label>
                <input
                  id="form-title"
                  type="text"
                  className="form-input"
                  placeholder="e.g. Metropolitan Super Cup Semi-Final or Pre-Season Derby"
                  value={form.title}
                  onChange={e => setForm({ ...form, title: e.target.value })}
                />
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.25rem', display: 'block' }}>
                  Custom showcase headline. If left blank, defaults to &ldquo;[Home Team] vs [Away Team]&rdquo;.
                </span>
              </div>

              {/* Field: Match Type (Internal / Friendly / Tournament) */}
              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label className="form-label">
                  Match Type *
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 100px), 1fr))', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  {(['internal', 'friendly', 'tournament'] as MatchType[]).map(type => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => {
                        const newComp = type === 'internal'
                          ? 'Intra-Squad Match'
                          : type === 'tournament'
                          ? 'Cup Tournament'
                          : 'Club Friendly';
                        setForm({
                          ...form,
                          match_type: type,
                          competition: form.competition === 'Premier Regional League' || form.competition === 'Club Friendly' || form.competition === 'Intra-Squad Match' || form.competition === 'Cup Tournament' ? newComp : form.competition
                        });
                      }}
                      style={{
                        padding: '0.75rem',
                        borderRadius: 'var(--radius-md)',
                        border: form.match_type === type ? `2px solid ${club.primary_color}` : '1px solid var(--border-medium)',
                        background: form.match_type === type ? 'rgba(16, 185, 129, 0.15)' : 'rgba(0,0,0,0.3)',
                        color: form.match_type === type ? '#FFFFFF' : 'var(--text-secondary)',
                        fontWeight: 800,
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                        textTransform: 'capitalize',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.4rem',
                        transition: 'all 0.2s'
                      }}
                    >
                      {type === 'internal' && <Users size={15} color="var(--club-primary)" />}
                      {type === 'friendly' && <Shield size={15} color="#3B82F6" />}
                      {type === 'tournament' && <Trophy size={15} color="#F59E0B" />}
                      <span>{type}</span>
                    </button>
                  ))}
                </div>

                {/* Internal Type Quick Presets */}
                {form.match_type === 'internal' && (
                  <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--club-primary)', marginBottom: '0.4rem' }}>
                      Intra-Club Presets:
                    </div>
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() => handleInternalPreset('Blue Squad', 'BLU')}
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: '0.72rem', padding: '0.25rem 0.55rem' }}
                      >
                        Squad A vs Squad B (Blue)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleInternalPreset('Reserve Team', 'RES')}
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: '0.72rem', padding: '0.25rem 0.55rem' }}
                      >
                        First Team vs Reserves
                      </button>
                      <button
                        type="button"
                        onClick={() => handleInternalPreset('Trialists XI', 'TRL')}
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: '0.72rem', padding: '0.25rem 0.55rem' }}
                      >
                        First Team vs Trialists
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Field: Competition / League & Season */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="form-competition">
                    Competition / Tournament *
                  </label>
                  <input
                    id="form-competition"
                    type="text"
                    className="form-input"
                    placeholder="e.g. Club Friendly, Championship League, State Cup"
                    value={form.competition}
                    onChange={e => setForm({ ...form, competition: e.target.value })}
                    required
                  />
                  <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.4rem', flexWrap: 'wrap' }}>
                    {['Club Friendly', 'League Match', 'Cup Tournament', 'Intra-Squad'].map(preset => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setForm({ ...form, competition: preset })}
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: '0.68rem', padding: '0.15rem 0.45rem', height: 'auto' }}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="form-season">
                    Campaign Season
                  </label>
                  <select
                    id="form-season"
                    value={form.season}
                    onChange={e => setForm({ ...form, season: e.target.value })}
                    className="form-input"
                  >
                    {clubSeasons.length > 0 ? (
                      clubSeasons.map(s => (
                        <option key={s.id} value={s.name}>{s.name} {s.is_current ? '(Current)' : ''}</option>
                      ))
                    ) : (
                      <>
                        <option value="2026/27">2026/27</option>
                        <option value="2025/26">2025/26</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              {/* Opponent Details & Home/Away */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="form-opponent-name">
                    Opponent Name *
                  </label>
                  <input
                    id="form-opponent-name"
                    type="text"
                    className="form-input"
                    placeholder="e.g. Metro Rovers FC"
                    value={form.opponent_name}
                    onChange={e => setForm({ ...form, opponent_name: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="form-opponent-short">
                    Short Name *
                  </label>
                  <input
                    id="form-opponent-short"
                    type="text"
                    className="form-input"
                    placeholder="e.g. ROV"
                    maxLength={8}
                    value={form.opponent_short_name}
                    onChange={e => setForm({ ...form, opponent_short_name: e.target.value.toUpperCase() })}
                    required
                    style={{ textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Venue Side
                  </label>
                  <select
                    value={form.is_club_home ? 'home' : 'away'}
                    onChange={e => setForm({ ...form, is_club_home: e.target.value === 'home' })}
                    className="form-input"
                  >
                    <option value="home">Home (Fortress)</option>
                    <option value="away">Away Fixture</option>
                  </select>
                </div>
              </div>

              {/* Date, Time & Venue */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 140px), 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="form-date">
                    Match Date *
                  </label>
                  <input
                    id="form-date"
                    type="date"
                    className="form-input"
                    value={form.match_date}
                    onChange={e => setForm({ ...form, match_date: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="form-time">
                    Match Time *
                  </label>
                  <input
                    id="form-time"
                    type="time"
                    className="form-input"
                    value={form.match_time}
                    onChange={e => setForm({ ...form, match_time: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="form-venue">
                    Location / Venue *
                  </label>
                  <input
                    id="form-venue"
                    type="text"
                    className="form-input"
                    placeholder="e.g. Riverside Park Stadium"
                    value={form.venue}
                    onChange={e => setForm({ ...form, venue: e.target.value })}
                    required
                  />
                </div>
              </div>

              {/* Match Flyer Image Zone */}
              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label className="form-label">
                  Match Flyer / Promotional Banner
                </label>
                <ImageUploadZone
                  label="Matchday Flyer"
                  recommendedText="High-res 16:9 promotional flyer (PNG, JPG, WebP up to 5MB)"
                  currentImageUrl={form.match_flyer_url}
                  aspectRatio="16:9"
                  folder="match-flyers"
                  onUploadComplete={url => setForm({ ...form, match_flyer_url: url })}
                />

                {/* Preset Banner Selectors */}
                <div style={{ marginTop: '0.6rem' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>
                    Or select a curated matchday flyer preset:
                  </span>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {FLYER_PRESETS.map((preset, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setForm({ ...form, match_flyer_url: preset.url })}
                        className="btn btn-secondary btn-sm"
                        style={{
                          fontSize: '0.72rem',
                          padding: '0.3rem 0.6rem',
                          border: form.match_flyer_url === preset.url ? `1px solid ${club.primary_color}` : '1px solid var(--border-subtle)',
                          background: form.match_flyer_url === preset.url ? 'rgba(16, 185, 129, 0.15)' : undefined
                        }}
                      >
                        {preset.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Match Description */}
              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label className="form-label" htmlFor="form-description">
                  Description & Matchday Details
                </label>
                <textarea
                  id="form-description"
                  className="form-textarea"
                  rows={3}
                  placeholder="Event briefing, gate opening times, live stream instructions, parking notices..."
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                />
              </div>


              {/* Operational Controls & Progression Status Section */}
              <div
                style={{
                  background: 'rgba(0, 0, 0, 0.35)',
                  padding: '1.25rem',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--border-medium)',
                  marginBottom: '1.75rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1.25rem'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#FFFFFF', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Match Status & Scoring
                  </div>
                  {(form.status === 'live' || form.status === 'halftime') && (
                    <span className="badge" style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#EF4444', border: '1px solid #EF4444', fontWeight: 800, fontSize: '0.72rem' }}>
                      <Radio size={11} className="animate-pulse" style={{ marginRight: '4px', verticalAlign: '-1px' }} />
                      MATCH IN PROGRESS • LIVE SCORES PRESERVED
                    </span>
                  )}
                </div>

                {/* Match Status Selector */}
                <div className="form-group">
                  <label className="form-label" htmlFor="form-status">
                    Fixture Progression Status *
                  </label>
                  <select
                    id="form-status"
                    className="form-input"
                    value={form.status}
                    onChange={e => {
                      const newStatus = e.target.value as MatchStatus;
                      setForm(prev => ({
                        ...prev,
                        status: newStatus,
                        is_completed: newStatus === 'completed'
                      }));
                    }}
                    style={{
                      background: form.status === 'live' ? 'rgba(239, 68, 68, 0.15)' : form.status === 'completed' ? 'rgba(16, 185, 129, 0.15)' : undefined,
                      borderColor: form.status === 'live' ? '#EF4444' : form.status === 'completed' ? '#10B981' : undefined,
                      fontWeight: 700
                    }}
                  >
                    <option value="upcoming">Upcoming (Scheduled Fixture)</option>
                    <option value="live">Live (Match In Play)</option>
                    <option value="halftime">Half-Time Break</option>
                    <option value="completed">Completed (Full-Time Final Result)</option>
                    <option value="postponed">Postponed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.25rem', display: 'block' }}>
                    {form.status === 'upcoming' && 'Fixture displays in Upcoming Matches with kickoff countdown.'}
                    {form.status === 'live' && 'Fixture displays live badge and live score ticker on public pages.'}
                    {form.status === 'halftime' && 'Fixture displays half-time interval status on public pages.'}
                    {form.status === 'completed' && 'Fixture moves to Past Results with final scores recorded.'}
                    {form.status === 'postponed' && 'Fixture marked as postponed.'}
                    {form.status === 'cancelled' && 'Fixture marked as cancelled.'}
                  </span>
                </div>

                {/* Score Controls */}
                <div style={{
                  padding: '0.85rem',
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--border-subtle)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
                    <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#FFFFFF' }}>
                      Current Match Score
                    </label>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      {form.is_club_home ? `${club.name} (Home) vs ${form.opponent_name || 'Opponent'} (Away)` : `${form.opponent_name || 'Opponent'} (Home) vs ${club.name} (Away)`}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                    <div>
                      <label htmlFor="form-home-score" style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>
                        {form.is_club_home ? `${club.short_name || club.name} (Home)` : `${form.opponent_short_name || form.opponent_name || 'Opponent'} (Home)`}
                      </label>
                      <input
                        id="form-home-score"
                        type="number"
                        min="0"
                        className="form-input"
                        style={{ width: '90px', padding: '0.45rem 0.6rem', fontSize: '1.1rem', fontWeight: 800, textAlign: 'center' }}
                        value={form.home_score}
                        onChange={e => setForm(prev => ({ ...prev, home_score: Math.max(0, parseInt(e.target.value) || 0) }))}
                      />
                    </div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--text-muted)', paddingTop: '1.2rem' }}>
                      :
                    </div>
                    <div>
                      <label htmlFor="form-away-score" style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>
                        {form.is_club_home ? `${form.opponent_short_name || form.opponent_name || 'Opponent'} (Away)` : `${club.short_name || club.name} (Away)`}
                      </label>
                      <input
                        id="form-away-score"
                        type="number"
                        min="0"
                        className="form-input"
                        style={{ width: '90px', padding: '0.45rem 0.6rem', fontSize: '1.1rem', fontWeight: 800, textAlign: 'center' }}
                        value={form.away_score}
                        onChange={e => setForm(prev => ({ ...prev, away_score: Math.max(0, parseInt(e.target.value) || 0) }))}
                      />
                    </div>
                  </div>
                </div>

                {/* Additional Visibility & Features */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border-subtle)' }}>
                  {/* Hero Slider Feature Toggle */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                    <input
                      id="toggle-hero"
                      type="checkbox"
                      checked={form.featured_on_hero}
                      onChange={e => setForm({ ...form, featured_on_hero: e.target.checked })}
                      style={{ width: '18px', height: '18px', marginTop: '3px', accentColor: '#F59E0B', cursor: 'pointer' }}
                    />
                    <div style={{ flex: 1 }}>
                      <label htmlFor="toggle-hero" style={{ fontWeight: 800, color: '#FFFFFF', fontSize: '0.9rem', cursor: 'pointer' }}>
                        Feature on Home page hero slider
                      </label>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', marginTop: '2px' }}>
                        Spotlights this match directly on the club&apos;s home page hero carousel with match flyer, title, and kickoff countdown.
                      </p>
                    </div>
                  </div>

                  {/* Door QR Self-Check-in Toggle */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                    <input
                      id="toggle-door-qr"
                      type="checkbox"
                      checked={form.door_qr_checkin_enabled}
                      onChange={e => setForm({ ...form, door_qr_checkin_enabled: e.target.checked })}
                      style={{ width: '18px', height: '18px', marginTop: '3px', accentColor: '#3B82F6', cursor: 'pointer' }}
                    />
                    <div style={{ flex: 1 }}>
                      <label htmlFor="toggle-door-qr" style={{ fontWeight: 800, color: '#FFFFFF', fontSize: '0.9rem', cursor: 'pointer' }}>
                        Enable Door QR Code self-check-in
                      </label>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', marginTop: '2px' }}>
                        Generates a turnstile gate QR code. Supporters and members arriving at the entrance can scan with their phone camera to self-check-in.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setIsFormModalOpen(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ fontWeight: 800, padding: '0.65rem 1.5rem' }}
                >
                  {editingMatchId ? 'Save Changes' : 'Schedule Match'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. DOOR QR GATE MODAL                                                     */}
      {/* ========================================================================= */}
      {qrModalMatch && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1.5rem'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setQrModalMatch(null);
          }}
        >
          <div
            className="glass-panel"
            style={{
              maxWidth: '520px',
              width: '100%',
              padding: '2rem',
              borderRadius: 'var(--radius-xl)',
              border: '1px solid var(--border-medium)',
              background: 'var(--bg-surface-elevated)',
              textAlign: 'center'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setQrModalMatch(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <span className="badge badge-primary" style={{ marginBottom: '0.5rem' }}>
              TURNSTILE DOOR STATION
            </span>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 900, color: '#FFFFFF', marginBottom: '0.25rem' }}>
              {qrModalMatch.title || `${qrModalMatch.home_team_name} vs ${qrModalMatch.away_team_name}`}
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
              {qrModalMatch.venue} • {new Date(qrModalMatch.match_date).toLocaleDateString()} at {qrModalMatch.match_time || '15:00'}
            </p>

            {/* Live QR Code Box */}
            <div
              style={{
                background: '#FFFFFF',
                padding: '1.5rem',
                borderRadius: '16px',
                display: 'inline-block',
                margin: '0 auto 1.5rem auto',
                boxShadow: '0 8px 30px rgba(0,0,0,0.4)'
              }}
            >
              <QRCodeSVG
                value={getCheckinUrl(qrModalMatch)}
                size={220}
                level="H"
                includeMargin={false}
              />
            </div>

            <div
              style={{
                background: 'rgba(0, 0, 0, 0.4)',
                padding: '0.75rem 1rem',
                borderRadius: 'var(--radius-md)',
                marginBottom: '1.5rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.5rem',
                border: '1px solid var(--border-subtle)'
              }}
            >
              <span
                style={{
                  fontSize: '0.75rem',
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--text-secondary)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}
              >
                {getCheckinUrl(qrModalMatch)}
              </span>
              <button
                type="button"
                onClick={() => copyQrLink(getCheckinUrl(qrModalMatch))}
                className="btn btn-secondary btn-sm"
                style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '0.3rem' }}
              >
                {copiedLink ? <Check size={12} color="#10B981" /> : <Copy size={12} />}
                <span>{copiedLink ? 'Copied' : 'Copy Link'}</span>
              </button>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <Link
                href={`/${club.slug}/match/${qrModalMatch.id}/checkin`}
                target="_blank"
                className="btn btn-secondary btn-sm"
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
              >
                <ExternalLink size={14} />
                <span>Test Check-in</span>
              </Link>

              <button
                type="button"
                onClick={() => {
                  const target = qrModalMatch;
                  setQrModalMatch(null);
                  setPrintPosterMatch(target);
                }}
                className="btn btn-primary btn-sm"
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
              >
                <Printer size={14} />
                <span>Print Gate Poster</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. PRINTABLE GATE POSTER MODAL                                            */}
      {/* ========================================================================= */}
      {printPosterMatch && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.9)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1.5rem'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setPrintPosterMatch(null);
          }}
        >
          <div
            style={{
              background: '#FFFFFF',
              color: '#0F172A',
              padding: '3rem',
              borderRadius: '16px',
              maxWidth: '540px',
              width: '100%',
              textAlign: 'center',
              boxShadow: '0 20px 60px rgba(0,0,0,0.6)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }} className="no-print">
              <button
                type="button"
                onClick={() => setPrintPosterMatch(null)}
                style={{ background: 'transparent', border: 'none', color: '#64748B', cursor: 'pointer' }}
              >
                <X size={24} />
              </button>
            </div>

            {/* Printable Poster Content */}
            <div style={{ textTransform: 'uppercase', fontWeight: 900, color: club.primary_color || '#10B981', letterSpacing: '0.1em', fontSize: '0.9rem', marginBottom: '0.25rem' }}>
              {club.name} • Official Turnstile Check-In
            </div>
            <h1 style={{ fontSize: '1.8rem', fontWeight: 900, color: '#0F172A', lineHeight: 1.2, marginBottom: '0.5rem' }}>
              {printPosterMatch.title || `${printPosterMatch.home_team_name} vs ${printPosterMatch.away_team_name}`}
            </h1>
            <p style={{ color: '#475569', fontSize: '1rem', fontWeight: 600, marginBottom: '2rem' }}>
              {printPosterMatch.venue} • {new Date(printPosterMatch.match_date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} at {printPosterMatch.match_time || '15:00'}
            </p>

            <div style={{ display: 'inline-block', padding: '1rem', border: '3px solid #0F172A', borderRadius: '16px', marginBottom: '1.75rem' }}>
              <QRCodeSVG
                value={getCheckinUrl(printPosterMatch)}
                size={260}
                level="H"
                includeMargin={false}
              />
            </div>

            <div style={{ background: '#F1F5F9', borderRadius: '12px', padding: '1rem', marginBottom: '2rem' }}>
              <div style={{ fontWeight: 800, fontSize: '1.1rem', color: '#0F172A', marginBottom: '0.2rem' }}>
                SCAN WITH MOBILE CAMERA
              </div>
              <div style={{ fontSize: '0.85rem', color: '#64748B' }}>
                Validate your Member Pass or check in as a Guest Supporter at the gate.
              </div>
            </div>

            <div className="no-print" style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={() => window.print()}
                className="btn btn-primary"
                style={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                <Printer size={16} />
                <span>Print Poster</span>
              </button>
              <button
                type="button"
                onClick={() => setPrintPosterMatch(null)}
                className="btn btn-secondary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
