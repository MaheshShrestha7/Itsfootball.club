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

