import assert from 'node:assert/strict';
import { matchArticle, plainText, reportReady, type ArticleInput } from './match-report';

const base: ArticleInput = {
  id: 'a', home: 'ANCC', away: 'Marrickville', homeScore: 3, awayScore: 1, ourSide: 'home', halfMinutes: 30,
  goals: [], subs: [], yellows: [], reds: [],
};
const goals: ArticleInput['goals'] = [
  { minute: 41, side: 'home', player: 'Chris Nguyen', penalty: true },
  { minute: 12, side: 'home', player: 'Chris Nguyen', assist: 'Sam Oduya' },
  { minute: 27, side: 'away', player: 'Marrickville Player' },
  { minute: 58, side: 'home', player: 'Liam Ferraro', assist: 'Chris Nguyen' },
];

// Two goals by one player: the story opens with them, then tells the game in order
const full = matchArticle({
  ...base, goals, competition: 'MFC Cup', venue: 'Moore Park Fields', day: 'Saturday', partOfDay: 'morning',
  links: { competition: '/ancc/events/1' },
  subs: [{ side: 'home', on: 'Ben Tran', minute: 35 }, { side: 'home', on: 'Noah Kaya', minute: 48 }],
  yellows: [{ side: 'home', player: 'Tom Baker' }],
  playerOfTheMatch: 'Chris Nguyen', seasonGoals: { 'Chris Nguyen': 9, 'Liam Ferraro': 4 }, topScorer: 'Chris Nguyen',
  record: { played: 9, won: 6 },
  lastMeeting: { home: 'Marrickville', away: 'ANCC', homeScore: 2, awayScore: 1, date: '14 June', href: '/ancc/match/x' },
  next: { opponent: 'Leichhardt', competition: 'MFC Cup', when: 'at 1:00 pm on Saturday 22 November', venue: 'Moore Park Fields', href: '/ancc/match/y' },
})!;
assert.equal(full.style, 'player');
assert.equal(full.headline, 'Nguyen scores twice as ANCC beat Marrickville 3-1');
assert.equal(full.lead, 'Chris Nguyen scored twice and set up another as ANCC beat Marrickville 3-1 in the [MFC Cup](/ancc/events/1) on Saturday.');
assert.deepEqual(full.paragraphs, [
  'Nguyen got the first after 12 minutes, set up by Sam Oduya. Marrickville equalised in the 27th minute and it was 1-1 at the break.',
  'Nguyen put ANCC back in front with a penalty in the 41st. Liam Ferraro made it 3-1 two minutes from the end, with Nguyen assisting.',
  "Ben Tran and Noah Kaya both came off the bench in the second half. ANCC's only booking went to Tom Baker.",
  'Nguyen was Player of the Match and now has nine goals for the season, the most at the club. Ferraro has four.',
  'That is six wins from nine for ANCC this season. [Marrickville won 2-1](/ancc/match/x) when the two sides last met, on 14 June.',
  'Next for ANCC is [Leichhardt](/ancc/match/y) in the MFC Cup, at 1:00 pm on Saturday 22 November at Moore Park Fields.',
]);
assert.equal(plainText(full.lead), 'Chris Nguyen scored twice and set up another as ANCC beat Marrickville 3-1 in the MFC Cup on Saturday.');
// Same match, same words every time
assert.deepEqual(matchArticle({ ...base, goals }), matchArticle({ ...base, goals }));

// Level at half-time, won in the second half: the turning point opens the story
const turning = matchArticle({ ...base, homeScore: 2, awayScore: 1, goals: [
  { minute: 10, side: 'home', player: 'Sam Oduya' }, { minute: 20, side: 'away', player: 'Marrickville Player' }, { minute: 41, side: 'home', player: 'Liam Ferraro' },
] })!;
assert.equal(turning.style, 'turning');
assert.equal(turning.headline, 'Ferraro goal puts ANCC past Marrickville');
assert.equal(turning.lead, 'ANCC and Marrickville were level at 1-1 at half-time. ANCC went ahead 11 minutes into the second half through Liam Ferraro, and went on to win 2-1.');

// Nothing stands out: the opening rotates by match between the ones the data allows
const pool = { ...base, homeScore: 1, awayScore: 0, goals: [{ minute: 5, side: 'home' as const, player: 'Sam Oduya' }], record: { played: 9, won: 6 }, next: { opponent: 'Leichhardt', when: 'at 3:00 pm on Saturday 29 November' } };
assert.deepEqual(['a', 'b', 'c'].map(id => matchArticle({ ...pool, id })!.style), ['season', 'next', 'result']);
assert.equal(matchArticle({ ...pool, id: 'c' })!.lead, 'ANCC beat Marrickville 1-0. Sam Oduya scored the only goal.');
assert.equal(matchArticle({ ...pool, id: 'a' })!.headline, 'ANCC make it six wins from nine with 1-0 win over Marrickville');
assert.equal(matchArticle({ ...pool, id: 'b' })!.lead, 'ANCC will play Leichhardt at 3:00 pm on Saturday 29 November after beating Marrickville 1-0.');
// A loss never gets the "wins from" opening, and is written from our side
const lost = matchArticle({ ...base, id: 'c', ourSide: 'away', record: { played: 9, won: 6 } })!;
assert.equal(lost.headline, 'Marrickville lose 3-1 to ANCC');
assert.equal(lost.paragraphs.at(-1), 'Marrickville have won six of their nine games this season.');

// Score only: says so, invents nothing
const thin = matchArticle({ ...base, homeScore: 2, awayScore: 2, venue: 'Moore Park Fields', day: 'Saturday' })!;
assert.equal(thin.headline, 'ANCC and Marrickville draw 2-2');
assert.equal(thin.lead, 'ANCC and Marrickville drew 2-2 at Moore Park Fields on Saturday.');
assert.deepEqual(thin.paragraphs, ['Goal details weren’t logged for this match.']);
assert.deepEqual(matchArticle({ ...base, homeScore: 0, awayScore: 0 })!.paragraphs, []);

// Some goals missing from the log: no running score, only who is known to have scored
assert.deepEqual(matchArticle({ ...base, goals: [goals[1]] })!.paragraphs, ['Chris Nguyen was among the scorers for ANCC.']);

// Neither side is "us" (tournament, in-house): result first, an own goal counts for the other team, shootout named
const neutral = matchArticle({ ...base, ourSide: undefined, homeScore: 1, awayScore: 1, competition: 'Summer Cup', stage: 'Semi-Final', shootout: { home: 3, away: 4 },
  goals: [{ minute: 10, side: 'home', player: 'Sam Lee', ownGoal: true }, { minute: 50, side: 'home', player: 'Jo Park' }],
  reds: [{ side: 'away', player: 'Dan Kelly', minute: 55 }] })!;
assert.equal(neutral.headline, 'ANCC and Marrickville drew 1-1 in the Summer Cup semi-final');
assert.equal(neutral.lead, 'ANCC and Marrickville drew 1-1 in the Summer Cup semi-final. Marrickville won 4-3 on penalties.');
assert.deepEqual(neutral.paragraphs, [
  'An own goal by Sam Lee put Marrickville ahead after 10 minutes and it was 1-0 at the break.',
  'Jo Park equalised for ANCC in the 50th minute.',
  'Dan Kelly was sent off for Marrickville in the 55th minute.',
]);
assert.equal(matchArticle({ ...base, ourSide: undefined, competition: 'Summer Cup', stage: 'Round 5' })!.lead, 'ANCC beat Marrickville 3-1 in round 5 of the Summer Cup.');

// Juniors arrive as "Sam T.": never cut down to the initial
assert.equal(matchArticle({ ...base, homeScore: 2, awayScore: 0, goals: [{ minute: 3, side: 'home', player: 'Sam T.' }, { minute: 40, side: 'home', player: 'Sam T.' }] })!.headline, 'Sam T. scores twice as ANCC beat Marrickville 2-0');

assert.equal(reportReady({ goalsLogged: 0, hasLineup: false, hasPlayerOfTheMatch: false }), false);
assert.equal(reportReady({ goalsLogged: 0, hasLineup: true, hasPlayerOfTheMatch: false }), true);
console.log('match-report checks passed');
