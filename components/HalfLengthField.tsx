'use client';

// The "Half length" setting: minus, the minutes, plus, and one helper line under it that an error
// replaces. Used on the team form (the team's usual length) and the fixture form (this game only).
// Both columns arrive with migration 20261151; until it runs the field stays hidden, so saving a
// team or fixture never sends a column the database doesn't have.

import { useEffect, useState, type ReactNode } from 'react';
import { getSupabaseClient } from '@/lib/supabase/client';
import { MAX_HALF_MINUTES, MIN_HALF_MINUTES } from '@/lib/match-length';

/** True once the database has the half-length columns (migration 20261151) */
export function useHalfLengthReady(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let live = true;
    getSupabaseClient()?.from('club_teams').select('half_minutes').limit(1)
      .then(({ error }) => { if (live) setReady(!error); });
    return () => { live = false; };
  }, []);
  return ready;
}

/** What a typed half length means: empty, a usable number of minutes, or out of range */
export function parseHalfMinutes(text: string): { empty: true } | { empty: false; minutes: number | null } {
  const t = text.trim();
  if (!t) return { empty: true };
  const n = Number(t);
  return { empty: false, minutes: Number.isInteger(n) && n >= MIN_HALF_MINUTES && n <= MAX_HALF_MINUTES ? n : null };
}

export const HALF_LENGTH_ERROR = `A half can be ${MIN_HALF_MINUTES} to ${MAX_HALF_MINUTES} minutes. For a 90-minute game, enter 45.`;

export default function HalfLengthField({ id, value, onChange, placeholder, helper, label = 'Half length' }: {
  id: string;
  /** The text in the box ('' = empty) */
  value: string;
  onChange: (text: string) => void;
  /** Shown when the box is empty: the length it falls back to */
  placeholder?: number;
  /** The helper line under the field; an out-of-range value shows the error here instead */
  helper: ReactNode;
  label?: string;
}) {
  const parsed = parseHalfMinutes(value);
  const invalid = !parsed.empty && parsed.minutes === null;
  const current = parsed.empty ? placeholder ?? MIN_HALF_MINUTES : parsed.minutes ?? Number(value) ?? MIN_HALF_MINUTES;
  const step = (delta: number) => {
    const from = Number.isFinite(current) ? current : MIN_HALF_MINUTES;
    onChange(String(Math.min(MAX_HALF_MINUTES, Math.max(MIN_HALF_MINUTES, Math.round(from) + delta))));
  };
  const helpId = `${id}-help`;

  return (
    <div className="hl-field">
      <label className="form-label" htmlFor={id}>{label}</label>
      <div className="hl-len">
        <div className="hl-step">
          <button type="button" className="hl-step-btn" onClick={() => step(-1)} disabled={current <= MIN_HALF_MINUTES} aria-label="One minute less">−</button>
          <input
            id={id}
            name="half_minutes"
            className="form-input hl-input"
            type="number"
            inputMode="numeric"
            min={MIN_HALF_MINUTES}
            max={MAX_HALF_MINUTES}
            step={1}
            value={value}
            placeholder={placeholder ? String(placeholder) : undefined}
            aria-invalid={invalid || undefined}
            aria-describedby={helpId}
            onChange={e => onChange(e.target.value)}
          />
          <button type="button" className="hl-step-btn" onClick={() => step(1)} disabled={current >= MAX_HALF_MINUTES} aria-label="One minute more">+</button>
        </div>
        <span className="hl-unit">min</span>
      </div>
      <p className={invalid ? 'hl-help is-error' : 'hl-help'} id={helpId}>{invalid ? HALF_LENGTH_ERROR : helper}</p>
    </div>
  );
}
