// ==============================================================================
// Club teams (first team, reserves, academy, youth age groups)
//
// Table club_teams / club_team_members (supabase/migrations/20261031_club_teams.sql). Every club
// has one main team (is_default). While a club has only that one team, every screen behaves as
// it did before teams existed: team pickers, filters and labels only appear once there are two.
// ==============================================================================
import type { ClubTeam, ClubTeamFormat, ClubTeamGender, ClubTeamMember, ClubTeamRole, ClubTeamType, Match, TournamentParticipant } from './supabase/types';
import { clubPlaysIn, kickoff, soonestFirst } from './fixtures';

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

// ------------------------------------------------------------------------------
// Junior (kids) teams: safeguarding rules (supabase/migrations/20261102_junior_safeguarding.sql)
// ------------------------------------------------------------------------------

/** Match events that reveal the score (left out where a team hides its scores) */
export const GOAL_EVENT_TYPES = ['goal', 'penalty', 'own_goal'];

/** The side a goal event counts for: its own side, or the other side for an own goal (logged on the scorer's side). Null if not a goal. */
export function goalScoringSide(e: { event_type: string; team_side: 'home' | 'away' }): 'home' | 'away' | null {
  if (e.event_type === 'own_goal') return e.team_side === 'home' ? 'away' : 'home';
  return e.event_type === 'goal' || e.event_type === 'penalty' ? e.team_side : null;
}

/** Whether an age group counts as junior: up to U17, and U18 too unless the club turned that off */
export function isJuniorAgeGroup(ageGroup: string | null | undefined, includeU18 = true): boolean {
  const age = ageGroupAge(ageGroup);
  return age !== null && age <= (includeU18 ? 18 : 17);
}

/** "Sam Taylor" -> "Sam T." (how juniors are named on the public site) */
export function juniorPublicName(name: string | null | undefined): string {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return parts[0] || '';
  return `${parts[0]} ${parts[parts.length - 1].charAt(0).toUpperCase()}.`;
}

/** Whether a fixture is played by a junior team (its player names are shortened publicly) */
export function isJuniorFixture(
  m: Pick<Match, 'club_id' | 'team_id' | 'match_type' | 'tournament_id'>,
  teams: ClubTeam[]
): boolean {
  return !!teamOfMatch(m, teams)?.is_junior;
}

/**
 * Whether a member plays for an active junior team. Visitors can't see junior squads, so for them
 * the public member view's is_junior flag says it; signed-in admins work it out from the squads.
 */
// A junior (shown as "Sam T.", kept off public lists): plays in a junior team, or is under 18 by
// date of birth (under 17 when the club doesn't count U18 teams as junior), or has no date of birth
// but a parent / guardian on file. Same rule as member_is_junior() (migration 20261125).
type JuniorCandidate = { id: string; is_junior?: boolean | null; date_of_birth?: string | null; guardian_email?: string | null; guardian_name?: string | null };
export interface JuniorOptions { includeU18?: boolean; today?: Date }

function juniorByAge(member: JuniorCandidate, opts: JuniorOptions = {}): boolean {
  if (member.date_of_birth) {
    const age = ageOnDate(member.date_of_birth, opts.today ?? new Date());
    return age !== null && age < (opts.includeU18 === false ? 17 : 18);
  }
  return !!(member.guardian_email?.trim() || member.guardian_name?.trim());
}

export function isJuniorMember(
  member: JuniorCandidate,
  teams: ClubTeam[],
  rows: ClubTeamMember[],
  opts?: JuniorOptions
): boolean {
  if (member.is_junior || juniorByAge(member, opts)) return true;
  return rows.some(r =>
    r.member_id === member.id && r.team_role === 'player' && r.is_active !== false
    && teams.some(t => t.id === r.team_id && t.is_active && t.is_junior)
  );
}

/** Ids of the club's junior players (see isJuniorMember) */
export function juniorMemberIds(
  members: JuniorCandidate[],
  teams: ClubTeam[],
  rows: ClubTeamMember[],
  opts?: JuniorOptions
): Set<string> {
  const juniorTeams = new Set(teams.filter(t => t.is_active && t.is_junior).map(t => t.id));
  const ids = new Set(members.filter(m => m.is_junior || juniorByAge(m, opts)).map(m => m.id));
  for (const r of rows) {
    if (r.team_role === 'player' && r.is_active !== false && juniorTeams.has(r.team_id)) ids.add(r.member_id);
  }
  return ids;
}

/**
 * The date age groups are counted on: the current season's start (else 1 September of the year
 * the season started). U10 = under 10 on that date.
 */
export function ageGroupCutoff(seasonStart: string | null | undefined, today = new Date()): Date {
  if (seasonStart && /^\d{4}-\d{2}-\d{2}/.test(seasonStart)) {
    const [y, m, d] = seasonStart.slice(0, 10).split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d));
  }
  const year = today.getUTCMonth() >= 8 ? today.getUTCFullYear() : today.getUTCFullYear() - 1;
  return new Date(Date.UTC(year, 8, 1));
}

/** Age in whole years on a date, or null for a missing / invalid date of birth */
export function ageOnDate(dateOfBirth: string | null | undefined, on: Date): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateOfBirth || '');
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  let age = on.getUTCFullYear() - y;
  if (on.getUTCMonth() + 1 < mo || (on.getUTCMonth() + 1 === mo && on.getUTCDate() < d)) age -= 1;
  return age >= 0 && age < 120 ? age : null;
}

/**
 * Whether a date of birth fits a team's age group on the cut-off date: 'ok', 'too_old' (they
 * should play in an older group) or null when either is unknown. Playing up is allowed.
 */
export function ageGroupFit(dateOfBirth: string | null | undefined, ageGroup: string | null | undefined, cutoff: Date): 'ok' | 'too_old' | null {
  const limit = ageGroupAge(ageGroup);
  const age = ageOnDate(dateOfBirth, cutoff);
  if (limit === null || age === null) return null;
  return age < limit ? 'ok' : 'too_old';
}

/**
 * The junior team that best fits an under-18 applicant: the youngest active junior age group they
 * are still young enough for on the cut-off date, else the first active junior team (or none).
 */
export function suggestJuniorTeam<T extends { id: string; is_junior?: boolean; is_active?: boolean; age_group?: string | null; sort_order?: number }>(
  dateOfBirth: string | null | undefined,
  teams: T[],
  cutoff: Date
): T | undefined {
  const juniors = teams.filter(t => t.is_active && t.is_junior);
  const age = ageOnDate(dateOfBirth, cutoff);
  const fits = age === null ? [] : juniors
    .filter(t => { const limit = ageGroupAge(t.age_group); return limit !== null && age < limit; })
    .sort((a, b) => (ageGroupAge(a.age_group) ?? 99) - (ageGroupAge(b.age_group) ?? 99));
  return fits[0] || juniors[0];
}

/** Match type that a competition name implies (null = no clear hint, keep what the admin picked) */
export function matchTypeForCompetition(competition: string): 'internal' | 'friendly' | 'tournament' | null {
  const c = competition.toLowerCase();
  if (/intra|internal|in-house|training match/.test(c)) return 'internal';
  if (/\b(cup|tournament|shield|carnival|gala|knockout|plate)\b/.test(c)) return 'tournament';
  if (/\b(league|friendly|division|premier|championship|comp(etition)?|round)\b/.test(c)) return 'friendly';
  return null;
}

export type SafeguardingCheckStatus = 'valid' | 'expiring' | 'expired' | 'missing';

/** A staff member's background check: missing, expired, expiring within 60 days, or valid */
export function safeguardingCheckStatus(
  m: { safeguarding_check_date?: string | null; safeguarding_check_expiry_date?: string | null },
  today = new Date()
): SafeguardingCheckStatus {
  if (!m.safeguarding_check_date && !m.safeguarding_check_expiry_date) return 'missing';
  if (!m.safeguarding_check_expiry_date) return 'valid';
  const day = today.toISOString().slice(0, 10);
  if (m.safeguarding_check_expiry_date < day) return 'expired';
  const soon = new Date(today.getTime() + 60 * 86400000).toISOString().slice(0, 10);
  return m.safeguarding_check_expiry_date <= soon ? 'expiring' : 'valid';
}

/**
 * How a member is shown on the public site: juniors get a shortened name, no nationality and no
 * photo without photo consent. Visitors already receive juniors this way from the public member
 * view; this keeps public pages the same for signed-in admins, whose copy has the full details.
 */
export function publicMember<M extends { id: string; full_name: string; photo_url?: string; nationality?: string; photo_consent?: boolean | null; is_junior?: boolean }>(
  member: M,
  juniorIds: Set<string>
): M {
  if (!juniorIds.has(member.id)) return member;
  // A row from the public view (is_junior set) is already shortened and has no photo without consent
  if (member.is_junior) return member;
  return {
    ...member,
    full_name: juniorPublicName(member.full_name),
    nationality: undefined,
    photo_url: member.photo_consent === true ? member.photo_url : undefined,
  };
}

/** A member's next fixture (back of their pass): from today, games the club plays in, and with
 *  their teams known only those teams' games (internal and tournament games count for everyone) */
export function nextFixtureOf(
  matches: Match[], clubId: string, clubName: string, memberTeams: Pick<ClubTeam, 'id'>[],
  clubTeams: ClubTeam[], participants: TournamentParticipant[],
): Match | undefined {
  const startOfToday = new Date().setHours(0, 0, 0, 0);
  const teamIds = new Set(memberTeams.map(t => t.id));
  return matches
    .filter(m => m.club_id === clubId && m.status === 'upcoming' && kickoff(m) >= startOfToday)
    .filter(m => clubPlaysIn(m, participants, clubName))
    .filter(m => {
      if (!teamIds.size) return true;
      const team = teamOfMatch(m, clubTeams);
      return !team || teamIds.has(team.id);
    })
    .sort(soonestFirst)[0];
}
