// Self-check for the tournament engine: plays every format end to end.
// Run: npx esbuild lib/tournament-engine.check.ts --bundle --platform=node --log-level=warning | node
import assert from 'node:assert/strict';
import { buildTiesheet, shuffleUnseeded, resolveTournament, effectiveGroupRules, upgradeLegacyMatches, parseTournamentDate, compareTournamentMatches, clubLineupSide, fixtureWhenLabel, clubSidePlayers, sideShortName, sideColor, OPPONENT_COLOR, tournamentMatchLabel, runSheetMove, computeStandings, tieBreakerLine, knockoutLockReason, knockoutStarted, tournamentHalfMinutes } from './tournament-engine';
import type { ClubMember, InternalTeam, Match, Tournament, TournamentFormat, TournamentParticipant } from './supabase/types';

function play(format: TournamentFormat, teams: number, groupCount = 2, advancing = 2, thirdPlace = true) {
  const t: Tournament = {
    id: `t-${format}-${teams}-${groupCount}-${advancing}`, club_id: 'c', name: 'Cup', slug: 'cup', season: '2026',
    format, status: 'draft', points_win: 3, points_draw: 1, points_loss: 0,
    group_count: groupCount, teams_advancing_per_group: advancing, has_third_place_match: thirdPlace,
    start_date: new Date(2026, 9, 3, 14, 30).toISOString(), end_date: new Date(2026, 9, 31, 14, 30).toISOString(),
  };
  const parts: TournamentParticipant[] = Array.from({ length: teams }, (_, i) => ({
    id: `p${i}`, tournament_id: t.id, team_type: 'internal', name: `Team ${i + 1}`, short_name: `T${i + 1}`, logo_url: '',
  }));
  const res = buildTiesheet({ ...t }, parts);
  const tourney = { ...t, ...res.tournamentUpdates };
  let matches: Match[] = res.matches;
  const label = `${format} ${teams} teams (${groupCount}g/${advancing}adv)`;

  assert.equal(new Set(matches.map(m => m.id)).size, matches.length, `${label}: duplicate ids`);
  assert.equal(matches[0]?.match_date, '2026-10-03', `${label}: first fixture on start date`);
  assert.equal(matches[0]?.match_time, '14:30', `${label}: kick-off from start time`);
  assert.ok(matches.every(m => m.match_date <= '2026-10-31'), `${label}: fixture after end date`);

  const real = new Set(parts.map(p => p.name));
  for (let guard = 0; guard < 500; guard++) {
    // Only games the knockout lock lets through: every format must still play to the end
    const next = matches.find(m => m.status === 'upcoming' && real.has(m.home_team_name) && real.has(m.away_team_name)
      && !knockoutLockReason(m, tourney, matches, false));
    if (!next) break;
    const ko = next.tournament_stage !== 'group';
    const h = (next.tournament_match_number! * 7) % 4;
    const a = ko ? h : (next.tournament_match_number! * 3) % 3; // knockout: always level, decided on pens
    matches = matches.map(m => m.id === next.id
      ? { ...m, status: 'completed', home_score: h, away_score: a, ...(ko ? { home_penalty_score: 5, away_penalty_score: 4 } : {}) }
      : m);
    matches = resolveTournament(matches, tourney, res.participants);
  }

  const stuck = matches.filter(m => m.status !== 'completed');
  assert.equal(stuck.length, 0, `${label}: unplayable ${stuck.map(m => `${m.title} ${m.home_team_name} v ${m.away_team_name}`).join(', ')}`);

  if (format === 'league') {
    assert.equal(matches.length, (teams * (teams - 1)) / 2, `${label}: league fixture count`);
    const pairs = new Set(matches.map(m => [m.home_team_name, m.away_team_name].sort().join('|')));
    assert.equal(pairs.size, matches.length, `${label}: pair played twice`);
  } else {
    const final = matches.find(m => m.tournament_stage === 'final');
    assert.ok(final?.winner_side, `${label}: final has a winner`);
    const koTeams = format === 'knockout' ? teams : effectiveGroupRules(tourney, teams).groupCount * effectiveGroupRules(tourney, teams).advancing;
    const third = matches.find(m => m.tournament_stage === 'third_place');
    if (thirdPlace && koTeams >= 4) assert.ok(third?.winner_side, `${label}: 3rd place played`);
    if (format === 'knockout') {
      const koMatches = matches.filter(m => m.tournament_stage !== 'third_place');
      assert.equal(koMatches.length, teams - 1, `${label}: n-1 knockout matches`);
    }
  }
}

for (let n = 2; n <= 17; n++) {
  play('knockout', n);
  play('knockout', n, 2, 2, false);
  play('league', n);
  for (const [g, adv] of [[1, 2], [1, 3], [1, 4], [2, 1], [2, 2], [3, 1], [3, 2], [4, 2], [8, 1]]) play('group_knockout', n, g, adv);
}
// League + top-3 playoff: 1st waits in the Grand Final, 2nd v 3rd in the only semi
{
  const t = { id: 'top3', club_id: 'c', name: 'Top 3', slug: 't3', season: '2026', format: 'group_knockout', status: 'draft',
    points_win: 3, points_draw: 1, points_loss: 0, group_count: 1, teams_advancing_per_group: 3, has_third_place_match: true, start_date: '2026-10-03' } as Tournament;
  const parts = Array.from({ length: 6 }, (_, i) => ({ id: `q${i}`, tournament_id: 'top3', team_type: 'internal', name: `Q${i}`, short_name: `Q${i}`, logo_url: '' })) as TournamentParticipant[];
  const ko = buildTiesheet(t, parts).matches.filter(m => m.tournament_stage !== 'group');
  assert.deepEqual(ko.map(m => [m.tournament_stage, m.title, m.home_team_source, m.away_team_source]), [
    ['semi_final', 'Semi-Finals • Match 1', '2nd Group A', '3rd Group A'],
    ['final', 'Grand Final', '1st Group A', `Winner M#${ko[0].tournament_match_number}`],
  ], 'top-3 playoff shape');
}
// Legacy bracket: old 3rd place sources get upgraded, and repair is idempotent
{
  const t = {
    id: 'legacy', club_id: 'c', name: 'Old Cup', slug: 'old', season: '2025', format: 'knockout', status: 'ongoing',
    points_win: 3, points_draw: 1, points_loss: 0, has_third_place_match: true, start_date: '2025-05-01',
  } as Tournament;
  const parts = ['A', 'B', 'C', 'D'].map((n, i) => ({ id: `l${i}`, tournament_id: 'legacy', team_type: 'internal', name: n, short_name: n, logo_url: '' })) as TournamentParticipant[];
  let matches = buildTiesheet(t, parts).matches.map(m =>
    m.tournament_stage === 'third_place' ? { ...m, home_team_source: 'Loser Semi #1', away_team_source: 'Loser Semi #2' } : m
  );
  matches = matches.map(m => (m.tournament_stage === 'semi_final' ? { ...m, status: 'completed' as const, home_score: 2, away_score: 1 } : m));
  const repaired = resolveTournament(upgradeLegacyMatches(matches), t, parts);
  const third = repaired.find(m => m.tournament_stage === 'third_place')!;
  assert.ok(parts.some(p => p.name === third.home_team_name) && parts.some(p => p.name === third.away_team_name), 'legacy 3rd place filled');
  assert.equal(parseTournamentDate('2025-05-01')!.getHours(), 15, 'date-only start defaults to 15:00');
  const again = resolveTournament(upgradeLegacyMatches(repaired), t, parts);
  assert.equal(JSON.stringify(again), JSON.stringify(repaired), 'repair is idempotent');
}

// Fixture lists run Round 1, Round 2, ... even when later rounds kick off earlier or groups interleave
{
  const fx = (id: string, stage: Match['tournament_stage'], round: number, date: string, n: number) =>
    ({ id, tournament_stage: stage, tournament_round: round, match_date: date, match_time: '10:00', tournament_match_number: n }) as Match;
  const order = [
    fx('final', 'final', 3, '2026-10-01', 9),
    fx('gB-r2', 'group', 2, '2026-10-02', 8),
    fx('gA-r2', 'group', 2, '2026-10-02', 3),
    fx('gB-r1', 'group', 1, '2026-10-05', 6),
    fx('gA-r1', 'group', 1, '2026-10-05', 1),
    fx('third', 'third_place', 3, '2026-10-01', 10),
    fx('semi', 'semi_final', 2, '2026-09-30', 7),
  ].sort(compareTournamentMatches).map(m => m.id);
  assert.deepEqual(order, ['gA-r1', 'gB-r1', 'gA-r2', 'gB-r2', 'semi', 'third', 'final'], 'fixture order by stage then round');
}

// Match center: which sides field the club's own players
{
  const squad = ['a', 'b', 'c', 'd'].map(id => ({ id }) as ClubMember);
  const ids = (list: ClubMember[] | null) => list && list.map(p => p.id);
  const teams = [
    { id: 'it1', player_ids: ['a', 'b'] },
    { id: 'it2', player_ids: ['c'] },
    { id: 'it3', player_ids: [] },
  ] as unknown as InternalTeam[];
  const parts = [
    { tournament_id: 't', team_type: 'internal', internal_team_id: 'it1', name: 'Reds' },
    { tournament_id: 't', team_type: 'internal', internal_team_id: 'it2', name: 'Blues' },
    { tournament_id: 't', team_type: 'internal', internal_team_id: 'it3', name: 'Greens' },
    { tournament_id: 't', team_type: 'external', name: 'Visitors' },
    { tournament_id: 'other', team_type: 'internal', internal_team_id: 'it2', name: 'Reds' },
  ] as TournamentParticipant[];
  const tm = (home: string, away: string) =>
    ({ tournament_id: 't', is_club_home: true, home_team_name: home, away_team_name: away }) as Match;
  const side = (m: Match, s: 'home' | 'away') => ids(clubSidePlayers(m, s, squad, parts, teams));

  assert.deepEqual(side(tm('Reds', 'Blues'), 'home'), ['a', 'b'], 'internal home team fields its roster');
  assert.deepEqual(side(tm('Reds', 'Blues'), 'away'), ['c'], 'internal away team is not "opponent"');
  assert.deepEqual(side(tm('Greens', 'Reds'), 'home'), ['a', 'b', 'c', 'd'], 'team with no roster falls back to squad');
  assert.equal(side(tm('Reds', 'Visitors'), 'away'), null, 'external participant is an opponent');
  assert.equal(side(tm('TBD', 'Reds'), 'home'), null, 'unfilled knockout slot is nobody yet');
  const league = (isHome: boolean) => ({ is_club_home: isHome, home_team_name: 'Club', away_team_name: 'Rivals' }) as Match;
  assert.deepEqual([side(league(true), 'home'), side(league(true), 'away')], [['a', 'b', 'c', 'd'], null], 'club at home');
  assert.deepEqual([side(league(false), 'home'), side(league(false), 'away')], [null, ['a', 'b', 'c', 'd']], 'club away');
  const intra = { match_type: 'internal', is_club_home: true } as Match;
  assert.ok(side(intra, 'home') && side(intra, 'away'), 'internal friendly: both sides are the club');

  // Mobile scoreboard short names: tournament sides are never the club's own short name
  const shortParts = [
    { tournament_id: 't', name: 'Red Lions', short_name: 'RDL' },
    { tournament_id: 't', name: 'Blue Hawks', short_name: '' },
  ] as TournamentParticipant[];
  const short = (m: Match) => [sideShortName(m, 'home', 'ITS', shortParts), sideShortName(m, 'away', 'ITS', shortParts)];
  assert.deepEqual(short(tm('Red Lions', 'Blue Hawks')), ['RDL', 'BH'], 'tournament: participant short name, else initials');
  assert.deepEqual(short(tm('Blue Hawks', 'Red Lions')), ['BH', 'RDL'], 'tournament: home side is not the club');
  const fixture = (isHome: boolean) => ({ is_club_home: isHome, home_team_name: isHome ? 'Its FC' : 'Rival Town', away_team_name: isHome ? 'Rival Town' : 'Its FC', opponent_short_name: 'RVT' }) as Match;
  assert.deepEqual(short(fixture(true)), ['ITS', 'RVT'], 'league: club at home');
  assert.deepEqual(short(fixture(false)), ['RVT', 'ITS'], 'league: club away');

  // Side colors: the club's color follows the club's side; tournament teams use their own
  const colorParts = [
    { tournament_id: 't', name: 'Red Lions', color: '#DC2626' },
    { tournament_id: 't', name: 'Blue Hawks', internal_team_id: 'it9' },
    { tournament_id: 't', name: 'Odd Ones', color: 'red' },
  ] as TournamentParticipant[];
  const colorTeams = [{ id: 'it9', color: '#1D4ED8' }] as InternalTeam[];
  const color = (m: Match) => [sideColor(m, 'home', '#E11D48', colorParts, colorTeams), sideColor(m, 'away', '#E11D48', colorParts, colorTeams)];
  assert.deepEqual(color(fixture(true)), ['#E11D48', OPPONENT_COLOR], 'league: club at home wears club color');
  assert.deepEqual(color(fixture(false)), [OPPONENT_COLOR, '#E11D48'], 'league: club away, opponent at home is not club-colored');
  assert.deepEqual(color(tm('Blue Hawks', 'Red Lions')), ['#1D4ED8', '#DC2626'], 'tournament: participant color, else internal team color');
  assert.deepEqual(color(tm('Odd Ones', 'Nobody')), ['#E11D48', OPPONENT_COLOR], 'tournament: non-hex or missing color falls back');
}

// The club lineup is saved on, and read from, the club's own side
{
  const m = (o: Partial<Match>) => ({ id: 'm', club_id: 'c', ...o }) as Match;
  assert.equal(clubLineupSide(m({ match_type: 'friendly', is_club_home: false })), 'away', 'away fixture: away columns');
  assert.equal(clubLineupSide(m({ match_type: 'friendly', is_club_home: true })), 'home');
  assert.equal(clubLineupSide(m({ match_type: 'friendly' })), 'home', 'unset is_club_home means home');
  assert.equal(clubLineupSide(m({ match_type: 'tournament', is_club_home: false, tournament_id: 't' })), 'home', 'tournament: home');
  assert.equal(clubLineupSide(m({ match_type: 'internal', is_club_home: false })), 'home', 'internal: home');
}

// Title labels: the two Dashain Cup meetings of the same teams on the same day must differ
assert.equal(tournamentMatchLabel({ tournament_id: 't', tournament_stage: 'semi_final', tournament_round: 1 }), 'Semi-Final');
assert.equal(tournamentMatchLabel({ tournament_id: 't', tournament_stage: 'group', tournament_round: 1 }), 'Round 1');
assert.equal(tournamentMatchLabel({ tournament_id: 't', tournament_stage: 'final', tournament_round: 2 }), 'Grand Final');
assert.equal(tournamentMatchLabel({ tournament_id: 't', tournament_stage: 'quarter_final' }), 'Quarter-Final');
assert.equal(tournamentMatchLabel({ tournament_id: 't', tournament_stage: null, tournament_round: null }), null);
assert.equal(tournamentMatchLabel({ tournament_id: null, tournament_stage: 'final' }), null);

// One-day tournament: kick-offs spread over pitches, round by round (PUB-B7 / N3)
{
  const day = new Date(2026, 9, 24, 9, 0).toISOString();
  const t: Tournament = { id: 't-day', club_id: 'c', name: 'Gala', slug: 'gala', season: '2026', format: 'knockout', status: 'draft',
    points_win: 3, points_draw: 1, points_loss: 0, has_third_place_match: false, start_date: day, end_date: day };
  const parts: TournamentParticipant[] = Array.from({ length: 8 }, (_, i) => ({ id: `d${i}`, tournament_id: 't-day', team_type: 'external', name: `Side ${i + 1}`, short_name: `S${i + 1}`, logo_url: '' }));
  const same = buildTiesheet(t, parts).matches;
  assert.ok(same.every(m => m.match_time === '09:00'), 'no match length: everyone at the start (as before)');
  const ms = buildTiesheet(t, parts, { matchMinutes: 20, pitches: 2 }).matches.sort(compareTournamentMatches);
  const qf = ms.filter(m => m.tournament_stage === 'quarter_final');
  assert.deepEqual(qf.map(m => `${m.match_time} ${m.pitch_label}`), ['09:00 Pitch 1', '09:00 Pitch 2', '09:20 Pitch 1', '09:20 Pitch 2']);
  assert.deepEqual(ms.filter(m => m.tournament_stage === 'semi_final').map(m => m.match_time), ['09:40', '09:40'], 'semis after the quarters');
  assert.equal(ms.find(m => m.tournament_stage === 'final')!.match_time, '10:00');
  const one = buildTiesheet(t, parts, { matchMinutes: 15 }).matches.sort(compareTournamentMatches);
  assert.deepEqual(one.map(m => m.match_time), ['09:00', '09:15', '09:30', '09:45', '10:00', '10:15', '10:30'], 'one pitch: one after another');
  assert.ok(one.every(m => !m.pitch_label), 'no pitch labels with one pitch');
}
assert.equal(fixtureWhenLabel({ match_date: '2026-10-24', match_time: '09:00' }), 'Sat, 24 Oct · 9:00 am');
assert.equal(fixtureWhenLabel({ match_date: '2026-10-24', match_time: '' }), 'Sat, 24 Oct');
assert.equal(fixtureWhenLabel({ match_date: '', match_time: '' }), 'TBD');

console.log('tournament engine: all formats OK');

{
  // Groups set by hand survive a redraw with keepGroups; uneven groups cap who goes through
  const t = { id: 'kg', club_id: 'c', name: 'Cup', slug: 'cup', season: '2026', format: 'group_knockout', status: 'draft', points_win: 3, points_draw: 1, points_loss: 0, group_count: 2, teams_advancing_per_group: 3 } as Tournament;
  const parts = Array.from({ length: 6 }, (_, i) => ({ id: `k${i}`, tournament_id: 'kg', team_type: 'external', name: `K${i}`, group: i < 4 ? 'A' : 'B' })) as TournamentParticipant[];
  const kept = buildTiesheet(t, parts, { keepGroups: true });
  assert.deepEqual(kept.participants.map(p => p.group), ['A', 'A', 'A', 'A', 'B', 'B']);
  assert.ok(kept.matches.filter(m => m.tournament_group === 'B').every(m => ['K4', 'K5'].includes(m.home_team_name)));
  assert.equal(kept.tournamentUpdates.teams_advancing_per_group, 2);
  assert.notDeepEqual(buildTiesheet(t, parts).participants.map(p => p.group), ['A', 'A', 'A', 'A', 'B', 'B']);
  // A group with one team can't be kept: deal again
  const lone = parts.map((p, i) => ({ ...p, group: i < 5 ? 'A' : 'B' }));
  assert.deepEqual(buildTiesheet(t, lone, { keepGroups: true }).participants.map(p => p.group), ['A', 'B', 'A', 'B', 'A', 'B']);
}

// Run sheet: a dragged game takes the target's place and the ones between shift by one
assert.deepEqual(runSheetMove(['a', 'b', 'c', 'd'], 0, 2), ['b', 'c', 'a', 'd']);
assert.deepEqual(runSheetMove(['a', 'b', 'c', 'd'], 3, 1), ['a', 'd', 'b', 'c']);
assert.deepEqual(runSheetMove(['a', 'b'], 0, 5), ['a', 'b'], 'out of range: unchanged');

{
  // Tie-breakers: A, M and S beat each other in a circle and all beat X, so all three have 6 points
  const T = ['A', 'M', 'S', 'X'];
  const parts = T.map((name, i) => ({ id: `t${i}`, tournament_id: 'tb', team_type: 'external', name, short_name: name })) as TournamentParticipant[];
  const ms = ([[0, 1, 1, 0], [1, 2, 2, 1], [2, 0, 1, 0], [0, 3, 4, 0], [1, 3, 5, 1], [2, 3, 3, 2]] as const).map(([h, a, hs, as], i) => ({
    id: `m${i}`, tournament_id: 'tb', tournament_stage: 'group', status: 'completed', match_date: '2026-12-05',
    home_team_name: T[h], away_team_name: T[a], home_score: hs, away_score: as,
  })) as Match[];
  const order = (tb?: Parameters<typeof computeStandings>[2]) => computeStandings(ms, parts, tb).map(s => s.name).join('');
  // A and M: +4 each; M scored 7, A 5; S +1
  assert.equal(order(), 'MASX', 'standard: goal difference, then goals scored');
  assert.equal(order({ tieBreakers: ['gd', 'h2h'] }), 'AMSX', 'head-to-head only between the teams still level (A beat M)');
  assert.equal(order({ tieBreakers: ['h2h', 'gd', 'gf'] }), 'MASX', 'a circle of results leaves head-to-head level');
  assert.equal(order({ tieBreakers: [] }), 'AMSX', 'points only: level teams A to Z');
  const cards = new Map([['A', 1], ['M', 4], ['S', 0]]);
  assert.equal(order({ tieBreakers: ['fair_play'], cardPoints: cards }), 'SAMX', 'fewest card points first');
  assert.equal(order({ tieBreakers: ['lots'], lotSeed: 'cup' }), order({ tieBreakers: ['lots'], lotSeed: 'cup' }), 'lots stay the same');
  assert.equal(tieBreakerLine(null), 'Level on points? Decided by goal difference, then goals scored, then head-to-head.');
  assert.equal(tieBreakerLine([]), 'Teams level on points share the place.');
}

// Knockout lock: group games first, then the host's start, then each round after the games that feed it
{
  const t = { id: 'lock', club_id: 'c', name: 'Lock Cup', slug: 'lock', season: '2026', format: 'group_knockout', status: 'draft',
    points_win: 3, points_draw: 1, points_loss: 0, group_count: 2, teams_advancing_per_group: 2, has_third_place_match: true, start_date: '2026-10-03' } as Tournament;
  const parts = Array.from({ length: 8 }, (_, i) => ({ id: `l${i}`, tournament_id: 'lock', team_type: 'internal', name: `L${i}`, short_name: `L${i}`, logo_url: '' })) as TournamentParticipant[];
  const res = buildTiesheet(t, parts);
  const tour = { ...t, ...res.tournamentUpdates };
  let ms = res.matches;
  const semi = () => ms.find(m => m.tournament_stage === 'semi_final')!;
  const final = () => ms.find(m => m.tournament_stage === 'final')!;
  const finish = (id: string) => {
    ms = resolveTournament(ms.map(m => m.id === id ? { ...m, status: 'completed', home_score: 2, away_score: 1 } : m), tour, res.participants);
  };
  const groups = ms.filter(m => m.tournament_stage === 'group');
  groups.slice(0, -1).forEach(g => finish(g.id));
  assert.match(knockoutLockReason(semi(), tour, ms)!, /1 group game still to finish/);
  finish(groups[groups.length - 1].id);
  assert.match(knockoutLockReason(semi(), tour, ms)!, /Start the knockout stage/, 'groups done: waits for the host');
  assert.equal(knockoutLockReason(semi(), tour, ms, false), null, 'before the migration: opens by itself');
  assert.equal(knockoutStarted(tour, ms), false);
  // With the column: the group tables only fill the knockout games once the host confirms them
  const waiting = { ...tour, knockout_started_at: null } as unknown as Tournament;
  const held = resolveTournament(ms, waiting, res.participants);
  const heldSemi = held.find(m => m.id === semi().id)!;
  assert.equal(heldSemi.home_team_name, heldSemi.home_team_source, 'not confirmed: still "1st Group A"');
  assert.match(knockoutLockReason(heldSemi, { ...waiting, knockout_started_at: '2026-10-04T00:00:00Z' }, held)!, /teams for this game are not set/, 'never scored with a placeholder side');
  const named = resolveTournament(held, { ...waiting, knockout_started_at: '2026-10-04T00:00:00Z' }, res.participants).find(m => m.id === semi().id)!;
  assert.notEqual(named.home_team_name, named.home_team_source, 'confirmed: the team name goes in');
  const started = { ...tour, knockout_started_at: '2026-10-04T00:00:00Z' };
  assert.equal(knockoutLockReason(semi(), started, ms), null, 'started: semi open');
  assert.match(knockoutLockReason(final(), started, ms)!, /Waiting for M#/, 'final waits for both semis');
  const semis = ms.filter(m => m.tournament_stage === 'semi_final');
  finish(semis[0].id);
  assert.match(knockoutLockReason(final(), started, ms)!, /Waiting for M#/, 'final waits for the second semi');
  finish(semis[1].id);
  assert.equal(knockoutLockReason(final(), started, ms), null, 'both semis done: final open');
  assert.equal(knockoutStarted(tour, ms), true, 'a played knockout game counts as started (older tournaments)');
  // A game already under way is never locked
  assert.equal(knockoutLockReason({ ...final(), status: 'live' }, tour, ms.map(m => m.tournament_stage === 'semi_final' ? { ...m, status: 'upcoming' } : m)), null);
}

// Game length per stage: group games 2 x 10, knockout 2 x 15; knockout empty = the group length
{
  const tour = {
    id: 't-len', club_id: 'c', name: 'Cup', slug: 'cup', season: '2026', format: 'group_knockout', status: 'draft',
    points_win: 3, points_draw: 1, points_loss: 0, group_count: 2, teams_advancing_per_group: 2, has_third_place_match: false,
    start_date: '2026-11-28T08:00:00', half_minutes: 10, ko_half_minutes: 15,
  } as Tournament;
  const teams: TournamentParticipant[] = Array.from({ length: 8 }, (_, i) => ({ id: `p${i}`, tournament_id: 't-len', team_type: 'external' as const, name: `T${i}`, short_name: `T${i}`, logo_url: '' }));
  const ms = buildTiesheet(tour, teams).matches;
  assert.ok(ms.filter(m => m.tournament_stage === 'group').every(m => m.half_minutes === 10), 'group games 2 x 10');
  assert.ok(ms.filter(m => m.tournament_stage !== 'group').every(m => m.half_minutes === 15), 'knockout games 2 x 15');
  assert.ok(buildTiesheet({ ...tour, ko_half_minutes: null }, teams).matches.every(m => m.half_minutes === 10), 'knockout empty = group length');
  assert.ok(buildTiesheet({ ...tour, half_minutes: null, ko_half_minutes: null }, teams).matches.every(m => m.half_minutes === undefined), 'nothing set: the usual 2 x 45');
  assert.equal(tournamentHalfMinutes({ half_minutes: null, ko_half_minutes: 20 }, 'final'), 20, 'knockout-only cup');
  const withFinal = buildTiesheet({ ...tour, final_half_minutes: 20 }, teams).matches;
  assert.ok(withFinal.find(m => m.tournament_stage === 'final')!.half_minutes === 20, 'final 2 x 20');
  assert.ok(withFinal.filter(m => m.tournament_stage === 'semi_final').every(m => m.half_minutes === 15), 'semis stay 2 x 15');

  // Form column in play order: same date, the kick-off time decides (round 2 played first here)
  const g = (id: string, home: string, away: string, time: string, round: number, hs: number, as: number) =>
    ({ id, tournament_id: 't-len', tournament_stage: 'group', tournament_group: 'Group A', tournament_round: round, match_date: '2026-11-28', match_time: time, home_team_name: home, away_team_name: away, status: 'completed', home_score: hs, away_score: as } as Match);
  const parts = ['A', 'B', 'C'].map(n => ({ id: n, tournament_id: 't-len', team_type: 'external' as const, name: n, group: 'A' }));
  const table = computeStandings([g('1', 'A', 'B', '10:30', 1, 0, 1), g('2', 'A', 'C', '08:00', 2, 2, 0)], parts as TournamentParticipant[], { group: 'A' });
  assert.deepEqual(table.find(r => r.name === 'A')!.form, ['W', 'L'], 'form follows kick-off time');
}
console.log('tournament engine: game length + form order OK');

// Seeds are optional: hand-set seeds lead the draw, nobody gets a made-up seed, no "Seed #N" on the bracket
{
  const cup = { id: 't-seed', club_id: 'c', name: 'Cup', season: '2026', format: 'knockout', status: 'draft', points_win: 3, points_draw: 1, points_loss: 0, start_date: '2026-12-01T09:00:00Z', end_date: '2026-12-01T17:00:00Z' } as Tournament;
  const teams = ['A', 'B', 'C', 'D'].map((n, i) => ({ id: n, tournament_id: 't-seed', team_type: 'external' as const, name: n, short_name: n, logo_url: '', seed: n === 'C' ? 1 : undefined, _i: i }));
  const sheet = buildTiesheet(cup, teams);
  assert.equal(sheet.participants[0].name, 'C', 'seed 1 goes first');
  assert.deepEqual(sheet.participants.map(p => p.seed ?? null), [1, null, null, null], 'no invented seeds');
  assert.ok(sheet.matches.every(m => !m.home_team_source?.startsWith('Seed') && !m.away_team_source?.startsWith('Seed')), 'no seed labels');
  const mixed = shuffleUnseeded(teams);
  assert.deepEqual(mixed.map(t => t.name).sort(), ['A', 'B', 'C', 'D'], 'shuffle keeps every team');
}
console.log('tournament engine: optional seeds OK');
