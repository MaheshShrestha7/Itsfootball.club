'use client';

import { getAccessToken } from '@/lib/supabase/client';
import React, { useState, use, useRef } from 'react';
import Link from 'next/link';
import { secureToken } from '@/lib/ids';
import { useClub } from '@/lib/club-context';
import { ClubMember, PlayerPosition, PlayerStatus, ClubRole } from '@/lib/supabase/types';
import {
  Users,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  X,
  Activity,
  Shield,
  Upload,
  Cloud,
  Phone,
  Mail,
  User,
  Hash,
  AlertCircle,
  Loader2,
  Briefcase,
  Award,
  FileSpreadsheet
} from 'lucide-react';
import BulkMemberModal from '@/components/BulkMemberModal';

const ALL_POSITIONS: { value: PlayerPosition; label: string; desc: string }[] = [
  { value: 'GK', label: 'GK', desc: 'Goalkeeper' },
  { value: 'CB', label: 'CB', desc: 'Center Back' },
  { value: 'LB', label: 'LB', desc: 'Left Back' },
  { value: 'RB', label: 'RB', desc: 'Right Back' },
  { value: 'CDM', label: 'CDM', desc: 'Defensive Mid' },
  { value: 'CM', label: 'CM', desc: 'Central Mid' },
  { value: 'CAM', label: 'CAM', desc: 'Attacking Mid' },
  { value: 'LW', label: 'LW', desc: 'Left Winger' },
  { value: 'RW', label: 'RW', desc: 'Right Winger' },
  { value: 'ST', label: 'ST', desc: 'Striker / Forward' },
  { value: 'SUB', label: 'SUB', desc: 'Substitute / Utility' },
];

const AVAILABLE_ROLES = [
  { id: 'Player', label: 'Player', icon: Shield, desc: 'First Team & Squad Athlete' },
  { id: 'Executive Committee', label: 'Executive Committee', icon: Award, desc: 'Governance & Board Post' },
  { id: 'Manager', label: 'Manager', icon: Briefcase, desc: 'Head Coach & Technical Staff' },
  { id: 'Club Admin', label: 'Club Admin', icon: User, desc: 'Platform Administrator' },
];

export default function AdminSquadPage({
  params,
}: {
  params: Promise<{ clubSlug: string }>;
}) {
  const resolvedParams = use(params);
  const { clubs, selectClubBySlug, members, addMember, bulkAddMembers, updateMember, deleteMember, playerStats, updatePlayerStats } = useClub();
  const club = selectClubBySlug(resolvedParams.clubSlug) || clubs[0];

  const clubMembers = members.filter(m => m.club_id === club.id);
  const [modalOpen, setModalOpen] = useState(false);
  const [statsModalOpen, setStatsModalOpen] = useState(false);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<ClubMember | null>(null);

  // Form State with Multi-Role support
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    roles: ['Player'] as string[],
    player_position: 'ST' as PlayerPosition,
    secondary_positions: [] as PlayerPosition[],
    jersey_number: 9,
    status: 'active' as PlayerStatus,
    photo_url: '',
    nationality: '',
    is_executive: false,
    executive_title: '',
  });

  // Photo Upload State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [manualUrlOpen, setManualUrlOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const [statsForm, setStatsForm] = useState({
    appearances: 0,
    goals: 0,
    assists: 0,
    clean_sheets: 0,
    yellow_cards: 0,
    red_cards: 0,
    motm_awards: 0,
    minutes_played: 0,
  });

  const handleOpenAdd = () => {
    setEditingMember(null);
    setForm({
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      roles: ['Player'],
      player_position: 'ST',
      secondary_positions: [],
      jersey_number: 9,
      status: 'active',
      photo_url: '',
      nationality: '',
      is_executive: false,
      executive_title: '',
    });
    setUploadError(null);
    setFormError(null);
    setManualUrlOpen(false);
    setModalOpen(true);
  };

  const handleOpenEdit = (m: ClubMember) => {
    setEditingMember(m);
    
    // Parse first name and last name
    const parts = (m.full_name || '').split(' ');
    const firstName = m.first_name || parts[0] || '';
    const lastName = m.last_name || parts.slice(1).join(' ') || '';

    // Extract all member roles
    let memberRoles: string[] = [];
    if (Array.isArray(m.roles) && m.roles.length > 0) {
      memberRoles = [...m.roles];
    } else if (m.role) {
      memberRoles = m.role.split(',').map((r: string) => r.trim()).filter(Boolean);
    }

    // Normalize roles into standard taxonomy
    const normalizedRoles: string[] = [];
    memberRoles.forEach(r => {
      const lower = r.toLowerCase();
      if (lower === 'player' && !normalizedRoles.includes('Player')) normalizedRoles.push('Player');
      else if ((lower.includes('executive') || m.is_executive) && !normalizedRoles.includes('Executive Committee')) normalizedRoles.push('Executive Committee');
      else if ((lower.includes('manager') || lower.includes('coach') || lower.includes('staff')) && !normalizedRoles.includes('Manager')) normalizedRoles.push('Manager');
      else if ((lower.includes('admin') || lower.includes('owner')) && !normalizedRoles.includes('Club Admin')) normalizedRoles.push('Club Admin');
      else if (!normalizedRoles.includes(r)) normalizedRoles.push(r);
    });

    if (m.is_executive && !normalizedRoles.includes('Executive Committee')) {
      normalizedRoles.push('Executive Committee');
    }

    if (normalizedRoles.length === 0) {
      normalizedRoles.push('Player');
    }

    setForm({
      first_name: firstName,
      last_name: lastName,
      email: m.email || '',
      phone: m.phone || '',
      roles: normalizedRoles,
      player_position: m.player_position || 'ST',
      secondary_positions: m.secondary_positions || [],
      jersey_number: m.jersey_number || 9,
      status: (m.status === 'inactive' ? 'inactive' : 'active') as PlayerStatus,
      photo_url: m.photo_url || '',
      nationality: m.nationality || '',
      is_executive: normalizedRoles.includes('Executive Committee') || Boolean(m.is_executive),
      executive_title: m.executive_title || '',
    });
    setUploadError(null);
    setFormError(null);
    setManualUrlOpen(false);
    setModalOpen(true);
  };

  const handleOpenStats = (m: ClubMember) => {
    setEditingMember(m);
    const existing = playerStats.find(s => s.member_id === m.id);
    setStatsForm({
      appearances: existing?.appearances || 0,
      goals: existing?.goals || 0,
      assists: existing?.assists || 0,
      clean_sheets: existing?.clean_sheets || 0,
      yellow_cards: existing?.yellow_cards || 0,
      red_cards: existing?.red_cards || 0,
      motm_awards: existing?.motm_awards || 0,
      minutes_played: existing?.minutes_played || 0,
    });
    setStatsModalOpen(true);
  };

  // Cloudflare R2 Direct Photo Uploader
  const handlePhotoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);

    // Validate size (5 MB limit)
    if (file.size > 5 * 1024 * 1024) {
      setUploadError('File size exceeds maximum 5 MB limit');
      return;
    }

    // Validate MIME
    const validMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!validMimes.includes(file.type)) {
      setUploadError('Please select a valid image file (JPEG, PNG, WebP, GIF)');
      return;
    }

    try {
      setUploadingPhoto(true);
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', 'members');

      const token = await getAccessToken();
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: formData,
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to upload photo to Cloudflare R2');
      }

      setForm(prev => ({ ...prev, photo_url: json.url }));
    } catch (err: any) {
      console.error('[Squad Admin] Photo upload error:', err);
      setUploadError(err.message || 'Error uploading photo to Cloudflare R2');
    } finally {
      setUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Toggle Multiple Roles
  const handleToggleRole = (roleId: string) => {
    setForm(prev => {
      let newRoles: string[];
      if (prev.roles.includes(roleId)) {
        if (prev.roles.length === 1) {
          setUploadError('A member must have at least one role assigned.');
          setTimeout(() => setUploadError(null), 3000);
          return prev;
        }
        newRoles = prev.roles.filter(r => r !== roleId);
      } else {
        newRoles = [...prev.roles, roleId];
      }

      return {
        ...prev,
        roles: newRoles,
        is_executive: newRoles.includes('Executive Committee'),
      };
    });
  };

  // Toggle Secondary Positions (Capped at 5)
  const handleToggleSecondaryPosition = (pos: PlayerPosition) => {
    if (form.secondary_positions.includes(pos)) {
      setForm(prev => ({
        ...prev,
        secondary_positions: prev.secondary_positions.filter(p => p !== pos),
      }));
    } else {
      if (form.secondary_positions.length >= 5) {
        setUploadError('Maximum 5 secondary positions allowed');
        setTimeout(() => setUploadError(null), 3000);
        return;
      }
      setForm(prev => ({
        ...prev,
        secondary_positions: [...prev.secondary_positions, pos],
      }));
    }
  };

  // Primary position selection automatically removes from secondary positions
  const handlePrimaryPositionChange = (pos: PlayerPosition) => {
    setForm(prev => ({
      ...prev,
      player_position: pos,
      secondary_positions: prev.secondary_positions.filter(p => p !== pos),
    }));
  };

  // Form Save
  const handleSaveMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const firstName = form.first_name.trim();
    const lastName = form.last_name.trim();
    if (!firstName || !lastName) {
      setFormError('Both First Name and Last Name are required.');
      return;
    }

    if (form.roles.length === 0) {
      setFormError('Please select at least one member role.');
      return;
    }

    const fullName = `${firstName} ${lastName}`.trim();
    const isPlayer = form.roles.includes('Player');
    const isExec = form.roles.includes('Executive Committee');
    const roleString = form.roles.join(', ');

    const memberPayload = {
      club_id: club.id,
      first_name: firstName,
      last_name: lastName,
      full_name: fullName,
      email: form.email.trim(),
      phone: form.phone.trim(),
      role: roleString as ClubRole,
      roles: form.roles,
      player_position: isPlayer ? form.player_position : undefined,
      secondary_positions: isPlayer ? form.secondary_positions : [],
      jersey_number: isPlayer ? Number(form.jersey_number) || undefined : undefined,
      status: form.status,
      photo_url: form.photo_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80',
      nationality: form.nationality.trim(),
      membership_tier: isPlayer ? 'Senior Player' : isExec ? 'Executive Board' : 'Club Staff',
      membership_expires_at: '2026-12-31',
      is_executive: isExec,
      executive_title: isExec ? form.executive_title || 'Committee Member' : undefined,
    };

    if (editingMember) {
      updateMember(editingMember.id, memberPayload);
    } else {
      addMember({
        ...memberPayload,
        qr_code_token: secureToken('pass'),
      });
    }

    setFeedback(editingMember ? `Updated ${fullName}` : `Registered ${fullName} successfully`);
    setTimeout(() => setFeedback(null), 3500);
    setModalOpen(false);
  };

  const handleDeleteMember = (memberId: string, memberName: string) => {
    if (!confirm(`Are you sure you want to remove ${memberName} from the club registry?`)) return;

    deleteMember(memberId);

    setFeedback(`Removed ${memberName}`);
    setTimeout(() => setFeedback(null), 3000);
  };

  const handleSaveStats = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMember) return;
    updatePlayerStats(editingMember.id, statsForm);
    setStatsModalOpen(false);
    setFeedback(`Updated stats for ${editingMember.full_name}`);
    setTimeout(() => setFeedback(null), 3000);
  };

  // Helper to extract member roles for table rendering
  const getMemberRoles = (member: ClubMember): string[] => {
    if (Array.isArray(member.roles) && member.roles.length > 0) {
      return member.roles;
    }
    if (member.role) {
      return member.role.split(',').map((r: string) => r.trim()).filter(Boolean);
    }
    return ['Player'];
  };

  return (
    <div>
      {/* Top Banner */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1rem',
        marginBottom: '2rem',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
            <span className="badge badge-primary">SQUAD ROSTER & PLAYERS</span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Total: {clubMembers.length} Members ({clubMembers.filter(m => {
                const roles = getMemberRoles(m);
                return roles.some(r => r.toLowerCase().includes('player')) || Boolean(m.player_position);
              }).length} Players)
            </span>
          </div>
          <h1 style={{ fontSize: '2rem', fontWeight: 900, color: '#FFFFFF' }}>
            Squad & Members Administration
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Manage first team roster, multi-role leadership (Player, Executive Committee, Manager, Club Admin), Cloudflare R2 photos, and player stats.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setBulkModalOpen(true)}
            className="btn btn-secondary"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.65rem 1.15rem',
              borderRadius: '10px',
              border: '1px solid rgba(16, 185, 129, 0.4)',
              background: 'rgba(16, 185, 129, 0.08)',
              color: '#FFFFFF',
              fontWeight: 800,
              fontSize: '0.85rem',
              cursor: 'pointer',
            }}
          >
            <FileSpreadsheet size={17} color="#10B981" />
            <span>Bulk Import / Export</span>
          </button>

          <button
            onClick={handleOpenAdd}
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.65rem 1.25rem' }}
          >
            <Plus size={18} />
            <span>Add Member / Player</span>
          </button>
        </div>
      </div>

      {/* Success Feedback Alert */}
      {feedback && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.6rem',
          padding: '0.85rem 1.25rem',
          background: 'rgba(16, 185, 129, 0.15)',
          border: '1px solid #10B981',
          borderRadius: 'var(--radius-md)',
          color: '#10B981',
          fontWeight: 700,
          marginBottom: '1.5rem',
        }}>
          <CheckCircle2 size={18} />
          <span>{feedback}</span>
        </div>
      )}

      {/* Members Grid / Table */}
      <div className="glass-panel admin-table-container" style={{ overflowX: 'auto', padding: '1rem' }}>
        <table style={{ minWidth: '780px', width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>
              <th style={{ padding: '0.75rem 1rem' }}>Member & Contact</th>
              <th style={{ padding: '0.75rem 1rem' }}>Assigned Roles</th>
              <th style={{ padding: '0.75rem 1rem' }}>Positions / Post</th>
              <th style={{ padding: '0.75rem 1rem' }}>Jersey</th>
              <th style={{ padding: '0.75rem 1rem' }}>Status</th>
              <th style={{ padding: '0.75rem 1rem' }}>QR Token</th>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {clubMembers.map(member => {
              const roles = getMemberRoles(member);
              const isPlayer = roles.some(r => r.toLowerCase().includes('player')) || Boolean(member.player_position);

              return (
                <tr
                  key={member.id}
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', transition: 'background 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  {/* Photo & Name */}
                  <td style={{ padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ position: 'relative', width: '42px', height: '42px', flexShrink: 0 }}>
                      <img
                        src={member.photo_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80'}
                        alt={member.full_name}
                        style={{ width: '100%', height: '100%', borderRadius: '10px', objectFit: 'cover', border: '1px solid var(--border-subtle)' }}
                      />
                      {member.photo_url?.includes('r2.dev') && (
                        <span
                          title="Cloudflare R2 Stored"
                          style={{
                            position: 'absolute',
                            bottom: '-4px',
                            right: '-4px',
                            width: '14px',
                            height: '14px',
                            borderRadius: '50%',
                            background: '#F59E0B',
                            border: '2px solid #0E141E',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        />
                      )}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, color: '#FFFFFF' }}>{member.full_name}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {member.email && <span>{member.email}</span>}
                        {member.phone && <span>• {member.phone}</span>}
                      </div>
                    </div>
                  </td>

                  {/* Multi-Role Badges */}
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', alignItems: 'center' }}>
                      {roles.map(r => {
                        const isExec = r.toLowerCase().includes('executive');
                        const isMgr = r.toLowerCase().includes('manager') || r.toLowerCase().includes('coach');
                        const isAdmin = r.toLowerCase().includes('admin') || r.toLowerCase().includes('owner');

                        const bg = isExec
                          ? 'rgba(245, 158, 11, 0.15)'
                          : isMgr
                          ? 'rgba(168, 85, 247, 0.15)'
                          : isAdmin
                          ? 'rgba(239, 68, 68, 0.15)'
                          : 'rgba(59, 130, 246, 0.15)';

                        const color = isExec
                          ? '#F59E0B'
                          : isMgr
                          ? '#C084FC'
                          : isAdmin
                          ? '#F87171'
                          : '#60A5FA';

                        const border = isExec
                          ? 'rgba(245, 158, 11, 0.3)'
                          : isMgr
                          ? 'rgba(168, 85, 247, 0.3)'
                          : isAdmin
                          ? 'rgba(239, 68, 68, 0.3)'
                          : 'rgba(59, 130, 246, 0.3)';

                        return (
                          <span
                            key={r}
                            className="badge"
                            style={{
                              backgroundColor: bg,
                              color: color,
                              border: `1px solid ${border}`,
                              fontWeight: 700,
                              fontSize: '0.72rem',
                              padding: '0.15rem 0.5rem',
                            }}
                          >
                            {r}
                          </span>
                        );
                      })}
                    </div>
                  </td>

                  {/* Positions / Post */}
                  <td style={{ padding: '0.75rem 1rem' }}>
                    {isPlayer ? (
                      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.3rem' }}>
                        <span
                          className="badge"
                          style={{
                            backgroundColor: 'var(--club-primary)',
                            color: '#FFFFFF',
                            fontWeight: 800,
                            padding: '0.15rem 0.45rem',
                          }}
                        >
                          {member.player_position || 'ST'} (Primary)
                        </span>
                        {member.secondary_positions && member.secondary_positions.length > 0 && (
                          member.secondary_positions.map((secPos) => (
                            <span
                              key={secPos}
                              className="badge"
                              style={{
                                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                                color: 'var(--text-secondary)',
                                padding: '0.15rem 0.4rem',
                                fontSize: '0.7rem',
                              }}
                            >
                              {secPos}
                            </span>
                          ))
                        )}
                        {member.executive_title && (
                          <span style={{ fontSize: '0.75rem', color: '#F59E0B', fontStyle: 'italic', marginLeft: '0.2rem' }}>
                            ({member.executive_title})
                          </span>
                        )}
                      </div>
                    ) : (
                      <span style={{ color: member.executive_title ? '#F59E0B' : 'var(--text-muted)', fontSize: '0.8rem', fontWeight: member.executive_title ? 600 : 400 }}>
                        {member.executive_title || 'Non-playing Staff'}
                      </span>
                    )}
                  </td>

                  {/* Jersey Number */}
                  <td style={{ padding: '0.75rem 1rem', fontFamily: 'var(--font-heading)', fontWeight: 800, color: 'var(--club-primary)' }}>
                    {isPlayer && member.jersey_number ? `#${member.jersey_number}` : '-'}
                  </td>

                  {/* Status */}
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <span className="badge" style={{
                      backgroundColor: member.status === 'active' || (member as any).is_active !== false ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                      color: member.status === 'active' || (member as any).is_active !== false ? '#10B981' : '#EF4444',
                      border: `1px solid ${member.status === 'active' || (member as any).is_active !== false ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                      fontWeight: 700,
                    }}>
                      {member.status === 'active' || (member as any).is_active !== false ? 'ACTIVE' : 'INACTIVE'}
                    </span>
                  </td>

                  {/* QR Token */}
                  <td style={{ padding: '0.75rem 1rem', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {member.qr_code_token ? `${member.qr_code_token.substring(0, 12)}...` : '-'}
                  </td>

                  {/* Actions */}
                  <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.4rem' }}>
                      {isPlayer && (
                        <button
                          onClick={() => handleOpenStats(member)}
                          className="btn btn-secondary btn-sm"
                          title="Update Match Stats"
                          style={{ padding: '0.35rem 0.6rem' }}
                        >
                          <Activity size={14} color="#F59E0B" />
                        </button>
                      )}
                      <button
                        onClick={() => handleOpenEdit(member)}
                        className="btn btn-secondary btn-sm"
                        title="Edit Member"
                        style={{ padding: '0.35rem 0.6rem' }}
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => handleDeleteMember(member.id, member.full_name)}
                        className="btn btn-danger btn-sm"
                        title="Delete Member"
                        style={{ padding: '0.35rem 0.6rem' }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Member Details Add / Edit Modal */}
      {modalOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 999,
          background: 'rgba(0, 0, 0, 0.85)',
          backdropFilter: 'blur(12px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem',
          overflowY: 'auto',
        }}>
          <div className="glass-panel" style={{
            width: '100%',
            maxWidth: 'min(680px, calc(100vw - 2rem))',
            maxHeight: '90vh',
            overflowY: 'auto',
            background: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-medium)',
            borderRadius: 'var(--radius-xl)',
            padding: 'clamp(1rem, 3vw, 2rem)',
            margin: 'auto',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '1rem' }}>
              <div>
                <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#FFFFFF', margin: 0 }}>
                  {editingMember ? 'Edit Club Member' : 'Register New Club Member'}
                </h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Multi-Role Governance • Cloudflare R2 Media • Squad Hierarchy
                </span>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.25rem' }}
              >
                <X size={20} />
              </button>
            </div>

            {formError && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.75rem 1rem',
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid #EF4444',
                borderRadius: 'var(--radius-md)',
                color: '#EF4444',
                fontSize: '0.85rem',
                marginBottom: '1.25rem',
              }}>
                <AlertCircle size={16} />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSaveMember}>
              {/* 1. CLOUDFLARE R2 PHOTO UPLOAD ZONE */}
              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Member Photo</span>
                  <span style={{ fontSize: '0.7rem', color: '#10B981', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <Cloud size={12} /> Stored on Cloudflare R2
                  </span>
                </label>

                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1.25rem',
                  padding: '1rem',
                  background: 'rgba(0, 0, 0, 0.3)',
                  border: '1px dashed var(--border-medium)',
                  borderRadius: 'var(--radius-lg)',
                }}>
                  {/* Avatar Preview */}
                  <div style={{ position: 'relative', width: '74px', height: '74px', flexShrink: 0 }}>
                    {form.photo_url ? (
                      <img
                        src={form.photo_url}
                        alt="Preview"
                        style={{ width: '100%', height: '100%', borderRadius: '12px', objectFit: 'cover', border: '2px solid var(--club-primary)' }}
                      />
                    ) : (
                      <div style={{
                        width: '100%',
                        height: '100%',
                        borderRadius: '12px',
                        background: 'rgba(255,255,255,0.06)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '1px solid var(--border-subtle)'
                      }}>
                        <User size={32} color="var(--text-muted)" />
                      </div>
                    )}
                    {uploadingPhoto && (
                      <div style={{
                        position: 'absolute',
                        inset: 0,
                        background: 'rgba(0,0,0,0.7)',
                        borderRadius: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <Loader2 size={24} className="animate-spin" color="var(--club-primary)" />
                      </div>
                    )}
                  </div>

                  {/* Upload Actions & Controls */}
                  <div style={{ flex: 1 }}>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      onChange={handlePhotoFileChange}
                      style={{ display: 'none' }}
                      id="member-photo-upload"
                    />

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
                      <label
                        htmlFor="member-photo-upload"
                        className="btn btn-secondary btn-sm"
                        style={{ cursor: uploadingPhoto ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                      >
                        <Upload size={14} />
                        <span>{form.photo_url ? 'Replace Photo' : 'Upload Photo'}</span>
                      </label>

                      {form.photo_url && (
                        <button
                          type="button"
                          onClick={() => setForm(prev => ({ ...prev, photo_url: '' }))}
                          className="btn btn-secondary btn-sm"
                          style={{ color: '#EF4444' }}
                        >
                          Remove
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => setManualUrlOpen(!manualUrlOpen)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--text-muted)',
                          fontSize: '0.75rem',
                          cursor: 'pointer',
                          textDecoration: 'underline',
                        }}
                      >
                        {manualUrlOpen ? 'Hide URL field' : 'Enter image URL manually'}
                      </button>
                    </div>

                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
                      JPEG, PNG, WebP or GIF up to 5 MB. Automatically optimized and secured on Cloudflare R2.
                    </div>

                    {uploadError && (
                      <div style={{ fontSize: '0.75rem', color: '#EF4444', marginTop: '0.35rem', fontWeight: 600 }}>
                        {uploadError}
                      </div>
                    )}
                  </div>
                </div>

                {manualUrlOpen && (
                  <div style={{ marginTop: '0.75rem' }}>
                    <input
                      type="url"
                      className="form-input"
                      placeholder="https://..."
                      value={form.photo_url}
                      onChange={e => setForm({ ...form, photo_url: e.target.value })}
                      style={{ fontSize: '0.85rem' }}
                    />
                  </div>
                )}
              </div>

              {/* 2. FIRST NAME & LAST NAME */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">First Name *</label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    placeholder="e.g. Lucas"
                    value={form.first_name}
                    onChange={e => setForm({ ...form, first_name: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Last Name *</label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    placeholder="e.g. Vazquez"
                    value={form.last_name}
                    onChange={e => setForm({ ...form, last_name: e.target.value })}
                  />
                </div>
              </div>

              {/* 3. EMAIL & PHONE NUMBER */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
                <div className="form-group">
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Mail size={13} /> Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    className="form-input"
                    placeholder="player@itsfootball.club"
                    value={form.email}
                    onChange={e => setForm({ ...form, email: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Phone size={13} /> Phone Number
                  </label>
                  <input
                    type="tel"
                    className="form-input"
                    placeholder="+1 (555) 019-2834"
                    value={form.phone}
                    onChange={e => setForm({ ...form, phone: e.target.value })}
                  />
                </div>
              </div>

              {/* 4. MULTI-ROLE SELECTION (Player, Executive Committee, Manager, Club Admin) */}
              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Member Roles * (A member can have multiple roles)</span>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--club-primary)' }}>
                    {form.roles.length} {form.roles.length === 1 ? 'role' : 'roles'} selected
                  </span>
                </label>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.65rem' }}>
                  {AVAILABLE_ROLES.map(r => {
                    const Icon = r.icon;
                    const isSelected = form.roles.includes(r.id);

                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => handleToggleRole(r.id)}
                        style={{
                          position: 'relative',
                          padding: '0.85rem 0.65rem',
                          borderRadius: 'var(--radius-md)',
                          border: isSelected ? '1px solid var(--club-primary)' : '1px solid var(--border-subtle)',
                          background: isSelected ? 'rgba(16, 185, 129, 0.14)' : 'rgba(255, 255, 255, 0.03)',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '0.35rem',
                          textAlign: 'center',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {isSelected && (
                          <span style={{
                            position: 'absolute',
                            top: '6px',
                            right: '6px',
                            width: '16px',
                            height: '16px',
                            borderRadius: '50%',
                            background: 'var(--club-primary)',
                            color: '#FFFFFF',
                            fontSize: '10px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 900,
                          }}>
                            ✓
                          </span>
                        )}
                        <Icon size={20} color={isSelected ? 'var(--club-primary)' : 'var(--text-muted)'} />
                        <span style={{ fontWeight: 800, fontSize: '0.82rem', color: isSelected ? '#FFFFFF' : 'var(--text-secondary)' }}>
                          {r.label}
                        </span>
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', lineHeight: 1.2 }}>
                          {r.desc}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 5. CONDITIONAL PLAYER SECTION (Primary Position, Secondary Positions up to 5, Jersey Number) */}
              {form.roles.includes('Player') && (
                <div style={{
                  padding: '1.25rem',
                  background: 'rgba(0, 0, 0, 0.35)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: 'var(--radius-lg)',
                  marginBottom: '1.25rem',
                }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--club-primary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Shield size={14} /> Player Positioning & Kit Specifications
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                    {/* Primary Position */}
                    <div className="form-group">
                      <label className="form-label">
                        Primary Position *
                      </label>
                      <select
                        className="form-select"
                        value={form.player_position}
                        onChange={e => handlePrimaryPositionChange(e.target.value as PlayerPosition)}
                        style={{ fontWeight: 700 }}
                      >
                        {ALL_POSITIONS.map(pos => (
                          <option key={pos.value} value={pos.value}>
                            {pos.value} — {pos.desc}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Jersey Number */}
                    <div className="form-group">
                      <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <Hash size={13} /> Jersey Number
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={99}
                        required={form.roles.includes('Player')}
                        className="form-input"
                        placeholder="e.g. 9"
                        value={form.jersey_number}
                        onChange={e => setForm({ ...form, jersey_number: Number(e.target.value) })}
                        style={{ fontFamily: 'var(--font-heading)', fontWeight: 800 }}
                      />
                    </div>
                  </div>

                  {/* Secondary Positions (Multi-select up to 5) */}
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <label className="form-label" style={{ margin: 0 }}>
                        Secondary Positions (Option to select up to 5)
                      </label>
                      <span style={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        color: form.secondary_positions.length === 5 ? '#F59E0B' : 'var(--text-muted)',
                      }}>
                        {form.secondary_positions.length} / 5 selected
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem' }}>
                      {ALL_POSITIONS.filter(p => p.value !== form.player_position).map(pos => {
                        const isSelected = form.secondary_positions.includes(pos.value);
                        const isMaxReached = form.secondary_positions.length >= 5 && !isSelected;

                        return (
                          <button
                            key={pos.value}
                            type="button"
                            disabled={isMaxReached}
                            onClick={() => handleToggleSecondaryPosition(pos.value)}
                            title={pos.desc}
                            style={{
                              padding: '0.35rem 0.65rem',
                              borderRadius: 'var(--radius-sm)',
                              border: isSelected ? '1px solid var(--club-primary)' : '1px solid var(--border-subtle)',
                              background: isSelected ? 'var(--club-primary)' : isMaxReached ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.06)',
                              color: isSelected ? '#FFFFFF' : isMaxReached ? 'var(--text-muted)' : 'var(--text-secondary)',
                              fontWeight: isSelected ? 800 : 500,
                              fontSize: '0.75rem',
                              cursor: isMaxReached ? 'not-allowed' : 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                              opacity: isMaxReached ? 0.45 : 1,
                              transition: 'all 0.15s ease',
                            }}
                          >
                            <span>{pos.value}</span>
                            {isSelected && <X size={12} />}
                          </button>
                        );
                      })}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.45rem' }}>
                      Primary position ({form.player_position}) is automatically excluded from secondary selections.
                    </div>
                  </div>
                </div>
              )}

              {/* 6. CONDITIONAL EXECUTIVE COMMITTEE TITLE (If Executive Committee is selected) */}
              {form.roles.includes('Executive Committee') && (
                <div className="form-group" style={{ marginBottom: '1.25rem', padding: '1rem', background: 'rgba(245, 158, 11, 0.05)', border: '1px solid rgba(245, 158, 11, 0.2)', borderRadius: 'var(--radius-md)' }}>
                  <label className="form-label" style={{ color: '#F59E0B', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Award size={14} /> Executive Committee Title / Post
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Club President, Vice President, Honorary Secretary, Treasurer"
                    value={form.executive_title}
                    onChange={e => setForm({ ...form, executive_title: e.target.value })}
                  />
                </div>
              )}

              {/* 7. MEMBER STATUS (ACTIVE / INACTIVE) */}
              <div className="form-group" style={{ marginBottom: '1.75rem' }}>
                <label className="form-label">Member Status *</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <button
                    type="button"
                    onClick={() => setForm(prev => ({ ...prev, status: 'active' as PlayerStatus }))}
                    style={{
                      padding: '0.75rem',
                      borderRadius: 'var(--radius-md)',
                      border: form.status === 'active' ? '1px solid #10B981' : '1px solid var(--border-subtle)',
                      background: form.status === 'active' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                      color: form.status === 'active' ? '#10B981' : 'var(--text-muted)',
                      fontWeight: 700,
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.4rem',
                    }}
                  >
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: form.status === 'active' ? '#10B981' : 'var(--text-muted)' }} />
                    <span>Active (Eligible & Enrolled)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setForm(prev => ({ ...prev, status: 'inactive' as PlayerStatus }))}
                    style={{
                      padding: '0.75rem',
                      borderRadius: 'var(--radius-md)',
                      border: form.status === 'inactive' ? '1px solid #EF4444' : '1px solid var(--border-subtle)',
                      background: form.status === 'inactive' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                      color: form.status === 'inactive' ? '#EF4444' : 'var(--text-muted)',
                      fontWeight: 700,
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.4rem',
                    }}
                  >
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: form.status === 'inactive' ? '#EF4444' : 'var(--text-muted)' }} />
                    <span>Inactive (Suspended / Lapsed)</span>
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '1.25rem' }}>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="btn btn-secondary"
                  style={{ padding: '0.65rem 1.25rem' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploadingPhoto}
                  className="btn btn-primary"
                  style={{ padding: '0.65rem 1.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                >
                  {uploadingPhoto ? <Loader2 size={16} className="animate-spin" /> : null}
                  <span>{editingMember ? 'Update Member' : 'Save Member'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stats Edit Modal */}
      {statsModalOpen && editingMember && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 999,
          background: 'rgba(0, 0, 0, 0.85)',
          backdropFilter: 'blur(12px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem',
        }}>
          <div className="glass-panel" style={{
            width: '100%',
            maxWidth: 'min(480px, calc(100vw - 2rem))',
            background: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-medium)',
            borderRadius: 'var(--radius-xl)',
            padding: 'clamp(1.2rem, 3vw, 2rem)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#FFFFFF' }}>
                  Update Player Stats
                </h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--club-primary)' }}>{editingMember.full_name}</span>
              </div>
              <button onClick={() => setStatsModalOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveStats}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Appearances</label>
                  <input
                    type="number"
                    className="form-input"
                    value={statsForm.appearances}
                    onChange={e => setStatsForm({ ...statsForm, appearances: Number(e.target.value) })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Minutes Played</label>
                  <input
                    type="number"
                    className="form-input"
                    value={statsForm.minutes_played}
                    onChange={e => setStatsForm({ ...statsForm, minutes_played: Number(e.target.value) })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Goals Scored</label>
                  <input
                    type="number"
                    className="form-input"
                    value={statsForm.goals}
                    onChange={e => setStatsForm({ ...statsForm, goals: Number(e.target.value) })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Assists</label>
                  <input
                    type="number"
                    className="form-input"
                    value={statsForm.assists}
                    onChange={e => setStatsForm({ ...statsForm, assists: Number(e.target.value) })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Clean Sheets</label>
                  <input
                    type="number"
                    className="form-input"
                    value={statsForm.clean_sheets}
                    onChange={e => setStatsForm({ ...statsForm, clean_sheets: Number(e.target.value) })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Yellow Cards</label>
                  <input
                    type="number"
                    className="form-input"
                    value={statsForm.yellow_cards}
                    onChange={e => setStatsForm({ ...statsForm, yellow_cards: Number(e.target.value) })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Red Cards</label>
                  <input
                    type="number"
                    className="form-input"
                    value={statsForm.red_cards}
                    onChange={e => setStatsForm({ ...statsForm, red_cards: Number(e.target.value) })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">MOTM Awards</label>
                  <input
                    type="number"
                    className="form-input"
                    value={statsForm.motm_awards}
                    onChange={e => setStatsForm({ ...statsForm, motm_awards: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" onClick={() => setStatsModalOpen(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Stats
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Import / Export Modal */}
      <BulkMemberModal
        isOpen={bulkModalOpen}
        onClose={() => setBulkModalOpen(false)}
        club={club}
        allMembers={members}
        onImportMembers={bulkAddMembers}
        onSuccessToast={msg => {
          setFeedback(msg);
          setTimeout(() => setFeedback(null), 4000);
        }}
      />
    </div>
  );
}
