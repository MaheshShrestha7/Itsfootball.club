import assert from 'node:assert/strict';
import { overviewRange, overviewBuckets, fillBuckets, barHeights, membersSummary, seasonRecord, upcomingGames, matchesForTeam, opponentLine, pageName, pct, playedGames, formSummary, playersNeeded, topScorers, byDay, topCleanSheets, unsavedCleanSheets, sameDayGames, lastResult, comingEvents, previousRange, compareLine } from './club-overview';
import type { ClubMember, Match, MatchEvent } from './supabase/types';

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

// Played games: finished, in the season, oldest first, with the club's side of the score
const played = playedGames(club, r);
assert.deepEqual(played.map(x => x.match.id), ['w', 'l', 'dr', 'pens']);
assert.deepEqual(played.map(x => x.outcome), ['W', 'L', 'D', 'W']);
const form = formSummary(played);
assert.equal(form.played, 4);
assert.equal(form.winRate, 50);
assert.equal(form.cleanSheets, 0);
assert.deepEqual(form.last5, ['W', 'L', 'D', 'W']);
assert.equal(form.home.played, 3);
assert.equal(form.away.lost, 1);
assert.equal(formSummary([]).winRate, 0);

assert.equal(playersNeeded('9v9'), 9);
assert.equal(playersNeeded('7v7'), 7);
assert.equal(playersNeeded(null), 11);
assert.equal(playersNeeded('weird'), 11);

// Scorers: only the club's side, goals and penalties, own goals don't count, names merged by case
const ev = (match_id: string, team_side: 'home' | 'away', event_type: string, player_name: string, assist_player_name?: string) =>
  ({ match_id, team_side, event_type, player_name, assist_player_name } as MatchEvent);
const scorers = topScorers([
  ev('w', 'home', 'goal', 'Sam Lee', 'Ana Ruiz'),
  ev('w', 'home', 'penalty', 'sam lee'),
  ev('w', 'away', 'goal', 'Their Striker'),
  ev('l', 'away', 'own_goal', 'Ana Ruiz'),
  ev('old', 'home', 'goal', 'Old Timer'),
], played);
assert.deepEqual(scorers, [{ name: 'Sam Lee', goals: 2, assists: 0 }, { name: 'Ana Ruiz', goals: 0, assists: 1 }]);

// Results grouped by local day, newest first
const days = byDay([
  { match: { match_date: '2026-09-01T01:00:00Z' } },
  { match: { match_date: '2026-09-01T03:00:00Z' } },
  { match: { match_date: '2026-09-08T01:00:00Z' } },
]);
assert.equal(days.length, 2);
assert.equal(days[0].items.length, 1);
assert.equal(days[1].items.length, 2);

// Clean sheets: saved rows for games in range, duplicates ignored, grouped by position
const kept = playedGames([
  g('cs1', { home_score: 2, away_score: 0, is_audited: true }),
  g('cs2', { is_club_home: false, home_score: 0, away_score: 1, is_audited: true }),
  g('cs3', { home_score: 1, away_score: 0 }),
  g('csOld', { season: '2025/26', home_score: 1, away_score: 0, is_audited: true }),
], r);
const squad = new Map([
  ['gk', { id: 'gk', full_name: 'Max Keeper', player_position: 'GK' as const }],
  ['cb', { id: 'cb', full_name: 'Ben Back', player_position: 'CB' as const }],
  ['lb', { id: 'lb', full_name: 'Al Left', player_position: 'LB' as const }],
]);
const rows = [
  { match_id: 'cs1', member_id: 'gk' }, { match_id: 'cs2', member_id: 'gk' }, { match_id: 'cs2', member_id: 'gk' },
  { match_id: 'cs1', member_id: 'cb' }, { match_id: 'cs2', member_id: 'lb' }, { match_id: 'cs1', member_id: 'lb' },
  { match_id: 'csOld', member_id: 'cb' }, { match_id: 'cs1', member_id: 'gone' },
];
assert.deepEqual(topCleanSheets(rows, kept, squad).map(x => [x.member.id, x.n]), [['lb', 2], ['gk', 2], ['cb', 1]]);
assert.deepEqual(topCleanSheets(rows, kept, squad, 'keepers').map(x => x.member.id), ['gk']);
assert.deepEqual(topCleanSheets(rows, kept, squad, 'defenders').map(x => x.member.id), ['lb', 'cb']);
assert.equal(unsavedCleanSheets(kept), 1);

assert.equal(pageName('/riverside', 'riverside'), 'Home page');
assert.equal(pageName('/riverside/fixtures?x=1', 'riverside'), 'Fixtures');
assert.equal(pageName('/riverside/match-reports/abc', 'riverside'), 'Match reports');
assert.equal(pct(1, 0), 0);
assert.equal(pct(1, 4), 25);

// DASH-4: the other games on the next game's day; DASH-3: the newest result of the last week
{
  const g = (id: string, at: Date, status = 'upcoming') => ({ id, match_date: at.toISOString(), status } as Match);
  const sat = [g('a', new Date(2026, 10, 7, 9, 0)), g('b', new Date(2026, 10, 7, 14, 0)), g('c', new Date(2026, 10, 7, 11, 0)), g('d', new Date(2026, 10, 8, 9, 0)), g('e', new Date(2026, 10, 7, 8, 0), 'completed')];
  assert.deepEqual(sameDayGames(sat, sat[0]).map(m => m.id), ['c', 'b']);
  const done = [g('old', new Date(2026, 9, 20, 15, 0), 'completed'), g('sun', new Date(2026, 10, 1, 15, 0), 'completed'), g('tue', new Date(2026, 10, 3, 19, 0), 'completed'), g('next', new Date(2026, 10, 7, 9, 0))];
  assert.equal(lastResult(done, now)?.id, 'tue');
  assert.equal(lastResult([done[0]], now), undefined, 'older than a week');
}
// DASH-5: training and socials in the next two weeks, not the games themselves
{
  const e = (id: string, category: string, at: Date) => ({ id, category, start_time: at.toISOString() });
  const list = [e('agm', 'agm', new Date(2026, 10, 12, 19, 0)), e('train', 'training', new Date(2026, 10, 5, 18, 0)), e('game', 'match', new Date(2026, 10, 7, 9, 0)), e('past', 'training', new Date(2026, 10, 3, 18, 0)), e('far', 'social', new Date(2026, 11, 20, 18, 0))];
  assert.deepEqual(comingEvents(list, now).map(x => x.id), ['train', 'agm']);
}
// DASH-9: the 30 days before, or the season before; nothing when this is the first season
{
  const p30 = previousRange(r30, [season])!;
  assert.equal(p30.from.getTime(), new Date(2026, 8, 6).getTime());
  assert.equal(p30.to.getTime(), r30.from.getTime());
  assert.equal(previousRange(r, [season]), null);
  const last = { name: '2025/26', start_date: '2025-07-01', end_date: '2026-06-30' };
  const ps = previousRange(r, [season, last])!;
  assert.equal(ps.season, '2025/26');
  assert.equal(ps.from.getTime(), new Date(2025, 6, 1).getTime());
  assert.equal(compareLine(15, 12, r30, p30.label), 'Up 3 on the 30 days before');
  assert.equal(compareLine(9, 12, r30, p30.label), 'Down 3 on the 30 days before');
  assert.equal(compareLine(12, 12, r30, p30.label), 'Same as the 30 days before');
  assert.equal(compareLine(15, 40, r, ps.label), '40 in season 2025/26');
}

console.log('club-overview checks passed');
