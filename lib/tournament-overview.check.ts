// npm run check: the Overview's phase and its plain-words format line
import assert from 'node:assert/strict';
import { formatLines, tournamentOver, tournamentPhase } from './tournament-overview';
import type { Match, Tournament } from './supabase/types';

const t = { status: 'ongoing', format: 'group_knockout', group_count: 2, teams_advancing_per_group: 2, half_minutes: 10, ko_half_minutes: 15, pitches: 2 } as Tournament;
const g = (status: Match['status'], stage: Match['tournament_stage'] = 'group') => ({ status, tournament_stage: stage }) as Match;

assert.equal(tournamentPhase(t, []), 'before');
assert.equal(tournamentPhase(t, [g('upcoming'), g('upcoming', 'final')]), 'before');
assert.equal(tournamentPhase(t, [g('live'), g('upcoming', 'final')]), 'during');
assert.equal(tournamentPhase(t, [g('completed'), g('completed', 'final')]), 'after');
// The host forgot to mark it completed; a league with every game played is over too
assert.equal(tournamentOver({ status: 'ongoing', format: 'league' }, [g('completed'), g('cancelled')]), true);
assert.equal(tournamentOver({ status: 'ongoing', format: 'group_knockout' }, [g('completed')]), false);
assert.equal(tournamentPhase({ ...t, status: 'completed' }, []), 'after');

assert.deepEqual(formatLines(t, 8), [
  '8 teams in 2 groups of 4.',
  'The top 2 in each group go into the semi-finals.',
  'Group games 2 × 10 minutes, knockout games 2 × 15 minutes.',
  'Played on 2 pitches at once.',
]);
assert.deepEqual(formatLines({ format: 'league' } as Tournament, 6), ['6 teams, everyone plays everyone once. Most points wins.']);
console.log('tournament-overview ok');
