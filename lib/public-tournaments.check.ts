// Self-check for the public tournament summary (the answer-first sentence and "at a glance" facts).
// Run: npx esbuild lib/public-tournaments.check.ts --bundle --platform=node --log-level=warning | node
import assert from 'node:assert/strict';
import { tournamentProgress, tournamentSummary, type SummaryMatch } from './public-tournaments';

const m = (home: string, away: string, extra: Partial<SummaryMatch> = {}): SummaryMatch =>
  ({ home_team_name: home, away_team_name: away, status: 'upcoming', ...extra });

// In progress: played count, cancelled left out, next match skips TBD slots and finished games
const running = tournamentProgress([
  m('Everest FC', 'Sherpa United', { status: 'completed', home_score: 2, away_score: 1, tournament_stage: 'group' }),
  m('Lumbini', 'Pokhara', { status: 'cancelled' }),
  m('Everest FC', 'Pokhara', { match_date: '2026-10-18T03:00:00Z', tournament_stage: 'group' }),
  m('Sherpa United', 'Lumbini', { match_date: '2026-10-18T02:00:00Z', tournament_stage: 'group' }),
  m('TBD', 'TBD', { match_date: '2026-10-18T01:00:00Z', tournament_stage: 'final' }),
]);
assert.equal(running.played, 1);
assert.equal(running.total, 4);
assert.equal(running.champion, undefined);
assert.equal(running.next?.home_team_name, 'Sherpa United');

assert.equal(
  tournamentSummary({ name: 'Dashain Cup 2026', format: 'group_knockout', teamSize: '6-a-side', teamCount: 8, venue: 'Parramatta Park', organiser: 'NCS', progress: running }),
  'Dashain Cup 2026 is an 8-team 6-a-side soccer group stage and knockout cup at Parramatta Park, organised by NCS. 1 of 4 matches played.'
);

// Final decided on penalties, away side wins: score read from the champion's side
const done = tournamentProgress([
  m('Everest FC', 'Sherpa United', { status: 'completed', home_score: 1, away_score: 1, home_penalty_score: 3, away_penalty_score: 4, tournament_stage: 'final' }),
]);
assert.equal(done.champion, 'Sherpa United');
assert.equal(done.runnerUp, 'Everest FC');
assert.equal(done.finalScore, '1-1');
assert.equal(done.finalPenalties, '4-3');
assert.equal(
  tournamentSummary({ name: 'Harmony Cup', format: 'knockout', teamCount: 16, progress: done }),
  'Harmony Cup is a 16-team soccer knockout cup. Sherpa United won the final against Everest FC, 1-1 (4-3 on penalties).'
);
assert.equal(tournamentProgress([m('A', 'B', { status: 'full_time', home_score: 0, away_score: 2, tournament_stage: 'final' })]).finalScore, '2-0');
assert.equal(tournamentSummary({ name: 'Gala', format: 'league', teamCount: 0, teamSize: '11-a-side', progress: tournamentProgress([]) }), 'Gala is an 11-a-side soccer league.');

console.log('public-tournaments checks passed');
