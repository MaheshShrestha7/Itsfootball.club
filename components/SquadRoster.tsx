'use client';

import React from 'react';
import { ClubMember } from '@/lib/supabase/types';
import PlayerAvatar from './PlayerAvatar';
import { Activity, Edit2, Trash2 } from 'lucide-react';

interface SquadRosterProps {
  /** Members to show (already filtered) */
  members: ClubMember[];
  /** Size of the unfiltered roster, to tell "none yet" from "none match the filters" */
  totalCount: number;
  viewMode: 'list' | 'grid';
  getMemberRoles: (m: ClubMember) => string[];
  onStats: (m: ClubMember) => void;
  onEdit: (m: ClubMember) => void;
  onDelete: (id: string, name: string) => void;
}

/** Admin roster as responsive list rows (cards on phones) or a card grid. Styles live in globals.css (.squad-*). */
export default function SquadRoster({ members, totalCount, viewMode, getMemberRoles, onStats, onEdit, onDelete }: SquadRosterProps) {
  const isActive = (m: ClubMember) => m.status === 'active' || (m as any).is_active !== false;
  const isPlayerOf = (m: ClubMember) => getMemberRoles(m).some(r => r.toLowerCase().includes('player')) || Boolean(m.player_position);

  const roleBadges = (m: ClubMember) =>
    getMemberRoles(m).map(r => {
      const lower = r.toLowerCase();
      const tone = lower.includes('executive')
        ? ['rgba(245, 158, 11, 0.15)', '#F59E0B', 'rgba(245, 158, 11, 0.3)']
        : lower.includes('manager') || lower.includes('coach')
        ? ['rgba(168, 85, 247, 0.15)', '#C084FC', 'rgba(168, 85, 247, 0.3)']
        : lower.includes('admin') || lower.includes('owner')
        ? ['rgba(239, 68, 68, 0.15)', '#F87171', 'rgba(239, 68, 68, 0.3)']
        : ['rgba(59, 130, 246, 0.15)', '#60A5FA', 'rgba(59, 130, 246, 0.3)'];
      return (
        <span
          key={r}
          className="badge"
          style={{ backgroundColor: tone[0], color: tone[1], border: `1px solid ${tone[2]}`, fontWeight: 700, fontSize: '0.72rem', padding: '0.15rem 0.5rem' }}
        >
          {r}
        </span>
      );
    });

  const positionBadges = (m: ClubMember) =>
    isPlayerOf(m) ? (
      <>
        <span className="badge" style={{ backgroundColor: 'var(--club-primary)', color: '#FFFFFF', fontWeight: 800, padding: '0.15rem 0.45rem' }}>
          {m.player_position || 'ST'} (Primary)
        </span>
        {m.secondary_positions?.map(secPos => (
          <span key={secPos} className="badge" style={{ backgroundColor: 'rgba(255, 255, 255, 0.08)', color: 'var(--text-secondary)', padding: '0.15rem 0.4rem', fontSize: '0.7rem' }}>
            {secPos}
          </span>
        ))}
        {m.executive_title && (
          <span style={{ fontSize: '0.75rem', color: '#F59E0B', fontStyle: 'italic' }}>({m.executive_title})</span>
        )}
      </>
    ) : (
      <span style={{ color: m.executive_title ? '#F59E0B' : 'var(--text-muted)', fontSize: '0.8rem', fontWeight: m.executive_title ? 600 : 400 }}>
        {m.executive_title || 'Non-playing Staff'}
      </span>
    );

  const statusBadge = (m: ClubMember) => {
    const active = isActive(m);
    return (
      <span className="badge" style={{
        backgroundColor: active ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
        color: active ? '#10B981' : '#EF4444',
        border: `1px solid ${active ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
        fontWeight: 700,
      }}>
        {active ? 'ACTIVE' : 'INACTIVE'}
      </span>
    );
  };

  const jersey = (m: ClubMember) => (isPlayerOf(m) && m.jersey_number ? `#${m.jersey_number}` : '—');

  const actions = (m: ClubMember) => (
    <>
      {isPlayerOf(m) && (
        <button onClick={() => onStats(m)} className="btn btn-secondary btn-sm" title={`Update match stats for ${m.full_name}`} aria-label={`Update match stats for ${m.full_name}`}>
          <Activity size={14} color="#F59E0B" />
        </button>
      )}
      <button onClick={() => onEdit(m)} className="btn btn-secondary btn-sm" title={`Edit ${m.full_name}`} aria-label={`Edit ${m.full_name}`}>
        <Edit2 size={14} />
      </button>
      <button onClick={() => onDelete(m.id, m.full_name)} className="btn btn-danger btn-sm" title={`Delete ${m.full_name}`} aria-label={`Delete ${m.full_name}`}>
        <Trash2 size={14} />
      </button>
    </>
  );

  if (members.length === 0) {
    return (
      <div className="glass-panel" style={{ padding: '2.5rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        {totalCount === 0 ? 'No members registered yet.' : 'No members match the current filters.'}
      </div>
    );
  }

  if (viewMode === 'grid') {
    return (
      <div className="squad-grid">
        {members.map(m => (
          <div key={m.id} className="glass-panel squad-card">
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}>
              <PlayerAvatar photoUrl={m.photo_url} name={m.full_name} size={68} style={{ borderRadius: '16px', border: '1px solid var(--border-subtle)' }} />
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.35rem' }}>
                <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 900, fontSize: '1.35rem', color: 'var(--club-primary)', lineHeight: 1 }}>{jersey(m)}</span>
                {statusBadge(m)}
              </div>
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 800, color: '#FFFFFF', fontSize: '1rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.full_name}</div>
              {(m.email || m.phone) && (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {m.email || m.phone}
                </div>
              )}
            </div>
            <div className="squad-badges">{positionBadges(m)}</div>
            <div className="squad-badges">{roleBadges(m)}</div>
            <div className="squad-card-actions">{actions(m)}</div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="glass-panel squad-list">
      <div className="squad-list-row squad-list-head" aria-hidden="true">
        <span>Member &amp; Contact</span>
        <span>Assigned Roles</span>
        <span>Positions / Post</span>
        <span>Jersey</span>
        <span>Status</span>
        <span style={{ textAlign: 'right' }}>Actions</span>
      </div>
      {members.map(m => (
        <div key={m.id} className="squad-list-row">
          <div className="squad-cell-member">
            <PlayerAvatar photoUrl={m.photo_url} name={m.full_name} size={42} style={{ borderRadius: '10px', border: '1px solid var(--border-subtle)' }} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, color: '#FFFFFF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.full_name}</div>
              {(m.email || m.phone) && (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {[m.email, m.phone].filter(Boolean).join(' • ')}
                </div>
              )}
            </div>
          </div>
          <div className="squad-cell-roles squad-badges">{roleBadges(m)}</div>
          <div className="squad-cell-position squad-badges">{positionBadges(m)}</div>
          <div className="squad-cell-jersey" style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, color: 'var(--club-primary)' }}>{jersey(m)}</div>
          <div className="squad-cell-status">{statusBadge(m)}</div>
          <div className="squad-cell-actions">{actions(m)}</div>
        </div>
      ))}
    </div>
  );

}
