'use client';

import { use, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertTriangle, CalendarPlus, ChevronRight } from 'lucide-react';
import { useClub } from '@/lib/club-context';
import { useAuth } from '@/lib/auth-context';
import CommitteeTabs from '@/components/admin/CommitteeTabs';
import CommitteeMeetingView, { type MeetingContext } from '@/components/admin/CommitteeMeeting';
import { agendaMinutes, meetingTitle, starterAgenda, topicKey, type CommitteeAction } from '@/lib/committee-meetings';
import { formatShortDay } from '@/lib/dates';
import { useCommittee, useMeetingsReady } from '@/lib/use-committee-meetings';

const STATUS_LABEL = { planned: 'Agenda', live: 'In progress', done: 'Minutes' } as const;

/**
 * Admin > Committee > Meetings: plan a meeting's agenda (a general committee meeting, or one about a
 * topic such as a cup), run it item by item, then print or share the minutes. ?m= opens one meeting.
 */
export default function CommitteeMeetingsPage({ params, searchParams }: {
  params: Promise<{ clubSlug: string }>;
  searchParams: Promise<{ m?: string }>;
}) {
  const { clubSlug } = use(params);
  const { m: meetingId } = use(searchParams);
  const { clubs, selectClubBySlug, members, events, matches, sponsors, getActiveSeason } = useClub();
  const { user, can } = useAuth();
  const club = selectClubBySlug(clubSlug) || clubs[0];
  const router = useRouter();
  const ready = useMeetingsReady();
  const committee = useCommittee(club.id, ready === true);
  const canEdit = can(club.id, 'committee', 'edit');
  const [creating, setCreating] = useState(false);
  const [failed, setFailed] = useState(false);

  const executives = useMemo(() => members.filter(m => m.club_id === club.id && m.is_executive)
    .sort((a, b) => (a.executive_order ?? 99) - (b.executive_order ?? 99) || a.full_name.localeCompare(b.full_name)), [members, club.id]);
  const ctx: MeetingContext = {
    club, committee, executives, members, events, matches, sponsors, season: getActiveSeason(club.id), can, authorName: user?.full_name || '',
  };

  if (ready === false) {
    return (
      <div>
        <div className="admin-head"><div><h1>Committee</h1></div></div>
        <CommitteeTabs slug={club.slug} current="meetings" />
        <div className="admin-panel admin-empty"><p>Meetings need a database update first (migration 20261182_committee_meetings.sql). Ask whoever looks after the club&apos;s database to run it.</p></div>
      </div>
    );
  }
  if (meetingId) return <CommitteeMeetingView key={meetingId} ctx={ctx} meetingId={meetingId} />;

  const list = committee.meetings || [];
  const now = new Date(Date.now() - 6 * 3600 * 1000).toISOString();
  const upcoming = list.filter(m => m.status !== 'done' && (m.status === 'live' || m.starts_at >= now)).reverse();
  const past = list.filter(m => !upcoming.includes(m));
  const eventTitle = (id: string | null) => (id ? events.find(e => e.id === id)?.title : null);
  const open = committee.actions.filter(a => a.status === 'open')
    .sort((a, b) => (a.due_on || '9999').localeCompare(b.due_on || '9999'));

  const plan = async () => {
    setCreating(true);
    setFailed(false);
    // Next week at 7 pm, as a starting point
    const at = new Date();
    at.setDate(at.getDate() + 7);
    at.setHours(19, 0, 0, 0);
    const last = list.find(m => m.kind === 'general');
    const id = await committee.createMeeting({
      club_id: club.id, kind: 'general', topic: null, event_id: null, starts_at: at.toISOString(), location: last?.location || '',
      status: 'planned', agenda: starterAgenda(), attendance: {}, current_item: null, item_started_at: null, started_at: null,
      ended_at: null, figures: null, agenda_sent_at: null, minutes_sent_at: null, share_token: null, shared_at: null,
    });
    setCreating(false);
    if (id) router.push(`/${club.slug}/admin/committee/meetings?m=${id}`);
    else setFailed(true);
  };

  const row = (m: (typeof list)[number]) => {
    const steps = agendaMinutes(m.agenda);
    return (
      <li key={m.id}>
        <Link href={`/${club.slug}/admin/committee/meetings?m=${m.id}`} className="admin-queue-row">
          <span className="admin-dash-mark"><CalendarPlus size={18} aria-hidden="true" /></span>
          <span className="cm-li">
            <b>{meetingTitle(m, eventTitle(m.event_id))}</b>
            <span className="cm-sub">{formatShortDay(m.starts_at, true)}{m.location ? ` · ${m.location}` : ''}{m.status === 'planned' ? ` · ${steps} min` : ''}</span>
          </span>
          <span className="cm-li-end">
            <span className={`admin-pill${m.status === 'live' ? ' is-danger' : m.status === 'done' ? ' is-ok' : ''}`}>{STATUS_LABEL[m.status]}</span>
            <ChevronRight size={16} aria-hidden="true" />
          </span>
        </Link>
      </li>
    );
  };
  const meetingOf = (a: CommitteeAction) => list.find(m => m.id === a.meeting_id);

  return (
    <div>
      <div className="admin-head">
        <div>
          <h1>Committee</h1>
          <p>Plan each meeting&apos;s agenda, run it from here, and keep the minutes and actions in one place.</p>
        </div>
        {canEdit && (
          <div className="admin-head-actions">
            <button type="button" className="btn btn-primary row" disabled={creating || !committee.meetings} onClick={() => void plan()}>
              <CalendarPlus size={16} aria-hidden="true" /><span>Plan a meeting</span>
            </button>
          </div>
        )}
      </div>
      <CommitteeTabs slug={club.slug} current="meetings" />
      {(failed || committee.error) && (
        <div role="alert" className="admin-flash is-error"><AlertTriangle size={16} aria-hidden="true" /><span>{failed ? 'The meeting could not be made. Check your connection and try again.' : 'Some meetings couldn\'t be read. Please refresh.'}</span></div>
      )}

      <div className="admin-stack">
        <section className="admin-panel" aria-labelledby="cm-upcoming">
          <div className="admin-panel-head"><h2 id="cm-upcoming">Coming up</h2><span className="admin-meta">{upcoming.length}</span></div>
          {committee.meetings === null ? <p className="cm-fine">Loading…</p>
            : upcoming.length ? <ul className="admin-dash-queue">{upcoming.map(row)}</ul>
              : <p className="cm-fine">No meetings planned. Plan a meeting to start its agenda. For a meeting about one thing, such as a cup, pick Topic meeting on its agenda.</p>}
        </section>

        <section className="admin-panel" aria-labelledby="cm-open">
          <div className="admin-panel-head"><h2 id="cm-open">Open actions</h2><span className="admin-meta">{open.length}</span></div>
          {committee.meetings === null ? <p className="cm-fine">Loading…</p> : open.length ? (
            <ul className="cm-acts">
              {open.map(a => {
                const m = meetingOf(a);
                const overdue = !!a.due_on && a.due_on < new Date().toLocaleDateString('en-CA');
                return (
                  <li key={a.id}>
                    <div>
                      <b>{a.text}</b>
                      <span className="cm-sub">{[a.owner_name, a.due_on ? `due ${formatShortDay(a.due_on)}` : null, m ? `${m.kind === 'topic' ? meetingTitle(m, eventTitle(m.event_id)) : 'Committee meeting'}, ${formatShortDay(m.starts_at)}` : null].filter(Boolean).join(' · ')}</span>
                    </div>
                    <div className="cm-act-btns">
                      <span className={`admin-pill ${overdue ? 'is-danger' : 'is-warn'}`}>{overdue ? 'Overdue' : 'Open'}</span>
                      {canEdit && <button type="button" className="btn btn-secondary btn-sm" onClick={() => {
                        // Closed at the next meeting on its topic, when there is one coming up
                        const next = m && upcoming.find(x => topicKey(x) === topicKey(m));
                        void committee.updateAction(a.id, { status: 'done', closed_at: new Date().toISOString(), closed_in: next?.id ?? null });
                      }}>Done</button>}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : <p className="cm-fine">Nothing open. Actions agreed at a meeting show here until they&apos;re done.</p>}
        </section>

        {past.length > 0 && (
          <section className="admin-panel" aria-labelledby="cm-past">
            <div className="admin-panel-head"><h2 id="cm-past">Past meetings</h2><span className="admin-meta">{past.length}</span></div>
            <ul className="admin-dash-queue">{past.map(row)}</ul>
          </section>
        )}
      </div>
    </div>
  );
}
