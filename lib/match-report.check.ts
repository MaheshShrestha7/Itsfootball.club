import assert from 'node:assert/strict';
import { matchReport, type ReportInput } from './match-report';

const base: ReportInput = { home: 'Riverside FC', away: 'Parramatta City', homeScore: 3, awayScore: 1, goals: [], redCards: [] };

// Win, with every detail
assert.deepEqual(
  matchReport({
    ...base,
    competition: 'Sydney Premier League',
    venue: 'Riverside Oval',
    dateLabel: 'Friday 16 October 2026',
    goals: [
      { minute: 67, side: 'home', player: 'Chris Nguyen', penalty: true },
      { minute: 23, side: 'home', player: 'Chris Nguyen' },
      { minute: 55, side: 'away', player: 'Marco Rossi' },
      { minute: 81, side: 'home', player: 'Jordan Patel' },
    ],
    redCards: [{ minute: 74, side: 'away', player: 'Dan Kelly' }],
    playerOfTheMatch: 'Chris Nguyen',
  }),
  [
    'Riverside FC beat Parramatta City 3–1 in the Sydney Premier League at Riverside Oval on Friday 16 October 2026.',
    "Goals for Riverside FC: Chris Nguyen (23', 67' pen) and Jordan Patel (81'). Goals for Parramatta City: Marco Rossi (55').",
    "Sent off: Dan Kelly (Parramatta City, 74').",
    'Player of the Match: Chris Nguyen.',
  ]
);

// Draw with nothing logged: says so, invents nothing
assert.deepEqual(matchReport({ ...base, homeScore: 2, awayScore: 2 }), [
  'Riverside FC and Parramatta City drew 2–2.',
  'Goal details weren’t logged for this match.',
]);

// Away win; an own goal counts for the team it was scored for; a missing goal is admitted
assert.deepEqual(
  matchReport({ ...base, homeScore: 0, awayScore: 2, goals: [{ minute: 10, side: 'home', player: 'Sam Lee', ownGoal: true }] }),
  [
    'Parramatta City won 2–0 away at Riverside FC.',
    "Goals for Parramatta City: Sam Lee (own goal) (10').",
    'Not every goal was logged.',
  ]
);

// 0-0: no "not logged" line
assert.deepEqual(matchReport({ ...base, homeScore: 0, awayScore: 0 }), ['Riverside FC and Parramatta City drew 0–0.']);

console.log('match-report checks passed');
