'use client';

import React, { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { CalendarDays, MapPin, Ticket } from 'lucide-react';
import { useClub } from '@/lib/club-context';
import { getSupabaseClient } from '@/lib/supabase/client';
import { formatMoney } from '@/lib/finance';
import { groupByMonth, isPastEvent } from '@/lib/club-lists';
import { useUrlTab } from '@/lib/use-url-tab';
import type { ClubEvent } from '@/lib/supabase/types';
import LocalTime from '@/components/LocalTime';
import MyTickets from '@/components/MyTickets';
import ClubSubPage, { EmptyState, ListSkeleton, MonthGroup, UpcomingPastTabs } from '@/components/ClubSubPage';

const WHEN: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' };
const CATEGORY: Record<string, string> = { social: 'Social', training: 'Training', agm: 'AGM', trial: 'Trials', tournament: 'Tournament', match: 'Matchday' };
const VIEWS = ['upcoming', 'past'] as const;
const PAGE = 20;

/** /club/events: Upcoming (prices, tickets) | Past (what the club has run), ?view=past in the URL */
export default function ClubEventsPage({ params }: { params: Promise<{ clubSlug: string }> }) {
  const { clubSlug } = use(params);
  const { clubs, selectClubBySlug, events, isHydrated } = useClub();
  const club = selectClubBySlug(clubSlug) || clubs[0];
  const [view, setView] = useUrlTab(VIEWS, 'view');
  const [shown, setShown] = useState(PAGE);
  const [currency, setCurrency] = useState('AUD');
  useEffect(() => {
    getSupabaseClient()?.from('club_payment_settings').select('currency').eq('club_id', club.id).maybeSingle()
      .then(({ data }) => data?.currency && setCurrency(data.currency));
  }, [club.id]);

  const clubEvents = events.filter(e => e.club_id === club.id && e.is_public);
  const upcoming = clubEvents.filter(e => !isPastEvent(e)).sort((a, b) => a.start_time.localeCompare(b.start_time));
  const past = clubEvents.filter(e => isPastEvent(e)).sort((a, b) => b.start_time.localeCompare(a.start_time));
  const list = view === 'upcoming' ? upcoming : past.slice(0, shown);

  const card = (e: ClubEvent) => {
    const price = e.ticket_price_cents ?? 0;
    const isPast = view === 'past';
    return (
      <Link key={e.id} href={`/${club.slug}/events/${e.id}`} className="glass-panel glass-panel-interactive events-list-item">
        <div style={{ minWidth: 0 }}>
          <span className="badge" style={{ fontSize: '0.68rem', marginBottom: '0.35rem' }}>{CATEGORY[e.category] || 'Event'}</span>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>{e.title}</h2>
          <div className="text-meta" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem 0.9rem', marginTop: '0.3rem' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}><CalendarDays size={14} aria-hidden="true" /><LocalTime value={e.start_time} format="both" options={WHEN} /></span>
            {e.location && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}><MapPin size={14} aria-hidden="true" />{e.location}</span>}
          </div>
        </div>
        <div className="events-list-cta">
          {isPast ? (
            <span className="btn btn-sm btn-secondary">View</span>
          ) : (
            <>
              <strong style={{ color: price > 0 ? 'var(--club-ink)' : 'var(--text-secondary)' }}>{price > 0 ? formatMoney(price, currency) : 'Free'}</strong>
              <span className={`btn btn-sm ${price > 0 ? 'btn-primary' : 'btn-secondary'}`}>{price > 0 ? <><Ticket size={15} /> Get tickets</> : 'Details'}</span>
            </>
          )}
        </div>
      </Link>
    );
  };

  return (
    <ClubSubPage club={club} title="Events & tickets" width={900} intro={`What's on at ${club.name}. Paid events sell tickets on their page.`}>
      <MyTickets clubId={club.id} clubSlug={club.slug} />

      <div className="club-toolbar">
        <UpcomingPastTabs view={view} onView={v => { setView(v); setShown(PAGE); }} upcoming={upcoming.length} past={past.length} />
      </div>

      {!isHydrated ? (
        <ListSkeleton label="Loading events" height={88} />
      ) : list.length === 0 ? (
        view === 'upcoming' ? (
          <EmptyState title="No events coming up right now"
            action={past.length > 0 ? <button type="button" className="btn btn-secondary btn-sm" onClick={() => setView('past')}>See past events</button> : undefined}>
            Check back soon: socials, trials and club days are listed here.
          </EmptyState>
        ) : (
          <EmptyState title="No past events yet" />
        )
      ) : (
        <div>
          {groupByMonth(list, e => e.start_time).map(g => <MonthGroup key={g.key || 'tbc'} label={g.label}>{g.items.map(card)}</MonthGroup>)}
        </div>
      )}

      {view === 'past' && past.length > shown && (
        <button type="button" className="btn btn-secondary" style={{ marginTop: '1.5rem' }} onClick={() => setShown(n => n + PAGE)}>
          Show older events
        </button>
      )}
    </ClubSubPage>
  );
}
