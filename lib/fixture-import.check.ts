// Self-check for reading a season's draw.
// Run: npx esbuild lib/fixture-import.check.ts --bundle --platform=node --log-level=warning | node
import assert from 'node:assert/strict';
import { detectColumns, guessOurName, isOurTeam, judgeRow, parseDrawDate, parseDrawTime, readDraw } from './fixture-import';

assert.equal(parseDrawDate('14/03/2027'), '2027-03-14');
assert.equal(parseDrawDate('4/3/27'), '2027-03-04');
assert.equal(parseDrawDate('14.03.2027'), '2027-03-14');
assert.equal(parseDrawDate('2027-03-14'), '2027-03-14');
assert.equal(parseDrawDate('Sat 14 Mar 2027'), '2027-03-14');
assert.equal(parseDrawDate('Saturday, 14th March', 2027), '2027-03-14');
assert.equal(parseDrawDate('14/03', 2027), '2027-03-14');
assert.equal(parseDrawDate('31/02/2027'), null);
assert.equal(parseDrawDate('next week'), null);

assert.equal(parseDrawTime('15:00'), '15:00');
assert.equal(parseDrawTime('3pm'), '15:00');
assert.equal(parseDrawTime('3:30 PM'), '15:30');
assert.equal(parseDrawTime('9.15am'), '09:15');
assert.equal(parseDrawTime('12am'), '00:00');
assert.equal(parseDrawTime('1500'), '15:00');
assert.equal(parseDrawTime('930'), '09:30');
assert.equal(parseDrawTime('3'), null);
assert.equal(parseDrawTime('TBC'), null);

assert.deepEqual(detectColumns(['Rd', 'Date', 'Kick-off', 'Home Team', 'Away Team', 'Ground']), { round: 0, date: 1, time: 2, home: 3, away: 4, venue: 5 });

const csv = 'Round,Date,Time,Home,Away,Venue\n1,14/03/2027,9:00am,Riverside FC U12,Hills United,"Riverside Oval, Pitch 2"\n1,14/03/2027,9:00am,Lakeside,Parkview,Lake Park\n2,21/03/2027,TBC,Hills United,Riverside FC U12,Hills Reserve\n3,28/03/2027,,Riverside FC U12,BYE,\n4,04/04/27,10am,Riverside FC U12,Lakeside,\n5,someday,,Riverside FC U12,Parkview,\n';
const draw = readDraw(csv);
assert.equal(draw.rows.length, 6);
assert.equal(draw.rows[0].venue, 'Riverside Oval, Pitch 2');
assert.equal(draw.rows[0].line, 2);

const tsv = readDraw('Date\tHome\tAway\n14/03/2027\tA\tB\n');
assert.equal(tsv.rows[0].home, 'A');
assert.deepEqual(readDraw('Round,Home,Away\n1,A,B').missing, ['date']);

assert.ok(isOurTeam('Riverside FC U12 Blue', 'Riverside FC'));
assert.ok(isOurTeam('riverside fc', 'Riverside FC'));
assert.ok(!isOurTeam('Riversiders', 'Riverside'));
assert.equal(guessOurName(draw.rows, ['Riverside FC']), 'Riverside FC');
assert.equal(guessOurName(draw.rows, ['Nope']), 'Riverside FC U12');

const existing = [{ date: '2027-04-04', opponent: 'lakeside' }];
const v = draw.rows.map(r => judgeRow(r, 'Riverside FC', existing));
assert.deepEqual(v[0], { kind: 'new', isHome: true, opponent: 'Hills United' });
assert.deepEqual(v[1], { kind: 'skip', reason: 'Not our game' });
assert.deepEqual(v[2], { kind: 'new', isHome: false, opponent: 'Hills United' });
assert.deepEqual(v[3], { kind: 'skip', reason: 'Bye' });
assert.equal(v[4].kind, 'duplicate');
assert.equal(v[5].kind, 'problem');

console.log('fixture-import: dates, times, columns and row checks OK');
