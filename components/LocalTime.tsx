'use client';

import { useSyncExternalStore } from 'react';
import { DATE_LOCALE, SITE_TIME_ZONE, dayOptions } from '@/lib/dates';

const subscribeNothing = () => () => {};

/**
 * A date or time in the site's Australian style (lib/dates.ts) and the visitor's own time zone. The
 * server can't know the visitor's zone, so the server render and the hydrating render both use the
 * site's (SITE_TIME_ZONE, not UTC: Google and link previews read that first draw, and a 7 pm Sydney
 * event showed as 8:00 am), which keeps them identical; React re-renders in the visitor's zone right after.
 */
export default function LocalTime({
  value,
  format = 'date',
  locale,
  options: given,
}: {
  value: string | number | Date;
  /** Date only, time of day only, or both. A date with no options reads "Tue, 27 Oct" (year only when it isn't this one). */
  format?: 'date' | 'time' | 'both' | 'ordinal';
  locale?: string;
  options?: Intl.DateTimeFormatOptions;
}) {
  const hydrated = useSyncExternalStore(subscribeNothing, () => true, () => false);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const loc = locale ?? DATE_LOCALE;
  const options = given ?? (format === 'date' ? dayOptions(date) : undefined);
  const opts = hydrated ? options : { ...options, timeZone: SITE_TIME_ZONE };
  const text =
    format === 'ordinal' ? ordinalDate(date, loc, opts)
    : format === 'time' ? date.toLocaleTimeString(loc, opts)
    : format === 'both' ? date.toLocaleString(loc, opts)
    : date.toLocaleDateString(loc, opts);
  // Node's en-AU data spells some short months in full ("June", "July", "Sept") where browsers
  // don't: the server's HTML then differs from the hydrating render. One spelling everywhere.
  return <>{options?.month === 'short' ? text.replace(/\b(June|July|Sept)\b/g, m => m.slice(0, 3)) : text}</>;
}

/** "5th December, 2026 (Saturday)": the long form for an event's day */
function ordinalDate(date: Date, locale: string, opts?: Intl.DateTimeFormatOptions) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat(locale, { ...opts, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    .formatToParts(date).map(p => [p.type, p.value]));
  const d = Number(parts.day);
  const suffix = d % 100 >= 11 && d % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][d % 10] || 'th';
  return `${d}${suffix} ${parts.month}, ${parts.year} (${parts.weekday})`;
}
