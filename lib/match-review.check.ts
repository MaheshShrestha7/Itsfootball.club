import assert from 'node:assert/strict';
import { cupNumbers, gameResult, hasReview, minutesAcross, opponentName, ourSide, ourTeamIn, reviewPoints } from './match-review';
import { emptyLine } from './match-stats';

assert.equal(hasReview(null), false);
assert.equal(hasReview({ match_id: 'm', went_well: '  ', work_on: '', next_week: '' }), false);
assert.equal(hasReview({ match_id: 'm', went_well: '', work_on: 'Corners', next_week: '' }), true);

assert.deepEqual(reviewPoints('- Pressed high\n\n2. Calm penalty\n  • Kept shape \nHalf-time talk'), ['Pressed high', 'Calm penalty', 'Kept shape', 'Half-time talk']);
assert.deepEqual(reviewPoints('   '), []);

const game = (id: string, o: object) => ({
  id, status: 'completed' as const, match_format: '7v7' as const, half_minutes: 30, match_type: 'friendly' as const,
  is_club_home: true, home_team_name: 'Us', away_team_name: 'Them', home_score: 0, away_score: 0, ...o,
});

// An away game: our score is the away score
const away = game('a', { is_club_home: false, home_score: 1, away_score: 3 });
assert.equal(ourSide(away), 'away');
assert.deepEqual(gameResult(away), { us: 3, them: 1, outcome: 'W', onPens: false });

// A tournament game is stored "at home" whoever plays: the side comes from the team's name
const cupGame = game('t', { tournament_id: 'T', home_team_name: 'Rovers', away_team_name: 'Us Blue', home_score: 2, away_score: 2, home_penalty_score: 4, away_penalty_score: 5 });
assert.equal(ourSide(cupGame, 'us blue'), 'away');
assert.deepEqual(gameResult(cupGame, 'Us Blue'), { us: 2, them: 2, outcome: 'W', onPens: true });
assert.equal(gameResult(cupGame).outcome, null, 'no team picked: no result');

// The cup in numbers: 2-0 win, 3-1 win, 2-3 loss away, and one game still to play
const games = [
  game('1', { home_score: 2, away_score: 0 }),
  game('2', { home_score: 3, away_score: 1 }),
  game('3', { is_club_home: false, home_score: 3, away_score: 2 }),
  game('4', { status: 'upcoming' }),
];
const goal = (match_id: string, team_side: 'home' | 'away', minute: number, event_type = 'goal') => ({ match_id, team_side, minute, event_type: event_type as 'goal' });
const events = [
  goal('2', 'away', 58), goal('2', 'home', 10),
  goal('3', 'home', 20), goal('3', 'home', 50), goal('3', 'away', 59, 'own_goal'), // our own goal counts against us
];
assert.deepEqual(cupNumbers(games, events), {
  played: 3, won: 2, drawn: 0, lost: 1, scored: 7, conceded: 4, cleanSheets: 1, concededLogged: 4, concededLate: 3, hasResults: true,
});
assert.equal(cupNumbers([cupGame], []).hasResults, false);

// Minutes: only games with recorded minutes count, and under half of what they offered is flagged
const line = (member_id: string, minutes: number) => ({ ...emptyLine(member_id), played: true, minutes });
const mins = minutesAcross(games, {
  '1': [line('a', 60), line('b', 20), line('c', 0)],
  '2': [line('a', 60), line('b', 35)],
  '3': [line('a', 0), line('b', 0)], // stats saved without a line-up: no minutes to go on
});
assert.equal(mins.total, 120);
assert.deepEqual(mins.rows.map(r => [r.member_id, r.games, r.minutes, r.underHalf]), [['a', 2, 120, false], ['b', 2, 55, true], ['c', 1, 0, false]]);
assert.equal(mins.fair, 120, '7 on the pitch with a squad of 7 or fewer: everyone plays it all');
assert.equal(minutesAcross([{ id: 'x', match_format: undefined, half_minutes: 30 }], { x: [line('a', 60)] }).fair, null);

// Which team is ours in a tournament game, and who it was against
const entries = [
  { tournament_id: 'T', team_type: 'internal', name: 'Us Blue' },
  { tournament_id: 'T', team_type: 'internal', name: 'Us Red' },
  { tournament_id: 'T', team_type: 'external', name: 'Rovers' },
];
assert.equal(ourTeamIn(cupGame, entries), 'Us Blue');
assert.equal(ourTeamIn({ ...cupGame, home_team_name: 'Us Red' }, entries), undefined, 'two of our own teams');
assert.equal(ourTeamIn(away, entries), undefined);
assert.equal(opponentName(cupGame, 'Us Blue'), 'Rovers');
assert.equal(opponentName(cupGame), 'Rovers v Us Blue');
assert.equal(opponentName(away), 'Us');
assert.equal(opponentName({ ...away, opponent_name: 'Westside Rovers' }), 'Westside Rovers');

console.log('match-review checks passed');
