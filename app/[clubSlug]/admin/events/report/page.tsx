'use client';

import { use, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowLeft, Check, CheckCircle2, Copy, Link2, Lock, Printer, RefreshCw, RotateCcw } from 'lucide-react';
import { useClub } from '@/lib/club-context';
import { useAuth } from '@/lib/auth-context';
import EventReportPaper from '@/components/EventReportPaper';
import ReviewSaveNote from '@/components/admin/ReviewSaveNote';
import { buildEventReport, EVENT_NOTE_MAX, EVENT_TYPES } from '@/lib/event-report';
import { formatDate, formatShortDay } from '@/lib/dates';
import { SITE_URL } from '@/lib/slugs';
import { isPlayerMember, type ClubEvent } from '@/lib/supabase/types';
import { gameWhen } from '@/lib/use-cup-games';
import { useEventNotes, useEventShare, useEventWrapupReady } from '@/lib/use-match-reviews';

/** "Social · 2026 season · Fri 23 Oct, 7:00 pm · Clubhouse" */
const eventMeta = (e: ClubEvent) => [
  EVENT_TYPES.find(([value]) => value === e.category)?.[1] || e.category,
  e.season ? `${e.season} season` : null,
  formatShortDay(e.start_time, true),
  e.location,
].filter(Boolean).join(' · ');

/**
 * Admin > Events and training > Summary report: how an event went, from door check-ins and its
 * linked games, with the committee's own notes. Mark it Completed here, print it, or share a
 * version without names or the notes for next time.
 */
export default function EventReportPage({ params, searchParams }: {
  params: Promise<{ clubSlug: string }>;
  searchParams: Promise<{ event?: string }>;
}) {
  const { clubSlug } = use(params);
  const { event: eventId } = use(searchParams);
  const { clubs, selectClubBySlug, events, members, gateScans, matches, updateEvent } = useClub();
  const { user } = useAuth();
  const club = selectClubBySlug(clubSlug) || clubs[0];
  const event = events.find(e => e.id === eventId && e.club_id === club.id);
  const ready = useEventWrapupReady();
  const { notes, change, ready: notesReady, failed: notesFailed, saveState, retry } = useEventNotes(ready ? club.id : undefined, ready ? event?.id : undefined, user?.full_name || '');
  const sharing = useEventShare(club.id, ready ? event?.id : undefined);
  const [copied, setCopied] = useState(false);

  const reports = useMemo(() => {
    if (!event) return null;
    const nameOf = (id: string) => members.find(m => m.id === id)?.full_name;
    // The squad, as Training attendance counts it
    const squad = members
      .filter(m => m.club_id === club.id && isPlayerMember(m) && m.status !== 'alumni' && (m.membership_status ?? 'approved') === 'approved')
      .map(m => ({ id: m.id, name: m.full_name }))
      .sort((a, b) => a.name.localeCompare(b.name));
    const input = {
      club: club.name, event, meta: eventMeta(event), eventId: event.id, scans: gateScans.filter(s => s.club_id === club.id),
      squad, nameOf, games: matches.filter(m => m.club_id === club.id && m.event_id === event.id), when: gameWhen, notes,
    };
    return { committee: buildEventReport({ ...input, committee: true }), shared: buildEventReport({ ...input, committee: false }) };
  }, [event, members, club.id, club.name, gateScans, matches, notes]);

  const back = `/${club.slug}/admin/events`;
  if (!event || !reports) {
    return (
      <div className="rv-page">
        <div className="admin-head"><div><h1>Event summary</h1></div></div>
        <div className="admin-panel admin-empty">
          <p>Open a summary from an event in Events and training.</p>
          <Link href={back} className="btn btn-secondary btn-sm">Back</Link>
        </div>
      </div>
    );
  }

  const done = !!event.completed_at;
  const link = sharing.share ? `${SITE_URL}/report/e/${sharing.share.token}` : '';
  const copyLink = () => {
    void navigator.clipboard?.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="rv-page">
      <div className="admin-head">
        <div>
          <Link href={back} className="rv-crumb"><ArrowLeft size={14} aria-hidden="true" /> Events and training</Link>
          <h1>Event summary</h1>
          <p>How {event.title} went, from door check-ins and its games. Add your own notes below.</p>
        </div>
        <div className="admin-head-actions">
          <button data-view-ok type="button" className="btn btn-primary btn-sm" onClick={() => window.print()}>
            <Printer size={14} aria-hidden="true" /> Print or save as PDF
          </button>
        </div>
      </div>

      <div className="rv-stack">
        {ready && (
          <section className="admin-panel" aria-label="Completed">
            <div className="rv-pad" style={{ paddingTop: 'var(--space-md)' }}>
              <div className="rv-foot">
                <div>
                  {done
                    ? <span className="admin-pill is-ok"><CheckCircle2 size={12} aria-hidden="true" /> Completed</span>
                    : <b>Not marked as completed</b>}
                  <p className="rv-private" style={{ margin: 'var(--space-2xs) 0 0', display: 'block' }}>
                    {done
                      ? `Marked${event.completed_by_name ? ` by ${event.completed_by_name}` : ''} on ${formatDate(event.completed_at)}. On the club site it shows under Past events, and sign-ups and ticket sales are closed.`
                      : 'Marking it completed moves it to Past events on the club site and closes sign-ups and ticket sales.'}
                  </p>
                </div>
                {done ? (
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => updateEvent(event.id, { completed_at: '', completed_by_name: '' })}>
                    <RotateCcw size={14} aria-hidden="true" /> Reopen
                  </button>
                ) : (
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => updateEvent(event.id, { completed_at: new Date().toISOString(), completed_by_name: user?.full_name || '' })}>
                    <Check size={14} aria-hidden="true" /> Mark as completed
                  </button>
                )}
              </div>
            </div>
          </section>
        )}

        {ready && sharing.ready && (
          <section className="admin-panel" aria-labelledby="ev-share">
            <div className="admin-panel-head">
              <h2 id="ev-share">Share with a link</h2>
              {sharing.share && <span className="admin-meta">Shared copy saved {formatDate(sharing.share.sharedAt)}</span>}
            </div>
            <div className="rv-pad">
              <p className="rv-facts">
                <span>
                  Anyone with the link can read the summary without signing in. It leaves out the names of who came, who missed training and your notes for next time.
                  {' '}The link shows a saved copy, so later changes only appear after you update it.
                </span>
              </p>
              {sharing.share ? (
                <>
                  <input className="form-input" readOnly value={link} aria-label="Share link" onFocus={e => e.currentTarget.select()} />
                  <div className="mc-next-actions">
                    <button type="button" className="btn btn-primary btn-sm" onClick={copyLink}>
                      {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />} {copied ? 'Copied' : 'Copy link'}
                    </button>
                    <button type="button" className="btn btn-secondary btn-sm" disabled={sharing.busy || !notesReady} onClick={() => void sharing.save(reports.shared)}>
                      <RefreshCw size={14} aria-hidden="true" /> Update the shared copy
                    </button>
                    <button type="button" className="btn btn-secondary btn-sm" disabled={sharing.busy} onClick={() => void sharing.stop()}>Stop sharing</button>
                  </div>
                </>
              ) : (
                <div className="mc-next-actions">
                  <button type="button" className="btn btn-primary btn-sm" disabled={sharing.busy || !notesReady} onClick={() => void sharing.save(reports.shared)}>
                    <Link2 size={14} aria-hidden="true" /> Create share link
                  </button>
                </div>
              )}
              {sharing.failed && <p className="rv-flag" role="alert"><AlertTriangle size={15} aria-hidden="true" /><span>That didn&apos;t save. Check your connection and try again.</span></p>}
            </div>
          </section>
        )}

        {ready && (
          <section className="admin-panel" aria-labelledby="ev-notes">
            <div className="admin-panel-head">
              <h2 id="ev-notes">Your notes</h2>
              <span className="rv-private"><Lock size={13} aria-hidden="true" /> Committee only, saves as you type</span>
            </div>
            <div className="rv-pad">
              {notesFailed && (
                <p className="rv-flag" role="alert"><AlertTriangle size={15} aria-hidden="true" /><span>Your notes can&apos;t be opened right now. Check your connection and reload the page.</span></p>
              )}
              <div className="rv-two">
                <label className="rv-q">
                  <span className="form-label">What went well</span>
                  <textarea className="form-textarea" rows={4} maxLength={EVENT_NOTE_MAX} disabled={!notesReady}
                    value={notes.went_well} onChange={e => change({ ...notes, went_well: e.target.value })} />
                  <small>One point per line. Shared copies include these.</small>
                </label>
                <label className="rv-q">
                  <span className="form-label">What to change next time</span>
                  <textarea className="form-textarea" rows={4} maxLength={EVENT_NOTE_MAX} disabled={!notesReady}
                    value={notes.next_time} onChange={e => change({ ...notes, next_time: e.target.value })} />
                  <small>Committee only. Never in a shared copy.</small>
                </label>
              </div>
              <ReviewSaveNote state={saveState} retry={retry} />
            </div>
          </section>
        )}

        <EventReportPaper
          report={reports.committee}
          colour={club.primary_color}
          logoUrl={club.logo_url}
          footer={`Made on ${formatDate(new Date().toISOString())} from door check-ins${reports.committee.games.length ? ' and results' : ''}`}
        />
      </div>
    </div>
  );
}
