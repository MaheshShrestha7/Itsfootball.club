'use client';

import React, { useEffect, useState } from 'react';
import { Ticket, Minus, Plus, AlertCircle } from 'lucide-react';
import { getSupabaseClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { formatMoney, paymentReference } from '@/lib/finance';
import { MAX_TICKETS_PER_ORDER, salesOpen } from '@/lib/tickets';
import type { ClubEvent } from '@/lib/supabase/types';
import PaymentStep from '@/components/PaymentStep';

// "Buy tickets" on a paid event's page. The server re-checks everything (lib/payments-server.ts);
// this only keeps buyers from starting an order that can't go through.
export default function EventTickets({ event }: { event: ClubEvent }) {
  const { user } = useAuth();
  const price = event.ticket_price_cents ?? 0;
  const [left, setLeft] = useState<number | null | undefined>(undefined); // null = no limit
  const [currency, setCurrency] = useState('AUD');
  // How tickets can be paid (card, bank transfer); with neither, say so before the buyer fills anything in
  const [pay, setPay] = useState<{ card: boolean; bank: boolean } | undefined>(undefined);
  const [quantity, setQuantity] = useState(1);
  const [buyer, setBuyer] = useState({ name: '', email: '' });
  const [checkout, setCheckout] = useState(false);
  const [cancelled, setCancelled] = useState(false);

  useEffect(() => {
    setCancelled(new URLSearchParams(window.location.search).get('payment') === 'cancelled');
    const client = getSupabaseClient();
    if (!client) { setLeft(null); setPay({ card: true, bank: false }); return; }
    client.rpc('tickets_left', { p_event_id: event.id }).then(({ data }) => setLeft(typeof data === 'number' ? data : null));
    client.from('club_payment_settings').select('currency, stripe_charges_enabled, bank_details').eq('club_id', event.club_id).maybeSingle()
      .then(({ data }) => {
        if (data?.currency) setCurrency(data.currency);
        setPay({ card: Boolean(data?.stripe_charges_enabled), bank: Boolean(data?.bank_details?.trim()) });
      });
  }, [event.id, event.club_id]);

  useEffect(() => {
    // The real name can land a moment after sign-in (it comes from the club's member record), so a name
    // filled from the email ('sue.supporter') gives way to it; anything the buyer typed stays
    if (user) setBuyer(b => ({ name: b.name && b.name !== user.email.split('@')[0] ? b.name : user.full_name || '', email: b.email || user.email || '' }));
  }, [user]);

  if (!(price > 0)) return null;
  const max = Math.min(MAX_TICKETS_PER_ORDER, left ?? MAX_TICKETS_PER_ORDER);
  const open = salesOpen(event);

  return (
    <section aria-labelledby="tickets-heading" className="glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <h2 id="tickets-heading" style={{ fontSize: '1.2rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
          <Ticket size={18} aria-hidden="true" /> Tickets
        </h2>
        <span style={{ fontWeight: 900, fontSize: '1.15rem', color: 'var(--club-ink)' }}>
          {formatMoney(price, currency)} <span style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--text-muted)' }}>each</span>
        </span>
      </div>

      {cancelled && !checkout && (
        <p role="status" style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
          <AlertCircle size={15} aria-hidden="true" /> Payment cancelled. You haven&apos;t been charged.
        </p>
      )}

      {!open ? (
        <p className="text-note" style={{ margin: 0 }}>Ticket sales for this event have closed.</p>
      ) : pay && !pay.card && !pay.bank ? (
        <p className="text-note" style={{ margin: 0 }}>Tickets aren&apos;t on sale online yet. Contact the club to book.</p>
      ) : left === undefined || pay === undefined ? (
        <p className="text-note" style={{ margin: 0 }}>Checking availability…</p>
      ) : left === 0 ? (
        <p style={{ margin: 0, fontWeight: 700 }}>Sold out</p>
      ) : checkout ? (
        <div className="stack stack-sm">
          <button type="button" className="btn btn-secondary btn-sm touch-target" onClick={() => setCheckout(false)} style={{ alignSelf: 'flex-start' }}>Edit order</button>
          {/* Bank transfer: the reference names the buyer and event so the treasurer can match it */}
          <PaymentStep clubId={event.club_id} kind="event_ticket" amountCents={price * quantity} label={`${quantity} × ${event.title}`}
            reference={`${(buyer.name.trim().split(/\s+/).pop() || 'TICKET').toUpperCase().slice(0, 12)} ${paymentReference(event.id).slice(0, 4)}`}
            sentNote={`Your tickets will be emailed to ${buyer.email} once the club checks your transfer.`}
            extra={{ eventId: event.id, quantity: String(quantity), buyerName: buyer.name, buyerEmail: buyer.email }} />
        </div>
      ) : (
        <form onSubmit={e => { e.preventDefault(); setCheckout(true); }} className="stack stack-sm">
          <div className="form-group">
            <span className="form-label" id="ticket-qty-label">Number of tickets</span>
            <div role="group" aria-labelledby="ticket-qty-label" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <button type="button" className="btn btn-secondary btn-sm touch-target" onClick={() => setQuantity(q => Math.max(1, q - 1))} disabled={quantity <= 1} aria-label="One fewer ticket">
                <Minus size={14} aria-hidden="true" />
              </button>
              <output aria-live="polite" style={{ minWidth: '2ch', textAlign: 'center', fontWeight: 800, fontSize: '1.1rem' }}>{quantity}</output>
              <button type="button" className="btn btn-secondary btn-sm touch-target" onClick={() => setQuantity(q => Math.min(max, q + 1))} disabled={quantity >= max} aria-label="One more ticket">
                <Plus size={14} aria-hidden="true" />
              </button>
              {left !== null && left <= 20 && <span className="text-note">{left} left</span>}
            </div>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="ticket-name">Your name *</label>
            <input id="ticket-name" className="form-input" required maxLength={120} autoComplete="name" value={buyer.name} onChange={e => setBuyer({ ...buyer, name: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="ticket-email">Email *</label>
            <input id="ticket-email" className="form-input" type="email" required autoComplete="email" autoCapitalize="none" spellCheck={false} value={buyer.email} onChange={e => setBuyer({ ...buyer, email: e.target.value })} />
          </div>
          <p className="text-note" style={{ margin: 0 }}>
            {pay?.card ? 'Pay by card and your tickets arrive by email and on screen straight away.' : ''}
            {pay?.card && pay?.bank ? ' ' : ''}
            {pay?.bank ? 'Paying by bank transfer? Your tickets are emailed once the club checks your receipt.' : ''}
          </p>
          <button type="submit" className="btn btn-primary" style={{ whiteSpace: 'normal' }}>Continue to payment · {formatMoney(price * quantity, currency)}</button>
        </form>
      )}
    </section>
  );
}
