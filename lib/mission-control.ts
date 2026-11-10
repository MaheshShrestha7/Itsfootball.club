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

/** The pages of Mission Control, in menu order. */
export type MissionTab = 'today' | 'support' | 'overview' | 'clubs' | 'users' | 'grounds' | 'health' | 'broadcasts' | 'log';
export const MISSION_TABS: MissionTab[] = ['today', 'support', 'clubs', 'users', 'overview', 'grounds', 'health', 'broadcasts', 'log'];

/** Where Mission Control is, from the web address: ?tab=support&request=<id>, ?tab=clubs&club=<id>.
 *  Unknown or missing values fall back to Today with nothing open. ?tab=cockpit (an old link) opens the Overview. */
export function readMissionUrl(search: string): { tab: MissionTab; club: string | null; request: string | null } {
  const q = new URLSearchParams(search);
  const raw = q.get('tab') || '';
  const tab: MissionTab = raw === 'cockpit' ? 'overview' : (MISSION_TABS as string[]).includes(raw) ? raw as MissionTab : 'today';
  const clean = (v: string | null) => (v && /^[A-Za-z0-9_-]{1,80}$/.test(v) ? v : null);
  return { tab, club: clean(q.get('club')), request: tab === 'support' ? clean(q.get('request')) : null };
}

/** The search string for a change of place. `undefined` keeps a value, `null` removes it. Today has no ?tab. */
export function missionUrl(search: string, change: { tab?: MissionTab; club?: string | null; request?: string | null }): string {
  const q = new URLSearchParams(search);
  if (change.tab !== undefined) {
    if (change.tab === 'today') q.delete('tab'); else q.set('tab', change.tab);
    if (change.tab !== 'support') q.delete('request');
  }
  for (const key of ['club', 'request'] as const) {
    const v = change[key];
    if (v === null) q.delete(key);
    else if (v !== undefined) q.set(key, v);
  }
  const out = q.toString();
  return out ? `?${out}` : '';
}

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

export type QueueKind = 'backlog' | 'transfers' | 'enquiries' | 'payments' | 'stalled' | 'welcome';
export type EmailAudience = 'owner' | 'admins';

/** Which filter chip on Today a kind sits under */
export const QUEUE_GROUP: Record<QueueKind, 'money' | 'clubs' | 'new'> = {
  transfers: 'money', payments: 'money', backlog: 'clubs', enquiries: 'clubs', stalled: 'clubs', welcome: 'new',
};

export interface QueueItem {
  /** Also the snooze key. Keys that can come back (a new backlog, new transfers) carry the date the
   *  current one started, so marking one done never hides the next. */
  key: string;
  kind: QueueKind;
  club: PlatformClubItem;
  title: string;
  detail: string;
  action: { label: string; template: TemplateKey; to: EmailAudience };
}

/** Per-club counts from get_platform_today() (migration 20261163) */
export interface ClubBacklog { club_id: string; count: number; oldest: string }
export interface TodayExtras { transfers?: ClubBacklog[]; enquiries?: ClubBacklog[] }

const days = (from: string | null | undefined, now: number) => (from ? Math.floor((now - new Date(from).getTime()) / DAY) : 0);
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const dayOf = (v: string | null | undefined) => (v ? String(v).slice(0, 10) : 'none');

/** Every club item that applies right now, done or snoozed or not. */
export function queueItems(clubs: PlatformClubItem[], now: number = Date.now(), extras: TodayExtras = {}): QueueItem[] {
  const out: QueueItem[] = [];
  const transfers = new Map((extras.transfers || []).map(t => [t.club_id, t]));
  const enquiries = new Map((extras.enquiries || []).map(t => [t.club_id, t]));
  for (const c of clubs) {
    if (!c.is_active) continue;
    const age = days(c.created_at, now);

    const waitDays = days(c.oldest_pending_at, now);
    if (c.pending_count >= 5 || (c.pending_count > 0 && waitDays >= 7)) {
      out.push({
        key: `backlog:${c.id}:${dayOf(c.oldest_pending_at)}`, kind: 'backlog', club: c,
        title: `${c.name} has ${plural(c.pending_count, 'person', 'people')} waiting for approval`,
        detail: c.oldest_pending_at ? `The oldest has waited ${plural(waitDays, 'day')}.` : 'Applications are piling up.',
        action: { label: 'Nudge the club admins', template: 'approvals', to: 'admins' },
      });
    }

    const t = transfers.get(c.id);
    if (t && t.count > 0) {
      out.push({
        key: `transfers:${c.id}:${dayOf(t.oldest)}`, kind: 'transfers', club: c,
        title: `${c.name} has ${plural(Number(t.count), 'bank transfer')} to check`,
        detail: `The oldest has waited ${plural(days(t.oldest, now), 'day')}. Members show as unpaid until a club admin ticks them off.`,
        action: { label: 'Nudge the club admins', template: 'transfers', to: 'admins' },
      });
    }

    const e = enquiries.get(c.id);
    if (e && e.count > 0) {
      out.push({
        key: `enquiries:${c.id}:${dayOf(e.oldest)}`, kind: 'enquiries', club: c,
        title: `${c.name} hasn't read ${plural(Number(e.count), 'enquiry', 'enquiries')}`,
        detail: `Sent through the club's Message the club form. The oldest is ${plural(days(e.oldest, now), 'day')} old.`,
        action: { label: 'Remind the club admins', template: 'enquiries', to: 'admins' },
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
  const order: Record<QueueKind, number> = { transfers: 0, backlog: 1, enquiries: 2, payments: 3, stalled: 4, welcome: 5 };
  return out.sort((a, b) => order[a.kind] - order[b.kind]);
}

/** Clubs that need the founder, most urgent first. `snoozed` holds keys whose snooze hasn't run out. */
export function buildQueue(clubs: PlatformClubItem[], snoozed: Set<string>, now: number = Date.now(), extras: TodayExtras = {}): QueueItem[] {
  return queueItems(clubs, now, extras).filter(i => !snoozed.has(i.key));
}

/** A snooze until this date or later means "done". */
export const DONE_UNTIL = '2100-01-01T00:00:00Z';
export const isDoneSnooze = (until: string) => new Date(until).getTime() >= new Date('2099-01-01T00:00:00Z').getTime();

/** The site-wide Today items (not tied to one club) use these key prefixes */
export const SITE_KEY_PREFIXES = ['crashes:', 'grounds:'];
const CLUB_KEY_PREFIXES = ['backlog:', 'transfers:', 'enquiries:', 'payments:', 'stalled:', 'welcome:'];

/** "Done" keys whose problem has gone away, so they can be cleared and the problem shows again if
 *  it comes back. Only keys Today owns, and only once every source has loaded (`live` is complete). */
export function staleDoneKeys(done: string[], live: Set<string>): string[] {
  const ours = [...CLUB_KEY_PREFIXES, ...SITE_KEY_PREFIXES];
  return done.filter(k => ours.some(p => k.startsWith(p)) && !live.has(k));
}

// ------------------------------------------------------------------------------------------------
// Emails to clubs (edited before sending; plain text)
// ------------------------------------------------------------------------------------------------

// ------------------------------------------------------------------------------------------------
// System health: turns what platform_events and a few live checks say into traffic lights
// ------------------------------------------------------------------------------------------------

export type Light = 'green' | 'amber' | 'red' | 'grey';
export interface HealthSignal { key: string; label: string; light: Light; summary: string }

/** Scheduled jobs (worker.ts + wrangler.json) and how often each should run */
export const JOBS: Record<string, { label: string; everyHours: number }> = {
  reminders: { label: 'Daily reminder emails', everyHours: 24 },
  indexnow: { label: 'Search engine ping (hourly)', everyHours: 1 },
  health: { label: 'Health check and alerts (hourly)', everyHours: 1 },
};

export interface JobRun { name: string; lastAt: string | null; lastOk: boolean | null; lastOkAt: string | null }

export interface HealthInput {
  emailsSent24: number;
  emailsFailed24: number;
  jobs: JobRun[];
  stripe: { events24: number; failed24: number; lastAt: string | null; connected: number; needDetails: number };
  /** null: Cloudflare isn't set up, or the check was skipped */
  domains: { total: number; pending: string[] } | null;
  dbMs: number;
}

const ago = (iso: string | null, now: number) => (iso ? timeAgo(iso, now) : 'never');

export function healthSignals(i: HealthInput, now: number = Date.now()): HealthSignal[] {
  const out: HealthSignal[] = [];

  const total = i.emailsSent24 + i.emailsFailed24;
  const rate = total ? i.emailsFailed24 / total : 0;
  out.push({
    key: 'email', label: 'Emails',
    light: i.emailsFailed24 === 0 ? 'green' : i.emailsFailed24 >= 10 || rate >= 0.05 ? 'red' : 'amber',
    summary: `${i.emailsSent24.toLocaleString()} club emails sent, ${i.emailsFailed24} failed in 24 hours${total ? ` (${(rate * 100).toFixed(1)}%)` : ''}.`,
  });

  for (const j of i.jobs) {
    const job = JOBS[j.name] || { label: j.name, everyHours: 24 };
    const late = j.lastAt ? now - new Date(j.lastAt).getTime() > (job.everyHours * 1.5 * 60 + 15) * 60000 : false;
    out.push({
      key: `job:${j.name}`, label: job.label,
      light: !j.lastAt ? 'grey' : late || j.lastOk === false ? 'red' : 'green',
      summary: !j.lastAt ? 'No run recorded yet.'
        : late ? `Last ran ${ago(j.lastAt, now)}, expected every ${job.everyHours === 1 ? 'hour' : `${job.everyHours} hours`}.`
        : j.lastOk === false ? `Last run failed ${ago(j.lastAt, now)}. Last good run ${ago(j.lastOkAt, now)}.`
        : `Ran ${ago(j.lastAt, now)}.`,
    });
  }

  const s = i.stripe;
  out.push({
    key: 'stripe', label: 'Stripe payments',
    light: s.failed24 > 0 ? 'red' : s.needDetails > 0 ? 'amber' : 'green',
    summary: `${s.events24} webhooks in 24 hours${s.failed24 ? `, ${s.failed24} failed` : ', all handled'}. ${s.connected} clubs connected${s.needDetails ? `, ${s.needDetails} can't take payments yet` : ''}.${s.lastAt ? ` Last webhook ${ago(s.lastAt, now)}.` : ''}`,
  });

  out.push(i.domains
    ? {
      key: 'domains', label: 'Custom domains',
      light: i.domains.pending.length ? 'amber' : 'green',
      summary: i.domains.total === 0 ? 'No clubs use their own domain yet.'
        : `${i.domains.total - i.domains.pending.length} of ${i.domains.total} live with a secure certificate.${i.domains.pending.length ? ` Waiting: ${i.domains.pending.join(', ')}.` : ''}`,
    }
    : { key: 'domains', label: 'Custom domains', light: 'grey', summary: 'Not checked.' });

  out.push({
    key: 'db', label: 'Database',
    light: i.dbMs < 300 ? 'green' : i.dbMs < 800 ? 'amber' : 'red',
    summary: `Answered in ${i.dbMs} ms from the server.`,
  });
  return out;
}

/** Saved replies for the support inbox; inserted at the cursor, then edited */
export const SUPPORT_SNIPPETS: { label: string; text: string }[] = [
  { label: 'Stripe setup', text: 'To take fees by card, open Finance in your admin area and choose "Connect Stripe". It takes about five minutes, and fees go straight to the club\'s bank account.' },
  { label: 'Custom domain', text: 'To use your own web address, open Club Profile & Branding, add the domain, then add the DNS record it shows at your domain provider. It can take up to a day to start working.' },
  { label: 'Not built yet', text: 'That isn\'t something itsfootball.club does yet, but I\'ve noted it as a feature request. Thanks for telling me.' },
  { label: 'Fixed', text: 'Thanks for reporting this. It\'s fixed now. Let me know if you still see it.' },
];

export type TemplateKey = 'blank' | 'welcome' | 'needHand' | 'stripe' | 'approvals' | 'transfers' | 'enquiries' | 'suspended' | 'closing';

export const TEMPLATE_LABELS: Record<TemplateKey, string> = {
  blank: 'Blank',
  welcome: 'Welcome',
  needHand: 'Need a hand?',
  stripe: 'Stripe setup',
  approvals: 'People waiting',
  transfers: 'Bank transfers to check',
  enquiries: 'Unread enquiries',
  suspended: 'Club suspended',
  closing: 'Club closing',
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
    case 'transfers':
      return {
        subject: `Bank transfers waiting at ${club.name}`,
        message: `${hi}\n\nA few members of ${club.name} have paid by bank transfer and are waiting for someone to tick off their payment. Until then they show as unpaid.\n\nYou can check them in Finance:\n\n${admin}/finance\n\nCheers`,
      };
    case 'enquiries':
      return {
        subject: `Unread messages for ${club.name}`,
        message: `${hi}\n\nA few people have sent ${club.name} a message through the club's website and haven't heard back yet. They might be new players or sponsors.\n\nYou can read and reply to them here:\n\n${admin}/inquiries\n\nCheers`,
      };
    case 'suspended':
      return {
        subject: `${club.name} has been paused on itsfootball.club`,
        message: `${hi}\n\nI've paused ${club.name} on itsfootball.club, so its public pages are offline for now.\n\nReason: [REASON]\n\nReply to this email if you have questions or want it switched back on.\n\nCheers`,
      };
    case 'closing':
      return {
        subject: `${club.name} is closing on itsfootball.club`,
        message: `${hi}\n\nAs agreed, I've closed ${club.name} on itsfootball.club. Its pages are offline now, and everything will be deleted for good in 30 days.\n\nI've downloaded a copy of all the club's records (spreadsheets of members, fixtures, payments and more). Reply if you'd like it.\n\nIf you change your mind before then, reply to this email and I'll switch it back on with nothing lost.\n\nCheers`,
      };
    default:
      return { subject: '', message: `${hi}\n\n` };
  }
}

// ------------------------------------------------------------------------------------------------
// Overview (get_platform_overview, migration 20261149)
// ------------------------------------------------------------------------------------------------

/** The features the Overview counts, in the order shown. Keys match get_platform_overview's usage. */
export const FEATURES: { key: string; label: string }[] = [
  { key: 'fixtures', label: 'Fixtures and results' },
  { key: 'availability', label: 'Availability' },
  { key: 'lineups', label: 'Line-ups' },
  { key: 'match_centre', label: 'Live Match Centre' },
  { key: 'news', label: 'News' },
  { key: 'sponsors', label: 'Sponsors' },
  { key: 'messages', label: 'Messages to members' },
  { key: 'events', label: 'Events and tickets' },
  { key: 'gate', label: 'Door scans' },
  { key: 'tournaments', label: 'Tournaments' },
  { key: 'gallery', label: 'Gallery' },
  { key: 'shop', label: 'Shop' },
  { key: 'perks', label: 'Member perks' },
  { key: 'finances', label: 'Club finances' },
  { key: 'push', label: 'Phone notifications' },
];

/** Change against the previous period, as a whole percent; null when there's nothing to compare with. */
export function pctChange(now: number, prev: number): number | null {
  if (!prev) return null;
  return Math.round(((now - prev) / prev) * 100);
}

/** "+12%", "-3%", "0%"; '' when there's nothing to compare with */
export function changeLabel(now: number, prev: number): string {
  const p = pctChange(now, prev);
  return p === null ? '' : `${p > 0 ? '+' : ''}${p}%`;
}

export interface FunnelStep { key: string; label: string; clubs: PlatformClubItem[] }

/** How many open clubs got to each setup step (setupSteps), for the growth funnel. Signed up first. */
export function setupFunnel(clubs: PlatformClubItem[], now: number = Date.now()): FunnelStep[] {
  const open = clubs.filter(c => c.is_active && !c.closed_at);
  const keys: [string, string][] = [['logo', 'Logo and colours'], ['team', 'First team'], ['fixture', 'First fixture'], ['members', '10+ members approved'], ['active', 'Admin active in 14 days']];
  const steps: FunnelStep[] = [{ key: 'signed_up', label: 'Signed up', clubs: open }];
  for (const [key, label] of keys) {
    steps.push({ key, label, clubs: open.filter(c => setupSteps(c, now).find(s => s.key === key)?.done) });
  }
  return steps;
}

/** Open clubs where no admin has signed in for 14 days (or ever) */
export function quietClubs(clubs: PlatformClubItem[], now: number = Date.now()): PlatformClubItem[] {
  return clubs.filter(c => c.is_active && !c.closed_at && !setupSteps(c, now).find(s => s.key === 'active')?.done);
}

export const SOURCE_LABEL: Record<string, string> = {
  search: 'Search engines', direct: 'Direct or app', social: 'Social media', ai: 'AI assistants', other: 'Other websites', internal: 'From our own pages',
};
export const METHOD_LABEL: Record<string, string> = { stripe: 'Card', bank_transfer: 'Bank transfer', cash: 'Cash', other: 'Other' };
export const KIND_LABEL: Record<string, string> = {
  membership_signup: 'Memberships', membership_renewal: 'Renewals', sponsorship: 'Sponsorship', event_ticket: 'Event tickets', shop_order: 'Shop', fee_request: 'Fee requests', income_other: 'Other income',
};
export const GROUP_LABEL: Record<string, string> = {
  home: 'Homepage', tools: 'Free tools', guides: 'Guides', grounds: 'Grounds', compare: 'Compare pages', tournaments: 'Tournaments',
  pricing: 'Pricing', about: 'About', faq: 'FAQ', 'create-club': 'Create a club', clubs: 'Clubs directory', 'live-scores': 'Live scores',
  'best-free-football-club-website-builders-australia': 'Best builders page', privacy: 'Privacy', terms: 'Terms',
};

/** "/tools/lineup-builder" -> "Lineup builder"; "/" -> "Homepage" */
export function pageLabel(path: string): string {
  if (!path || path === '/') return 'Homepage';
  const last = path.split('?')[0].replace(/\/+$/, '').split('/').filter(Boolean).pop() || path;
  const words = decodeURIComponent(last).replace(/[-_]+/g, ' ').trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : path;
}

/** Sorted [key, value] pairs, biggest first, without zeros */
export function ranked(rec: Record<string, number> | null | undefined): [string, number][] {
  return Object.entries(rec || {}).map(([k, v]) => [k, Number(v) || 0] as [string, number]).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
}

/** n bars from a daily series (newest last), each the sum of its days, scaled 0-100 against the tallest */
export function sparkBars(values: number[], n = 12): number[] {
  if (!values.length) return new Array(n).fill(0);
  const size = Math.max(1, Math.ceil(values.length / n));
  const sums: number[] = [];
  // Group from the newest end so the last bar is always the latest days
  for (let end = values.length; end > 0 && sums.length < n; end -= size) {
    sums.unshift(values.slice(Math.max(0, end - size), end).reduce((a, b) => a + (Number(b) || 0), 0));
  }
  const max = Math.max(...sums);
  return sums.map(v => (max > 0 ? Math.round((v / max) * 100) : 0));
}
