'use client';

import React, { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AlertCircle, ArrowLeft, CheckCircle2, Clock, Loader2 } from 'lucide-react';
import { useClub } from '@/lib/club-context';
import { DATE_LOCALE } from '@/lib/dates';
import { formatMoney, paymentReference } from '@/lib/finance';
import PaymentStep from '@/components/PaymentStep';

interface Bill {
  clubId: string;
  kind: 'fee_request' | 'sponsorship';
  status: string;
  title: string;
  forName: string | null;
  amountCents: number;
  currency: string;
  dueOn: string | null;
}

const POLL_MS = 3000;
const MAX_POLLS = 20; // about a minute: Stripe usually confirms within seconds

const longDate = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString(DATE_LOCALE, { day: 'numeric', month: 'long', year: 'numeric' });

// The link in a fee request email: no account needed, the unguessable id is the key
export default function PayPage({ params }: { params: Promise<{ clubSlug: string; paymentId: string }> }) {
  const { clubSlug, paymentId } = use(params);
  const { clubs, selectClubBySlug } = useClub();
  const club = selectClubBySlug(clubSlug) || clubs[0];
  const backFromCard = useSearchParams().get('payment') === 'success';
  const [bill, setBill] = useState<Bill | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [gaveUp, setGaveUp] = useState(false);

  // Right after checkout the webhook may not have landed yet: keep asking while it's unpaid
  useEffect(() => {
    let polls = 0;
    let timer: ReturnType<typeof setTimeout>;
    let stopped = false;
    const load = async () => {
      try {
        const res = await fetch(`/api/payments/fee-requests/${encodeURIComponent(paymentId)}`, { cache: 'no-store' });
        const json = await res.json();
        if (stopped) return;
        if (!res.ok) return setError(json.error || 'Could not load this payment.');
        setBill(json);
        if (!backFromCard || json.status !== 'pending') return;
        if (++polls < MAX_POLLS) timer = setTimeout(load, POLL_MS);
        else setGaveUp(true);
      } catch {
        if (!stopped) setError('Could not load this payment. Check your connection and refresh.');
      }
    };
    load();
    return () => { stopped = true; clearTimeout(timer); };
  }, [paymentId, backFromCard]);

  const panel = (children: React.ReactNode) => (
    <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center' }}>{children}</div>
  );

  // The id only opens a bill from the club whose address it's on
  const wrongClub = !!bill && !!club && bill.clubId !== club.id;
  let body: React.ReactNode;
  if (error || wrongClub) {
    body = panel(<><AlertCircle size={32} color="var(--c-red)" aria-hidden="true" /><p role="alert" style={{ marginTop: '0.75rem' }}>{error || 'We couldn’t find this payment. Check the link, or ask the club.'}</p></>);
  } else if (!bill) {
    body = panel(<p className="text-note" role="status">Loading…</p>);
  } else if (bill.status === 'paid') {
    body = panel(<><CheckCircle2 size={32} color="var(--c-green)" aria-hidden="true" /><p role="status" style={{ marginTop: '0.75rem', fontWeight: 800 }}>Paid, thank you.</p><p className="text-note">{club.name} has received this payment.</p></>);
  } else if (bill.status === 'awaiting_review') {
    body = panel(<><Clock size={32} color="var(--c-amber)" aria-hidden="true" /><p role="status" style={{ marginTop: '0.75rem', fontWeight: 800 }}>Your receipt is with the club.</p><p className="text-note">The treasurer will check the transfer. There is nothing more to pay for now.</p></>);
  } else if (bill.status !== 'pending') {
    body = panel(<p role="status">{bill.status === 'refunded' ? 'This payment was refunded.' : 'This is no longer due, so there is nothing to pay.'} Please contact the club if you have a question.</p>);
  } else if (backFromCard) {
    body = panel(
      gaveUp ? (
        <p role="status">Your payment is still being confirmed. Refresh this page in a minute. Please don&apos;t pay again.</p>
      ) : (
        <p role="status" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', justifyContent: 'center', margin: 0 }}>
          <Loader2 size={18} className="spin" aria-hidden="true" /> Confirming your payment…
        </p>
      )
    );
  } else {
    body = (
      <PaymentStep
        clubId={bill.clubId}
        kind={bill.kind}
        amountCents={bill.amountCents}
        label={bill.title}
        extra={{ paymentId }}
        reference={paymentReference(paymentId)}
      />
    );
  }

  return (
    <div style={{ minHeight: '85vh', padding: '3rem 0 5rem 0' }}>
      <div className="container" style={{ maxWidth: '560px' }}>
        <Link href={`/${club.slug}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
          <ArrowLeft size={16} aria-hidden="true" /> Back to {club.name}
        </Link>
        <h1 style={{ fontSize: 'clamp(1.6rem, 4vw, 2.2rem)', fontWeight: 900, marginBottom: '0.5rem' }}>{bill?.title && !wrongClub ? bill.title : `Pay ${club.name}`}</h1>
        {bill && !wrongClub && (
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
            {bill.forName && <>For {bill.forName}. </>}
            {formatMoney(bill.amountCents, bill.currency)}{bill.dueOn && bill.status === 'pending' ? `, due ${longDate(bill.dueOn)}` : ''}.
          </p>
        )}
        {body}
      </div>
    </div>
  );
}
