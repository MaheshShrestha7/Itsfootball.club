/**
 * Dates and times read the same way everywhere on the site: Australian English, e.g. "Sat 18 Oct
 * 2026" and "3:00 pm". Pass it to toLocaleDateString / toLocaleTimeString / Intl.DateTimeFormat
 * instead of 'en-US', 'en-GB' or the browser's own default.
 */
export const DATE_LOCALE = 'en-AU';

/** The time zone pages are first drawn in, before the visitor's own takes over (components/LocalTime).
 *  Search engines and link previews only ever see this one, so it's where most clubs play.
 *  ponytail: one zone for every club; store a time zone per club if Perth or Brisbane clubs see the wrong first draw. */
export const SITE_TIME_ZONE = 'Australia/Sydney';

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
