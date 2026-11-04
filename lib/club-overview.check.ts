import assert from 'node:assert/strict';
import { overviewRange, overviewBuckets, fillBuckets, barHeights, membersSummary, seasonRecord, upcomingGames, matchesForTeam, opponentLine, pageName, pct } from './club-overview';
import type { ClubMember, Match } from './supabase/types';

const now = new Date(2026, 10, 4, 12, 0).getTime(); // 4 Nov 2026, local
const season = { name: '2026/27', start_date: '2026-07-01', end_date: '2027-06-30' };

// Season range: start date to the day after the end date, filed under the season name
const r = overviewRange('season', season, now);
assert.equal(r.season, '2026/27');
assert.equal(r.from.getTime(), new Date(2026, 6, 1).getTime());
assert.equal(r.to.getTime(), new Date(2027, 6, 1).getTime());
assert.equal(r.label, 'Season 2026/27');
// No season set up: the default label from 1 August
const d = overviewRange('season', null, now);
assert.equal(d.season, '2026/27');
assert.equal(d.from.getTime(), new Date(2026, 7, 1).getTime());
// Day views: today and the days before it, no season filter
const r30 = overviewRange(30, season, now);
assert.equal(r30.season, null);
assert.equal(r30.from.getTime(), new Date(2026, 9, 6).getTime());

// Buckets: 12 months for a season with the current one marked, 30 days, 13 weeks
const months = overviewBuckets(r, now);
assert.equal(months.length, 12);
assert.equal(months.findIndex(b => b.now), 4); // November
assert.equal(overviewBuckets(r30, now).length, 30);
assert.equal(overviewBuckets(overviewRange(90, season, now), now).length, 13);

// Dated rows land in their bucket (a bare date at local midnight); out-of-range rows are dropped
const sums = fillBuckets(months, [{ at: '2026-07-01', n: 5 }, { at: '2026-11-03', n: 2 }, { at: '2026-11-04', n: 1 }, { at: '2025-01-01', n: 9 }]);
assert.equal(sums[0], 5);
assert.equal(sums[4], 3);
assert.equal(sums.reduce((a, b) => a + b, 0), 8);
assert.deepEqual(barHeights([0, 5, 10]), [0, 50, 100]);
assert.deepEqual(barHeights([0, 0]), [0, 0]);

// Members: counted as People counts them, renewals split into due and expired
const m = (id: string, over: Partial<ClubMember>): ClubMember => ({ id, club_id: 'c', full_name: id, email: '', role: 'Player', status: 'active', qr_code_token: '', membership_tier: 'Senior', membership_expires_at: '', is_executive: false, membership_status: 'approved', created_at: '2026-08-10T00:00:00Z', ...over } as ClubMember);
const people = membersSummary([
  m('a', { membership_expires_at: '2026-11-20' }),
  m('b', { role: 'supporter', membership_expires_at: '2026-10-01' }),
  m('c', { membership_status: 'pending' }),
  m('d', { membership_status: 'rejected' }),
  m('e', { created_at: '2025-08-10T00:00:00Z', membership_expires_at: '2027-08-01' }),
], r, now);
assert.equal(people.counted, 3);
assert.equal(people.players, 2);
assert.equal(people.others, 1);
assert.equal(people.added, 2);
assert.equal(people.waiting.length, 1);
assert.deepEqual(people.renewSoon.map(x => x.id), ['a']);
assert.deepEqual(people.expired.map(x => x.id), ['b']);

// Record: finished club games filed under the season; internal and tournament games don't count
const g = (id: string, over: Partial<Match>): Match => ({ id, club_id: 'c', season: '2026/27', status: 'completed', is_club_home: true, home_score: 0, away_score: 0, match_date: '2026-09-01T05:00:00Z', home_team_name: 'Us', away_team_name: 'Them', match_type: 'league', ...over } as Match);
const games = [
  g('w', { home_score: 3, away_score: 1 }),
  g('l', { is_club_home: false, home_score: 2, away_score: 0 }),
  g('dr', { home_score: 1, away_score: 1 }),
  g('pens', { home_score: 1, away_score: 1, home_penalty_score: 4, away_penalty_score: 3 }),
  g('old', { season: '2025/26', home_score: 5, away_score: 0 }),
  g('int', { match_type: 'internal', home_score: 9, away_score: 0 }),
  g('next', { status: 'upcoming', match_date: '2026-11-08T04:00:00Z', is_club_home: false, away_team_name: 'Us', home_team_name: 'Northside' }),
  g('later', { status: 'upcoming', match_date: '2026-11-15T04:00:00Z', opponent_name: 'Eastside' }),
];
const club = matchesForTeam(games, [], null);
assert.equal(club.length, 7);
const rec = seasonRecord(club, r);
assert.deepEqual(rec, { played: 4, won: 2, drawn: 1, lost: 1, goalsFor: 5, goalsAgainst: 5 });
assert.deepEqual(upcomingGames(club, 2, now).map(x => x.id), ['next', 'later']);
assert.equal(opponentLine(club.find(x => x.id === 'next')!), 'at Northside');
assert.equal(opponentLine(club.find(x => x.id === 'later')!), 'vs Eastside');

assert.equal(pageName('/riverside', 'riverside'), 'Home page');
assert.equal(pageName('/riverside/fixtures?x=1', 'riverside'), 'Fixtures');
assert.equal(pageName('/riverside/match-reports/abc', 'riverside'), 'Match reports');
assert.equal(pct(1, 0), 0);
assert.equal(pct(1, 4), 25);

console.log('club-overview checks passed');
