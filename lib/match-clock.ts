import { useEffect, useState } from 'react';
import type { Match } from './supabase/types';

// A live match stores the minute it was at (`current_minute`) and when that period (re)started
// (`period_started_at`). Every screen derives the same minute from those two values, so nobody's
// browser timer can drift from the referee's clock.
const RUNNING_PERIODS = new Set(['first_half', 'second_half', 'extra_time']);
const MAX_MINUTE = 130;

export function getLiveMinute(match: Match | null | undefined, now: number = Date.now()): number {
  if (!match) return 0;
  if (match.status !== 'live' || !RUNNING_PERIODS.has(match.period) || !match.period_started_at) {
    return match.current_minute;
  }
  const started = Date.parse(match.period_started_at);
  if (Number.isNaN(started)) return match.current_minute;
  const elapsedMinutes = Math.max(0, Math.floor((now - started) / 60000));
  return Math.min(match.current_minute + elapsedMinutes, MAX_MINUTE);
}

/** Re-renders the caller every `ms` so a running clock keeps moving */
export function useNowTick(ms = 15000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(timer);
  }, [ms]);
  return now;
}
