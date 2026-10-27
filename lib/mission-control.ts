// Small pure helpers for the Mission Control (super admin) dashboard. Checked by mission-control.check.ts.
import type { PlatformDailyTrend } from './supabase/types';

/** "Good morning" / "Good afternoon" / "Good evening" for an hour 0-23. */
export function greeting(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

/** First name for the banner greeting: the first word of the name, else the part of the email before @. */
export function firstName(fullName: string | null | undefined, email?: string | null): string {
  const n = (fullName || '').trim().split(/\s+/)[0];
  if (n) return n;
  return (email || '').split('@')[0] || '';
}

/** Up to two capital letters for an avatar: "Aisha Patel" -> "AP", "jess" -> "J". */
export function initials(name: string | null | undefined): string {
  const words = (name || '').replace(/@.*/, '').split(/[\s._-]+/).filter(Boolean);
  return words.slice(0, 2).map(w => w[0]!.toUpperCase()).join('') || '?';
}

/** Splits daily totals into `n` equal-ish buckets from oldest to newest (the newest bucket gets
 *  any remainder days), summing `pick` for each. Empty input gives n zeros. */
export function bucketTotals(trends: PlatformDailyTrend[], n: number, pick: (t: PlatformDailyTrend) => number): number[] {
  const out = new Array<number>(n).fill(0);
  if (!trends.length || n <= 0) return out;
  const size = Math.max(1, Math.floor(trends.length / n));
  const sorted = [...trends].sort((a, b) => a.date.localeCompare(b.date));
  // Line the buckets up against the newest day so the last bar is always "this week"
  sorted.forEach((t, i) => {
    const fromEnd = sorted.length - 1 - i;
    const idx = n - 1 - Math.floor(fromEnd / size);
    if (idx >= 0) out[idx] += Number(pick(t)) || 0;
  });
  return out;
}

const DAY = 86400000;
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export interface WeekDay { date: string; label: string; day: number; isToday: boolean; members: number; future: boolean }

/** Monday-to-Sunday strip for the week that holds `today` (shifted by `weekOffset` weeks), with each
 *  day's new members from the daily totals. Dates are local. */
export function weekStrip(trends: PlatformDailyTrend[], today: Date, weekOffset = 0): WeekDay[] {
  const byDate = new Map(trends.map(t => [t.date.slice(0, 10), Number(t.members) || 0]));
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const mondayShift = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - mondayShift + weekOffset * 7);
  const todayIso = iso(today);
  const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return labels.map((label, i) => {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const date = iso(d);
    return { date, label, day: d.getDate(), isToday: date === todayIso, members: byDate.get(date) || 0, future: date > todayIso };
  });
}

/** Month and year heading for a week strip, e.g. "October 2026"; spans two months as "Oct – Nov 2026". */
export function weekHeading(days: WeekDay[]): string {
  if (!days.length) return '';
  const a = new Date(`${days[0].date}T00:00:00`);
  const b = new Date(`${days[days.length - 1].date}T00:00:00`);
  const long = (d: Date) => d.toLocaleDateString('en-AU', { month: 'long' });
  const short = (d: Date) => d.toLocaleDateString('en-AU', { month: 'short' });
  if (a.getMonth() === b.getMonth()) return `${long(a)} ${a.getFullYear()}`;
  if (a.getFullYear() === b.getFullYear()) return `${short(a)} – ${short(b)} ${b.getFullYear()}`;
  return `${short(a)} ${a.getFullYear()} – ${short(b)} ${b.getFullYear()}`;
}

/** "just now", "5 min ago", "3 hours ago", "2 days ago", "3 weeks ago", else a date. */
export function timeAgo(value: string | null | undefined, now: number = Date.now()): string {
  if (!value) return '';
  const t = new Date(value).getTime();
  if (isNaN(t)) return '';
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} ${h === 1 ? 'hour' : 'hours'} ago`;
  const d = Math.round(h / 24);
  if (d < 14) return `${d} ${d === 1 ? 'day' : 'days'} ago`;
  const w = Math.round(d / 7);
  if (d < 60) return `${w} weeks ago`;
  return new Date(t).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Short age for a "newest clubs" tag: "Today", "3 days", "2 weeks", "4 months". */
export function shortAge(value: string, now: number = Date.now()): string {
  const d = Math.floor((now - new Date(value).getTime()) / DAY);
  if (!(d >= 1)) return 'Today';
  if (d < 14) return `${d} ${d === 1 ? 'day' : 'days'}`;
  if (d < 60) return `${Math.round(d / 7)} weeks`;
  return `${Math.round(d / 30)} months`;
}

/** Soft tint behind a club crest, from the club colour; falls back to the platform green. */
export function softTint(hex: string | null | undefined, alpha = 0.22): string {
  const m = /^#?([0-9a-f]{6})$/i.exec((hex || '').trim());
  const v = m ? m[1] : '10B981';
  const r = parseInt(v.slice(0, 2), 16), g = parseInt(v.slice(2, 4), 16), b = parseInt(v.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** The pages of Mission Control, in rail order. */
export type MissionTab = 'cockpit' | 'clubs' | 'users' | 'grounds' | 'health' | 'broadcasts';
