// Committee meetings (migration 20261182): an agenda before, the meeting itself, minutes after.
// Pure helpers shared by the admin page, the shared minutes page and the email route.
import { DATE_LOCALE } from './dates';

export type MeetingStatus = 'planned' | 'live' | 'done';
export type Attendance = 'present' | 'apology';

/** One agenda line. `sub` lines sit under the nearest line above that isn't a sub-topic (2.1, 2.2). */
export interface AgendaItem {
  id: string;
  title: string;
  lead_id?: string | null;
  minutes: number;
  sub?: boolean;
  notes?: string;
  decisions?: string[];
  done?: boolean;
  /** Seconds actually spent on it in the meeting */
  spent?: number;
}

export interface FigureRow { label: string; value: string; tone?: 'warn' | 'danger' }
export interface FigureGroup { title: string; rows: FigureRow[] }
/** The figures the committee looked at, saved when the meeting starts */
export interface MeetingFigures { at: string; groups: FigureGroup[]; note?: string }

export interface CommitteeMeeting {
  id: string;
  club_id: string;
  kind: 'general' | 'topic';
  topic: string | null;
  event_id: string | null;
  starts_at: string;
  location: string;
  status: MeetingStatus;
  agenda: AgendaItem[];
  attendance: Record<string, Attendance>;
  current_item: string | null;
  item_started_at: string | null;
  started_at: string | null;
  ended_at: string | null;
  figures: MeetingFigures | null;
  agenda_sent_at: string | null;
  minutes_sent_at: string | null;
  share_token: string | null;
  shared_at: string | null;
}

export interface CommitteeAction {
  id: string;
  club_id: string;
  meeting_id: string;
  item_id: string | null;
  text: string;
  owner_id: string | null;
  owner_name: string | null;
  due_on: string | null;
  status: 'open' | 'done' | 'dropped';
  closed_at: string | null;
  closed_in: string | null;
  created_at: string;
}

export const MEETING_COLUMNS = 'id, club_id, kind, topic, event_id, starts_at, location, status, agenda, attendance, current_item, item_started_at, started_at, ended_at, figures, agenda_sent_at, minutes_sent_at, share_token, shared_at';

export const newItemId = () => Math.random().toString(36).slice(2, 10);

/** What a new meeting's agenda starts with; the committee changes it from there */
export const starterAgenda = (): AgendaItem[] => [
  { id: newItemId(), title: 'Welcome and apologies', minutes: 5 },
  { id: newItemId(), title: 'Actions from the last meeting', minutes: 10 },
  { id: newItemId(), title: 'General business', minutes: 10 },
];

export interface NumberedItem {
  item: AgendaItem;
  index: number;
  /** "3" or "3.2" */
  no: string;
  /** A line with sub-topics under it: a heading, not a step of its own in the meeting */
  heading: boolean;
  /** Its own minutes, or its sub-topics' added up */
  minutes: number;
}

/** Numbers the agenda: 1, 2, 2.1, 2.2, 3. A sub-topic at the very top counts as a plain item. */
export function numberAgenda(agenda: AgendaItem[]): NumberedItem[] {
  let n = 0;
  let k = 0;
  const out: NumberedItem[] = agenda.map((item, index) => {
    if (item.sub && n > 0) {
      k += 1;
      return { item, index, no: `${n}.${k}`, heading: false, minutes: item.minutes };
    }
    n += 1;
    k = 0;
    return { item, index, no: String(n), heading: false, minutes: item.minutes };
  });
  out.forEach((row, i) => {
    if (row.no.includes('.') || !out[i + 1]?.no.includes('.')) return;
    row.heading = true;
    row.minutes = 0;
    for (let j = i + 1; j < out.length && out[j].no.includes('.'); j++) row.minutes += Number(out[j].minutes) || 0;
  });
  return out;
}

/** The lines the meeting goes through one by one (a heading's sub-topics, not the heading) */
export const meetingSteps = (agenda: AgendaItem[]) => numberAgenda(agenda).filter(r => !r.heading);

export const agendaMinutes = (agenda: AgendaItem[]) => meetingSteps(agenda).reduce((n, r) => n + (Number(r.minutes) || 0), 0);

/** Meetings on the same topic share open actions: general ones, one event's, or one typed topic's */
export function topicKey(m: Pick<CommitteeMeeting, 'kind' | 'topic' | 'event_id'>): string {
  if (m.kind !== 'topic') return 'general';
  if (m.event_id) return `event:${m.event_id}`;
  return `topic:${(m.topic || '').trim().toLowerCase()}`;
}

/** "Committee meeting" or "Christmas Cup meeting" */
export function meetingTitle(m: Pick<CommitteeMeeting, 'kind' | 'topic' | 'event_id'>, eventTitle?: string | null): string {
  if (m.kind !== 'topic') return 'Committee meeting';
  const topic = (m.event_id && eventTitle) || m.topic || 'Topic';
  return `${topic} meeting`;
}

/**
 * The actions the agenda shows "From the last meeting": still open from earlier meetings on the
 * same topic, plus any closed at this one (so they stay in view while the meeting runs).
 */
export function carriedActions(actions: CommitteeAction[], meetings: Pick<CommitteeMeeting, 'id' | 'kind' | 'topic' | 'event_id' | 'starts_at'>[], meeting: Pick<CommitteeMeeting, 'id' | 'kind' | 'topic' | 'event_id' | 'starts_at'>): CommitteeAction[] {
  const key = topicKey(meeting);
  const earlier = new Set(meetings.filter(m => m.id !== meeting.id && topicKey(m) === key && m.starts_at <= meeting.starts_at).map(m => m.id));
  return actions
    .filter(a => earlier.has(a.meeting_id) && (a.status === 'open' || a.closed_in === meeting.id))
    .sort((a, b) => (a.due_on || '9999').localeCompare(b.due_on || '9999') || a.created_at.localeCompare(b.created_at));
}

// ---------------- Minutes ----------------

export interface MinutesReport {
  club: string;
  title: string;
  topic: string | null;
  day: string;
  time: string;
  location: string;
  present: string[];
  apologies: string[];
  decisions: { text: string; no: string }[];
  actions: { text: string; who: string; due: string; from: string | null }[];
  closed: string[];
  notes: { no: string; title: string; lead: string | null; text: string; heading: boolean }[];
  figures: MeetingFigures | null;
  next: string | null;
}

export interface MinutesInput {
  club: string;
  meeting: CommitteeMeeting;
  title: string;
  /** This meeting's actions and the earlier ones it carried or closed */
  actions: CommitteeAction[];
  carried: CommitteeAction[];
  meetings: Pick<CommitteeMeeting, 'id' | 'starts_at'>[];
  /** "Priya Sharma (President)" */
  person: (memberId: string) => string | null;
  next: Pick<CommitteeMeeting, 'starts_at' | 'location'> | null;
  tz: string;
}

const fmt = (iso: string, tz: string, o: Intl.DateTimeFormatOptions) => new Date(iso).toLocaleString(DATE_LOCALE, { timeZone: tz, ...o });
export const longDay = (iso: string, tz: string) => fmt(iso, tz, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
export const clock = (iso: string, tz: string) => fmt(iso, tz, { hour: 'numeric', minute: '2-digit' }).replace(/\s?([ap])\.?m\.?/i, ' $1m').toLowerCase();
const shortDate = (ymd: string) => new Date(`${ymd}T12:00:00`).toLocaleDateString(DATE_LOCALE, { day: 'numeric', month: 'short' });

export function buildMinutes(p: MinutesInput): MinutesReport {
  const m = p.meeting;
  const rows = numberAgenda(m.agenda);
  const startedOn = new Map(p.meetings.map(x => [x.id, x.starts_at]));
  const names = (want: Attendance) => Object.entries(m.attendance).filter(([, v]) => v === want).map(([id]) => p.person(id)).filter((s): s is string => !!s);
  const open = [...p.carried.filter(a => a.status === 'open'), ...p.actions.filter(a => a.meeting_id === m.id && a.status === 'open')];
  const seen = new Set<string>();
  return {
    club: p.club,
    title: p.title,
    topic: m.kind === 'topic' ? p.title.replace(/ meeting$/, '') : null,
    day: longDay(m.started_at || m.starts_at, p.tz),
    time: m.started_at ? `${clock(m.started_at, p.tz)}${m.ended_at ? ` to ${clock(m.ended_at, p.tz)}` : ''}` : clock(m.starts_at, p.tz),
    location: m.location,
    present: names('present'),
    apologies: names('apology'),
    decisions: rows.flatMap(r => (r.item.decisions || []).filter(t => t.trim()).map(text => ({ text: text.trim(), no: r.no }))),
    actions: open.filter(a => !seen.has(a.id) && seen.add(a.id)).map(a => ({
      text: a.text,
      who: a.owner_name || '',
      due: a.due_on ? shortDate(a.due_on) : '',
      from: a.meeting_id !== m.id && startedOn.get(a.meeting_id) ? `From ${fmt(startedOn.get(a.meeting_id)!, p.tz, { day: 'numeric', month: 'short' })}` : null,
    })),
    closed: p.carried.filter(a => a.closed_in === m.id && a.status === 'done').map(a => `${a.text}${a.owner_name ? ` (${a.owner_name})` : ''}`),
    notes: rows.filter(r => r.heading || r.item.notes?.trim()).map(r => ({
      no: r.no,
      title: r.item.title,
      lead: r.item.lead_id ? p.person(r.item.lead_id)?.replace(/ \(.*\)$/, '') || null : null,
      text: (r.item.notes || '').trim(),
      heading: r.heading,
    }))
      // A heading only when something under it has notes
      .filter((n, i, all) => !n.heading || (all[i + 1] && all[i + 1].no.startsWith(`${n.no}.`))),
    figures: m.figures,
    next: p.next ? `${longDay(p.next.starts_at, p.tz)}, ${clock(p.next.starts_at, p.tz)}${p.next.location ? `, ${p.next.location}` : ''}` : null,
  };
}

export function isMinutesReport(v: unknown): v is MinutesReport {
  const r = v as MinutesReport;
  return !!r && typeof r === 'object' && typeof r.title === 'string' && Array.isArray(r.decisions) && Array.isArray(r.actions) && Array.isArray(r.notes);
}
