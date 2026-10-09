'use client';

import React, { use, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { KeyRound, Plus, Save, Trash2, Lock, Users } from 'lucide-react';
import { useClub } from '@/lib/club-context';
import { useAuth } from '@/lib/auth-context';
import { getSupabaseClient } from '@/lib/supabase/client';
import { useAccessRoles, AccessRole } from '@/lib/access-roles';
import { ACCESS_AREAS, ACCESS_LEVELS, AccessLevel, memberLabels } from '@/lib/permissions';
import { confirmAction, notify } from '@/components/ConfirmDialog';

const cell: React.CSSProperties = { padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--border-subtle)', fontSize: '0.84rem', textAlign: 'left' };
const groups = [...new Set(ACCESS_AREAS.map(a => a.group))];

interface Draft {
  name: string;
  description: string;
  permissions: Record<string, AccessLevel>;
}

const toDraft = (r: AccessRole): Draft => ({ name: r.name, description: r.description || '', permissions: { ...r.permissions } });

export default function AdminRolesPage({ params }: { params: Promise<{ clubSlug: string }> }) {
  const { clubSlug } = use(params);
  const { clubs, selectClubBySlug, members } = useClub();
  const { isClubSuperUser, refreshRoles } = useAuth();
  const club = selectClubBySlug(clubSlug) || clubs[0];
  const db = getSupabaseClient();
  const { roles, loading, error, reload } = useAccessRoles(club.id);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [newName, setNewName] = useState('');
  const [copyFrom, setCopyFrom] = useState('');

  const selected = roles.find(r => r.id === selectedId) || roles.find(r => !r.is_super) || roles[0];
  useEffect(() => {
    setDraft(selected ? toDraft(selected) : null);
  }, [selected]);

  const holders = useMemo(() => {
    const byRole: Record<string, string[]> = {};
    for (const r of roles) {
      byRole[r.id] = members
        .filter(m => m.club_id === club.id && memberLabels(m.role, m.roles).some(l => l.toLowerCase() === r.name.toLowerCase()))
        .map(m => m.full_name);
    }
    return byRole;
  }, [roles, members, club.id]);

  if (!isClubSuperUser(club.id)) {
    return <p style={{ color: 'var(--text-secondary)' }}>Only the club Owner or a Club Admin can manage roles.</p>;
  }

  const dirty = !!selected && !!draft && JSON.stringify(toDraft(selected)) !== JSON.stringify(draft);

  const setLevel = (area: string, level: string) => {
    setDraft(d => {
      if (!d) return d;
      const permissions = { ...d.permissions };
      if (level) permissions[area] = level as AccessLevel;
      else delete permissions[area];
      return { ...d, permissions };
    });
  };

  // Changing the roles can change what the signed-in admin's own menu shows
  const afterChange = async (id?: string) => {
    await reload();
    if (id) setSelectedId(id);
    refreshRoles();
  };

  const save = async () => {
    if (!db || !selected || !draft) return;
    const name = draft.name.trim();
    if (!name) return notify('Give the role a name.');
    setSaving(true);
    const { error: err } = await db
      .from('club_access_roles')
      .update(selected.is_super
        ? { description: draft.description.trim() || null }
        : { name, description: draft.description.trim() || null, permissions: draft.permissions })
      .eq('id', selected.id);
    setSaving(false);
    if (err) return notify('Could not save the role.', err.code === '23505' ? `There is already a role called "${name}".` : err.message);
    afterChange(selected.id);
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    if (!db || !name) return;
    const template = roles.find(r => r.id === copyFrom);
    const { data, error: err } = await db
      .from('club_access_roles')
      .insert({
        club_id: club.id,
        name,
        permissions: template && !template.is_super ? template.permissions : {},
        sort_order: Math.max(0, ...roles.map(r => r.sort_order)) + 10,
      })
      .select('id')
      .single();
    if (err) return notify('Could not add the role.', err.code === '23505' ? `There is already a role called "${name}".` : err.message);
    setNewName('');
    setCopyFrom('');
    afterChange(data.id);
  };

  const remove = async () => {
    if (!db || !selected || selected.is_super) return;
    const count = holders[selected.id]?.length || 0;
    const ok = await confirmAction({
      title: `Delete the ${selected.name} role?`,
      message: count > 0
        ? `${count} ${count === 1 ? 'person loses' : 'people lose'} this role and the access it gives.`
        : 'Nobody holds this role at the moment.',
      confirmLabel: 'Delete role',
      danger: true,
    });
    if (!ok) return;
    const { error: err } = await db.from('club_access_roles').delete().eq('id', selected.id);
    if (err) return notify('Could not delete the role.', err.message);
    setSelectedId(null);
    afterChange();
  };

  return (
    <div className="stack">
      <div>
        <span className="badge badge-primary" style={{ marginBottom: '0.4rem', letterSpacing: '0.05em' }}>PEOPLE • ACCESS</span>
        <h1 style={{ fontSize: '2.2rem', fontWeight: 900, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <KeyRound size={30} /> Roles &amp; Permissions
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', maxWidth: '720px', marginTop: '0.2rem' }}>
          Decide what each role can do in this admin area, and add your own roles. Give someone a role on the{' '}
          <Link href={`/${club.slug}/admin/squad`}>Squad &amp; Players</Link> page. Someone with several roles gets the
          highest level any of them gives.
        </p>
      </div>

      {error && (
        <div role="alert" className="glass-panel" style={{ padding: '1rem 1.25rem', borderLeft: '4px solid #EF4444' }}>
          Could not load the roles: {error}
        </div>
      )}

      {/* Role picker */}
      <div className="glass-panel" style={{ padding: '1.25rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {loading && <span className="text-meta">Loading roles...</span>}
          {roles.map(r => (
            <button
              key={r.id}
              type="button"
              onClick={() => setSelectedId(r.id)}
              className={selected?.id === r.id ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
              aria-pressed={selected?.id === r.id}
            >
              {r.is_super && <Lock size={12} />}
              <span>{r.name}</span>
              <span style={{ opacity: 0.7 }}>({holders[r.id]?.length || 0})</span>
            </button>
          ))}
        </div>

        <form onSubmit={create} style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'flex-end', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-subtle)' }}>
          <div className="form-group" style={{ margin: 0, flex: '1 1 200px' }}>
            <label className="form-label" htmlFor="new-role-name">New role</label>
            <input id="new-role-name" className="form-input" placeholder="e.g. Kit Manager" maxLength={64} value={newName} onChange={e => setNewName(e.target.value.replace(/,/g, ''))} />
          </div>
          <div className="form-group" style={{ margin: 0, flex: '1 1 200px' }}>
            <label className="form-label" htmlFor="new-role-copy">Start from</label>
            <select id="new-role-copy" className="form-input" value={copyFrom} onChange={e => setCopyFrom(e.target.value)}>
              <option value="">No access</option>
              {roles.filter(r => !r.is_super).map(r => <option key={r.id} value={r.id}>Copy of {r.name}</option>)}
            </select>
          </div>
          <button type="submit" className="btn btn-primary" disabled={!newName.trim()}>
            <Plus size={16} /> <span>Add role</span>
          </button>
        </form>
      </div>

      {/* Role editor */}
      {selected && draft && (
        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div className="form-group" style={{ margin: 0, flex: '1 1 220px' }}>
              <label className="form-label" htmlFor="role-name">Role name</label>
              <input
                id="role-name"
                className="form-input"
                maxLength={64}
                value={draft.name}
                disabled={selected.is_super}
                onChange={e => setDraft({ ...draft, name: e.target.value.replace(/,/g, '') })}
              />
            </div>
            <div className="form-group" style={{ margin: 0, flex: '2 1 320px' }}>
              <label className="form-label" htmlFor="role-desc">Description</label>
              <input id="role-desc" className="form-input" value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} />
            </div>
          </div>

          <div className="text-meta" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', margin: '0.9rem 0' }}>
            <Users size={14} />
            {holders[selected.id]?.length
              ? <span>Held by {holders[selected.id].join(', ')}</span>
              : <span>Nobody holds this role yet.</span>}
          </div>

          {selected.is_super ? (
            <div style={{ padding: '1rem', borderRadius: 'var(--radius-md)', background: 'rgba(var(--tint-rgb), 0.04)', border: '1px solid var(--border-subtle)', fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              <strong>Club Admin is the super user role.</strong> It has full access to every area, can manage these roles and
              decides who holds them. It can&apos;t be renamed, restricted or deleted. The club Owner always has the same access.
            </div>
          ) : (
            <>
              <p className="text-meta" style={{ marginBottom: '0.5rem' }}>
                {ACCESS_LEVELS.map(l => `${l.label}: ${l.desc.toLowerCase()}`).join(' · ')}
              </p>
              <div className="admin-table-container">
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <tbody>
                    {groups.map(group => (
                      <React.Fragment key={group}>
                        <tr>
                          <th colSpan={2} style={{ ...cell, color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase', paddingTop: '1rem' }}>{group}</th>
                        </tr>
                        {ACCESS_AREAS.filter(a => a.group === group).map(a => (
                          <tr key={a.key}>
                            <td style={cell}><label htmlFor={`perm-${a.key}`}>{a.label}</label></td>
                            <td style={{ ...cell, width: '170px' }}>
                              <select
                                id={`perm-${a.key}`}
                                className="form-input"
                                style={{ padding: '0.35rem 0.5rem' }}
                                value={draft.permissions[a.key] || ''}
                                onChange={e => setLevel(a.key, e.target.value)}
                              >
                                <option value="">No access</option>
                                {ACCESS_LEVELS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                              </select>
                            </td>
                          </tr>
                        ))}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '0.5rem', marginTop: '1rem' }}>
            {!selected.is_super ? (
              <button type="button" className="btn btn-secondary" onClick={remove}>
                <Trash2 size={16} /> <span>Delete role</span>
              </button>
            ) : <span />}
            <button type="button" className="btn btn-primary" onClick={save} disabled={!dirty || saving}>
              <Save size={16} /> <span>{saving ? 'Saving...' : 'Save changes'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
