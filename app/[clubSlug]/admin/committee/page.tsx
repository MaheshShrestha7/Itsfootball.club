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
      <div className="admin-head">
        <div>
          <h1>Committee</h1>
          <p>Appoint members and players to club posts: president, secretary, head coach, treasurer.</p>
        </div>
        <div className="admin-head-actions">
          <button type="button" className="btn btn-primary row" onClick={openAppointForm}>
            <Plus size={16} aria-hidden="true" />
            <span>Appoint a member</span>
          </button>
        </div>
      </div>

      {feedback && (
        <div role="status" className="admin-flash">
          <CheckCircle2 size={16} aria-hidden="true" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Appointment Form Popup */}
      {showAppointForm && (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'var(--color-scrim)',
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
          background: 'var(--color-paper-2)',
          border: '1px solid var(--color-rule-strong)',
          borderRadius: 'var(--radius-card)',
          width: '100%',
          maxWidth: '680px',
          maxHeight: '92vh',
          overflowY: 'auto',
          boxShadow: 'var(--shadow-pop)',
          color: 'var(--text-primary)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid color-mix(in oklab, var(--color-ink) 8%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
          <h3 id="committee-appoint-title" style={{ margin: 0, fontSize: 'var(--text-xl)', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Award size={18} aria-hidden="true" /> Appoint to the committee
          </h3>
          <button
            type="button"
            onClick={() => setShowAppointForm(false)}
            aria-label="Close"
            className="admin-icon-btn"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleAppoint} style={{ padding: '1.5rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: '1.25rem', marginBottom: '1.25rem' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="committee-select-member">Member</label>
              <PlayerSearchSelect
                id="committee-select-member"
                players={clubMembers}
                value={selectedMemberId}
                onChange={setSelectedMemberId}
                placeholder="Search members by name"
                optionLabel={m => `${m.full_name} (${m.is_executive ? m.executive_title : m.player_position || 'Staff'})`}
              />
            </div>

            <div className="form-group">
              <label htmlFor="committee-executive-role-title" className="form-label">Post</label>
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
              <label htmlFor="committee-tenure-season" className="form-label">Season</label>
              <select id="committee-tenure-season"
                className="form-select"
                value={selectedSeason}
                onChange={e => setSelectedSeason(e.target.value)}
              >
                {clubSeasons.map(s => (
                  <option key={s.id} value={s.name}>
                    {s.name} {s.is_current ? '(current)' : ''}
                  </option>
                ))}
                {!clubSeasons.some(s => s.name === selectedSeason) && (
                  <option value={selectedSeason}>{selectedSeason}</option>
                )}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="committee-display-priority-order" className="form-label">Order on the committee page</label>
              <input id="committee-display-priority-order"
                type="number"
                className="form-input"
                value={order}
                onChange={e => setOrder(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
            <label htmlFor="committee-executive-bio-statement" className="form-label">About them</label>
            <textarea id="committee-executive-bio-statement"
              rows={3}
              className="form-textarea"
              placeholder="Background, achievements and what they look after at the club"
              value={bio}
              onChange={e => setBio(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: '0.75rem' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setShowAppointForm(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary row" disabled={!selectedMemberId}>
              <Award size={16} aria-hidden="true" />
              <span>Appoint</span>
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
            <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 600, color: 'var(--text-primary)' }}>
              The committee ({filteredExecutiveMembers.length})
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              Who holds each post, season by season.
            </p>
          </div>

          <div className="admin-chips" role="group" aria-label="Season">
            <button data-view-ok type="button" className="admin-chip" aria-pressed={seasonFilter === 'ALL'} onClick={() => setSeasonFilter('ALL')}>
              All seasons
            </button>
            {clubSeasons.map(s => (
              <button data-view-ok type="button" className="admin-chip" key={s.id} aria-pressed={seasonFilter === s.name} onClick={() => setSeasonFilter(s.name)}>
                {s.name}{s.is_current && <span className="num">current</span>}
              </button>
            ))}
          </div>
        </div>

        {filteredExecutiveMembers.length === 0 ? (
          <div className="admin-empty">
            <p style={{ margin: 0 }}>
              {seasonFilter === 'ALL' ? 'No committee members yet. Appoint a member to add your first one.' : `No committee members for the ${seasonFilter} season.`}
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
                  background: 'var(--color-paper)',
                  border: '1px solid var(--border-subtle)',
                  gap: '1rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <PlayerAvatar
                    photoUrl={exec.photo_url}
                    name={exec.full_name}
                    size={48}
                    style={{ border: '2px solid var(--color-accent)' }}
                  />
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '1.05rem' }}>{exec.full_name}</span>
                      <span className="admin-pill" title="Order on the committee page">
                        No. {exec.executive_order}
                      </span>
                      <span className="admin-pill">
                        <CalendarDays size={10} aria-hidden="true" />
                        {exec.executive_season || activeSeason?.name || defaultSeasonLabel()}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--color-accent-ink)', fontWeight: 600 }}>
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
                  type="button"
                  onClick={() => handleRevoke(exec.id)}
                  className="btn btn-secondary btn-sm"
                  style={{ color: 'var(--color-danger)' }}
                >
                  Remove from the post
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
