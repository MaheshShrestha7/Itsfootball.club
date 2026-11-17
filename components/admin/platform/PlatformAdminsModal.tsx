'use client';

import React, { useState } from 'react';
import { PlatformAdmin } from '@/lib/supabase/types';
import { formatDate } from '@/lib/dates';
import { ShieldCheck, X, UserPlus } from 'lucide-react';
import PopupPanel from '@/components/PopupPanel';
import { useIsSuperAdmin } from '@/components/admin/platform/api';

type Role = PlatformAdmin['role'];

interface PlatformAdminsModalProps {
  isOpen: boolean;
  onClose: () => void;
  adminsList: PlatformAdmin[];
  currentAdminEmail?: string;
  /** Adds someone (invite: true emails them) or changes the role of someone already on the list */
  onAddAdmin: (email: string, role: Role, invite: boolean) => Promise<void>;
  onRemoveAdmin: (email: string) => Promise<void>;
}

const ROLES: { id: Role; label: string; what: string }[] = [
  { id: 'analyst', label: 'Analyst', what: 'Looks at everything, changes nothing.' },
  { id: 'operator', label: 'Operator', what: 'Suspends clubs, answers support, posts broadcasts, edits grounds.' },
  { id: 'super_admin', label: 'Super admin', what: 'Everything, including adding and removing admins.' },
];
const roleLabel = (r: Role) => ROLES.find(x => x.id === r)?.label || r;

/** Manage admins: who can open Mission Control, and what each of them can do (MCX-5, MCX-12). */
export default function PlatformAdminsModal({
  isOpen,
  onClose,
  adminsList,
  currentAdminEmail,
  onAddAdmin,
  onRemoveAdmin,
}: PlatformAdminsModalProps) {
  const isSuper = useIsSuperAdmin();
  const [newAdminEmail, setNewAdminEmail] = useState('');
  // No default: a new admin's power is always a deliberate choice
  const [newAdminRole, setNewAdminRole] = useState<Role | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdminEmail.trim() || !newAdminRole) return;
    setSaving('new');
    try {
      await onAddAdmin(newAdminEmail.trim().toLowerCase(), newAdminRole, true);
      setNewAdminEmail('');
      setNewAdminRole(null);
    } finally {
      setSaving(null);
    }
  };

  const changeRole = async (adm: PlatformAdmin, role: Role) => {
    if (role === adm.role) return;
    setSaving(adm.email);
    try { await onAddAdmin(adm.email, role, false); } finally { setSaving(null); }
  };

  return (
    <div className="mc-cp-scrim" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <PopupPanel onClose={onClose} label="Platform admins" className="mc-cp">
        <header className="mc-cp-h">
          <div className="mc-cp-top">
            <span className="mc-sq tone-new"><ShieldCheck size={18} aria-hidden="true" /></span>
            <div className="who">
              <h2>Platform admins</h2>
              <small>Who can open Mission Control</small>
            </div>
            <button type="button" className="mc-icon-btn" onClick={onClose} aria-label="Close"><X size={15} /></button>
          </div>
        </header>

        <section className="mc-cp-sec" aria-labelledby="mc-adm-roles">
          <h3 id="mc-adm-roles">What each role can do</h3>
          <dl className="mc-kv mc-kv-left">
            {ROLES.map(r => <React.Fragment key={r.id}><dt>{r.label}</dt><dd>{r.what}</dd></React.Fragment>)}
          </dl>
        </section>

        <section className="mc-cp-sec" aria-labelledby="mc-adm-list">
          <h3 id="mc-adm-list">On the list <span className="mc-muted num">{adminsList.length}</span></h3>
          {adminsList.map(adm => {
            const me = adm.email === currentAdminEmail;
            return (
              <div key={adm.id} className="mc-person">
                <div className="who">
                  <b>{adm.full_name || adm.email}{me ? ' (you)' : ''}</b>
                  {adm.full_name && <small>{adm.email}</small>}
                  <small>Added {formatDate(adm.created_at)}{adm.user_id ? '' : ', has not signed in yet'}</small>
                </div>
                <div className="acts">
                  {isSuper && !me ? (
                    <>
                      <label htmlFor={`mc-adm-role-${adm.id}`} className="sr-only">Role for {adm.email}</label>
                      <select id={`mc-adm-role-${adm.id}`} className="mc-select" value={adm.role} disabled={saving === adm.email} onChange={e => changeRole(adm, e.target.value as Role)}>
                        {ROLES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                      </select>
                      <button type="button" className="mc-pill-btn danger" onClick={() => onRemoveAdmin(adm.email)}>Remove</button>
                    </>
                  ) : (
                    <span className={`mc-flag${adm.role === 'super_admin' ? ' info' : ''}`}>{roleLabel(adm.role)}</span>
                  )}
                </div>
              </div>
            );
          })}
        </section>

        {isSuper ? (
          <section className="mc-cp-sec" aria-labelledby="mc-adm-add">
            <h3 id="mc-adm-add">Add someone</h3>
            <form className="mc-cp-form" onSubmit={handleSubmit}>
              <label htmlFor="mc-adm-email" className="sr-only">Their email</label>
              <input id="mc-adm-email" className="mc-input" type="email" required placeholder="Their email" value={newAdminEmail} onChange={e => setNewAdminEmail(e.target.value)} />
              <div className="mc-seg" role="radiogroup" aria-label="Their role">
                {ROLES.map(r => (
                  <button key={r.id} type="button" role="radio" aria-checked={newAdminRole === r.id} aria-pressed={newAdminRole === r.id} onClick={() => setNewAdminRole(r.id)}>{r.label}</button>
                ))}
              </div>
              <p className="mc-muted">We email them how to get in. Someone without an account gets access once they sign up with this email.</p>
              <div>
                <button type="submit" className="mc-pill-btn" disabled={saving === 'new' || !newAdminEmail.trim() || !newAdminRole}>
                  <UserPlus size={14} aria-hidden="true" /> {saving === 'new' ? 'Adding…' : newAdminRole ? `Add as ${roleLabel(newAdminRole)}` : 'Pick a role first'}
                </button>
              </div>
            </form>
          </section>
        ) : (
          <section className="mc-cp-sec">
            <p className="mc-muted">Only a Super admin can add, change or remove admins.</p>
          </section>
        )}
      </PopupPanel>
    </div>
  );
}
