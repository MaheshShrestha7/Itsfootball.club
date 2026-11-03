// Small pure helpers for the Mission Control (super admin) dashboard. Checked by mission-control.check.ts.
import type { PlatformClubItem, PlatformDailyTrend } from './supabase/types';

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
export type MissionTab = 'today' | 'cockpit' | 'clubs' | 'users' | 'grounds' | 'health' | 'broadcasts' | 'log';

// ------------------------------------------------------------------------------------------------
// Club setup and the Today queue
// ------------------------------------------------------------------------------------------------

export interface SetupStep { key: string; label: string; done: boolean }

/** The steps a club needs to be up and running. Card payments only count for clubs that charge to join. */
export function setupSteps(c: PlatformClubItem, now: number = Date.now()): SetupStep[] {
  const seen = c.admin_last_seen_at ? new Date(c.admin_last_seen_at).getTime() : 0;
  const steps: SetupStep[] = [
    { key: 'logo', label: 'Logo and club colours', done: !!c.logo_url },
    { key: 'team', label: 'First team created', done: c.team_count > 0 },
    { key: 'fixture', label: 'First fixture added', done: c.match_count > 0 },
    { key: 'members', label: '10+ members approved', done: (c.approved_count ?? c.member_count - c.pending_count) >= 10 },
    { key: 'active', label: 'An admin signed in within 14 days', done: now - seen <= 14 * DAY },
  ];
  if (c.membership_payment_policy === 'require_payment') {
    steps.push({ key: 'stripe', label: 'Takes card payments (Stripe)', done: c.stripe_ready });
  }
  return steps;
}

export type QueueKind = 'backlog' | 'payments' | 'stalled' | 'welcome';
export type EmailAudience = 'owner' | 'admins';

export interface QueueItem {
  /** Also the snooze key */
  key: string;
  kind: QueueKind;
  club: PlatformClubItem;
  title: string;
  detail: string;
  action: { label: string; template: TemplateKey; to: EmailAudience };
}

const days = (from: string | null | undefined, now: number) => (from ? Math.floor((now - new Date(from).getTime()) / DAY) : 0);
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Clubs that need the founder, most urgent first. `snoozed` holds keys whose snooze hasn't run out. */
export function buildQueue(clubs: PlatformClubItem[], snoozed: Set<string>, now: number = Date.now()): QueueItem[] {
  const out: QueueItem[] = [];
  for (const c of clubs) {
    if (!c.is_active) continue;
    const age = days(c.created_at, now);

    const waitDays = days(c.oldest_pending_at, now);
    if (c.pending_count >= 5 || (c.pending_count > 0 && waitDays >= 7)) {
      out.push({
        key: `backlog:${c.id}`, kind: 'backlog', club: c,
        title: `${c.name} has ${plural(c.pending_count, 'person', 'people')} waiting for approval`,
        detail: c.oldest_pending_at ? `Oldest has waited ${plural(waitDays, 'day')}.` : 'Applications are piling up.',
        action: { label: 'Nudge the club admins', template: 'approvals', to: 'admins' },
      });
    }

    if (c.membership_payment_policy === 'require_payment' && !c.stripe_ready && age >= 3) {
      out.push({
        key: `payments:${c.id}`, kind: 'payments', club: c,
        title: `${c.name} charges to join but can't take cards`,
        detail: 'Members must pay to join, and Stripe is not connected, so every fee is a bank transfer to check by hand.',
        action: { label: 'Email the Stripe steps', template: 'stripe', to: 'owner' },
      });
    }

    const steps = setupSteps(c, now);
    const done = steps.filter(s => s.done).length;
    if (age >= 7 && done < 3) {
      const missing = steps.filter(s => !s.done).map(s => s.label.toLowerCase());
      out.push({
        key: `stalled:${c.id}`, kind: 'stalled', club: c,
        title: `${c.name} stalled at setup, ${done} of ${steps.length}`,
        detail: `Signed up ${plural(age, 'day')} ago. Still to do: ${missing.slice(0, 3).join(', ')}.`,
        action: { label: 'Send "need a hand?"', template: 'needHand', to: 'owner' },
      });
    } else if (age < 7) {
      out.push({
        key: `welcome:${c.id}`, kind: 'welcome', club: c,
        title: `${c.name} joined ${age === 0 ? 'today' : `${plural(age, 'day')} ago`}`,
        detail: `Setup ${done} of ${steps.length}. Say hello while they're keen.`,
        action: { label: 'Send a welcome', template: 'welcome', to: 'owner' },
      });
    }
  }
  const order: Record<QueueKind, number> = { backlog: 0, payments: 1, stalled: 2, welcome: 3 };
  return out.filter(i => !snoozed.has(i.key)).sort((a, b) => order[a.kind] - order[b.kind]);
}

// ------------------------------------------------------------------------------------------------
// Emails to clubs (edited before sending; plain text)
// ------------------------------------------------------------------------------------------------

export type TemplateKey = 'blank' | 'welcome' | 'needHand' | 'stripe' | 'approvals' | 'suspended';

export const TEMPLATE_LABELS: Record<TemplateKey, string> = {
  blank: 'Blank',
  welcome: 'Welcome',
  needHand: 'Need a hand?',
  stripe: 'Stripe setup',
  approvals: 'People waiting',
  suspended: 'Club suspended',
};

/** Subject and body for a template. `firstName` may be empty. */
export function emailTemplate(key: TemplateKey, club: { name: string; slug: string }, firstName = '', origin = 'https://itsfootball.club'): { subject: string; message: string } {
  const hi = `Hi${firstName ? ` ${firstName}` : ''},`;
  const admin = `${origin}/${club.slug}/admin`;
  switch (key) {
    case 'welcome':
      return {
        subject: `Welcome to itsfootball.club, ${club.name}`,
        message: `${hi}\n\nThanks for setting up ${club.name}. I run itsfootball.club, so if anything is confusing or missing, just reply to this email and I'll help.\n\nYour admin area: ${admin}\n\nCheers`,
      };
    case 'needHand':
      return {
        subject: `Need a hand setting up ${club.name}?`,
        message: `${hi}\n\nI noticed ${club.name} is part-way through setup. Most clubs get going by adding a team and their first fixture, which takes about five minutes.\n\nIf something got in the way, reply and tell me. I'm happy to help or set it up with you.\n\nYour admin area: ${admin}\n\nCheers`,
      };
    case 'stripe':
      return {
        subject: `Take membership fees by card at ${club.name}`,
        message: `${hi}\n\n${club.name} asks members to pay to join, but card payments aren't switched on yet, so each fee has to be checked by hand.\n\nConnecting Stripe takes about five minutes: open Finance in your admin area and choose "Connect Stripe". Fees then go straight to the club's bank account.\n\n${admin}/finance\n\nReply if you get stuck.\n\nCheers`,
      };
    case 'approvals':
      return {
        subject: `People are waiting to join ${club.name}`,
        message: `${hi}\n\nA few people have applied to join ${club.name} and are waiting for approval. You can approve them in a couple of clicks:\n\n${admin}/people?tab=applications\n\nCheers`,
      };
    case 'suspended':
      return {
        subject: `${club.name} has been paused on itsfootball.club`,
        message: `${hi}\n\nI've paused ${club.name} on itsfootball.club, so its public pages are offline for now.\n\nReason: [REASON]\n\nReply to this email if you have questions or want it switched back on.\n\nCheers`,
      };
    default:
      return { subject: '', message: `${hi}\n\n` };
  }
}
