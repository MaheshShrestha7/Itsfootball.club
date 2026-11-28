import assert from 'node:assert/strict';
import { asLinkedGame } from './tournament-links';
import type { Match } from './supabase/types';

const m = (home: string, away: string) => ({ id: 'm1', club_id: 'host', home_team_name: home, away_team_name: away, opponent_name: 'x', is_club_home: true } as unknown as Match);

const home = asLinkedGame(m('ANCC FC U12', 'Gorkhali XI FC'), 'ANCC FC U12', 'u12', 'gorkhali');
assert.equal(home?.is_club_home, true);
assert.equal(home?.opponent_name, 'Gorkhali XI FC', 'opponent is the other side');
assert.equal(home?.team_id, 'u12');
assert.equal(home?.hostSlug, 'gorkhali');

const away = asLinkedGame(m('Sherpa FC', ' ancc fc u12 '), 'ANCC FC U12', null, 'gorkhali');
assert.equal(away?.is_club_home, false, 'away side, name match ignores case and spaces');
assert.equal(away?.opponent_name, 'Sherpa FC');

assert.equal(asLinkedGame(m('Sherpa FC', 'Himalayan United'), 'ANCC FC U12', null, 'g'), null, 'not our game');
assert.equal(asLinkedGame(m('Winner SF1', 'Winner SF2'), 'ANCC FC U12', null, 'g'), null, 'knockout slot not filled yet');
console.log('tournament-links ok');
