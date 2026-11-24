import assert from 'node:assert/strict';
import { DEFAULT_SOCIAL, clubUrl, readSocialSettings, socialQueue, splitQueue, type QueueInput } from './social-posts';
import type { ClubEvent, Match } from './supabase/types';

const H = 36e5;
const now = Date.parse('2026-11-20T00:00:00Z');
const base = {
  club_id: 'c', competition: 'League', season: '2026', home_team_name: 'Craik Park FC', away_team_name: 'Liverpool Rangers',
  home_team_logo: '', away_team_logo: '', is_club_home: true, venue: 'Craik Park', home_score: 0, away_score: 0,
  current_minute: 0, added_time: 0, period: 'first_half', match_type: 'friendly', created_at: '2026-11-01T00:00:00Z',
} as unknown as Match;
const m = (id: string, o: Partial<Match>): Match => ({ ...base, id, slug: id, ...o } as Match);
const at = (ms: number) => new Date(ms).toISOString();

const matches = [
  m('soon', { status: 'upcoming', match_date: at(now + 12 * H) }),          // inside a day: matchday ready
  m('later', { status: 'upcoming', match_date: at(now + 5 * 24 * H) }),     // matchday to come
  m('live', { status: 'live', match_date: at(now - H) }),
  m('ht', { status: 'halftime', match_date: at(now - H), home_score: 1 }),
  m('ft', { status: 'completed', match_date: at(now - 2 * 24 * H), home_score: 3, away_score: 1 }),
  m('old', { status: 'completed', match_date: at(now - 9 * 24 * H) }),       // too old
  m('stuck', { status: 'live', match_date: at(now - 20 * H) }),             // never ended
  m('inhouse', { status: 'upcoming', match_type: 'internal', match_date: at(now + H) }),
  m('cup', { status: 'upcoming', tournament_id: 't', match_date: at(now + H) }),
];
const events = [
  { id: 'night', title: 'Presentation Night', category: 'social', is_public: true, start_time: at(now + 8 * 24 * H), location: 'Austral Hall', ticket_price_cents: 2500, created_at: at(now - H) },
  { id: 'train', title: 'Training', category: 'training', is_public: true, start_time: at(now + 24 * H), location: '' },
  { id: 'private', title: 'Committee', category: 'agm', is_public: false, start_time: at(now + 24 * H), location: '' },
] as unknown as ClubEvent[];

const input: QueueInput = {
  matches, events, settings: { ...DEFAULT_SOCIAL, hashtags: '#CraikPark' },
  club: { slug: 'craik-park', name: 'Craik Park FC' }, timeZone: 'Australia/Sydney',
  hideScore: () => false, motm: x => (x.id === 'ft' ? 'Leo Park' : undefined), hasLineup: x => x.id === 'soon', now,
};
const q = socialQueue(input);
const keys = q.map(p => p.key).sort();
assert.deepEqual(keys, ['event:night', 'fixture:later', 'fixture:soon', 'fulltime:ft', 'kickoff:ht', 'kickoff:live', 'team:soon'].sort(),
  'own team games and public non-training events only; halftime and motm are off by default');
assert.equal(q.find(p => p.key === 'fixture:later')!.ready, false, 'a day before by default');
assert.equal(q.find(p => p.key === 'fixture:soon')!.ready, true);
assert.equal(q.find(p => p.key === 'event:night')!.ready, true, 'events are ready as soon as they are added');

// Captions say only what the data says
const ft = q.find(p => p.key === 'fulltime:ft')!.caption;
assert.match(ft, /^Full time: Craik Park FC 3–1 Liverpool Rangers\./);
assert.match(ft, /itsfootball\.club\/craik-park\/match\/ft\?utm_source=social&utm_medium=social\n/);
assert.match(ft, /\n\n#CraikPark$/);
assert.match(q.find(p => p.key === 'fixture:soon')!.caption, /^Matchday Fri 20 Nov: Craik Park FC vs Liverpool Rangers, kick-off 11:00 pm at Craik Park\./);
assert.match(q.find(p => p.key === 'event:night')!.caption, /^Presentation Night: Saturday 28 November, 11:00 am at Austral Hall\. Tickets \$25\./);

// Away games still read "Club vs Opponent"
const away = socialQueue({ ...input, matches: [m('a', { status: 'live', is_club_home: false, match_date: at(now - H) })], events: [] })[0];
assert.match(away.caption, /^We're under way! Liverpool Rangers vs Craik Park FC\./);

// Hidden scores: no half-time post, no score at full time
const hidden = socialQueue({ ...input, settings: readSocialSettings({ rules: { halftime: { on: true }, motm: { on: true } } }), hideScore: () => true });
assert.ok(!hidden.some(p => p.trigger === 'halftime'));
assert.equal(hidden.find(p => p.key === 'fulltime:ft')!.caption.split('\n')[0], "That's full time: Craik Park FC vs Liverpool Rangers.");
assert.ok(hidden.some(p => p.key === 'motm:ft'));
const shown = socialQueue({ ...input, settings: readSocialSettings({ rules: { halftime: { on: true } } }) });
assert.match(shown.find(p => p.key === 'halftime:ht')!.caption, /^Half time: Craik Park FC 1–0 Liverpool Rangers\./);

// Settings: switches off, bad values fall back
const s = readSocialSettings({ rules: { fixture: { on: false, when: 'year' }, event: { when: 'week' } }, hashtags: 5 });
assert.equal(s.rules.fixture.on, false);
assert.equal(s.rules.fixture.when, 'day');
assert.equal(s.rules.event.when, 'week');
assert.equal(s.hashtags, '');
assert.ok(!socialQueue({ ...input, settings: s }).some(p => p.trigger === 'fixture'));
assert.equal(socialQueue({ ...input, settings: s }).find(p => p.key === 'event:night')!.ready, false, 'a week before an event 8 days away');

// Marks split the list
const split = splitQueue(q, { 'fulltime:ft': { status: 'shared', at: at(now) } });
assert.ok(split.done.some(p => p.key === 'fulltime:ft'));
assert.ok(!split.todo.some(p => p.key === 'fulltime:ft'));
assert.equal(split.later[0].key, 'fixture:later');

// Custom domains drop the slug
assert.equal(clubUrl({ slug: 'cp', custom_domain: 'cpfc.com.au' }, '/cp/match/x'), 'https://cpfc.com.au/match/x');
assert.equal(clubUrl({ slug: 'cp', custom_domain: 'cpfc.com.au' }, '/cp'), 'https://cpfc.com.au/');

// Player birthdays: today ready, coming up in 14d, alumni & unapproved skipped, junior privacy enforced
const bdayQueue = socialQueue({
  ...input,
  matches: [],
  events: [],
  members: [
    { id: 'm1', full_name: 'Rohan Gurung', date_of_birth: '2000-11-20', jersey_number: 10, player_position: 'Forward', photo_url: 'https://img/r.jpg', status: 'active', membership_status: 'approved', team_name: "Men's First Team" },
    { id: 'm2', full_name: 'Maya Patel', date_of_birth: '2014-11-24', jersey_number: 7, player_position: 'Midfielder', photo_url: 'https://img/m.jpg', photo_consent: false, status: 'active', membership_status: 'approved', is_junior: true, team_name: 'U12 Girls' },
    { id: 'm3', full_name: 'Samira Lee', date_of_birth: '2013-11-20', photo_url: 'https://img/s.jpg', photo_consent: true, status: 'active', membership_status: 'approved', is_junior: true },
    { id: 'm4', full_name: 'Old Alumni', date_of_birth: '1990-11-20', status: 'alumni', membership_status: 'approved' },
    { id: 'm5', full_name: 'Pending Player', date_of_birth: '1998-11-20', status: 'active', membership_status: 'pending' },
    { id: 'm6', full_name: 'Far Away', date_of_birth: '1995-03-10', status: 'active', membership_status: 'approved' },
  ],
});
assert.deepEqual(bdayQueue.map(p => p.key).sort(), ['birthday:m1:2026', 'birthday:m2:2026', 'birthday:m3:2026']);
const rohan = bdayQueue.find(p => p.key === 'birthday:m1:2026')!;
assert.equal(rohan.ready, true);
assert.equal(rohan.birthday?.displayName, 'Rohan Gurung');
assert.equal(rohan.birthday?.turningAge, 26);
assert.equal(rohan.birthday?.photoUrl, 'https://img/r.jpg');
assert.match(rohan.caption, /^Happy Birthday Rohan Gurung! Wishing our #10 Forward \(Men's First Team\)/);

const maya = bdayQueue.find(p => p.key === 'birthday:m2:2026')!;
assert.equal(maya.ready, false, '4 days away goes into Coming up');
assert.equal(maya.birthday?.displayName, 'Maya P.', 'junior name shortened');
assert.equal(maya.birthday?.photoUrl, undefined, 'junior photo hidden without consent');
assert.equal(maya.birthday?.turningAge, undefined, 'junior age never exposed');

const samira = bdayQueue.find(p => p.key === 'birthday:m3:2026')!;
assert.equal(samira.birthday?.photoUrl, 'https://img/s.jpg', 'junior photo allowed when photo_consent is true');

// Dec -> Jan year rollover & leap day (Feb 29 -> Feb 28 in non-leap year 2027)
const decRoll = socialQueue({
  ...input,
  matches: [],
  events: [],
  now: Date.parse('2026-12-29T00:00:00Z'),
  members: [{ id: 'jan', full_name: 'Alex Kim', date_of_birth: '1999-01-02', status: 'active', membership_status: 'approved' }],
});
assert.equal(decRoll.length, 1);
assert.equal(decRoll[0].key, 'birthday:jan:2027');
assert.equal(decRoll[0].birthday?.turningAge, 28);

const leapDay = socialQueue({
  ...input,
  matches: [],
  events: [],
  now: Date.parse('2027-02-28T00:00:00Z'),
  members: [{ id: 'leap', full_name: 'Leap Star', date_of_birth: '2000-02-29', status: 'active', membership_status: 'approved' }],
});
assert.equal(leapDay.length, 1);
assert.equal(leapDay[0].ready, true);
assert.equal(leapDay[0].birthday?.dateLabel, '28 February');

// Turning off the birthday rule hides all birthday posts
const noBdays = socialQueue({
  ...input,
  matches: [],
  events: [],
  settings: readSocialSettings({ rules: { birthday: { on: false } } }),
  members: [{ id: 'm1', full_name: 'Rohan Gurung', date_of_birth: '2000-11-20', status: 'active', membership_status: 'approved' }],
});
assert.equal(noBdays.length, 0);

console.log('social-posts checks passed');
