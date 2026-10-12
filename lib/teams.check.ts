// Self-check for club team helpers.
// Run: npx esbuild lib/teams.check.ts --bundle --platform=node --log-level=warning | node
import assert from 'node:assert/strict';
import type { ClubTeam, ClubTeamMember } from './supabase/types';
import {
  AGE_GROUPS, ageGroupAge, clubTeamsOf, defaultTeamOf, hasMultipleTeams, isTeamFixture, suggestedFormat,
  squadForMatch, teamMemberIds, teamOfMatch, teamSlug, teamsOfMember, uniqueTeamSlug,
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

console.log('teams.check: ok');
