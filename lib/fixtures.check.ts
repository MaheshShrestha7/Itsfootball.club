import assert from 'node:assert/strict';
import { cupGames, latestResult, teamForm, teamRecord } from './fixtures';

const game = (date: string, us: number, them: number, extra: Record<string, unknown> = {}) => ({
  status: 'completed', match_date: date, is_club_home: true, home_score: us, away_score: them,
  home_penalty_score: null, away_penalty_score: null, match_type: 'friendly', tournament_id: null, season: '2026/27', ...extra,
}) as unknown as Parameters<typeof teamRecord>[0][number];

const games = [
  game('2026-08-01', 3, 5),
  game('2026-07-25', 3, 2),
  game('2026-07-18', 1, 1),
  game('2025-07-01', 4, 0, { season: '2025/26' }), // another season
  game('2026-07-10', 9, 0, { match_type: 'internal' }), // in-house game: never counts
  game('2026-07-05', 9, 0, { tournament_id: 't1' }), // a cup game: not on the club's record
  game('2026-09-01', 0, 0, { status: 'upcoming' }), // not played
  game('2026-06-01', 2, 2, { season: null }), // no season saved: counts for the season asked for
];

assert.deepEqual(teamRecord(games, '2026/27'), { played: 4, won: 1, drawn: 2, lost: 1 });
assert.deepEqual(teamRecord(games, '2025/26'), { played: 2, won: 1, drawn: 1, lost: 0 });
// An away 2-1 win is a win, however the score is stored
assert.deepEqual(teamRecord([game('2026-08-01', 1, 2, { is_club_home: false })], '2026/27'), { played: 1, won: 1, drawn: 0, lost: 0 });

// Newest on the right, and only the last five
assert.deepEqual(teamForm(games), ['W', 'D', 'D', 'W', 'L']);
assert.deepEqual(teamForm(games.slice(0, 3)), ['D', 'W', 'L']);
assert.equal(teamForm(games, 2).length, 2);
assert.equal(teamForm(games, 2).at(-1), 'L');
assert.equal(latestResult(games)?.match_date, '2026-08-01');
assert.equal(latestResult([]), undefined);
console.log('fixtures: ok');

// An outside cup: the event's games for the same team, soonest first; a game with no event is alone
{
  const g = (id: string, date: string, event_id: string | null, team_id: string | null = 'a') => ({ id, match_date: date, event_id, team_id });
  const all = [g('3', '2026-11-29', 'cup'), g('1', '2026-11-22T09:00:00Z', 'cup'), g('x', '2026-11-22', 'cup', 'b'), g('2', '2026-11-22T11:00:00Z', 'cup'), g('n', '2026-11-22', null)];
  assert.deepEqual(cupGames(all, all[0]).map(m => m.id), ['1', '2', '3']);
  assert.deepEqual(cupGames(all, all[4]).map(m => m.id), ['n']);
  assert.deepEqual(cupGames([], all[0]).map(m => m.id), ['3']);
}
