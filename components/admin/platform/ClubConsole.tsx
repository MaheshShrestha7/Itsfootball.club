'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { getSupabaseClient } from '@/lib/supabase/client';
import { memberLabels } from '@/lib/permissions';
import { setupSteps, timeAgo } from '@/lib/mission-control';
import type { PlatformAuditRow, PlatformClubItem, PlatformClubNote, PlatformClubPerson } from '@/lib/supabase/types';
import type { EmailDraft } from '@/components/admin/platform/EmailComposer';
import { confirmAction, notify } from '@/components/ConfirmDialog';
import { Check, Circle, Mail, Users, ClipboardList, History, StickyNote } from 'lucide-react';

interface Props {
  club: PlatformClubItem;
  onEmail: (d: EmailDraft) => void;
  showToast: (msg: string) => void;
  /** The club list needs reloading (owner changed) */
  onChanged: () => void;
}

const head: React.CSSProperties = { fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' };
const row: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.85rem', color: 'var(--text-primary)' };
const small: React.CSSProperties = { fontSize: '0.75rem', color: 'var(--text-muted)' };

/** The working parts of the club drawer: setup, who runs it, emails, notes and history. */
export default function ClubConsole({ club, onEmail, showToast, onChanged }: Props) {
  const [people, setPeople] = useState<PlatformClubPerson[]>([]);
  const [notes, setNotes] = useState<PlatformClubNote[]>([]);
  const [history, setHistory] = useState<PlatformAuditRow[]>([]);
  const [noteText, setNoteText] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState('');

  const load = useCallback(async () => {
    const client = getSupabaseClient();
    if (!client) return;
    const [p, n, h] = await Promise.all([
      client.rpc('get_platform_club_people', { p_club_id: club.id }),
      client.from('platform_club_notes').select('id, club_id, kind, body, author_email, created_at').eq('club_id', club.id).order('created_at', { ascending: false }).limit(30),
      client.rpc('get_platform_audit', { p_club_id: club.id, p_limit: 12 }),
    ]);
    setLoadError(p.error ? 'Run migration 20261145_mission_control_phase1.sql to manage people, notes and history here.' : '');
    setPeople((p.data || []) as PlatformClubPerson[]);
    setNotes((n.data || []) as PlatformClubNote[]);
    setHistory((h.data || []) as PlatformAuditRow[]);
  }, [club.id]);

  useEffect(() => { load(); }, [load]);

  /** Runs an RPC; on success shows `ok`, reloads, and returns true */
  const run = async (fn: string, args: Record<string, unknown>, ok: string) => {
    const client = getSupabaseClient();
    if (!client) return false;
    setBusy(true);
    try {
      const { error } = await client.rpc(fn, args);
      if (error) { notify('That didn\'t work', error.message); return false; }
      showToast(ok);
      await load();
      return true;
    } finally {
      setBusy(false);
    }
  };

  const makeOwner = async (p: PlatformClubPerson) => {
    const current = people.find(x => x.is_owner);
    if (!(await confirmAction({
      title: `Make ${p.name} the Owner?`,
      message: `${p.name} becomes the Owner of ${club.name}.${current ? ` ${current.name} stays on as an admin until you remove them.` : ''} Tell both of them by email afterwards.`,
      confirmLabel: 'Transfer ownership',
    }))) return;
    if (await run('platform_transfer_club_owner', { p_club_id: club.id, p_user_id: p.user_id }, `✓ ${p.name} now owns ${club.name}`)) onChanged();
  };

  const removeAdmin = async (p: PlatformClubPerson) => {
    if (!p.email) return;
    if (!(await confirmAction({ title: `Remove ${p.name} as admin?`, message: 'They stay a member of the club but lose the Club Admin role.', confirmLabel: 'Remove admin', danger: true }))) return;
    await run('platform_set_club_admin', { p_club_id: club.id, p_email: p.email, p_on: false }, `✓ ${p.name} is no longer an admin`);
  };

  const addAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (await run('platform_set_club_admin', { p_club_id: club.id, p_email: adminEmail.trim(), p_on: true }, `✓ ${adminEmail.trim()} is now a Club Admin`)) setAdminEmail('');
  };

  const addNote = async (e: React.FormEvent) => {
    e.preventDefault();
    const client = getSupabaseClient();
    const body = noteText.trim();
    if (!client || !body) return;
    setBusy(true);
    const { data: auth } = await client.auth.getUser();
    const { error } = await client.from('platform_club_notes').insert({ club_id: club.id, body, author_id: auth.user?.id, author_email: auth.user?.email || null });
    setBusy(false);
    if (error) { notify('Could not save the note', error.message); return; }
    setNoteText('');
    load();
  };

  const steps = setupSteps(club);
  const done = steps.filter(s => s.done).length;

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => onEmail({ club, to: 'owner', template: 'blank' })}><Mail size={14} /> Email owner</button>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => onEmail({ club, to: 'admins', template: 'blank' })}><Users size={14} /> Email all admins</button>
      </div>

      {loadError && <p role="alert" style={{ margin: 0, fontSize: '0.8rem', color: 'var(--c-amber)' }}>{loadError}</p>}

      <section className="glass-panel" style={{ padding: '1.25rem' }}>
        <h3 style={head}><ClipboardList size={14} color="var(--c-green)" /> Setup · {done} of {steps.length}</h3>
        <div style={{ height: 6, borderRadius: 3, background: 'rgba(var(--tint-rgb), 0.08)', marginBottom: '0.85rem' }}>
          <div style={{ width: `${Math.round((done / steps.length) * 100)}%`, height: 6, borderRadius: 3, background: 'var(--c-green)' }} />
        </div>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
          {steps.map(s => (
            <li key={s.key} style={{ ...row, color: s.done ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
              {s.done ? <Check size={14} color="var(--c-green)" aria-label="Done" /> : <Circle size={14} color="var(--text-muted)" aria-label="Not done" />}
              {s.label}
            </li>
          ))}
        </ul>
        {done < steps.length && (
          <button type="button" className="btn btn-secondary btn-sm" style={{ marginTop: '0.85rem' }} onClick={() => onEmail({ club, to: 'owner', template: 'needHand' })}>
            Send a setup nudge
          </button>
        )}
      </section>

      <section className="glass-panel" style={{ padding: '1.25rem' }}>
        <h3 style={head}><Users size={14} color="var(--c-blue)" /> Who runs it</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
          {people.length === 0 && !loadError && <p style={small}>No Owner or admins found.</p>}
          {people.map(p => {
            const labels = p.is_owner ? ['Owner'] : memberLabels(p.role, p.roles);
            return (
              <div key={`${p.member_id}-${p.user_id}`} style={{ ...row, alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div style={{ minWidth: 0 }}>
                  <b>{p.name}</b> <span style={small}>{labels.join(', ')}</span>
                  <div style={small}>{p.email || 'no email'} · {p.last_sign_in_at ? `signed in ${timeAgo(p.last_sign_in_at)}` : 'never signed in'}</div>
                </div>
                <div style={{ display: 'flex', gap: '0.35rem', flexShrink: 0 }}>
                  {!p.is_owner && p.member_id && (
                    <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => makeOwner(p)}>Make owner</button>
                  )}
                  {!p.is_owner && p.is_admin && (
                    <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => removeAdmin(p)} style={{ color: 'var(--c-red)' }}>Remove admin</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <form onSubmit={addAdmin} style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
          <label htmlFor="mc-add-admin" className="sr-only">Email of a club member to make Club Admin</label>
          <input id="mc-add-admin" type="email" required className="form-input" placeholder="Member's email, to make them Club Admin" value={adminEmail} onChange={e => setAdminEmail(e.target.value)} style={{ flex: 1, minWidth: 0 }} />
          <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>Add admin</button>
        </form>
      </section>

      <section className="glass-panel" style={{ padding: '1.25rem' }}>
        <h3 style={head}><StickyNote size={14} color="var(--c-amber)" /> Notes and emails</h3>
        <form onSubmit={addNote} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <label htmlFor="mc-note" className="sr-only">Private note</label>
          <textarea id="mc-note" className="form-input" rows={2} maxLength={4000} placeholder="Private note, only platform admins see it" value={noteText} onChange={e => setNoteText(e.target.value)} style={{ resize: 'vertical' }} />
          <button type="submit" className="btn btn-secondary btn-sm" disabled={busy || !noteText.trim()} style={{ alignSelf: 'flex-end' }}>Save note</button>
        </form>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.75rem' }}>
          {notes.map(n => {
            const [first, ...rest] = n.body.split('\n');
            return (
              <details key={n.id} style={{ fontSize: '0.83rem', color: 'var(--text-primary)' }}>
                <summary style={{ cursor: 'pointer' }}>
                  <span className="badge" style={{ fontSize: '0.65rem', marginRight: 6 }}>{n.kind === 'email' ? 'Email' : 'Note'}</span>
                  {first}
                  <span style={{ ...small, marginLeft: 6 }}>{timeAgo(n.created_at)}</span>
                </summary>
                {rest.length > 0 && <p style={{ ...small, whiteSpace: 'pre-wrap', margin: '0.4rem 0 0' }}>{rest.join('\n').trim()}</p>}
              </details>
            );
          })}
        </div>
      </section>

      {history.length > 0 && (
        <section className="glass-panel" style={{ padding: '1.25rem' }}>
          <h3 style={head}><History size={14} color="#818CF8" /> Recent admin changes</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {history.map(h => (
              <div key={h.id} style={{ fontSize: '0.83rem', color: 'var(--text-primary)' }}>
                {h.summary}
                <div style={small}>{h.actor_email || 'system'} · {timeAgo(h.created_at)}</div>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
