'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Ticket, Clock } from 'lucide-react';
import { getSupabaseClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import LocalTime from '@/components/LocalTime';

interface Order { id: string; event_id: string; event_title: string; start_time: string; quantity: number; status: 'paid' | 'awaiting_review' }

const WHEN: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' };

/** The signed-in person's ticket orders at this club (my_ticket_orders: bought with their sign-in email).
 *  Nothing at all when they have none, so it can sit on any page. */
export default function MyTickets({ clubId, clubSlug }: { clubId: string; clubSlug: string }) {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  useEffect(() => {
    const db = getSupabaseClient();
    if (!db || !user) return setOrders([]);
    db.rpc('my_ticket_orders', { p_club_id: clubId }).then(({ data, error }) => setOrders(!error && Array.isArray(data) ? data as Order[] : []));
  }, [clubId, user]);

  // Coming up only, soonest first (an event stays listed until a few hours after it starts)
  const now = Date.now();
  const upcoming = orders.filter(o => new Date(o.start_time).getTime() >= now - 6 * 3600000).sort((a, b) => a.start_time.localeCompare(b.start_time));
  if (!upcoming.length) return null;

  return (
    <section aria-labelledby="my-tickets-heading" style={{ marginBottom: '1.5rem' }}>
      <h2 id="my-tickets-heading" className="app-heading">My tickets</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        {upcoming.map(o => (
          <div key={o.id} className="glass-panel" style={{ padding: '0.85rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <Ticket size={20} aria-hidden="true" style={{ color: 'var(--club-ink)', flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 180 }}>
              <div style={{ fontWeight: 800, color: 'var(--text-primary)' }}>{o.quantity} × {o.event_title}</div>
              <div className="text-meta"><LocalTime value={o.start_time} format="both" options={WHEN} /></div>
            </div>
            {o.status === 'paid' ? (
              <Link href={`/${clubSlug}/tickets/${o.id}`} className="btn btn-primary btn-sm">Show tickets</Link>
            ) : (
              <span className="text-meta" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                <Clock size={14} aria-hidden="true" /> Waiting for the club to check your transfer
              </span>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
