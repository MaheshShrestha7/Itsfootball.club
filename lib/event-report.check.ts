import assert from 'node:assert/strict';
import { buildEventReport, isEventReport, type EventReportInput } from './event-report';
import type { Match } from './supabase/types';

const scan = (member_id: string | undefined, member_name: string, extra = {}) => ({ scan_type: 'event_checkin' as const, valid: true, event_id: 'e1', member_id, member_name, ...extra });
const names: Record<string, string> = { p1: 'Chris Nguyen', p2: 'Tom Wells', p3: 'Leo Brooks' };
const base: EventReportInput = {
  club: 'ANCC',
  event: { title: 'Trivia night', category: 'social', max_capacity: 80, rsvp_count: 0, completed_at: '2026-10-24T00:00:00Z' },
  meta: 'Social',
  eventId: 'e1',
  scans: [
    scan('p1', 'Chris'), scan('p1', 'Chris'), // scanned twice: one person
    scan('p2', 'Tom'),
    scan(undefined, 'Jo Guest'), scan(undefined, ' jo guest '), // a guest typed twice
    scan('p3', 'Leo', { valid: false }), // a refused scan
    scan('p3', 'Leo', { event_id: 'other' }), // another event
  ],
  squad: [{ id: 'p1', name: 'Chris Nguyen' }, { id: 'p2', name: 'Tom Wells' }, { id: 'p3', name: 'Leo Brooks' }],
  nameOf: id => names[id],
  games: [],
  when: () => '',
  notes: { went_well: 'Raffle was the biggest earner.\n- Sold out early', next_time: 'Start at 6:30' },
  committee: true,
};

const social = buildEventReport(base);
assert.equal(social.opening, '3 people came, out of 80 places. 2 of the 3 checked in were club members.');
assert.deepEqual(social.figures.map(f => `${f.label} ${f.value}`), ['Checked in 3', 'Places 80', 'Members 2']);
assert.deepEqual(social.names, ['Chris Nguyen', 'Jo Guest', 'Tom Wells']);
assert.deepEqual(social.wentWell, ['Raffle was the biggest earner.', 'Sold out early']);
assert.deepEqual(social.nextTime, ['Start at 6:30']);
assert.equal(social.missed, undefined, 'only training lists who missed');
assert.equal(social.completed, true);

// The door count on the event wins when it is higher than the scans
assert.equal(buildEventReport({ ...base, event: { ...base.event, rsvp_count: 64 } }).figures[0].value, '64');
assert.match(buildEventReport({ ...base, scans: [scan('p1', 'Chris'), scan(undefined, 'Jo')] }).opening, /1 of the 2 checked in was a club member\./);

// The shared version: no names, no notes for next time, nothing about who missed
const shared = buildEventReport({ ...base, committee: false, event: { ...base.event, category: 'training' } });
assert.ok(!('names' in shared) && !('nextTime' in shared) && !('missed' in shared));
assert.ok(!JSON.stringify(shared).includes('Chris'), 'no names in the shared copy');
assert.ok(isEventReport(JSON.parse(JSON.stringify(shared))));
assert.ok(!isEventReport({ v: 2 }) && !isEventReport(null));

// Training: squad and who missed
const training = buildEventReport({ ...base, event: { ...base.event, category: 'training', max_capacity: 0 } });
assert.equal(training.opening, '3 players came to training. 2 of the 3 in the squad checked in.');
assert.deepEqual(training.missed, ['Leo Brooks']);
assert.deepEqual(training.figures.map(f => f.label), ['Checked in', 'Squad']);

// Linked games
const game = (id: string, hs: number, as: number, home = true) => ({ id, status: 'completed', home_score: hs, away_score: as, is_club_home: home, match_type: 'friendly', home_team_name: home ? 'ANCC' : 'Rovers', away_team_name: home ? 'Rovers' : 'ANCC', opponent_name: 'Rovers' }) as unknown as Match;
const cup = buildEventReport({ ...base, scans: [], games: [game('g1', 2, 0), game('g2', 3, 1, false), { ...game('g3', 0, 0), status: 'upcoming' } as Match] });
assert.equal(cup.opening, 'Nobody was checked in at the door. We played two games: won one and lost one.');
assert.deepEqual(cup.games.map(g => `${g.outcome} ${g.score} ${g.opponent}`), ['W 2-0 Rovers', 'L 1-3 Rovers']);
assert.equal(cup.figures.at(-1)?.value, '1 · 0 · 1');

console.log('event-report checks passed');
