'use client';

import React, { useEffect, useState } from 'react';
import { CreditCard, Landmark, Upload, CheckCircle2, AlertCircle } from 'lucide-react';
import { getAccessToken, getSupabaseClient } from '@/lib/supabase/client';
import { bookingFeeCents, formatMoney, paymentReference } from '@/lib/finance';
import type { ClubPaymentSettings } from '@/lib/supabase/types';

interface PaymentStepProps {
  clubId: string;
  kind: 'membership_signup' | 'membership_renewal' | 'sponsorship' | 'shop_order' | 'event_ticket';
  memberId?: string;
  sponsorId?: string;
  planId?: string;
  packageId?: string;
  amountCents: number;
  label: string;
  /** Extra fields for the payment routes (shop: items; tickets: eventId, quantity; both: buyerName, buyerEmail) */
  extra?: Record<string, string>;
  /** Card only, no bank transfer (shop orders, tickets) */
  cardOnly?: boolean;
}

// Pay by card (hosted Stripe Checkout on the club's account) or by bank transfer with a receipt.
// Used by membership sign-up, renewal, sponsorship sign-up, the club shop and event tickets.

// Renewals are checked against the signed-in member's session (lib/payments-server.ts)
async function authHeaders(base: Record<string, string> = {}) {
  const token = await getAccessToken();
  return token ? { ...base, Authorization: `Bearer ${token}` } : base;
}
export default function PaymentStep(props: PaymentStepProps) {
  const { clubId, kind, memberId, sponsorId, planId, packageId, amountCents, label, extra, cardOnly } = props;
  const [settings, setSettings] = useState<ClubPaymentSettings | null | undefined>(undefined);
  // Card only: nothing to choose, so go straight to the pay button
  const [method, setMethod] = useState<'card' | 'bank' | null>(cardOnly ? 'card' : null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const reference = paymentReference(memberId || sponsorId || '');
  const [payerRef, setPayerRef] = useState(reference);

  useEffect(() => {
    const client = getSupabaseClient();
    if (!client) return setSettings(null);
    client.from('club_payment_settings').select('*').eq('club_id', clubId).maybeSingle()
      .then(({ data }) => setSettings(data ?? null));
  }, [clubId]);

  const ids = { ...extra, clubId, kind, memberId, sponsorId, planId, packageId };
  const currency = settings?.currency || 'AUD';
  const cardOn = Boolean(settings?.stripe_charges_enabled);
  const bankOn = !cardOnly && Boolean(settings?.bank_details?.trim());
  const fee = bookingFeeCents(amountCents);

  const payByCard = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/payments/checkout', {
        method: 'POST',
        headers: await authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(ids),
      });
      const json = await res.json();
      if (!res.ok || !json.url) throw new Error(json.error || 'Card payment could not be started.');
      window.location.href = json.url;
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  const sendReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return setError('Attach a photo or PDF of your transfer receipt.');
    setBusy(true);
    setError(null);
    const form = new FormData();
    Object.entries(ids).forEach(([k, v]) => v && form.append(k, v));
    form.append('reference', payerRef);
    form.append('receipt', file);
    try {
      const res = await fetch('/api/payments/bank-transfer', { method: 'POST', headers: await authHeaders(), body: form });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Could not send your receipt.');
      setSent(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <div className="glass-panel" style={{ padding: '1.25rem', textAlign: 'center' }}>
        <CheckCircle2 size={28} color="var(--c-green)" style={{ marginBottom: '0.5rem' }} />
        <div style={{ fontWeight: 800, color: 'var(--text-primary)' }}>Receipt sent</div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '0.35rem 0 0' }}>
          The club treasurer will check the transfer and confirm your payment.
        </p>
      </div>
    );
  }

  return (
    <div className="glass-panel" style={{ padding: '1.25rem', textAlign: 'left' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '1rem', marginBottom: '1rem' }}>
        <div style={{ fontWeight: 800, color: 'var(--text-primary)' }}>{label}</div>
        <div style={{ fontWeight: 900, fontSize: '1.25rem', color: 'var(--club-primary)' }}>{formatMoney(amountCents, currency)}</div>
      </div>

      {settings === undefined ? (
        <p className="text-note">Loading payment options…</p>
      ) : !cardOn && !bankOn ? (
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
          {cardOnly
            ? 'Card payments aren’t set up for this club yet, so orders can’t be paid online.'
            : 'Online payment isn’t set up for this club yet. The club will be in touch about payment.'}
        </p>
      ) : (
        <>
          {!cardOnly && (
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
              {cardOn && (
                <button type="button" className={`btn ${method === 'card' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setMethod('card')} aria-pressed={method === 'card'}>
                  <CreditCard size={16} /> Pay by card
                </button>
              )}
              {bankOn && (
                <button type="button" className={`btn ${method === 'bank' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setMethod('bank')} aria-pressed={method === 'bank'}>
                  <Landmark size={16} /> Bank transfer
                </button>
              )}
            </div>
          )}

          {method === 'card' && (
            <>
              {fee > 0 && (
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '0 0 0.75rem' }}>
                  {formatMoney(amountCents, currency)} to the club + {formatMoney(fee, currency)} booking fee. The club&apos;s price stays the same;
                  the small booking fee is what keeps itsfootball.club free for every club.
                </p>
              )}
              <button type="button" className="btn btn-primary w-full" onClick={payByCard} disabled={busy}>
                {busy ? 'Opening secure checkout…' : `Pay ${formatMoney(amountCents + fee, currency)} securely`}
              </button>
              {/* Wallets come from the Stripe payment method settings; Stripe shows them only on supported devices */}
              <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', textAlign: 'center', margin: '0.5rem 0 0' }}>
                Card, Apple Pay or Google Pay on the next screen
              </p>
            </>
          )}

          {method === 'bank' && (
            <form onSubmit={sendReceipt} className="stack stack-sm">
              <div style={{ background: 'rgba(var(--shade-rgb), 0.35)', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '0.75rem', fontSize: '0.85rem', whiteSpace: 'pre-wrap', color: 'var(--text-secondary)' }}>
                {settings?.bank_details}
                {'\n\n'}Amount: <strong className="text-primary">{formatMoney(amountCents, currency)}</strong>
                {'\n'}Reference: <strong style={{ color: 'var(--c-amber)' }}>{reference}</strong>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="payment-reference">Reference you used</label>
                <input id="payment-reference" className="form-input" value={payerRef} maxLength={64} onChange={e => setPayerRef(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="payment-receipt">Receipt (photo or PDF, max 5 MB)</label>
                <input id="payment-receipt" className="form-input" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" required
                  onChange={e => setFile(e.target.files?.[0] ?? null)} />
              </div>
              <button type="submit" className="btn btn-primary" disabled={busy}>
                <Upload size={16} /> {busy ? 'Sending…' : 'Send receipt'}
              </button>
            </form>
          )}
        </>
      )}

      {error && (
        <p role="alert" style={{ color: 'var(--c-red)', fontSize: '0.85rem', marginTop: '0.75rem', display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
          <AlertCircle size={15} /> {error}
        </p>
      )}

      {(cardOn || bankOn) && (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', lineHeight: 1.5, marginTop: '1rem', marginBottom: 0 }}>
          {cardOn && (
            <>
              Card payments are processed securely by Stripe on the club&apos;s behalf and paid directly to the club{fee > 0 && ', apart from the booking fee'}.
              Your card details go straight to Stripe and are never seen or stored by the club or itsfootball.club
              (<a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'underline' }}>Stripe Privacy Policy</a>).{' '}
            </>
          )}
          {bankOn && 'Bank transfer receipts are stored privately and can only be viewed by the club’s administrators.'}
        </p>
      )}
    </div>
  );
}
