// Self-check for the admin calendar helpers.
// Run: npx esbuild lib/admin-calendar.check.ts --bundle --platform=node --log-level=warning | node
import assert from 'node:assert/strict';
import type { ClubEvent, ClubSeason, ClubTeam, Match, Tournament } from './supabase/types';
import {
  buildCalendarItems, dayKey, filterItems, itemsOnDay, layoutDay, matchStart, monthGrid, newItemHref, parseNewItemRequest,
  startOfWeek, weekDays,
  type CalendarKind,
} from './admin-calendar';

const team = (id: string, is_default = false): ClubTeam => ({
  id, club_id: 'c1', name: id, slug: id, team_type: 'senior', gender: 'mixed', is_junior: false,
  hide_public_scores: false, match_format: '11v11', sort_order: 100, is_default, is_active: true,
});
const teams = [team('first', true), team('u18')];

const match = (id: string, extra: Partial<Match> = {}): Match => ({
  id, club_id: 'c1', competition: 'League', season: '2026/27', home_team_name: 'Riverside', away_team_name: 'Eastfield',
  home_team_logo: '', away_team_logo: '', is_club_home: true, match_date: '2026-10-17T14:00:00Z', venue: 'Park',
  status: 'upcoming', home_score: 0, away_score: 0, current_minute: 0, added_time: 0, period: 'pre_match', ...extra,
} as Match);

const event = (id: string, extra: Partial<ClubEvent & { team_id: string | null }> = {}) => ({
  id, club_id: 'c1', title: id, description: '', category: 'training', start_time: '2026-10-13T18:00:00Z',
  location: 'Pitch 2', max_capacity: 0, rsvp_count: 0, is_public: true, ...extra,
} as ClubEvent & { team_id?: string | null });

// Kick-off: a real timestamp is used as is; a date-only fixture takes its local match_time
assert.equal(matchStart({ match_date: '2026-10-17T14:00:00Z' })!.start.getTime(), Date.parse('2026-10-17T14:00:00Z'));
const local = matchStart({ match_date: '2026-10-24T00:00:00Z', match_time: '10:30' })!;
assert.equal(dayKey(local.start), '2026-10-24');
assert.equal(local.start.getHours(), 10);
assert.equal(local.start.getMinutes(), 30);
assert.equal(matchStart({ match_date: '2026-10-24T00:00:00Z' })!.timeKnown, false);
assert.equal(matchStart({ match_date: 'nope' }), null);

const items = buildCalendarItems({
  clubId: 'c1',
  clubTeams: teams,
  matches: [
    match('won', { status: 'completed', home_score: 3, away_score: 1 }),
    match('away-loss', { status: 'completed', is_club_home: false, home_team_name: 'Kingsway', away_team_name: 'Riverside', opponent_name: 'Kingsway', home_score: 2, away_score: 0 }),
    match('u18', { team_id: 'u18' }),
    match('off', { status: 'postponed' }),
    match('internal', { match_type: 'internal', home_team_name: 'Reds', away_team_name: 'Blues' }),
    match('cup-tie', { tournament_id: 't1' }),
    match('other-club', { club_id: 'c2' }),
  ],
  events: [event('training'), event('u18-training', { team_id: 'u18' }), event('agm', { category: 'agm', end_time: '2026-10-14T17:00:00Z', start_time: '2026-10-14T18:00:00Z' })],
  tournaments: [{ id: 't1', club_id: 'c1', name: 'Autumn Cup', start_date: new Date(2026, 9, 24, 10).toISOString(), end_date: new Date(2026, 9, 25, 16).toISOString() } as Tournament],
  seasons: [{ id: 's1', club_id: 'c1', name: '2026/27', start_date: '2026-08-01', end_date: '2027-05-31', is_current: true, status: 'active' } as ClubSeason],
});
const byKey = new Map(items.map(i => [i.key, i]));

// Tournament fixtures and other clubs' rows stay out
assert.ok(!byKey.has('match:cup-tie'));
assert.ok(!byKey.has('match:other-club'));

// Titles and results from the club's side
assert.equal(byKey.get('match:won')!.title, 'vs Eastfield');
assert.equal(byKey.get('match:won')!.result, 'W');
assert.equal(byKey.get('match:won')!.score, '3-1');
assert.equal(byKey.get('match:away-loss')!.title, '@ Kingsway');
assert.equal(byKey.get('match:away-loss')!.result, 'L');
assert.equal(byKey.get('match:away-loss')!.score, '0-2');
assert.equal(byKey.get('match:off')!.off, true);
assert.equal(byKey.get('match:u18')!.score, undefined);
assert.equal(byKey.get('match:internal')!.title, 'Reds vs Blues');
assert.equal(byKey.get('match:internal')!.result, undefined);

// Teams: unassigned fixtures are the main team's; internal matches have none
assert.equal(byKey.get('match:won')!.teamId, 'first');
assert.equal(byKey.get('match:u18')!.teamId, 'u18');
assert.equal(byKey.get('match:internal')!.teamId, null);

// Events: kinds from the category; an end before the start falls back to a default length
assert.equal(byKey.get('event:agm')!.kind, 'social');
assert.ok(byKey.get('event:agm')!.end > byKey.get('event:agm')!.start);

// Tournament spans both days; seasons give a start and an end marker
const cup = byKey.get('tournament:t1')!;
assert.equal(dayKey(cup.start), '2026-10-24');
assert.equal(dayKey(cup.end), '2026-10-26');
assert.equal(itemsOnDay([cup], new Date(2026, 9, 25)).length, 1);
assert.equal(itemsOnDay([cup], new Date(2026, 9, 26)).length, 0);
assert.equal(byKey.get('season-start:s1')!.title, 'Season 2026/27 starts');
assert.equal(dayKey(byKey.get('season-end:s1')!.start), '2027-05-31');

// A tournament also listed under Events & Training shows once, as the tournament (with a link to the event)
const cupItems = buildCalendarItems({
  clubId: 'c1', clubTeams: teams, matches: [], seasons: [],
  tournaments: [{ id: 'd1', club_id: 'c1', name: 'ANCC Dashain Cup 2026', start_date: new Date(2026, 9, 17, 9).toISOString(), end_date: new Date(2026, 9, 18, 17).toISOString() } as Tournament],
  events: [
    event('cup-event', { title: 'ANCC Dashain Cup 2026', category: 'tournament', start_time: new Date(2026, 9, 17, 9).toISOString() }),
    event('short', { title: 'Dashain Cup', category: 'tournament', start_time: new Date(2026, 9, 18, 10).toISOString() }),
    event('other-week', { title: 'ANCC Dashain Cup 2026', category: 'tournament', start_time: new Date(2026, 10, 1, 9).toISOString() }),
    event('social', { title: 'Cup', category: 'social', start_time: new Date(2026, 9, 17, 20).toISOString() }),
  ],
});
const cupKeys = cupItems.map(i => i.key).sort();
assert.deepEqual(cupKeys, ['event:other-week', 'event:social', 'tournament:d1']);
const dashain = cupItems.find(i => i.key === 'tournament:d1')!;
assert.ok(dashain.eventId === 'cup-event' || dashain.eventId === 'short');
// Its days come from the saved instant in local time (the form saves a local date-time as UTC)
assert.equal(dayKey(dashain.start), '2026-10-17');
assert.equal(dayKey(dashain.end), '2026-10-19');

// Filters: whole-club events show for any team; other teams' rows and internal matches don't
const all = new Set<CalendarKind>(['match', 'training', 'social', 'trial', 'tournament', 'season']);
const u18 = filterItems(items, all, 'u18').map(i => i.key);
assert.ok(u18.includes('match:u18'));
assert.ok(u18.includes('event:u18-training'));
assert.ok(u18.includes('event:training'));
assert.ok(u18.includes('tournament:t1'));
assert.ok(!u18.includes('match:won'));
assert.ok(!u18.includes('match:internal'));
assert.equal(filterItems(items, new Set<CalendarKind>(['training']), 'ALL').length, 2);
assert.equal(filterItems(items, all, 'ALL').length, items.length);

// Grids start on Monday; October 2026 runs Mon 28 Sep to Sun 1 Nov
const grid = monthGrid(new Date(2026, 9, 12));
assert.equal(grid.length, 35);
assert.equal(dayKey(grid[0]), '2026-09-28');
assert.equal(dayKey(grid[34]), '2026-11-01');
assert.equal(monthGrid(new Date(2027, 1, 10)).length, 28); // February 2027: Monday 1st to Sunday 28th
assert.equal(dayKey(startOfWeek(new Date(2026, 9, 18))), '2026-10-12');
assert.equal(dayKey(weekDays(new Date(2026, 9, 14))[6]), '2026-10-18');

// Overlapping timed items sit side by side; a later one gets the full width again
const at = (key: string, h1: number, h2: number) => ({ ...byKey.get('event:training')!, key, start: new Date(2026, 9, 13, h1), end: new Date(2026, 9, 13, h2) });
const laid = layoutDay([at('a', 18, 20), at('b', 19, 21), at('c', 21, 22)]);
const lane = (k: string) => laid.find(l => l.item.key === k)!;
assert.deepEqual([lane('a').lane, lane('a').lanes], [0, 2]);
assert.deepEqual([lane('b').lane, lane('b').lanes], [1, 2]);
assert.deepEqual([lane('c').lane, lane('c').lanes], [0, 1]);

// Adding from a calendar day: the link carries the date (and time, team) and the page reads it back
const href = newItemHref('/rfc/admin/matches', new Date(2026, 9, 17), '15:00', 'u18');
assert.equal(href, '/rfc/admin/matches?new=2026-10-17&time=15%3A00&team=u18');
assert.deepEqual(parseNewItemRequest(href.split('?')[1]), { date: '2026-10-17', time: '15:00', team: 'u18' });
assert.equal(newItemHref('/rfc/admin/events', new Date(2026, 9, 17), undefined, 'ALL'), '/rfc/admin/events?new=2026-10-17');
assert.deepEqual(parseNewItemRequest('?new=2026-10-17&time=25:00'), { date: '2026-10-17', time: undefined, team: undefined });
assert.equal(parseNewItemRequest('?new=2026-02-30'), null);
assert.equal(parseNewItemRequest('?tab=results'), null);

console.log('admin-calendar checks passed');
