'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Eye, EyeOff, Package, Pencil, Plus, Trash2 } from 'lucide-react';
import { getSupabaseClient } from '@/lib/supabase/client';
import { formatMoney, parseMoneyToCents } from '@/lib/finance';
import { PACKAGE_INCLUDES, buildPackageIncludes, packageIncludes, sponsorTierLabel } from '@/lib/sponsors';
import { confirmAction } from '@/components/ConfirmDialog';
import type { SponsorshipPackage, SponsorTier } from '@/lib/supabase/types';

const TIERS: SponsorTier[] = ['platinum', 'gold', 'silver', 'bronze', 'grassroots'];

type Db = ReturnType<typeof getSupabaseClient>;
type SetRow = (patch: Partial<SponsorshipPackage>) => void;

/** "What's included" (SP-F6): ticks for the fixed places and a box for the club's own extras, one per line */
function IncludesEditor({ row, set }: { row: SponsorshipPackage; set: SetRow }) {
  const { places, extras } = packageIncludes(row.includes);
  // The box keeps exactly what's typed (a half-typed blank line included); the list saved is tidied
  const [text, setText] = useState(extras.join('\n'));
  return (
    <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
      <legend className="form-label">What&apos;s included</legend>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 190px), 1fr))', gap: '0.35rem 1rem' }}>
        {PACKAGE_INCLUDES.map(i => (
          <label key={i.key} style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.85rem', color: 'var(--text-secondary)', minHeight: 32, cursor: 'pointer' }}>
            <input type="checkbox" checked={places.includes(i.key)} style={{ width: 17, height: 17 }}
              onChange={e => set({ includes: buildPackageIncludes(e.target.checked ? [...places, i.key] : places.filter(k => k !== i.key), text) })} />
            {i.admin}
          </label>
        ))}
      </div>
      <label className="form-label" htmlFor="pkg-extras" style={{ marginTop: '0.6rem' }}>Extras (one per line)</label>
      <textarea id="pkg-extras" className="form-textarea" rows={2} placeholder={'Matchday banner at the ground\nLogo on the training kit'} value={text}
        onChange={e => { setText(e.target.value); set({ includes: buildPackageIncludes(places, e.target.value) }); }} />
      <p className="text-meta" style={{ margin: '0.3rem 0 0' }}>
        The ticks show on your public package. Where a logo actually appears still follows the sponsor&apos;s tier and Logo size.
      </p>
    </fieldset>
  );
}

/** Add or edit one package, in a modal dialog. Nothing is saved until Save. */
function PackageDialog({ pkg, clubId, db, nextOrder, includesReady, limitsReady, taken, onClose, onSaved }: {
  /** null: a new package */
  pkg: SponsorshipPackage | null;
  clubId: string; db: Db; nextOrder: number; includesReady: boolean; limitsReady: boolean; taken: number;
  onClose: () => void; onSaved: (text: string) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [row, setRow] = useState<SponsorshipPackage>(() => pkg ?? {
    id: '', club_id: clubId, name: '', tier: 'gold', price_cents: 0, benefits: '', includes: [], max_sponsors: null, is_active: true, sort_order: nextOrder,
  });
  const [price, setPrice] = useState(pkg && pkg.price_cents > 0 ? (pkg.price_cents / 100).toFixed(2) : '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [initial] = useState(() => JSON.stringify([row, price]));
  const dirty = JSON.stringify([row, price]) !== initial;
  const set: SetRow = patch => setRow(r => ({ ...r, ...patch }));

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  // Esc and Cancel ask before throwing away what was typed
  const tryClose = async () => {
    if (dirty && !(await confirmAction({ title: 'Discard your changes?', message: 'What you typed in this package will be lost.', confirmLabel: 'Discard', cancelLabel: 'Keep editing', danger: true }))) return;
    ref.current?.close();
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = row.name.trim();
    // Blank or 0 is "Price on request"
    const cents = price.trim() === '' ? 0 : parseMoneyToCents(price);
    if (!name) return setError('Give the package a name.');
    if (cents === null) return setError('Enter a valid price, e.g. 500 or 499.99. Leave it blank for "Price on request".');
    setBusy(true);
    setError(null);
    const values: Record<string, unknown> = {
      name, tier: row.tier, price_cents: cents, benefits: row.benefits?.trim() || null, is_active: row.is_active,
      // Columns from later migrations are only sent once they exist, so saves keep working before them
      ...(includesReady ? { includes: row.includes || [] } : {}),
      ...(limitsReady ? { max_sponsors: row.max_sponsors ?? null } : {}),
    };
    const { error } = pkg
      ? await db!.from('sponsorship_packages').update(values).eq('id', pkg.id)
      : await db!.from('sponsorship_packages').insert({ ...values, club_id: clubId, sort_order: nextOrder });
    setBusy(false);
    if (error) return setError(error.message);
    ref.current?.close();
    onSaved(`${name} ${pkg ? 'saved' : 'added'}.`);
  };

  const remove = async () => {
    if (!pkg || !(await confirmAction({ title: `Delete ${pkg.name}?`, message: 'Past payments keep their amounts. Use Hide instead to just take it off your page.', confirmLabel: 'Delete', danger: true }))) return;
    const { error } = await db!.from('sponsorship_packages').delete().eq('id', pkg.id);
    if (error) return setError(error.message);
    ref.current?.close();
    onSaved(`${pkg.name} deleted.`);
  };

  return (
    <dialog ref={ref} className="form-dialog glass-panel" aria-labelledby="pkg-dialog-title"
      onCancel={e => { e.preventDefault(); tryClose(); }} onClose={onClose}>
      <form onSubmit={save} noValidate>
        <h2 id="pkg-dialog-title" className="confirm-dialog-title" style={{ marginTop: 0 }}>{pkg ? `Edit ${pkg.name}` : 'Add a sponsorship package'}</h2>

        <div className="form-dialog-grid">
          <div className="form-group" style={{ gridColumn: '1 / -1', margin: 0 }}>
            <label className="form-label" htmlFor="pkg-name">Name</label>
            <input id="pkg-name" className="form-input" required autoFocus maxLength={120} placeholder="Front of shirt" value={row.name} onChange={e => set({ name: e.target.value })} />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" htmlFor="pkg-price">Price</label>
            <input id="pkg-price" className="form-input" inputMode="decimal" placeholder="Price on request" aria-describedby="pkg-price-hint" value={price} onChange={e => setPrice(e.target.value)} />
            <p id="pkg-price-hint" className="text-meta" style={{ margin: '0.3rem 0 0' }}>Blank shows &ldquo;Price on request&rdquo;: no payment, their message comes to your Inbox.</p>
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" htmlFor="pkg-tier">Tier</label>
            <select id="pkg-tier" className="form-select" value={row.tier} onChange={e => set({ tier: e.target.value as SponsorTier })}>
              {TIERS.map(t => <option key={t} value={t}>{sponsorTierLabel(t)}</option>)}
            </select>
          </div>
          {limitsReady && (
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" htmlFor="pkg-limit">How many can you sell?</label>
              <input id="pkg-limit" type="number" min={1} max={999} step={1} inputMode="numeric" className="form-input" placeholder="No limit" aria-describedby="pkg-limit-hint"
                value={row.max_sponsors ?? ''}
                onChange={e => set({ max_sponsors: e.target.value === '' ? null : Math.min(999, Math.max(1, Math.round(Number(e.target.value)) || 1)) })} />
              <p id="pkg-limit-hint" className="text-meta" style={{ margin: '0.3rem 0 0' }}>
                {pkg ? `${taken} taken now. ` : ''}Blank means no limit. A website sign-up holds one for 48 hours while they pay, or while their invoice is open.
              </p>
            </div>
          )}
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.88rem', fontWeight: 600, alignSelf: 'start', minHeight: 44 }}>
            <input type="checkbox" checked={row.is_active} style={{ width: 18, height: 18 }} onChange={e => set({ is_active: e.target.checked })} />
            Show on your sponsor page
          </label>
          <div className="form-group" style={{ gridColumn: '1 / -1', margin: 0 }}>
            <label className="form-label" htmlFor="pkg-benefits">Benefits</label>
            <textarea id="pkg-benefits" className="form-textarea" rows={3} placeholder="Logo on the front of the senior shirt, two season passes…"
              value={row.benefits || ''} onChange={e => set({ benefits: e.target.value })} />
          </div>
          {includesReady && <div style={{ gridColumn: '1 / -1' }}><IncludesEditor row={row} set={set} /></div>}
        </div>

        {error && <p role="alert" style={{ margin: '1rem 0 0', color: 'var(--c-red)', fontSize: '0.85rem', fontWeight: 700 }}>{error}</p>}

        <div className="confirm-dialog-actions">
          {pkg && (
            <button data-needs-full type="button" className="btn btn-danger" style={{ marginRight: 'auto' }} onClick={remove}>
              <Trash2 size={15} /> Delete
            </button>
          )}
          <button type="button" className="btn btn-secondary" onClick={tryClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : pkg ? 'Save' : 'Add package'}</button>
        </div>
      </form>
    </dialog>
  );
}

/** The club's sponsorship packages (what /{club}/sponsor offers), on the Sponsors page so whoever
 *  looks after sponsors can set them up without Finance access */
export default function SponsorPackagesPanel({ club }: { club: { id: string; slug: string } }) {
  const db = getSupabaseClient();
  const [packages, setPackages] = useState<SponsorshipPackage[]>([]);
  const [loaded, setLoaded] = useState(false);
  // 'new', a package being edited, or nothing (the dialog is closed)
  const [editing, setEditing] = useState<SponsorshipPackage | 'new' | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);
  const flash = (type: 'ok' | 'error', text: string) => {
    setFeedback({ type, text });
    setTimeout(() => setFeedback(null), 4000);
  };

  const load = useCallback(async () => {
    if (!db) return;
    const { data } = await db.from('sponsorship_packages').select('*').eq('club_id', club.id).order('sort_order');
    setPackages((data || []) as SponsorshipPackage[]);
    setLoaded(true);
  }, [db, club.id]);
  useEffect(() => { load(); }, [load]);
  const [currency, setCurrency] = useState('AUD');
  useEffect(() => {
    db?.from('club_payment_settings').select('currency').eq('club_id', club.id).maybeSingle().then(({ data }) => data?.currency && setCurrency(data.currency));
  }, [db, club.id]);
  // The ticks need migration 20261134_sponsor_package_includes.sql; hidden until it runs so saves keep working
  const [includesReady, setIncludesReady] = useState(false);
  useEffect(() => {
    db?.from('sponsorship_packages').select('includes').limit(1).then(({ error }) => setIncludesReady(!error));
  }, [db]);
  // SPP-4: "How many can we sell?" needs migration 20261137; hidden until it runs
  const [limitsReady, setLimitsReady] = useState(false);
  const [taken, setTaken] = useState<Map<string, number>>(() => new Map());
  useEffect(() => {
    db?.from('sponsorship_packages').select('max_sponsors').limit(1).then(({ error }) => setLimitsReady(!error));
    db?.rpc('sponsor_package_spots', { p_club_id: club.id })
      .then(({ data }) => setTaken(new Map(((data || []) as { package_id: string; taken: number }[]).map(r => [r.package_id, r.taken]))));
  }, [db, club.id, packages]);

  const toggleShown = async (p: SponsorshipPackage) => {
    const { error } = await db!.from('sponsorship_packages').update({ is_active: !p.is_active }).eq('id', p.id);
    if (error) return flash('error', error.message);
    flash('ok', p.is_active ? `${p.name} is hidden from your page.` : `${p.name} is on your page.`);
    load();
  };

  const card = (p: SponsorshipPackage) => {
    const { places, extras } = packageIncludes(p.includes);
    const shown = PACKAGE_INCLUDES.filter(i => places.includes(i.key)).map(i => i.admin);
    const n = taken.get(p.id) || 0;
    const limit = limitsReady && p.max_sponsors ? p.max_sponsors : null;
    const soldOut = limit !== null && n >= limit;
    const firstBenefit = p.benefits?.split('\n').find(l => l.trim());
    return (
      <li key={p.id} className="glass-panel" style={{ listStyle: 'none', padding: '1rem 1.1rem', display: 'flex', flexDirection: 'column', gap: '0.6rem', opacity: p.is_active ? 1 : 0.8 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem' }}>
          <div className="min-w-0">
            <span className="badge badge-primary" style={{ fontSize: '0.68rem' }}>{sponsorTierLabel(p.tier)}</span>
            <h4 style={{ margin: '0.35rem 0 0', fontWeight: 800, fontSize: '1rem', color: 'var(--text-primary)', overflowWrap: 'anywhere' }}>{p.name}</h4>
          </div>
          <strong style={{ fontSize: '1.05rem', whiteSpace: 'nowrap', color: p.price_cents > 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}>
            {p.price_cents > 0 ? formatMoney(p.price_cents, currency) : 'Price on request'}
          </strong>
        </div>
        {firstBenefit && <p className="text-meta" style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{firstBenefit}</p>}
        {(shown.length > 0 || extras.length > 0) && (
          <ul style={{ margin: 0, padding: 0, display: 'flex', flexWrap: 'wrap', gap: '0.3rem 0.75rem', fontSize: '0.78rem', color: 'var(--text-secondary)' }} aria-label="What's included">
            {shown.map(s => <li key={s} style={{ listStyle: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}><Check size={12} aria-hidden="true" /> {s}</li>)}
            {extras.length > 0 && <li style={{ listStyle: 'none' }}>+{extras.length} {extras.length === 1 ? 'extra' : 'extras'}</li>}
          </ul>
        )}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem', marginTop: 'auto', paddingTop: '0.25rem' }}>
          <span className="text-meta" style={{ marginRight: 'auto', fontWeight: soldOut ? 700 : 400, color: soldOut ? 'var(--c-amber)' : undefined }}>
            {limit !== null
              ? soldOut ? `All ${limit} taken` : `${limit - n} of ${limit} left`
              : n > 0 ? `${n} ${n === 1 ? 'sponsor' : 'sponsors'}` : 'No limit'}
          </span>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => toggleShown(p)}
            title={p.is_active ? 'Take it off your sponsor page' : 'Show it on your sponsor page'}>
            {p.is_active ? <><EyeOff size={14} /> Hide</> : <><Eye size={14} /> Show</>}
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setEditing(p)} aria-label={`Edit ${p.name}`}>
            <Pencil size={14} /> Edit
          </button>
        </div>
      </li>
    );
  };

  const live = packages.filter(p => p.is_active);
  const hidden = packages.filter(p => !p.is_active);
  const grid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))', gap: '0.85rem', margin: 0, padding: 0 };
  const heading = (text: string, count: number) => (
    <h3 style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', margin: '0 0 0.6rem' }}>
      {text} ({count})
    </h3>
  );

  return (
    <div className="stack">
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: '0.75rem' }}>
        <div className="min-w-0">
          <h2 style={{ fontWeight: 800, fontSize: '1.15rem', margin: 0, color: 'var(--text-primary)' }}>Sponsorship packages</h2>
          <p className="text-note" style={{ margin: '0.25rem 0 0' }}>
            Businesses pick one on your public page: <a href={`/${club.slug}/sponsor`}>/{club.slug}/sponsor</a>
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setEditing('new')}><Plus size={16} /> Add package</button>
      </div>

      {feedback && (
        <p role="status" style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700, color: feedback.type === 'ok' ? 'var(--c-green)' : 'var(--c-red)' }}>{feedback.text}</p>
      )}

      {loaded && packages.length === 0 && (
        <div className="glass-panel" style={{ padding: '2rem 1.25rem', textAlign: 'center' }}>
          <Package size={28} aria-hidden="true" style={{ color: 'var(--text-muted)' }} />
          <p style={{ margin: '0.5rem 0 1rem', color: 'var(--text-secondary)' }}>No packages yet. Add one so businesses can sign up and pay on your sponsor page.</p>
          <button type="button" className="btn btn-primary" onClick={() => setEditing('new')}><Plus size={16} /> Add your first package</button>
        </div>
      )}

      {live.length > 0 && (
        <section>
          {heading('On your sponsor page', live.length)}
          <ul style={grid}>{live.map(card)}</ul>
        </section>
      )}
      {hidden.length > 0 && (
        <section>
          {heading('Hidden', hidden.length)}
          <ul style={grid}>{hidden.map(card)}</ul>
        </section>
      )}

      {editing && (
        <PackageDialog
          key={editing === 'new' ? 'new' : editing.id}
          pkg={editing === 'new' ? null : editing}
          clubId={club.id} db={db} nextOrder={packages.length}
          includesReady={includesReady} limitsReady={limitsReady}
          taken={editing === 'new' ? 0 : taken.get(editing.id) || 0}
          onClose={() => setEditing(null)}
          onSaved={text => { flash('ok', text); load(); }}
        />
      )}
    </div>
  );
}
