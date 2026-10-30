// The admin People page: who someone is at the club (player, junior, supporter, staff), where their
// membership stands and which checks need a look. Pure, so lib/people.check.ts can test it.
import type { ClubMember } from './supabase/types';
import { memberLabels } from './permissions';

export type PeopleGroup = 'everyone' | 'players' | 'juniors' | 'supporters' | 'staff' | 'attention';

/** Whole years from a 'YYYY-MM-DD' birth date to `today` */
export function ageOn(dateOfBirth: string, today = new Date()): number | null {
  const [y, m, d] = dateOfBirth.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return null;
  return today.getFullYear() - y - (today.getMonth() + 1 < m || (today.getMonth() + 1 === m && today.getDate() < d) ? 1 : 0);
}

const daysUntil = (date: string, today: Date) => {
  const day = new Date(/^\d{4}-\d{2}-\d{2}$/.test(date) ? `${date}T00:00:00` : date);
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((day.getTime() - start.getTime()) / 86_400_000);
};

/** Days before an expiry date that the page starts warning */
export const SOON_DAYS = 30;

export type MembershipState = 'active' | 'expiring' | 'expired' | 'suspended' | 'pending' | 'rejected';

export interface MembershipInfo {
  state: MembershipState;
  /** Days left (expiring) or days since (expired) */
  days?: number;
  expires?: string;
}

export function membershipInfo(m: Pick<ClubMember, 'membership_status' | 'membership_expires_at'>, today = new Date()): MembershipInfo {
  if (m.membership_status === 'pending') return { state: 'pending' };
  if (m.membership_status === 'rejected') return { state: 'rejected' };
  if (m.membership_status === 'suspended') return { state: 'suspended' };
  const expires = m.membership_expires_at || undefined;
  if (!expires) return { state: 'active' };
  const days = daysUntil(expires, today);
  if (isNaN(days)) return { state: 'active' };
  if (days < 0) return { state: 'expired', days: -days, expires };
  if (days <= SOON_DAYS) return { state: 'expiring', days, expires };
  return { state: 'active', expires };
}

type RoleFields = Pick<ClubMember, 'role' | 'roles' | 'is_executive' | 'executive_title'>;

/** Squad labels, with 'Player' for someone who has none (as Squad & Players showed them) */
export function personRoles(m: RoleFields): string[] {
  const labels = memberLabels(m.role, m.roles);
  return labels.length ? labels : ['Player'];
}

export const isSupporter = (m: RoleFields) => personRoles(m).some(r => r.toLowerCase() === 'supporter');
export const isPlayerRole = (m: RoleFields) => personRoles(m).some(r => r.toLowerCase() === 'player');
/** Coaches, managers, committee and anyone with an admin role */
export const isStaff = (m: RoleFields) =>
  !!m.is_executive || personRoles(m).some(r => !['player', 'supporter'].includes(r.toLowerCase()));

export interface PersonCheck { kind: 'safeguarding' | 'photo' | 'guardian' | 'emergency'; text: string; urgent: boolean }

/**
 * Things to look at: a background check that has run out or soon will, and for juniors photo
 * consent not asked, no parent contact or no emergency contact.
 */
export function personChecks(m: ClubMember, junior: boolean, today = new Date()): PersonCheck[] {
  const out: PersonCheck[] = [];
  if (m.safeguarding_check_expiry_date) {
    const days = daysUntil(m.safeguarding_check_expiry_date, today);
    const name = m.safeguarding_check_type || 'Background check';
    if (days < 0) out.push({ kind: 'safeguarding', text: `${name} expired`, urgent: true });
    else if (days <= SOON_DAYS) out.push({ kind: 'safeguarding', text: `${name} expires in ${days} day${days === 1 ? '' : 's'}`, urgent: false });
  }
  if (junior) {
    if (m.photo_consent == null) out.push({ kind: 'photo', text: 'Photo consent not asked', urgent: false });
    if (!m.guardian_email && !m.guardian_phone) out.push({ kind: 'guardian', text: 'No parent or guardian contact', urgent: true });
    if (!m.emergency_contact && !m.guardian_phone) out.push({ kind: 'emergency', text: 'No emergency contact', urgent: false });
  }
  return out;
}

/** Whether someone is in a chip's group ('attention': a check, or membership run out or close to it) */
export function inGroup(group: PeopleGroup, m: ClubMember, junior: boolean, today = new Date()): boolean {
  switch (group) {
    case 'everyone': return true;
    case 'players': return isPlayerRole(m);
    case 'juniors': return junior;
    case 'supporters': return isSupporter(m);
    case 'staff': return isStaff(m);
    case 'attention': {
      const s = membershipInfo(m, today).state;
      return s === 'expired' || s === 'expiring' || s === 'suspended' || personChecks(m, junior, today).length > 0;
    }
  }
}

/** Search text: name, email, phone, parent, title, shirt number */
export function matchesSearch(m: ClubMember, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [
    m.full_name, m.email, m.phone, m.guardian_name, m.guardian_email, m.guardian_phone, m.executive_title,
    m.jersey_number != null ? `#${m.jersey_number} ${m.jersey_number}` : '',
  ].filter(Boolean).join(' ').toLowerCase().includes(q);
}

/** Who counts in a club's headcount (dashboard, home page "Members" / "Players", People "Everyone"):
 *  everyone except applications still waiting and rejected ones. One rule, so the numbers agree. */
export function isCountedMember(m: Pick<ClubMember, 'membership_status'>): boolean {
  return m.membership_status !== 'pending' && m.membership_status !== 'rejected';
}
