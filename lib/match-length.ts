// How long a match is. Every game is two halves; the half length is stored on the match
// (`half_minutes`, copied from its team's usual length when the fixture is made) and falls back to
// the usual length for the format, so matches saved before the setting existed behave as before.
// The clock, stoppage time ("12+2'") and minutes played all read from here.

/** Usual half length by format, in minutes */
export const DEFAULT_HALF_MINUTES: Record<string, number> = { '5v5': 20, '7v7': 25, '9v9': 30, '11v11': 45 };

export const MIN_HALF_MINUTES = 1;
export const MAX_HALF_MINUTES = 60;

type LengthSource = { half_minutes?: number | null; match_format?: string | null } | null | undefined;

/** A stored half length when it's a usable number, else null */
export function validHalfMinutes(value: unknown): number | null {
  const n = Number(value);
  return Number.isInteger(n) && n >= MIN_HALF_MINUTES && n <= MAX_HALF_MINUTES ? n : null;
}

/** Minutes in one half of this match */
export function halfMinutes(match: LengthSource): number {
  return validHalfMinutes(match?.half_minutes) ?? DEFAULT_HALF_MINUTES[match?.match_format || ''] ?? 45;
}

/** Minutes in a full match (both halves, no extra time) */
export function fullMinutes(match: LengthSource): number {
  return halfMinutes(match) * 2;
}

/** Minutes in each half of extra time: 15 for a 45-minute half, about a third of the half otherwise */
export function extraHalfMinutes(match: LengthSource): number {
  const half = halfMinutes(match);
  return half >= 45 ? 15 : Math.max(1, Math.round(half / 3));
}

/** The minute the clock shows when each period starts (and when half time / full time is called) */
export function periodStartMinute(match: LengthSource, period: 'first_half' | 'second_half' | 'extra_time'): number {
  if (period === 'first_half') return 1;
  if (period === 'second_half') return halfMinutes(match) + 1;
  return fullMinutes(match) + 1;
}

/** The last normal minute of a running period; anything after it is stoppage time */
export function periodEndMinute(match: LengthSource, period: string | null | undefined): number | null {
  if (period === 'first_half') return halfMinutes(match);
  if (period === 'second_half') return fullMinutes(match);
  if (period === 'extra_time') return fullMinutes(match) + 2 * extraHalfMinutes(match);
  return null;
}

/** Highest minute the clock or a logged event can reach: end of extra time plus a generous 30 */
export function maxMinute(match: LengthSource): number {
  return fullMinutes(match) + 2 * extraHalfMinutes(match) + 30;
}

/** Splits a running-clock minute into the period minute and stoppage: 14 in a 12-minute first half is 12 + 2 */
export function splitMinute(match: LengthSource, period: string | null | undefined, minute: number): { minute: number; added: number } {
  const end = periodEndMinute(match, period);
  if (end === null || minute <= end) return { minute, added: 0 };
  return { minute: end, added: minute - end };
}

/** "12+2" during stoppage, else the plain minute */
export function clockLabel(match: LengthSource, period: string | null | undefined, minute: number): string {
  const s = splitMinute(match, period, minute);
  return s.added ? `${s.minute}+${s.added}` : String(s.minute);
}

/** A logged event's minute as people say it: "12+2" or "30" */
export function eventMinuteLabel(e: { minute: number; added_minute?: number | null }): string {
  return e.added_minute ? `${e.minute}+${e.added_minute}` : String(e.minute);
}

/** Orders events by minute, stoppage after the minute it belongs to */
export function compareEventMinute(a: { minute: number; added_minute?: number | null }, b: { minute: number; added_minute?: number | null }): number {
  return a.minute - b.minute || (a.added_minute || 0) - (b.added_minute || 0);
}

/** "2 × 12 min" */
export function lengthLabel(match: LengthSource): string {
  return `2 × ${halfMinutes(match)} min`;
}
