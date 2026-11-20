import { useEffect, useState } from 'react';

export { RUNNING_PERIODS, getLiveMinute, getLiveMinuteLabel } from './live-minute';

/** Re-renders the caller every `ms` so a running clock keeps moving */
export function useNowTick(ms = 15000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(timer);
  }, [ms]);
  return now;
}

const PERIOD_LABELS: Record<string, string> = {
  pre_match: 'Pre-match', first_half: '1st Half', halftime: 'Half-time', second_half: '2nd Half',
  extra_time: 'Extra Time', penalties: 'Penalties', full_time: 'Full Time',
};

/** A match period as people say it ("Half-time", not "halftime") */
export const periodLabel = (period: string | null | undefined) => (period && PERIOD_LABELS[period]) || '';
