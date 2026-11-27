/**
 * Dates and times read the same way everywhere on the site: Australian English, e.g. "Sat 18 Oct
 * 2026" and "3:00 pm". Pass it to toLocaleDateString / toLocaleTimeString / Intl.DateTimeFormat
 * instead of 'en-US', 'en-GB' or the browser's own default.
 */
export const DATE_LOCALE = 'en-AU';

/** The time zone pages are first drawn in, before the visitor's own takes over (components/LocalTime).
 *  Search engines and link previews only ever see this one, so it's where most clubs play.
 *  A club that plays somewhere else picks its own in Admin -> Branding (clubTimeZone below). */
export const SITE_TIME_ZONE = 'Australia/Sydney';

/** The time zones a club can pick (F10-1), saved in clubs.config.time_zone */
export const CLUB_TIME_ZONES = [
  { zone: 'Australia/Sydney', label: 'Sydney and Canberra (NSW, ACT)' },
  { zone: 'Australia/Melbourne', label: 'Melbourne (VIC)' },
  { zone: 'Australia/Brisbane', label: 'Brisbane (QLD, no daylight saving)' },
  { zone: 'Australia/Adelaide', label: 'Adelaide (SA)' },
  { zone: 'Australia/Hobart', label: 'Hobart (TAS)' },
  { zone: 'Australia/Darwin', label: 'Darwin (NT)' },
  { zone: 'Australia/Perth', label: 'Perth (WA)' },
  { zone: 'Pacific/Auckland', label: 'New Zealand' },
] as const;

const CLUB_ZONE_SET = new Set<string>(CLUB_TIME_ZONES.map(z => z.zone));

/** The club's own time zone, or the site's when it hasn't picked one (or the value isn't one we offer) */
export function clubTimeZone(club?: { config?: { time_zone?: unknown } | null } | null): string {
  const zone = club?.config?.time_zone;
  return typeof zone === 'string' && CLUB_ZONE_SET.has(zone) ? zone : SITE_TIME_ZONE;
}

/** "2026-11-28" + "08:00" on the wall clock of `zone` -> the ISO instant ("2026-11-27T21:00:00.000Z" in Sydney).
 *  Null when the date or time can't be read. */
export function zonedTimeToIso(date: string, time: string, zone: string = SITE_TIME_ZONE): string | null {
  const d = date.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const t = time.match(/^(\d{1,2}):(\d{2})/);
  if (!d || !t) return null;
  const wall = Date.UTC(+d[1], +d[2] - 1, +d[3], +t[1], +t[2]);
  // The zone's offset at that moment, read back from Intl (twice, so a daylight-saving change in between is caught)
  const offset = (ms: number) => {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: zone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
      .formatToParts(new Date(ms)).map(x => [x.type, x.value]));
    return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - ms;
  };
  let ms = wall - offset(wall);
  ms = wall - offset(ms);
  return Number.isNaN(ms) ? null : new Date(ms).toISOString();
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  return isNaN(d.getTime()) ? value : d.toLocaleDateString(DATE_LOCALE, { day: 'numeric', month: 'short', year: 'numeric' });
}


/** A saved "HH:MM" kick-off ("15:00", "09:30:00") as the site writes times: "3:00 pm". Anything else
 *  ("TBC", "3pm") comes back as typed. */
export function formatClock(value: string | null | undefined): string {
  if (!value) return '';
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(value.trim());
  if (!m) return value;
  const h = Number(m[1]);
  if (h > 23) return value;
  return `${h % 12 || 12}:${m[2]} ${h < 12 ? 'am' : 'pm'}`;
}

/** A day in the site's style, "Tue, 27 Oct", with the year only when it isn't this year ("Tue, 27 Oct 2025").
 *  Pass withTime for "Tue, 27 Oct · 6:00 pm". For admin and other client-only screens; public pages use
 *  components/LocalTime so the first draw matches the server's. */
export function formatShortDay(value: string | null | undefined, withTime = false): string {
  if (!value) return '';
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value);
  if (isNaN(d.getTime())) return value;
  const day = d.toLocaleDateString(DATE_LOCALE, dayOptions(d)).replace(/\b(June|July|Sept)\b/g, m => m.slice(0, 3));
  return withTime ? `${day} · ${d.toLocaleTimeString(DATE_LOCALE, { hour: 'numeric', minute: '2-digit' })}` : day;
}

/** The options for a day in the site's style (formatShortDay, LocalTime's default): weekday, day and
 *  short month, plus the year only when the date isn't in this year. */
export function dayOptions(value: string | number | Date): Intl.DateTimeFormatOptions {
  const d = new Date(value);
  const otherYear = !isNaN(d.getTime()) && d.getFullYear() !== new Date().getFullYear();
  return { weekday: 'short', day: 'numeric', month: 'short', ...(otherYear ? { year: 'numeric' } : {}) };
}

/** "5th December, 2026 (Saturday)": the long form for an event's day (LocalTime format="ordinal") */
export function ordinalDate(date: Date, locale = DATE_LOCALE, opts?: Intl.DateTimeFormatOptions): string {
  const parts = Object.fromEntries(new Intl.DateTimeFormat(locale, { ...opts, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    .formatToParts(date).map(p => [p.type, p.value]));
  const d = Number(parts.day);
  const suffix = d % 100 >= 11 && d % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][d % 10] || 'th';
  return `${d}${suffix} ${parts.month}, ${parts.year} (${parts.weekday})`;
}
