'use client';

import React, { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CalendarCheck, Check, Handshake } from 'lucide-react';
import { useClub } from '@/lib/club-context';
import { dateLabel, type FriendlyDate } from '@/lib/friendlies';

interface View {
  club: string;
  logo: string | null;
  game: string;
  first_name: string;
  suggested: FriendlyDate[];
  picked: FriendlyDate | null;
  done: boolean;
}

/**
 * /{club}/friendly/{token}: the private link in a "would one of these dates suit?" email. The
 * person who invited one of our teams picks a date with one tap; it goes back to the club's Inbox,
 * and the club confirms the fixture by email.
 */
export default function FriendlyPickPage({ params }: { params: Promise<{ clubSlug: string; token: string }> }) {
  const { clubSlug, token } = use(params);
  const { clubs, selectClubBySlug } = useClub();
  const club = selectClubBySlug(clubSlug) || clubs[0];
  const [view, setView] = useState<View | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    let stale = false;
    fetch(`/api/friendly?token=${encodeURIComponent(token)}`)
      .then(async r => {
        const data = await r.json().catch(() => ({}));
        if (stale) return;
        if (r.ok) setView(data as View);
        else setError(data.error || 'This link has expired or isn’t right.');
      })
      .catch(() => !stale && setError('We couldn’t load this. Check your connection and try again.'));
    return () => { stale = true; };
  }, [token]);

  const pick = async (d: FriendlyDate) => {
    setSaving(`${d.date}-${d.time}`);
    setError(null);
    try {
      const r = await fetch('/api/friendly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, date: d.date, time: d.time }),
      });
      const data = await r.json().catch(() => ({}));
      if (r.ok) setView(data as View);
      else setError(data.error || 'That didn’t save. Please try again.');
    } catch {
      setError('That didn’t save. Check your connection and try again.');
    } finally {
      setSaving(null);
    }
  };

  const name = view?.club || club?.name || 'the club';

  return (
    <div style={{ padding: '3rem 0 5rem' }}>
      <div className="container" style={{ maxWidth: '560px' }}>
        <Link href={`/${club?.slug || clubSlug}`} className="frp-back">
          <ArrowLeft size={16} aria-hidden="true" /> {name}
        </Link>

        <div className="glass-panel frp">
          <span className="frp-icon" aria-hidden="true">{view?.picked ? <CalendarCheck size={22} /> : <Handshake size={22} />}</span>
          {!view && !error && <p className="frp-lead">Loading…</p>}
          {!view && error && (
            <>
              <h1>This link isn’t working</h1>
              <p className="frp-lead">{error} If you think it should, reply to the club’s email.</p>
            </>
          )}

          {view && view.picked && (
            <>
              <h1>Thanks{view.first_name ? `, ${view.first_name}` : ''}. {dateLabel(view.picked)} it is.</h1>
              <p className="frp-lead">
                We’ve let {name} know. They’ll confirm the fixture by email with the match page, directions and the ground guide.
              </p>
              {!view.done && view.suggested.length > 1 && <p className="frp-note">Picked the wrong one? Tap another date below.</p>}
            </>
          )}
          {view && !view.picked && (
            <>
              <h1>Pick a date for your friendly</h1>
              <p className="frp-lead">
                {view.game}. {view.suggested.length > 1 ? 'Tap the date that suits you.' : 'Tap to accept the date.'}
              </p>
            </>
          )}

          {view && view.done && !view.picked && <p className="frp-note">The club has already sorted this one out. Check your email for the details.</p>}

          {view && !view.done && (
            <ul className="frp-dates">
              {view.suggested.map(d => {
                const key = `${d.date}-${d.time}`;
                const on = view.picked?.date === d.date && view.picked?.time === d.time;
                return (
                  <li key={key}>
                    <span className="frp-when">{dateLabel(d)}{!d.time && <small>Kick-off to be agreed</small>}</span>
                    {on ? (
                      <span className="frp-picked"><Check size={15} aria-hidden="true" /> Your pick</span>
                    ) : (
                      <button type="button" className={`btn btn-sm ${view.picked ? 'btn-secondary' : 'btn-primary'}`} disabled={!!saving} onClick={() => pick(d)}>
                        {saving === key ? 'Saving…' : view.picked ? 'Pick this instead' : 'Accept'}
                        <span className="sr-only"> {dateLabel(d)}</span>
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {view && error && <p role="alert" className="frp-error">{error}</p>}
          {view && !view.done && <p className="frp-note">None of these work? Just reply to the club’s email.</p>}
        </div>
      </div>
    </div>
  );
}
