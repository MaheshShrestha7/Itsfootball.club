import assert from 'node:assert/strict';
import { cupAsks, guessFinish } from './cup-progress';
import type { Match } from './supabase/types';

const g = (id: string, over: Partial<Match> = {}) => ({
  id, event_id: 'e', team_id: 't', match_type: 'tournament', status: 'completed', is_club_home: true,
  home_score: 1, away_score: 0, match_date: `2026-11-2${id.length}T10:00:00Z`, ...over,
}) as Match;
const ev = { id: 'e', cup_format: 'group_ko' as const, completed_at: null };

assert.deepEqual(cupAsks(ev, [g('a'), g('b', { status: 'upcoming' })]), [], 'games still to play');
assert.equal(cupAsks(ev, [g('a'), g('bb')])[0].kind, 'groups');
assert.equal(cupAsks({ ...ev, cup_format: 'league' }, [g('a')]).length, 0);
assert.equal(cupAsks({ ...ev, completed_at: '2026-11-28' }, [g('a')]).length, 0);
const qf = cupAsks(ev, [g('a'), g('bb', { tournament_stage: 'quarter_final' })])[0];
assert.equal(qf.kind, 'won'); assert.equal(qf.next, 'semi_final');
assert.equal(cupAsks(ev, [g('a', { tournament_stage: 'semi_final', home_score: 1, away_score: 1 })])[0].kind, 'drew');
assert.equal(cupAsks(ev, [g('a', { tournament_stage: 'final' })]).length, 0, 'final is the end');
assert.equal(cupAsks({ ...ev, cup_format: 'knockout' }, [g('a', { home_score: 0, away_score: 2 })])[0].kind, 'lost');
// Two teams in the same cup are asked about separately
assert.equal(cupAsks(ev, [g('a'), g('bb', { team_id: 'u', status: 'upcoming' })]).length, 1);
assert.deepEqual(guessFinish(g('a', { tournament_stage: 'final', home_score: 0, away_score: 1 })), { stage: 'final' });
assert.deepEqual(guessFinish(g('a')), { stage: 'group' });
console.log('cup-progress ok');
