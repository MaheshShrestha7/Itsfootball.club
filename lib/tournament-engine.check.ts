// Self-check for the tournament engine: plays every format end to end.
// Run: npx esbuild lib/tournament-engine.check.ts --bundle --platform=node --log-level=warning | node
import assert from 'node:assert/strict';
import { buildTiesheet, resolveTournament, effectiveGroupRules, upgradeLegacyMatches, parseTournamentDate } from './tournament-engine';
import type { Match, Tournament, TournamentFormat, TournamentParticipant } from './supabase/types';

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
  for (const [g, adv] of [[1, 2], [1, 4], [2, 1], [2, 2], [3, 1], [3, 2], [4, 2], [8, 1]]) play('group_knockout', n, g, adv);
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

console.log('tournament engine: all formats OK');
