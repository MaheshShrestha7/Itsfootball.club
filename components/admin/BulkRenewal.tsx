'use client';

import React, { useState } from 'react';
import { Banknote, Mail, X } from 'lucide-react';
import PopupPanel from '@/components/PopupPanel';
import { getAccessToken, getSupabaseClient } from '@/lib/supabase/client';
import { formatMoney, membershipTermEnd, parseMoneyToCents, todayIso, type RenewalRule } from '@/lib/finance';
import { memberRecipient } from '@/lib/email/recipient';
import { DATE_LOCALE } from '@/lib/dates';
import type { ClubMember, MembershipPlan } from '@/lib/supabase/types';

const formatDate = (value: string) =>
  new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString(DATE_LOCALE, { day: 'numeric', month: 'short', year: 'numeric' });

const shiftDays = (iso: string, days: number) => { const d = new Date(`${iso}T00:00:00`); d.setDate(d.getDate() + days); return todayIso(d); };

/** Due for renewal: the renewal notice's window (expires in the next 30 days, or ran out in the last 60) */
export const isDueForRenewal = (member: ClubMember, today = todayIso()) => {
  const ends = member.membership_expires_at?.slice(0, 10);
  return !!ends && ends >= shiftDays(today, -60) && ends <= shiftDays(today, 30);
};

export const hasExpired = (member: ClubMember, today = todayIso()) => {
  const ends = member.membership_expires_at?.slice(0, 10);
  return !!ends && ends < today;
};

/** The new expiry after a renewal, as fulfil_payment works it out: early renewals keep their days, lapsed ones start today */
export const renewedUntil = (member: ClubMember, rule: RenewalRule, months: number, today = todayIso()) => {
  const ends = member.membership_expires_at?.slice(0, 10);
  return membershipTermEnd(ends && ends > today ? ends : today, rule, months);
};

const scrim: React.CSSProperties = {
  position: 'fixed', inset: 0, overflowY: 'auto', overscrollBehavior: 'contain', background: 'var(--color-scrim)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1rem',
};
const panel: React.CSSProperties = { margin: 'auto', width: '100%', maxWidth: '600px', padding: '1.5rem', background: 'rgb(var(--dk-9-13-22))' };
const field: React.CSSProperties = {
  width: '100%', background: 'rgba(var(--shade-rgb), 0.5)', border: '1px solid var(--border-subtle)', borderRadius: '8px',
  padding: '0.6rem 0.75rem', color: 'var(--text-primary)', fontSize: '0.85rem',
};
const label: React.CSSProperties = { display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.4rem' };
const rowsBox: React.CSSProperties = { border: '1px solid var(--border-subtle)', borderRadius: '10px', overflow: 'hidden', marginBottom: '0.9rem' };
const row: React.CSSProperties = { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.4rem 0.75rem', padding: '0.6rem 0.75rem', borderTop: '1px solid var(--border-subtle)', fontSize: '0.82rem', color: 'var(--text-primary)' };

/**
 * The bar for ticked members on Member passes, and its two ways to renew them:
 * paid offline (a renewal payment each, through fulfil_payment like Record income in Finance) or
 * a renewal email each (the same email as Send Renewal Email), so they renew and pay themselves.
 */
export default function BulkRenewal({ club, picked, plans, currency, onClear, onDone }: {
  club: { id: string; name: string } & RenewalRule;
  picked: ClubMember[];
  plans: MembershipPlan[];
  currency: string;
  onClear: () => void;
  /** After saving: the toast text, and the members whose rows changed */
  onDone: (message: string, changedIds: string[]) => void;
}) {
  const [open, setOpen] = useState<'offline' | 'email' | null>(null);
  if (!picked.length) return null;
  return (
    <>
      {/* Hidden while a popup is open, so it doesn't sit on top of it */}
      {!open && <div className="glass-panel" role="region" aria-label="Ticked members" style={{
        position: 'fixed', left: '50%', transform: 'translateX(-50%)', bottom: '18px', zIndex: 50, width: 'min(760px, calc(100% - 32px))',
        padding: '0.8rem 1rem', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '0.6rem 1rem',
        background: 'rgb(var(--dk-9-13-22))', boxShadow: '0 18px 40px rgba(0,0,0,.35)',
      }}>
        <div>
          <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>{picked.length} selected</strong>
          <button type="button" onClick={onClear} style={{ display: 'block', background: 'none', border: 0, padding: 0, marginTop: '2px', fontSize: '0.75rem', color: 'var(--text-muted)', cursor: 'pointer', textDecoration: 'underline' }}>Clear selection</button>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setOpen('email')} aria-haspopup="dialog"><Mail size={14} aria-hidden="true" /> Email renewal notice</button>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setOpen('offline')} aria-haspopup="dialog"><Banknote size={14} aria-hidden="true" /> Renew as paid offline</button>
        </div>
      </div>}
      {open === 'offline' && <OfflineRenewal club={club} picked={picked} plans={plans} currency={currency} onClose={() => setOpen(null)} onDone={(msg, ids) => { setOpen(null); onDone(msg, ids); }} />}
      {open === 'email' && <EmailRenewal club={club} picked={picked} onClose={() => setOpen(null)} onDone={(msg) => { setOpen(null); onDone(msg, []); }} />}
    </>
  );
}

function OfflineRenewal({ club, picked, plans, currency, onClose, onDone }: {
  club: { id: string; name: string } & RenewalRule; picked: ClubMember[]; plans: MembershipPlan[]; currency: string;
  onClose: () => void; onDone: (message: string, changedIds: string[]) => void;
}) {
  const planOf = (m: ClubMember) => plans.find(p => p.name === m.membership_tier);
  // Amounts start at each member's plan price
  const [amounts, setAmounts] = useState<Record<string, string>>(() =>
    Object.fromEntries(picked.map(m => [m.id, ((planOf(m)?.price_cents ?? 0) / 100).toFixed(2)])));
  const [method, setMethod] = useState<'cash' | 'bank_transfer' | 'other'>('cash');
  const [paidOn, setPaidOn] = useState(todayIso());
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const cents = picked.map(m => parseMoneyToCents(amounts[m.id] ?? ''));
  const invalid = cents.some(c => c === null);
  const total = cents.reduce<number>((sum, c) => sum + (c ?? 0), 0);

  const save = async () => {
    const db = getSupabaseClient();
    if (!db || invalid || busy) return;
    setBusy(true); setError('');
    const done: string[] = [], failed: string[] = [];
    // One at a time: each is its own payment, so one failing doesn't stop (or undo) the others
    for (const [i, m] of picked.entries()) {
      const plan = planOf(m);
      const { data, error: insertError } = await db.from('payments').insert({
        club_id: club.id, kind: 'membership_renewal', category: 'membership', member_id: m.id, plan_id: plan?.id ?? null,
        description: `${plan?.name || m.membership_tier || 'Membership'} renewal (${m.full_name})${note.trim() ? ` - ${note.trim()}` : ''}`,
        amount_cents: cents[i], currency, method, status: 'pending',
        paid_at: new Date(`${paidOn}T12:00:00`).toISOString(), payer_name: m.full_name, payer_email: m.email || null,
      }).select('id').single();
      // Fulfilment marks it paid and moves the expiry date on (supabase fulfil_payment)
      const fulfilled = data && !insertError ? await db.rpc('fulfil_payment', { p_payment_id: data.id }) : null;
      if (data && fulfilled && !fulfilled.error) done.push(m.id);
      else failed.push(data ? `${m.full_name} (payment saved, but the pass wasn't extended: verify it in Finance)` : m.full_name);
    }
    setBusy(false);
    if (failed.length) { setError(`Not renewed: ${failed.join(', ')}.`); if (!done.length) return; }
    onDone(`${done.length} member${done.length === 1 ? '' : 's'} renewed. Saved in Finance as renewal payments.`, done);
  };

  return (
    <div style={scrim}>
      <PopupPanel onClose={onClose} label="Renew as paid offline" className="glass-panel" style={panel}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Banknote size={20} color="var(--c-green)" aria-hidden="true" />
            <span>Renew {picked.length} member{picked.length === 1 ? '' : 's'} as paid</span>
          </h3>
          <button type="button" aria-label="Close" className="icon-close" onClick={onClose}><X size={20} /></button>
        </div>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0 0 1.25rem' }}>
          They paid the club by cash or bank transfer. Each one is saved in Finance as a renewal payment, and their pass runs for another term. Nobody is emailed.
        </p>

        <div style={rowsBox}>
          {picked.map(m => {
            const plan = planOf(m);
            const ends = m.membership_expires_at?.slice(0, 10);
            const lapsed = !!ends && ends < todayIso();
            return (
              <div key={m.id} style={{ ...row, borderTop: m === picked[0] ? 0 : row.borderTop }}>
                <div style={{ flex: '1 1 160px', minWidth: 0 }}>
                  <strong style={{ display: 'block', overflowWrap: 'anywhere' }}>{m.full_name}</strong>
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>{plan?.name || m.membership_tier || 'No plan'}</span>
                </div>
                <div style={{ flex: '1 1 180px', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  {ends ? `${lapsed ? 'Ran out ' : ''}${formatDate(ends)}` : 'No expiry yet'} → <strong style={{ color: 'var(--c-green)' }}>{formatDate(renewedUntil(m, club, plan?.duration_months ?? 12))}</strong>
                </div>
                <input inputMode="decimal" aria-label={`Amount paid by ${m.full_name} (${currency})`} value={amounts[m.id] ?? ''}
                  onChange={e => setAmounts(prev => ({ ...prev, [m.id]: e.target.value }))}
                  style={{ ...field, width: '92px', textAlign: 'right', padding: '0.4rem 0.5rem' }} />
              </div>
            );
          })}
          <div style={{ ...row, justifyContent: 'space-between', fontWeight: 800, background: 'rgba(var(--shade-rgb), 0.2)' }}>
            <span>Total received</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatMoney(total, currency)}</span>
          </div>
        </div>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '-0.3rem 0 0.9rem' }}>
          Amounts start at each member&apos;s plan price. Early renewals keep their remaining days. A pass that has already run out starts again from today.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', marginBottom: '0.9rem' }}>
          <div>
            <label htmlFor="bulk-renew-method" style={label}>Paid by</label>
            <select id="bulk-renew-method" value={method} onChange={e => setMethod(e.target.value as typeof method)} style={field}>
              <option value="cash">Cash</option>
              <option value="bank_transfer">Bank transfer</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label htmlFor="bulk-renew-date" style={label}>Date received</label>
            <input id="bulk-renew-date" type="date" value={paidOn} max={todayIso()} onChange={e => setPaidOn(e.target.value || todayIso())} style={field} />
          </div>
        </div>
        <div style={{ marginBottom: '1.25rem' }}>
          <label htmlFor="bulk-renew-note" style={label}>Note (optional)</label>
          <input id="bulk-renew-note" value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Paid at training, receipt #104" style={field} />
        </div>

        {(invalid || error) && <p role="alert" style={{ color: 'var(--c-red)', fontSize: '0.8rem', margin: '0 0 0.9rem' }}>{error || 'Enter a valid amount for everyone, e.g. 25 or 25.50'}</p>}
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button type="button" onClick={onClose} className="btn btn-secondary btn-sm">Cancel</button>
          <button type="button" onClick={save} disabled={busy || invalid} className="btn btn-primary btn-sm">
            {busy ? 'Saving…' : `Renew ${picked.length} member${picked.length === 1 ? '' : 's'} (${formatMoney(total, currency)})`}
          </button>
        </div>
      </PopupPanel>
    </div>
  );
}

function EmailRenewal({ club, picked, onClose, onDone }: {
  club: { id: string; name: string }; picked: ClubMember[]; onClose: () => void; onDone: (message: string) => void;
}) {
  // Same rule as the server (lib/email/notices.ts): an address (a parent's for juniors) and an expiry date
  const sendable = picked.filter(m => m.membership_expires_at && memberRecipient(m));
  const skipped = picked.filter(m => !sendable.includes(m));
  const [message, setMessage] = useState('');
  const [preview, setPreview] = useState<{ subject: string; html: string } | null>(null);
  const [busy, setBusy] = useState<'preview' | 'send' | null>(null);
  const [error, setError] = useState('');

  const post = async (send: boolean) => {
    setBusy(send ? 'send' : 'preview'); setError('');
    try {
      const res = await fetch('/api/admin/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await getAccessToken()}` },
        body: JSON.stringify({ clubId: club.id, kind: 'renewal', memberIds: sendable.map(m => m.id), message, send }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error || 'Please try again.'); return; }
      if (!send) { setPreview(data.preview || null); return; }
      const parts = [`${data.sent ?? 0} renewal email${data.sent === 1 ? '' : 's'} sent.`];
      if (data.alreadySent) parts.push(`${data.alreadySent} already had one today.`);
      if (data.optedOut) parts.push(`${data.optedOut} unsubscribed.`);
      if (data.failed) parts.push(`${data.failed} failed.`);
      onDone(parts.join(' '));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div style={scrim}>
      <PopupPanel onClose={onClose} label="Email renewal notice" className="glass-panel" style={panel}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Mail size={20} color="var(--club-ink)" aria-hidden="true" />
            <span>Email a renewal notice to {sendable.length} member{sendable.length === 1 ? '' : 's'}</span>
          </h3>
          <button type="button" aria-label="Close" className="icon-close" onClick={onClose}><X size={20} /></button>
        </div>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0 0 1.25rem' }}>
          Each person gets their own email with their expiry date and a link to renew. They pay online, and their pass moves forward as soon as the payment goes through.
        </p>

        {skipped.length > 0 && (
          <div style={{ fontSize: '0.78rem', padding: '0.55rem 0.75rem', borderRadius: '8px', background: 'var(--color-warn-wash)', border: '1px solid color-mix(in oklab, var(--color-warn) 35%, transparent)', color: 'var(--text-secondary)', marginBottom: '0.9rem' }}>
            <strong style={{ color: 'var(--c-amber)' }}>{skipped.length} skipped:</strong>{' '}
            {skipped.map(m => `${m.full_name} (${m.membership_expires_at ? 'no email address' : 'no expiry date'})`).join(', ')}. Use Renew as paid offline if they pay you in person.
          </div>
        )}

        {sendable.length > 0 && (
          <div style={rowsBox}>
            {sendable.map((m, i) => {
              const r = memberRecipient(m)!;
              const ends = m.membership_expires_at!.slice(0, 10);
              return (
                <div key={m.id} style={{ ...row, borderTop: i ? row.borderTop : 0 }}>
                  <div style={{ flex: '1 1 160px', minWidth: 0 }}>
                    <strong style={{ display: 'block', overflowWrap: 'anywhere' }}>{m.full_name}</strong>
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>{ends < todayIso() ? 'Ran out' : 'Expires'} {formatDate(ends)}</span>
                  </div>
                  <div style={{ flex: '1 1 200px', fontSize: '0.78rem', color: 'var(--text-secondary)', overflowWrap: 'anywhere' }}>
                    {r.childName ? `${r.name || 'Parent / guardian'} (${r.to})` : r.to}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div style={{ marginBottom: '0.9rem' }}>
          <label htmlFor="bulk-renew-message" style={label}>Add a note from the club (optional)</label>
          <textarea id="bulk-renew-message" rows={2} maxLength={1000} value={message} onChange={e => { setMessage(e.target.value); setPreview(null); }} style={field} />
        </div>

        {preview && (
          <div style={{ border: '1px solid var(--border-subtle)', borderRadius: '10px', overflow: 'hidden', marginBottom: '1rem' }}>
            <div style={{ padding: '0.6rem 0.9rem', fontSize: '0.85rem', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
              <strong className="text-primary">Subject:</strong> {preview.subject}
            </div>
            <iframe title="Email preview" sandbox="" srcDoc={preview.html} style={{ width: '100%', height: '420px', border: 0, background: 'var(--color-print-2)', display: 'block' }} />
          </div>
        )}

        {error && <p role="alert" style={{ color: 'var(--c-red)', fontSize: '0.8rem', margin: '0 0 0.9rem' }}>{error}</p>}
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button type="button" onClick={onClose} className="btn btn-secondary btn-sm">Cancel</button>
          {!preview && sendable.length > 0 && (
            <button type="button" onClick={() => post(false)} disabled={!!busy} className="btn btn-secondary btn-sm">{busy === 'preview' ? 'Preparing…' : 'Preview email'}</button>
          )}
          <button type="button" onClick={() => post(true)} disabled={!!busy || !sendable.length} className="btn btn-primary btn-sm">
            {busy === 'send' ? 'Sending…' : `Send ${sendable.length} email${sendable.length === 1 ? '' : 's'}`}
          </button>
        </div>
      </PopupPanel>
    </div>
  );
}
