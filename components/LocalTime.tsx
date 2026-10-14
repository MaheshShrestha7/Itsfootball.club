'use client';

import { useSyncExternalStore } from 'react';
import { DATE_LOCALE } from '@/lib/dates';

const subscribeNothing = () => () => {};

/**
 * A date or time in the site's Australian style (lib/dates.ts) and the visitor's own time zone. The
 * server can't know the time zone, so the server render and the hydrating render both use UTC,
 * which keeps them identical; React re-renders in the visitor's zone right after hydration.
 */
export default function LocalTime({
  value,
  format = 'date',
  locale,
  options,
}: {
  value: string | number | Date;
  /** Date only, time of day only, or both */
  format?: 'date' | 'time' | 'both';
  locale?: string;
  options?: Intl.DateTimeFormatOptions;
}) {
  const hydrated = useSyncExternalStore(subscribeNothing, () => true, () => false);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const loc = locale ?? DATE_LOCALE;
  const opts = hydrated ? options : { ...options, timeZone: 'UTC' };
  const text =
    format === 'time' ? date.toLocaleTimeString(loc, opts)
    : format === 'both' ? date.toLocaleString(loc, opts)
    : date.toLocaleDateString(loc, opts);
  return <>{text}</>;
}
