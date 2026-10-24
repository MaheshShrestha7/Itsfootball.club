'use client';

import React, { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CalendarDays, MapPin, Ticket } from 'lucide-react';
import { useClub } from '@/lib/club-context';
import { getSupabaseClient } from '@/lib/supabase/client';
import { formatMoney } from '@/lib/finance';
import LocalTime from '@/components/LocalTime';
import MyTickets from '@/components/MyTickets';

const WHEN: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' };
const CATEGORY: Record<string, string> = { social: 'Social', training: 'Training', agm: 'AGM', trial: 'Trials', tournament: 'Tournament', match: 'Matchday' };

/** /club/events: what's coming up, with prices and a way to get tickets (the home page has a short list) */
export default function ClubEventsPage({ params }: { params: Promise<{ clubSlug: string }> }) {
  const { clubSlug } = use(params);
  const { clubs, selectClubBySlug, events, isHydrated } = useClub();
  const club = selectClubBySlug(clubSlug) || clubs[0];
  const [currency, setCurrency] = useState('AUD');
  useEffect(() => {
    getSupabaseClient()?.from('club_payment_settings').select('currency').eq('club_id', club.id).maybeSingle()
      .then(({ data }) => data?.currency && setCurrency(data.currency));
  }, [club.id]);

  const now = Date.now();
  const upcoming = events
    .filter(e => e.club_id === club.id && e.is_public && new Date(e.end_time || e.start_time).getTime() >= now)
    .sort((a, b) => a.start_time.localeCompare(b.start_time));

  return (
    <div style={{ minHeight: '85vh', padding: '3rem 0 5rem 0' }}>
      <div className="container" style={{ maxWidth: '860px' }}>
        <Link href={`/${club.slug}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
          <ArrowLeft size={16} /> Back to {club.name}
        </Link>
        <h1 style={{ fontSize: 'clamp(1.8rem, 5vw, 2.4rem)', fontWeight: 900, marginBottom: '0.4rem' }}>Events &amp; tickets</h1>
        <p className="text-body" style={{ marginBottom: '1.75rem' }}>What&apos;s on at {club.name}. Paid events sell tickets on their page.</p>

        <MyTickets clubId={club.id} clubSlug={club.slug} />

        {upcoming.length === 0 ? (
          <p className="glass-panel text-note" style={{ padding: '1.25rem' }}>{isHydrated ? 'No events coming up right now. Check back soon.' : 'Loading events…'}</p>
        ) : (
          <div className="events-list">
            {upcoming.map(e => {
              const price = e.ticket_price_cents ?? 0;
              return (
                <Link key={e.id} href={`/${club.slug}/events/${e.id}`} className="glass-panel events-list-item">
                  <div style={{ minWidth: 0 }}>
                    <span className="badge" style={{ fontSize: '0.68rem', marginBottom: '0.35rem' }}>{CATEGORY[e.category] || 'Event'}</span>
                    <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>{e.title}</h2>
                    <div className="text-meta" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem 0.9rem', marginTop: '0.3rem' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}><CalendarDays size={14} aria-hidden="true" /><LocalTime value={e.start_time} format="both" options={WHEN} /></span>
                      {e.location && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}><MapPin size={14} aria-hidden="true" />{e.location}</span>}
                    </div>
                  </div>
                  <div className="events-list-cta">
                    <strong style={{ color: price > 0 ? 'var(--club-ink)' : 'var(--text-secondary)' }}>{price > 0 ? formatMoney(price, currency) : 'Free'}</strong>
                    <span className={`btn btn-sm ${price > 0 ? 'btn-primary' : 'btn-secondary'}`}>{price > 0 ? <><Ticket size={15} /> Get tickets</> : 'Details'}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
