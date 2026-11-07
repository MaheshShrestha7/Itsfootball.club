'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Check, Clock, FileText, Plus, Upload, X } from 'lucide-react';
import { DATE_LOCALE } from '@/lib/dates';
import { CLAIM_STATUS_LABEL } from '@/lib/expense-claims';
import { EXPENSE_CATEGORIES, formatMoney } from '@/lib/finance';
import { siteToday } from '@/lib/member-prices';
import { openReceipt } from '@/lib/receipts';
import { getAccessToken, getSupabaseClient } from '@/lib/supabase/client';
import type { ExpenseClaim } from '@/lib/supabase/types';

// The member page's money, for members and parents: fees the club has asked them for, and expense claims.

export interface OpenFee {
  id: string;
  member_id: string;
  request_title: string | null;
  amount_cents: number;
  currency: string;
  due_on: string | null;
  status: 'pending' | 'awaiting_review';
}

/** Open fee requests for these people. Row-level security limits it to their own and their children's. */
export function useOpenFees(clubId: string, memberIds: string[]): OpenFee[] {
  const [fees, setFees] = useState<OpenFee[]>([]);
  const key = memberIds.join(',');
  useEffect(() => {
    const db = getSupabaseClient();
    if (!db || !key) return setFees([]);
    db.from('payments').select('id, member_id, request_title, amount_cents, currency, due_on, status')
      .eq('club_id', clubId).eq('kind', 'fee_request').in('member_id', key.split(',')).in('status', ['pending', 'awaiting_review'])
      .order('due_on')
      .then(({ data }) => setFees((data || []) as OpenFee[]));
  }, [clubId, key]);
  return fees;
}

const shortDate = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString(DATE_LOCALE, { day: 'numeric', month: 'short' });

export function MemberFees({ clubSlug, fees, names }: { clubSlug: string; fees: OpenFee[]; /** Set for parents: whose fee each one is */ names?: Map<string, string> }) {
  if (!fees.length) return null;
  const today = siteToday();
  return (
    <section aria-labelledby="member-fees-title" className="glass-panel" style={{ padding: '1.25rem 1.5rem', marginBottom: '2rem', borderLeft: '4px solid #F59E0B' }}>
      <h2 id="member-fees-title" style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.75rem' }}>Fees to pay</h2>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '0.75rem' }}>
        {fees.map(f => (
          <li key={f.id} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
            <div>
              <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{f.request_title || 'Club fee'}{names?.get(f.member_id) ? ` (${names.get(f.member_id)})` : ''}</div>
              <div className="text-note" style={{ color: f.status === 'pending' && f.due_on && f.due_on < today ? 'var(--c-red)' : undefined }}>
                {formatMoney(f.amount_cents, f.currency)}
                {f.status === 'awaiting_review' ? ', your receipt is with the club' : f.due_on ? `, ${f.due_on < today ? 'was due' : 'due'} ${shortDate(f.due_on)}` : ''}
              </div>
            </div>
            {f.status === 'pending' && <Link href={`/${clubSlug}/pay/${f.id}`} className="btn btn-primary btn-sm">Pay</Link>}
          </li>
        ))}
      </ul>
    </section>
  );
}

const CLAIM_COLOR: Record<string, string> = { submitted: 'var(--c-amber)', approved: 'var(--c-amber)', paid: 'var(--c-green)', rejected: 'var(--c-red)' };
const CLAIM_ICON: Record<string, typeof Check> = { submitted: Clock, approved: Check, paid: Check, rejected: X };

/** This member's latest claims. Null until loaded, and before migration 20261152, when there's no such table: the tab stays hidden. */
export function useExpenseClaims(clubId: string, memberId: string | null) {
  const [claims, setClaims] = useState<ExpenseClaim[] | null>(null);
  const refresh = useCallback(async () => {
    const db = getSupabaseClient();
    if (!db || !memberId) return setClaims(null);
    const { data, error } = await db.from('expense_claims').select('*').eq('club_id', clubId).eq('member_id', memberId).order('created_at', { ascending: false }).limit(20);
    setClaims(error ? null : (data || []) as ExpenseClaim[]);
  }, [clubId, memberId]);
  useEffect(() => { void refresh(); }, [refresh]);
  return { claims, refresh };
}

/** Claim money back from the club, and see what happened to earlier claims */
export function MemberExpenseClaims({ clubId, currency, claims, onSent }: { clubId: string; currency: string; claims: ExpenseClaim[]; onSent: () => Promise<void> }) {
  const blank = { description: '', amount: '', category: 'kit_equipment', spentOn: siteToday(), vendor: '', accountName: '', bankName: '', bsb: '', accountNumber: '' };
  const [form, setForm] = useState(blank);
  const [file, setFile] = useState<File | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const total = (status: string) => claims.filter(c => c.status === status).reduce((sum, c) => sum + c.amount_cents, 0);
  const [approved, waiting] = [total('approved'), total('submitted')];
  const breakdown = [approved && `${formatMoney(approved, currency)} approved`, waiting && `${formatMoney(waiting, currency)} waiting for the treasurer`].filter(Boolean).join(', ');

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return setError('Attach a photo or PDF of the receipt.');
    setBusy(true);
    setError(null);
    const body = new FormData();
    body.append('clubId', clubId);
    Object.entries(form).forEach(([k, v]) => body.append(k, v));
    body.append('receipt', file);
    const res = await fetch('/api/expense-claims', { method: 'POST', body, headers: { Authorization: `Bearer ${await getAccessToken()}` } }).catch(() => null);
    const json = await res?.json().catch(() => ({})) ?? {};
    setBusy(false);
    if (!res?.ok) return setError(json.error || 'Your claim could not be sent. Please try again.');
    setForm(blank);
    setFile(null);
    setOpen(false);
    setSent(true);
    await onSent();
  };

  return (
    <section aria-labelledby="member-claims-title" className="stack">
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
        <div>
          <h2 id="member-claims-title" style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Expense claims</h2>
          <p className="text-note" style={{ margin: '0.2rem 0 0' }}>Bought something for the club? Send the receipt and get paid back.</p>
        </div>
        <button type="button" className={`btn ${open ? 'btn-secondary' : 'btn-primary'}`} onClick={() => { setOpen(o => !o); setSent(false); }} aria-expanded={open}>
          <Plus size={16} aria-hidden="true" /> New claim
        </button>
      </div>

      {sent && <p role="status" className="text-note" style={{ margin: 0, color: 'var(--c-green)' }}>Claim sent. The treasurer will check it, and you&apos;ll get an email when they do.</p>}

      {open ? (
        <form onSubmit={send} className="glass-panel stack" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem' }}>
            {/* Receipt first: it's what people have in hand. On a phone the picker offers the camera. */}
            <label htmlFor="claim-receipt" style={{ flex: '1 1 240px', minWidth: 0, minHeight: '220px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '1.25rem', textAlign: 'center', border: '1.5px dashed var(--border-medium)', borderRadius: 'var(--radius-md)', cursor: 'pointer' }}>
              <Upload size={26} aria-hidden="true" style={{ color: 'var(--text-secondary)' }} />
              <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Add your receipt *</span>
              <span className="text-note">Photo or PDF, max 5 MB</span>
              <input id="claim-receipt" type="file" required accept="image/jpeg,image/png,image/webp,application/pdf" style={{ maxWidth: '100%', fontSize: '0.8rem', color: 'var(--text-secondary)' }} onChange={e => setFile(e.target.files?.[0] ?? null)} />
            </label>
            <div className="form-grid" style={{ flex: '2 1 440px', minWidth: 0 }}>
              <div className="form-group form-wide">
                <label className="form-label" htmlFor="claim-description">What did you buy? *</label>
                <input id="claim-description" className="form-input" required maxLength={300} placeholder="Oranges and strapping tape" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="claim-amount">Amount ({currency}) *</label>
                <input id="claim-amount" className="form-input" inputMode="decimal" required placeholder="42.50" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="claim-date">Date on the receipt *</label>
                <input id="claim-date" type="date" className="form-input" required max={siteToday()} value={form.spentOn} onChange={e => setForm({ ...form, spentOn: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="claim-category">Type of expense</label>
                <select id="claim-category" className="form-select" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                  {Object.entries(EXPENSE_CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="claim-vendor">Shop or supplier (optional)</label>
                <input id="claim-vendor" className="form-input" maxLength={255} value={form.vendor} onChange={e => setForm({ ...form, vendor: e.target.value })} />
              </div>
            </div>
          </div>

          <fieldset style={{ border: 0, margin: 0, padding: '1rem 0 0', minWidth: 0, borderTop: '1px solid var(--border-subtle)' }}>
            <legend style={{ float: 'left', width: '100%', padding: 0, marginBottom: '0.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>Where should the club pay you? (optional)</legend>
            <div className="form-grid" style={{ clear: 'both' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="claim-account-name">Account name</label>
                <input id="claim-account-name" className="form-input" maxLength={100} autoComplete="off" value={form.accountName} onChange={e => setForm({ ...form, accountName: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="claim-bank-name">Bank name</label>
                <input id="claim-bank-name" className="form-input" maxLength={100} autoComplete="off" value={form.bankName} onChange={e => setForm({ ...form, bankName: e.target.value })} />
              </div>
              {/* Text rather than type="number", which would lose a BSB's leading zero */}
              <div className="form-group">
                <label className="form-label" htmlFor="claim-bsb">BSB</label>
                <input id="claim-bsb" className="form-input" inputMode="numeric" autoComplete="off" pattern="\d{6}" title="6 digits" placeholder="062000" value={form.bsb} onChange={e => setForm({ ...form, bsb: e.target.value.replace(/\D/g, '').slice(0, 6) })} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="claim-account-number">Account number</label>
                <input id="claim-account-number" className="form-input" inputMode="numeric" autoComplete="off" pattern="\d{5,10}" title="5 to 10 digits" placeholder="12345678" value={form.accountNumber} onChange={e => setForm({ ...form, accountNumber: e.target.value.replace(/\D/g, '').slice(0, 10) })} />
              </div>
            </div>
            <p className="text-meta" style={{ margin: '0.75rem 0 0' }}>Only the club&apos;s finance team sees this. It&apos;s erased once you&apos;ve been paid or the claim is turned down.</p>
          </fieldset>

          {error && <p role="alert" style={{ color: 'var(--c-red)', fontSize: '0.85rem', margin: 0 }}>{error}</p>}
          <div className="form-actions" style={{ marginTop: 0 }}>
            <button type="button" className="btn btn-secondary" onClick={() => { setOpen(false); setError(null); }}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={busy}><Upload size={16} aria-hidden="true" /> {busy ? 'Sending…' : 'Send claim'}</button>
          </div>
        </form>
      ) : claims.length === 0 ? (
        <p className="glass-panel text-note" style={{ margin: 0, padding: '2rem 1.5rem', textAlign: 'center' }}>You haven&apos;t sent any claims yet.</p>
      ) : (
        <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
          {(approved + waiting) > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '0.25rem 1rem', padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ fontFamily: 'var(--font-heading)', fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{formatMoney(approved + waiting, currency)}</span>
              <span className="text-note" style={{ fontSize: '0.875rem' }}>not paid back yet: {breakdown}</span>
            </div>
          )}
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {claims.map((c, i) => {
              const Icon = CLAIM_ICON[c.status] || Clock;
              return (
                <li key={c.id} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem 1rem', padding: '0.85rem 1.5rem', borderTop: i ? '1px solid var(--border-subtle)' : undefined }}>
                  <div style={{ flex: '1 1 240px', minWidth: 0 }}>
                    <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{c.description}</div>
                    <div className="text-note">{shortDate(c.spent_on)} • {EXPENSE_CATEGORIES[c.category] || c.category}</div>
                  </div>
                  <div className="text-note" style={{ flex: '1 1 180px', minWidth: 0, display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600, color: CLAIM_COLOR[c.status] }}>
                    <Icon size={15} aria-hidden="true" style={{ flex: 'none' }} />
                    <span>{CLAIM_STATUS_LABEL[c.status]}{c.rejection_reason ? `: ${c.rejection_reason}` : ''}</span>
                  </div>
                  <span style={{ width: '5rem', flex: 'none', textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{formatMoney(c.amount_cents, c.currency)}</span>
                  <button type="button" className="btn btn-secondary" style={{ width: '44px', height: '44px', padding: 0, flex: 'none' }} onClick={() => openReceipt('claim', c.id)} aria-label={`View the receipt for ${c.description}`}><FileText size={16} aria-hidden="true" /></button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
