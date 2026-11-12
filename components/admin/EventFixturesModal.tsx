'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Link2, Plus, Unlink, X } from 'lucide-react';
import PopupPanel from '@/components/PopupPanel';
import { newItemHref } from '@/lib/admin-calendar';
import { formatClock, formatShortDay } from '@/lib/dates';
import { hasKickoffTime, soonestFirst } from '@/lib/fixtures';
import type { ClubEvent, Match } from '@/lib/supabase/types';

/** How far back "Link a fixture" looks: a cup's earlier rounds may already be played */
const RECENT_DAYS = 60;

const opponentOf = (m: Match) =>
  m.match_type === 'internal' ? `${m.home_team_name} v ${m.away_team_name}` : `${m.is_club_home ? 'vs' : 'at'} ${m.opponent_name || (m.is_club_home ? m.away_team_name : m.home_team_name)}`;

/** The day tile and "vs Opponent" of a fixture, as on the public fixture rows */
function GameLine({ m }: { m: Match }) {
  const d = new Date(hasKickoffTime(m) ? m.match_date : `${m.match_date.slice(0, 10)}T12:00:00`);
  return (
    <>
      <div className="fixture-row-date" aria-hidden="true" style={{ width: 52 }}>
        <span className="fixture-row-dow">{d.toLocaleDateString(undefined, { weekday: 'short' })}</span>
        <span className="fixture-row-day">{d.getDate()}</span>
        <span className="fixture-row-month">{d.toLocaleDateString(undefined, { month: 'short' })}</span>
      </div>
      <div className="min-w-0" style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.92rem' }}>{opponentOf(m)}</div>
        <div className="text-meta">
          {[m.match_time ? formatClock(m.match_time) : null, m.pitch_label, m.venue].filter(Boolean).join(' · ')}
          {m.status === 'completed' ? ` · ${m.home_score}-${m.away_score}` : ''}
        </div>
      </div>
    </>
  );
}

/** Admin > Events > Fixtures: the games of one event (an outside cup), to link, unlink or add */
export default function EventFixturesModal({ event, clubSlug, matches, onLink, onUnlink, onClose }: {
  event: ClubEvent;
  clubSlug: string;
  /** The club's own fixtures */
  matches: Match[];
  onLink: (m: Match) => void;
  onUnlink: (m: Match) => void;
  onClose: () => void;
}) {
  const linked = useMemo(() => matches.filter(m => m.event_id === event.id).sort(soonestFirst), [matches, event.id]);
  // Club games not in an event yet: upcoming ones and those of the last couple of months
  const linkable = useMemo(() => {
    const since = Date.now() - RECENT_DAYS * 86400000;
    return matches
      .filter(m => !m.event_id && !m.tournament_id && m.match_type !== 'internal' && new Date(m.match_date).getTime() >= since)
      .sort(soonestFirst);
  }, [matches]);
  const [pick, setPick] = useState('');
  const picked = linkable.find(m => m.id === pick) || linkable[0];

  const start = new Date(event.start_time);
  const time = `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`;
  const addHref = newItemHref(`/${clubSlug}/admin/matches`, start, time, undefined, event.id);

  return (
    <div style={{ position: 'fixed', inset: 0, overflowY: 'auto', overscrollBehavior: 'contain', zIndex: 999, background: 'var(--color-scrim)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <PopupPanel onClose={onClose} label={`Fixtures in ${event.title}`} className="glass-panel" style={{ margin: 'auto', width: '100%', maxWidth: '560px', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-xl)', padding: '1.5rem' }}>
        <div className="section-head">
          <h3 style={{ fontSize: 'var(--text-xl)', fontWeight: 600, color: 'var(--text-primary)', overflowWrap: 'anywhere' }}>Fixtures in {event.title}</h3>
          <button type="button" onClick={onClose} className="admin-icon-btn" aria-label="Close">
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <p className="text-meta" style={{ margin: '0 0 1rem' }}>
          These games show on the event page, with their scores once played. Players answer once for all of them.
        </p>

        {linked.length === 0 ? (
          <p className="text-meta" style={{ margin: '0 0 1rem' }}>No games linked yet.</p>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {linked.map(m => (
              <li key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.6rem 0', borderBottom: '1px solid var(--border-subtle)' }}>
                <GameLine m={m} />
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => onUnlink(m)} aria-label={`Unlink ${opponentOf(m)} on ${formatShortDay(m.match_date)}`}>
                  <Unlink size={14} aria-hidden="true" /> Unlink
                </button>
              </li>
            ))}
          </ul>
        )}

        {linkable.length > 0 && picked && (
          <div className="form-group" style={{ marginTop: '1.25rem' }}>
            <label className="form-label" htmlFor="event-fixture-pick">Link a fixture you&apos;ve already added</label>
            <div className="row" style={{ gap: '0.5rem' }}>
              <select id="event-fixture-pick" className="form-select" style={{ flex: 1, minWidth: 0 }} value={picked.id} onChange={e => setPick(e.target.value)}>
                {linkable.map(m => (
                  <option key={m.id} value={m.id}>{formatShortDay(m.match_date)} · {opponentOf(m)}</option>
                ))}
              </select>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => { onLink(picked); setPick(''); }}>
                <Link2 size={14} aria-hidden="true" /> Link
              </button>
            </div>
            <div className="text-meta" style={{ marginTop: '0.35rem' }}>Upcoming and recent games that aren&apos;t in another event.</div>
          </div>
        )}

        <Link href={addHref} className="btn btn-secondary" style={{ width: '100%', marginTop: '0.75rem', justifyContent: 'center' }}>
          <Plus size={14} aria-hidden="true" /> Add new fixture to this event
        </Link>
      </PopupPanel>
    </div>
  );
}
