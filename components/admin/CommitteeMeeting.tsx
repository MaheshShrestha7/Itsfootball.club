'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle, ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Calendar, Check, CheckCircle2, Clock, Copy, IndentIncrease,
  IndentDecrease, Link2, ListChecks, Lock, Mail, MapPin, Play, Plus, Printer, RefreshCw, RotateCcw, Trash2, X,
} from 'lucide-react';
import CommitteeMinutesPaper from '@/components/CommitteeMinutesPaper';
import ReviewSaveNote from '@/components/admin/ReviewSaveNote';
import {
  agendaMinutes, buildMinutes, carriedActions, clock, meetingSteps, meetingTitle, newItemId, numberAgenda, topicKey,
  type AgendaItem, type CommitteeAction, type CommitteeMeeting, type FigureGroup, type MeetingFigures,
} from '@/lib/committee-meetings';
import { membersSummary, opponentLine, sponsorsSummary, upcomingGames, comingEvents } from '@/lib/club-overview';
import { EVENT_TYPE_LABEL } from '@/lib/club-numbers';
import { clubTimeZone, formatShortDay } from '@/lib/dates';
import { formatMoney } from '@/lib/finance';
import { SITE_URL } from '@/lib/slugs';
import { getAccessToken, getSupabaseClient } from '@/lib/supabase/client';
import type { Club, ClubEvent, ClubMember, ClubSeason, Match, Sponsor } from '@/lib/supabase/types';
import { newToken } from '@/lib/use-match-reviews';
import { patchMeeting, useMeeting, type useCommittee } from '@/lib/use-committee-meetings';

type Committee = ReturnType<typeof useCommittee>;
type Can = (clubId: string, area: string, level?: 'view' | 'edit' | 'full') => boolean;

export interface MeetingContext {
  club: Club;
  committee: Committee;
  executives: ClubMember[];
  members: ClubMember[];
  events: ClubEvent[];
  matches: Match[];
  sponsors: Sponsor[];
  season: ClubSeason | undefined;
  can: Can;
  authorName: string;
}

const DAY = 86400000;
const todayYmd = () => new Date().toLocaleDateString('en-CA');
/** "Priya Sharma (President)" */
export const personLabel = (m: ClubMember) => (m.executive_title ? `${m.full_name} (${m.executive_title})` : m.full_name);
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/** The figures beside the agenda, as they are now. Each part shows only when the viewer's role covers it. */
function useLiveFigures(ctx: MeetingContext, meeting: CommitteeMeeting | null): { figures: MeetingFigures | null; loading: boolean } {
  const { club, can, season } = ctx;
  const [money, setMoney] = useState<{ in_cents: number; out_cents: number; waiting_cents: number; waiting_count: number; currency?: string } | null>(null);
  const [cup, setCup] = useState<{ entries: null | { teams: number; submitted: number; fees_paid: number; fees_cents: number | null; entry_deadline: string | null }; tickets: null | { sold: number; cents: number | null } } | null>(null);
  const [loading, setLoading] = useState(true);
  const eventId = meeting?.kind === 'topic' ? meeting.event_id : null;
  const general = meeting?.kind === 'general';
  const seeMoney = can(club.id, 'finance');

  useEffect(() => {
    const sb = getSupabaseClient();
    if (!sb || !meeting) { setLoading(false); return; }
    let live = true;
    setLoading(true);
    const now = Date.now();
    const from = season ? new Date(`${season.start_date}T00:00:00`) : new Date(new Date().getFullYear(), 0, 1);
    const jobs: Promise<unknown>[] = [];
    if (general && seeMoney) {
      jobs.push(Promise.resolve(sb.rpc('get_club_overview', {
        p_club_id: club.id, p_from: from.toISOString(), p_to: new Date(now + DAY).toISOString(), p_season: season?.name ?? null,
        p_match_ids: [], p_tz: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      })).then(({ data }) => { if (live) setMoney(data?.money ? { ...data.money, currency: data.currency } : null); }));
    }
    if (eventId) {
      jobs.push(Promise.resolve(sb.rpc('committee_meeting_figures', { p_club_id: club.id, p_event_id: eventId }))
        .then(({ data }) => { if (live) setCup(data || null); }));
    }
    void Promise.all(jobs).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [club.id, general, eventId, seeMoney, season, meeting?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const figures = useMemo((): MeetingFigures | null => {
    if (!meeting) return null;
    const groups: FigureGroup[] = [];
    const now = Date.now();
    const currency = money?.currency || 'AUD';
    const cash = (c: number | null | undefined) => formatMoney(Number(c) || 0, currency).replace(/\.00$/, '');
    const n = (v: number, one: string, many = `${one}s`) => `${v} ${v === 1 ? one : many}`;
    const clubMatches = ctx.matches.filter(m => m.club_id === club.id);
    const clubSponsors = ctx.sponsors.filter(s => s.club_id === club.id);

    if (meeting.kind === 'general') {
      if (money) {
        groups.push({ title: season ? `Money, ${season.name} season` : 'Money, this year', rows: [
          { label: 'Money in', value: cash(money.in_cents) },
          { label: 'Money out', value: cash(money.out_cents) },
          { label: 'Balance', value: cash(money.in_cents - money.out_cents), tone: money.in_cents - money.out_cents < 0 ? 'danger' : undefined },
          { label: 'Waiting to be paid', value: `${money.waiting_count}, ${cash(money.waiting_cents)}`, tone: money.waiting_count ? 'warn' : undefined },
        ] });
      }
      if (can(club.id, 'members')) {
        const people = membersSummary(ctx.members.filter(m => m.club_id === club.id), { from: new Date(0), to: new Date(now) }, now);
        groups.push({ title: 'Members', rows: [
          { label: 'Renewals due in 30 days', value: String(people.renewSoon.length), tone: people.renewSoon.length ? 'warn' : undefined },
          { label: 'Expired', value: String(people.expired.length), tone: people.expired.length ? 'danger' : undefined },
          { label: 'Applications waiting', value: String(people.waiting.length) },
        ] });
      }
      if (can(club.id, 'sponsors')) {
        const ending = sponsorsSummary(clubSponsors, now).endingSoon;
        groups.push({ title: 'Sponsors', rows: ending.length
          ? ending.slice(0, 5).map(s => ({ label: s.name, value: s.days === 0 ? 'Ends today' : `Ends in ${n(s.days ?? 0, 'day')}`, tone: 'warn' as const }))
          : [{ label: 'Ending in the next 30 days', value: 'None' }] });
      }
      const games = upcomingGames(clubMatches, 6, now).filter(m => new Date(m.match_date).getTime() - now < 28 * DAY)
        .map(m => ({ at: m.match_date, label: `${formatShortDay(m.match_date)}, ${opponentLine(m)}`, value: m.is_club_home !== false ? 'Home' : 'Away' }));
      const evs = comingEvents(ctx.events.filter(e => e.club_id === club.id), now, 28, 6)
        .map(e => ({ at: e.start_time, label: `${formatShortDay(e.start_time)}, ${e.title}`, value: EVENT_TYPE_LABEL[e.category] || 'Event' }));
      const coming = [...games, ...evs].sort((a, b) => a.at.localeCompare(b.at)).slice(0, 6);
      groups.push({ title: 'Next 4 weeks', rows: coming.length ? coming.map(({ label, value }) => ({ label, value })) : [{ label: 'No games or events', value: '—' }] });
      return { at: new Date(now).toISOString(), groups };
    }

    const event = meeting.event_id ? ctx.events.find(e => e.id === meeting.event_id) : null;
    if (!event) return null;
    groups.push({ title: 'The day', rows: [
      { label: 'Date', value: formatShortDay(event.start_time, true) },
      ...(event.location ? [{ label: 'Where', value: event.location }] : []),
    ] });
    if (cup?.entries) {
      const e = cup.entries;
      groups.push({ title: 'Entries', rows: [
        { label: 'Teams entered', value: String(e.teams) },
        { label: 'Entry forms sent in', value: `${e.submitted} of ${e.teams}`, tone: e.submitted < e.teams ? 'warn' : undefined },
        { label: 'Entry fees paid', value: `${e.fees_paid} of ${e.teams}${e.fees_cents != null ? `, ${cash(e.fees_cents)}` : ''}`, tone: e.fees_paid < e.teams ? 'warn' : undefined },
        ...(e.entry_deadline ? [{ label: 'Entries close', value: formatShortDay(e.entry_deadline) }] : []),
      ] });
    }
    if (cup?.tickets && (cup.tickets.sold > 0 || (event.ticket_price_cents ?? 0) > 0)) {
      groups.push({ title: 'Tickets', rows: [{ label: 'Tickets sold', value: `${cup.tickets.sold}${cup.tickets.cents != null ? `, ${cash(cup.tickets.cents)}` : ''}` }] });
    }
    const rows = [{ label: 'Games linked to it', value: String(clubMatches.filter(m => m.event_id === event.id).length) }];
    if (can(club.id, 'sponsors')) rows.push({ label: 'Event sponsors', value: String(clubSponsors.filter(s => s.event_id === event.id).length) });
    groups.push({ title: 'Our club', rows });
    return { at: new Date(now).toISOString(), groups, note: 'Money spent on the event isn\'t shown because expenses aren\'t linked to events.' };
  }, [meeting, money, cup, can, club.id, season, ctx.members, ctx.matches, ctx.sponsors, ctx.events]);

  return { figures, loading };
}

function FiguresPanel({ figures, title, live, emptyText }: { figures: MeetingFigures | null; title: string; live: boolean; emptyText: string }) {
  return (
    <section className="admin-panel" aria-labelledby="cm-figs">
      <div className="admin-panel-head"><h2 id="cm-figs">{title}</h2><span className="admin-meta">{live ? 'Live' : `As at ${figures ? clock(figures.at, Intl.DateTimeFormat().resolvedOptions().timeZone) : ''}`}</span></div>
      {figures && figures.groups.length ? (
        <div className="cm-figs">
          {figures.groups.map(g => (
            <div key={g.title}>
              <h3>{g.title}</h3>
              <ul>{g.rows.map((r, i) => <li key={i}><span>{r.label}</span><b className={r.tone ? `is-${r.tone}` : undefined}>{r.value}</b></li>)}</ul>
            </div>
          ))}
        </div>
      ) : <p className="cm-fine">{emptyText}</p>}
      {live && figures && <p className="cm-fine">{figures.note ? `${figures.note} ` : ''}The figures are saved with the minutes when you press Start meeting.</p>}
      {!live && figures?.note && <p className="cm-fine">{figures.note}</p>}
    </section>
  );
}

function ActionRow({ a, meeting, onUpdate, editable, from }: { a: CommitteeAction; meeting: CommitteeMeeting; onUpdate: Committee['updateAction']; editable: boolean; from?: string }) {
  const overdue = a.status === 'open' && !!a.due_on && a.due_on < todayYmd();
  const close = (status: 'done' | 'dropped') => onUpdate(a.id, { status, closed_at: new Date().toISOString(), closed_in: meeting.id });
  return (
    <li className={a.status !== 'open' ? 'is-closed' : undefined}>
      <div>
        <b>{a.text}</b>
        <span className="cm-sub">{[a.owner_name, a.due_on ? `due ${formatShortDay(a.due_on)}` : null, from].filter(Boolean).join(' · ')}</span>
      </div>
      <div className="cm-act-btns">
        {a.status === 'open'
          ? <span className={`admin-pill ${overdue ? 'is-danger' : 'is-warn'}`}>{overdue ? 'Overdue' : 'Open'}</span>
          : <span className={`admin-pill${a.status === 'done' ? ' is-ok' : ''}`}>{a.status === 'done' ? 'Done' : 'Dropped'}</span>}
        {editable && (a.status === 'open' ? (
          <>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => void close('done')}><Check size={14} aria-hidden="true" /> Done</button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => void close('dropped')}>Drop</button>
          </>
        ) : a.closed_in === meeting.id && (
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => void onUpdate(a.id, { status: 'open', closed_at: null, closed_in: null })}>Undo</button>
        ))}
      </div>
    </li>
  );
}

export default function CommitteeMeetingView({ ctx, meetingId }: { ctx: MeetingContext; meetingId: string }) {
  const { club, committee, executives, can } = ctx;
  const { value: meeting, change, ready, failed, saveState, retry } = useMeeting(meetingId, ctx.authorName);
  const canEdit = can(club.id, 'committee', 'edit');
  // The admin's own clock, the same one the date picker uses (emails use the club's time zone)
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || clubTimeZone(club);
  const [flash, setFlash] = useState<{ ok: boolean; text: string } | null>(null);
  const [share, setShare] = useState<{ token: string | null; sharedAt: string | null } | null>(null);
  const [sending, setSending] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const router = useRouter();
  const { figures: liveFigures } = useLiveFigures(ctx, meeting);

  const status = meeting?.status;
  useEffect(() => {
    if (status !== 'live') return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [status]);

  const event = meeting?.event_id ? ctx.events.find(e => e.id === meeting.event_id) : null;
  const title = meeting ? meetingTitle(meeting, event?.title) : 'Meeting';
  const carried = useMemo(() => (meeting && committee.meetings ? carriedActions(committee.actions, committee.meetings, meeting) : []), [meeting, committee.actions, committee.meetings]);
  const byId = useMemo(() => new Map(ctx.members.filter(m => m.club_id === club.id).map(m => [m.id, m])), [ctx.members, club.id]);
  const back = `/${club.slug}/admin/committee/meetings`;

  const minutes = useMemo(() => {
    if (!meeting || !committee.meetings) return null;
    const key = topicKey(meeting);
    const next = committee.meetings.filter(x => x.id !== meeting.id && topicKey(x) === key && x.starts_at > meeting.starts_at)
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0] || null;
    return buildMinutes({
      club: club.name, meeting, title, actions: committee.actions, carried, meetings: committee.meetings,
      person: id => { const m = byId.get(id); return m ? personLabel(m) : null; }, next, tz,
    });
  }, [meeting, committee.meetings, committee.actions, carried, club.name, title, byId, tz]);

  if (failed) {
    return (
      <div className="admin-panel admin-empty">
        <p>This meeting can&apos;t be opened. It may have been deleted, or check your connection and reload.</p>
        <Link href={back} className="btn btn-secondary btn-sm">Back to meetings</Link>
      </div>
    );
  }
  if (!ready || !meeting) return <p role="status" className="admin-meta">Opening the meeting…</p>;

  const set = (patch: Partial<CommitteeMeeting>) => change({ ...meeting, ...patch });
  const setAgenda = (agenda: AgendaItem[]) => set({ agenda });
  const say = (ok: boolean, text: string) => { setFlash({ ok, text }); setTimeout(() => setFlash(null), 5000); };
  const leadName = (id?: string | null) => (id ? byId.get(id)?.full_name : null);

  const email = async (kind: 'agenda' | 'minutes') => {
    setSending(true);
    await retry();
    try {
      const token = await getAccessToken();
      const res = await fetch('/api/admin/committee-meeting-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ clubId: club.id, meetingId: meeting.id, kind }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) say(false, json.error || 'The email could not be sent.');
      else say(true, `Sent to ${json.sent} committee ${json.sent === 1 ? 'member' : 'members'}${json.skipped ? `. ${json.skipped} without an email address were left out` : ''}.`);
      if (res.ok) await committee.reload();
    } catch {
      say(false, 'The email could not be sent. Check your connection and try again.');
    }
    setSending(false);
  };

  const head = (h1: string, p: string, actions: React.ReactNode) => (
    <div className="admin-head">
      <div>
        <Link href={back} className="rv-crumb"><ArrowLeft size={14} aria-hidden="true" /> Meetings</Link>
        <h1>{h1}</h1>
        <p>{p}</p>
      </div>
      <div className="admin-head-actions">{actions}</div>
    </div>
  );
  const flashEl = flash && (
    <div role="status" className={`admin-flash${flash.ok ? '' : ' is-error'}`}>
      {flash.ok ? <CheckCircle2 size={16} aria-hidden="true" /> : <AlertTriangle size={16} aria-hidden="true" />}<span>{flash.text}</span>
    </div>
  );
  const carriedPanel = (editable: boolean) => carried.length > 0 && (
    <section className="admin-panel" aria-labelledby="cm-carry">
      <div className="admin-panel-head">
        <h2 id="cm-carry">From earlier meetings</h2>
        <span className="admin-meta">{carried.filter(a => a.status === 'open').length} still open</span>
      </div>
      <ul className="cm-acts">
        {carried.map(a => {
          const at = committee.meetings?.find(x => x.id === a.meeting_id)?.starts_at;
          return <ActionRow key={a.id} a={a} meeting={meeting} onUpdate={committee.updateAction} editable={editable} from={at ? `from ${formatShortDay(at)}` : undefined} />;
        })}
      </ul>
    </section>
  );

  // ---------------- During ----------------
  if (meeting.status === 'live') {
    const steps = meetingSteps(meeting.agenda);
    const cur = steps.find(s => s.item.id === meeting.current_item) || null;
    const onItem = meeting.item_started_at ? Math.max(0, (now - new Date(meeting.item_started_at).getTime()) / 1000) : 0;
    const spentOn = (it: AgendaItem) => (it.spent || 0) + (it.id === meeting.current_item ? onItem : 0);
    const left = steps.filter(s => !s.item.done && s.item.id !== meeting.current_item).reduce((n, s) => n + (Number(s.minutes) || 0), 0)
      + (cur ? Math.max(0, cur.minutes - onItem / 60) : 0);
    /** Leave the current item (adding its time) and open another, or none */
    const moveTo = (nextId: string | null, finishCurrent: boolean) => {
      const agenda = meeting.agenda.map(it => (it.id === meeting.current_item
        ? { ...it, spent: Math.round(spentOn(it)), done: finishCurrent ? true : it.done }
        : it));
      return { agenda, current_item: nextId, item_started_at: nextId ? new Date().toISOString() : null };
    };
    const nextAfter = (id: string | null) => {
      const i = steps.findIndex(s => s.item.id === id);
      return [...steps.slice(i + 1), ...steps.slice(0, Math.max(0, i))].find(s => !s.item.done && s.item.id !== id)?.item.id || null;
    };
    const end = () => { change({ ...meeting, ...moveTo(null, true), status: 'done', ended_at: new Date().toISOString() }); retry(); };
    const updateItem = (patch: Partial<AgendaItem>) => cur && setAgenda(meeting.agenda.map(it => (it.id === cur.item.id ? { ...it, ...patch } : it)));
    const itemActions = committee.actions.filter(a => a.meeting_id === meeting.id && a.item_id === cur?.item.id);
    const cycle = (id: string) => {
      const was = meeting.attendance[id];
      const attendance = { ...meeting.attendance };
      if (!was) attendance[id] = 'present'; else if (was === 'present') attendance[id] = 'apology'; else delete attendance[id];
      set({ attendance });
    };
    const elapsed = meeting.started_at ? Math.round((now - new Date(meeting.started_at).getTime()) / 60000) : 0;

    return (
      <div className="cm-page">
        {head(`${title}: in progress`, 'Go through the agenda item by item. Notes, decisions and actions save as you type.', canEdit && (
          <button type="button" className="btn btn-secondary" onClick={end}>End meeting</button>
        ))}
        {flashEl}
        <section className="admin-panel cm-livebar">
          <span className="cm-dot" aria-hidden="true" />
          <b>Started {meeting.started_at ? clock(meeting.started_at, tz) : ''}</b>
          <span>{elapsed} min in, about {Math.round(left)} min of agenda left</span>
          <span className="cm-push"><ReviewSaveNote state={saveState} retry={retry} /></span>
        </section>

        <div className="cm-split">
          <div className="admin-stack">
            {cur ? (
              <section className="admin-panel" aria-labelledby="cm-now">
                <div className="cm-now-head">
                  <div>
                    <span className="cm-sub">Item {cur.no} · {steps.findIndex(s => s.item.id === cur.item.id) + 1} of {steps.length}</span>
                    <h2 id="cm-now">{cur.item.title}</h2>
                    {leadName(cur.item.lead_id) && <span className="cm-sub">{personLabel(byId.get(cur.item.lead_id!)!)}</span>}
                  </div>
                  <div className="cm-clock"><b>{mmss(spentOn(cur.item))}</b><span className="cm-sub">of {cur.minutes} min</span></div>
                </div>
                <div className="cm-bar" aria-hidden="true"><i className={spentOn(cur.item) > cur.minutes * 60 ? 'is-over' : undefined} style={{ width: `${Math.min(100, (spentOn(cur.item) / Math.max(60, cur.minutes * 60)) * 100)}%` }} /></div>

                <div className="cm-blk">
                  <label className="form-label" htmlFor="cm-notes">Notes</label>
                  <textarea id="cm-notes" className="form-textarea" rows={4} maxLength={4000} disabled={!canEdit} value={cur.item.notes || ''} onChange={e => updateItem({ notes: e.target.value })} />
                </div>

                <div className="cm-blk">
                  <h3><CheckCircle2 size={15} aria-hidden="true" /> Decisions</h3>
                  {(cur.item.decisions || []).length > 0 && (
                    <ul className="cm-rec">
                      {(cur.item.decisions || []).map((d, i) => (
                        <li key={i}>
                          <Check size={15} aria-hidden="true" />
                          <input className="form-input" aria-label={`Decision ${i + 1}`} value={d} maxLength={300} disabled={!canEdit}
                            onChange={e => updateItem({ decisions: (cur.item.decisions || []).map((x, j) => (j === i ? e.target.value : x)) })} />
                          {canEdit && <button type="button" className="cm-x" aria-label="Remove decision" onClick={() => updateItem({ decisions: (cur.item.decisions || []).filter((_, j) => j !== i) })}><X size={15} /></button>}
                        </li>
                      ))}
                    </ul>
                  )}
                  {canEdit && <AddDecision onAdd={text => updateItem({ decisions: [...(cur.item.decisions || []), text] })} />}
                </div>

                <div className="cm-blk">
                  <h3><ListChecks size={15} aria-hidden="true" /> Actions</h3>
                  {itemActions.length > 0 && (
                    <ul className="cm-acts cm-acts-flat">
                      {itemActions.map(a => (
                        <li key={a.id}>
                          <div><b>{a.text}</b><span className="cm-sub">{[a.owner_name, a.due_on ? `by ${formatShortDay(a.due_on)}` : null].filter(Boolean).join(' · ')}</span></div>
                          {canEdit && <button type="button" className="cm-x" aria-label={`Remove action: ${a.text}`} onClick={() => void committee.deleteAction(a.id)}><X size={15} /></button>}
                        </li>
                      ))}
                    </ul>
                  )}
                  {canEdit && (
                    <AddAction executives={executives} onAdd={async (text, ownerId, due) => {
                      const owner = ownerId ? byId.get(ownerId) : null;
                      const ok = await committee.addAction({ club_id: club.id, meeting_id: meeting.id, item_id: cur.item.id, text, owner_id: ownerId || null, owner_name: owner?.full_name || null, due_on: due || null });
                      if (!ok) say(false, 'That action didn\'t save. Check your connection and try again.');
                      return ok;
                    }} />
                  )}
                </div>

                {canEdit && (
                  <div className="cm-foot">
                    <button type="button" className="btn btn-secondary" onClick={() => set(moveTo(nextAfter(cur.item.id), false))}>Skip for now</button>
                    {nextAfter(cur.item.id)
                      ? <button type="button" className="btn btn-primary" onClick={() => set(moveTo(nextAfter(cur.item.id), true))}>Done, next item <ArrowRight size={16} aria-hidden="true" /></button>
                      : <button type="button" className="btn btn-primary" onClick={end}>Done, end meeting</button>}
                  </div>
                )}
              </section>
            ) : (
              <section className="admin-panel admin-empty">
                <p>Every item is done. Pick one on the agenda to go back to it, or end the meeting.</p>
                {canEdit && <button type="button" className="btn btn-primary btn-sm" onClick={end}>End meeting</button>}
              </section>
            )}
            {carriedPanel(canEdit)}
          </div>

          <div className="admin-stack">
            <section className="admin-panel" aria-labelledby="cm-here">
              <div className="admin-panel-head"><h2 id="cm-here">Who&apos;s here</h2><span className="admin-meta">{Object.values(meeting.attendance).filter(v => v === 'present').length} of {executives.length}</span></div>
              {executives.length ? (
                <div className="cm-people">
                  {executives.map(m => {
                    const a = meeting.attendance[m.id];
                    return (
                      <button key={m.id} type="button" disabled={!canEdit} className={`cm-person${a === 'present' ? ' is-in' : a === 'apology' ? ' is-away' : ''}`}
                        aria-label={`${m.full_name}: ${a === 'present' ? 'here' : a === 'apology' ? 'apology' : 'not here'}. Tap to change.`} onClick={() => cycle(m.id)}>
                        {m.full_name}{a === 'apology' ? ', apology' : a ? '' : ', not here'}
                      </button>
                    );
                  })}
                </div>
              ) : <p className="cm-fine">Appoint the committee on the Committee tab to take attendance.</p>}
              <p className="cm-fine">Tap a name to switch between here, apology and not here.</p>
            </section>

            <section className="admin-panel" aria-labelledby="cm-steps">
              <div className="admin-panel-head"><h2 id="cm-steps">Agenda</h2><span className="admin-meta">{steps.filter(s => s.item.done).length} done</span></div>
              <ol className="cm-steps">
                {numberAgenda(meeting.agenda).map(r => (r.heading ? (
                  <li key={r.item.id} className="cm-step-head">{r.no}. {r.item.title}</li>
                ) : (
                  <li key={r.item.id}>
                    <button type="button" disabled={!canEdit} className={`${r.item.done ? 'is-done' : ''}${r.item.id === meeting.current_item ? ' is-now' : ''}`}
                      aria-current={r.item.id === meeting.current_item ? 'step' : undefined}
                      onClick={() => r.item.id !== meeting.current_item && set(moveTo(r.item.id, false))}>
                      <span className="cm-ck">{r.item.done && <Check size={13} aria-hidden="true" />}</span>
                      <span>{r.no}. {r.item.title}</span>
                      <span className="cm-t">{r.item.id === meeting.current_item ? `${Math.floor(spentOn(r.item) / 60)} of ${r.minutes}` : r.item.done ? `${Math.round((r.item.spent || 0) / 60)} min` : `${r.minutes} min`}</span>
                    </button>
                  </li>
                )))}
              </ol>
            </section>

            <FiguresPanel figures={meeting.figures} title={event ? event.title : 'Club figures'} live={false} emptyText="No figures were saved for this meeting." />
          </div>
        </div>
      </div>
    );
  }

  // ---------------- After ----------------
  if (meeting.status === 'done' && minutes) {
    const shared = share ?? { token: meeting.share_token, sharedAt: meeting.shared_at };
    const link = shared.token ? `${SITE_URL}/report/m/${shared.token}` : '';
    const setShareLink = async (token: string | null) => {
      const sharedAt = token ? new Date().toISOString() : null;
      const ok = await patchMeeting(meeting.id, { share_token: token, share_report: token ? minutes : null, shared_at: sharedAt });
      if (ok) setShare({ token, sharedAt }); else say(false, 'That didn\'t save. Check your connection and try again.');
    };
    return (
      <div className="cm-page">
        {head('Meeting minutes', 'Built from the meeting. To change something, reopen the meeting, fix it, then end it again.', (
          <>
            {canEdit && <button type="button" className="btn btn-secondary" onClick={() => set({ status: 'live', ended_at: null })}><RotateCcw size={16} aria-hidden="true" /> Reopen</button>}
            {canEdit && <button type="button" className="btn btn-secondary" disabled={sending} onClick={() => void email('minutes')}><Mail size={16} aria-hidden="true" /> Email to the committee</button>}
            <button data-view-ok type="button" className="btn btn-primary" onClick={() => window.print()}><Printer size={16} aria-hidden="true" /> Print or save as PDF</button>
          </>
        ))}
        {flashEl}
        {meeting.minutes_sent_at && <p className="cm-fine cm-fine-top">Emailed to the committee {formatShortDay(meeting.minutes_sent_at, true)}.</p>}
        {canEdit && (
          <section className="admin-panel cm-share" aria-label="Share">
            <span><Lock size={14} aria-hidden="true" /> {shared.token ? 'Anyone with the link can read these minutes without signing in.' : 'Private to the committee.'}</span>
            {shared.token ? (
              <span className="cm-share-btns">
                <input className="form-input" readOnly value={link} aria-label="Share link" onFocus={e => e.currentTarget.select()} />
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => void navigator.clipboard?.writeText(link).then(() => say(true, 'Link copied.'))}><Copy size={14} aria-hidden="true" /> Copy</button>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => void setShareLink(shared.token)}><RefreshCw size={14} aria-hidden="true" /> Update</button>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => void setShareLink(null)}>Stop sharing</button>
              </span>
            ) : (
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => void setShareLink(newToken())}><Link2 size={14} aria-hidden="true" /> Make a share link</button>
            )}
          </section>
        )}
        <CommitteeMinutesPaper report={minutes} colour={club.primary_color} logoUrl={club.logo_url} />
      </div>
    );
  }

  // ---------------- Before: the agenda ----------------
  const rows = numberAgenda(meeting.agenda);
  const total = agendaMinutes(meeting.agenda);
  const startsAt = new Date(meeting.starts_at);
  const localInput = new Date(startsAt.getTime() - startsAt.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= meeting.agenda.length) return;
    const next = [...meeting.agenda];
    [next[i], next[j]] = [next[j], next[i]];
    setAgenda(next);
  };
  const patchItem = (id: string, patch: Partial<AgendaItem>) => setAgenda(meeting.agenda.map(it => (it.id === id ? { ...it, ...patch } : it)));
  const start = () => {
    const first = meetingSteps(meeting.agenda)[0]?.item.id || null;
    const attendance = Object.keys(meeting.attendance).length ? meeting.attendance : Object.fromEntries(executives.map(m => [m.id, 'present' as const]));
    const t = new Date().toISOString();
    change({ ...meeting, status: 'live', started_at: meeting.started_at || t, current_item: first, item_started_at: first ? t : null, figures: liveFigures, attendance });
    retry();
  };
  const remove = async () => {
    if (!window.confirm('Delete this meeting and its agenda? This can\'t be undone.')) return;
    if (await committee.deleteMeeting(meeting.id)) router.push(back);
    else say(false, 'The meeting could not be deleted.');
  };
  const clubEvents = ctx.events.filter(e => e.club_id === club.id).sort((a, b) => b.start_time.localeCompare(a.start_time));

  return (
    <div className="cm-page">
      {head(title, 'Build the agenda, send it to the committee, then run the meeting from this page.', canEdit && (
        <>
          <button type="button" className="btn btn-secondary" disabled={sending || !meeting.agenda.length} onClick={() => void email('agenda')}><Mail size={16} aria-hidden="true" /> Send agenda</button>
          <button type="button" className="btn btn-primary" disabled={!meeting.agenda.length} onClick={start}><Play size={16} aria-hidden="true" /> Start meeting</button>
        </>
      ))}
      {flashEl}

      <div className="cm-split">
        <div className="admin-stack">
          <section className="admin-panel" aria-label="Meeting details">
            <div className="cm-type">
              <span className="form-label m-0">Meeting type</span>
              <div className="admin-chips" role="group" aria-label="Meeting type">
                <button type="button" className="admin-chip" aria-pressed={meeting.kind === 'general'} disabled={!canEdit} onClick={() => set({ kind: 'general', event_id: null, topic: null })}>General committee meeting</button>
                <button type="button" className="admin-chip" aria-pressed={meeting.kind === 'topic'} disabled={!canEdit} onClick={() => set({ kind: 'topic' })}>Topic meeting</button>
              </div>
            </div>
            {meeting.kind === 'topic' && (
              <div className="cm-grid">
                <label className="cm-field">
                  <span className="form-label">About an event</span>
                  <select className="form-select" value={meeting.event_id || ''} disabled={!canEdit} onChange={e => set({ event_id: e.target.value || null, topic: e.target.value ? null : meeting.topic })}>
                    <option value="">No event, I&apos;ll type the topic</option>
                    {clubEvents.map(e => <option key={e.id} value={e.id}>{e.title} ({formatShortDay(e.start_time)})</option>)}
                  </select>
                </label>
                {!meeting.event_id && (
                  <label className="cm-field">
                    <span className="form-label">Topic</span>
                    <input className="form-input" maxLength={120} placeholder="e.g. Canteen" disabled={!canEdit} value={meeting.topic || ''} onChange={e => set({ topic: e.target.value })} />
                  </label>
                )}
              </div>
            )}
            <div className="cm-grid">
              <label className="cm-field">
                <span className="form-label"><Calendar size={13} aria-hidden="true" /> Date and time</span>
                <input type="datetime-local" className="form-input" disabled={!canEdit} value={localInput}
                  onChange={e => { const d = new Date(e.target.value); if (!isNaN(d.getTime())) set({ starts_at: d.toISOString() }); }} />
              </label>
              <label className="cm-field">
                <span className="form-label"><MapPin size={13} aria-hidden="true" /> Where</span>
                <input className="form-input" maxLength={200} placeholder="e.g. Clubrooms" disabled={!canEdit} value={meeting.location} onChange={e => set({ location: e.target.value })} />
              </label>
            </div>
            <p className="cm-fine">
              <Clock size={13} aria-hidden="true" /> {total} min, finishes about {clock(new Date(startsAt.getTime() + total * 60000).toISOString(), tz)}
              {meeting.agenda_sent_at ? ` · Agenda sent ${formatShortDay(meeting.agenda_sent_at, true)}` : ''}
              <span className="cm-push"><ReviewSaveNote state={saveState} retry={retry} /></span>
            </p>
          </section>

          {carriedPanel(canEdit)}

          <section className="admin-panel" aria-labelledby="cm-agenda">
            <div className="admin-panel-head"><h2 id="cm-agenda">Agenda</h2><span className="admin-meta">{rows.length} {rows.length === 1 ? 'line' : 'lines'}</span></div>
            {rows.length === 0 && <p className="cm-fine">Add the first item below.</p>}
            <ol className="cm-agenda">
              {rows.map(r => (
                <li key={r.item.id} className={`${r.no.includes('.') ? 'is-sub' : ''}${r.heading ? ' is-heading' : ''}`}>
                  <span className="cm-no">{r.no}</span>
                  <div className="cm-it">
                    <input className="form-input" aria-label={`Item ${r.no}`} maxLength={160} disabled={!canEdit} value={r.item.title} onChange={e => patchItem(r.item.id, { title: e.target.value })} />
                    {!r.heading && (
                      <div className="cm-it-meta">
                        <select className="form-select" aria-label={`Who leads item ${r.no}`} disabled={!canEdit} value={r.item.lead_id || ''} onChange={e => patchItem(r.item.id, { lead_id: e.target.value || null })}>
                          <option value="">Who leads it</option>
                          {executives.map(m => <option key={m.id} value={m.id}>{personLabel(m)}</option>)}
                        </select>
                        <label className="cm-mins">
                          <input type="number" min={0} max={240} className="form-input" aria-label={`Minutes for item ${r.no}`} disabled={!canEdit} value={r.item.minutes}
                            onChange={e => patchItem(r.item.id, { minutes: Math.max(0, Math.min(240, Math.round(Number(e.target.value) || 0))) })} />
                          <span>min</span>
                        </label>
                      </div>
                    )}
                    {r.heading && <span className="cm-sub">{r.minutes} min across its sub-topics</span>}
                  </div>
                  {canEdit && (
                    <div className="cm-row-btns">
                      <button type="button" className="cm-x" aria-label={`Move item ${r.no} up`} onClick={() => move(r.index, -1)}><ArrowUp size={15} /></button>
                      <button type="button" className="cm-x" aria-label={`Move item ${r.no} down`} onClick={() => move(r.index, 1)}><ArrowDown size={15} /></button>
                      <button type="button" className="cm-x" aria-label={r.item.sub ? `Make ${r.no} its own item` : `Make ${r.no} a sub-topic of the item above`}
                        title={r.item.sub ? 'Make it its own item' : 'Make it a sub-topic of the item above'} onClick={() => patchItem(r.item.id, { sub: !r.item.sub })}>
                        {r.item.sub ? <IndentDecrease size={15} /> : <IndentIncrease size={15} />}
                      </button>
                      <button type="button" className="cm-x" aria-label={`Remove item ${r.no}`} onClick={() => setAgenda(meeting.agenda.filter(it => it.id !== r.item.id))}><Trash2 size={15} /></button>
                    </div>
                  )}
                </li>
              ))}
            </ol>
            {canEdit && <AddItem rows={rows} executives={executives} onAdd={(item, after) => {
              const next = [...meeting.agenda];
              next.splice(after == null ? next.length : after + 1, 0, item);
              setAgenda(next);
            }} />}
          </section>

          {can(club.id, 'committee', 'full') && (
            <p className="cm-fine"><button type="button" className="btn btn-secondary btn-sm" onClick={() => void remove()}><Trash2 size={14} aria-hidden="true" /> Delete this meeting</button></p>
          )}
        </div>

        <FiguresPanel figures={liveFigures} title={event ? event.title : 'Club figures'} live
          emptyText={meeting.kind === 'topic' ? 'Link the meeting to an event to see its figures here.' : 'Nothing your role can see yet.'} />
      </div>
    </div>
  );
}

function AddItem({ rows, executives, onAdd }: { rows: ReturnType<typeof numberAgenda>; executives: ClubMember[]; onAdd: (item: AgendaItem, after: number | null) => void }) {
  const [title, setTitle] = useState('');
  const [lead, setLead] = useState('');
  const [minutes, setMinutes] = useState(10);
  const [under, setUnder] = useState('');
  const tops = rows.filter(r => !r.no.includes('.'));
  const add = () => {
    if (!title.trim()) return;
    let after: number | null = null;
    if (under) {
      // After the parent's last sub-topic
      const i = rows.findIndex(r => r.item.id === under);
      let j = i;
      while (rows[j + 1]?.no.includes('.')) j++;
      after = rows[j].index;
    }
    onAdd({ id: newItemId(), title: title.trim(), lead_id: lead || null, minutes, sub: !!under }, after);
    setTitle('');
  };
  return (
    <form className="cm-add" onSubmit={e => { e.preventDefault(); add(); }}>
      <input className="form-input" maxLength={160} placeholder="Add an item, e.g. Canteen roster" aria-label="New item" value={title} onChange={e => setTitle(e.target.value)} />
      <select className="form-select" aria-label="Where it goes" value={under} onChange={e => setUnder(e.target.value)}>
        <option value="">As its own item</option>
        {tops.map(r => <option key={r.item.id} value={r.item.id}>Under {r.no}. {r.item.title.slice(0, 40)}</option>)}
      </select>
      <select className="form-select" aria-label="Who leads it" value={lead} onChange={e => setLead(e.target.value)}>
        <option value="">Who leads it</option>
        {executives.map(m => <option key={m.id} value={m.id}>{personLabel(m)}</option>)}
      </select>
      <select className="form-select" aria-label="Minutes" value={minutes} onChange={e => setMinutes(Number(e.target.value))}>
        {[5, 10, 15, 20, 30, 45, 60].map(n => <option key={n} value={n}>{n} min</option>)}
      </select>
      <button type="submit" className="btn btn-secondary" disabled={!title.trim()}><Plus size={16} aria-hidden="true" /> Add</button>
    </form>
  );
}

function AddDecision({ onAdd }: { onAdd: (text: string) => void }) {
  const [text, setText] = useState('');
  return (
    <form className="cm-inline" onSubmit={e => { e.preventDefault(); if (text.trim()) { onAdd(text.trim()); setText(''); } }}>
      <input className="form-input" maxLength={300} placeholder="What was agreed, e.g. Spend up to $640 on new goal nets" aria-label="New decision" value={text} onChange={e => setText(e.target.value)} />
      <button type="submit" className="btn btn-secondary" disabled={!text.trim()}><Plus size={16} aria-hidden="true" /> Add decision</button>
    </form>
  );
}

function AddAction({ executives, onAdd }: { executives: ClubMember[]; onAdd: (text: string, ownerId: string, due: string) => Promise<boolean> }) {
  const [text, setText] = useState('');
  const [owner, setOwner] = useState('');
  const [due, setDue] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <form className="cm-act-form" onSubmit={async e => {
      e.preventDefault();
      if (!text.trim()) return;
      setBusy(true);
      if (await onAdd(text.trim(), owner, due)) { setText(''); setDue(''); }
      setBusy(false);
    }}>
      <input className="form-input" maxLength={300} placeholder="What needs doing" aria-label="What needs doing" value={text} onChange={e => setText(e.target.value)} />
      <select className="form-select" aria-label="Who" value={owner} onChange={e => setOwner(e.target.value)}>
        <option value="">Who</option>
        {executives.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
      </select>
      <input type="date" className="form-input" aria-label="By when" value={due} onChange={e => setDue(e.target.value)} />
      <button type="submit" className="btn btn-secondary" disabled={busy || !text.trim()}><Plus size={16} aria-hidden="true" /> Add action</button>
    </form>
  );
}
