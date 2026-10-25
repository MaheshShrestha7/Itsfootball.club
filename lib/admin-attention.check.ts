import assert from 'node:assert/strict';
import { attentionItems, needsLineup, needsResult } from './admin-attention';
import { clubResult, hasKickoffTime } from './fixtures';
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
assert.equal(items[3].href, '/rfc/admin/lineup/draft?match=m2');
assert.deepEqual(attentionItems('rfc', { pendingApplications: 0, receiptsToReview: 0, unreadMessages: 0, ordersToHandOut: 0 }, [], NOW), []);

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
console.log('admin-attention checks passed');
