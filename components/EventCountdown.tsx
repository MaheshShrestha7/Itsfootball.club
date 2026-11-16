'use client';

import React, { useEffect, useState, useSyncExternalStore } from 'react';
import LocalTime from '@/components/LocalTime';

const subscribeNothing = () => () => {};

/** Days, hours, minutes and seconds to `start`, ticking each second once hydrated (null before, or once started) */
function useLeft(start: number) {
  const hydrated = useSyncExternalStore(subscribeNothing, () => true, () => false);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  if (!hydrated) return null;
  const s = Math.max(0, Math.floor((start - now) / 1000));
  return { days: Math.floor(s / 86400), hrs: Math.floor((s % 86400) / 3600), mins: Math.floor((s % 3600) / 60), secs: s % 60, done: s === 0 };
}

const pad = (n: number) => String(n).padStart(2, '0');

/** The day and the countdown at the top of an upcoming event page, on a block in the club's colour */
export default function EventCountdown({ startTime, endTime }: { startTime: string; endTime?: string }) {
  const left = useLeft(new Date(startTime).getTime());
  const time = (
    <>
      <LocalTime value={startTime} format="time" options={{ hour: 'numeric', minute: '2-digit' }} />
      {endTime && <> to <LocalTime value={endTime} format="time" options={{ hour: 'numeric', minute: '2-digit' }} /></>}
    </>
  );
  const label = left && !left.done ? `Starts in ${left.days} days ${left.hrs} hours ${left.mins} minutes` : undefined;

  // Club colour: the day on the left, white tiles counting down on the right (under a day: hours, minutes, seconds)
  const tiles = !left ? [] : left.days > 0
    ? [[left.days, left.days === 1 ? 'day' : 'days'], [left.hrs, left.hrs === 1 ? 'hour' : 'hours'], [left.mins, left.mins === 1 ? 'minute' : 'minutes']]
    : [[left.hrs, left.hrs === 1 ? 'hour' : 'hours'], [left.mins, left.mins === 1 ? 'minute' : 'minutes'], [left.secs, 'seconds']];
  return (
    <div className="ecd-club">
      <div className="ecd-club-day">
        <b><LocalTime value={startTime} format="ordinal" /></b>
        <span>{time}</span>
      </div>
      {left && (left.done ? <p className="ecd-club-now">Happening now</p> : (
        <div className="ecd-club-count" role="timer" aria-label={label}>
          <span className="ecd-club-label">Starts in</span>
          <div className="ecd-club-tiles">
            {tiles.map(([n, u], i) => (
              <div key={String(u)} className="ecd-club-tile" style={{ '--i': i } as React.CSSProperties} aria-hidden="true"><b key={String(n)} className="ecd-tick">{i === 0 ? n : pad(Number(n))}</b><span>{u}</span></div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
