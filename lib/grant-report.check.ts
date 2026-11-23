// Run: npx esbuild lib/grant-report.check.ts --bundle --platform=node | node   (part of `npm run check`)
import assert from 'node:assert/strict';
import {
  attendanceCsv, buildGrantPackZip, buildGrantReport, demographicsCsv, executiveSummaryCsv,
  expenseBucket, grantSummaryText, itemisedExpensesCsv, spendSummaryCsv, teamPrograms,
  type GrantExpense, type GrantPayment, type GrantReportInput,
} from './grant-report';
import { toCsv } from './finance';
import type { ClubEvent, ClubMember, ClubTeam, ClubTeamMember, EventAttendee, Match, PlayerAvailability } from './supabase/types';

const CLUB_ID = 'club-1';

const member = (id: string, over: Partial<ClubMember> = {}): ClubMember => ({
  id,
  club_id: CLUB_ID,
  full_name: `Secret Name ${id}`,
  email: `secret.${id}@example.com`,
  role: 'player',
  roles: ['Player'],
  status: 'active',
  membership_status: 'approved',
  qr_code_token: `qr-${id}`,
  membership_tier: 'Senior',
  membership_expires_at: '2027-06-30',
  is_executive: false,
  ...over,
});

const team = (id: string, over: Partial<ClubTeam> = {}): ClubTeam => ({
  id,
  club_id: CLUB_ID,
  name: id,
  slug: id,
  team_type: 'senior',
  gender: 'men',
  is_junior: false,
  hide_public_scores: false,
  match_format: '11v11',
  sort_order: 0,
  is_default: false,
  is_active: true,
  ...over,
});

const tm = (team_id: string, member_id: string, team_role: ClubTeamMember['team_role'] = 'player'): ClubTeamMember => ({
  id: `${team_id}-${member_id}`,
  club_id: CLUB_ID,
  team_id,
  member_id,
  team_role,
  is_active: true,
});

const match = (id: string, over: Partial<Match> = {}): Match => ({
  id,
  club_id: CLUB_ID,
  competition: 'Metro League',
  season: '2026',
  home_team_name: 'Rovers FC',
  away_team_name: 'United FC',
  home_team_logo: '',
  away_team_logo: '',
  is_club_home: true,
  match_date: '2026-05-10',
  venue: 'Central Park',
  status: 'completed',
  home_score: 2,
  away_score: 1,
  current_minute: 90,
  added_time: 0,
  period: 'full_time',
  ...over,
});

const event = (id: string, over: Partial<ClubEvent> = {}): ClubEvent => ({
  id,
  club_id: CLUB_ID,
  title: `Event ${id}`,
  description: '',
  category: 'training',
  season: '2026',
  start_time: '2026-05-07T08:00:00Z',
  location: 'Central Park',
  max_capacity: 50,
  rsvp_count: 0,
  is_public: true,
  ...over,
});

const pay = (id: string, over: Partial<GrantPayment> = {}): GrantPayment => ({
  id,
  kind: 'income_other',
  category: 'membership',
  status: 'paid',
  method: 'bank_transfer',
  amount_cents: 10000,
  season: '2026',
  created_at: '2026-04-01T00:00:00Z',
  paid_at: '2026-04-02T00:00:00Z',
  currency: 'AUD',
  ...over,
});

const exp = (id: string, over: Partial<GrantExpense> = {}): GrantExpense => ({
  id,
  category: 'kit_equipment',
  description: 'Match balls & bibs',
  vendor: 'SportCo',
  amount_cents: 50000,
  currency: 'AUD',
  spent_on: '2026-04-15',
  method: 'bank_transfer',
  reimbursed: false,
  season: '2026',
  created_at: '2026-04-15T00:00:00Z',
  ...over,
});

// --- Bucket & program classification helpers ---
assert.equal(expenseBucket('kit_equipment'), 'equipment');
assert.equal(expenseBucket('medical'), 'equipment');
assert.equal(expenseBucket('facility_hire'), 'facilities');
assert.equal(expenseBucket('maintenance'), 'facilities');
assert.equal(expenseBucket('utilities'), 'facilities');
assert.equal(expenseBucket('coaching'), 'coaching_welfare');
assert.equal(expenseBucket('player_welfare'), 'coaching_welfare');
assert.equal(expenseBucket('referees'), 'matchday_ops');
assert.equal(expenseBucket('catering'), 'other_ops');

assert.deepEqual(
  teamPrograms({ team_type: 'youth', is_junior: true, gender: 'girls' }).sort(),
  ['junior', 'women_girls'],
  'girls junior team belongs to both junior and women_girls streams'
);
assert.deepEqual(teamPrograms({ team_type: 'veterans', is_junior: false, gender: 'men' }), ['veterans']);

// --- Full club scenario ---
const teams: ClubTeam[] = [
  team('t-senior', { name: 'First Team', team_type: 'senior', gender: 'men', is_default: true }),
  team('t-u10', { name: 'U10 Mixed', team_type: 'youth', age_group: 'U10', gender: 'mixed', is_junior: true }),
  team('t-u14g', { name: 'U14 Girls', team_type: 'youth', age_group: 'U14', gender: 'girls', is_junior: true }),
  team('t-vets', { name: 'Over 35s', team_type: 'veterans', gender: 'men' }),
];

const members: ClubMember[] = [
  // Junior under 12 (age 10 on 2026-10-31)
  member('m-j1', { date_of_birth: '2016-03-10', membership_tier: 'Junior', nationality: 'Nepal', is_junior: true, fee_waived_at: '2026-03-01T00:00:00Z' }),
  // Junior 12-17 (age 14)
  member('m-j2', { date_of_birth: '2012-06-15', membership_tier: 'Junior' }),
  // Young adult 18-24 (age 22)
  member('m-s1', { date_of_birth: '2004-02-20', membership_tier: 'Senior', nationality: 'Australia' }),
  // Veterans 35-44 (age 38) + Coach with valid WWC check
  member('m-v1', {
    date_of_birth: '1988-01-05',
    roles: ['Player', 'Coach'],
    membership_tier: 'Veterans',
    nationality: 'India',
    safeguarding_check_type: 'WWC',
    safeguarding_check_date: '2025-01-01',
    safeguarding_check_expiry_date: '2028-01-01',
  }),
  // Veterans 45+ (age 48) + Executive committee with expired check
  member('m-v2', {
    date_of_birth: '1978-05-12',
    roles: ['Player', 'Executive Committee'],
    is_executive: true,
    membership_tier: 'Veterans',
    nationality: 'Australia',
    safeguarding_check_date: '2021-01-01',
    safeguarding_check_expiry_date: '2026-01-01',
  }),
  // Player with missing DOB
  member('m-nodob', { date_of_birth: undefined, membership_tier: 'Senior' }),
  // Non-playing supporter
  member('m-sup', { role: 'supporter', roles: ['Supporter'], membership_tier: 'Supporter' }),
  // Pending & rejected applications must NEVER be counted
  member('m-pend', { membership_status: 'pending' }),
  member('m-rej', { membership_status: 'rejected' }),
];

const teamMembers: ClubTeamMember[] = [
  tm('t-u10', 'm-j1', 'player'),
  tm('t-u14g', 'm-j2', 'player'),
  tm('t-senior', 'm-s1', 'player'),
  tm('t-senior', 'm-nodob', 'player'),
  tm('t-vets', 'm-v1', 'player'),
  tm('t-vets', 'm-v2', 'player'),
  tm('t-u10', 'm-v1', 'coach'),
];

const matches: Match[] = [
  // Junior match: 2 starters + 1 bench (1 overlap with starter -> 2 unique)
  match('match-j1', {
    team_id: 't-u10',
    home_lineup_coords: [
      { id: '1', member_id: 'm-j1', name: 'Secret Name m-j1', number: 9, position: 'ST', x: 50, y: 20 },
      { id: '2', member_id: 'm-j2', name: 'Secret Name m-j2', number: 7, position: 'RW', x: 80, y: 30 },
    ],
    bench_member_ids: ['m-j1'], // duplicate starter should not double-count
  }),
  // Veterans match: 2 starters
  match('match-v1', {
    team_id: 't-vets',
    home_lineup_coords: [
      { id: '1', member_id: 'm-v1', name: 'Secret Name m-v1', number: 4, position: 'CB', x: 40, y: 70 },
      { id: '2', member_id: 'm-v2', name: 'Secret Name m-v2', number: 5, position: 'CB', x: 60, y: 70 },
    ],
  }),
  // Upcoming match must not count as completed
  match('match-upcoming', { team_id: 't-senior', status: 'upcoming' }),
];

const events: ClubEvent[] = [
  event('ev-tr1', { category: 'training', start_time: '2026-05-07T08:00:00Z' }),
  event('ev-tr2', { category: 'training', start_time: '2026-05-14T08:00:00Z' }),
  // Future training after today must not count as held
  event('ev-tr-future', { category: 'training', start_time: '2026-12-01T08:00:00Z' }),
  // Community gala day
  event('ev-social', { category: 'social', start_time: '2026-05-20T02:00:00Z', rsvp_count: 12 }),
];

const eventAttendees: EventAttendee[] = [
  // m-j1 checked in at tr1 AND also marked available -> must deduplicate to 1!
  { id: 'att-1', event_id: 'ev-tr1', club_id: CLUB_ID, member_id: 'm-j1', attendee_name: 'Secret Name m-j1', checkin_status: 'checked_in', qr_ticket_code: 'q1' },
  { id: 'att-2', event_id: 'ev-tr1', club_id: CLUB_ID, member_id: 'm-v1', attendee_name: 'Secret Name m-v1', checkin_status: 'checked_in', qr_ticket_code: 'q2' },
  // Social event check-ins (cancelled ignored)
  { id: 'att-3', event_id: 'ev-social', club_id: CLUB_ID, member_id: 'm-s1', attendee_name: 'Secret Name m-s1', checkin_status: 'checked_in', qr_ticket_code: 'q3' },
  { id: 'att-4', event_id: 'ev-social', club_id: CLUB_ID, member_id: 'm-sup', attendee_name: 'Secret Name m-sup', checkin_status: 'cancelled', qr_ticket_code: 'q4' },
];

const availabilities: PlayerAvailability[] = [
  { id: 'av-1', club_id: CLUB_ID, event_id: 'ev-tr1', member_id: 'm-j1', status: 'available', response_token: 't1', updated_at: '2026-05-06T00:00:00Z' },
  { id: 'av-2', club_id: CLUB_ID, event_id: 'ev-tr2', member_id: 'm-j1', status: 'available', response_token: 't2', updated_at: '2026-05-13T00:00:00Z' },
  { id: 'av-3', club_id: CLUB_ID, event_id: 'ev-tr2', member_id: 'm-j2', status: 'available', response_token: 't3', updated_at: '2026-05-13T00:00:00Z' },
  { id: 'av-4', club_id: CLUB_ID, event_id: 'ev-tr2', member_id: 'm-v2', status: 'unavailable', response_token: 't4', updated_at: '2026-05-13T00:00:00Z' },
];

const payments: GrantPayment[] = [
  pay('p1', { category: 'membership', amount_cents: 80000, season: '2026', paid_at: '2026-04-02T00:00:00Z' }),
  pay('p2', { category: 'grants', amount_cents: 20000, season: '2026', paid_at: '2026-05-01T00:00:00Z' }),
  pay('p3', { category: 'membership', amount_cents: 50000, season: '2025', paid_at: '2025-04-02T00:00:00Z' }),
  pay('p-unpaid', { category: 'grants', amount_cents: 99900, status: 'pending', season: '2026' }),
];

const expenses: GrantExpense[] = [
  exp('e1', { category: 'kit_equipment', amount_cents: 45000, receipt_key: 'r2/receipt-1.pdf', spent_on: '2026-04-10', season: '2026' }),
  exp('e2', { category: 'facility_hire', amount_cents: 30000, receipt_key: null, spent_on: '2026-05-02', season: '2026', description: 'Winter floodlights', vendor: 'Blacktown Council' }),
  exp('e3', { category: 'coaching', amount_cents: 15000, receipt_key: 'r2/receipt-3.jpg', spent_on: '2026-05-12', season: '2026', description: 'FA Level 1 course' }),
  exp('e4', { category: 'referees', amount_cents: 10000, spent_on: '2026-05-18', season: '2026', description: 'Match officials' }),
  exp('e-prev', { category: 'kit_equipment', amount_cents: 25000, spent_on: '2025-04-10', season: '2025' }),
];

const baseInput: GrantReportInput = {
  club: {
    id: CLUB_ID,
    slug: 'rovers-fc',
    name: 'Rovers FC',
    founded_year: 2010,
    stadium_name: 'Central Park',
    stadium_address: '10 Park Rd, Blacktown NSW',
    stadium_pitch_type: 'Grass',
    junior_includes_u18: true,
    welfare_officer_name: 'Pat Guardian',
  },
  settings: { currency: 'AUD', abn: '12345678901', gst_registered: false },
  period: { mode: 'season', label: 'Season 2026', from: '2026-03-01', to: '2026-10-31', seasonName: '2026' },
  previousPeriod: { mode: 'season', label: 'Season 2025', from: '2025-03-01', to: '2025-10-31', seasonName: '2025' },
  includeDemographics: true,
  members,
  teams,
  teamMembers,
  matches,
  events,
  eventAttendees,
  availabilities,
  playerStats: [],
  payments,
  expenses,
  today: '2026-06-01',
};

const report = buildGrantReport(baseInput);

// 1. Governance & safeguarding
assert.equal(report.governance.abn, '12 345 678 901');
assert.equal(report.governance.activeTeamsCount, 4);
assert.equal(report.governance.committeeCount, 1);
assert.equal(report.governance.welfareOfficerAppointed, true);
assert.equal(report.governance.safeguarding.totalStaff, 2);
assert.equal(report.governance.safeguarding.valid, 1);
assert.equal(report.governance.safeguarding.expired, 1);

// 2. Demographics
assert.equal(report.demographics.totalMembers, 7, 'excludes pending & rejected');
assert.equal(report.demographics.activePlayers, 6, 'excludes non-playing supporter');
assert.equal(report.demographics.juniorPlayers, 2);
assert.equal(report.demographics.veteranPlayers, 2);
assert.equal(report.demographics.womenGirlsPlayers, 1);
assert.equal(report.demographics.supporters, 1);
assert.equal(report.demographics.feeWaiversCount, 1);
assert.equal(report.demographics.distinctAdultNationalities, 2, 'Australia & India; junior nationality excluded for privacy');

const bracketTotal = report.demographics.ageBrackets.reduce((n, b) => n + b.count, 0);
assert.equal(bracketTotal, report.demographics.activePlayers, 'age brackets reconcile to active players');
assert.equal(report.demographics.ageBrackets.find(b => b.label.startsWith('Under 12'))?.count, 1);
assert.equal(report.demographics.ageBrackets.find(b => b.label.startsWith('12–17'))?.count, 1);
assert.equal(report.demographics.ageBrackets.find(b => b.label.startsWith('Age not recorded'))?.count, 1);

// 3. Attendance
assert.equal(report.attendance.allClub.matchesCompleted, 2);
assert.equal(report.attendance.allClub.matchAppearances, 4, '2 junior + 2 veterans, bench duplicate deduplicated');
assert.equal(report.attendance.allClub.trainingSessions, 2, 'future training excluded');
assert.equal(report.attendance.allClub.trainingAttendances, 4, 'tr1: m-j1 (deduped) + m-v1 = 2; tr2: m-j1 + m-j2 = 2');
assert.equal(report.attendance.allClub.avgTrainingTurnout, 2);
const juniorAtt = report.attendance.programs.find(p => p.key === 'junior')!;
assert.equal(juniorAtt.trainingAttendances, 3, 'm-j1 twice + m-j2 once');
assert.equal(juniorAtt.matchesCompleted, 1);
assert.equal(juniorAtt.matchAppearances, 2);
const vetsAtt = report.attendance.programs.find(p => p.key === 'veterans')!;
assert.equal(vetsAtt.trainingAttendances, 1, 'm-v1 at tr1');
assert.equal(vetsAtt.matchesCompleted, 1);
assert.equal(report.attendance.communityEvents.eventsHeld, 1);
assert.equal(report.attendance.communityEvents.totalRsvps, 12);
assert.equal(report.attendance.communityEvents.totalCheckins, 1, 'cancelled attendee ignored');
assert.equal(report.attendance.totalParticipantSessions, 9, '4 match + 4 training + 1 event checkin');

// 4. Spend & acquittal readiness
assert.equal(report.spend.totalIncomeCents, 100000, 'pending grant excluded');
assert.equal(report.spend.grantIncomeCents, 20000);
assert.equal(report.spend.selfFundedIncomeCents, 80000);
assert.equal(report.spend.selfFundedPercent, 80);
assert.equal(report.spend.totalExpensesCents, 100000);
assert.equal(report.spend.grantRelevantTotalCents, 90000, '45000 equip + 30000 facility + 15000 coaching');
assert.equal(report.spend.grantRelevantPreviousCents, 25000);
assert.equal(report.spend.receiptReadiness.totalCount, 3);
assert.equal(report.spend.receiptReadiness.withReceiptCount, 2);
assert.equal(report.spend.receiptReadiness.missingReceiptCount, 1);
assert.equal(report.spend.receiptReadiness.withReceiptCents, 60000);
assert.equal(report.spend.receiptReadiness.missingReceiptCents, 30000);
assert.equal(report.spend.itemisedGrantExpenses.length, 3);
assert.equal(report.spend.itemisedGrantExpenses[0].id, 'e1', 'sorted chronologically');

// 5. Financial Year / Date Range mode
const dateReport = buildGrantReport({
  ...baseInput,
  period: { mode: 'dates', label: '2025/26', from: '2025-07-01', to: '2026-06-30' },
  previousPeriod: { mode: 'dates', label: '2024/25', from: '2024-07-01', to: '2025-06-30' },
});
assert.equal(dateReport.spend.grantRelevantTotalCents, 90000, 'date range captures all 2026 Apr/May grant expenses');
assert.equal(dateReport.spend.grantRelevantPreviousCents, 25000, 'prior FY captures 2025-04-10 expense');
assert.equal(dateReport.spend.totalIncomeCents, 100000);

// 6. Restricted demographics mode
const restricted = buildGrantReport({ ...baseInput, includeDemographics: false });
assert.equal(restricted.demographics.available, false);
assert.equal(restricted.demographics.totalMembers, 0);
assert.equal(restricted.spend.grantRelevantTotalCents, 90000, 'financials still intact when people access restricted');

// 7. Exports & Zero-PII verification
const ctx = { grantName: 'Local Sport Grant 2026', fundingBody: 'Blacktown City Council', reference: 'LSG-2026-09' };
const allCsvText = [
  toCsv(executiveSummaryCsv(report, ctx)),
  toCsv(demographicsCsv(report)),
  toCsv(attendanceCsv(report)),
  toCsv(spendSummaryCsv(report)),
  toCsv(itemisedExpensesCsv(report)),
  grantSummaryText(report, ctx),
].join('\n');

assert.ok(allCsvText.includes('Local Sport Grant 2026'), 'grant context included');
assert.ok(allCsvText.includes('Blacktown City Council'), 'funding body included');
assert.ok(!allCsvText.includes('Secret Name'), 'ZERO PII: no member names in any export');
assert.ok(!allCsvText.includes('@example.com'), 'ZERO PII: no member emails in any export');
assert.ok(!allCsvText.includes('2016-03-10'), 'ZERO PII: no member birth dates in any export');

// ZIP archive check
const zipBytes = buildGrantPackZip(report, ctx);
assert.ok(zipBytes.length > 500, 'ZIP generated with non-trivial payload');
assert.equal(zipBytes[0], 0x50); // 'P'
assert.equal(zipBytes[1], 0x4b); // 'K'
const zipAscii = new TextDecoder().decode(zipBytes);
assert.ok(zipAscii.includes('00-grant-summary.txt'));
assert.ok(zipAscii.includes('01-executive-summary.csv'));
assert.ok(zipAscii.includes('02-player-demographics.csv'));
assert.ok(zipAscii.includes('03-program-attendance.csv'));
assert.ok(zipAscii.includes('04-equipment-facility-spend.csv'));
assert.ok(zipAscii.includes('05-itemised-grant-expenses.csv'));
assert.ok(!zipAscii.includes('Secret Name'), 'ZERO PII in ZIP archive');

console.log('grant-report.check.ts: all checks passed');
