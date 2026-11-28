'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useClub } from '@/lib/club-context';
import { InternalTeam } from '@/lib/supabase/types';
import { Plus, Trash2, Shield, Check, X, Image as ImageIcon, Search, Split, CheckCircle2 } from 'lucide-react';
import ImageUploadZone from '@/components/ImageUploadZone';
import CoverPresetPicker from '@/components/CoverPresetPicker';
import PlayerSearchSelect from '@/components/PlayerSearchSelect';
import { DEFAULT_CREST } from '@/lib/crest';
import { confirmAction } from '@/components/ConfirmDialog';
import PopupPanel from '@/components/PopupPanel';

interface InternalTeamsManagerProps {
  clubSlug: string;
}

const COLOR_PRESETS = [
  { label: 'Emerald', value: '#10B981' },
  { label: 'Cobalt', value: '#2563EB' },
  { label: 'Crimson', value: '#EF4444' },
  { label: 'Gold', value: '#F59E0B' },
  { label: 'Purple', value: '#8B5CF6' },
  { label: 'Cyan', value: '#06B6D4' },
  { label: 'Obsidian', value: '#334155' },
];

export default function InternalTeamsManager({ clubSlug }: InternalTeamsManagerProps) {
  const {
    clubs,
    selectClubBySlug,
    members,
    internalTeams,
    createInternalTeam,
    updateInternalTeam,
    deleteInternalTeam,
    tournaments,
    tournamentParticipants,
    matches,
  } = useClub();

  const club = selectClubBySlug(clubSlug) || clubs[0];
  const clubMembers = members.filter(m => m.club_id === club.id);
  const clubInternalTeams = internalTeams.filter(t => t.club_id === club.id);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<InternalTeam | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [shortName, setShortName] = useState('');
  const [color, setColor] = useState('#10B981');
  const [logoUrl, setLogoUrl] = useState(DEFAULT_CREST);
  const [coverUrl, setCoverUrl] = useState('');
  const [coachName, setCoachName] = useState('');
  const [captainId, setCaptainId] = useState('');
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [playerSearch, setPlayerSearch] = useState('');

  const filteredMembers = clubMembers.filter(m =>
    m.full_name.toLowerCase().includes(playerSearch.trim().toLowerCase())
  );

  const handleOpenAdd = () => {
    setEditingTeam(null);
    setName('');
    setShortName('');
    setColor('#10B981');
    setLogoUrl(club.logo_url || DEFAULT_CREST);
    setCoverUrl('');
    setCoachName('');
    setCaptainId('');
    setSelectedPlayerIds([]);
    setPlayerSearch('');
    setModalOpen(true);
  };

  const handleOpenEdit = (team: InternalTeam) => {
    setEditingTeam(team);
    setName(team.name);
    setShortName(team.short_name);
    setColor(team.color || '#10B981');
    setLogoUrl(team.logo_url || club.logo_url || DEFAULT_CREST);
    setCoverUrl(team.cover_url || '');
    setCoachName(team.coach_name || '');
    setCaptainId(team.captain_id || '');
    setSelectedPlayerIds(team.player_ids || []);
    setPlayerSearch('');
    setModalOpen(true);
  };

  const handleTogglePlayer = (memberId: string) => {
    setSelectedPlayerIds(prev =>
      prev.includes(memberId) ? prev.filter(id => id !== memberId) : [...prev, memberId]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (editingTeam) {
      updateInternalTeam(editingTeam.id, {
        name: name.trim(),
        short_name: shortName.trim() || name.slice(0, 4).toUpperCase(),
        color,
        logo_url: logoUrl || DEFAULT_CREST,
        cover_url: coverUrl || undefined,
        coach_name: coachName.trim(),
        captain_id: captainId || undefined,
        player_ids: selectedPlayerIds,
      });
      setFeedback(`Saved ${name.trim()}`);
    } else {
      createInternalTeam({
        club_id: club.id,
        name: name.trim(),
        short_name: shortName.trim() || name.slice(0, 4).toUpperCase(),
        color,
        logo_url: logoUrl || DEFAULT_CREST,
        cover_url: coverUrl || undefined,
        coach_name: coachName.trim(),
        captain_id: captainId || undefined,
        player_ids: selectedPlayerIds,
      });
      setFeedback(`Added ${name.trim()}`);
    }

    setModalOpen(false);
    setTimeout(() => setFeedback(null), 3500);
  };

  const handleDelete = async (teamId: string, teamName: string) => {
    if (await confirmAction({ title: `Delete "${teamName}"?`, message: 'The side will be removed. Its players stay members of the club.', confirmLabel: 'Delete side', danger: true })) {
      deleteInternalTeam(teamId);
      setFeedback(`Removed ${teamName}`);
      setTimeout(() => setFeedback(null), 3000);
    }
  };

  // Each side with its captain, players and the cups it is entered in (and how many games it has there)
  const sides = clubInternalTeams.map(team => {
    const cups = tournamentParticipants
      .filter(p => p.internal_team_id === team.id)
      .flatMap(p => {
        const t = tournaments.find(x => x.id === p.tournament_id);
        if (!t) return [];
        const games = matches.filter(m => m.tournament_id === t.id && (m.home_team_name === p.name || m.away_team_name === p.name)).length;
        return [{ id: t.id, name: t.name, status: t.status, games }];
      });
    return {
      team,
      captain: clubMembers.find(m => m.id === team.captain_id),
      players: clubMembers.filter(m => (team.player_ids || []).includes(m.id)),
      cups,
    };
  });

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', paddingBottom: '3rem' }}>
      <div className="admin-head">
        <div>
          <h1 className="ihs-title"><Split size={24} aria-hidden="true" /> In-house sides</h1>
          <p>
            Your own members split into sides, for club cups and fun days. Registered teams like First team and Reserves stay on{' '}
            <Link href={`/${club.slug}/admin/teams`} className="ihs-link">Club teams</Link>.
          </p>
        </div>
        {clubInternalTeams.length > 0 && (
          <div className="admin-head-actions">
            <button type="button" onClick={handleOpenAdd} className="btn btn-primary btn-sm">
              <Plus size={16} aria-hidden="true" />
              <span>New side</span>
            </button>
          </div>
        )}
      </div>

      {feedback && (
        <div role="status" className="admin-flash">
          <CheckCircle2 size={16} aria-hidden="true" />
          <span>{feedback}</span>
        </div>
      )}

      {clubInternalTeams.length === 0 ? (
        <div className="admin-panel admin-empty">
          <b className="ihs-strong">No sides yet</b>
          <ol className="ihs-steps">
            <li>Make two or more sides, like Reds and Blues, and pick their players.</li>
            <li>Set up a cup in <Link href={`/${club.slug}/admin/tournaments`} className="ihs-link">Tournaments and cups</Link> and tick your sides.</li>
            <li>Score their games in Match Centre, under Tournaments.</li>
          </ol>
          <button type="button" onClick={handleOpenAdd} className="btn btn-primary btn-sm">
            <Plus size={16} aria-hidden="true" />
            <span>New side</span>
          </button>
        </div>
      ) : (
        <>
          {/* Wide screens: a table. Phones: one row per side (admin.css swaps them) */}
          <div className="admin-panel admin-table-wrap ihs-table">
            <table className="admin-table">
              <thead>
                <tr><th>Side</th><th>Captain</th><th className="is-num">Players</th><th>Players on it</th><th>Played in</th><th className="is-actions"><span className="sr-only">Actions</span></th></tr>
              </thead>
              <tbody>
                {sides.map(({ team, captain, players, cups }) => (
                  <tr key={team.id}>
                    <td>
                      <div className="ihs-side">
                        <Crest team={team} />
                        <div><b className="ihs-strong">{team.name}</b><small>{team.coach_name ? `Coach: ${team.coach_name}` : 'No coach yet'}</small></div>
                      </div>
                    </td>
                    <td className={captain ? 'is-strong' : undefined}>{captain ? captain.full_name : 'Not picked'}</td>
                    <td className="is-num">{players.length}</td>
                    <td>
                      <div className="ihs-roster">
                        {players.slice(0, 4).map(p => <span key={p.id}>{p.full_name.split(' ')[0]}</span>)}
                        {players.length > 4 && <span className="is-more">+{players.length - 4} more</span>}
                        {players.length === 0 && <span className="is-more">No players yet</span>}
                      </div>
                    </td>
                    <td>
                      {cups.length === 0 ? 'Not in a cup yet' : cups.map(c => (
                        <div key={c.id}>
                          <Link href={`/${club.slug}/admin/tournaments/${c.id}`} className="ihs-link">{c.name}</Link>
                          <small>{STATUS_WORD[c.status] || c.status}, {c.games} {c.games === 1 ? 'game' : 'games'}</small>
                        </div>
                      ))}
                    </td>
                    <td className="is-actions">
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleOpenEdit(team)} aria-label={`Edit ${team.name}`}>Edit</button>
                      <button type="button" data-needs-full className="admin-icon-btn is-danger" onClick={() => handleDelete(team.id, team.name)} aria-label={`Delete ${team.name}`}>
                        <Trash2 size={16} aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="admin-panel ihs-list">
            {sides.map(({ team, captain, players, cups }) => (
              <li key={team.id}>
                <Crest team={team} />
                <div className="ihs-list-body">
                  <b className="ihs-strong">{team.name}</b>
                  <p>{players.length} {players.length === 1 ? 'player' : 'players'}, {captain ? `captain ${captain.full_name}` : 'no captain yet'}</p>
                  <p className="is-muted">{cups.length === 0 ? 'Not in a cup yet' : cups.map(c => `${c.name}, ${(STATUS_WORD[c.status] || c.status).toLowerCase()}`).join('; ')}</p>
                </div>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleOpenEdit(team)} aria-label={`Edit ${team.name}`}>Edit</button>
                <button type="button" data-needs-full className="admin-icon-btn is-danger" onClick={() => handleDelete(team.id, team.name)} aria-label={`Delete ${team.name}`}>
                  <Trash2 size={16} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>

          <p className="ihs-tip">
            A player can be on more than one side. To put a side in a cup, open the cup in{' '}
            <Link href={`/${club.slug}/admin/tournaments`} className="ihs-link">Tournaments and cups</Link> and tick it under your own sides.
          </p>
        </>
      )}
      {/* Create / Edit Team Modal */}
      {modalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(var(--dk-4-6-9), 0.85)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem',
          }}
          onClick={() => setModalOpen(false)}
        >
          <PopupPanel onClose={() => setModalOpen(false)} label="Team details"
            style={{
              background: 'rgb(var(--dk-17-24-39))',
              border: '1px solid rgba(var(--tint-rgb), 0.12)',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '600px',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)',
              color: 'var(--text-primary)',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '1.25rem 1.5rem',
                borderBottom: '1px solid rgba(var(--tint-rgb), 0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div className="row">
                <Shield size={18} color="var(--c-green)" />
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>
                  {editingTeam ? `Edit ${editingTeam.name}` : 'New side'}
                </h3>
              </div>
              <button type="button" aria-label="Close" className="icon-close" onClick={() => setModalOpen(false)}>
                <X size={20} aria-hidden="true" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} style={{ padding: '1.5rem' }}>
              <div className="form-row-2-1" style={{ gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label htmlFor="internalteamsmanager-team-name" className="form-label" style={{ display: 'block', marginBottom: '0.4rem' }}>
                    Team Name *
                  </label>
                  <input id="internalteamsmanager-team-name"
                    type="text"
                    required
                    placeholder="e.g. U-21 Academy"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="form-input"
                  />
                </div>
                <div>
                  <label htmlFor="internalteamsmanager-short-code" className="form-label" style={{ display: 'block', marginBottom: '0.4rem' }}>
                    Short Code
                  </label>
                  <input id="internalteamsmanager-short-code"
                    type="text"
                    maxLength={6}
                    placeholder="e.g. U21"
                    value={shortName}
                    onChange={e => setShortName(e.target.value.toUpperCase())}
                    className="form-input"
                    style={{ fontWeight: 700 }}
                  />
                </div>
              </div>

              {/* Accent Color Presets */}
              <div style={{ marginBottom: '1rem' }}>
                <div className="form-label" style={{ marginBottom: '0.4rem' }}>
                  Kit / Accent Color
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {COLOR_PRESETS.map(c => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setColor(c.value)}
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        background: c.value,
                        border: color === c.value ? '3px solid #FFFFFF' : '2px solid rgba(0,0,0,0.5)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      title={c.label}
                    >
                      {color === c.value && <Check size={14} color="#000" />}
                    </button>
                  ))}
                  <input aria-label="Custom team colour"
                    type="color"
                    value={color}
                    onChange={e => setColor(e.target.value)}
                    style={{
                      width: '32px',
                      height: '32px',
                      border: 'none',
                      borderRadius: '50%',
                      cursor: 'pointer',
                      background: 'transparent',
                    }}
                    title="Custom Color"
                  />
                </div>
              </div>

              {/* Team Crest & Cover Photo Upload Zones */}
              <div style={{ marginBottom: '1.25rem', padding: '1rem', background: 'rgba(var(--shade-rgb), 0.25)', borderRadius: '12px', border: '1px solid rgba(var(--tint-rgb), 0.08)' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <ImageIcon size={15} color={color} />
                  <span>Team Identity & Media Assets</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: '1rem' }}>
                  {/* Team Crest / Logo */}
                  <div>
                    <ImageUploadZone
                      clubId={club.id}
                      label="Team Crest (Logo)"
                      recommendedText="Square 500x500px PNG or SVG"
                      currentImageUrl={logoUrl}
                      onUploadComplete={url => setLogoUrl(url)}
                      folder="crests"
                      aspectRatio="1:1"
                    />
                    <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() => setLogoUrl(club.logo_url || DEFAULT_CREST)}
                        className="btn btn-sm"
                        style={{ fontSize: '0.7rem', padding: '2px 7px', background: 'rgba(var(--tint-rgb), 0.06)', color: 'var(--text-primary)' }}
                      >
                        Club Crest
                      </button>
                    </div>
                  </div>

                  {/* Team Cover Photo */}
                  <div>
                    <ImageUploadZone
                      clubId={club.id}
                      label="Team Cover Photo"
                      recommendedText="Wide 16:9 banner for squad roster"
                      currentImageUrl={coverUrl}
                      onUploadComplete={url => setCoverUrl(url)}
                      folder="banners"
                      aspectRatio="16:9"
                    />
                    <CoverPresetPicker value={coverUrl} onPick={setCoverUrl} />
                  </div>
                </div>
              </div>

              {/* Coach & Captain */}
              <div className="form-row-2" style={{ gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label htmlFor="internalteamsmanager-coach-manager" className="form-label" style={{ display: 'block', marginBottom: '0.4rem' }}>
                    Coach / Manager
                  </label>
                  <input id="internalteamsmanager-coach-manager"
                    type="text"
                    placeholder="e.g. Diego Morales"
                    value={coachName}
                    onChange={e => setCoachName(e.target.value)}
                    className="form-input"
                  />
                </div>
                <div>
                  <div className="form-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                    <span>Team Captain</span>
                    {captainId && (
                      <button
                        type="button"
                        onClick={() => setCaptainId('')}
                        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', padding: 0 }}
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <PlayerSearchSelect
                    id="internal-team-captain"
                    players={clubMembers}
                    value={captainId}
                    onChange={setCaptainId}
                    placeholder="Search captain by name or number..."
                  />
                </div>
              </div>

              {/* Squad Member Selection */}
              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                  <div className="form-label">
                    Allocate Club Members ({selectedPlayerIds.length} Selected)
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedPlayerIds(
                        selectedPlayerIds.length === clubMembers.length
                          ? []
                          : clubMembers.map(m => m.id)
                      )
                    }
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--club-ink)',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {selectedPlayerIds.length === clubMembers.length ? 'Clear All' : 'Select All Squad'}
                  </button>
                </div>

                <div style={{ position: 'relative', marginBottom: '0.5rem' }}>
                  <Search size={14} style={{ position: 'absolute', left: '0.65rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input aria-label="Search players"
                    type="text"
                    placeholder="Search players..."
                    value={playerSearch}
                    onChange={e => setPlayerSearch(e.target.value)}
                    className="form-input"
                    style={{ paddingLeft: '2rem' }}
                  />
                </div>

                <div
                  style={{
                    maxHeight: '180px',
                    overflowY: 'auto',
                    background: 'rgba(var(--shade-rgb), 0.35)',
                    border: '1px solid rgba(var(--tint-rgb), 0.08)',
                    borderRadius: '8px',
                    padding: '0.5rem',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 160px), 1fr))',
                    gap: '0.4rem',
                  }}
                >
                  {filteredMembers.length === 0 && (
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', padding: '0.4rem' }}>
                      No players match &quot;{playerSearch}&quot;.
                    </span>
                  )}
                  {filteredMembers.map(member => {
                    const isChecked = selectedPlayerIds.includes(member.id);
                    return (
                      <label
                        key={member.id}
                        style={{
                          padding: '0.45rem 0.6rem',
                          borderRadius: '6px',
                          background: isChecked ? 'rgba(16, 185, 129, 0.15)' : 'rgba(var(--tint-rgb), 0.03)',
                          border: isChecked ? '1px solid #10B981' : '1px solid rgba(var(--tint-rgb), 0.06)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.45rem',
                          fontSize: '0.78rem',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleTogglePlayer(member.id)}
                          style={{ cursor: 'pointer' }}
                        />
                        <span style={{ display: 'block', minWidth: 0 }}>
                          <span style={{ display: 'block', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {member.full_name}
                          </span>
                          {member.player_position && (
                            <span style={{ fontSize: '0.7rem', color: 'var(--c-green)', fontWeight: 800 }}>
                              {member.player_position}
                            </span>
                          )}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Submit Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="btn btn-secondary"
                  style={{ padding: '0.65rem 1.25rem', borderRadius: '8px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ padding: '0.65rem 1.5rem', borderRadius: '8px', fontWeight: 800 }}
                >
                  {editingTeam ? 'Save changes' : 'Add side'}
                </button>
              </div>
            </form>
          </PopupPanel>
        </div>
      )}
    </div>
  );
}

// Same words as the Tournaments list
const STATUS_WORD: Record<string, string> = { draft: 'Draft', ongoing: 'In progress', completed: 'Completed' };

/** The side's short name in a frame of its colour (sides usually share the club crest, so the name tells them apart) */
function Crest({ team }: { team: InternalTeam }) {
  return <span className="ihs-crest" style={{ '--side': team.color || '#10B981' } as React.CSSProperties}>{team.short_name}</span>;
}
