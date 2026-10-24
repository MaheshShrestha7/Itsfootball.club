// Self-check for club team helpers.
// Run: npx esbuild lib/teams.check.ts --bundle --platform=node --log-level=warning | node
import assert from 'node:assert/strict';
import type { ClubTeam, ClubTeamMember } from './supabase/types';
import {
  AGE_GROUPS, ageGroupAge, clubTeamsOf, defaultTeamOf, hasMultipleTeams, isTeamFixture, suggestedFormat,
  squadForMatch, teamMemberIds, teamOfMatch, teamSlug, teamsOfMember, uniqueTeamSlug,
  ageGroupCutoff, ageGroupFit, ageOnDate, isJuniorAgeGroup, isJuniorFixture, isJuniorMember, juniorMemberIds,
  juniorPublicName, publicMember, safeguardingCheckStatus, goalScoringSide,
} from './teams';

const team = (id: string, extra: Partial<ClubTeam> = {}): ClubTeam => ({
  id, club_id: 'c1', name: id, slug: id, team_type: 'senior', gender: 'mixed', is_junior: false,
  hide_public_scores: false, match_format: '11v11', sort_order: 100, is_default: false, is_active: true, ...extra,
});

// Age groups match the database check (U5 ... U23)
assert.equal(AGE_GROUPS[0], 'U5');
assert.equal(AGE_GROUPS[AGE_GROUPS.length - 1], 'U23');
assert.equal(ageGroupAge('U10'), 10);
assert.equal(ageGroupAge(undefined), null);
assert.equal(ageGroupAge('Open'), null);
assert.equal(suggestedFormat('U7'), '5v5');
assert.equal(suggestedFormat('U9'), '7v7');
assert.equal(suggestedFormat('U12'), '9v9');
assert.equal(suggestedFormat('U16'), '11v11');
assert.equal(suggestedFormat(undefined), '11v11');

// Slugs satisfy ^[a-z0-9]+(-[a-z0-9]+)*$
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
for (const name of ['First Team', 'U10 Lions!', '  Réserves  ', '---', 'Girls U-12 / B']) {
  assert.match(teamSlug(name), SLUG, name);
}
assert.equal(teamSlug('U10 Lions!'), 'u10-lions');
assert.equal(teamSlug('Réserves'), 'reserves');
assert.equal(teamSlug('!!!'), 'team');
assert.equal(uniqueTeamSlug('U10', [{ id: 'a', slug: 'u10' }]), 'u10-2');
assert.equal(uniqueTeamSlug('U10', [{ id: 'a', slug: 'u10' }, { id: 'b', slug: 'u10-2' }]), 'u10-3');
assert.equal(uniqueTeamSlug('U10', [{ id: 'a', slug: 'u10' }], 'a'), 'u10'); // its own slug is fine

// Ordering, main team and the "more than one team" switch
const teams = [
  team('u10', { sort_order: 20, is_junior: true }),
  team('first', { is_default: true, sort_order: 50 }),
  team('res', { sort_order: 10 }),
  team('old', { is_active: false }),
  team('other-club', { club_id: 'c2', is_default: true }),
];
assert.deepEqual(clubTeamsOf(teams, 'c1').map(t => t.id), ['first', 'res', 'u10']);
assert.deepEqual(clubTeamsOf(teams, 'c1', { includeInactive: true }).map(t => t.id), ['first', 'res', 'u10', 'old']);
assert.equal(defaultTeamOf(teams, 'c1')?.id, 'first');
assert.ok(hasMultipleTeams(teams, 'c1'));
assert.ok(!hasMultipleTeams(teams, 'c2'));
assert.ok(!hasMultipleTeams([team('first', { is_default: true }), team('old', { is_active: false })], 'c1'));

// Which team plays a fixture
assert.ok(isTeamFixture({ match_type: 'friendly' }));
assert.ok(isTeamFixture({}));
assert.ok(!isTeamFixture({ match_type: 'internal' }));
assert.ok(!isTeamFixture({ match_type: 'friendly', tournament_id: 't1' }));
assert.equal(teamOfMatch({ club_id: 'c1', team_id: 'u10' }, teams)?.id, 'u10');
assert.equal(teamOfMatch({ club_id: 'c1', match_type: 'friendly' }, teams)?.id, 'first');
assert.equal(teamOfMatch({ club_id: 'c1', match_type: 'internal' }, teams), undefined);

// Rosters
const rows: ClubTeamMember[] = [
  { id: '1', club_id: 'c1', team_id: 'first', member_id: 'm1', team_role: 'player' },
  { id: '2', club_id: 'c1', team_id: 'res', member_id: 'm1', team_role: 'player' },
  { id: '3', club_id: 'c1', team_id: 'u10', member_id: 'm2', team_role: 'coach' },
  { id: '4', club_id: 'c1', team_id: 'first', member_id: 'm3', team_role: 'player', is_active: false },
];
assert.deepEqual(teamMemberIds(rows, 'first'), ['m1']);
assert.deepEqual(teamMemberIds(rows, 'u10', 'staff'), ['m2']);
assert.deepEqual(teamsOfMember(rows, teams, 'm1').map(t => t.id).sort(), ['first', 'res']);

// Players offered for a fixture
const players = [{ id: 'm1' }, { id: 'm2' }, { id: 'm4' }];
assert.deepEqual(squadForMatch(players, { club_id: 'c1', team_id: 'res' }, teams, rows).map(p => p.id), ['m1']);
assert.deepEqual(squadForMatch(players, { club_id: 'c1', match_type: 'friendly' }, teams, rows).map(p => p.id), ['m1']); // main team
assert.equal(squadForMatch(players, { club_id: 'c1', team_id: 'u10' }, teams, rows).length, 3); // no players listed: everyone
assert.equal(squadForMatch(players, { club_id: 'c1', match_type: 'internal' }, teams, rows).length, 3);
assert.equal(squadForMatch(players, { club_id: 'c2', match_type: 'friendly' }, teams, rows).length, 3); // single-team club
assert.equal(squadForMatch(players, null, teams, rows).length, 3);

// Junior rules
assert.equal(isJuniorAgeGroup('U10'), true);
assert.equal(isJuniorAgeGroup('U18'), true);
assert.equal(isJuniorAgeGroup('U18', false), false);
assert.equal(isJuniorAgeGroup('U17', false), true);
assert.equal(isJuniorAgeGroup('U21'), false);
assert.equal(isJuniorAgeGroup(''), false);
assert.equal(juniorPublicName('Sam Taylor'), 'Sam T.');
assert.equal(juniorPublicName('  Jo  Van Dyke '), 'Jo D.');
assert.equal(juniorPublicName('Sam'), 'Sam');
assert.equal(juniorPublicName(''), '');
assert.equal(isJuniorFixture({ club_id: 'c1', team_id: 'u10' }, teams), true);
assert.equal(isJuniorFixture({ club_id: 'c1', match_type: 'friendly' }, teams), false);
const kidRows: ClubTeamMember[] = [
  ...rows,
  { id: '5', club_id: 'c1', team_id: 'u10', member_id: 'k1', team_role: 'player' },
  { id: '6', club_id: 'c1', team_id: 'old', member_id: 'k2', team_role: 'player' }, // inactive team
];
assert.equal(isJuniorMember({ id: 'k1' }, teams, kidRows), true);
assert.equal(isJuniorMember({ id: 'm2' }, teams, kidRows), false); // coach of a junior team
assert.equal(isJuniorMember({ id: 'k2' }, teams, kidRows), false);
assert.equal(isJuniorMember({ id: 'v1', is_junior: true }, teams, []), true); // flag from the public view
assert.deepEqual([...juniorMemberIds([{ id: 'v1', is_junior: true }, { id: 'm1' }], teams, kidRows)].sort(), ['k1', 'v1']);
const kid = { id: 'k1', full_name: 'Sam Taylor', photo_url: 'p.jpg', nationality: 'NZ' };
assert.deepEqual(publicMember(kid, new Set(['k1'])), { ...kid, full_name: 'Sam T.', photo_url: undefined, nationality: undefined });
assert.equal(publicMember({ ...kid, photo_consent: true }, new Set(['k1'])).photo_url, 'p.jpg');
assert.equal(publicMember(kid, new Set()), kid);
assert.equal(publicMember({ ...kid, full_name: 'Sam T.', is_junior: true }, new Set(['k1'])).photo_url, 'p.jpg'); // view row kept as sent

// Age groups on the season's cut-off date
const cutoff = ageGroupCutoff('2026-07-01');
assert.equal(cutoff.toISOString().slice(0, 10), '2026-07-01');
assert.equal(ageGroupCutoff(null, new Date('2026-10-12T00:00:00Z')).toISOString().slice(0, 10), '2026-09-01');
assert.equal(ageGroupCutoff(null, new Date('2027-03-01T00:00:00Z')).toISOString().slice(0, 10), '2026-09-01');
assert.equal(ageOnDate('2016-07-01', cutoff), 10);
assert.equal(ageOnDate('2016-07-02', cutoff), 9);
assert.equal(ageOnDate('bad', cutoff), null);
assert.equal(ageGroupFit('2016-07-02', 'U10', cutoff), 'ok');
assert.equal(ageGroupFit('2016-07-01', 'U10', cutoff), 'too_old');
assert.equal(ageGroupFit('2019-01-01', 'U10', cutoff), 'ok'); // playing up
assert.equal(ageGroupFit(undefined, 'U10', cutoff), null);
assert.equal(ageGroupFit('2016-01-01', null, cutoff), null);

// Staff background checks
const today = new Date('2026-10-12T00:00:00Z');
assert.equal(safeguardingCheckStatus({}, today), 'missing');
assert.equal(safeguardingCheckStatus({ safeguarding_check_date: '2025-01-01' }, today), 'valid');
assert.equal(safeguardingCheckStatus({ safeguarding_check_date: '2023-01-01', safeguarding_check_expiry_date: '2026-10-11' }, today), 'expired');
assert.equal(safeguardingCheckStatus({ safeguarding_check_expiry_date: '2026-11-30' }, today), 'expiring');
assert.equal(safeguardingCheckStatus({ safeguarding_check_expiry_date: '2027-06-30' }, today), 'valid');

// Goals count for their own side; an own goal is logged on the scorer's side and counts for the other
assert.equal(goalScoringSide({ event_type: 'goal', team_side: 'away' }), 'away');
assert.equal(goalScoringSide({ event_type: 'penalty', team_side: 'home' }), 'home');
assert.equal(goalScoringSide({ event_type: 'own_goal', team_side: 'home' }), 'away');
assert.equal(goalScoringSide({ event_type: 'yellow_card', team_side: 'home' }), null);

console.log('teams.check: ok');
