'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Banknote, CheckCircle2, FileText, XCircle } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { CLAIM_STATUS_LABEL } from '@/lib/expense-claims';
import { EXPENSE_CATEGORIES, formatMoney } from '@/lib/finance';
import { openReceipt } from '@/lib/receipts';
import { getAccessToken, getSupabaseClient } from '@/lib/supabase/client';
import type { ExpenseClaim } from '@/lib/supabase/types';
import { askText, confirmAction } from '@/components/ConfirmDialog';

interface Props {
  club: { id: string };
  flash: (type: 'ok' | 'error', text: string) => void;
  /** Refreshes the Finance page: an approved claim adds to its expenses */
  load: () => Promise<void>;
}

const PILL: Record<string, string> = { submitted: 'is-warn', approved: 'is-warn', paid: 'is-ok', rejected: '' };

export default function ExpenseClaimsTab({ club, flash, load }: Props) {
  const { user } = useAuth();
  const [claims, setClaims] = useState<ExpenseClaim[] | null>(null);
  const [categories, setCategories] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const fetchClaims = useCallback(async () => {
    const { data } = await getSupabaseClient()!.from('expense_claims').select('*').eq('club_id', club.id).order('created_at', { ascending: false });
    setClaims((data || []) as ExpenseClaim[]);
  }, [club.id]);
  useEffect(() => { void fetchClaims(); }, [fetchClaims]);

  const review = async (claim: ExpenseClaim, body: Record<string, string | null>, done: string) => {
    setBusy(true);
    const res = await fetch('/api/expense-claims/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await getAccessToken()}` },
      body: JSON.stringify({ clubId: club.id, claimId: claim.id, ...body }),
    }).catch(() => null);
    const json = await res?.json().catch(() => ({})) ?? {};
    setBusy(false);
    if (!res?.ok) return flash('error', json.error || 'That didn\'t work. Please try again.');
    flash('ok', `${done}${json.emailed ? ` ${claim.claimant_name} has been emailed.` : ''}`);
    await Promise.all([fetchClaims(), load()]);
  };

  const reject = async (claim: ExpenseClaim) => {
    const reason = await askText({
      title: 'Turn down this claim?', message: `${claim.claimant_name} sees your note, by email and on their member page. They can send it again.`,
      label: 'Note to them', placeholder: 'e.g. The receipt is hard to read', confirmLabel: 'Turn down', danger: true,
    });
    if (reason === null) return;
    await review(claim, { action: 'reject', reason }, 'Claim turned down.');
  };

  const markPaid = async (claim: ExpenseClaim) => {
    if (!(await confirmAction({
      title: `Paid ${claim.claimant_name} back?`,
      message: `Only do this once ${formatMoney(claim.amount_cents, claim.currency)} has been sent. The bank details they gave are then erased.`,
      confirmLabel: 'Mark as paid',
    }))) return;
    await review(claim, { action: 'paid' }, 'Marked as paid.');
  };

  if (claims === null) return <p className="admin-table-foot" role="status">Loading claims…</p>;

  const toReview = claims.filter(c => c.status === 'submitted');
  const toPay = claims.filter(c => c.status === 'approved');
  const done = claims.filter(c => c.status === 'paid' || c.status === 'rejected');
  const summary = (c: ExpenseClaim) => (
    <>
      <b>{c.claimant_name}: {formatMoney(c.amount_cents, c.currency)}</b>
      <div>{c.description}{c.vendor ? `, ${c.vendor}` : ''}</div>
      <small className="admin-note">Spent {c.spent_on}. Sent {c.created_at.slice(0, 10)}.</small>
      {/* There's nobody else to check it in some clubs, so it isn't blocked, but it should be plain */}
      {c.submitted_by === user?.id && <div><span className="admin-pill is-warn">Your own claim</span></div>}
    </>
  );

  return (
    <div className="stack">
      <p className="admin-note" style={{ margin: 0 }}>Members send these from their member page with a receipt. Approving adds the money to your expenses as owed to them.</p>

      <section className="admin-panel" aria-labelledby="claims-review-title">
        <div className="admin-panel-head"><h2 id="claims-review-title">To review</h2><span className="admin-meta">{toReview.length}</span></div>
        <div className="admin-section">
          {toReview.length === 0 ? <p className="admin-table-foot" style={{ margin: 0 }}>Nothing waiting.</p> : (
            <ul className="stack" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {toReview.map(c => (
                <li key={c.id} className="glass-panel" style={{ padding: '1rem', display: 'grid', gap: '0.6rem' }}>
                  <div>{summary(c)}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
                    <label className="sr-only" htmlFor={`claim-cat-${c.id}`}>Category</label>
                    <select id={`claim-cat-${c.id}`} className="form-select" style={{ width: 'auto' }} value={categories[c.id] || c.category}
                      onChange={e => setCategories(x => ({ ...x, [c.id]: e.target.value }))}>
                      {Object.entries(EXPENSE_CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                    <button data-view-ok type="button" className="btn btn-secondary btn-sm" onClick={() => openReceipt('claim', c.id)}><FileText size={14} aria-hidden="true" /> Receipt</button>
                    <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => review(c, { action: 'approve', category: categories[c.id] || c.category }, 'Claim approved and added to expenses.')}><CheckCircle2 size={14} aria-hidden="true" /> Approve</button>
                    <button type="button" className="btn btn-danger btn-sm" disabled={busy} onClick={() => reject(c)}><XCircle size={14} aria-hidden="true" /> Turn down</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="admin-panel" aria-labelledby="claims-pay-title">
        <div className="admin-panel-head"><h2 id="claims-pay-title">To pay back</h2><span className="admin-meta">{toPay.length}</span></div>
        <div className="admin-section">
          {toPay.length === 0 ? <p className="admin-table-foot" style={{ margin: 0 }}>Nobody is owed anything from a claim.</p> : (
            <ul className="stack" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {toPay.map(c => (
                <li key={c.id} className="glass-panel" style={{ padding: '1rem', display: 'grid', gap: '0.6rem' }}>
                  <div>{summary(c)}</div>
                  <div style={{ whiteSpace: 'pre-wrap', fontSize: '0.9rem' }}><b>Pay to: </b>{c.payout_details || 'They didn’t give bank details, so ask them or use the ones you have.'}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <button data-view-ok type="button" className="btn btn-secondary btn-sm" onClick={() => openReceipt('claim', c.id)}><FileText size={14} aria-hidden="true" /> Receipt</button>
                    <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => markPaid(c)}><Banknote size={14} aria-hidden="true" /> Mark as paid</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {done.length > 0 && (
        <div className="admin-panel admin-table-wrap">
          <table className="admin-table">
            <caption className="sr-only">Finished claims</caption>
            <thead><tr><th scope="col">Sent</th><th scope="col">From</th><th scope="col">For</th><th scope="col" className="is-num">Amount</th><th scope="col">Status</th><th scope="col"><span className="sr-only">Receipt</span></th></tr></thead>
            <tbody>
              {done.map(c => (
                <tr key={c.id}>
                  <td className="is-num" style={{ textAlign: 'left' }}>{c.created_at.slice(0, 10)}</td>
                  <td>{c.claimant_name}</td>
                  <td className="is-strong">{c.description}</td>
                  <td className="is-num is-strong">{formatMoney(c.amount_cents, c.currency)}</td>
                  <td><span className={`admin-pill ${PILL[c.status]}`}>{CLAIM_STATUS_LABEL[c.status]}</span>{c.rejection_reason && <small>{c.rejection_reason}</small>}</td>
                  <td className="is-actions"><button data-view-ok type="button" className="btn btn-secondary btn-sm" onClick={() => openReceipt('claim', c.id)} aria-label={`View receipt from ${c.claimant_name}`}><FileText size={14} aria-hidden="true" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
