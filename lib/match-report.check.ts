import assert from 'node:assert/strict';
import { competitionName } from './match-article';
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
  record: { played: 9, won: 6, drawn: 1, lost: 2, goalsFor: 21, goalsAgainst: 12 },
  lastMeeting: { home: 'Marrickville', away: 'ANCC', homeScore: 2, awayScore: 1, date: '14 June', href: '/ancc/match/x' },
  next: { opponent: 'Leichhardt', competition: 'MFC Cup', when: 'at 1:00 pm on Saturday 22 November', venue: 'Moore Park Fields', href: '/ancc/match/y' },
})!;
assert.equal(full.style, 'player');
assert.equal(full.headline, 'Nguyen scores twice as ANCC beat Marrickville 3-1');
assert.equal(full.lead, 'Chris Nguyen scored twice and set up another as ANCC beat Marrickville 3-1 in the [MFC Cup](/ancc/events/1) on Saturday.');
assert.deepEqual(full.paragraphs, [
  'ANCC had the better of the chances and made them count.',
  'Nguyen got the first after 12 minutes, set up by Sam Oduya. Marrickville equalised in the 27th minute and it was 1-1 at the break.',
  'Nguyen put ANCC back in front with a penalty in the 41st. Liam Ferraro made it 3-1 two minutes from the end, with Nguyen assisting.',
  'The game was played at Moore Park Fields over two 30-minute halves.',
  "Ben Tran and Noah Kaya both came off the bench in the second half. ANCC's only booking went to Tom Baker.",
  'Nguyen was Player of the Match and now has nine goals for the season, the most at the club. Ferraro has four.',
  "ANCC's record this season is six wins, one draw and two defeats from nine games, with 21 goals scored and 12 conceded. [Marrickville won 2-1](/ancc/match/x) when the two sides last met, on 14 June.",
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
const pool = { ...base, homeScore: 1, awayScore: 0, goals: [{ minute: 5, side: 'home' as const, player: 'Sam Oduya' }], record: { played: 9, won: 6, drawn: 1, lost: 2, goalsFor: 21, goalsAgainst: 12 }, next: { opponent: 'Leichhardt', when: 'at 3:00 pm on Saturday 29 November' } };
assert.deepEqual(['a', 'b', 'c'].map(id => matchArticle({ ...pool, id })!.style), ['season', 'next', 'result']);
assert.equal(matchArticle({ ...pool, id: 'c' })!.lead, 'ANCC beat Marrickville 1-0. Sam Oduya scored the only goal.');
assert.equal(matchArticle({ ...pool, id: 'a' })!.headline, 'ANCC make it six wins from nine with 1-0 win over Marrickville');
assert.equal(matchArticle({ ...pool, id: 'b' })!.lead, 'ANCC will play Leichhardt at 3:00 pm on Saturday 29 November after beating Marrickville 1-0.');
// A loss never gets the "wins from" opening, and is written from our side
const lost = matchArticle({ ...base, id: 'c', ourSide: 'away', record: { played: 9, won: 6, drawn: 1, lost: 2, goalsFor: 21, goalsAgainst: 12 } })!;
assert.equal(lost.headline, 'Marrickville lose 3-1 to ANCC');
assert.equal(lost.paragraphs.at(-1), "Marrickville's record this season is six wins, one draw and two defeats from nine games, with 21 goals scored and 12 conceded.");

// Score only: a line that follows from the score, how the game was played, no scorers claimed
const thin = matchArticle({ ...base, homeScore: 2, awayScore: 2, venue: 'Moore Park Fields', day: 'Saturday' })!;
assert.equal(thin.headline, 'ANCC and Marrickville draw 2-2');
assert.equal(thin.lead, 'ANCC and Marrickville drew 2-2 at Moore Park Fields on Saturday.');
assert.deepEqual(thin.paragraphs, ['Neither side could find a winner before the final whistle.', 'The game was played over two 30-minute halves.']);

// The short cup-day game from the live site: no goals logged, three games in a day, a line-up saved
const cupDay = matchArticle({
  ...base, id: 'a', home: 'ANCC 35+', away: 'Parra Park FC', homeScore: 0, awayScore: 3, competition: 'MNFC Cup 2026', halfMinutes: 12, kickoff: '8:00 am', aSide: 9,
  lineup: { starters: ['Bivek Luitel', 'Sumit Shrestha', 'Jeewan Shrestha', 'Parash Bhattrai'], captain: 'Parash Bhattrai', keeper: 'Bivek Luitel' },
  gameOfDay: [1, 3], sameDay: [{ opponent: 'Laliguras FC', ourScore: 2, theirScore: 0, href: '/x', later: true }, { opponent: 'Nepal United FC', ourScore: 0, theirScore: 6, later: true }],
  record: { played: 3, won: 1, drawn: 0, lost: 2, goalsFor: 2, goalsAgainst: 9 }, meetings: { played: 2, won: 0, drawn: 0, lost: 2 },
})!;
assert.equal(cupDay.headline, 'ANCC 35+ lose 3-0 to Parra Park FC in the MNFC Cup 2026');
assert.deepEqual(cupDay.paragraphs, [
  'It was a hard day for ANCC 35+, who could not find a way through. Parra Park FC scored three times and did not concede.',
  "The game kicked off at 8:00 am and was played over two 12-minute halves, nine-a-side. It was the first of ANCC 35+'s three games on the day.",
  'Parash Bhattrai captained ANCC 35+, with Bivek Luitel in goal. Sumit Shrestha and Jeewan Shrestha also started.',
  'Later in the day ANCC 35+ [beat Laliguras FC 2-0](/x) and lost 6-0 to Nepal United FC. They finished the day with one win and two defeats.',
  "ANCC 35+'s record this season is one win and two defeats from three games, with two goals scored and nine conceded. They have lost both of their earlier games against Parra Park FC.",
]);
// A clean sheet is only the keeper's when the keeper stayed on
assert.ok(matchArticle({ ...base, awayScore: 0, lineup: { starters: ['Sam Lee', 'Jo Park'], captain: 'Jo Park', keeper: 'Sam Lee' } })!.paragraphs.includes('Jo Park captained ANCC and Sam Lee kept a clean sheet in goal.'));

// A goal logged past full time (46' in a 2 x 12 game): its order stands, its minute and the half-time score don't
const offClock = matchArticle({ ...base, id: 'c', homeScore: 2, awayScore: 0, halfMinutes: 12, goals: [{ minute: 46, side: 'home', player: 'Ravi KC' }, { minute: 50, side: 'home', player: 'Jo Park' }] })!;
assert.equal(offClock.paragraphs[1], 'Ravi KC got the first. Jo Park made it 2-0.');
assert.ok(!offClock.paragraphs.join(' ').match(/extra time|first half|the break|after \d|\dth/));
// The only goal is named once, in the lead
assert.deepEqual(matchArticle({ ...base, id: 'c', homeScore: 1, awayScore: 0, goals: [{ minute: 5, side: 'home', player: 'Sam Oduya' }] })!.paragraphs.slice(1, 2), ['The goal came after 5 minutes and it was 1-0 at the break.']);

// Some goals missing from the log: no running score, only who is known to have scored
assert.deepEqual(matchArticle({ ...base, goals: [goals[1]] })!.paragraphs, ['ANCC had the better of the chances and made them count.', 'Chris Nguyen was among the scorers for ANCC.', 'The game was played over two 30-minute halves.']);

// Neither side is "us" (tournament, in-house): result first, an own goal counts for the other team, shootout named
const neutral = matchArticle({ ...base, ourSide: undefined, homeScore: 1, awayScore: 1, competition: 'Summer Cup', stage: 'Semi-Final', shootout: { home: 3, away: 4 },
  goals: [{ minute: 10, side: 'home', player: 'Sam Lee', ownGoal: true }, { minute: 50, side: 'home', player: 'Jo Park' }],
  reds: [{ side: 'away', player: 'Dan Kelly', minute: 55 }] })!;
assert.equal(neutral.headline, 'ANCC and Marrickville drew 1-1 in the Summer Cup semi-final');
assert.equal(neutral.lead, 'ANCC and Marrickville drew 1-1 in the Summer Cup semi-final. Marrickville won 4-3 on penalties.');
assert.deepEqual(neutral.paragraphs, [
  'An own goal by Sam Lee put Marrickville ahead after 10 minutes and it was 1-0 at the break.',
  'Jo Park equalised for ANCC in the 50th minute.',
  'The game was played over two 30-minute halves.',
  'Dan Kelly was sent off for Marrickville in the 55th minute.',
]);
assert.equal(matchArticle({ ...base, ourSide: undefined, competition: 'Summer Cup', stage: 'Round 5' })!.lead, 'ANCC beat Marrickville 3-1 in round 5 of the Summer Cup.');

// Juniors arrive as "Sam T.": never cut down to the initial
assert.equal(matchArticle({ ...base, homeScore: 2, awayScore: 0, goals: [{ minute: 3, side: 'home', player: 'Sam T.' }, { minute: 40, side: 'home', player: 'Sam T.' }] })!.headline, 'Sam T. scores twice as ANCC beat Marrickville 2-0');

assert.equal(reportReady({ goalsLogged: 0, hasLineup: false, hasPlayerOfTheMatch: false }), false);
assert.equal(reportReady({ goalsLogged: 0, hasLineup: true, hasPlayerOfTheMatch: false }), true);

// A club event's title is often a sentence: only the cup's own name goes into the report
assert.equal(competitionName('ANCC is participating in MNFC Cup 2026'), 'MNFC Cup 2026');
assert.equal(competitionName('ANCC joins MNFC Cup 2026'), 'MNFC Cup 2026');
assert.equal(competitionName('Sydney Premier League'), 'Sydney Premier League');
assert.equal(competitionName('division 2 north'), 'division 2 north');
assert.equal(competitionName('Come down and cheer on the boys this weekend'), undefined);
console.log('match-report checks passed');
