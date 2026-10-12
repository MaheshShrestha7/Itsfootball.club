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
  { key: 'availability', label: 'Player Availability', group: 'Matchday' },
  { key: 'lineup', label: 'Lineup Workbench', group: 'Matchday' },
  { key: 'match-center', label: 'Match Centre', group: 'Matchday' },
  { key: 'scanner', label: 'Gate Scanner', group: 'Matchday' },
  { key: 'matches', label: 'Fixtures & Results', group: 'Fixtures & Competitions' },
  { key: 'tournaments', label: 'Tournaments & Cups', group: 'Fixtures & Competitions' },
  { key: 'events', label: 'Events', group: 'Fixtures & Competitions' },
  { key: 'squad', label: 'Squad & Players (incl. contact details)', group: 'Players & Teams' },
  { key: 'teams', label: 'Club Teams and Tournament Sides', group: 'Players & Teams' },
  { key: 'members', label: 'Members', group: 'Players & Teams' },
  { key: 'committee', label: 'Committee', group: 'Players & Teams' },
  { key: 'finance', label: 'Finance', group: 'Money' },
  { key: 'shop', label: 'Club Shop (products; edit also hands out orders)', group: 'Money' },
  { key: 'shop-orders', label: 'Club Shop: see and hand out orders only', group: 'Money' },
  { key: 'sponsors', label: 'Sponsors', group: 'Money' },
  { key: 'content', label: 'News', group: 'Website & Fans' },
  { key: 'hero-slider', label: 'Homepage Slider', group: 'Website & Fans' },
  { key: 'gallery', label: 'Photo Gallery', group: 'Website & Fans' },
  { key: 'emails', label: 'Email Notifications', group: 'Website & Fans' },
  { key: 'gamification', label: 'ClubScore', group: 'Website & Fans' },
  { key: 'analytics', label: 'Audience Analytics', group: 'Website & Fans' },
  { key: 'branding', label: 'Club Profile & Branding', group: 'Club Settings' },
  { key: 'seasons', label: 'Seasons', group: 'Club Settings' },
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

/** Sent with the target hash ('#tournament-sides' or '') when an admin menu item is clicked; pages with hash tabs listen */
export const ADMIN_HASH_EVENT = 'admin-menu-hash';

/** A member's squad labels ('Player, Treasurer' and/or ['Player', 'Treasurer']) */
export function memberLabels(role?: string | null, roles?: string[] | null): string[] {
  const all = [...(Array.isArray(roles) ? roles : []), ...(role || '').split(',')].map(r => r.trim()).filter(Boolean);
  return all.filter((r, i) => all.findIndex(o => o.toLowerCase() === r.toLowerCase()) === i);
}
