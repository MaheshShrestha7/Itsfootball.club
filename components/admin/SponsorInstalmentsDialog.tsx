'use client';

import React, { useState } from 'react';
import { X } from 'lucide-react';
import { formatMoney, parseMoneyToCents } from '@/lib/finance';
import { buildSchedule, MAX_INSTALMENTS, MIN_INSTALMENTS, OVERDUE_REMINDER_DAYS, invoiceIsDue } from '@/lib/sponsor-instalments';
import { formatEndDate, localDateISO } from '@/lib/sponsors';
import { getAccessToken } from '@/lib/supabase/client';

interface Props {
  clubId: string;
  sponsor: { id: string; name: string; contact_email?: string | null; is_active?: boolean };
  currency: string;
  /** The deal's value, to start from */
  totalCents: number | null;
  onClose: () => void;
  onDone: (note: string) => void;
}

const money = (cents: number) => (cents / 100).toFixed(2);

/** Splits a sponsorship into instalments, each with its own invoice. Every amount and date can be changed. */
export default function SponsorInstalmentsDialog({ clubId, sponsor, currency, totalCents, onClose, onDone }: Props) {
  const today = localDateISO();
  const [total, setTotal] = useState(totalCents ? money(totalCents) : '');
  const [count, setCount] = useState(3);
  const [firstDue, setFirstDue] = useState(today);
  const [every, setEvery] = useState(3);
  const [rows, setRows] = useState(() => (totalCents ? toRows(buildSchedule(totalCents, 3, today, 3)) : []));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toRows(schedule: { amountCents: number; dueOn: string }[]) {
    return schedule.map(r => ({ amount: money(r.amountCents), dueOn: r.dueOn }));
  }
  const rebuild = (next: { total?: string; count?: number; firstDue?: string; every?: number }) => {
    const t = next.total ?? total;
    const c = next.count ?? count;
    const f = next.firstDue ?? firstDue;
    const e = next.every ?? every;
    setTotal(t); setCount(c); setFirstDue(f); setEvery(e);
    setError(null);
    const cents = parseMoneyToCents(t);
    setRows(cents && cents > 0 && f ? toRows(buildSchedule(cents, c, f, e)) : []);
  };
  const editRow = (i: number, change: Partial<{ amount: string; dueOn: string }>) => {
    setError(null);
    setRows(list => list.map((r, j) => (j === i ? { ...r, ...change } : r)));
  };

  const cents = rows.map(r => parseMoneyToCents(r.amount));
  const planTotal = cents.reduce<number>((n, c) => n + (c ?? 0), 0);
  const sendsNow = rows[0]?.dueOn ? invoiceIsDue(rows[0].dueOn, today) : false;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rows.length) return setError('Enter the total first.');
    if (cents.some(c => c === null)) return setError('Check the amounts, e.g. 1000 or 1000.50');
    setBusy(true);
    setError(null);
    const res = await fetch('/api/sponsors/instalments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await getAccessToken()}` },
      body: JSON.stringify({ clubId, sponsorId: sponsor.id, action: 'create', instalments: rows.map((r, i) => ({ amountCents: cents[i], dueOn: r.dueOn })) }),
    }).catch(() => null);
    const json = await res?.json().catch(() => ({})) ?? {};
    setBusy(false);
    if (!res?.ok) return setError(json.error || 'The plan could not be saved. Check your connection and try again.');
    onDone(json.emailed ? `Plan saved. The first invoice was emailed to ${sponsor.contact_email}.`
      : json.later ? `Plan saved. The first invoice goes out 14 days before ${formatEndDate(rows[0].dueOn)}.`
      : json.note || 'Plan saved.');
  };

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="instalments-title" onKeyDown={e => { if (e.key === 'Escape') onClose(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'var(--color-scrim)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', overflowY: 'auto' }}>
      <form onSubmit={save} className="glass-panel" style={{ margin: 'auto', width: '100%', maxWidth: '520px', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-medium)', padding: '1.5rem' }}>
        <div className="section-head" style={{ marginBottom: '0.35rem' }}>
          <h3 id="instalments-title" style={{ fontSize: 'var(--text-xl)', fontWeight: 600, color: 'var(--text-primary)' }}>Pay by instalments</h3>
          <button type="button" onClick={onClose} aria-label="Close" title="Close (Esc)" className="touch-target" style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>
        <p className="text-meta" style={{ margin: '0 0 1.1rem' }}>
          {sponsor.name} gets a separate invoice with a pay link for each one.
          {sponsor.is_active ? '' : ' They go on your site when the first payment arrives, or tap Put on site any time.'}
        </p>

        <div className="form-row-2" style={{ gap: '1rem' }}>
          <div className="form-group">
            <label htmlFor="plan-total" className="form-label">Total ({currency})</label>
            <input id="plan-total" className="form-input" inputMode="decimal" value={total} placeholder="3000" onChange={e => rebuild({ total: e.target.value })} />
          </div>
          <div className="form-group">
            <label htmlFor="plan-count" className="form-label">Instalments</label>
            <select id="plan-count" className="form-select" value={count} onChange={e => rebuild({ count: Number(e.target.value) })}>
              {Array.from({ length: MAX_INSTALMENTS - MIN_INSTALMENTS + 1 }, (_, i) => i + MIN_INSTALMENTS).map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="plan-first" className="form-label">First due</label>
            <input id="plan-first" type="date" className="form-input" min={today} value={firstDue} onChange={e => rebuild({ firstDue: e.target.value })} />
          </div>
          <div className="form-group">
            <label htmlFor="plan-every" className="form-label">Then every</label>
            <select id="plan-every" className="form-select" value={every} onChange={e => rebuild({ every: Number(e.target.value) })}>
              <option value={1}>Month</option>
              <option value={2}>2 months</option>
              <option value={3}>3 months</option>
              <option value={6}>6 months</option>
            </select>
          </div>
        </div>

        {rows.length > 0 && (
          <fieldset style={{ border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '0.75rem', margin: '0 0 0.75rem', display: 'grid', gap: '0.5rem' }}>
            <legend className="form-label" style={{ padding: '0 0.35rem' }}>Schedule (change any of these)</legend>
            {rows.map((r, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1.5rem minmax(0, 1fr) minmax(0, 1.2fr)', gap: '0.5rem', alignItems: 'center' }}>
                <span className="text-meta">{i + 1}</span>
                <input className="form-input" inputMode="decimal" aria-label={`Instalment ${i + 1} amount`} value={r.amount} onChange={e => editRow(i, { amount: e.target.value })} />
                <input className="form-input" type="date" aria-label={`Instalment ${i + 1} due date`} min={today} value={r.dueOn} onChange={e => editRow(i, { dueOn: e.target.value })} />
              </div>
            ))}
            <div className="text-meta" role="status" style={{ textAlign: 'right' }}>Adds up to <strong>{formatMoney(planTotal, currency)}</strong></div>
          </fieldset>
        )}

        <p className="text-meta" style={{ margin: '0 0 0.75rem' }}>
          {sendsNow ? 'The first invoice is emailed now.' : 'The first invoice goes out 14 days before it\'s due.'}{' '}
          Each later one goes out 14 days before its due date, with one reminder if it&apos;s {OVERDUE_REMINDER_DAYS} days late.
        </p>
        {error && <p role="alert" style={{ color: 'var(--c-red)', fontSize: '0.85rem', margin: '0 0 0.75rem' }}>{error}</p>}
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button type="button" onClick={onClose} className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center' }}>Cancel</button>
          <button type="submit" disabled={busy || !rows.length} className="btn btn-primary" style={{ flex: 2, justifyContent: 'center' }}>{busy ? 'Saving…' : 'Set up instalments'}</button>
        </div>
      </form>
    </div>
  );
}
