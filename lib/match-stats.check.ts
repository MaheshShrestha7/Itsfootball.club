// Self-check for per-match player stats (saving and fixing them).
// Run: npx esbuild lib/match-stats.check.ts --bundle --platform=node --log-level=warning | node
import assert from 'node:assert/strict';
import type { ClubScoreRuleConfig, MatchAuditPayload } from './supabase/types';
import { cleanLine, describeChange, emptyLine, isEmptyLine, lineDelta, linesFromAudit, pointChanges } from './match-stats';

const payload: MatchAuditPayload = {
  match_id: 'm1',
  clean_sheet_member_ids: ['gk'],
  motm_member_id: 'st',
  appearance_member_ids: ['gk', 'st', 'sub'],
  minutes_by_member: { gk: 90, st: 60, sub: 30 },
  audited_events: [
    { id: 'e1', minute: 10, event_type: 'goal', team_side: 'home', player_name: 'St', player_id: 'st', assist_player_id: 'sub' },
    { id: 'e2', minute: 20, event_type: 'penalty', team_side: 'home', player_name: 'St', player_id: 'st' },
    { id: 'e3', minute: 30, event_type: 'yellow_card', team_side: 'home', player_name: 'Gk', player_id: 'gk' },
    { id: 'e4', minute: 40, event_type: 'goal', team_side: 'home', player_name: 'Unknown' },
  ],
  notes: '',
};
const lines = linesFromAudit(payload);
const by = (id: string) => lines.find(l => l.member_id === id)!;
assert.equal(lines.length, 3);
assert.deepEqual(by('st'), { member_id: 'st', played: true, minutes: 60, goals: 2, assists: 0, yellow_cards: 0, red_cards: 0, clean_sheet: false, motm: true });
assert.deepEqual(by('gk'), { member_id: 'gk', played: true, minutes: 90, goals: 0, assists: 0, yellow_cards: 1, red_cards: 0, clean_sheet: true, motm: false });
assert.equal(by('sub').assists, 1);

// Deltas move season totals by the difference only
const fixed = { ...by('sub'), minutes: 35, assists: 0, goals: 1 };
assert.deepEqual(lineDelta(by('sub'), fixed), { minutes_played: 5, goals: 1, assists: -1 });
assert.deepEqual(lineDelta(by('st'), by('st')), {});
assert.deepEqual(lineDelta(by('gk'), emptyLine('gk')), { appearances: -1, minutes_played: -90, yellow_cards: -1, clean_sheets: -1 });

// Points: one award per unit, negative when taken away; minutes alone give none
const rules = { points_match_appearance: 5, points_goal_forward: 10, points_goal_defender: 15, points_assist: 7, points_yellow_card_penalty: -3, points_red_card_penalty: -10, points_clean_sheet_gk_def: 10, points_motm: 15 } as ClubScoreRuleConfig;
assert.deepEqual(pointChanges(by('sub'), fixed, rules).map(c => [c.event_type, c.points]), [['match_goal', 10], ['match_assist', -7]]);
assert.deepEqual(pointChanges(by('gk'), emptyLine('gk'), rules, 'GK').map(c => c.points), [-5, 3, -10]);
assert.deepEqual(pointChanges(by('st'), { ...by('st'), goals: 0 }, rules).map(c => c.points), [-10, -10]);
assert.deepEqual(pointChanges(by('st'), { ...by('st'), minutes: 90 }, rules), []);

// Words and limits
assert.deepEqual(describeChange(by('sub'), fixed), ['minutes 30 → 35', 'goals 0 → 1', 'assists 1 → 0']);
assert.deepEqual(describeChange(by('gk'), { ...by('gk'), clean_sheet: false }), ['clean sheet taken off']);
assert.deepEqual(cleanLine({ ...emptyLine('x'), minutes: -4, yellow_cards: 7, goals: 2.6 }), { ...emptyLine('x'), minutes: 0, yellow_cards: 2, goals: 3 });
assert.equal(isEmptyLine(emptyLine('x')), true);
assert.equal(isEmptyLine(by('sub')), false);

console.log('match-stats checks passed');
