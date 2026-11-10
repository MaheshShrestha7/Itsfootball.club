// A substitution is one match event: `player_name` is the player coming on, and the player going off
// is in its sentence ("Substitution: Sam Lee ON, Joe Kerr OFF."). Every screen reads it here, so the
// Match Centre popup, minutes played, the pitch and the public timeline agree on who went off.
import type { MatchEvent } from './supabase/types';

const SUB_RE = /^Substitution: (.+?) ON, (.+?) OFF\.?/;

/** The sentence saved with a substitution */
export function subDetail(onName: string, offName: string): string {
  return `Substitution: ${onName} ON, ${offName} OFF.`;
}

/** Who came on and who went off, or null when the event isn't a substitution saved by Match Centre */
export function subPlayers(e: Pick<MatchEvent, 'event_type' | 'player_name' | 'detail_text'>): { on: string; off: string } | null {
  if (e.event_type !== 'sub') return null;
  const m = SUB_RE.exec((e.detail_text || '').trim());
  if (!m) return null;
  return { on: m[1].trim(), off: m[2].trim() };
}

const same = (a: string | undefined, b: string | undefined) => !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();

/** Whether `name` was taken off in any of these events (whole name, so "Sam" isn't "Samuel") */
export function wasSubbedOff(events: Pick<MatchEvent, 'event_type' | 'player_name' | 'detail_text'>[], name: string): boolean {
  return events.some(e => same(subPlayers(e)?.off, name));
}

/** Whether `name` came on as a substitute */
export function cameOn(events: Pick<MatchEvent, 'event_type' | 'player_name' | 'detail_text'>[], name: string): boolean {
  return events.some(e => e.event_type === 'sub' && same(subPlayers(e)?.on || e.player_name, name));
}

/**
 * Minutes each player was on the pitch, by name (lower case): starters from 0, a sub from the minute
 * they came on, until they were taken off or sent off, else the final whistle.
 */
export function minutesOnPitch(
  starters: string[],
  events: Pick<MatchEvent, 'event_type' | 'player_name' | 'detail_text' | 'minute'>[],
  fullMinutes: number
): Record<string, number> {
  const key = (n: string) => n.trim().toLowerCase();
  const clamp = (m: number) => Math.min(Math.max(m, 0), fullMinutes);
  const on = new Map<string, number>();
  starters.filter(Boolean).forEach(n => on.set(key(n), 0));
  const off = new Map<string, number>();
  const leave = (name: string, minute: number) => {
    const k = key(name);
    if (!off.has(k) || minute < off.get(k)!) off.set(k, minute);
  };
  for (const e of [...events].sort((a, b) => a.minute - b.minute)) {
    if (e.event_type === 'sub') {
      const names = subPlayers(e);
      const inName = names?.on || e.player_name;
      if (inName && !on.has(key(inName))) on.set(key(inName), clamp(e.minute));
      if (names?.off) leave(names.off, clamp(e.minute));
    } else if (e.event_type === 'red_card' && e.player_name) {
      leave(e.player_name, clamp(e.minute));
    }
  }
  const out: Record<string, number> = {};
  on.forEach((start, k) => { out[k] = Math.max(0, (off.get(k) ?? fullMinutes) - start); });
  return out;
}
