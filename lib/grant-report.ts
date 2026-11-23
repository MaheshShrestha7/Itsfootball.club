// Grant & Acquittal Readiness Report ("Club Impact & Participation Export"):
// Aggregates active player demographics (zero PII), junior/veterans/women's program attendance,
// and equipment/facility spend into a clean summary and one-click ZIP pack for council and
// community sports grant applications and acquittals.
//
// Pure, so every figure can be checked without a browser (lib/grant-report.check.ts).
// Money uses the exact same rules as lib/agm-report.ts and lib/audit-pack.ts so totals always
// reconcile with the AGM report and Audit pack.

import { agmMoney, membersByTier, type AgmExpense, type AgmPayment } from './agm-report';
import { EXPENSE_CATEGORIES, formatMoney, PAYMENT_METHOD_LABEL, toCsv } from './finance';
import { formatAbn } from './invoice';
import { siteToday } from './member-prices';
import { isCountedMember, isStaff, isSupporter } from './people';
import type {
  Club, ClubEvent, ClubMember, ClubTeam, ClubTeamGender, ClubTeamMember,
  EventAttendee, Match, PlayerAvailability, PlayerStats,
} from './supabase/types';
import { ageGroupCutoff, ageOnDate, clubTeamsOf, juniorMemberIds, safeguardingCheckStatus, squadPlayerIds, teamOfMatch } from './teams';
import { zipFiles } from './zip';

// ------------------------------------------------------------------------------------------------
// Period & Grant Context
// ------------------------------------------------------------------------------------------------

export interface GrantPeriod {
  mode: 'season' | 'dates';
  /** Season name when mode === 'season', or human-readable label (e.g. "2025/26" or "2025-07-01 to 2026-06-30") */
  label: string;
  /** YYYY-MM-DD inclusive start (empty if an undated season label) */
  from: string;
  /** YYYY-MM-DD inclusive end (empty if an undated season label) */
  to: string;
  /** Season name when mode === 'season' */
  seasonName?: string;
}

export interface GrantContext {
  grantName?: string;
  fundingBody?: string;
  reference?: string;
}

export interface GrantPayment extends AgmPayment {
  created_at: string;
  paid_at?: string | null;
  currency?: string;
}

export interface GrantExpense extends AgmExpense {
  id: string;
  created_at: string;
  spent_on: string;
  description: string;
  vendor?: string | null;
  method: string;
  currency: string;
  receipt_key?: string | null;
}

// ------------------------------------------------------------------------------------------------
// Report output types (zero PII)
// ------------------------------------------------------------------------------------------------

export type ProgramKey = 'junior' | 'veterans' | 'women_girls' | 'senior' | 'other';

export const PROGRAM_LABELS: Record<ProgramKey, string> = {
  junior: 'Junior & Youth',
  veterans: 'Veterans / Masters',
  women_girls: 'Women & Girls',
  senior: 'Senior & Reserves',
  other: 'Other Programs',
};

export const PROGRAM_ORDER: ProgramKey[] = ['junior', 'veterans', 'women_girls', 'senior', 'other'];

export type SpendBucketKey = 'equipment' | 'facilities' | 'coaching_welfare' | 'matchday_ops' | 'other_ops';

export const SPEND_BUCKET_LABELS: Record<SpendBucketKey, string> = {
  equipment: 'Kit, Equipment & First Aid',
  facilities: 'Facilities, Pitch Hire & Maintenance',
  coaching_welfare: 'Coaching, Development & Welfare',
  matchday_ops: 'Matchday, Officials & Insurance',
  other_ops: 'Other Club Operations',
};

export const SPEND_BUCKET_ORDER: SpendBucketKey[] = [
  'equipment',
  'facilities',
  'coaching_welfare',
  'matchday_ops',
  'other_ops',
];

/** Expense categories considered directly relevant to equipment & facility grant acquittals */
export const GRANT_RELEVANT_BUCKETS = new Set<SpendBucketKey>(['equipment', 'facilities', 'coaching_welfare']);

export function expenseBucket(category: string): SpendBucketKey {
  if (category === 'kit_equipment' || category === 'medical') return 'equipment';
  if (category === 'facility_hire' || category === 'maintenance' || category === 'utilities') return 'facilities';
  if (category === 'coaching' || category === 'player_welfare') return 'coaching_welfare';
  if (category === 'referees' || category === 'league_fees' || category === 'insurance' || category === 'events' || category === 'travel') {
    return 'matchday_ops';
  }
  return 'other_ops';
}

export interface GovernanceSummary {
  clubName: string;
  clubSlug: string;
  foundedYear: number | null;
  abn: string | null;
  gstRegistered: boolean;
  homeGround: string;
  homeAddress: string;
  pitchType: string;
  activeTeamsCount: number;
  committeeCount: number;
  welfareOfficerAppointed: boolean;
  safeguarding: {
    totalStaff: number;
    valid: number;
    expiring: number;
    expired: number;
    missing: number;
  };
}

export interface AgeBracketRow {
  label: string;
  count: number;
  percent: number;
}

export interface ProgramDemographicRow {
  key: ProgramKey;
  label: string;
  teams: number;
  players: number;
}

export interface GenderDemographicRow {
  gender: ClubTeamGender;
  label: string;
  teams: number;
  players: number;
}

export interface DemographicsSummary {
  available: boolean;
  totalMembers: number;
  activePlayers: number;
  juniorPlayers: number;
  veteranPlayers: number;
  womenGirlsPlayers: number;
  staffVolunteers: number;
  supporters: number;
  feeWaiversCount: number;
  distinctAdultNationalities: number;
  ageBrackets: AgeBracketRow[];
  programs: ProgramDemographicRow[];
  byTeamGender: GenderDemographicRow[];
  tiers: { tier: string; count: number }[];
}

export interface ProgramAttendanceRow {
  key: ProgramKey | 'all';
  label: string;
  teams: number;
  squadSize: number;
  matchesCompleted: number;
  matchAppearances: number;
  trainingSessions: number;
  trainingAttendances: number;
  avgTrainingTurnout: number;
}

export interface CommunityEventsSummary {
  eventsHeld: number;
  totalRsvps: number;
  totalCheckins: number;
  byCategory: { category: string; label: string; count: number; rsvps: number; checkins: number }[];
}

export interface AttendanceSummary {
  programs: ProgramAttendanceRow[];
  allClub: ProgramAttendanceRow;
  communityEvents: CommunityEventsSummary;
  totalParticipantSessions: number;
}

export interface SpendBucketRow {
  key: SpendBucketKey;
  label: string;
  grantRelevant: boolean;
  count: number;
  cents: number;
  previousCents: number;
}

export interface ItemisedGrantExpense {
  id: string;
  date: string;
  bucket: SpendBucketKey;
  bucketLabel: string;
  category: string;
  categoryLabel: string;
  vendor: string;
  description: string;
  amountCents: number;
  currency: string;
  method: string;
  hasReceipt: boolean;
}

export interface ReceiptReadiness {
  totalCount: number;
  withReceiptCount: number;
  missingReceiptCount: number;
  totalCents: number;
  withReceiptCents: number;
  missingReceiptCents: number;
}

export interface SpendSummary {
  currency: string;
  buckets: SpendBucketRow[];
  grantRelevantTotalCents: number;
  grantRelevantPreviousCents: number;
  totalExpensesCents: number;
  previousExpensesCents: number;
  totalIncomeCents: number;
  previousIncomeCents: number;
  grantIncomeCents: number;
  previousGrantIncomeCents: number;
  selfFundedIncomeCents: number;
  selfFundedPercent: number | null;
  receiptReadiness: ReceiptReadiness;
  itemisedGrantExpenses: ItemisedGrantExpense[];
}

export interface GrantImpactReport {
  generatedAt: string;
  period: GrantPeriod;
  previousPeriod: GrantPeriod | null;
  governance: GovernanceSummary;
  demographics: DemographicsSummary;
  attendance: AttendanceSummary;
  spend: SpendSummary;
}

export interface GrantReportInput {
  club: Pick<
    Club,
    | 'id' | 'slug' | 'name' | 'founded_year' | 'stadium_name' | 'stadium_address'
    | 'stadium_pitch_type' | 'junior_includes_u18' | 'welfare_officer_name'
  >;
  settings: { currency?: string; abn?: string | null; gst_registered?: boolean } | null;
  period: GrantPeriod;
  previousPeriod: GrantPeriod | null;
  includeDemographics: boolean;
  members: ClubMember[];
  teams: ClubTeam[];
  teamMembers: ClubTeamMember[];
  matches: Match[];
  events: ClubEvent[];
  eventAttendees: EventAttendee[];
  availabilities: PlayerAvailability[];
  playerStats: PlayerStats[];
  payments: GrantPayment[];
  expenses: GrantExpense[];
  /** Override "today" for deterministic tests (YYYY-MM-DD) */
  today?: string;
}

// ------------------------------------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------------------------------------

const TEAM_GENDER_LABELS: Record<ClubTeamGender, string> = {
  mixed: 'Mixed',
  boys: 'Boys',
  girls: 'Girls',
  men: 'Men',
  women: 'Women',
};

const EVENT_CATEGORY_LABELS: Record<string, string> = {
  social: 'Social & Community',
  trial: 'Trials & Come-and-Try',
  tournament: 'Tournaments & Carnivals',
  agm: 'AGM & Governance',
  match: 'Matchday Events',
  training: 'Training',
};

const siteDay = (iso: string) => siteToday(new Date(iso).getTime());
const settled = (p: GrantPayment) => p.status === 'paid' || p.status === 'refunded';
const paymentDay = (p: GrantPayment) => siteDay(p.paid_at || p.created_at);
const expenseDay = (e: GrantExpense) => (e.spent_on || e.created_at || '').slice(0, 10);

function inDateRange(day: string, period: GrantPeriod): boolean {
  if (!day || !period.from || !period.to) return false;
  return period.from <= day && day <= period.to;
}

function matchInPeriod(m: Match, period: GrantPeriod): boolean {
  if (period.mode === 'season' && period.seasonName) {
    if (m.season?.trim() === period.seasonName) return true;
    if (period.from && period.to && m.match_date) return inDateRange(m.match_date.slice(0, 10), period);
    return false;
  }
  return m.match_date ? inDateRange(m.match_date.slice(0, 10), period) : false;
}

function eventInPeriod(e: ClubEvent, period: GrantPeriod): boolean {
  const day = e.start_time ? siteDay(e.start_time) : '';
  if (period.mode === 'season' && period.seasonName) {
    if (e.season?.trim() === period.seasonName) return true;
    if (period.from && period.to && day) return inDateRange(day, period);
    return false;
  }
  return day ? inDateRange(day, period) : false;
}

/** Program streams a team belongs to. A Girls U14 team belongs to both 'junior' and 'women_girls'. */
export function teamPrograms(t: Pick<ClubTeam, 'team_type' | 'is_junior' | 'gender'>): ProgramKey[] {
  const out = new Set<ProgramKey>();
  if (t.is_junior || t.team_type === 'youth' || t.team_type === 'academy') out.add('junior');
  if (t.team_type === 'veterans') out.add('veterans');
  if (t.team_type === 'women' || t.gender === 'women' || t.gender === 'girls') out.add('women_girls');
  if (t.team_type === 'senior' || t.team_type === 'reserve') out.add('senior');
  if (out.size === 0) out.add('other');
  return [...out];
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function pct(part: number, total: number): number {
  if (!total) return 0;
  return Math.round((part / total) * 1000) / 10;
}

/** Unique player count appearing in a completed match (starting coords + named bench) */
function matchLineupAppearanceCount(m: Match): number {
  const coords = m.is_club_home !== false ? (m.home_lineup_coords || []) : (m.away_lineup_coords || []);
  const ids = new Set<string>();
  let unnamed = 0;
  for (const p of coords) {
    if (p.member_id) ids.add(p.member_id);
    else if (p.name?.trim()) unnamed += 1;
  }
  for (const bid of m.bench_member_ids || []) {
    if (bid) ids.add(bid);
  }
  return ids.size + unnamed;
}

// ------------------------------------------------------------------------------------------------
// Main Report Builder
// ------------------------------------------------------------------------------------------------

export function buildGrantReport(input: GrantReportInput): GrantImpactReport {
  const todayStr = input.today || siteToday();
  const todayDate = new Date(`${todayStr}T00:00:00Z`);
  const activeTeams = clubTeamsOf(input.teams, input.club.id);
  const clubMembers = input.members.filter(m => m.club_id === input.club.id);
  const counted = clubMembers.filter(isCountedMember);
  const activeTeamRows = input.teamMembers.filter(r => r.club_id === input.club.id && r.is_active !== false);
  const countedIds = new Set(counted.map(m => m.id));
  const includeU18 = input.club.junior_includes_u18 !== false;

  // --- 1. Governance & Safeguarding ---
  const staffMembers = counted.filter(isStaff);
  const safeguarding = { totalStaff: staffMembers.length, valid: 0, expiring: 0, expired: 0, missing: 0 };
  for (const m of staffMembers) {
    const status = safeguardingCheckStatus(m, todayDate);
    safeguarding[status] += 1;
  }
  const governance: GovernanceSummary = {
    clubName: input.club.name,
    clubSlug: input.club.slug,
    foundedYear: input.club.founded_year || null,
    abn: input.settings?.abn ? formatAbn(input.settings.abn) : null,
    gstRegistered: !!input.settings?.gst_registered,
    homeGround: input.club.stadium_name || '',
    homeAddress: input.club.stadium_address || '',
    pitchType: input.club.stadium_pitch_type || '',
    activeTeamsCount: activeTeams.length,
    committeeCount: counted.filter(m => m.is_executive).length,
    welfareOfficerAppointed: !!input.club.welfare_officer_name?.trim(),
    safeguarding,
  };

  // --- 2. Demographics (Zero PII) ---
  const playerIds = squadPlayerIds(counted, activeTeamRows.filter(r => countedIds.has(r.member_id)));
  const activePlayers = counted.filter(m => playerIds.has(m.id));
  const juniorIds = juniorMemberIds(counted, activeTeams, activeTeamRows, { includeU18, today: todayDate });

  const ageRefDate = input.period.to
    ? new Date(`${input.period.to}T00:00:00Z`)
    : ageGroupCutoff(input.period.from || null, todayDate);

  const bracketCounts = {
    under12: 0,
    age12to17: 0,
    age18to24: 0,
    age25to34: 0,
    age35to44: 0,
    age45plus: 0,
    unknown: 0,
  };

  for (const p of activePlayers) {
    const age = ageOnDate(p.date_of_birth, ageRefDate);
    if (age === null) bracketCounts.unknown += 1;
    else if (age < 12) bracketCounts.under12 += 1;
    else if (age <= 17) bracketCounts.age12to17 += 1;
    else if (age <= 24) bracketCounts.age18to24 += 1;
    else if (age <= 34) bracketCounts.age25to34 += 1;
    else if (age <= 44) bracketCounts.age35to44 += 1;
    else bracketCounts.age45plus += 1;
  }

  const totalP = activePlayers.length;
  const ageBrackets: AgeBracketRow[] = [
    { label: 'Under 12 (MiniRoos / Junior)', count: bracketCounts.under12, percent: pct(bracketCounts.under12, totalP) },
    { label: '12–17 (Youth / Junior)', count: bracketCounts.age12to17, percent: pct(bracketCounts.age12to17, totalP) },
    { label: '18–24 (Young Adult)', count: bracketCounts.age18to24, percent: pct(bracketCounts.age18to24, totalP) },
    { label: '25–34 (Open / Senior)', count: bracketCounts.age25to34, percent: pct(bracketCounts.age25to34, totalP) },
    { label: '35–44 (Masters / Veterans)', count: bracketCounts.age35to44, percent: pct(bracketCounts.age35to44, totalP) },
    { label: '45+ (Veterans)', count: bracketCounts.age45plus, percent: pct(bracketCounts.age45plus, totalP) },
    { label: 'Age not recorded', count: bracketCounts.unknown, percent: pct(bracketCounts.unknown, totalP) },
  ];

  // Players by team id
  const teamPlayerIds = new Map<string, Set<string>>();
  for (const t of activeTeams) teamPlayerIds.set(t.id, new Set());
  for (const r of activeTeamRows) {
    if (r.team_role === 'player' && countedIds.has(r.member_id) && teamPlayerIds.has(r.team_id)) {
      teamPlayerIds.get(r.team_id)!.add(r.member_id);
    }
  }

  const programTeams = new Map<ProgramKey, ClubTeam[]>();
  const programPlayers = new Map<ProgramKey, Set<string>>();
  for (const k of PROGRAM_ORDER) {
    programTeams.set(k, []);
    programPlayers.set(k, new Set());
  }
  for (const t of activeTeams) {
    const keys = teamPrograms(t);
    const tPlayers = teamPlayerIds.get(t.id) || new Set<string>();
    for (const k of keys) {
      programTeams.get(k)!.push(t);
      for (const pid of tPlayers) programPlayers.get(k)!.add(pid);
    }
  }
  // Also include juniors identified by DOB / is_junior even if not yet placed in a junior team
  for (const pid of playerIds) {
    if (juniorIds.has(pid)) programPlayers.get('junior')!.add(pid);
  }
  // And veterans identified by age >= 35 on veterans teams or DOB >= 35 if club has a veterans team
  const veteranPlayersCount = programPlayers.get('veterans')!.size;
  const womenGirlsPlayersCount = programPlayers.get('women_girls')!.size;

  const programsDemo: ProgramDemographicRow[] = PROGRAM_ORDER
    .map(key => ({
      key,
      label: PROGRAM_LABELS[key],
      teams: programTeams.get(key)!.length,
      players: programPlayers.get(key)!.size,
    }))
    .filter(r => r.teams > 0 || r.players > 0);

  const genderMap = new Map<ClubTeamGender, { teams: number; players: Set<string> }>();
  for (const t of activeTeams) {
    const g = t.gender || 'mixed';
    if (!genderMap.has(g)) genderMap.set(g, { teams: 0, players: new Set() });
    const entry = genderMap.get(g)!;
    entry.teams += 1;
    for (const pid of teamPlayerIds.get(t.id) || []) entry.players.add(pid);
  }
  const byTeamGender: GenderDemographicRow[] = [...genderMap.entries()]
    .map(([gender, data]) => ({
      gender,
      label: TEAM_GENDER_LABELS[gender] || gender,
      teams: data.teams,
      players: data.players.size,
    }))
    .sort((a, b) => b.players - a.players || b.teams - a.teams || a.label.localeCompare(b.label));

  // Distinct nationalities across adult members only (respecting junior privacy rules)
  const nationalities = new Set<string>();
  for (const m of counted) {
    if (juniorIds.has(m.id) || m.is_junior) continue;
    const nat = m.nationality?.trim().toLowerCase();
    if (nat) nationalities.add(nat);
  }

  const demographics: DemographicsSummary = {
    available: input.includeDemographics,
    totalMembers: input.includeDemographics ? counted.length : 0,
    activePlayers: input.includeDemographics ? activePlayers.length : 0,
    juniorPlayers: input.includeDemographics ? programPlayers.get('junior')!.size : 0,
    veteranPlayers: input.includeDemographics ? veteranPlayersCount : 0,
    womenGirlsPlayers: input.includeDemographics ? womenGirlsPlayersCount : 0,
    staffVolunteers: input.includeDemographics ? staffMembers.length : 0,
    supporters: input.includeDemographics ? counted.filter(isSupporter).length : 0,
    feeWaiversCount: input.includeDemographics ? counted.filter(m => !!m.fee_waived_at).length : 0,
    distinctAdultNationalities: input.includeDemographics ? nationalities.size : 0,
    ageBrackets: input.includeDemographics ? ageBrackets : [],
    programs: programsDemo,
    byTeamGender,
    tiers: input.includeDemographics ? membersByTier(counted) : [],
  };

  // --- 3. Program & Community Attendance ---
  const clubMatches = input.matches.filter(m => m.club_id === input.club.id && m.status === 'completed' && matchInPeriod(m, input.period));
  const clubEvents = input.events.filter(e => e.club_id === input.club.id && eventInPeriod(e, input.period));
  const heldEvents = clubEvents.filter(e => !e.start_time || siteDay(e.start_time) <= todayStr);
  const trainingEvents = heldEvents.filter(e => e.category === 'training');
  const communityEventRows = heldEvents.filter(e => e.category !== 'training');
  const trainingEventIds = new Set(trainingEvents.map(e => e.id));

  // Training attendance: deduplicate per (event_id, member_id) across checked-in attendees and 'available' replies
  const trainingAttendeesByEvent = new Map<string, Set<string>>();
  for (const id of trainingEventIds) trainingAttendeesByEvent.set(id, new Set());

  for (const a of input.eventAttendees) {
    if (a.club_id !== input.club.id || !trainingEventIds.has(a.event_id)) continue;
    if (a.checkin_status === 'checked_in' || a.checkin_status === 'registered') {
      const key = a.member_id || `guest:${a.id}`;
      trainingAttendeesByEvent.get(a.event_id)!.add(key);
    }
  }
  for (const av of input.availabilities) {
    if (av.club_id !== input.club.id || !av.event_id || !trainingEventIds.has(av.event_id)) continue;
    if (av.status === 'available' && av.member_id) {
      trainingAttendeesByEvent.get(av.event_id)!.add(av.member_id);
    }
  }

  // Fallback appearances from player_stats when lineups weren't recorded on matches
  const statsByMember = new Map<string, number>();
  if (input.period.mode === 'season' && input.period.seasonName) {
    for (const st of input.playerStats) {
      if (st.club_id === input.club.id && st.season === input.period.seasonName && st.appearances > 0) {
        statsByMember.set(st.member_id, (statsByMember.get(st.member_id) || 0) + st.appearances);
      }
    }
  }

  const buildProgramAttendance = (key: ProgramKey | 'all', label: string, teams: ClubTeam[], squad: Set<string>): ProgramAttendanceRow => {
    const teamIdSet = new Set(teams.map(t => t.id));
    const progMatches = key === 'all'
      ? clubMatches
      : clubMatches.filter(m => {
          const t = teamOfMatch(m, activeTeams);
          return t ? teamIdSet.has(t.id) : false;
        });

    let matchAppearances = progMatches.reduce((n, m) => n + matchLineupAppearanceCount(m), 0);
    // If lineups weren't recorded on completed matches, fall back to season player_stats for this squad
    if (matchAppearances === 0 && statsByMember.size > 0) {
      for (const pid of squad) matchAppearances += statsByMember.get(pid) || 0;
    }

    let trainingAttendances = 0;
    for (const [, set] of trainingAttendeesByEvent) {
      if (key === 'all') {
        trainingAttendances += set.size;
      } else {
        for (const id of set) {
          if (squad.has(id)) trainingAttendances += 1;
        }
      }
    }

    const sessions = trainingEvents.length;
    return {
      key,
      label,
      teams: teams.length,
      squadSize: squad.size,
      matchesCompleted: progMatches.length,
      matchAppearances,
      trainingSessions: sessions,
      trainingAttendances,
      avgTrainingTurnout: sessions > 0 ? round1(trainingAttendances / sessions) : 0,
    };
  };

  const programAttendanceRows: ProgramAttendanceRow[] = PROGRAM_ORDER
    .map(key => buildProgramAttendance(key, PROGRAM_LABELS[key], programTeams.get(key)!, programPlayers.get(key)!))
    .filter(r => r.teams > 0 || r.squadSize > 0 || r.matchesCompleted > 0 || r.trainingAttendances > 0);

  const allClubAttendance = buildProgramAttendance('all', 'All Club Programs', activeTeams, playerIds);

  // Community events summary
  const attendeesByEvent = new Map<string, { rsvps: number; checkins: number }>();
  for (const a of input.eventAttendees) {
    if (a.club_id !== input.club.id || a.checkin_status === 'cancelled') continue;
    const cur = attendeesByEvent.get(a.event_id) || { rsvps: 0, checkins: 0 };
    cur.rsvps += 1;
    if (a.checkin_status === 'checked_in') cur.checkins += 1;
    attendeesByEvent.set(a.event_id, cur);
  }

  const catMap = new Map<string, { count: number; rsvps: number; checkins: number }>();
  let totalRsvps = 0;
  let totalCheckins = 0;
  for (const ev of communityEventRows) {
    const att = attendeesByEvent.get(ev.id);
    const rsvps = Math.max(ev.rsvp_count || 0, att?.rsvps || 0);
    const checkins = att?.checkins || 0;
    totalRsvps += rsvps;
    totalCheckins += checkins;
    const cur = catMap.get(ev.category) || { count: 0, rsvps: 0, checkins: 0 };
    cur.count += 1;
    cur.rsvps += rsvps;
    cur.checkins += checkins;
    catMap.set(ev.category, cur);
  }

  const communityEvents: CommunityEventsSummary = {
    eventsHeld: communityEventRows.length,
    totalRsvps,
    totalCheckins,
    byCategory: [...catMap.entries()]
      .map(([category, v]) => ({
        category,
        label: EVENT_CATEGORY_LABELS[category] || category,
        count: v.count,
        rsvps: v.rsvps,
        checkins: v.checkins,
      }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)),
  };

  const attendance: AttendanceSummary = {
    programs: programAttendanceRows,
    allClub: allClubAttendance,
    communityEvents,
    totalParticipantSessions:
      allClubAttendance.matchAppearances + allClubAttendance.trainingAttendances + communityEvents.totalCheckins,
  };

  // --- 4. Equipment, Facility & Grant Spend ---
  const currency = input.settings?.currency || 'AUD';
  const curLabel = input.period.label;
  const prevLabel = input.previousPeriod?.label ?? null;

  const tagPaymentPeriod = (p: GrantPayment): string | null => {
    if (!settled(p)) return null;
    if (input.period.mode === 'season') return p.season ?? null;
    const d = paymentDay(p);
    if (inDateRange(d, input.period)) return curLabel;
    if (input.previousPeriod && inDateRange(d, input.previousPeriod)) return prevLabel;
    return 'outside';
  };

  const tagExpensePeriod = (e: GrantExpense): string | null => {
    if (input.period.mode === 'season') return e.season ?? null;
    const d = expenseDay(e);
    if (inDateRange(d, input.period)) return curLabel;
    if (input.previousPeriod && inDateRange(d, input.previousPeriod)) return prevLabel;
    return 'outside';
  };

  const seasonKey = input.period.mode === 'season' ? (input.period.seasonName || curLabel) : curLabel;
  const prevSeasonKey = input.previousPeriod
    ? (input.previousPeriod.mode === 'season' ? (input.previousPeriod.seasonName || prevLabel) : prevLabel)
    : null;

  const taggedPayments = input.payments.map(p => ({ ...p, season: tagPaymentPeriod(p) }));
  const taggedExpenses = input.expenses.map(e => ({ ...e, season: tagExpensePeriod(e) }));
  const money = agmMoney(taggedPayments, taggedExpenses, seasonKey, prevSeasonKey);

  const curExpenses = taggedExpenses.filter(e => e.season === seasonKey);
  const prevExpenses = prevSeasonKey ? taggedExpenses.filter(e => e.season === prevSeasonKey) : [];

  const bucketAgg = new Map<SpendBucketKey, { count: number; cents: number; previousCents: number }>();
  for (const k of SPEND_BUCKET_ORDER) bucketAgg.set(k, { count: 0, cents: 0, previousCents: 0 });
  for (const e of curExpenses) {
    const b = expenseBucket(e.category);
    const cur = bucketAgg.get(b)!;
    cur.count += 1;
    cur.cents += e.amount_cents;
  }
  for (const e of prevExpenses) {
    const b = expenseBucket(e.category);
    bucketAgg.get(b)!.previousCents += e.amount_cents;
  }

  const buckets: SpendBucketRow[] = SPEND_BUCKET_ORDER.map(key => {
    const agg = bucketAgg.get(key)!;
    return {
      key,
      label: SPEND_BUCKET_LABELS[key],
      grantRelevant: GRANT_RELEVANT_BUCKETS.has(key),
      count: agg.count,
      cents: agg.cents,
      previousCents: agg.previousCents,
    };
  });

  const grantRelevantTotalCents = buckets.filter(b => b.grantRelevant).reduce((n, b) => n + b.cents, 0);
  const grantRelevantPreviousCents = buckets.filter(b => b.grantRelevant).reduce((n, b) => n + b.previousCents, 0);

  const grantIncomeLine = money.income.find(l => l.key === 'grants');
  const grantIncomeCents = grantIncomeLine?.cents ?? 0;
  const previousGrantIncomeCents = grantIncomeLine?.previousCents ?? 0;
  const selfFundedIncomeCents = Math.max(0, money.totalIncome - grantIncomeCents);
  const selfFundedPercent = money.totalIncome > 0 ? pct(selfFundedIncomeCents, money.totalIncome) : null;

  const itemisedGrantExpenses: ItemisedGrantExpense[] = curExpenses
    .filter(e => GRANT_RELEVANT_BUCKETS.has(expenseBucket(e.category)))
    .map(e => {
      const b = expenseBucket(e.category);
      return {
        id: e.id,
        date: expenseDay(e),
        bucket: b,
        bucketLabel: SPEND_BUCKET_LABELS[b],
        category: e.category,
        categoryLabel: EXPENSE_CATEGORIES[e.category] || e.category,
        vendor: e.vendor || '',
        description: e.description || '',
        amountCents: e.amount_cents,
        currency: e.currency || currency,
        method: PAYMENT_METHOD_LABEL[e.method] || e.method,
        hasReceipt: !!e.receipt_key,
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));

  const receiptReadiness: ReceiptReadiness = {
    totalCount: itemisedGrantExpenses.length,
    withReceiptCount: itemisedGrantExpenses.filter(e => e.hasReceipt).length,
    missingReceiptCount: itemisedGrantExpenses.filter(e => !e.hasReceipt).length,
    totalCents: itemisedGrantExpenses.reduce((n, e) => n + e.amountCents, 0),
    withReceiptCents: itemisedGrantExpenses.filter(e => e.hasReceipt).reduce((n, e) => n + e.amountCents, 0),
    missingReceiptCents: itemisedGrantExpenses.filter(e => !e.hasReceipt).reduce((n, e) => n + e.amountCents, 0),
  };

  const spend: SpendSummary = {
    currency,
    buckets,
    grantRelevantTotalCents,
    grantRelevantPreviousCents,
    totalExpensesCents: money.totalExpenses,
    previousExpensesCents: money.previousExpenses,
    totalIncomeCents: money.totalIncome,
    previousIncomeCents: money.previousIncome,
    grantIncomeCents,
    previousGrantIncomeCents,
    selfFundedIncomeCents,
    selfFundedPercent,
    receiptReadiness,
    itemisedGrantExpenses,
  };

  return {
    generatedAt: todayStr,
    period: input.period,
    previousPeriod: input.previousPeriod,
    governance,
    demographics,
    attendance,
    spend,
  };
}

// ------------------------------------------------------------------------------------------------
// CSV Builders & One-Click ZIP Export Pack (Zero PII)
// ------------------------------------------------------------------------------------------------

type CsvRow = (string | number | null | undefined)[];
const amt = (cents: number) => (cents / 100).toFixed(2);

export function executiveSummaryCsv(r: GrantImpactReport, ctx: GrantContext = {}): CsvRow[] {
  const rows: CsvRow[] = [
    ['Section', 'Metric', 'Value'],
    ['Report', 'Club', r.governance.clubName],
    ['Report', 'Reporting Period', r.period.label],
    ...(r.period.from && r.period.to ? [['Report', 'Date Range', `${r.period.from} to ${r.period.to}`]] : []),
    ['Report', 'Generated On', r.generatedAt],
    ...(ctx.grantName?.trim() ? [['Grant Context', 'Grant / Program Name', ctx.grantName.trim()]] : []),
    ...(ctx.fundingBody?.trim() ? [['Grant Context', 'Council / Funding Body', ctx.fundingBody.trim()]] : []),
    ...(ctx.reference?.trim() ? [['Grant Context', 'Application / Acquittal Reference', ctx.reference.trim()]] : []),
    ['Governance', 'ABN', r.governance.abn || 'Not recorded'],
    ['Governance', 'GST Registered', r.governance.gstRegistered ? 'Yes' : 'No'],
    ['Governance', 'Founded Year', r.governance.foundedYear ?? 'Not recorded'],
    ['Governance', 'Home Ground', r.governance.homeGround || 'Not recorded'],
    ['Governance', 'Home Ground Address', r.governance.homeAddress || 'Not recorded'],
    ['Governance', 'Active Teams', r.governance.activeTeamsCount],
    ['Governance', 'Committee Members', r.governance.committeeCount],
    ['Governance', 'Welfare Officer Appointed', r.governance.welfareOfficerAppointed ? 'Yes' : 'No'],
    ['Governance', 'Staff with Valid Safeguarding Checks', `${r.governance.safeguarding.valid + r.governance.safeguarding.expiring} of ${r.governance.safeguarding.totalStaff}`],
    ['Participation', 'Active Members (Total)', r.demographics.available ? r.demographics.totalMembers : 'Restricted'],
    ['Participation', 'Active Players', r.demographics.available ? r.demographics.activePlayers : 'Restricted'],
    ['Participation', 'Junior & Youth Players', r.demographics.available ? r.demographics.juniorPlayers : 'Restricted'],
    ['Participation', 'Veterans / Masters Players', r.demographics.available ? r.demographics.veteranPlayers : 'Restricted'],
    ['Participation', 'Women & Girls Players', r.demographics.available ? r.demographics.womenGirlsPlayers : 'Restricted'],
    ['Participation', 'Coaches, Staff & Volunteers', r.demographics.available ? r.demographics.staffVolunteers : 'Restricted'],
    ['Participation', 'Fee Waivers / Hardship Support Granted', r.demographics.available ? r.demographics.feeWaiversCount : 'Restricted'],
    ['Activity', 'Completed Matches', r.attendance.allClub.matchesCompleted],
    ['Activity', 'Match Player-Appearances', r.attendance.allClub.matchAppearances],
    ['Activity', 'Training Sessions Held', r.attendance.allClub.trainingSessions],
    ['Activity', 'Training Attendances', r.attendance.allClub.trainingAttendances],
    ['Activity', 'Community & Club Events Held', r.attendance.communityEvents.eventsHeld],
    ['Activity', 'Total Participant-Sessions', r.attendance.totalParticipantSessions],
    ['Finance', `Equipment, Facility & Coaching Spend (${r.spend.currency})`, amt(r.spend.grantRelevantTotalCents)],
    ['Finance', `Total Club Expenses (${r.spend.currency})`, amt(r.spend.totalExpensesCents)],
    ['Finance', `Total Club Income (${r.spend.currency})`, amt(r.spend.totalIncomeCents)],
    ['Finance', `Grants & Council Funding Received (${r.spend.currency})`, amt(r.spend.grantIncomeCents)],
    ['Finance', 'Club Self-Funded Ratio (%)', r.spend.selfFundedPercent !== null ? `${r.spend.selfFundedPercent}%` : 'N/A'],
    ['Acquittal', 'Grant-Relevant Expenses with Receipt on File', `${r.spend.receiptReadiness.withReceiptCount} of ${r.spend.receiptReadiness.totalCount}`],
  ];
  return rows;
}

export function demographicsCsv(r: GrantImpactReport): CsvRow[] {
  const rows: CsvRow[] = [
    ['Breakdown', 'Category', 'Teams', 'Count', 'Share (%)'],
    ...r.demographics.ageBrackets.map(b => ['Age Bracket (Active Players)', b.label, '', b.count, `${b.percent}%`]),
    ...r.demographics.programs.map(p => ['Program Stream (Players may play in multiple)', p.label, p.teams, p.players, '']),
    ...r.demographics.byTeamGender.map(g => ['Team Gender Category', g.label, g.teams, g.players, '']),
    ...r.demographics.tiers.map(t => ['Membership Tier', t.tier, '', t.count, '']),
    ['Accessibility', 'Fee Waivers Granted', '', r.demographics.feeWaiversCount, ''],
    ['Diversity', 'Distinct Nationalities (Adult Members)', '', r.demographics.distinctAdultNationalities, ''],
  ];
  return rows;
}

export function attendanceCsv(r: GrantImpactReport): CsvRow[] {
  const rows: CsvRow[] = [
    ['Program', 'Teams', 'Active Squad', 'Completed Matches', 'Match Appearances', 'Training Sessions', 'Training Attendances', 'Avg Training Turnout'],
    ...r.attendance.programs.map(p => [
      p.label, p.teams, p.squadSize, p.matchesCompleted, p.matchAppearances,
      p.trainingSessions, p.trainingAttendances, p.avgTrainingTurnout,
    ]),
    [
      r.attendance.allClub.label, r.attendance.allClub.teams, r.attendance.allClub.squadSize,
      r.attendance.allClub.matchesCompleted, r.attendance.allClub.matchAppearances,
      r.attendance.allClub.trainingSessions, r.attendance.allClub.trainingAttendances,
      r.attendance.allClub.avgTrainingTurnout,
    ],
    [],
    ['Community Event Category', 'Events Held', 'RSVPs / Registered', 'Checked In'],
    ...r.attendance.communityEvents.byCategory.map(c => [c.label, c.count, c.rsvps, c.checkins]),
    ['Total Community Events', r.attendance.communityEvents.eventsHeld, r.attendance.communityEvents.totalRsvps, r.attendance.communityEvents.totalCheckins],
  ];
  return rows;
}

export function spendSummaryCsv(r: GrantImpactReport): CsvRow[] {
  const prev = r.previousPeriod;
  const head: CsvRow = [
    'Spend Bucket', 'Grant Relevant', 'Records',
    `${r.period.label} (${r.spend.currency})`,
    ...(prev ? [`${prev.label} (${r.spend.currency})`] : []),
  ];
  return [
    head,
    ...r.spend.buckets.map(b => [
      b.label, b.grantRelevant ? 'Yes' : 'No', b.count, amt(b.cents),
      ...(prev ? [amt(b.previousCents)] : []),
    ]),
    [
      'Subtotal: Equipment, Facilities & Coaching', 'Yes', r.spend.receiptReadiness.totalCount,
      amt(r.spend.grantRelevantTotalCents),
      ...(prev ? [amt(r.spend.grantRelevantPreviousCents)] : []),
    ],
    [
      'Total Club Expenses', '', '', amt(r.spend.totalExpensesCents),
      ...(prev ? [amt(r.spend.previousExpensesCents)] : []),
    ],
    [],
    ['Funding & Acquittal Summary', 'Value'],
    [`Total Club Income (${r.spend.currency})`, amt(r.spend.totalIncomeCents)],
    [`Grants & Council Funding Received (${r.spend.currency})`, amt(r.spend.grantIncomeCents)],
    [`Club Self-Funded Income (${r.spend.currency})`, amt(r.spend.selfFundedIncomeCents)],
    ['Self-Funded Ratio (%)', r.spend.selfFundedPercent !== null ? `${r.spend.selfFundedPercent}%` : 'N/A'],
    ['Grant-Relevant Expenses with Receipt Attached', `${r.spend.receiptReadiness.withReceiptCount} of ${r.spend.receiptReadiness.totalCount} (${amt(r.spend.receiptReadiness.withReceiptCents)} ${r.spend.currency})`],
    ['Grant-Relevant Expenses Missing Receipt', `${r.spend.receiptReadiness.missingReceiptCount} (${amt(r.spend.receiptReadiness.missingReceiptCents)} ${r.spend.currency})`],
  ];
}

export function itemisedExpensesCsv(r: GrantImpactReport): CsvRow[] {
  return [
    ['Date', 'Spend Bucket', 'Category', 'Supplier / Vendor', 'Description', 'Payment Method', 'Amount', 'Currency', 'Receipt Attached', 'Record ID'],
    ...r.spend.itemisedGrantExpenses.map(e => [
      e.date, e.bucketLabel, e.categoryLabel, e.vendor, e.description,
      e.method, amt(e.amountCents), e.currency, e.hasReceipt ? 'Yes' : 'No', e.id,
    ]),
  ];
}

/** Concise plain-text paragraph ready to paste into council grant portals (e.g. SmartyGrants) */
export function grantSummaryText(r: GrantImpactReport, ctx: GrantContext = {}): string {
  const money = (cents: number) => formatMoney(cents, r.spend.currency);
  const parts: string[] = [];

  const headerBits = [
    ctx.grantName?.trim(),
    ctx.fundingBody?.trim(),
    ctx.reference?.trim() ? `Ref: ${ctx.reference.trim()}` : '',
  ].filter(Boolean);
  if (headerBits.length) parts.push(headerBits.join(' — '));

  const ground = r.governance.homeGround ? ` based at ${r.governance.homeGround}` : '';
  const abn = r.governance.abn ? ` (ABN ${r.governance.abn})` : '';
  parts.push(
    `${r.governance.clubName}${abn}${ground} submits this Club Impact & Participation Summary for ${r.period.label}.`
  );

  if (r.demographics.available) {
    const cohorts: string[] = [];
    if (r.demographics.juniorPlayers > 0) cohorts.push(`${r.demographics.juniorPlayers} junior/youth players`);
    if (r.demographics.womenGirlsPlayers > 0) cohorts.push(`${r.demographics.womenGirlsPlayers} women & girls players`);
    if (r.demographics.veteranPlayers > 0) cohorts.push(`${r.demographics.veteranPlayers} veterans/masters players`);
    const cohortText = cohorts.length ? `, including ${cohorts.join(', ')}` : '';
    const waiverText = r.demographics.feeWaiversCount > 0
      ? ` We also provided ${r.demographics.feeWaiversCount} membership fee waiver${r.demographics.feeWaiversCount === 1 ? '' : 's'} to support local families.`
      : '';
    parts.push(
      `During this period the club supported ${r.demographics.totalMembers} active members (${r.demographics.activePlayers} active players across ${r.governance.activeTeamsCount} team${r.governance.activeTeamsCount === 1 ? '' : 's'}${cohortText}) and ${r.demographics.staffVolunteers} volunteer coaches, committee members and staff.${waiverText}`
    );
  }

  parts.push(
    `On-field and community activity delivered ${r.attendance.allClub.matchesCompleted} completed fixtures (${r.attendance.allClub.matchAppearances} player-appearances), ${r.attendance.allClub.trainingSessions} training sessions (${r.attendance.allClub.trainingAttendances} attendances), and ${r.attendance.communityEvents.eventsHeld} community events — totalling ${r.attendance.totalParticipantSessions} recorded participant-sessions.`
  );

  const selfFunded = r.spend.selfFundedPercent !== null ? ` (${r.spend.selfFundedPercent}% self-funded by club members, sponsors and fundraising)` : '';
  parts.push(
    `The club invested ${money(r.spend.grantRelevantTotalCents)} directly into kit, equipment, facilities, pitch hire and coaching out of ${money(r.spend.totalExpensesCents)} total operating expenditure, alongside ${money(r.spend.totalIncomeCents)} in club income${selfFunded}. ${r.spend.receiptReadiness.withReceiptCount} of ${r.spend.receiptReadiness.totalCount} grant-relevant expense records have supplier receipts on file.`
  );

  return parts.join('\n\n');
}

const withBom = (rows: CsvRow[]) => '\ufeff' + toCsv(rows);

/** One-click ZIP archive holding all 5 grant & acquittal CSVs plus a plain-text summary */
export function buildGrantPackZip(r: GrantImpactReport, ctx: GrantContext = {}): Uint8Array {
  return zipFiles([
    { name: '00-grant-summary.txt', text: grantSummaryText(r, ctx) + '\n' },
    { name: '01-executive-summary.csv', text: withBom(executiveSummaryCsv(r, ctx)) },
    { name: '02-player-demographics.csv', text: withBom(demographicsCsv(r)) },
    { name: '03-program-attendance.csv', text: withBom(attendanceCsv(r)) },
    { name: '04-equipment-facility-spend.csv', text: withBom(spendSummaryCsv(r)) },
    { name: '05-itemised-grant-expenses.csv', text: withBom(itemisedExpensesCsv(r)) },
  ]);
}
