import assert from 'node:assert/strict';
import { cupWriteup, cupWriteupsFor, type CupWriteupInput } from './cup-writeup';
import type { ClubEvent, Match, MatchEvent } from './supabase/types';

// The 2026 MNFC Cup as ANCC's 35+ Squad played it
const mnfc: CupWriteupInput = {
  club: 'ANCC', team: '35+ Squad', cup: '2026 MNFC Cup', day: 'Sunday',
  finish: { stage: 'group', place: 3, through: 2 }, winner: 'Nepal United FC',
  games: [
    { opponent: 'Parra Park FC', href: '/ancc/match/1', us: 0, them: 3, goals: [], kickoff: '8:00 am' },
    { opponent: 'Laliguras FC', href: '/ancc/match/2', us: 2, them: 0, goals: [{ player: 'Yubaraj Lama', half: 1 }, { player: 'Yubaraj Lama', half: 2 }] },
    { opponent: 'MNFC White', href: '/ancc/match/3', us: 1, them: 0, goals: [{ player: 'Nirajan Shrestha', half: 2 }], goallessAtBreak: true },
    { opponent: 'Nepal United FC', href: '/ancc/match/4', us: 0, them: 6, goals: [] },
  ],
};
const a = cupWriteup(mnfc)!;
assert.equal(a.style, 'run');
assert.equal(a.headline, 'ANCC win two in a row as MNFC Cup run ends in the group stage');
assert.equal(a.lead, 'ANCC lost their first game at the 2026 MNFC Cup on Sunday, then beat Laliguras FC and MNFC White back to back. The 35+ Squad finished third in their group with six points, and only the top two went through.');
assert.deepEqual(a.paragraphs, [
  '[Parra Park FC](/ancc/match/1) won the opening game 3-0 at 8:00 am.',
  'Yubaraj Lama scored once in each half against [Laliguras FC](/ancc/match/2), and ANCC won 2-0. It was the first of two clean sheets at the cup.',
  'The game against [MNFC White](/ancc/match/3) was goalless at the break. Nirajan Shrestha scored the only goal in the second half.',
  '[Nepal United FC](/ancc/match/4) won the last group game 6-0, and they went on to win the cup.',
  'ANCC finished with two wins and two losses, three goals scored and nine conceded. Yubaraj Lama was the team\'s top scorer at the cup with two.',
]);

// No finish given: the headline doesn't guess one, and the lead has no group line
const plain = cupWriteup({ ...mnfc, finish: undefined, winner: undefined })!;
assert.equal(plain.headline, 'ANCC win two in a row at the MNFC Cup');
assert.ok(!plain.lead.includes('group'));
assert.ok(!plain.paragraphs.join(' ').includes('went on to win'));

// Winners open with how far they got
const champs = cupWriteup({ ...mnfc, finish: { stage: 'won' }, winner: undefined })!;
assert.equal(champs.style, 'far');
assert.equal(champs.headline, 'ANCC win the 2026 MNFC Cup');
assert.ok(champs.paragraphs[3].startsWith('[Nepal United FC](/ancc/match/4) won the final 6-0'));

// No run of wins, one player with two goals: the player opens
const player = cupWriteup({ ...mnfc, finish: undefined, winner: undefined, games: [mnfc.games[1], mnfc.games[0]] })!;
assert.equal(player.style, 'player');
assert.equal(player.headline, 'Yubaraj Lama scores two goals for ANCC at the MNFC Cup');

// Nothing stands out: a plain account of the day, with the group place when known
const day = cupWriteup({ ...mnfc, games: [mnfc.games[0], mnfc.games[3]] })!;
assert.equal(day.style, 'day');
assert.equal(day.headline, 'ANCC finish third in their group at the MNFC Cup');
assert.equal(day.lead, 'ANCC had two losses from two games at the 2026 MNFC Cup on Sunday. The 35+ Squad finished third in their group with no points, and only the top two went through.');

// A shootout win reads as one, never as a plain draw
const pens = cupWriteup({ club: 'ANCC', cup: 'Spring Cup', games: [{ opponent: 'Rivals', us: 1, them: 1, pens: { us: 4, them: 3 }, goals: [] }] })!;
assert.equal(pens.paragraphs[0], 'ANCC drew 1-1 with Rivals and won the shootout 4-3.');
assert.equal(pens.paragraphs.length, 1);

// From the club's data: only once Completed, only scored games, junior names shortened
const club = { id: 'c', slug: 'ancc', name: 'Austral Nepalese Community Club', short_name: 'ANCC', config: {} } as never;
const event = { id: 'e', club_id: 'c', title: 'ANCC joins MNFC Cup 2026', category: 'tournament', start_time: '2026-11-01T08:00:00+11:00', completed_at: '2026-11-01T20:00:00Z' } as ClubEvent;
const match = (id: string, home: number | null, away: number | null, status = 'completed') => ({
  id, club_id: 'c', event_id: 'e', status, home_team_name: 'ANCC', away_team_name: `Opp ${id}`, is_club_home: true,
  home_score: home, away_score: away, match_date: `2026-11-01T0${id}:00:00+11:00`, match_type: 'friendly',
}) as unknown as Match;
const goal = (match_id: string, minute: number, player: string) => ({ id: `${match_id}${minute}`, match_id, event_type: 'goal', team_side: 'home', minute, player_name: player }) as unknown as MatchEvent;
const src = {
  club, event, clubTeams: [],
  matches: [match('8', 2, 0), match('9', null, null, 'upcoming')],
  matchEvents: [goal('8', 10, 'Sam Lee'), goal('8', 70, 'Sam Lee')],
};
const out = cupWriteupsFor(src);
assert.equal(out.length, 1);
assert.ok(out[0].writeup.lead.includes('the MNFC Cup 2026 on Sunday'));
assert.ok(out[0].writeup.paragraphs[0].startsWith('Sam Lee scored once in each half'));
assert.deepEqual(cupWriteupsFor({ ...src, event: { ...event, completed_at: null } }), []);
assert.deepEqual(cupWriteupsFor({ ...src, matches: [match('9', null, null, 'upcoming')] }), []);

console.log('cup-writeup checks passed');
