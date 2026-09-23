'use client';

import React, { useState, use, useMemo } from 'react';
import { useClub } from '@/lib/club-context';
import { ClubSeason, SeasonStatus } from '@/lib/supabase/types';
import {
  CalendarDays,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Radio,
  Calendar,
  Award,
  Star,
  Check,
  X,
  AlertTriangle,
  Sparkles,
  Layers,
  ArrowRight
} from 'lucide-react';
import Link from 'next/link';

export default function AdminSeasonsPage({
  params,
}: {
  params: Promise<{ clubSlug: string }>;
}) {
  const resolvedParams = use(params);
  const {
    clubs,
    selectClubBySlug,
    seasons,
    addSeason,
    updateSeason,
    deleteSeason,
    setCurrentSeason,
    matches,
    events,
    members
  } = useClub();

  const club = selectClubBySlug(resolvedParams.clubSlug) || clubs[0];

  // Club-specific seasons, sorted with current first, then by start_date descending
  const clubSeasons = useMemo(() => {
    return seasons
      .filter(s => s.club_id === club.id)
      .sort((a, b) => {
        if (a.is_current) return -1;
        if (b.is_current) return 1;
        return new Date(b.start_date).getTime() - new Date(a.start_date).getTime();
      });
  }, [seasons, club.id]);

  const activeSeason = clubSeasons.find(s => s.is_current) || clubSeasons[0];

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSeason, setEditingSeason] = useState<ClubSeason | null>(null);

  // Form states
  const [formName, setFormName] = useState('');
  const [formStartDate, setFormStartDate] = useState('');
  const [formEndDate, setFormEndDate] = useState('');
  const [formStatus, setFormStatus] = useState<SeasonStatus>('active');
  const [formIsCurrent, setFormIsCurrent] = useState(false);
  const [formNotes, setFormNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Delete modal state
  const [seasonToDelete, setSeasonToDelete] = useState<ClubSeason | null>(null);

  // Feedback toast
  const [feedback, setFeedback] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);

  const showFeedback = (text: string, type: 'success' | 'info' | 'error' = 'success') => {
    setFeedback({ text, type });
    setTimeout(() => setFeedback(null), 3500);
  };

  // Helper counts per season
  const getSeasonStats = (seasonName: string) => {
    const seasonMatches = matches.filter(m => m.club_id === club.id && m.season === seasonName);
    const seasonEvents = events.filter(e => e.club_id === club.id && e.season === seasonName);
    const seasonCommittee = members.filter(m => m.club_id === club.id && m.is_executive && m.executive_season === seasonName);
    return {
      matchesCount: seasonMatches.length,
      eventsCount: seasonEvents.length,
      committeeCount: seasonCommittee.length,
    };
  };

  // Open modal for Create
  const handleOpenCreate = () => {
    setEditingSeason(null);
    const nowYear = new Date().getFullYear();
    setFormName(`${nowYear}/${(nowYear + 1).toString().slice(2)}`);
    setFormStartDate(`${nowYear}-08-01`);
    setFormEndDate(`${nowYear + 1}-05-31`);
    setFormStatus('active');
    setFormIsCurrent(clubSeasons.length === 0);
    setFormNotes('');
    setFormError(null);
    setIsModalOpen(true);
  };

  // Open modal for Edit
  const handleOpenEdit = (season: ClubSeason) => {
    setEditingSeason(season);
    setFormName(season.name);
    setFormStartDate(season.start_date);
    setFormEndDate(season.end_date);
    setFormStatus(season.status);
    setFormIsCurrent(season.is_current);
    setFormNotes(season.notes || '');
    setFormError(null);
    setIsModalOpen(true);
  };

  // Save Season (Add or Edit)
  const handleSaveSeason = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const cleanName = formName.trim();
    if (!cleanName) {
      setFormError('Season name cannot be empty (e.g. "2026/27").');
      return;
    }

    if (!formStartDate || !formEndDate) {
      setFormError('Both start date and end date are required.');
      return;
    }

    if (new Date(formStartDate) >= new Date(formEndDate)) {
      setFormError('Season end date must occur after the start date.');
      return;
    }

    // Check duplicate names within this club
    const duplicate = clubSeasons.find(
      s => s.name.toLowerCase() === cleanName.toLowerCase() && s.id !== editingSeason?.id
    );
    if (duplicate) {
      setFormError(`A season named "${cleanName}" already exists for this club.`);
      return;
    }

    if (editingSeason) {
      updateSeason(editingSeason.id, {
        name: cleanName,
        start_date: formStartDate,
        end_date: formEndDate,
        status: formStatus,
        is_current: formIsCurrent,
        notes: formNotes.trim() || undefined,
      });
      showFeedback(`✓ Successfully updated season "${cleanName}"!`);
    } else {
      addSeason({
        club_id: club.id,
        name: cleanName,
        start_date: formStartDate,
        end_date: formEndDate,
        status: formStatus,
        is_current: formIsCurrent || clubSeasons.length === 0,
        notes: formNotes.trim() || undefined,
      });
      showFeedback(`✓ New season "${cleanName}" created successfully!`);
    }

    setIsModalOpen(false);
  };

  // Set Season as Current
  const handleSetCurrent = (season: ClubSeason) => {
    setCurrentSeason(club.id, season.id);
    showFeedback(`★ "${season.name}" is now the active current season for ${club.name}!`);
  };

  // Confirm Delete
  const handleConfirmDelete = () => {
    if (!seasonToDelete) return;
    deleteSeason(seasonToDelete.id);
    showFeedback(`Season "${seasonToDelete.name}" deleted.`);
    setSeasonToDelete(null);
  };

  return (
    <div>
      {/* Header Banner */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1rem',
        marginBottom: '2rem',
      }}>
        <div>
          <span className="badge badge-primary" style={{ marginBottom: '0.4rem', letterSpacing: '0.05em' }}>
            CLUB GOVERNANCE • SEASONS
          </span>
          <h1 style={{ fontSize: '2.2rem', fontWeight: 900, color: '#FFFFFF' }}>
            Season Management
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', maxWidth: '680px', marginTop: '0.2rem' }}>
            Define club seasons (e.g. 2026/27), set active campaign periods, and seamlessly link matches, executive committee appointments, and club events.
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="btn btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)' }}
        >
          <Plus size={18} />
          <span>Add New Season</span>
        </button>
      </div>

      {/* Toast Feedback */}
      {feedback && (
        <div style={{
          background: feedback.type === 'error' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
          border: `1px solid ${feedback.type === 'error' ? '#EF4444' : '#10B981'}`,
          padding: '0.85rem 1.25rem',
          borderRadius: 'var(--radius-md)',
          color: feedback.type === 'error' ? '#EF4444' : '#10B981',
          fontWeight: 700,
          marginBottom: '1.75rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.6rem',
        }}>
          {feedback.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Active Season Banner Spotlight */}
      {activeSeason && (
        <div
          className="glass-panel"
          style={{
            padding: '1.75rem 2rem',
            marginBottom: '2.5rem',
            border: '1px solid rgba(16, 185, 129, 0.35)',
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(15, 23, 42, 0.7) 100%)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div style={{
            position: 'absolute',
            top: '-20px',
            right: '-20px',
            width: '120px',
            height: '120px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(16, 185, 129, 0.2) 0%, transparent 70%)',
            pointerEvents: 'none',
          }} />

          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1.5rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.25rem 0.75rem',
                  borderRadius: '999px',
                  background: 'rgba(16, 185, 129, 0.2)',
                  color: '#10B981',
                  fontWeight: 800,
                  fontSize: '0.75rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10B981', display: 'inline-block', boxShadow: '0 0 8px #10B981' }} />
                  CURRENT ACTIVE CAMPAIGN
                </span>
                <span className="badge badge-gold" style={{ fontSize: '0.72rem' }}>
                  {activeSeason.status.toUpperCase()}
                </span>
              </div>

              <h2 style={{ fontSize: '2rem', fontWeight: 900, color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <CalendarDays size={26} color="#10B981" />
                {activeSeason.name} Season
              </h2>

              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.35rem', maxWidth: '600px' }}>
                {activeSeason.notes || `Primary operational window for ${club.name} first team, executive governance, and club fixtures.`}
              </p>

              <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginTop: '0.85rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                <span>📅 From: <strong style={{ color: '#FFFFFF' }}>{activeSeason.start_date}</strong></span>
                <span>🏁 Until: <strong style={{ color: '#FFFFFF' }}>{activeSeason.end_date}</strong></span>
              </div>
            </div>

            {/* Quick Metrics for Active Season */}
            <div style={{
              display: 'flex',
              gap: '1rem',
              background: 'rgba(0,0,0,0.3)',
              padding: '1rem 1.5rem',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
            }}>
              {(() => {
                const stats = getSeasonStats(activeSeason.name);
                return (
                  <>
                    <div style={{ textAlign: 'center', padding: '0 0.5rem' }}>
                      <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#10B981' }}>{stats.matchesCount}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Matches</div>
                    </div>
                    <div style={{ width: '1px', background: 'var(--border-subtle)' }} />
                    <div style={{ textAlign: 'center', padding: '0 0.5rem' }}>
                      <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#F59E0B' }}>{stats.eventsCount}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Events</div>
                    </div>
                    <div style={{ width: '1px', background: 'var(--border-subtle)' }} />
                    <div style={{ textAlign: 'center', padding: '0 0.5rem' }}>
                      <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#3B82F6' }}>{stats.committeeCount}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Committee</div>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* All Seasons List Card */}
      <div className="glass-panel" style={{ padding: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
          <div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#FFFFFF' }}>
              Club Seasons Registry ({clubSeasons.length})
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              Historical and scheduled campaigns for {club.name}. Matches, committee tenures, and events inherit these seasons.
            </p>
          </div>
        </div>

        {clubSeasons.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3.5rem 1rem', background: 'rgba(0,0,0,0.2)', borderRadius: '12px' }}>
            <CalendarDays size={48} color="var(--text-muted)" style={{ margin: '0 auto 1rem', opacity: 0.6 }} />
            <h4 style={{ color: '#FFFFFF', fontWeight: 700, fontSize: '1.1rem' }}>No Seasons Defined Yet</h4>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', maxWidth: '400px', margin: '0.5rem auto 1.5rem' }}>
              Create your club&apos;s first campaign season (e.g. 2026/27) to associate matches, executive committee appointments, and calendar events.
            </p>
            <button onClick={handleOpenCreate} className="btn btn-primary">
              <Plus size={16} />
              <span>Create Initial Season</span>
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {clubSeasons.map(season => {
              const stats = getSeasonStats(season.name);
              return (
                <div
                  key={season.id}
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '1.25rem 1.5rem',
                    borderRadius: '12px',
                    background: season.is_current ? 'rgba(16, 185, 129, 0.05)' : 'rgba(0, 0, 0, 0.3)',
                    border: season.is_current ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid var(--border-subtle)',
                    gap: '1.25rem',
                    transition: 'all 0.2s ease',
                  }}
                >
                  {/* Left info */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', minWidth: '260px' }}>
                    <div style={{
                      width: '46px',
                      height: '46px',
                      borderRadius: '12px',
                      background: season.is_current ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: season.is_current ? '#10B981' : 'var(--text-muted)',
                      border: season.is_current ? '1px solid #10B981' : '1px solid var(--border-subtle)',
                    }}>
                      <CalendarDays size={22} />
                    </div>

                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <span style={{ fontSize: '1.15rem', fontWeight: 800, color: '#FFFFFF' }}>
                          {season.name}
                        </span>
                        {season.is_current && (
                          <span style={{
                            padding: '0.15rem 0.5rem',
                            borderRadius: '6px',
                            background: '#10B981',
                            color: '#000000',
                            fontSize: '0.68rem',
                            fontWeight: 900,
                            letterSpacing: '0.05em'
                          }}>
                            ACTIVE
                          </span>
                        )}
                        <span className="badge" style={{
                          fontSize: '0.7rem',
                          background: season.status === 'active' ? 'rgba(16, 185, 129, 0.15)' : season.status === 'upcoming' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(148, 163, 184, 0.15)',
                          color: season.status === 'active' ? '#10B981' : season.status === 'upcoming' ? '#3B82F6' : '#94A3B8',
                        }}>
                          {season.status.toUpperCase()}
                        </span>
                      </div>

                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                        {season.start_date} → {season.end_date}
                        {season.notes && <span style={{ marginLeft: '0.6rem', color: 'var(--text-secondary)' }}>• {season.notes}</span>}
                      </div>
                    </div>
                  </div>

                  {/* Middle Linked Counters */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', fontSize: '0.82rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: stats.matchesCount > 0 ? '#FFFFFF' : 'var(--text-muted)' }}>
                      <Radio size={14} color="var(--club-primary)" />
                      <span><strong>{stats.matchesCount}</strong> matches</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: stats.eventsCount > 0 ? '#FFFFFF' : 'var(--text-muted)' }}>
                      <Calendar size={14} color="#F59E0B" />
                      <span><strong>{stats.eventsCount}</strong> events</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: stats.committeeCount > 0 ? '#FFFFFF' : 'var(--text-muted)' }}>
                      <Award size={14} color="#3B82F6" />
                      <span><strong>{stats.committeeCount}</strong> committee</span>
                    </div>
                  </div>

                  {/* Right Actions */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {!season.is_current && (
                      <button
                        onClick={() => handleSetCurrent(season)}
                        className="btn btn-secondary btn-sm"
                        style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#10B981' }}
                        title="Set as active current season"
                      >
                        <Star size={14} />
                        <span>Set Current</span>
                      </button>
                    )}

                    <button
                      onClick={() => handleOpenEdit(season)}
                      className="btn btn-secondary btn-sm"
                      style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                      title="Edit season details"
                    >
                      <Edit2 size={14} />
                      <span>Edit</span>
                    </button>

                    <button
                      onClick={() => setSeasonToDelete(season)}
                      className="btn btn-secondary btn-sm"
                      style={{ color: '#EF4444', display: 'flex', alignItems: 'center' }}
                      title="Delete season"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Cross-Subsystem Quick Links */}
      <div style={{ marginTop: '2.5rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))', gap: '1.25rem' }}>
        <Link href={`/${club.slug}/admin/match-center`} className="glass-panel glass-panel-interactive" style={{ padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--club-primary)', textTransform: 'uppercase' }}>MATCHES & FIXTURES</div>
            <div style={{ fontWeight: 800, color: '#FFFFFF', fontSize: '1rem', marginTop: '2px' }}>Manage Match Center</div>
          </div>
          <ArrowRight size={18} color="var(--text-muted)" />
        </Link>

        <Link href={`/${club.slug}/admin/committee`} className="glass-panel glass-panel-interactive" style={{ padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#3B82F6', textTransform: 'uppercase' }}>GOVERNANCE</div>
            <div style={{ fontWeight: 800, color: '#FFFFFF', fontSize: '1rem', marginTop: '2px' }}>Executive Committee Appointments</div>
          </div>
          <ArrowRight size={18} color="var(--text-muted)" />
        </Link>

        <Link href={`/${club.slug}/admin/events`} className="glass-panel glass-panel-interactive" style={{ padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#F59E0B', textTransform: 'uppercase' }}>CALENDAR</div>
            <div style={{ fontWeight: 800, color: '#FFFFFF', fontSize: '1rem', marginTop: '2px' }}>Club Events & Trainings</div>
          </div>
          <ArrowRight size={18} color="var(--text-muted)" />
        </Link>
      </div>

      {/* Add / Edit Season Modal */}
      {isModalOpen && (
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
              <h3 style={{ fontSize: '1.35rem', fontWeight: 900, color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <CalendarDays size={20} color="#10B981" />
                {editingSeason ? 'Edit Season Details' : 'Create New Club Season'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {formError && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid #EF4444',
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                color: '#EF4444',
                fontSize: '0.85rem',
                marginBottom: '1.25rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <AlertCircle size={16} />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSaveSeason}>
              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label className="form-label" style={{ fontWeight: 700 }}>
                  Season Name / Title <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  className="form-input"
                  placeholder="e.g. 2026/27 or 2026/2027"
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                  Standard football seasons use &quot;YYYY/YY&quot; format (e.g. 2026/27).
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 700 }}>
                    Start Date <span style={{ color: '#EF4444' }}>*</span>
                  </label>
                  <input
                    type="date"
                    required
                    className="form-input"
                    value={formStartDate}
                    onChange={e => setFormStartDate(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 700 }}>
                    End Date <span style={{ color: '#EF4444' }}>*</span>
                  </label>
                  <input
                    type="date"
                    required
                    className="form-input"
                    value={formEndDate}
                    onChange={e => setFormEndDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label className="form-label" style={{ fontWeight: 700 }}>Campaign Status</label>
                <select
                  className="form-select"
                  value={formStatus}
                  onChange={e => setFormStatus(e.target.value as SeasonStatus)}
                >
                  <option value="active">Active (Currently ongoing)</option>
                  <option value="upcoming">Upcoming (Pre-season / Scheduled)</option>
                  <option value="completed">Completed (Archived / Historical)</option>
                </select>
              </div>

              <div style={{
                background: 'rgba(255, 255, 255, 0.03)',
                padding: '0.85rem 1rem',
                borderRadius: '8px',
                border: '1px solid var(--border-subtle)',
                marginBottom: '1.25rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                cursor: 'pointer',
              }} onClick={() => setFormIsCurrent(!formIsCurrent)}>
                <input
                  type="checkbox"
                  id="isCurrentSeason"
                  checked={formIsCurrent}
                  onChange={e => setFormIsCurrent(e.target.checked)}
                  style={{ width: '18px', height: '18px', accentColor: '#10B981', cursor: 'pointer' }}
                />
                <label htmlFor="isCurrentSeason" style={{ cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600, color: '#FFFFFF' }}>
                  Set as Club&apos;s Active Current Season
                </label>
              </div>

              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label className="form-label">Campaign Notes / Key Objectives</label>
                <textarea
                  rows={3}
                  className="form-textarea"
                  placeholder="e.g. League title challenge, cup tournament entries, player recruitment goals..."
                  value={formNotes}
                  onChange={e => setFormNotes(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                >
                  <Check size={16} />
                  <span>{editingSeason ? 'Save Changes' : 'Create Season'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {seasonToDelete && (
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
            maxWidth: '480px',
            padding: '2rem',
            borderRadius: '16px',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            background: 'var(--bg-surface)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', color: '#EF4444' }}>
              <AlertTriangle size={24} />
              <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#FFFFFF' }}>
                Delete Season &quot;{seasonToDelete.name}&quot;?
              </h3>
            </div>

            {(() => {
              const stats = getSeasonStats(seasonToDelete.name);
              const totalLinked = stats.matchesCount + stats.eventsCount + stats.committeeCount;
              return (
                <div style={{ marginBottom: '1.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  {totalLinked > 0 ? (
                    <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.3)', marginBottom: '0.75rem' }}>
                      <strong style={{ color: '#EF4444' }}>Warning: Linked Items Detected!</strong>
                      <div style={{ marginTop: '0.25rem', fontSize: '0.85rem' }}>
                        This season currently has <strong>{stats.matchesCount} matches</strong>, <strong>{stats.eventsCount} events</strong>, and <strong>{stats.committeeCount} committee appointments</strong> associated with it.
                      </div>
                    </div>
                  ) : (
                    <p>Are you sure you want to remove this season? No fixtures or events are currently linked.</p>
                  )}
                  <p>You can also consider setting its status to <strong>&quot;Completed&quot;</strong> instead of deleting it to preserve history.</p>
                </div>
              );
            })()}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                onClick={() => setSeasonToDelete(null)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="btn btn-sm"
                style={{ background: '#EF4444', color: '#FFFFFF', fontWeight: 700, padding: '0.5rem 1.25rem', borderRadius: '8px' }}
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
