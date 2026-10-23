'use client';

import React, { useState, use } from 'react';
import { useClub } from '@/lib/club-context';
import PlayerAvatar from '@/components/PlayerAvatar';
import PlayerSearchSelect from '@/components/PlayerSearchSelect';
import { Award, Plus, CheckCircle2, CalendarDays, X } from 'lucide-react';
import { useEscapeToClose } from '@/lib/use-escape-to-close';
import { defaultSeasonLabel } from '@/lib/season';

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
  const executiveMembers = clubMembers.filter(m => m.is_executive).sort((a, b) => (a.executive_order ?? 99) - (b.executive_order ?? 99));

  // Nobody and no title picked until the admin chooses (a pre-filled name is easy to appoint by mistake)
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [title, setTitle] = useState('');
  const [bio, setBio] = useState('');
  const [order, setOrder] = useState(executiveMembers.length + 1);
  const [selectedSeason, setSelectedSeason] = useState(activeSeason?.name || defaultSeasonLabel());
  const [seasonFilter, setSeasonFilter] = useState<string>('ALL');
  const [feedback, setFeedback] = useState('');
  const [showAppointForm, setShowAppointForm] = useState(false);
  useEscapeToClose(showAppointForm, setShowAppointForm);

  // Members load from Supabase after first render, so pick defaults from current data on open
  const openAppointForm = () => {
    if (!clubMembers.some(m => m.id === selectedMemberId)) setSelectedMemberId('');
    setOrder(executiveMembers.length + 1);
    setShowAppointForm(true);
  };

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
    setShowAppointForm(false);
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
      <div style={{ marginBottom: '2rem', display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: '1rem' }}>
        <div style={{ minWidth: 0 }}>
          <span className="badge badge-primary" style={{ marginBottom: '0.4rem' }}>EXECUTIVE COMMITTEE</span>
          <h1 className="stat-value">
            Executive Committee Appointments
          </h1>
          <p className="text-body">
            Appoint club members and players to leadership posts (President, Secretary, Head Coach, Treasurer).
          </p>
        </div>
        <button type="button" className="btn btn-primary row" onClick={openAppointForm}>
          <Plus size={16} />
          <span>Appoint Member</span>
        </button>
      </div>

      {feedback && (
        <div style={{
          background: 'rgba(16, 185, 129, 0.15)',
          border: '1px solid #10B981',
          padding: '0.85rem 1.25rem',
          borderRadius: 'var(--radius-md)',
          color: 'var(--c-green)',
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

      {/* Appointment Form Popup */}
      {showAppointForm && (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(var(--dk-4-6-9), 0.88)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1rem',
        }}
        onClick={() => setShowAppointForm(false)}
      >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="committee-appoint-title"
        style={{
          background: 'linear-gradient(135deg, rgb(var(--dk-17-24-39)) 0%, rgb(var(--dk-15-23-42)) 100%)',
          border: '1px solid rgba(var(--tint-rgb), 0.12)',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '680px',
          maxHeight: '92vh',
          overflowY: 'auto',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.9)',
          color: 'var(--text-primary)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid rgba(var(--tint-rgb), 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
          <h3 id="committee-appoint-title" style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Award size={18} color="var(--c-amber)" /> Appoint Member to Committee
          </h3>
          <button
            type="button"
            onClick={() => setShowAppointForm(false)}
            aria-label="Close"
            style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleAppoint} style={{ padding: '1.5rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: '1.25rem', marginBottom: '1.25rem' }}>
            <div className="form-group">
              <label className="form-label">Select Member</label>
              <PlayerSearchSelect
                id="committee-select-member"
                players={clubMembers}
                value={selectedMemberId}
                onChange={setSelectedMemberId}
                placeholder="Search members by name..."
                optionLabel={m => `${m.full_name} (${m.is_executive ? m.executive_title : m.player_position || 'Staff'})`}
              />
            </div>

            <div className="form-group">
              <label htmlFor="committee-executive-role-title" className="form-label">Executive Role / Title</label>
              <input id="committee-executive-role-title"
                type="text"
                required
                className="form-input"
                placeholder="e.g. Club President, General Secretary"
                value={title}
                onChange={e => setTitle(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label htmlFor="committee-tenure-season" className="form-label">Tenure Season</label>
              <select id="committee-tenure-season"
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
              <label htmlFor="committee-display-priority-order" className="form-label">Display Priority Order</label>
              <input id="committee-display-priority-order"
                type="number"
                className="form-input"
                value={order}
                onChange={e => setOrder(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
            <label htmlFor="committee-executive-bio-statement" className="form-label">Executive Bio & Statement</label>
            <textarea id="committee-executive-bio-statement"
              rows={3}
              className="form-textarea"
              placeholder="Background, achievements, and club responsibilities..."
              value={bio}
              onChange={e => setBio(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: '0.75rem' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setShowAppointForm(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary row" disabled={!selectedMemberId}>
              <Award size={16} />
              <span>Confirm Appointment</span>
            </button>
          </div>
        </form>
      </div>
      </div>
      )}

      {/* Current Appointed Executive Board */}
      <div className="glass-panel" style={{ padding: '2rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.5rem' }}>
          <div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              Executive Committee Board ({filteredExecutiveMembers.length})
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              Appointed leadership governance and board appointments categorized by campaign season.
            </p>
          </div>

          {/* Season Filter Pills */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'rgba(var(--tint-rgb), 0.04)', padding: '4px', borderRadius: 'var(--radius-md)' }}>
            <button data-view-ok
              onClick={() => setSeasonFilter('ALL')}
              style={{
                padding: '0.35rem 0.85rem',
                borderRadius: '6px',
                border: 'none',
                background: seasonFilter === 'ALL' ? 'var(--club-primary)' : 'transparent',
                color: seasonFilter === 'ALL' ? 'var(--club-primary-contrast, #090D16)' : 'var(--text-muted)',
                fontWeight: 700,
                fontSize: '0.8rem',
                cursor: 'pointer',
              }}
            >
              All Seasons
            </button>
            {clubSeasons.map(s => (
              <button data-view-ok
                key={s.id}
                onClick={() => setSeasonFilter(s.name)}
                style={{
                  padding: '0.35rem 0.85rem',
                  borderRadius: '6px',
                  border: 'none',
                  background: seasonFilter === s.name ? 'var(--club-primary)' : 'transparent',
                  color: seasonFilter === s.name ? 'var(--club-primary-contrast, #090D16)' : 'var(--text-muted)',
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
          <div style={{ textAlign: 'center', padding: '2.5rem', background: 'rgba(var(--shade-rgb), 0.2)', borderRadius: '10px' }}>
            <p className="text-body">
              No executive members appointed for season &quot;{seasonFilter}&quot;.
            </p>
          </div>
        ) : (
          <div className="stack">
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
                  background: 'rgba(var(--shade-rgb), 0.25)',
                  border: '1px solid var(--border-subtle)',
                  gap: '1rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <PlayerAvatar
                    photoUrl={exec.photo_url}
                    name={exec.full_name}
                    size={48}
                    style={{ border: '2px solid var(--club-primary)' }}
                  />
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '1.05rem' }}>{exec.full_name}</span>
                      <span className="badge" style={{ backgroundColor: 'rgba(245, 158, 11, 0.15)', color: 'var(--c-amber)', fontSize: '0.7rem' }}>
                        #{exec.executive_order}
                      </span>
                      <span className="badge" style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)', color: 'var(--c-green)', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <CalendarDays size={10} />
                        {exec.executive_season || activeSeason?.name || defaultSeasonLabel()} Tenure
                      </span>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--club-ink)', fontWeight: 700 }}>
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
                  style={{ color: 'var(--c-red)' }}
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
