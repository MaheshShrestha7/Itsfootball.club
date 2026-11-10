'use client';

import React, { useState } from 'react';
import { timeAgo, weekHeading, weekStrip } from '@/lib/mission-control';
import type { PlatformMetrics, PlatformRecentActivity } from '@/lib/supabase/types';
import { ChevronLeft, ChevronRight } from 'lucide-react';

// The two parts of the old Cockpit page worth keeping, now on the Overview: new members day by day
// for a week, and the live feed of sign-ups, payments, new clubs and gate scans (get_platform_metrics).

const FEED: { id: 'all' | PlatformRecentActivity['type']; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'member_signup', label: 'Sign-ups' },
  { id: 'payment_received', label: 'Payments' },
  { id: 'club_created', label: 'New clubs' },
  { id: 'gate_scan', label: 'Gate scans' },
];
const KIND_WORD: Record<PlatformRecentActivity['type'], string> = {
  member_signup: 'Sign-up', payment_received: 'Payment', club_created: 'New club', gate_scan: 'Gate scan',
};

export default function OverviewPulse({ metrics, periodDays }: { metrics: PlatformMetrics | null; periodDays: number }) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [feed, setFeed] = useState<(typeof FEED)[number]['id']>('all');
  const week = weekStrip(metrics?.daily_trends || [], new Date(), weekOffset);
  const activity = (metrics?.recent_activity || []).filter(a => feed === 'all' || a.type === feed);
  const tooFarBack = weekOffset < -Math.floor(periodDays / 7);

  return (
    <>
      <section className="mc-card wide" aria-labelledby="mc-week-h">
        <div className="mc-card-h">
          <h2 id="mc-week-h">New members, {weekHeading(week)}</h2>
          <span className="mc-week-nav">
            <button type="button" className="mc-icon-btn" onClick={() => setWeekOffset(w => w - 1)} aria-label="Previous week"><ChevronLeft size={14} /></button>
            <button type="button" className="mc-icon-btn" onClick={() => setWeekOffset(w => Math.min(0, w + 1))} disabled={weekOffset >= 0} aria-label="Next week"><ChevronRight size={14} /></button>
          </span>
        </div>
        {!metrics ? <div className="mc-empty">Loading…</div> : (
          <div className="mc-week2">
            {week.map(d => (
              <div key={d.date} className={`mc-day2${d.isToday ? ' is-today' : ''}${d.future ? ' future' : ''}`}>
                <small>{d.label}</small>
                <b className="num">{d.day}</b>
                <em className="num">{d.future ? ' ' : d.members > 0 ? `+${d.members}` : '0'}</em>
              </div>
            ))}
          </div>
        )}
        {tooFarBack && <p className="mc-muted" style={{ marginTop: 10 }}>Pick a longer time range to see numbers this far back.</p>}
      </section>

      <section className="mc-card" aria-labelledby="mc-live-h">
        <div className="mc-card-h"><h2 id="mc-live-h">Live activity</h2></div>
        <div className="mc-chips" role="group" aria-label="Show">
          {FEED.map(f => (
            <button key={f.id} type="button" className="mc-chip" aria-pressed={feed === f.id} onClick={() => setFeed(f.id)}>{f.label}</button>
          ))}
        </div>
        <div className="mc-feed">
          {!metrics && <p className="mc-muted">Loading…</p>}
          {metrics && activity.length === 0 && <p className="mc-muted">Nothing here yet.</p>}
          {activity.slice(0, 8).map((a, i) => (
            <div key={`${a.created_at}-${i}`} className="mc-feed-row">
              <div>
                <b>{a.title}</b>{a.subtitle ? <>, {a.subtitle}</> : null}
                <time dateTime={a.created_at}>{KIND_WORD[a.type] || 'Event'}, {timeAgo(a.created_at)}</time>
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
