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

console.log('social-posts checks passed');
