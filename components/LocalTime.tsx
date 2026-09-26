'use client';

import { useSyncExternalStore } from 'react';

const subscribeNothing = () => () => {};

/**
 * A date or time in the visitor's own locale and time zone. The server can't know those, so the
 * server render and the hydrating render both use UTC (and en-US unless a locale is given), which
 * keeps them identical; React re-renders with the visitor's settings right after hydration.
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
  const loc = locale ?? (hydrated ? undefined : 'en-US');
  const opts = hydrated ? options : { ...options, timeZone: 'UTC' };
  const text =
    format === 'time' ? date.toLocaleTimeString(loc, opts)
    : format === 'both' ? date.toLocaleString(loc, opts)
    : date.toLocaleDateString(loc, opts);
  return <>{text}</>;
}
