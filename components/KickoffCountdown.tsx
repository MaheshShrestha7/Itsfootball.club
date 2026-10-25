'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';

const subscribeNothing = () => () => {};

/**
 * Days / hours / minutes to kick-off in small glass wells. The server can't know "now" for the
 * visitor, so the first render shows `fallback` (the date) and the clock appears after hydration.
 */
export default function KickoffCountdown({ kickoff, fallback, size = 'md', event = false }: {
  kickoff: number;
  fallback?: React.ReactNode;
  size?: 'sm' | 'md';
  /** A club event rather than a match: "Starts in", and no result to wait for */
  event?: boolean;
}) {
  const hydrated = useSyncExternalStore(subscribeNothing, () => true, () => false);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);
  if (!hydrated || !kickoff) return <>{fallback ?? null}</>;
  const left = kickoff - now;
  // Past kick-off but not started in the app: soon, or (hours later) the result just isn't in yet
  if (left <= 0) return <span className="kickoff-countdown-soon">{event ? 'Happening now' : left > -3 * 3600000 ? 'Kick-off any minute' : 'Result to come'}</span>;
  const mins = Math.floor(left / 60000);
  const parts: [number, string][] = [
    [Math.floor(mins / 1440), 'days'],
    [Math.floor((mins % 1440) / 60), 'hrs'],
    [mins % 60, 'mins'],
  ];
  // Under a day the "0 days" well is noise
  const shown = parts[0][0] === 0 ? parts.slice(1) : parts;
  return (
    <div className={`kickoff-countdown kickoff-countdown-${size}`} role="timer" aria-label={`${event ? 'Starts' : 'Kick-off'} in ${shown.map(([n, u]) => `${n} ${u}`).join(' ')}`}>
      {shown.map(([n, unit]) => (
        <div key={unit} className="kickoff-countdown-cell" aria-hidden="true">
          <span className="kickoff-countdown-num">{n}</span>
          <span className="kickoff-countdown-unit">{unit === 'days' && n === 1 ? 'day' : unit === 'hrs' && n === 1 ? 'hr' : unit === 'mins' && n === 1 ? 'min' : unit}</span>
        </div>
      ))}
    </div>
  );
}
