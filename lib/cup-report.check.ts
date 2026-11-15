import assert from 'node:assert/strict';
import { buildCupReport, cupReportText, isCupReport, type CupReportInput } from './cup-report';
import { chartColours } from '../components/CupReportPaper';
import { emptyLine } from './match-stats';
import type { Match, MatchEvent } from './supabase/types';

const game = (id: string, date: string, opp: string, hs: number, as: number, o: Partial<Match> = {}) => ({
  id, club_id: 'c', status: 'completed', match_format: '7v7', half_minutes: 30, match_type: 'friendly', is_club_home: true,
  home_team_name: 'ANCC', away_team_name: opp, opponent_name: opp, match_date: date, venue: 'Moore Park', home_score: hs, away_score: as, ...o,
}) as Match;
const games = [
  game('1', '2026-11-22T09:00:00', 'Bayside FC', 2, 0),
  game('2', '2026-11-22T11:30:00', 'Westside Rovers', 3, 1),
  game('3', '2026-11-29T10:00:00', 'Northside United', 3, 2, { is_club_home: false, home_team_name: 'Northside United', away_team_name: 'ANCC' }),
  game('4', '2026-12-06T10:00:00', 'Harbour City', 0, 0, { status: 'upcoming' }),
];
const ev = (match_id: string, minute: number, team_side: 'home' | 'away', player_name: string, event_type = 'goal') =>
  ({ id: `${match_id}-${minute}`, club_id: 'c', match_id, minute, team_side, player_name, event_type }) as MatchEvent;
const events = [
  ev('1', 12, 'home', 'Chris Nguyen'), ev('1', 44, 'home', 'Jai Kumar'),
  ev('2', 23, 'home', 'Chris Nguyen'), ev('2', 51, 'home', 'Sam Patel', 'penalty'), ev('2', 57, 'home', 'Chris Nguyen'), ev('2', 58, 'away', 'No. 9'), ev('2', 40, 'home', 'Max Rossi', 'yellow_card'),
  ev('3', 9, 'home', 'No. 7'), ev('3', 31, 'home', 'No. 7'), ev('3', 38, 'away', 'Chris Nguyen'), ev('3', 47, 'away', 'Max Rossi'), ev('3', 59, 'home', 'No. 10'),
];
const line = (member_id: string, minutes: number, o = {}) => ({ ...emptyLine(member_id), played: true, minutes, ...o });
const names: Record<string, string> = { chris: 'Chris Nguyen', tom: 'Tom Wells', leo: 'Leo Brooks', sam: 'Sam Patel' };
const input: CupReportInput = {
  club: 'ANCC', cup: 'MFC Cup', team: 'Seniors', games, events,
  linesByMatch: {
    '1': [line('chris', 60, { goals: 1 }), line('tom', 60, { motm: true }), line('leo', 10)],
    '2': [line('chris', 60, { goals: 2, motm: true }), line('tom', 60), line('leo', 15), line('sam', 60, { goals: 1, assists: 2, yellow_cards: 1 })],
  },
  reviews: {
    '1': { match_id: '1', went_well: 'Kept our shape.\nTom commanded the box.', work_on: 'Second balls.', next_week: 'Ari starts.' },
    '2': { match_id: '2', went_well: 'Pressed high.', work_on: '', next_week: '' },
  },
  summary: ' Two good wins. ', by: 'Coach',
  nameOf: id => names[id] || 'A player', eventName: n => n,
  when: m => m.match_date.slice(0, 10), day: m => m.match_date.slice(0, 10),
  available: 13, coach: true,
};

const r = buildCupReport(input);
assert.equal(r.opening, 'We played three games, won two and lost one. We beat Bayside FC 2-0 and Westside Rovers 3-1 and lost 3-2 to Northside United. We scored seven goals and let in four.');
assert.equal(r.dates, '2026-11-22 to 2026-12-06');
assert.equal(r.venue, 'Moore Park');
assert.equal(r.summary, 'Two good wins.');
assert.deepEqual(r.games.map(g => [g.outcome, g.score, g.opponent]), [['W', '2-0', 'Bayside FC'], ['W', '3-1', 'Westside Rovers'], ['L', '2-3', 'Northside United']]);
assert.equal(r.games[2].title, 'Northside United 3-2 ANCC');
assert.equal(r.games[1].fact, "Chris Nguyen (23', 57') and Sam Patel (51' pen) scored. Westside Rovers scored in the 58th minute. Max Rossi was booked. Chris Nguyen was Player of the Match.");
assert.equal(r.games[2].fact, "Chris Nguyen (38') and Max Rossi (47') scored. Northside United scored in the 9th, 31st and 59th minutes.");
assert.deepEqual(r.wentWell, [{ from: 'vs Bayside FC', text: 'Kept our shape.' }, { from: 'vs Bayside FC', text: 'Tom commanded the box.' }, { from: 'vs Westside Rovers', text: 'Pressed high.' }]);
assert.equal(r.reviews, 2);

// Goals by quarter of a 60-minute game and by half
assert.deepEqual(r.goals?.blocks, [
  { label: "1' to 15'", us: 1, them: 1 }, { label: "16' to 30'", us: 1, them: 0 }, { label: "31' to 45'", us: 2, them: 1 }, { label: "46' to 60'", us: 3, them: 2 },
]);
assert.deepEqual([r.goals?.us, r.goals?.them], [[2, 5], [1, 3]]);
assert.equal(r.goals?.line, 'We scored two in the first half and five in the second. They scored one in the first half and three in the second. Two of the four against us came in the last 15 minutes.');

assert.deepEqual(r.players, [
  { label: 'Goals', value: 'Chris Nguyen 3, Sam Patel 1' },
  { label: 'Assists', value: 'Sam Patel 2' },
  { label: 'Player of the Match', value: 'Tom Wells, Chris Nguyen' },
  { label: 'Cards', value: 'Sam Patel 1 yellow' },
]);
assert.equal(r.minutes?.line, '13 players said they could play and 4 got on the pitch. A fair share was 120 minutes each. Leo Brooks had less than half the minutes on offer.');
assert.deepEqual(r.next, [{ from: 'vs Bayside FC', text: 'Ari starts.' }]);

// The squad version carries no minutes and no notes for next time
const squad = buildCupReport({ ...input, coach: false, nameOf: id => `${names[id]?.split(' ')[0]} X.` });
assert.equal(squad.minutes, undefined);
assert.equal(squad.next, undefined);
assert.equal(squad.players[0].value, 'Chris X. 3, Sam X. 1');
assert.ok(!cupReportText(squad).includes('minutes in'));
assert.ok(cupReportText(r).includes('Leo Brooks: 25 minutes in 2 games'));
assert.ok(!/[–—]/.test(cupReportText(r)), 'no dashes in the wording');

// A tournament with no team of our own: nothing about "us"
const neutral = buildCupReport({ ...input, games: [game('t', '2026-11-01', 'Red', 1, 1, { tournament_id: 'T', home_team_name: 'Blue', away_team_name: 'Red' })], events: [ev('t', 5, 'home', 'Kim')], linesByMatch: {}, reviews: {} });
assert.equal(neutral.opening, 'One game has been played.');
assert.equal(neutral.goals, null);
assert.equal(neutral.games[0].fact, "Kim (5') scored.");
assert.equal(buildCupReport({ ...input, games: [games[3]] }).opening, 'No games have been played yet.');

// A shared report is only shown when it has the right shape
assert.ok(isCupReport(JSON.parse(JSON.stringify(squad))));
assert.ok(!isCupReport({ v: 2 }));
assert.ok(!isCupReport(null));

// The graph's two colours must differ on white paper whatever the club colour is
assert.deepEqual(chartColours('#C8102E'), { us: '#C8102E', them: '#2F5FB3' });
assert.equal(chartColours('#1E3A8A').them, '#C2410C');
assert.equal(chartColours('#FFFFFF').us, '#0f172a');
assert.equal(chartColours('nonsense').us, '#0f172a');

console.log('cup-report checks passed');
