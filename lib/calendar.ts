// A club's fixtures and public events as an iCalendar feed (RFC 5545), for "Subscribe to calendar".
// Pure: app/[clubSlug]/calendar.ics/route.ts fetches the rows and serves the text.

export interface CalendarMatch {
  id: string;
  title?: string | null;
  competition?: string | null;
  home_team_name: string;
  away_team_name: string;
  /** Kick-off instant; tournament fixtures store just the date (midnight UTC) plus a local match_time */
  match_date: string;
  match_time?: string | null;
  venue?: string | null;
  status: string;
  home_score?: number | null;
  away_score?: number | null;
}

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string | null;
  start_time: string;
  end_time?: string | null;
  location?: string | null;
}

const HOUR = 3600 * 1000;
const utf8 = new TextEncoder();
const MATCH_LENGTH = 2 * HOUR;

/** TEXT value escaping: backslash, comma, semicolon and newlines */
export const icsText = (s: string) => s.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/[,;]/g, m => `\\${m}`);

/** Lines longer than 75 octets continue on the next line after a space (never splitting a character) */
export function foldLine(line: string): string {
  const out: string[] = [];
  let current = '';
  let bytes = 0;
  for (const ch of line) {
    const size = utf8.encode(ch).length;
    if (bytes + size > (out.length ? 74 : 75)) {
      out.push(current);
      current = '';
      bytes = 0;
    }
    current += ch;
    bytes += size;
  }
  out.push(current);
  return out.join('\r\n ');
}

const stamp = (d: Date, utc: boolean) =>
  d.toISOString().slice(0, 19).replace(/[-:]/g, '') + (utc ? 'Z' : '');

/**
 * DTSTART/DTEND for a fixture. Date-only fixtures with a kick-off time become "floating" local
 * times (no Z): calendars show 14:30 as 14:30 wherever the subscriber is, which is what the club meant.
 */
export function matchTimes(m: Pick<CalendarMatch, 'match_date' | 'match_time'>): { start: string; end: string } | null {
  const d = new Date(m.match_date);
  if (isNaN(d.getTime())) return null;
  const time = m.match_time?.match(/^(\d{1,2}):(\d{2})$/);
  if (time && d.getUTCHours() === 0 && d.getUTCMinutes() === 0) {
    // Wall-clock arithmetic in a UTC Date, printed without the Z
    const local = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), Number(time[1]), Number(time[2])));
    return { start: stamp(local, false), end: stamp(new Date(local.getTime() + MATCH_LENGTH), false) };
  }
  return { start: stamp(d, true), end: stamp(new Date(d.getTime() + MATCH_LENGTH), true) };
}

export function buildCalendar(p: { clubName: string; baseUrl: string; matches: CalendarMatch[]; events: CalendarEvent[]; now?: Date }): string {
  const dtstamp = stamp(p.now ?? new Date(), true);
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//itsfootball.club//Club calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${icsText(`${p.clubName} fixtures & events`)}`,
    'X-PUBLISHED-TTL:PT1H',
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
  ];
  const vevent = (fields: (string | false | null | undefined)[]) =>
    lines.push('BEGIN:VEVENT', ...fields.filter((f): f is string => !!f), 'END:VEVENT');

  for (const m of p.matches) {
    const when = matchTimes(m);
    if (!when) continue;
    const played = m.status === 'completed' && m.home_score != null && m.away_score != null;
    const summary = played
      ? `${m.home_team_name} ${m.home_score}–${m.away_score} ${m.away_team_name}`
      : `${m.home_team_name} vs ${m.away_team_name}`;
    vevent([
      `UID:match-${m.id}@itsfootball.club`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART:${when.start}`,
      `DTEND:${when.end}`,
      `SUMMARY:${icsText(summary)}`,
      m.venue && `LOCATION:${icsText(m.venue)}`,
      (m.title || m.competition) && `DESCRIPTION:${icsText(m.title || m.competition || '')}`,
      `URL:${p.baseUrl}/match/${m.id}`,
      m.status === 'cancelled' && 'STATUS:CANCELLED',
    ]);
  }

  for (const e of p.events) {
    const start = new Date(e.start_time);
    if (isNaN(start.getTime())) continue;
    const end = e.end_time && new Date(e.end_time).getTime() > start.getTime() ? new Date(e.end_time) : new Date(start.getTime() + MATCH_LENGTH);
    vevent([
      `UID:event-${e.id}@itsfootball.club`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART:${stamp(start, true)}`,
      `DTEND:${stamp(end, true)}`,
      `SUMMARY:${icsText(e.title)}`,
      e.location && `LOCATION:${icsText(e.location)}`,
      e.description && `DESCRIPTION:${icsText(e.description)}`,
      `URL:${p.baseUrl}/events/${e.id}`,
    ]);
  }

  lines.push('END:VCALENDAR');
  return lines.map(foldLine).join('\r\n') + '\r\n';
}
