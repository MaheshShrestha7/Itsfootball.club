import assert from 'node:assert/strict';
import { alertFor, matchAlert } from './match-alerts';

const s = (status: string, home = 0, away = 0) => ({ status, home, away });

assert.equal(alertFor(s('upcoming'), s('live')), 'kickoff');
assert.equal(alertFor(s('live'), s('live', 1, 0)), 'goal');
assert.equal(alertFor(s('halftime', 1, 0), s('live', 1, 1)), 'goal');
assert.equal(alertFor(s('live', 2, 1), s('live', 1, 1)), null, 'correction');
assert.equal(alertFor(s('live', 1, 1), s('halftime', 1, 1)), null, 'half time');
assert.equal(alertFor(s('live', 2, 1), s('completed', 2, 1)), 'fulltime');
assert.equal(alertFor(s('completed', 2, 1), s('completed', 3, 1)), null, 'edits after full time');
assert.equal(alertFor(s('upcoming'), s('upcoming', 1, 0)), null, 'score before kick-off');
assert.equal(alertFor(s('upcoming'), s('completed', 3, 0)), 'fulltime', 'result entered afterwards');

const m = { home_team_name: 'Penrith', away_team_name: 'Eastwood' };
assert.deepEqual(matchAlert('goal', m, 2, 1, 67), { title: 'Goal! Penrith 2–1 Eastwood', body: "67'" });
assert.equal(matchAlert('fulltime', m, 2, 1).title, 'Full time: Penrith 2–1 Eastwood');
console.log('match-alerts checks passed');
