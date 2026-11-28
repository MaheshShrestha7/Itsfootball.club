import assert from 'node:assert/strict';
import { computeStandings } from './tournament-engine';
import { tournamentWriteup, writeupKinds } from './tournament-writeups';
import { tournamentStats } from './tournament-stats';
import type { Match, MatchEvent, TournamentParticipant } from './supabase/types';

// Four teams, two groups of two (one goes through), then the final
const teams = ['Sherpa FC', 'Everest Rovers', 'Kathmandu Lions', 'Pokhara City'].map((name, i) => ({ id: `p${i}`, tournament_id: 't', team_type: 'external', name, short_name: '', logo_url: '', group: i < 2 ? 'A' : 'B' })) as TournamentParticipant[];
let n = 0;
const game = (h: number, a: number, hs: number, as: number, stage: Match['tournament_stage'] = 'group', status: Match['status'] = 'completed', extra: Partial<Match> = {}) => ({
  id: `m${++n}`, tournament_id: 't', tournament_stage: stage, tournament_group: stage === 'group' ? `Group ${teams[h].group}` : undefined,
  home_team_name: teams[h].name, away_team_name: teams[a].name, home_score: hs, away_score: as, status, match_date: '2026-11-29', match_time: `1${n}:00`, ...extra,
}) as Match;
const ev = (match: string, side: 'home' | 'away', player: string, minute: number, type: MatchEvent['event_type'] = 'goal') =>
  ({ id: `${match}${minute}`, match_id: match, club_id: 'c', minute, team_side: side, player_name: player, event_type: type }) as MatchEvent;

const groups = [game(0, 1, 3, 0), game(2, 3, 1, 1)];
const finalUpcoming = game(0, 2, 0, 0, 'final', 'upcoming', { pitch_label: 'Pitch 1' });
const events = [
  ev('m1', 'home', 'Dawa Sherpa', 4), ev('m1', 'home', 'Dawa Sherpa', 20), ev('m1', 'home', 'Sherpa FC Player', 30),
  ev('m2', 'home', 'Rajan Shrestha', 10), ev('m2', 'away', 'Hari Pun', 12, 'penalty'),
];
const src = (matches: Match[], extra = {}) => ({
  tournament: { name: 'Harbour Cup', format: 'group_knockout' as const, venue: 'Bankstown Oval', teams_advancing_per_group: 1, player_of_tournament_name: null },
  matches, events, participants: teams,
  standings: (g?: string) => computeStandings(matches, teams, { group: g, lotSeed: 't' }),
  sponsors: [], matchHref: (m: Match) => `/c/match/${m.id}`, teamHref: (t: string) => `/c/t?team=${t}`, ...extra,
});

// Before the groups are done: nothing written
assert.deepEqual(writeupKinds([{ ...groups[0], status: 'live' }, groups[1], finalUpcoming]), []);
assert.deepEqual(writeupKinds([...groups, finalUpcoming]), ['group-stage']);
assert.equal(tournamentWriteup('final', src([...groups, finalUpcoming])), null);

const g = tournamentWriteup('group-stage', src([...groups, finalUpcoming]))!;
assert.equal(g.headline, 'Sherpa FC and Kathmandu Lions top the groups at the Harbour Cup');
assert.equal(g.lead, 'The group stage of the Harbour Cup is over: two games and five goals at Bankstown Oval. Sherpa FC won Group A and Kathmandu Lions won Group B, level on points with Pokhara City.');
assert.equal(g.paragraphs[0], '[Sherpa FC](/c/t?team=Sherpa FC) won Group A with three points from one win. Everest Rovers is out. The biggest win in the group was Sherpa FC\'s [3-0](/c/match/m1) against Everest Rovers.');
// The one-tap "Sherpa FC Player" goal has no scorer
assert.equal(g.paragraphs[2], 'Dawa Sherpa of Sherpa FC leads the scoring with two goals, ahead of Hari Pun of Pokhara City on one.');
assert.equal(g.paragraphs[3], 'The final is Sherpa FC v Kathmandu Lions at 1:00 pm on Pitch 1.');

// The final: decided on penalties, told goal by goal
const fin = { ...finalUpcoming, status: 'completed', home_score: 1, away_score: 1, home_penalty_score: 4, away_penalty_score: 3, winner_side: 'home' } as Match;
const finEvents = [...events, ev(fin.id, 'away', 'Rajan Shrestha', 5), ev(fin.id, 'home', 'Dawa Sherpa', 18)];
const done = [...groups, fin];
assert.deepEqual(writeupKinds(done), ['group-stage', 'final', 'round-up']);
const f = tournamentWriteup('final', { ...src(done), events: finEvents })!;
assert.equal(f.headline, 'Sherpa FC win the Harbour Cup');
assert.equal(f.lead, '[Sherpa FC](/c/t?team=Sherpa FC) beat Kathmandu Lions on penalties after a [1-1](/c/match/m3) draw in the final at Bankstown Oval.');
assert.equal(f.paragraphs[0], 'Rajan Shrestha opened the scoring for Kathmandu Lions after 5 minutes. Dawa Sherpa levelled for Sherpa FC on 18 minutes.');
assert.equal(f.paragraphs[1], 'Sherpa FC won the shoot-out 4-3.');
assert.equal(f.paragraphs[2], 'Sherpa FC took three points from one win in Group A.');

// The round-up ends with the thank-yous: main sponsor first, officials unnamed, every team
const r = tournamentWriteup('round-up', { ...src(done), events: finEvents, sponsors: [{ name: 'Momo House', placement: 'list' }, { name: 'Yeti Travel', placement: 'title' }] })!;
assert.equal(r.headline, 'The Harbour Cup in review');
assert.equal(r.lead, 'Four teams played three games at Bankstown Oval on Sunday 29 November, and [Sherpa FC](/c/t?team=Sherpa FC) won the cup.');
assert.equal(r.paragraphs.at(-1), 'Thank you to Yeti Travel, who presented the Harbour Cup, and to Momo House for their support. Thank you to the referees and match officials who ran all three games, and to the four teams who came to play: Sherpa FC, Everest Rovers, Kathmandu Lions and Pokhara City.');
assert.ok(r.paragraphs.includes('Four teams finished without a card.'));
assert.ok(r.paragraphs[1].includes('Dawa Sherpa of Sherpa FC finished top scorer with three goals.'));

// Junior names shortened everywhere a player is named
const j = tournamentWriteup('final', { ...src(done), events: finEvents, showName: (x: string) => x.split(' ')[0] + ' ' + x.split(' ')[1][0] + '.' })!;
assert.ok(j.paragraphs[0].startsWith('Rajan S. opened the scoring'));

// Stats
const st = tournamentStats(done, finEvents, teams);
assert.equal(st.played, 3);
assert.equal(st.goals, 7);
assert.equal(st.shootouts, 1);
assert.equal(st.unnamed, 1);
assert.deepEqual(st.scorers.map(x => [x.name, x.goals, x.pens]), [['Dawa Sherpa', 3, 0], ['Rajan Shrestha', 2, 0], ['Hari Pun', 1, 1]]);
assert.equal(st.biggestWin?.id, 'm1');
assert.equal(st.mostGoals, null); // the 3-0 is also the most goals in a game
assert.deepEqual(st.unbeaten.sort(), ['Pokhara City', 'Sherpa FC']);
assert.equal(st.fastest?.minute, 4);
assert.equal(st.cleanSheets?.teams.join(), 'Sherpa FC');

console.log('tournament-writeups ok');
