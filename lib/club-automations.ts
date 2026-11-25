// The rules behind the automatic club emails (AUTO-1, AUTO-3, AUTO-8), kept pure so they can be checked
// without a database (lib/club-automations.check.ts). The daily job is app/api/cron/reminders.
import { levelAtLeast, memberLabels } from './permissions';

const DAY = 86400000;
/** Whole days from `a` to `b` (both YYYY-MM-DD) */
export const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY);

/**
 * AUTO-3: which automatic reminder a fee request is due today: 1 in the 3 days before it's due, 2 from 3 days
 * after, 3 from 10 days after (a week later), none after 17 days. Each goes once, so a late bill skips to its step.
 */
export function feeReminderStep(dueOn: string, today: string): 1 | 2 | 3 | null {
  const late = daysBetween(dueOn, today);
  if (late >= -3 && late < 0) return 1;
  if (late >= 3 && late < 10) return 2;
  if (late >= 10 && late < 17) return 3;
  return null;
}

/** Today (YYYY-MM-DD) and its weekday (0 Sunday ... 6 Saturday) in a time zone */
export function localDay(now: number, timeZone: string): { date: string; weekday: number } {
  const date = new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date(now));
  return { date, weekday: new Date(`${date}T12:00:00Z`).getUTCDay() };
}

/** Labels that make someone a full club admin (member_is_admin in the database) */
const ADMIN_LABELS = ['owner', 'admin', 'club admin'];

/**
 * AUTO-1: the admin areas a person can see, from their squad labels and the club's access roles, as
 * has_club_perm works it out: 'all' for owners and club admins, else every area a role gives at least view.
 */
export function adminAreas(
  person: { role?: string | null; roles?: string[] | null },
  roles: { name: string; permissions: Record<string, string> | null }[],
): 'all' | Set<string> {
  const labels = memberLabels(person.role, person.roles).map(l => l.toLowerCase());
  if (labels.some(l => ADMIN_LABELS.includes(l))) return 'all';
  const areas = new Set<string>();
  for (const r of roles) {
    if (!labels.includes(r.name.trim().toLowerCase())) continue;
    for (const [area, level] of Object.entries(r.permissions || {})) if (levelAtLeast(level, 'view')) areas.add(area);
  }
  return areas;
}

/** A short fingerprint of what's waiting: the summary only goes out again when it changes */
export function summaryFingerprint(items: { key: string; count?: number }[]): string {
  const text = items.map(i => `${i.key}:${i.count ?? 1}`).sort().join('|');
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h * 33) ^ text.charCodeAt(i)) >>> 0;
  return `s${h.toString(36)}`;
}
