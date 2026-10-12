// ==============================================================================
// Admin calendar: fixtures, events, tournaments and seasons as one list of dated items
//
// Pure helpers for app/[clubSlug]/admin/calendar. Everything is read from rows the club context
// already loads; nothing here writes. Dates are shown in the viewer's local time.
// ==============================================================================
import type { ClubEvent, ClubSeason, ClubTeam, Match, Tournament } from './supabase/types';
import { teamOfMatch } from './teams';
import { parseTournamentDate } from './tournament-engine';

export type CalendarKind = 'match' | 'training' | 'social' | 'trial' | 'tournament' | 'season';

/** Filter chips, in display order; colours are theme tokens from globals.css */
export const CALENDAR_KINDS: { key: CalendarKind; label: string; color: string }[] = [
  { key: 'match', label: 'Matches', color: 'var(--c-green)' },
  { key: 'training', label: 'Training', color: 'var(--c-blue)' },
  { key: 'social', label: 'Socials & AGM', color: 'var(--c-purple)' },
  { key: 'trial', label: 'Trials', color: 'var(--c-sky)' },
  { key: 'tournament', label: 'Tournaments', color: 'var(--c-amber)' },
  { key: 'season', label: 'Seasons', color: 'var(--text-muted)' },
];

/** The admin area whose rows an item comes from (seasons are shown to everyone who sees the calendar) */
export type CalendarSource = 'matches' | 'events' | 'tournaments' | 'seasons';

/** Areas that open the calendar: someone who can view any of them sees it, with just their rows */
export const CALENDAR_AREAS: CalendarSource[] = ['matches', 'events', 'tournaments'];

export interface CalendarItem {
  /** Unique across sources ('match:<id>', 'season-start:<id>', ...) */
  key: string;
  id: string;
  source: CalendarSource;
  kind: CalendarKind;
  title: string;
  /** Venue or location */
  place?: string;
  start: Date;
  /** Exclusive end; all-day items end at midnight after their last day */
  end: Date;
  /** Shown without a time (tournaments, seasons, fixtures saved without a kick-off time) */
  allDay: boolean;
  /** The club team it belongs to; null when it isn't one team's */
  teamId: string | null;
  /** Belongs to the whole club, so it shows whichever team is picked */
  wholeClub: boolean;
  status?: string;
  /** Struck through: cancelled or postponed */
  off: boolean;
  /** Completed fixtures: the club's score first ("3-1"), and W/D/L when the club played */
  score?: string;
  result?: 'W' | 'D' | 'L';
  /** A tournament's bar also stands for this event (same name, within its dates) */
  eventId?: string;
}

const DAY = 24 * 3600 * 1000;
const HOUR = 3600 * 1000;
const MATCH_LENGTH = 2 * HOUR;
const EVENT_LENGTH = 1.5 * HOUR;

export const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, d.getHours(), d.getMinutes());
export const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
/** 'YYYY-MM-DD' in local time */
export const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
/** Monday of the week holding `d` */
export const startOfWeek = (d: Date) => addDays(startOfDay(d), -((d.getDay() + 6) % 7));

/** A 'YYYY-MM-DD' (or the date part of a timestamp) as local midnight */
export function localDate(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value || '');
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/**
 * When a fixture kicks off, in local time. Tournament and some older fixtures store just the date
 * (midnight UTC) plus a "14:30" match_time, which means 14:30 on that day wherever the club is.
 */
export function matchStart(m: Pick<Match, 'match_date' | 'match_time'>): { start: Date; timeKnown: boolean } | null {
  const d = new Date(m.match_date);
  if (isNaN(d.getTime())) return null;
  const midnightUtc = d.getUTCHours() === 0 && d.getUTCMinutes() === 0;
  const time = m.match_time?.match(/^(\d{1,2}):(\d{2})/);
  if (midnightUtc) {
    const start = new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    if (time) start.setHours(Number(time[1]), Number(time[2]));
    return { start, timeKnown: !!time };
  }
  return { start: d, timeKnown: true };
}

function matchTitle(m: Match): string {
  if (m.match_type === 'internal') return m.title?.trim() || `${m.home_team_name} vs ${m.away_team_name}`;
  const home = m.is_club_home !== false;
  const opponent = m.opponent_name?.trim() || (home ? m.away_team_name : m.home_team_name);
  return `${home ? 'vs' : '@'} ${opponent}`;
}

function matchScore(m: Match): Pick<CalendarItem, 'score' | 'result'> {
  if (m.status !== 'completed' || m.home_score == null || m.away_score == null) return {};
  if (m.match_type === 'internal') return { score: `${m.home_score}-${m.away_score}` };
  const home = m.is_club_home !== false;
  const us = home ? m.home_score : m.away_score;
  const them = home ? m.away_score : m.home_score;
  return { score: `${us}-${them}`, result: us > them ? 'W' : us < them ? 'L' : 'D' };
}

/**
 * Names that refer to the same thing, case, spacing and punctuation aside. With `loose`, one may
 * also contain the other ("Dashain Cup" and "ANCC Dashain Cup 2026"), if it isn't just a word or two.
 */
function sameName(a: string, b: string, loose = false): boolean {
  const norm = (x: string) => x.toLowerCase().replace(/[^a-z0-9]+/g, '');
  const x = norm(a);
  const y = norm(b);
  if (!x || !y) return false;
  if (x === y) return true;
  return loose && Math.min(x.length, y.length) >= 8 && (x.includes(y) || y.includes(x));
}

const EVENT_KIND: Record<string, CalendarKind> = {
  match: 'match',
  training: 'training',
  social: 'social',
  agm: 'social',
  trial: 'trial',
  tournament: 'tournament',
};

/** Every dated thing the club has, as calendar items (unsorted) */
export function buildCalendarItems(p: {
  clubId: string;
  matches: Match[];
  events: (ClubEvent & { team_id?: string | null })[];
  tournaments: Tournament[];
  seasons: ClubSeason[];
  clubTeams: ClubTeam[];
}): CalendarItem[] {
  const items: CalendarItem[] = [];

  for (const m of p.matches) {
    // A tournament's own fixtures are summed up by the tournament's bar, not listed one by one
    if (m.club_id !== p.clubId || m.tournament_id) continue;
    const when = matchStart(m);
    if (!when) continue;
    const team = teamOfMatch(m, p.clubTeams);
    items.push({
      key: `match:${m.id}`,
      id: m.id,
      source: 'matches',
      kind: 'match',
      title: matchTitle(m),
      place: m.venue || undefined,
      start: when.start,
      end: when.timeKnown ? new Date(when.start.getTime() + MATCH_LENGTH) : addDays(startOfDay(when.start), 1),
      allDay: !when.timeKnown,
      teamId: team?.id ?? null,
      wholeClub: false,
      status: m.status,
      off: m.status === 'cancelled' || m.status === 'postponed',
      ...matchScore(m),
    });
  }

  // Tournaments first: an event that only announces one of them is folded into its bar below
  const cups: CalendarItem[] = [];
  for (const t of p.tournaments) {
    if (t.club_id !== p.clubId) continue;
    // Saved as instants from a local date-time (TournamentFormModal), so read them in local time
    const startAt = parseTournamentDate(t.start_date);
    if (!startAt) continue;
    const first = startOfDay(startAt);
    const endAt = parseTournamentDate(t.end_date);
    const last = endAt && endAt > first ? startOfDay(endAt) : first;
    cups.push({
      key: `tournament:${t.id}`,
      id: t.id,
      source: 'tournaments',
      kind: 'tournament',
      title: t.name,
      place: t.venue || undefined,
      start: first,
      end: addDays(last, 1),
      allDay: true,
      teamId: null,
      wholeClub: true,
      status: t.status,
      off: false,
    });
  }
  items.push(...cups);

  for (const e of p.events) {
    if (e.club_id !== p.clubId) continue;
    const start = new Date(e.start_time);
    if (isNaN(start.getTime())) continue;
    // The same tournament also listed under Events & Training (e.g. for tickets): one bar, not two
    const cup = cups.find(c => sameName(c.title, e.title, e.category === 'tournament') && start >= c.start && start < c.end);
    if (cup) {
      cup.eventId = e.id;
      continue;
    }
    const endRaw = e.end_time ? new Date(e.end_time) : null;
    const end = endRaw && !isNaN(endRaw.getTime()) && endRaw > start ? endRaw : new Date(start.getTime() + EVENT_LENGTH);
    items.push({
      key: `event:${e.id}`,
      id: e.id,
      source: 'events',
      kind: EVENT_KIND[e.category] || 'social',
      title: e.title,
      place: e.location || undefined,
      start,
      end,
      allDay: false,
      teamId: e.team_id ?? null,
      wholeClub: !e.team_id,
      off: false,
    });
  }

  for (const s of p.seasons) {
    if (s.club_id !== p.clubId) continue;
    const marks: [string, Date | null][] = [
      ['start', localDate(s.start_date)],
      ['end', localDate(s.end_date)],
    ];
    for (const [which, day] of marks) {
      if (!day) continue;
      items.push({
        key: `season-${which}:${s.id}`,
        id: s.id,
        source: 'seasons',
        kind: 'season',
        title: `Season ${s.name} ${which === 'start' ? 'starts' : 'ends'}`,
        start: day,
        end: addDays(day, 1),
        allDay: true,
        teamId: null,
        wholeClub: true,
        off: false,
      });
    }
  }

  return items;
}

/** Items of the picked kinds, for one team ('ALL' for every team) */
export function filterItems(items: CalendarItem[], kinds: ReadonlySet<CalendarKind>, teamId: string): CalendarItem[] {
  return items.filter(i => kinds.has(i.kind) && (teamId === 'ALL' || i.wholeClub || i.teamId === teamId));
}

/** All-day items first (longest first, so bars line up), then by start time */
export function compareItems(a: CalendarItem, b: CalendarItem): number {
  if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
  if (a.allDay) {
    const span = (b.end.getTime() - b.start.getTime()) - (a.end.getTime() - a.start.getTime());
    if (span) return span;
  }
  return a.start.getTime() - b.start.getTime() || a.title.localeCompare(b.title);
}

/** Items on a local day (anything overlapping it), in display order */
export function itemsOnDay(items: CalendarItem[], day: Date): CalendarItem[] {
  const from = startOfDay(day).getTime();
  const to = addDays(startOfDay(day), 1).getTime();
  return items.filter(i => i.start.getTime() < to && Math.max(i.end.getTime(), i.start.getTime() + 1) > from).sort(compareItems);
}

/** The days of a month grid: Monday on or before the 1st to Sunday on or after the last day */
export function monthGrid(anchor: Date): Date[] {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
  const from = startOfWeek(first);
  const count = Math.round((addDays(startOfWeek(last), 7).getTime() - from.getTime()) / DAY);
  return Array.from({ length: count }, (_, i) => addDays(from, i));
}

export const weekDays = (anchor: Date) => Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(anchor), i));

/**
 * Side-by-side columns for timed items that overlap in a day: each gets a lane and the number of
 * lanes in its overlapping group, so blocks can be drawn at width 1/lanes.
 */
export function layoutDay(items: CalendarItem[]): { item: CalendarItem; lane: number; lanes: number }[] {
  const sorted = [...items].sort((a, b) => a.start.getTime() - b.start.getTime() || b.end.getTime() - a.end.getTime());
  const out: { item: CalendarItem; lane: number; lanes: number }[] = [];
  let group: { item: CalendarItem; lane: number; lanes: number }[] = [];
  let laneEnds: number[] = [];
  let groupEnd = 0;
  const close = () => {
    for (const g of group) g.lanes = laneEnds.length;
    out.push(...group);
    group = [];
    laneEnds = [];
  };
  for (const item of sorted) {
    const s = item.start.getTime();
    // Nothing still running: a new group starts
    if (group.length && s >= groupEnd) close();
    let lane = laneEnds.findIndex(end => end <= s);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = item.end.getTime();
    groupEnd = group.length ? Math.max(groupEnd, item.end.getTime()) : item.end.getTime();
    group.push({ item, lane, lanes: 0 });
  }
  if (group.length) close();
  return out;
}

/** What the calendar asks a page to prefill when adding from a day or a time slot */
export interface NewItemRequest {
  date: string;
  time?: string;
  team?: string;
}

/** Link to a page's add form, prefilled from a calendar day ('?new=2026-10-17&time=15:00&team=…') */
export function newItemHref(pagePath: string, day: Date, time?: string, team?: string): string {
  const q = new URLSearchParams({ new: dayKey(day) });
  if (time) q.set('time', time);
  if (team && team !== 'ALL') q.set('team', team);
  return `${pagePath}?${q.toString()}`;
}

/** The add request in a query string, or null when there is none or it isn't a real date/time */
export function parseNewItemRequest(search: string): NewItemRequest | null {
  const q = new URLSearchParams(search);
  const date = q.get('new') || '';
  const day = localDate(date);
  if (!day || dayKey(day) !== date) return null;
  const time = q.get('time') || '';
  const tm = /^(\d{2}):(\d{2})$/.exec(time);
  const validTime = tm && Number(tm[1]) < 24 && Number(tm[2]) < 60 ? time : undefined;
  return { date, time: validTime, team: q.get('team') || undefined };
}

/**
 * Reads the add request from the current URL once, and removes it so a refresh or the back button
 * doesn't open the form again. Client only.
 */
export function takeNewItemRequest(): NewItemRequest | null {
  const req = parseNewItemRequest(window.location.search);
  if (!req) return null;
  const q = new URLSearchParams(window.location.search);
  ['new', 'time', 'team'].forEach(k => q.delete(k));
  const search = q.toString();
  window.history.replaceState(window.history.state, '', `${window.location.pathname}${search ? `?${search}` : ''}${window.location.hash}`);
  return req;
}
