// Self-check for the tournament engine: plays every format end to end.
// Run: npx esbuild lib/tournament-engine.check.ts --bundle --platform=node --log-level=warning | node
import assert from 'node:assert/strict';
import { buildTiesheet, resolveTournament, effectiveGroupRules, upgradeLegacyMatches, parseTournamentDate, compareTournamentMatches, clubLineupSide, clubSidePlayers, sideShortName, sideColor, OPPONENT_COLOR } from './tournament-engine';
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
    const next = matches.find(m => m.status === 'upcoming' && real.has(m.home_team_name) && real.has(m.away_team_name));
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

console.log('tournament engine: all formats OK');
