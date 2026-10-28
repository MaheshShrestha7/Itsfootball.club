'use client';

import React, { useEffect, useState } from 'react';
import { Plus, Save, Trash2 } from 'lucide-react';
import { getSupabaseClient } from '@/lib/supabase/client';
import { parseMoneyToCents } from '@/lib/finance';
import { confirmAction } from '@/components/ConfirmDialog';

// Editable price rows shared by membership plans and sponsorship packages
export default function PriceList<T extends { id: string; name: string; price_cents: number; is_active: boolean; sort_order: number; benefits?: string | null; description?: string | null }>({
  title, table, rows, db, clubId, flash, load, blank, extra, extraLabel, textField = 'description',
}: {
  title: string; table: string; rows: T[]; db: ReturnType<typeof getSupabaseClient>; clubId: string; flash: (type: 'ok' | 'error', text: string) => void; load: () => Promise<void>;
  blank: Partial<T>; extra: (row: T, set: (patch: Partial<T>) => void) => React.ReactNode; extraLabel: string; textField?: 'description' | 'benefits';
}) {
  const [draft, setDraft] = useState<Record<string, T>>({});
  const [prices, setPrices] = useState<Record<string, string>>({});
  useEffect(() => { setDraft(Object.fromEntries(rows.map(r => [r.id, r]))); setPrices(Object.fromEntries(rows.map(r => [r.id, (r.price_cents / 100).toFixed(2)]))); }, [rows]);

  // A new row starts hidden (not on the public sign-up pages) until it's named, priced and saved as active
  const add = async () => {
    const { error } = await db!.from(table).insert({ ...blank, is_active: false, club_id: clubId, sort_order: rows.length });
    if (error) return flash('error', error.message);
    load();
  };
  const save = async (id: string) => {
    const cents = parseMoneyToCents(prices[id] || '');
    if (cents === null) return flash('error', 'Enter a valid price, e.g. 50 or 49.99');
    const row: Record<string, unknown> = { ...draft[id], price_cents: cents };
    delete row.id;
    delete row.created_at;
    const { error } = await db!.from(table).update(row).eq('id', id);
    if (error) return flash('error', error.message);
    flash('ok', `${draft[id].name} saved.`);
    load();
  };
  const remove = async (id: string) => {
    if (!(await confirmAction({ title: 'Delete this?', message: 'Past payments keep their amounts. Untick "active" instead to just hide it.', confirmLabel: 'Delete', danger: true }))) return;
    const { error } = await db!.from(table).delete().eq('id', id);
    if (error) return flash('error', error.message);
    load();
  };

  return (
    <div className="glass-panel" style={{ padding: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <h3 style={{ fontWeight: 800, color: 'var(--text-primary)' }}>{title}</h3>
        <button type="button" className="btn btn-secondary btn-sm" onClick={add}><Plus size={14} /> Add</button>
      </div>
      {rows.length === 0 && <p className="text-note">None yet.</p>}
      <div className="stack stack-sm">
        {rows.map(r => {
          const row = draft[r.id] || r;
          const set = (patch: Partial<T>) => setDraft(d => ({ ...d, [r.id]: { ...row, ...patch } }));
          return (
            <div key={r.id} style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border-subtle)' }}>
              <input className="form-input" style={{ flex: '1 1 180px' }} aria-label="Name" value={row.name} onChange={e => set({ name: e.target.value } as Partial<T>)} />
              <input className="form-input" style={{ width: 110 }} aria-label="Price" inputMode="decimal" value={prices[r.id] ?? ''} onChange={e => setPrices(p => ({ ...p, [r.id]: e.target.value }))} />
              <span title={extraLabel}>{extra(row, set)}</span>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.82rem' }}>
                <input type="checkbox" checked={row.is_active} onChange={e => set({ is_active: e.target.checked } as Partial<T>)} /> Active
              </label>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => save(r.id)}><Save size={14} /> Save</button>
              <button data-needs-full type="button" className="btn btn-danger btn-sm" onClick={() => remove(r.id)} aria-label="Delete"><Trash2 size={14} /></button>
              <textarea className="form-textarea" rows={2} style={{ flexBasis: '100%' }} aria-label={textField === 'benefits' ? 'Benefits' : 'Description'}
                placeholder={textField === 'benefits' ? 'Benefits (logo on kit, website, matchday banner…)' : 'Short description (optional)'}
                value={(row[textField] as string) || ''} onChange={e => set({ [textField]: e.target.value } as Partial<T>)} />
              {!r.is_active && (
                <p className="text-note" style={{ flexBasis: '100%', margin: 0 }}>Hidden from your public pages. Tick Active and Save when it&apos;s ready.</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
