// Self-check for ticket order rules and the calendar feed.
// Run: npx esbuild lib/tickets.check.ts --bundle --platform=node --log-level=warning | node
import assert from 'node:assert/strict';
import { ticketOrderError, salesOpen, MAX_TICKETS_PER_ORDER } from './tickets';
import { buildCalendar, foldLine, icsText, matchTimes } from './calendar';

const now = Date.parse('2026-10-03T10:00:00Z');
const gala = { is_public: true, ticket_price_cents: 2500, start_time: '2026-10-10T08:00:00Z', end_time: null };

assert.equal(ticketOrderError(gala, 2, null, now), null, 'open sale, no capacity limit');
assert.equal(ticketOrderError(gala, 3, 3, now), null, 'exactly the last tickets');
assert.equal(ticketOrderError(gala, 4, 3, now), 'Only 3 tickets left.');
assert.equal(ticketOrderError(gala, 1, 0, now), 'This event is sold out.');
assert.equal(ticketOrderError(gala, 0, null, now), `Choose between 1 and ${MAX_TICKETS_PER_ORDER} tickets.`);
assert.equal(ticketOrderError(gala, 1.5, null, now), `Choose between 1 and ${MAX_TICKETS_PER_ORDER} tickets.`);
assert.equal(ticketOrderError(gala, NaN, null, now), `Choose between 1 and ${MAX_TICKETS_PER_ORDER} tickets.`);
assert.equal(ticketOrderError(gala, MAX_TICKETS_PER_ORDER + 1, null, now), `Choose between 1 and ${MAX_TICKETS_PER_ORDER} tickets.`);
assert.equal(ticketOrderError({ ...gala, ticket_price_cents: 0 }, 1, null, now), 'This event doesn’t sell tickets.');
assert.equal(ticketOrderError({ ...gala, is_public: false }, 1, null, now), 'Event not found.', 'private events sell nothing');
assert.equal(ticketOrderError(null, 1, null, now), 'Event not found.');
// Sales close at the end time, or 6 hours after kick-off without one
assert.ok(salesOpen({ start_time: '2026-10-03T05:00:00Z' }, now), '5h after kick-off: still open');
assert.ok(!salesOpen({ start_time: '2026-10-03T03:00:00Z' }, now), '7h after kick-off: closed');
assert.ok(!salesOpen({ start_time: '2026-10-03T09:00:00Z', end_time: '2026-10-03T09:30:00Z' }, now), 'past its end time');

// Calendar: escaping and folding (RFC 5545)
assert.equal(icsText('Smith, J; "Gala"\\Night\nBring ID'), 'Smith\\, J\\; "Gala"\\\\Night\\nBring ID');
const long = `SUMMARY:${'Ünïcödé '.repeat(20)}`;
const folded = foldLine(long);
for (const part of folded.split('\r\n')) assert.ok(new TextEncoder().encode(part).length <= 75, 'folded line within 75 octets');
assert.equal(folded.split('\r\n').map((p, i) => (i ? p.slice(1) : p)).join(''), long, 'unfolding restores the line');

// Fixture times: a real instant stays UTC; a tournament date + local kick-off becomes floating local time
assert.deepEqual(matchTimes({ match_date: '2026-10-04T04:30:00.000Z', match_time: '15:30' }), { start: '20261004T043000Z', end: '20261004T063000Z' });
assert.deepEqual(matchTimes({ match_date: '2026-10-04T00:00:00+00:00', match_time: '14:30' }), { start: '20261004T143000', end: '20261004T163000' });
assert.deepEqual(matchTimes({ match_date: '2026-10-04T00:00:00+00:00', match_time: '23:00' }), { start: '20261004T230000', end: '20261005T010000' }, 'ends past midnight');
assert.equal(matchTimes({ match_date: 'not a date' }), null);

const ics = buildCalendar({
  clubName: 'Austral FC',
  baseUrl: 'https://itsfootball.club/austral',
  now: new Date(now),
  matches: [
    { id: 'm1', home_team_name: 'Austral', away_team_name: 'Rovers', match_date: '2026-09-20T05:00:00Z', status: 'completed', home_score: 2, away_score: 1, venue: 'Park, Field 2' },
    { id: 'm2', home_team_name: 'Austral', away_team_name: 'United', match_date: '2026-10-11T05:00:00Z', status: 'cancelled' },
  ],
  events: [{ id: 'e1', title: 'Presentation Night', start_time: '2026-10-20T08:00:00Z', end_time: '2026-10-20T07:00:00Z', location: 'Clubhouse' }],
});
assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n') && ics.endsWith('END:VCALENDAR\r\n'), 'CRLF-delimited calendar');
assert.ok(ics.includes('SUMMARY:Austral 2–1 Rovers'), 'result in the title');
assert.ok(ics.includes('LOCATION:Park\\, Field 2'), 'escaped location');
assert.ok(ics.includes('UID:match-m2@itsfootball.club\r\nDTSTAMP:20261003T100000Z') && ics.includes('STATUS:CANCELLED'), 'cancelled fixture marked');
assert.ok(ics.includes('DTSTART:20261020T080000Z\r\nDTEND:20261020T100000Z'), 'an end before the start falls back to 2 hours');
assert.ok(ics.includes('URL:https://itsfootball.club/austral/events/e1'));
assert.equal(ics.match(/BEGIN:VEVENT/g)?.length, 3);

console.log('tickets & calendar: OK');
