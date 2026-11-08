// Self-check for friendly invitations.
// Run: npx esbuild lib/friendlies.check.ts --bundle --platform=node --log-level=warning | node
import assert from 'node:assert/strict';
import type { ClubEvent, ClubTeam, Match } from './supabase/types';
import {
  calendarFor, checkDay, dateLabel, fixtureFromInvitation, friendlyMessage, friendlyNote, friendlyOf, invitableTeams,
  okCrest, opponentName, ourSide, parseFriendly, parseSuggested, shortName,
} from './friendlies';

const TODAY = '2026-11-08';
const good = {
  their_club: 'Leppington Rovers', their_team: 'Reserves', format: '11v11', half_minutes: 45,
  dates: [{ date: '2026-11-21', time: '15:00' }, { date: '2026-11-22', time: '' }],
  host: 'them', their_ground: 'Rovers Park, Leppington',
};

// A full invitation
const p = parseFriendly(good, TODAY);
assert.ok(p.ok);
if (p.ok) {
  assert.equal(p.details.dates.length, 2);
  assert.equal(p.details.host, 'them');
  assert.equal(p.details.their_ground, 'Rovers Park, Leppington');
}

// What it refuses
const bad = (patch: Record<string, unknown>) => parseFriendly({ ...good, ...patch }, TODAY);
assert.equal(bad({ their_club: '  ' }).ok, false);
assert.equal(bad({ their_team: '' }).ok, false);
assert.equal(bad({ format: '6v6' }).ok, false);
assert.equal(bad({ half_minutes: 0 }).ok, false);
assert.equal(bad({ half_minutes: 61 }).ok, false);
assert.equal(bad({ dates: [] }).ok, false);
assert.equal(bad({ dates: [{ date: '2026-11-01', time: '' }] }).ok, false, 'a date in the past');
assert.equal(bad({ dates: [{ date: '2028-01-01', time: '' }] }).ok, false, 'more than a year ahead');
assert.equal(bad({ dates: [{ date: '2026-02-30', time: '' }] }).ok, false, 'not a real date');
assert.equal(bad({ dates: [{ date: '2026-11-21', time: '25:00' }] }).ok, false);
assert.equal(bad({ dates: Array.from({ length: 4 }, (_, i) => ({ date: `2026-12-0${i + 1}`, time: '' })) }).ok, false);
assert.equal(bad({ dates: 'soon' }).ok, false);
assert.equal(parseFriendly(null, TODAY).ok, false);

// Tidied up: tags stripped, empty half = usual, duplicates dropped, our host drops their ground
const tidy = parseFriendly({ ...good, their_club: '<b>Rovers</b>', half_minutes: '', host: 'us',
  dates: [{ date: '2026-11-21', time: '15:00' }, { date: '2026-11-21', time: '15:00' }] }, TODAY);
assert.ok(tidy.ok);
if (tidy.ok) {
  assert.equal(tidy.details.their_club, 'bRovers/b');
  assert.equal(tidy.details.half_minutes, null);
  assert.equal(tidy.details.dates.length, 1);
  assert.equal(tidy.details.their_ground, undefined);
}
// Anything other than us/them is "either"
const either = parseFriendly({ ...good, host: 'mars' }, TODAY);
assert.ok(either.ok && either.details.host === 'either');

// Saved details are read back without the date window (an old invitation still shows)
assert.ok(friendlyOf({ inquiry_type: 'Friendly Match', details: { ...good, dates: [{ date: '2020-01-01', time: '' }] } }));
assert.equal(friendlyOf({ inquiry_type: 'General Inquiry', details: good }), null);
assert.equal(friendlyOf({ inquiry_type: 'Friendly Match', details: null }), null);

// Names
assert.equal(opponentName({ their_club: 'Leppington Rovers', their_team: 'Reserves' }), 'Leppington Rovers Reserves');
assert.equal(opponentName({ their_club: 'Leppington Rovers', their_team: 'First Team' }), 'Leppington Rovers');
assert.equal(opponentName({ their_club: 'Leppington Rovers', their_team: 'Seniors' }), 'Leppington Rovers');
assert.equal(opponentName({ their_club: 'Hills U12 Girls', their_team: 'U12 Girls' }), 'Hills U12 Girls');
assert.equal(shortName('Leppington Rovers Reserves'), 'LRR');
assert.equal(dateLabel({ date: '2026-11-21', time: '15:00' }).endsWith('3:00 pm'), true);

// The message keeps the summary and their note apart
if (p.ok) {
  const msg = friendlyMessage(p.details, 'First Team', 'Keen for a hit-out.');
  assert.ok(msg.startsWith('Friendly invitation for First Team from Leppington Rovers (Reserves).'));
  assert.ok(msg.includes('At their ground: Rovers Park, Leppington'));
  assert.equal(friendlyNote(msg), 'Keen for a hit-out.');
  assert.equal(friendlyNote(friendlyMessage(p.details, 'First Team', '')), '');
  assert.equal(friendlyNote('Hello\n\nthere'), '');
}

// Is the team free?
const team = { id: 't1', club_id: 'c1', name: 'First Team', is_active: true, open_to_friendlies: true, sort_order: 1, match_format: '11v11', half_minutes: null } as ClubTeam;
const other = { ...team, id: 't2', name: 'Reserves' } as ClubTeam;
const match = (id: string, date: string, teamId: string, patch: Partial<Match> = {}) => ({
  id, club_id: 'c1', match_date: `${date}T05:00:00.000Z`, match_time: '16:00', team_id: teamId, match_type: 'friendly',
  opponent_name: 'Hills Hornets', is_club_home: true, home_team_name: 'Us', away_team_name: 'Hills Hornets', status: 'upcoming', ...patch,
}) as Match;
const event = { id: 'e1', club_id: 'c1', title: 'Presentation Night', category: 'social', start_time: '2026-11-28T07:00:00.000Z', is_public: true } as ClubEvent;
const items = calendarFor({ clubId: 'c1', clubTeams: [team, other], events: [event], matches: [
  match('m1', '2026-11-22', 't1'),
  match('m2', '2026-11-21', 't2'),
  match('m3', '2026-11-29', 't1', { status: 'cancelled' }),
] });
assert.equal(checkDay(items, 't1', '2026-11-21', 'First Team').kind, 'free', 'the Reserves game is not ours');
const clash = checkDay(items, 't1', '2026-11-22', 'First Team');
assert.equal(clash.kind, 'clash');
assert.equal(clash.text, 'First Team already plays Hills Hornets that day');
assert.equal(checkDay(items, 't1', '2026-11-22', 'First Team', 'm1').kind, 'free', 'editing that same game');
assert.equal(checkDay(items, 't1', '2026-11-28', 'First Team').kind, 'busy');
assert.ok(checkDay(items, 't1', '2026-11-28', 'First Team').text.startsWith('Free, but Presentation Night is at'));
assert.equal(checkDay(items, 't1', '2026-11-29', 'First Team').kind, 'free', 'a cancelled game is no clash');
assert.equal(checkDay(items, 't1', 'nonsense', 'First Team').kind, 'free');

// The fixture form, filled in
if (p.ok) {
  const f = fixtureFromInvitation(p.details, p.details.dates[0], team, 'Austral Park');
  assert.equal(f.opponent_name, 'Leppington Rovers Reserves');
  assert.equal(f.opponent_short_name, 'LRR');
  assert.equal(f.is_club_home, false);
  assert.equal(f.venue, 'Rovers Park, Leppington');
  assert.equal(f.match_date, '2026-11-21');
  assert.equal(f.match_time, '15:00');
  assert.equal(f.half_custom, false, '45 is the 11v11 usual');
  const home = fixtureFromInvitation({ ...p.details, host: 'either', half_minutes: 40 }, p.details.dates[1], team, 'Austral Park');
  assert.equal(home.is_club_home, true);
  assert.equal(home.venue, 'Austral Park');
  assert.equal(home.match_time, '15:00', 'no time given');
  assert.equal(home.half_custom, true);
  assert.equal(home.half_text, '40');
  const teamLength = fixtureFromInvitation({ ...p.details, half_minutes: 30 }, p.details.dates[0], { ...team, half_minutes: 30 }, '');
  assert.equal(teamLength.half_custom, false, 'same as the team');
}

// Who can be invited
assert.deepEqual(invitableTeams([
  team,
  { ...other, open_to_friendlies: false },
  { ...other, id: 't3', is_active: false },
  { ...other, id: 't4', open_to_friendlies: undefined },
  { ...other, id: 't5', club_id: 'c2' },
], 'c1').map(t => t.id), ['t1']);

// Their crest: a small inline image only
const CREST = 'data:image/png;base64,iVBORw0KGgo=';
assert.ok(okCrest(CREST));
assert.equal(okCrest('https://example.com/crest.png'), false);
assert.equal(okCrest('data:image/svg+xml;base64,PHN2Zz4='), false, 'no SVG');
assert.equal(okCrest(`data:image/png;base64,${'A'.repeat(20000)}`), false, 'too big');
const withCrest = parseFriendly({ ...good, crest: CREST }, TODAY);
assert.ok(withCrest.ok && withCrest.details.crest === CREST);
assert.equal(bad({ crest: 'javascript:alert(1)' }).ok, false);
assert.ok(bad({ crest: '' }).ok, 'no crest is fine');
// The public can't slip in suggested or picked dates through the form
const sneaky = parseFriendly({ ...good, suggested: [{ date: '2026-12-05', time: '' }], picked: { date: '2026-12-05', time: '' } }, TODAY);
assert.ok(sneaky.ok && !('suggested' in sneaky.details) && !('picked' in sneaky.details));

// Dates the club suggests
const sug = parseSuggested([{ date: '2026-12-05', time: '15:00' }, { date: '2026-12-05', time: '15:00' }, { date: '', time: '' }], TODAY);
assert.ok(sug.ok && sug.dates.length === 1, 'repeats and blanks dropped');
assert.equal(parseSuggested([], TODAY).ok, false);
assert.equal(parseSuggested([{ date: '2026-11-01', time: '' }], TODAY).ok, false, 'in the past');
assert.equal(parseSuggested([{ date: '2026-12-05', time: '9am' }], TODAY).ok, false);

// Read back from the enquiry, with what the club suggested and the visitor picked
if (p.ok) {
  const back = friendlyOf({
    inquiry_type: 'Friendly Match',
    details: { ...p.details, suggested: [{ date: '2026-12-05', time: '15:00' }, { date: 'nope', time: '' }], picked: { date: '2026-12-05', time: '15:00' } },
  });
  assert.deepEqual(back?.suggested, [{ date: '2026-12-05', time: '15:00' }]);
  assert.deepEqual(back?.picked, { date: '2026-12-05', time: '15:00' });
  assert.equal(friendlyOf({ inquiry_type: 'Friendly Match', details: { ...p.details } })?.picked, undefined);
}

// Our side, as the other club reads it
assert.equal(ourSide('Riverside Rovers FC', 'First Team'), 'Riverside Rovers FC');
assert.equal(ourSide('Riverside Rovers FC', 'Riverside Rovers Seniors'), 'Riverside Rovers Seniors');
assert.equal(ourSide('Riverside Rovers FC', 'U12 Girls'), 'Riverside Rovers FC U12 Girls');
assert.equal(ourSide('Riverside Rovers FC', ''), 'Riverside Rovers FC');

console.log('friendlies: ok');
