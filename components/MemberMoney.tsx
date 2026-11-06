'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { FileText, Plus, Receipt, Upload } from 'lucide-react';
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

/** Claim money back from the club, and see what happened to earlier claims */
export function MemberExpenseClaims({ clubId, memberId, currency }: { clubId: string; memberId: string; currency: string }) {
  const blank = { description: '', amount: '', category: 'kit_equipment', spentOn: siteToday(), vendor: '', payoutDetails: '' };
  const [form, setForm] = useState(blank);
  const [file, setFile] = useState<File | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [claims, setClaims] = useState<ExpenseClaim[] | null>(null);

  const fetchClaims = useCallback(async () => {
    const db = getSupabaseClient();
    if (!db) return;
    const { data, error: readError } = await db.from('expense_claims').select('*').eq('club_id', clubId).eq('member_id', memberId).order('created_at', { ascending: false }).limit(20);
    // Before migration 20261152 there's no such table: the panel stays hidden
    setClaims(readError ? null : (data || []) as ExpenseClaim[]);
  }, [clubId, memberId]);
  useEffect(() => { void fetchClaims(); }, [fetchClaims]);
  if (claims === null) return null;

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
    await fetchClaims();
  };

  return (
    <section aria-labelledby="member-claims-title" className="glass-panel" style={{ padding: '1.25rem 1.5rem', marginBottom: '2rem' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
        <div>
          <h2 id="member-claims-title" style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Receipt size={18} aria-hidden="true" /> Expense claims
          </h2>
          <p className="text-note" style={{ margin: '0.2rem 0 0' }}>Bought something for the club? Send the receipt and get paid back.</p>
        </div>
        <button type="button" className={`btn btn-sm ${open ? 'btn-secondary' : 'btn-primary'}`} onClick={() => { setOpen(o => !o); setSent(false); }} aria-expanded={open}>
          <Plus size={15} aria-hidden="true" /> Claim an expense
        </button>
      </div>

      {sent && <p role="status" className="text-note" style={{ margin: '0.75rem 0 0', color: 'var(--c-green)' }}>Claim sent. The treasurer will check it, and you&apos;ll get an email when they do.</p>}

      {open && (
        <form onSubmit={send} style={{ marginTop: '1rem', display: 'grid', gap: '0.75rem', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))' }}>
          <div className="form-group">
            <label className="form-label" htmlFor="claim-description">What did you buy?</label>
            <input id="claim-description" className="form-input" required maxLength={300} placeholder="Oranges and strapping tape" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="claim-amount">Amount ({currency})</label>
            <input id="claim-amount" className="form-input" inputMode="decimal" required placeholder="42.50" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="claim-date">Date on the receipt</label>
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
          <div className="form-group">
            <label className="form-label" htmlFor="claim-receipt">Receipt (photo or PDF, max 5 MB)</label>
            <input id="claim-receipt" type="file" className="form-input" required accept="image/jpeg,image/png,image/webp,application/pdf" onChange={e => setFile(e.target.files?.[0] ?? null)} />
          </div>
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label" htmlFor="claim-payout">Where should the club pay you? (optional)</label>
            <input id="claim-payout" className="form-input" maxLength={300} autoComplete="off" placeholder="Account name, BSB and account number" value={form.payoutDetails} onChange={e => setForm({ ...form, payoutDetails: e.target.value })} />
            <p className="text-meta" style={{ marginTop: '0.35rem' }}>Only the club&apos;s finance team sees this. It&apos;s erased once you&apos;ve been paid or the claim is turned down.</p>
          </div>
          {error && <p role="alert" style={{ color: 'var(--c-red)', fontSize: '0.85rem', margin: 0, gridColumn: '1 / -1' }}>{error}</p>}
          <button type="submit" className="btn btn-primary" disabled={busy} style={{ justifySelf: 'start' }}><Upload size={16} aria-hidden="true" /> {busy ? 'Sending…' : 'Send claim'}</button>
        </form>
      )}

      {claims.length > 0 && (
        <ul style={{ listStyle: 'none', margin: '1rem 0 0', padding: 0, display: 'grid', gap: '0.65rem' }}>
          {claims.map(c => (
            <li key={c.id} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.65rem' }}>
              <div>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{c.description}, {formatMoney(c.amount_cents, c.currency)}</div>
                <div className="text-note" style={{ color: CLAIM_COLOR[c.status] }}>{CLAIM_STATUS_LABEL[c.status]}{c.rejection_reason ? `: ${c.rejection_reason}` : ''}</div>
              </div>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => openReceipt('claim', c.id)} aria-label={`View the receipt for ${c.description}`}><FileText size={14} aria-hidden="true" /></button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
