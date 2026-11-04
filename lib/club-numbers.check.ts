import assert from 'node:assert/strict';
import { clubNumbers, hasClubNumbers } from './club-numbers';

type M = Parameters<typeof clubNumbers>[0]['matches'][number] & { team_id?: string };
const game = (o: Partial<M>): M => ({
  status: 'completed', season: '2026/27', match_date: '2026-09-01T10:00:00Z', home_score: 0, away_score: 0,
  home_penalty_score: undefined, away_penalty_score: undefined, is_club_home: true, match_type: 'league', tournament_id: undefined, ...o,
} as M);

const now = new Date('2026-11-04T12:00:00Z').getTime();
const n = clubNumbers<M>({
  members: [{ role: 'Player', roles: [] }, { role: 'member', roles: ['Player', 'Coach'] }, { role: 'supporter', roles: [] }, { role: 'member', roles: ['Coach'] }, { role: 'member', roles: [] }],
  matches: [
    game({ match_date: '2026-09-01T10:00:00Z', home_score: 2, away_score: 0 }),                 // W, clean sheet
    game({ match_date: '2026-09-08T10:00:00Z', is_club_home: false, home_score: 3, away_score: 1 }), // L, scored 1
    game({ match_date: '2026-09-15T10:00:00Z', home_score: 1, away_score: 1 }),                 // D
    game({ match_date: '2026-09-22T10:00:00Z', home_score: 1, away_score: 1, home_penalty_score: 4, away_penalty_score: 3 }), // W on pens
    game({ match_date: '2026-09-29T10:00:00Z', status: 'live', home_score: 1, away_score: 0 }), // played, no result yet
    game({ match_date: '2026-10-06T10:00:00Z', status: 'upcoming', home_score: 0, away_score: 0 }), // not played
    game({ match_date: '2026-10-13T10:00:00Z', team_id: 'u9', home_score: 9, away_score: 0 }),  // hidden junior scores
    game({ match_date: '2026-10-20T10:00:00Z', tournament_id: 't1', home_score: 5, away_score: 0 }), // tournament: not the club record
    game({ match_date: '2025-09-01T10:00:00Z', season: '2025/26', home_score: 4, away_score: 2 }), // last season
  ],
  scoreHidden: m => m.team_id === 'u9',
  currentSeason: '2026/27',
  events: [
    { start_time: '2026-08-01T10:00:00Z', category: 'social', rsvp_count: 40 },
    { start_time: '2026-12-01T10:00:00Z', category: 'social', rsvp_count: 10 },
    { start_time: '2026-10-01T10:00:00Z', category: 'trial', rsvp_count: 0 },
  ],
  sponsors: [{ tier: 'silver' }, { tier: 'gold' }, { tier: 'silver' }],
  teams: 2,
  now,
});

assert.equal(n.players, 2);
assert.equal(n.supporters, 2); // the supporter and the plain member, not the coach
assert.equal(n.games, 6);      // 4 finished + live + hidden junior game, this season
assert.deepEqual([n.won, n.drawn, n.lost], [2, 1, 1]);
assert.equal(n.goals, 2 + 1 + 1 + 1 + 1); // live game counts, the hidden junior 9 doesn't
assert.equal(n.cleanSheets, 1);
assert.deepEqual(n.form, ['W', 'W', 'L', 'D', 'W']); // last 5 finished public results, oldest first
assert.equal(n.allTimeGames, 7);
assert.equal(n.allTimeGoals, 10);
assert.equal(n.events, 3);
assert.equal(n.upcomingEvents, 1);
assert.equal(n.eventSignups, 50);
assert.deepEqual(n.eventTypes, [{ label: 'Social', count: 2 }, { label: 'Trial', count: 1 }]);
assert.equal(n.sponsors, 3);
assert.deepEqual(n.sponsorTiers, [{ label: 'Gold', count: 1 }, { label: 'Silver', count: 2 }]);
assert.equal(hasClubNumbers(n), true);

// A brand-new club: nothing to show, so the section hides
const empty = clubNumbers<M>({ members: [], matches: [], scoreHidden: () => false, currentSeason: '2026/27', events: [], sponsors: [], teams: 1, now });
assert.equal(hasClubNumbers(empty), false);
assert.deepEqual(empty.form, []);

console.log('club-numbers checks passed');
