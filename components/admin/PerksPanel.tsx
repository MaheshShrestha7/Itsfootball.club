'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Eye, EyeOff, Gift, Pencil, Plus, Trash2 } from 'lucide-react';
import { getSupabaseClient } from '@/lib/supabase/client';
import { perkBusiness, perkHiddenReason } from '@/lib/perks';
import { formatEndDate, localDateISO, sponsorHref } from '@/lib/sponsors';
import { confirmAction } from '@/components/ConfirmDialog';
import type { ClubPerk, Sponsor } from '@/lib/supabase/types';

type Db = ReturnType<typeof getSupabaseClient>;

/** Add or edit one perk, in a modal dialog. Nothing is saved until Save. */
function PerkDialog({ perk, clubId, clubName, db, nextOrder, sponsors, onClose, onSaved }: {
  /** null: a new perk */
  perk: ClubPerk | null;
  clubId: string; clubName: string; db: Db; nextOrder: number; sponsors: Sponsor[];
  onClose: () => void; onSaved: (text: string) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [row, setRow] = useState<ClubPerk>(() => perk ?? {
    id: '', club_id: clubId, sponsor_id: null, title: '', details: '', business_name: '', url: '', ends_on: null, is_active: true, sort_order: nextOrder, code: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [initial] = useState(() => JSON.stringify(row));
  const dirty = JSON.stringify(row) !== initial;
  const set = (patch: Partial<ClubPerk>) => setRow(r => ({ ...r, ...patch }));

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  const tryClose = async () => {
    if (dirty && !(await confirmAction({ title: 'Discard your changes?', message: 'What you typed in this perk will be lost.', confirmLabel: 'Discard', cancelLabel: 'Keep editing', danger: true }))) return;
    ref.current?.close();
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = row.title.trim();
    const url = row.url?.trim() || '';
    if (!title) return setError('Give the perk a title, e.g. 10% off any pizza.');
    if (url && !sponsorHref(url)) return setError('Enter the link as a full web address, starting with https://');
    setBusy(true);
    setError(null);
    const values = {
      title, details: row.details?.trim() || null, url: url || null, ends_on: row.ends_on || null, is_active: row.is_active !== false,
      sponsor_id: row.sponsor_id || null,
      // The sponsor's own name shows when there is one
      business_name: row.sponsor_id ? null : row.business_name?.trim() || null,
    };
    const { data, error } = perk
      ? await db!.from('club_perks').update(values).eq('id', perk.id).select('id').single()
      : await db!.from('club_perks').insert({ ...values, club_id: clubId, sort_order: nextOrder }).select('id').single();
    if (error || !data) { setBusy(false); return setError(error?.message || 'Could not save the perk.'); }
    // The code lives in its own table (never public): blank removes it
    const code = row.code?.trim() || '';
    const { error: codeError } = code
      ? await db!.from('club_perk_codes').upsert({ perk_id: data.id, club_id: clubId, code })
      : await db!.from('club_perk_codes').delete().eq('perk_id', data.id);
    setBusy(false);
    if (codeError) return setError(`The perk is saved, but not its code: ${codeError.message}`);
    ref.current?.close();
    onSaved(`${title} ${perk ? 'saved' : 'added'}.`);
  };

  const remove = async () => {
    if (!perk || !(await confirmAction({ title: `Delete ${perk.title}?`, message: 'Members stop seeing it straight away. Use Hide to take it down for now.', confirmLabel: 'Delete', danger: true }))) return;
    const { error } = await db!.from('club_perks').delete().eq('id', perk.id);
    if (error) return setError(error.message);
    ref.current?.close();
    onSaved(`${perk.title} deleted.`);
  };

  return (
    <dialog ref={ref} className="form-dialog glass-panel" aria-labelledby="perk-dialog-title"
      onCancel={e => { e.preventDefault(); tryClose(); }} onClose={onClose}>
      <form onSubmit={save} noValidate>
        <h2 id="perk-dialog-title" className="confirm-dialog-title" style={{ marginTop: 0 }}>{perk ? `Edit ${perk.title}` : 'Add a member perk'}</h2>

        <div className="form-dialog-grid">
          <div className="form-group" style={{ gridColumn: '1 / -1', margin: 0 }}>
            <label className="form-label" htmlFor="perk-title">What members get</label>
            <input id="perk-title" className="form-input" required autoFocus maxLength={120} placeholder="10% off any pizza" value={row.title} onChange={e => set({ title: e.target.value })} />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" htmlFor="perk-sponsor">From</label>
            <select id="perk-sponsor" className="form-select" value={row.sponsor_id || ''} onChange={e => set({ sponsor_id: e.target.value || null })}>
              <option value="">Another business, or the club</option>
              {sponsors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          {!row.sponsor_id && (
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" htmlFor="perk-business">Business name</label>
              <input id="perk-business" className="form-input" maxLength={120} placeholder={clubName} value={row.business_name || ''} onChange={e => set({ business_name: e.target.value })} />
            </div>
          )}
          <div className="form-group" style={{ gridColumn: '1 / -1', margin: 0 }}>
            <label className="form-label" htmlFor="perk-details">How to claim it</label>
            <textarea id="perk-details" className="form-textarea" rows={2} placeholder="Show your member pass at the counter. Dine-in only."
              value={row.details || ''} onChange={e => set({ details: e.target.value })} />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" htmlFor="perk-code">Discount code</label>
            <input id="perk-code" className="form-input" maxLength={60} placeholder="None: they show their pass" aria-describedby="perk-code-hint"
              value={row.code || ''} onChange={e => set({ code: e.target.value })} style={{ fontFamily: 'var(--font-mono)' }} />
            <p id="perk-code-hint" className="text-meta" style={{ margin: '0.3rem 0 0' }}>Only signed-in members with an active membership see it.</p>
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" htmlFor="perk-ends">Last day</label>
            <input id="perk-ends" type="date" className="form-input" value={row.ends_on || ''} onChange={e => set({ ends_on: e.target.value || null })} />
          </div>
          <div className="form-group" style={{ gridColumn: '1 / -1', margin: 0 }}>
            <label className="form-label" htmlFor="perk-url">Link (optional)</label>
            <input id="perk-url" type="url" className="form-input" inputMode="url" placeholder="https://joespizza.com.au/order" value={row.url || ''} onChange={e => set({ url: e.target.value })} />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.88rem', fontWeight: 600, minHeight: 44 }}>
            <input type="checkbox" checked={row.is_active !== false} style={{ width: 18, height: 18 }} onChange={e => set({ is_active: e.target.checked })} />
            Show to members
          </label>
        </div>

        {error && <p role="alert" className="admin-flash is-error" style={{ margin: '1rem 0 0' }}>{error}</p>}

        <div className="confirm-dialog-actions">
          {perk && (
            <button data-needs-full type="button" className="btn btn-danger" style={{ marginRight: 'auto' }} onClick={remove}>
              <Trash2 size={15} /> Delete
            </button>
          )}
          <button type="button" className="btn btn-secondary" onClick={tryClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : perk ? 'Save' : 'Add perk'}</button>
        </div>
      </form>
    </dialog>
  );
}

/** Member perks (migration 20261141): offers members see in their Perks tab and businesses see when
 *  they check a pass. On the Sponsors page because most come from sponsors */
export default function PerksPanel({ club, sponsors }: { club: { id: string; slug: string; name: string }; sponsors: Sponsor[] }) {
  const db = getSupabaseClient();
  const [perks, setPerks] = useState<ClubPerk[]>([]);
  // null until loaded; false when the migration hasn't run
  const [ready, setReady] = useState<boolean | null>(null);
  // Mark as used taps in the last 12 months, per perk (perk_use_counts, migration 20261142)
  const [uses, setUses] = useState<Map<string, number>>(() => new Map());
  const [editing, setEditing] = useState<ClubPerk | 'new' | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);
  const flash = (type: 'ok' | 'error', text: string) => {
    setFeedback({ type, text });
    setTimeout(() => setFeedback(null), 4000);
  };
  const clubWide = sponsors.filter(s => s.club_id === club.id && !s.event_id);

  const load = useCallback(async () => {
    if (!db) return;
    const [{ data, error }, { data: codes }, { data: counts }] = await Promise.all([
      db.from('club_perks').select('*').eq('club_id', club.id).order('sort_order'),
      db.from('club_perk_codes').select('perk_id, code').eq('club_id', club.id),
      db.rpc('perk_use_counts', { p_club_id: club.id, p_since: localDateISO(Date.now() - 365 * 24 * 3600 * 1000) }),
    ]);
    if (error) return setReady(false);
    const byPerk = new Map(((codes || []) as { perk_id: string; code: string }[]).map(c => [c.perk_id, c.code]));
    setPerks(((data || []) as ClubPerk[]).map(p => ({ ...p, code: byPerk.get(p.id) ?? '' })));
    setUses(new Map(((counts || []) as { perk_id: string; uses: number }[]).map(c => [c.perk_id, Number(c.uses)])));
    setReady(true);
  }, [db, club.id]);
  useEffect(() => { load(); }, [load]);

  const toggleShown = async (p: ClubPerk) => {
    const { error } = await db!.from('club_perks').update({ is_active: !p.is_active }).eq('id', p.id);
    if (error) return flash('error', error.message);
    flash('ok', p.is_active ? `${p.title} is hidden from members.` : `${p.title} is showing to members.`);
    load();
  };

  const businessOf = (p: ClubPerk) => perkBusiness({ business_name: clubWide.find(s => s.id === p.sponsor_id)?.name ?? p.business_name }, club.name);

  if (ready === false) {
    return (
      <div className="admin-panel admin-empty">
        <p style={{ margin: 0 }}>Member perks need the database update <code>20261141_member_perks.sql</code>. Run it in Supabase, then reload this page.</p>
      </div>
    );
  }

  return (
    <div className="admin-stack">
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-sm)' }}>
        <p className="text-note" style={{ margin: 0, minWidth: 0, flex: '1 1 320px', maxWidth: '72ch' }}>
          Members see these in the Perks tab of <a href={`/${club.slug}/member`} style={{ color: 'var(--color-accent-ink)', overflowWrap: 'anywhere' }}>/{club.slug}/member</a>. A business that scans a pass sees them too, without the codes.
        </p>
        {perks.length > 0 && <button type="button" className="btn btn-primary" onClick={() => setEditing('new')}><Plus size={16} aria-hidden="true" /> Add perk</button>}
      </div>

      {feedback && (
        <p role="status" className={feedback.type === 'ok' ? 'admin-flash' : 'admin-flash is-error'} style={{ margin: 0 }}>{feedback.text}</p>
      )}

      {ready && perks.length === 0 && (
        <div className="admin-panel admin-empty" style={{ alignItems: 'center', textAlign: 'center', padding: 'var(--space-xl) var(--space-md)' }}>
          <Gift size={24} aria-hidden="true" style={{ color: 'var(--text-muted)' }} />
          <p style={{ margin: 0, maxWidth: '52ch' }}>No perks yet. Ask a sponsor for a member discount: it gives members a reason to join and sends customers to the sponsor.</p>
          <button type="button" className="btn btn-primary" onClick={() => setEditing('new')}><Plus size={16} aria-hidden="true" /> Add your first perk</button>
        </div>
      )}

      {perks.length > 0 && (
        <ul style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))', gap: 'var(--space-md)', margin: 0, padding: 0 }}>
          {perks.map(p => {
            const hidden = perkHiddenReason(p, clubWide);
            return (
              <li key={p.id} className="admin-panel" style={{ listStyle: 'none', padding: 'var(--space-md)', display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                <div className="min-w-0">
                  <div className="text-meta" style={{ fontWeight: 500, overflowWrap: 'anywhere' }}>{businessOf(p)}</div>
                  <h3 style={{ margin: 'var(--space-3xs) 0 0', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 'var(--text-md)', letterSpacing: 0, color: 'var(--text-primary)', overflowWrap: 'anywhere' }}>{p.title}</h3>
                </div>
                <div><span className={hidden ? 'admin-pill is-warn' : 'admin-pill is-ok'} style={{ whiteSpace: 'normal' }}>{hidden || 'Showing to members'}</span></div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2xs) var(--space-sm)', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                  {p.code && <span>Code: <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{p.code}</code></span>}
                  {p.ends_on && <span>Until {formatEndDate(p.ends_on)}</span>}
                  <span>Used {uses.get(p.id) || 0} {uses.get(p.id) === 1 ? 'time' : 'times'} in the last 12 months</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end', gap: 'var(--space-xs)', marginTop: 'auto', paddingTop: 'var(--space-sm)', borderTop: '1px solid var(--color-rule)' }}>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => toggleShown(p)}>
                    {p.is_active ? <><EyeOff size={14} /> Hide</> : <><Eye size={14} /> Show</>}
                  </button>
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => setEditing(p)} aria-label={`Edit ${p.title}`}>
                    <Pencil size={14} /> Edit
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {editing && (
        <PerkDialog
          key={editing === 'new' ? 'new' : editing.id}
          perk={editing === 'new' ? null : editing}
          clubId={club.id} clubName={club.name} db={db} nextOrder={perks.length} sponsors={clubWide}
          onClose={() => setEditing(null)}
          onSaved={text => { flash('ok', text); load(); }}
        />
      )}
    </div>
  );
}
