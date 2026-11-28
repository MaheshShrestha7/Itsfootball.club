import assert from 'node:assert/strict';
import { colorsClash, entryOpen, fairPlay, kitClashes, packKickoffs, parseEntry, parsePlayers, parseTeamList, teamSummary } from './hosted-tournaments';
import type { Match, MatchEvent, TournamentParticipant } from './supabase/types';

const m = (id: string, home: string, away: string, over: Partial<Match> = {}): Match => ({
  id, club_id: 'c1', tournament_id: 't1', home_team_name: home, away_team_name: away, is_club_home: true, match_date: '2026-11-21',
  venue: 'Park', status: 'upcoming', home_score: 0, away_score: 0, match_type: 'tournament', tournament_stage: 'group', tournament_round: 1, ...over,
} as Match);

// Timetable: 2 pitches, 25-minute slots, 9:00 to 10:00 -> two slots a day, a new round starts a new slot
const games = [
  m('a', 'A', 'B'), m('b', 'C', 'D'), m('c', 'E', 'F'),
  m('d', 'A', 'C', { tournament_round: 2 }), m('e', 'B', 'D', { tournament_round: 2 }),
];
const r = packKickoffs(games, { start: new Date(2026, 10, 21, 9, 0), end: new Date(2026, 10, 22), matchMinutes: 25, pitches: 2, dayEnd: '10:00' });
assert.deepEqual(games.map(g => `${g.match_date} ${g.match_time} ${g.pitch_label}`), [
  '2026-11-21 09:00 Pitch 1', '2026-11-21 09:00 Pitch 2', '2026-11-21 09:25 Pitch 1',
  '2026-11-22 09:00 Pitch 1', '2026-11-22 09:00 Pitch 2',
]);
assert.equal(r.days, 2);
assert.equal(r.overflow, false);
assert.equal(r.finish, '09:25');
assert.equal(packKickoffs([m('x', 'A', 'B'), m('y', 'A', 'C', { tournament_round: 2 })], { start: new Date(2026, 10, 21, 9), end: new Date(2026, 10, 21), matchMinutes: 60, dayEnd: '10:00' }).overflow, true, 'runs past the end date');

// Knockout slot + break: last group game 9:25-9:50, 15-minute break, semis 10:05 in 40-minute slots, final 10:45
const day = [
  m('g1', 'A', 'B'), m('g2', 'C', 'D', { tournament_round: 2 }),
  m('s1', 'W1', 'W2', { tournament_stage: 'semi_final', tournament_round: 1 }), m('s2', 'W3', 'W4', { tournament_stage: 'semi_final', tournament_round: 1 }),
  m('f', 'S1', 'S2', { tournament_stage: 'final', tournament_round: 2 }),
];
const ko = packKickoffs(day, { start: new Date(2026, 10, 28, 9, 0), matchMinutes: 25, pitches: 2, koMatchMinutes: 40, koBreakMinutes: 15 });
assert.deepEqual(day.map(g => g.match_time), ['09:00', '09:25', '10:05', '10:05', '10:45']);
assert.equal(ko.finish, '11:25');
// Without the knockout settings nothing changes
packKickoffs(day, { start: new Date(2026, 10, 28, 9, 0), matchMinutes: 25, pitches: 2 });
assert.deepEqual(day.map(g => g.match_time), ['09:00', '09:25', '09:50', '09:50', '10:15']);

// Team list paste
assert.deepEqual(parseTeamList('Bayside FC, sam@bayside.com\nHills Rovers\tjo@hills.org\n\nbayside fc\nNorth; x'), [
  { name: 'Bayside FC', email: 'sam@bayside.com' }, { name: 'Hills Rovers', email: 'jo@hills.org' }, { name: 'North x', email: null },
]);

// Kit clashes
assert.equal(colorsClash('#FF0000', '#EE1111'), true);
assert.equal(colorsClash('#FF0000', '#0000FF'), false);
assert.equal(colorsClash(null, '#0000FF'), false);
const parts = [{ id: 'p1', name: 'A', color: '#FF0000' }, { id: 'p2', name: 'B', color: '#F01010' }, { id: 'p3', name: 'C', color: '#0000FF' }] as TournamentParticipant[];
assert.equal(kitClashes([m('a', 'A', 'B'), m('b', 'A', 'C')], parts).length, 1);

// How a team went, and fair play
const done = [
  m('g1', 'A', 'B', { status: 'completed', home_score: 2, away_score: 1 }),
  m('g2', 'C', 'A', { status: 'completed', home_score: 1, away_score: 1 }),
  m('f', 'A', 'C', { status: 'completed', home_score: 0, away_score: 0, tournament_stage: 'final', winner_side: 'home' } as Partial<Match>),
];
const ev = [
  { id: 'e1', match_id: 'g1', event_type: 'goal', team_side: 'home', player_name: 'Sam Lee' },
  { id: 'e2', match_id: 'g1', event_type: 'goal', team_side: 'home', player_name: 'Sam Lee' },
  { id: 'e3', match_id: 'g2', event_type: 'goal', team_side: 'away', player_name: 'Ari Ho' },
  { id: 'e4', match_id: 'g1', event_type: 'red_card', team_side: 'away', player_name: 'Bo Kim' },
  { id: 'e5', match_id: 'g2', event_type: 'yellow_card', team_side: 'home', player_name: 'Cy Day' },
] as MatchEvent[];
const s = teamSummary('A', done, ev);
assert.deepEqual([s.played, s.won, s.drawn, s.lost, s.goalsFor, s.goalsAgainst], [3, 2, 1, 0, 3, 2], 'penalty win counts as a win');
assert.equal(s.finish, 'Winners');
assert.deepEqual(s.scorers, [{ name: 'Sam Lee', goals: 2 }, { name: 'Ari Ho', goals: 1 }]);
const fp = fairPlay([...done, m('n', 'B', 'C', { tournament_round: 3 })], ev, parts);
assert.deepEqual(fp.table.map(t => `${t.team}:${t.points}`), ['A:0', 'C:1', 'B:3']);
assert.deepEqual(fp.suspended.map(x => `${x.player}@${x.match.id}`), ['Bo Kim@n'], 'red card sits out the next game');

// The entry form
assert.equal(parseEntry({ players: [{ name: 'A', shirt_number: 7 }, { name: 'B', shirt_number: '7' }] }, null).ok, false, 'duplicate number');
assert.equal(parseEntry({ players: [{ name: 'A', shirt_number: 100 }] }, null).ok, false);
assert.equal(parseEntry({ players: [{ name: 'A' }, { name: 'B' }] }, 1).ok, false, 'squad too big');
assert.equal(parseEntry({ submit: true, players: [{ name: 'A' }] }, null).ok, false, 'needs a manager');
const ok = parseEntry({ submit: true, manager_name: ' Jo ', color: '#abcdef', players: [{ name: ' Sam ', position: 'GK', shirt_number: '' }, { name: '' }, { name: 'Lee', position: 'XX' }] }, null);
assert.ok(ok.ok);
if (ok.ok) {
  assert.equal(ok.value.manager_name, 'Jo');
  assert.deepEqual(ok.value.players.map(p => [p.name, p.position, p.shirt_number]), [['Sam', 'GK', null], ['Lee', null, null]]);
}
assert.equal(entryOpen({ entry_deadline: '2026-11-20T00:00:00Z', start_date: '2026-11-21' }, new Date('2026-11-19T00:00:00Z')), true);
assert.equal(entryOpen({ entry_deadline: '2026-11-20T00:00:00Z', start_date: '2026-11-21' }, new Date('2026-11-20T01:00:00Z')), false);
assert.equal(entryOpen({ entry_deadline: null, start_date: '' }), true);

assert.equal(teamSummary('A', [m('g1', 'A', 'B', { status: 'completed', home_score: 1 })], []).finish, null, 'league: no "Group stage" claim');
console.log('hosted-tournaments.check: ok');

// parsePlayers: the "Paste a list" box on the entry page and in tournament admin
{
  const list = parsePlayers('7 Sam Patel\nLeo Brooks, 10\n\nAri Haddad');
  assert.deepEqual(list.map(p => [p.shirt_number, p.name]), [[7, 'Sam Patel'], [10, 'Leo Brooks'], [null, 'Ari Haddad']]);
  assert.equal(list.every(p => p.position === null && !p.is_junior && !p.hide_public), true);
}
