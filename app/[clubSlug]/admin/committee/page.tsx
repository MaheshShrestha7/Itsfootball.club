'use client';

import React, { useState, use } from 'react';
import { useClub } from '@/lib/club-context';
import { Award, Plus, Trash2, Edit2, Shield, CheckCircle2, CalendarDays, Filter } from 'lucide-react';

export default function AdminCommitteePage({
  params,
}: {
  params: Promise<{ clubSlug: string }>;
}) {
  const resolvedParams = use(params);
  const { clubs, selectClubBySlug, members, appointExecutive, updateMember, seasons, getActiveSeason } = useClub();
  const club = selectClubBySlug(resolvedParams.clubSlug) || clubs[0];

  const clubMembers = members.filter(m => m.club_id === club.id);
  const clubSeasons = seasons.filter(s => s.club_id === club.id);
  const activeSeason = getActiveSeason ? getActiveSeason(club.id) : null;
  const executiveMembers = clubMembers.filter(m => m.is_executive).sort((a, b) => (a.executive_order || 99) - (b.executive_order || 99));

  const [selectedMemberId, setSelectedMemberId] = useState(clubMembers[0]?.id || '');
  const [title, setTitle] = useState('Vice-President');
  const [bio, setBio] = useState('');
  const [order, setOrder] = useState(executiveMembers.length + 1);
  const [selectedSeason, setSelectedSeason] = useState(activeSeason?.name || '2026/27');
  const [seasonFilter, setSeasonFilter] = useState<string>('ALL');
  const [feedback, setFeedback] = useState('');

  const filteredExecutiveMembers = executiveMembers.filter(m => {
    if (seasonFilter === 'ALL') return true;
    return (m.executive_season || activeSeason?.name) === seasonFilter;
  });

  const handleAppoint = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMemberId || !title) return;

    appointExecutive(selectedMemberId, title, bio, order, selectedSeason);
    setFeedback(`Successfully appointed to executive committee for ${selectedSeason} season!`);
    setTimeout(() => setFeedback(''), 3000);
    setBio('');
  };

  const handleRevoke = (memberId: string) => {
    updateMember(memberId, {
      is_executive: false,
      executive_title: undefined,
      executive_bio: undefined,
    });
  };

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <span className="badge badge-primary" style={{ marginBottom: '0.4rem' }}>GOVERNANCE • 3.5</span>
        <h1 style={{ fontSize: '2rem', fontWeight: 900, color: '#FFFFFF' }}>
          Executive Committee Appointments
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          Appoint club members and players to leadership posts (President, Secretary, Head Coach, Treasurer).
        </p>
      </div>

      {feedback && (
        <div style={{
          background: 'rgba(16, 185, 129, 0.15)',
          border: '1px solid #10B981',
          padding: '0.85rem 1.25rem',
          borderRadius: 'var(--radius-md)',
          color: '#10B981',
          fontWeight: 700,
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
        }}>
          <CheckCircle2 size={18} />
          <span>{feedback}</span>
        </div>
      )}

      {/* Appointment Form Card */}
      <div className="glass-panel" style={{ padding: '2rem', marginBottom: '2.5rem' }}>
        <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#FFFFFF', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Award size={18} color="#F59E0B" /> Appoint Member to Committee
        </h3>

        <form onSubmit={handleAppoint}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem', marginBottom: '1.25rem' }}>
            <div className="form-group">
              <label className="form-label">Select Member</label>
              <select
                className="form-select"
                value={selectedMemberId}
                onChange={e => setSelectedMemberId(e.target.value)}
              >
                {clubMembers.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.full_name} ({m.is_executive ? m.executive_title : m.player_position || 'Staff'})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Executive Role / Title</label>
              <input
                type="text"
                required
                className="form-input"
                placeholder="e.g. Club President, General Secretary"
                value={title}
                onChange={e => setTitle(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Tenure Season</label>
              <select
                className="form-select"
                value={selectedSeason}
                onChange={e => setSelectedSeason(e.target.value)}
              >
                {clubSeasons.map(s => (
                  <option key={s.id} value={s.name}>
                    {s.name} {s.is_current ? '(Active Season)' : ''}
                  </option>
                ))}
                {!clubSeasons.some(s => s.name === selectedSeason) && (
                  <option value={selectedSeason}>{selectedSeason}</option>
                )}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Display Priority Order</label>
              <input
                type="number"
                className="form-input"
                value={order}
                onChange={e => setOrder(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
            <label className="form-label">Executive Bio & Statement</label>
            <textarea
              rows={3}
              className="form-textarea"
              placeholder="Background, achievements, and club responsibilities..."
              value={bio}
              onChange={e => setBio(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Award size={16} />
              <span>Confirm Appointment</span>
            </button>
          </div>
        </form>
      </div>

      {/* Current Appointed Executive Board */}
      <div className="glass-panel" style={{ padding: '2rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.5rem' }}>
          <div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#FFFFFF' }}>
              Executive Committee Board ({filteredExecutiveMembers.length})
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              Appointed leadership governance and board appointments categorized by campaign season.
            </p>
          </div>

          {/* Season Filter Pills */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'rgba(255,255,255,0.04)', padding: '4px', borderRadius: 'var(--radius-md)' }}>
            <button
              onClick={() => setSeasonFilter('ALL')}
              style={{
                padding: '0.35rem 0.85rem',
                borderRadius: '6px',
                border: 'none',
                background: seasonFilter === 'ALL' ? 'var(--club-primary)' : 'transparent',
                color: seasonFilter === 'ALL' ? '#FFFFFF' : 'var(--text-muted)',
                fontWeight: 700,
                fontSize: '0.8rem',
                cursor: 'pointer',
              }}
            >
              All Seasons
            </button>
            {clubSeasons.map(s => (
              <button
                key={s.id}
                onClick={() => setSeasonFilter(s.name)}
                style={{
                  padding: '0.35rem 0.85rem',
                  borderRadius: '6px',
                  border: 'none',
                  background: seasonFilter === s.name ? 'var(--club-primary)' : 'transparent',
                  color: seasonFilter === s.name ? '#FFFFFF' : 'var(--text-muted)',
                  fontWeight: 700,
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                }}
              >
                {s.name} {s.is_current ? '★' : ''}
              </button>
            ))}
          </div>
        </div>

        {filteredExecutiveMembers.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2.5rem', background: 'rgba(0,0,0,0.2)', borderRadius: '10px' }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              No executive members appointed for season &quot;{seasonFilter}&quot;.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {filteredExecutiveMembers.map(exec => (
              <div
                key={exec.id}
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '1rem 1.25rem',
                  borderRadius: '10px',
                  background: 'rgba(0, 0, 0, 0.25)',
                  border: '1px solid var(--border-subtle)',
                  gap: '1rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <img
                    src={exec.photo_url}
                    alt={exec.full_name}
                    style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--club-primary)' }}
                  />
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 800, color: '#FFFFFF', fontSize: '1.05rem' }}>{exec.full_name}</span>
                      <span className="badge" style={{ backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#F59E0B', fontSize: '0.7rem' }}>
                        #{exec.executive_order}
                      </span>
                      <span className="badge" style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#10B981', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <CalendarDays size={10} />
                        {exec.executive_season || activeSeason?.name || '2026/27'} Tenure
                      </span>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--club-primary)', fontWeight: 700 }}>
                      {exec.executive_title}
                    </div>
                    {exec.executive_bio && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px', maxWidth: '500px' }}>
                        {exec.executive_bio}
                      </div>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => handleRevoke(exec.id)}
                  className="btn btn-secondary btn-sm"
                  style={{ color: '#EF4444' }}
                >
                  Revoke Role
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
