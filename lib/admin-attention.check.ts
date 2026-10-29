import assert from 'node:assert/strict';
import { attentionItems, needsLineup, needsResult } from './admin-attention';
import { clubResult, defaultFixture, hasKickoffTime, matchKind, prepFixtures, publicFixtures, teamSideIn, tournamentTeamGroups } from './fixtures';
import type { TournamentParticipant } from './supabase/types';
import { nextOnPitch } from './tournament-engine';
import type { Match } from './supabase/types';

const NOW = Date.parse('2026-10-25T09:00:00Z');
const H = 3600000;
const m = (over: Partial<Match>): Match => ({
  id: 'm1', club_id: 'c1', home_team_name: 'Riverside FC', away_team_name: 'Hills Rovers', is_club_home: true,
  match_date: new Date(NOW - 4 * H).toISOString(), venue: 'Riverside Park', status: 'upcoming',
  home_score: 0, away_score: 0, match_type: 'friendly', ...over,
} as Match);

// Results due: 3 hours after a timed kick-off, a whole day for date-only cup fixtures, not after a month
assert.equal(needsResult(m({}), NOW), true, 'kicked off 4 hours ago, still upcoming');
assert.equal(needsResult(m({ match_date: new Date(NOW - 2 * H).toISOString() }), NOW), false, 'could still be playing');
assert.equal(needsResult(m({ status: 'completed' }), NOW), false);
assert.equal(needsResult(m({ status: 'live' }), NOW), true, 'left live');
assert.equal(needsResult(m({ match_date: '2026-10-25', match_time: '10:00' }), NOW), false, 'date-only: same day');
assert.equal(needsResult(m({ match_date: new Date(NOW - 40 * 24 * H).toISOString() }), NOW), false, 'too old');

// Line-ups: a real fixture in the next week with nothing saved
const soon = new Date(NOW + 2 * 24 * H).toISOString();
assert.equal(needsLineup(m({ match_date: soon }), NOW), true);
assert.equal(needsLineup(m({ match_date: soon, home_lineup_coords: [{ x: 1, y: 1, member_id: 'p', name: 'P' } as never] }), NOW), false);
assert.equal(needsLineup(m({ match_date: soon, match_type: 'internal' }), NOW), false);
assert.equal(needsLineup(m({ match_date: new Date(NOW + 9 * 24 * H).toISOString() }), NOW), false, 'more than a week away');

const items = attentionItems('rfc', { pendingApplications: 2, receiptsToReview: 0, unreadMessages: 1, ordersToHandOut: 0 }, [m({}), m({ id: 'm2', match_date: soon })], NOW);
assert.deepEqual(items.map(i => i.key), ['result-m1', 'applications', 'messages', 'lineup-m2']);
assert.equal(items[1].text, '2 applications to approve');
assert.equal(items[1].href, '/rfc/admin/people?tab=applications');
assert.equal(items[2].text, '1 unread message');
// SPE-10: opens the Inbox tab where most of the unread messages are
const inboxHref = (unreadContact: number, unreadMessages: number) => attentionItems('rfc', { pendingApplications: 0, receiptsToReview: 0, unreadMessages, unreadContact, ordersToHandOut: 0 }, [], NOW)[0].href;
assert.equal(inboxHref(4, 4), '/rfc/admin/inquiries?tab=contact');
assert.equal(inboxHref(0, 3), '/rfc/admin/inquiries');
assert.equal(inboxHref(1, 5), '/rfc/admin/inquiries');
assert.equal(items[3].href, '/rfc/admin/lineup/draft?match=m2');
assert.deepEqual(attentionItems('rfc', { pendingApplications: 0, receiptsToReview: 0, unreadMessages: 0, ordersToHandOut: 0 }, [], NOW), []);

// Sponsor sign-ups: paid ones first (urgent), then new unpaid ones, both open New sign-ups
const sponsorItems = attentionItems('rfc', { pendingApplications: 0, receiptsToReview: 0, unreadMessages: 0, ordersToHandOut: 0, sponsorsToPutOnSite: 1, sponsorSignups: 2 }, [], NOW);
assert.deepEqual(sponsorItems.map(i => [i.key, i.area, i.tone]), [['sponsors-paid', 'sponsors', 'urgent'], ['sponsors-new', 'sponsors', 'normal']]);
assert.equal(sponsorItems[0].text, '1 paid sponsor waiting to go on the site');
assert.equal(sponsorItems[1].text, '2 new sponsor sign-ups not paid yet');
assert.equal(sponsorItems[1].href, '/rfc/admin/sponsors?view=new');

// Renewals and old sign-ups (SP-X5)
const renewalItems = attentionItems('rfc', { pendingApplications: 0, receiptsToReview: 0, unreadMessages: 0, ordersToHandOut: 0, sponsorsEndingSoon: 3, staleSponsorSignups: 1 }, [], NOW);
assert.deepEqual(renewalItems.map(i => [i.key, i.text, i.href]), [
  ['sponsors-ending', '3 sponsorships end in the next 30 days', '/rfc/admin/sponsors?view=ending'],
  ['sponsors-stale', '1 unpaid sponsor sign-up older than 60 days', '/rfc/admin/sponsors?view=new'],
]);
assert.equal(attentionItems('rfc', { pendingApplications: 0, receiptsToReview: 0, unreadMessages: 0, ordersToHandOut: 0, sponsorsEndingSoon: 1 }, [], NOW)[0].text, '1 sponsorship ends in the next 30 days');
assert.equal(attentionItems('rfc', { pendingApplications: 0, receiptsToReview: 0, unreadMessages: 0, ordersToHandOut: 0, sponsorChanges: 2 }, [], NOW)[0].text, '2 sponsors sent a new logo or website to check');
// SPP-1: a sponsorship that ran out by itself doesn't drop off the list the day it ends
const lapsed = attentionItems('rfc', { pendingApplications: 0, receiptsToReview: 0, unreadMessages: 0, ordersToHandOut: 0, sponsorsLapsed: 1, sponsorsEndingSoon: 2 }, [], NOW);
assert.deepEqual(lapsed.map(i => [i.key, i.tone, i.href]), [['sponsors-lapsed', 'urgent', '/rfc/admin/sponsors?view=ended'], ['sponsors-ending', 'normal', '/rfc/admin/sponsors?view=ending']]);
assert.equal(lapsed[0].text, '1 sponsorship ended in the last 2 weeks and came off the site');

// Results from the club's side: an away 1-2 loss is L 1-2, never "2-1"
assert.deepEqual(clubResult(m({ is_club_home: false, home_score: 2, away_score: 1 })), { us: 1, them: 2, outcome: 'L', onPens: false });
assert.deepEqual(clubResult(m({ home_score: 3, away_score: 1 })), { us: 3, them: 1, outcome: 'W', onPens: false });
assert.equal(clubResult(m({ home_score: 2, away_score: 2 })).outcome, 'D');
assert.deepEqual(clubResult(m({ home_score: 1, away_score: 1, home_penalty_score: 3, away_penalty_score: 4 })), { us: 1, them: 1, outcome: 'L', onPens: true });
assert.equal(clubResult(m({ match_type: 'internal', home_score: 2, away_score: 0 })).outcome, null);
assert.equal(clubResult(m({ tournament_id: 't1', is_club_home: true, home_score: 0, away_score: 1 })).outcome, null, 'tournament sides');

assert.equal(hasKickoffTime(m({ match_date: '2026-10-24' })), false);
assert.equal(hasKickoffTime(m({ match_date: '2026-10-24T00:00:00+00:00', match_time: '09:00' })), false);
assert.equal(hasKickoffTime(m({ match_date: '2026-10-24T04:00:00.000Z', match_time: '15:00' })), true);
// Match Centre lists: tournament games, in-house games, and everything against another club
assert.equal(matchKind(m({ tournament_id: 't1', match_type: 'tournament' })), 'tournament');
assert.equal(matchKind(m({ match_type: 'internal' })), 'inhouse');
assert.equal(matchKind(m({ match_type: 'friendly', competition: 'NSW League Two' })), 'club');
assert.equal(matchKind(m({ match_type: 'tournament' })), 'club', 'a hand-entered cup game without a tournament');

// Next on the same pitch: later in the cup, not finished, same pitch label
const cup = (id: string, round: number, pitch: string, status: Match['status'] = 'upcoming') =>
  m({ id, tournament_id: 't1', tournament_stage: 'group', tournament_round: round, pitch_label: pitch, status, match_date: '2026-10-25', match_time: `0${8 + round}:00` });
const day = [cup('a1', 1, 'Pitch 1', 'live'), cup('b1', 1, 'Pitch 2', 'live'), cup('a2', 2, 'Pitch 1'), cup('b2', 2, 'Pitch 2'), cup('a3', 3, 'Pitch 1')];
assert.equal(nextOnPitch(day[0], day)?.id, 'a2');
assert.equal(nextOnPitch(day[1], day)?.id, 'b2');
assert.equal(nextOnPitch(day[4], day), undefined, 'last game on the pitch');
assert.equal(nextOnPitch(m({}), day), undefined, 'not a tournament game');
// Availability / Lineup Draft lists: upcoming games the club's players are in, and a tournament per team
const team = (id: string, name: string, type: 'internal' | 'external'): TournamentParticipant =>
  ({ id, tournament_id: 't1', team_type: type, name, short_name: name, logo_url: '' });
const parts = [team('p1', 'RFC U12 Blue', 'internal'), team('p2', 'RFC U12 Red', 'internal'), team('p3', 'Westside', 'external'), team('p4', 'Hills', 'external')];
const tg = (id: string, round: number, home: string, away: string, status: Match['status'] = 'upcoming') =>
  m({ id, tournament_id: 't1', tournament_stage: 'group', tournament_round: round, home_team_name: home, away_team_name: away, status, match_date: '2026-10-25', match_time: `0${8 + round}:00` });
const dayGames = [tg('g1', 1, 'RFC U12 Blue', 'Westside', 'completed'), tg('g2', 2, 'Hills', 'RFC U12 Blue'), tg('g3', 2, 'RFC U12 Red', 'Westside'), tg('g4', 3, 'RFC U12 Red', 'RFC U12 Blue'), tg('g5', 3, 'Westside', 'Hills')];
const prep = prepFixtures([...dayGames, m({ id: 'old', match_date: '2026-09-01T04:00:00Z' })], parts, 'Riverside FC', NOW);
assert.deepEqual(prep.map(g => g.id), ['g2', 'g3', 'g4'], 'not played, not stale, not two outside teams');
const groups = tournamentTeamGroups(prep, parts);
assert.deepEqual(groups.map(g => [g.participant.name, g.games.map(x => x.id)]), [['RFC U12 Blue', ['g2', 'g4']], ['RFC U12 Red', ['g3', 'g4']]]);
assert.equal(teamSideIn(dayGames[1], 'RFC U12 Blue'), 'away');
assert.equal(teamSideIn(dayGames[3], 'rfc u12 red'), 'home');
// In-house games stay off public fixture lists, unless the club plays nothing else.
// defaultFixture skips games over a day old by the real clock, so these are dated from today.
const TODAY = Date.now();
const bibs = m({ id: 'bibs', match_type: 'internal', match_date: new Date(TODAY + 1 * 24 * H).toISOString() });
const league = m({ id: 'league', match_date: new Date(TODAY + 5 * 24 * H).toISOString() });
const cupGame = m({ id: 'cup', tournament_id: 't1', match_date: new Date(TODAY + 6 * 24 * H).toISOString() });
assert.deepEqual(publicFixtures([bibs, league, cupGame]).map(x => x.id), ['league', 'cup']);
assert.deepEqual(publicFixtures([bibs]).map(x => x.id), ['bibs'], 'a club with only in-house games still shows them');
assert.deepEqual(publicFixtures([bibs], [bibs, league]).map(x => x.id), [], 'judged on the whole list');
// Availability and Lineup Draft open on the club game, Match Centre on the soonest
assert.equal(defaultFixture([bibs, league], [], 'Riverside FC', { skipLive: true, preferClubGames: true })?.id, 'league');
assert.equal(defaultFixture([bibs, league], [], 'Riverside FC', { skipLive: true })?.id, 'bibs');
assert.equal(defaultFixture([bibs], [], 'Riverside FC', { preferClubGames: true })?.id, 'bibs', 'falls back to in-house');

console.log('admin-attention checks passed');
