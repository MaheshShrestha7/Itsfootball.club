// ==============================================================================
// Club teams (first team, reserves, academy, youth age groups)
//
// Table club_teams / club_team_members (supabase/migrations/20261031_club_teams.sql). Every club
// has one main team (is_default). While a club has only that one team, every screen behaves as
// it did before teams existed: team pickers, filters and labels only appear once there are two.
// ==============================================================================
import type { ClubTeam, ClubTeamFormat, ClubTeamGender, ClubTeamMember, ClubTeamRole, ClubTeamType, Match } from './supabase/types';

export const TEAM_TYPES: { value: ClubTeamType; label: string }[] = [
  { value: 'senior', label: 'First / senior team' },
  { value: 'reserve', label: 'Reserves' },
  { value: 'academy', label: 'Academy' },
  { value: 'youth', label: 'Youth / junior' },
  { value: 'women', label: 'Women' },
  { value: 'veterans', label: 'Veterans' },
  { value: 'other', label: 'Other' },
];

export const TEAM_GENDERS: { value: ClubTeamGender; label: string }[] = [
  { value: 'mixed', label: 'Mixed' },
  { value: 'boys', label: 'Boys' },
  { value: 'girls', label: 'Girls' },
  { value: 'men', label: 'Men' },
  { value: 'women', label: 'Women' },
];

export const TEAM_FORMATS: ClubTeamFormat[] = ['5v5', '7v7', '9v9', '11v11'];

/** U5 ... U23, the range the database accepts */
export const AGE_GROUPS: string[] = Array.from({ length: 19 }, (_, i) => `U${i + 5}`);

export const TEAM_ROLE_LABELS: Record<ClubTeamRole, string> = {
  player: 'Player',
  coach: 'Coach',
  assistant: 'Assistant coach',
  manager: 'Team manager',
  physio: 'Physio',
  other: 'Staff',
};

/** Staff roles shown on a team page (everything but player) */
export const STAFF_ROLES: ClubTeamRole[] = ['coach', 'assistant', 'manager', 'physio', 'other'];

/** The number in an age group label ("U10" -> 10), or null for open age */
export function ageGroupAge(ageGroup: string | null | undefined): number | null {
  const m = /^U(\d{1,2})$/.exec(ageGroup || '');
  return m ? Number(m[1]) : null;
}

/** Suggested format for an age group (FA-style grassroots progression); open age plays 11v11 */
export function suggestedFormat(ageGroup: string | null | undefined): ClubTeamFormat {
  const age = ageGroupAge(ageGroup);
  if (age === null || age >= 13) return '11v11';
  if (age >= 11) return '9v9';
  if (age >= 8) return '7v7';
  return '5v5';
}

/** URL-safe slug matching the database check (lowercase words joined by single hyphens) */
export function teamSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120) || 'team';
}

/** A slug for `name` not used by another of the club's teams ("u10", "u10-2", ...) */
export function uniqueTeamSlug(name: string, teams: Pick<ClubTeam, 'id' | 'slug'>[], ownId?: string): string {
  const base = teamSlug(name);
  const taken = new Set(teams.filter(t => t.id !== ownId).map(t => t.slug));
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) {
    if (!taken.has(`${base}-${n}`)) return `${base}-${n}`;
  }
}

/** The club's teams in display order: main team first, then sort order, then name */
export function clubTeamsOf<T extends ClubTeam>(teams: T[], clubId: string, opts: { includeInactive?: boolean } = {}): T[] {
  return teams
    .filter(t => t.club_id === clubId && (opts.includeInactive || t.is_active))
    .sort((a, b) => Number(b.is_default) - Number(a.is_default) || a.sort_order - b.sort_order || a.name.localeCompare(b.name));
}

export function defaultTeamOf<T extends ClubTeam>(teams: T[], clubId: string): T | undefined {
  return teams.find(t => t.club_id === clubId && t.is_default);
}

/** Whether a club shows team pickers / labels at all (two or more active teams) */
export function hasMultipleTeams(teams: ClubTeam[], clubId: string): boolean {
  return clubTeamsOf(teams, clubId).length > 1;
}

/** Fixtures that belong to a club team: not internal matches and not tournament matches */
export function isTeamFixture(m: Pick<Match, 'match_type' | 'tournament_id'>): boolean {
  return !m.tournament_id && (m.match_type || 'friendly') !== 'internal';
}

/** The team a fixture is played by. A team fixture with no team yet belongs to the main team. */
export function teamOfMatch<T extends ClubTeam>(m: Pick<Match, 'club_id' | 'team_id' | 'match_type' | 'tournament_id'>, teams: T[]): T | undefined {
  if (m.team_id) return teams.find(t => t.id === m.team_id);
  return isTeamFixture(m) ? defaultTeamOf(teams, m.club_id) : undefined;
}

/** Member ids holding `role` in a team (active rows only) */
export function teamMemberIds(rows: ClubTeamMember[], teamId: string, role: ClubTeamRole | 'staff' = 'player'): string[] {
  return rows
    .filter(r => r.team_id === teamId && r.is_active !== false && (role === 'staff' ? r.team_role !== 'player' : r.team_role === role))
    .map(r => r.member_id);
}

/** The teams a member plays for or staffs */
export function teamsOfMember<T extends ClubTeam>(rows: ClubTeamMember[], teams: T[], memberId: string): T[] {
  const ids = new Set(rows.filter(r => r.member_id === memberId && r.is_active !== false).map(r => r.team_id));
  return teams.filter(t => ids.has(t.id));
}

/** Short label for badges ("U10", "Reserves"): the short name, else the name */
export function teamLabel(t: Pick<ClubTeam, 'name' | 'short_name'>): string {
  return t.short_name?.trim() || t.name;
}

/**
 * The players to offer for a fixture: its team's squad once the club has several teams, else
 * everyone. Falls back to everyone when the team has no squad list yet (or it isn't visible,
 * e.g. a junior squad on the public site), so nobody is ever left without players to pick.
 */
export function squadForMatch<P extends { id: string }>(
  players: P[],
  match: Pick<Match, 'club_id' | 'team_id' | 'match_type' | 'tournament_id'> | null | undefined,
  teams: ClubTeam[],
  rows: ClubTeamMember[]
): P[] {
  if (!match || !hasMultipleTeams(teams, match.club_id)) return players;
  const team = teamOfMatch(match, teams);
  if (!team) return players;
  const ids = new Set(teamMemberIds(rows, team.id));
  if (ids.size === 0) return players;
  return players.filter(p => ids.has(p.id));
}

/** Whether the public site hides this fixture's score (its team has "hide scores" on) */
export function publicScoreHidden(
  m: Pick<Match, 'club_id' | 'team_id' | 'match_type' | 'tournament_id'>,
  teams: ClubTeam[]
): boolean {
  return !!teamOfMatch(m, teams)?.hide_public_scores;
}
