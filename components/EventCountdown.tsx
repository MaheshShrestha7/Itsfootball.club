'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import LocalTime from '@/components/LocalTime';
import { Lamps } from '@/components/StadiumBoard';

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

/** The day and the countdown at the top of an upcoming event page, in one of three looks */
export default function EventCountdown({ startTime, endTime, look }: { startTime: string; endTime?: string; look: 'board' | 'ticket' | 'band' }) {
  const left = useLeft(new Date(startTime).getTime());
  const time = (
    <>
      <LocalTime value={startTime} format="time" options={{ hour: 'numeric', minute: '2-digit' }} />
      {endTime && <> to <LocalTime value={endTime} format="time" options={{ hour: 'numeric', minute: '2-digit' }} /></>}
    </>
  );
  const label = left && !left.done ? `Starts in ${left.days} days ${left.hrs} hours ${left.mins} minutes` : undefined;
  const cells = left ? [[left.days, left.days === 1 ? 'day' : 'days'], [left.hrs, 'hrs'], [left.mins, 'mins'], [left.secs, 'secs']] as const : [];

  if (look === 'board') {
    // Date in plain type above; the board does one job: days, hours and minutes, with a blinking lamp colon
    const groups = left ? [[left.days, left.days === 1 ? 'Day' : 'Days'], [left.hrs, left.hrs === 1 ? 'Hour' : 'Hours'], [left.mins, left.mins === 1 ? 'Minute' : 'Minutes']] as const : [];
    return (
      <div className="ecd-wrap">
        <p className="ecd-date"><b><LocalTime value={startTime} format="ordinal" /></b><span>{time}</span></p>
        <div className="stb ecd-board">
          <p className="ecd-board-title">Starts in</p>
          {left && (left.done ? <p className="stb-word ecd-now">Happening now</p> : (
            <div className="ecd-board-cells" role="timer" aria-label={label}>
              {groups.map(([n, u], i) => (
                <div key={u} className="ecd-board-group">
                  {i > 0 && <span className={`stb-lamps ecd-colon${left.secs % 2 ? ' is-off' : ''}`} aria-hidden="true"><Lamps text=":" /></span>}
                  <div className="ecd-board-cell">
                    <span className="stb-lamps"><Lamps text={i === 0 ? String(n) : pad(n)} /></span>
                    <span className="ecd-board-unit" aria-hidden="true">{u}</span>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (look === 'ticket') {
    return (
      <div className="ecd-ticket">
        <div className="ecd-ticket-main">
          <b><LocalTime value={startTime} format="ordinal" /></b>
          <span className="ecd-ticket-time">{time}</span>
        </div>
        {left && (
          <div className="ecd-ticket-stub" role="timer" aria-label={label}>
            {left.done ? <b className="ecd-ticket-now">Happening now</b> : <>
              <span>Starts in</span>
              <b>{left.days > 0 ? left.days : left.hrs}</b>
              <span>{left.days > 0 ? (left.days === 1 ? 'day' : 'days') : 'hours'}</span>
              <small aria-hidden="true">{left.days > 0 ? `${left.hrs}h ` : ''}{pad(left.mins)}m {pad(left.secs)}s</small>
            </>}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="ecd-band">
      <p className="ecd-band-date"><LocalTime value={startTime} format="ordinal" /><span>{time}</span></p>
      {left && (left.done ? <p className="ecd-band-now">Happening now</p> : (
        <div className="ecd-band-cells" role="timer" aria-label={label}>
          {cells.map(([n, u]) => (
            <div key={u} aria-hidden="true"><b>{u === 'days' || u === 'day' ? n : pad(n)}</b><span>{u}</span></div>
          ))}
        </div>
      ))}
    </div>
  );
}
