'use client';

import React, { useState } from 'react';
import { useClub } from '@/lib/club-context';
import { InternalTeam, ClubMember } from '@/lib/supabase/types';
import { Users, Plus, Edit2, Trash2, Shield, User, Check, X, Award, Image as ImageIcon, Search } from 'lucide-react';
import ImageUploadZone from '@/components/ImageUploadZone';
import { DEFAULT_CREST } from '@/lib/crest';

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
    setCoverUrl('https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=1200&auto=format&fit=crop&q=80');
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
      setFeedback(`✓ Updated ${name.trim()} successfully!`);
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
      setFeedback(`✓ Created internal team "${name.trim()}"!`);
    }

    setModalOpen(false);
    setTimeout(() => setFeedback(null), 3500);
  };

  const handleDelete = (teamId: string, teamName: string) => {
    if (confirm(`Are you sure you want to delete internal team "${teamName}"?`)) {
      deleteInternalTeam(teamId);
      setFeedback(`✓ Removed ${teamName}`);
      setTimeout(() => setFeedback(null), 3000);
    }
  };

  return (
    <div>
      {/* Action Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '1.5rem',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#FFFFFF', margin: '0 0 0.25rem 0' }}>
            Internal Teams & Squads
          </h2>
          <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            Configure intra-club rosters (First Team, U-21 Academy, Staff & Legends) to include in tournaments.
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="btn btn-primary"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.65rem 1.1rem',
            fontWeight: 700,
            borderRadius: '8px',
          }}
        >
          <Plus size={16} />
          <span>Create Internal Team</span>
        </button>
      </div>

      {feedback && (
        <div
          style={{
            background: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid rgba(16, 185, 129, 0.35)',
            color: '#10B981',
            padding: '0.75rem 1rem',
            borderRadius: '8px',
            marginBottom: '1.25rem',
            fontWeight: 700,
            fontSize: '0.85rem',
          }}
        >
          {feedback}
        </div>
      )}

      {/* Teams Grid */}
      {clubInternalTeams.length === 0 ? (
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '14px',
            padding: '3rem',
            textAlign: 'center',
            color: 'var(--text-secondary)',
          }}
        >
          <Shield size={36} style={{ opacity: 0.3, margin: '0 auto 0.75rem auto' }} />
          <h3 style={{ margin: '0 0 0.5rem 0', color: '#FFFFFF', fontWeight: 800 }}>
            No Internal Teams Created
          </h3>
          <p style={{ margin: '0 0 1.25rem 0', fontSize: '0.85rem' }}>
            Build your internal squads to organize intra-club cups and friendly tournament matches.
          </p>
          <button onClick={handleOpenAdd} className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
            <Plus size={15} />
            <span>Create First Internal Team</span>
          </button>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 340px), 1fr))',
            gap: '1.25rem',
          }}
        >
          {clubInternalTeams.map(team => {
            const captain = clubMembers.find(m => m.id === team.captain_id);
            const teamPlayers = clubMembers.filter(m => (team.player_ids || []).includes(m.id));

            return (
              <div
                key={team.id}
                style={{
                  background: 'rgba(15, 23, 42, 0.85)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '16px',
                  overflow: 'hidden',
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
                  transition: 'transform 0.2s ease, border-color 0.2s ease',
                }}
              >
                {/* Team Accent Color Bar */}
                <div style={{ height: '4px', background: team.color || '#10B981', zIndex: 3 }} />

                {/* Team Cover Photo Banner with Action Buttons */}
                <div
                  style={{
                    height: '110px',
                    width: '100%',
                    background: team.cover_url
                      ? `linear-gradient(180deg, rgba(0,0,0,0.2) 0%, rgba(15, 23, 42, 0.95) 100%), url(${team.cover_url})`
                      : `linear-gradient(135deg, ${team.color || '#10B981'}40 0%, #0B1120 100%)`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    position: 'relative',
                    padding: '0.75rem 1rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                  }}
                >
                  <span
                    style={{
                      fontSize: '0.68rem',
                      fontWeight: 800,
                      background: 'rgba(0, 0, 0, 0.65)',
                      backdropFilter: 'blur(8px)',
                      color: team.color || '#10B981',
                      border: `1px solid ${team.color || '#10B981'}50`,
                      padding: '2px 8px',
                      borderRadius: '6px',
                      letterSpacing: '0.05em',
                      textTransform: 'uppercase',
                    }}
                  >
                    {team.short_name}
                  </span>

                  <div style={{ display: 'flex', gap: '0.35rem', background: 'rgba(0,0,0,0.5)', padding: '3px', borderRadius: '8px', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <button
                      onClick={() => handleOpenEdit(team)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#FFFFFF',
                        padding: '0.4rem',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                      }}
                      title="Edit Team"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      onClick={() => handleDelete(team.id, team.name)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#EF4444',
                        padding: '0.4rem',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                      }}
                      title="Delete Team"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Team Info Header with Overlaid Crest */}
                <div style={{ padding: '0 1.25rem 1.25rem 1.25rem', flex: 1, marginTop: '-26px', position: 'relative', zIndex: 2 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.85rem', marginBottom: '0.75rem' }}>
                    <div
                      style={{
                        width: '52px',
                        height: '52px',
                        borderRadius: '12px',
                        background: '#080D15',
                        border: `2px solid ${team.color || '#10B981'}`,
                        boxShadow: '0 6px 16px rgba(0, 0, 0, 0.7)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden',
                        padding: '4px',
                        flexShrink: 0,
                      }}
                    >
                      <img
                        src={team.logo_url || DEFAULT_CREST}
                        alt={team.name}
                        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                      />
                    </div>
                    <div style={{ paddingBottom: '2px', minWidth: 0 }}>
                      <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#FFFFFF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {team.name}
                      </h3>
                      {team.coach_name && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                          Coach: {team.coach_name}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Captain & Stats Row */}
                  <div
                    style={{
                      background: 'rgba(0, 0, 0, 0.3)',
                      borderRadius: '8px',
                      padding: '0.65rem 0.85rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '0.75rem',
                      marginBottom: '1rem',
                    }}
                  >
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Captain: </span>
                      <span style={{ color: '#FFFFFF', fontWeight: 700 }}>
                        {captain ? captain.full_name : 'Unassigned'}
                      </span>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Squad Size: </span>
                      <span style={{ color: '#10B981', fontWeight: 800 }}>
                        {teamPlayers.length} Athletes
                      </span>
                    </div>
                  </div>

                  {/* Assigned Roster Preview */}
                  <div>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Assigned Athletes ({teamPlayers.length})
                    </span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.4rem' }}>
                      {teamPlayers.slice(0, 8).map(player => (
                        <span
                          key={player.id}
                          style={{
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            padding: '2px 7px',
                            background: 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            borderRadius: '12px',
                            color: '#E2E8F0',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                          }}
                        >
                          {player.player_position && (
                            <span style={{ color: team.color || '#10B981', fontWeight: 800, fontSize: '0.65rem' }}>
                              {player.player_position}
                            </span>
                          )}
                          {player.full_name.split(' ')[0]}
                        </span>
                      ))}
                      {teamPlayers.length > 8 && (
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', alignSelf: 'center' }}>
                          +{teamPlayers.length - 8} more
                        </span>
                      )}
                      {teamPlayers.length === 0 && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>No players assigned yet.</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Team Modal */}
      {modalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(5, 10, 20, 0.85)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem',
          }}
          onClick={() => setModalOpen(false)}
        >
          <div
            style={{
              background: '#111827',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '600px',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)',
              color: '#FFFFFF',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '1.25rem 1.5rem',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Shield size={18} color="#10B981" />
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>
                  {editingTeam ? 'Edit Internal Team' : 'Create Internal Team'}
                </h3>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} style={{ padding: '1.5rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.4rem' }}>
                    Team Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. U-21 Academy"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.85rem',
                      background: 'rgba(0, 0, 0, 0.4)',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      borderRadius: '8px',
                      color: '#FFFFFF',
                      fontSize: '0.88rem',
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.4rem' }}>
                    Short Code
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="e.g. U21"
                    value={shortName}
                    onChange={e => setShortName(e.target.value.toUpperCase())}
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.85rem',
                      background: 'rgba(0, 0, 0, 0.4)',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      borderRadius: '8px',
                      color: '#FFFFFF',
                      fontSize: '0.88rem',
                      fontWeight: 700,
                    }}
                  />
                </div>
              </div>

              {/* Accent Color Presets */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.4rem' }}>
                  Kit / Accent Color
                </label>
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
                  <input
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
              <div style={{ marginBottom: '1.25rem', padding: '1rem', background: 'rgba(0, 0, 0, 0.25)', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#FFFFFF', marginBottom: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <ImageIcon size={15} color={color} />
                  <span>Team Identity & Media Assets</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: '1rem' }}>
                  {/* Team Crest / Logo */}
                  <div>
                    <ImageUploadZone
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
                        style={{ fontSize: '0.7rem', padding: '2px 7px', background: 'rgba(255,255,255,0.06)', color: '#FFF' }}
                      >
                        Club Crest
                      </button>
                    </div>
                  </div>

                  {/* Team Cover Photo */}
                  <div>
                    <ImageUploadZone
                      label="Team Cover Photo"
                      recommendedText="Wide 16:9 banner for squad roster"
                      currentImageUrl={coverUrl}
                      onUploadComplete={url => setCoverUrl(url)}
                      folder="banners"
                      aspectRatio="16:9"
                    />
                    <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() => setCoverUrl('https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=1200&auto=format&fit=crop&q=80')}
                        className="btn btn-sm"
                        style={{ fontSize: '0.7rem', padding: '2px 7px', background: 'rgba(255,255,255,0.06)', color: '#FFF' }}
                      >
                        Stadium
                      </button>
                      <button
                        type="button"
                        onClick={() => setCoverUrl('https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=1200&auto=format&fit=crop&q=80')}
                        className="btn btn-sm"
                        style={{ fontSize: '0.7rem', padding: '2px 7px', background: 'rgba(255,255,255,0.06)', color: '#FFF' }}
                      >
                        Floodlights
                      </button>
                      <button
                        type="button"
                        onClick={() => setCoverUrl('https://images.unsplash.com/photo-1517466787929-bc90951d0974?w=1200&auto=format&fit=crop&q=80')}
                        className="btn btn-sm"
                        style={{ fontSize: '0.7rem', padding: '2px 7px', background: 'rgba(255,255,255,0.06)', color: '#FFF' }}
                      >
                        Pitch
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Coach & Captain */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.4rem' }}>
                    Coach / Manager
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Diego Morales"
                    value={coachName}
                    onChange={e => setCoachName(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.85rem',
                      background: 'rgba(0, 0, 0, 0.4)',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      borderRadius: '8px',
                      color: '#FFFFFF',
                      fontSize: '0.88rem',
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.4rem' }}>
                    Team Captain
                  </label>
                  <select
                    value={captainId}
                    onChange={e => setCaptainId(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.85rem',
                      background: '#1F2937',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      borderRadius: '8px',
                      color: '#FFFFFF',
                      fontSize: '0.88rem',
                    }}
                  >
                    <option value="">-- Select Captain --</option>
                    {clubMembers.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.full_name} {m.player_position ? `(${m.player_position})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Squad Member Selection */}
              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700 }}>
                    Allocate Club Members ({selectedPlayerIds.length} Selected)
                  </label>
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
                      color: 'var(--club-primary)',
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
                  <input
                    type="text"
                    placeholder="Search players..."
                    value={playerSearch}
                    onChange={e => setPlayerSearch(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.75rem 0.5rem 2rem',
                      background: 'rgba(0, 0, 0, 0.4)',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      borderRadius: '8px',
                      color: '#FFFFFF',
                      fontSize: '0.8rem',
                    }}
                  />
                </div>

                <div
                  style={{
                    maxHeight: '180px',
                    overflowY: 'auto',
                    background: 'rgba(0, 0, 0, 0.35)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '8px',
                    padding: '0.5rem',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
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
                      <div
                        key={member.id}
                        onClick={() => handleTogglePlayer(member.id)}
                        style={{
                          padding: '0.45rem 0.6rem',
                          borderRadius: '6px',
                          background: isChecked ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                          border: isChecked ? '1px solid #10B981' : '1px solid rgba(255, 255, 255, 0.06)',
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
                          onChange={() => {}}
                          style={{ cursor: 'pointer' }}
                        />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 600, color: '#FFFFFF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {member.full_name}
                          </div>
                          {member.player_position && (
                            <span style={{ fontSize: '0.65rem', color: '#10B981', fontWeight: 800 }}>
                              {member.player_position}
                            </span>
                          )}
                        </div>
                      </div>
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
                  {editingTeam ? 'Save Changes' : 'Create Team'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
