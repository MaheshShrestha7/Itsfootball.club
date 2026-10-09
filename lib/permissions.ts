// ==============================================================================
// Admin access areas and levels
//
// Each club defines access roles (table club_access_roles) that give a level per area. The area
// keys are the admin page names (the URL segment after /admin/). The database enforces them
// (has_club_perm() in supabase/migrations/20261023_access_roles.sql); the app only uses them to
// show the right menu and pages.
// ==============================================================================

export type AccessLevel = 'view' | 'edit' | 'full';

export const ACCESS_LEVELS: { value: AccessLevel; label: string; desc: string }[] = [
  { value: 'view', label: 'View', desc: 'Open the page and read its data' },
  { value: 'edit', label: 'Edit', desc: 'Also create and change records' },
  { value: 'full', label: 'Full', desc: 'Also delete records' },
];

export interface AccessArea {
  key: string;
  label: string;
  group: string;
}

// Same order and grouping as the admin menu
export const ACCESS_AREAS: AccessArea[] = [
  { key: 'inquiries', label: 'Inbox', group: 'Overview' },
  { key: 'match-center', label: 'Match Command Center', group: 'Matchday' },
  { key: 'availability', label: 'Player Availability', group: 'Matchday' },
  { key: 'lineup', label: 'Lineup Workbench', group: 'Matchday' },
  { key: 'scanner', label: 'Turnstile QR Scanner', group: 'Matchday' },
  { key: 'matches', label: 'Schedule & Matches', group: 'Fixtures & Competitions' },
  { key: 'tournaments', label: 'Tournaments & Cups', group: 'Fixtures & Competitions' },
  { key: 'events', label: 'Events Management', group: 'Fixtures & Competitions' },
  { key: 'seasons', label: 'Season Management', group: 'Fixtures & Competitions' },
  { key: 'squad', label: 'Squad & Players (incl. contact details)', group: 'People & Membership' },
  { key: 'teams', label: 'Internal Teams', group: 'People & Membership' },
  { key: 'members', label: 'Member Approvals', group: 'People & Membership' },
  { key: 'committee', label: 'Executive Committee', group: 'People & Membership' },
  { key: 'emails', label: 'Email Notifications', group: 'People & Membership' },
  { key: 'gamification', label: 'ClubScore Gamification', group: 'People & Membership' },
  { key: 'finance', label: 'Finance', group: 'Finance & Sponsors' },
  { key: 'shop', label: 'Club Shop (products; edit also hands out orders)', group: 'Finance & Sponsors' },
  { key: 'shop-orders', label: 'Club Shop: see and hand out orders only', group: 'Finance & Sponsors' },
  { key: 'sponsors', label: 'Commercial Sponsors', group: 'Finance & Sponsors' },
  { key: 'branding', label: 'Club Configuration & Branding', group: 'Website & Marketing' },
  { key: 'hero-slider', label: 'Hero Slider Spotlight', group: 'Website & Marketing' },
  { key: 'content', label: 'Content & News CMS', group: 'Website & Marketing' },
  { key: 'gallery', label: 'Photo Gallery', group: 'Website & Marketing' },
  { key: 'analytics', label: 'Audience Analytics', group: 'Website & Marketing' },
];

/** Admin pages only super users (Owner, Club Admin) open; never granted by a role */
export const SUPER_USER_AREAS = ['roles'];

const RANK: Record<string, number> = { view: 1, edit: 2, full: 3 };

/** Does `have` (a role's level, or nothing) reach `need`? */
export function levelAtLeast(have: string | null | undefined, need: AccessLevel = 'view'): boolean {
  return (RANK[have || ''] || 0) >= RANK[need];
}

/** The area an admin URL belongs to: '/club/admin/lineup/draft' -> 'lineup'. The dashboard has none. */
export function areaFromPath(pathname: string): string | null {
  return pathname.match(/\/admin\/([^/?#]+)/)?.[1] ?? null;
}

/** A member's squad labels ('Player, Treasurer' and/or ['Player', 'Treasurer']) */
export function memberLabels(role?: string | null, roles?: string[] | null): string[] {
  const all = [...(Array.isArray(roles) ? roles : []), ...(role || '').split(',')].map(r => r.trim()).filter(Boolean);
  return all.filter((r, i) => all.findIndex(o => o.toLowerCase() === r.toLowerCase()) === i);
}
