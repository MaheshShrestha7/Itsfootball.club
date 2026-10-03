'use client';

import React, { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';
import { ArrowLeft, Calendar, MapPin, Ticket, Loader2, AlertCircle } from 'lucide-react';
import { useClub } from '@/lib/club-context';
import LocalTime from '@/components/LocalTime';

interface Order {
  status: string;
  buyer: string | null;
  event: { id: string; title: string; start_time: string; location: string } | null;
  tickets: { code: string; status: 'registered' | 'checked_in' | 'cancelled' }[];
}

const POLL_MS = 3000;
const MAX_POLLS = 20; // about a minute: Stripe usually confirms within seconds

export default function TicketsPage({ params }: { params: Promise<{ clubSlug: string; orderId: string }> }) {
  const { clubSlug, orderId } = use(params);
  const { clubs, selectClubBySlug } = useClub();
  const club = selectClubBySlug(clubSlug) || clubs[0];
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [gaveUp, setGaveUp] = useState(false);

  // Right after checkout the webhook may not have landed yet: keep asking while the order is pending
  useEffect(() => {
    let polls = 0;
    let timer: ReturnType<typeof setTimeout>;
    let stopped = false;
    const load = async () => {
      try {
        const res = await fetch(`/api/tickets/${encodeURIComponent(orderId)}`, { cache: 'no-store' });
        const json = await res.json();
        if (stopped) return;
        if (!res.ok) return setError(json.error || 'Could not load your tickets.');
        setOrder(json);
        if (json.status === 'pending' && ++polls < MAX_POLLS) timer = setTimeout(load, POLL_MS);
        else if (json.status === 'pending') setGaveUp(true);
      } catch {
        if (!stopped) setError('Could not load your tickets. Check your connection and refresh.');
      }
    };
    load();
    return () => { stopped = true; clearTimeout(timer); };
  }, [orderId]);

  const panel = (children: React.ReactNode) => (
    <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center' }}>{children}</div>
  );

  let body: React.ReactNode;
  if (error) {
    body = panel(<><AlertCircle size={32} color="var(--c-red)" aria-hidden="true" /><p role="alert" style={{ marginTop: '0.75rem' }}>{error}</p></>);
  } else if (!order) {
    body = panel(<p className="text-note" role="status">Loading your tickets…</p>);
  } else if (order.status === 'pending') {
    body = panel(
      gaveUp ? (
        <p role="status">Your payment is still being confirmed. We&apos;ll email your tickets as soon as it is, or refresh this page in a minute.</p>
      ) : (
        <p role="status" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', justifyContent: 'center', margin: 0 }}>
          <Loader2 size={18} className="spin" aria-hidden="true" /> Confirming your payment…
        </p>
      )
    );
  } else if (order.status !== 'paid') {
    body = panel(
      <p role="status">
        {order.status === 'refunded' ? 'This order was refunded, so its tickets are no longer valid.' : 'This order wasn’t paid, so it has no tickets.'}
        {order.event && <> <Link href={`/${club.slug}/events/${order.event.id}`} style={{ color: 'var(--club-primary)', fontWeight: 700 }}>Back to the event</Link></>}
      </p>
    );
  } else {
    body = (
      <>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
          Show {order.tickets.length === 1 ? 'this QR code' : 'one QR code per person'} at the door. Each ticket can be scanned once.
          We&apos;ve also emailed this page to you; keep the link private, as anyone with it can use your tickets.
        </p>
        <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 240px), 1fr))', gap: '1rem' }}>
          {order.tickets.map((t, i) => (
            <li key={t.code} className="glass-panel" style={{ padding: '1.25rem', textAlign: 'center', opacity: t.status === 'registered' ? 1 : 0.6 }}>
              <div style={{ fontWeight: 800, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
                <Ticket size={16} aria-hidden="true" /> Ticket {i + 1} of {order.tickets.length}
              </div>
              {/* White quiet zone so phone screens scan reliably in dark mode too */}
              <div style={{ background: '#FFFFFF', padding: '12px', borderRadius: '12px', display: 'inline-block' }}>
                <QRCodeSVG value={t.code} size={184} level="M" role="img" aria-label={`QR code for ticket ${i + 1}`} />
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.6rem', wordBreak: 'break-all' }}>
                {t.code}
              </div>
              {t.status !== 'registered' && (
                <div className="badge" style={{ marginTop: '0.6rem' }}>{t.status === 'checked_in' ? 'Used' : 'Cancelled'}</div>
              )}
            </li>
          ))}
        </ol>
      </>
    );
  }

  return (
    <div style={{ minHeight: '85vh', padding: '3rem 0 5rem 0' }}>
      <div className="container" style={{ maxWidth: '860px' }}>
        <Link href={`/${club.slug}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
          <ArrowLeft size={16} aria-hidden="true" /> Back to {club.name}
        </Link>
        <h1 style={{ fontSize: 'clamp(1.75rem, 4vw, 2.4rem)', fontWeight: 900, marginBottom: '0.5rem' }}>
          {order?.event?.title ? `Your tickets: ${order.event.title}` : 'Your tickets'}
        </h1>
        {order?.event && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem 1.25rem', color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
            <span style={{ display: 'inline-flex', gap: '0.35rem', alignItems: 'center' }}>
              <Calendar size={15} aria-hidden="true" />
              <LocalTime value={order.event.start_time} format="both" options={{ weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }} />
            </span>
            <span style={{ display: 'inline-flex', gap: '0.35rem', alignItems: 'center' }}>
              <MapPin size={15} aria-hidden="true" /> {order.event.location}
            </span>
          </div>
        )}
        {body}
      </div>
    </div>
  );
}
