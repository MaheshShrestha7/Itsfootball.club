'use client';

import React, { useState } from 'react';
import { PlatformAdmin } from '@/lib/supabase/types';
import { formatDate } from '@/lib/dates';
import { ShieldCheck, X, UserPlus, Trash2 } from 'lucide-react';

interface PlatformAdminsModalProps {
  isOpen: boolean;
  onClose: () => void;
  adminsList: PlatformAdmin[];
  currentAdminEmail?: string;
  onAddAdmin: (email: string, role: 'super_admin' | 'operator' | 'analyst') => Promise<void>;
  onRemoveAdmin: (email: string) => Promise<void>;
}

export default function PlatformAdminsModal({
  isOpen,
  onClose,
  adminsList,
  currentAdminEmail,
  onAddAdmin,
  onRemoveAdmin,
}: PlatformAdminsModalProps) {
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminRole, setNewAdminRole] = useState<'super_admin' | 'operator' | 'analyst'>('super_admin');
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdminEmail.trim()) return;
    setSaving(true);
    try {
      await onAddAdmin(newAdminEmail.trim().toLowerCase(), newAdminRole);
      setNewAdminEmail('');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '1rem',
      }}
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="glass-panel" style={{ width: '100%', maxWidth: '580px', padding: '1.75rem', background: 'rgb(var(--dk-9-13-22))' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ShieldCheck size={22} color="#818CF8" />
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
              Platform Super-Admins
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
          >
            <X size={20} />
          </button>
        </div>

        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem', lineHeight: 1.5 }}>
          Platform admins have global authority to access this control room, review metrics, inspect clubs, and manage announcements.
        </p>

        {/* Existing Admins List */}
        <div style={{ marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Active Admins ({adminsList.length})
          </div>
          {adminsList.map(adm => (
            <div
              key={adm.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.65rem 0.85rem',
                background: 'rgba(var(--tint-rgb), 0.04)',
                borderRadius: '6px',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.85rem' }}>
                  {adm.email} {adm.email === currentAdminEmail && <span style={{ color: 'var(--c-green)', fontSize: '0.72rem' }}>(You)</span>}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  Role: <strong style={{ color: '#818CF8' }}>{adm.role}</strong> · Added {formatDate(adm.created_at)}
                </div>
              </div>

              {adm.email !== currentAdminEmail && (
                <button
                  type="button"
                  onClick={() => onRemoveAdmin(adm.email)}
                  style={{ background: 'none', border: 'none', color: 'var(--c-red)', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700 }}
                >
                  Revoke
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Add New Admin Form */}
        <form onSubmit={handleSubmit} style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1.25rem' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.6rem' }}>
            Invite New Platform Admin
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <input
              type="email"
              required
              placeholder="Enter email (e.g. founder@domain.com)"
              value={newAdminEmail}
              onChange={e => setNewAdminEmail(e.target.value)}
              style={{
                flex: 1,
                padding: '0.55rem 0.75rem',
                background: 'rgba(var(--shade-rgb), 0.5)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '6px',
                color: 'var(--text-primary)',
                fontSize: '0.85rem',
              }}
            />
            <select
              value={newAdminRole}
              onChange={e => setNewAdminRole(e.target.value as any)}
              style={{
                padding: '0.55rem 0.75rem',
                background: 'rgba(var(--shade-rgb), 0.5)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '6px',
                color: 'var(--text-primary)',
                fontSize: '0.85rem',
              }}
            >
              <option value="super_admin">Super Admin</option>
              <option value="operator">Operator</option>
              <option value="analyst">Analyst</option>
            </select>
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.5, margin: '-0.25rem 0 0.9rem' }}>
            Super Admins can do everything, including adding and removing admins. Operators can suspend clubs, post
            announcements and edit grounds. Analysts can only look. Someone without an account yet gets access once
            they sign up and confirm this email address.
          </p>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary btn-sm"
            >
              Close
            </button>
            <button
              type="submit"
              disabled={saving || !newAdminEmail.trim()}
              className="btn btn-sm"
              style={{ background: '#6366F1', color: '#FFFFFF', border: 'none' }}
            >
              {saving ? 'Granting...' : 'Grant Access'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
