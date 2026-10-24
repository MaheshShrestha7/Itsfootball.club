// What each player got from one match (match_player_stats, migration 20261121): built when a
// match's stats are saved, and compared with an edited copy when they are fixed later, so season
// totals and ClubScore points move by exactly the difference.
import type { ClubScoreRuleConfig, MatchAuditPayload, PlayerPosition } from './supabase/types';
import type { StatsDelta } from './player-stats';
import { getGoalPointsForPosition } from './clubscore-defaults';

export interface MatchStatLine {
  member_id: string;
  played: boolean;
  minutes: number;
  goals: number;
  assists: number;
  yellow_cards: number;
  red_cards: number;
  clean_sheet: boolean;
  motm: boolean;
}

export const emptyLine = (memberId: string): MatchStatLine => ({
  member_id: memberId, played: false, minutes: 0, goals: 0, assists: 0, yellow_cards: 0, red_cards: 0, clean_sheet: false, motm: false,
});

/** A line with nothing in it (no need to keep a row for it) */
export const isEmptyLine = (l: MatchStatLine) =>
  !l.played && !l.minutes && !l.goals && !l.assists && !l.yellow_cards && !l.red_cards && !l.clean_sheet && !l.motm;

/** One line per player from what the Save Player Stats screen saves (same rules as auditAndBakeMatchStats) */
export function linesFromAudit(payload: MatchAuditPayload): MatchStatLine[] {
  const lines = new Map<string, MatchStatLine>();
  const line = (id: string) => { if (!lines.has(id)) lines.set(id, emptyLine(id)); return lines.get(id)!; };
  payload.clean_sheet_member_ids.forEach(id => { line(id).clean_sheet = true; });
  if (payload.motm_member_id) line(payload.motm_member_id).motm = true;
  payload.audited_events.forEach(e => {
    if (e.player_id) {
      if (e.event_type === 'goal' || e.event_type === 'penalty') line(e.player_id).goals += 1;
      else if (e.event_type === 'yellow_card') line(e.player_id).yellow_cards += 1;
      else if (e.event_type === 'red_card') line(e.player_id).red_cards += 1;
    }
    if (e.assist_player_id) line(e.assist_player_id).assists += 1;
  });
  payload.appearance_member_ids.forEach(id => {
    const l = line(id);
    l.played = true;
    l.minutes = payload.minutes_by_member?.[id] ?? 0;
  });
  return [...lines.values()];
}

/** Season-total change from `before` to `after` for one player */
export function lineDelta(before: MatchStatLine, after: MatchStatLine): StatsDelta {
  const delta: StatsDelta = {};
  const set = (k: keyof StatsDelta, d: number) => { if (d) delta[k] = d; };
  set('appearances', Number(after.played) - Number(before.played));
  set('minutes_played', after.minutes - before.minutes);
  set('goals', after.goals - before.goals);
  set('assists', after.assists - before.assists);
  set('yellow_cards', after.yellow_cards - before.yellow_cards);
  set('red_cards', after.red_cards - before.red_cards);
  set('clean_sheets', Number(after.clean_sheet) - Number(before.clean_sheet));
  set('motm_awards', Number(after.motm) - Number(before.motm));
  return delta;
}

export type MatchAwardType = 'match_appearance' | 'match_goal' | 'match_assist' | 'match_clean_sheet' | 'match_motm' | 'disciplinary_card';

export interface PointChange { event_type: MatchAwardType; points: number; what: string }

/**
 * The ClubScore awards that take a player from `before` to `after`: one per goal, assist, card and
 * so on (the same unit points the save gives), negative for anything taken away.
 */
export function pointChanges(before: MatchStatLine, after: MatchStatLine, rules: ClubScoreRuleConfig, position?: PlayerPosition): PointChange[] {
  const out: PointChange[] = [];
  const units = (n: number, event_type: MatchAwardType, unit: number, what: string) => {
    for (let i = 0; i < Math.abs(n); i++) out.push({ event_type, points: Math.sign(n) * unit, what });
  };
  units(Number(after.played) - Number(before.played), 'match_appearance', rules.points_match_appearance ?? 5, 'appearance');
  units(after.goals - before.goals, 'match_goal', getGoalPointsForPosition(rules, position), 'goal');
  units(after.assists - before.assists, 'match_assist', rules.points_assist ?? 7, 'assist');
  units(after.yellow_cards - before.yellow_cards, 'disciplinary_card', rules.points_yellow_card_penalty ?? -3, 'yellow card');
  units(after.red_cards - before.red_cards, 'disciplinary_card', rules.points_red_card_penalty ?? -10, 'red card');
  units(Number(after.clean_sheet) - Number(before.clean_sheet), 'match_clean_sheet', rules.points_clean_sheet_gk_def ?? 10, 'clean sheet');
  units(Number(after.motm) - Number(before.motm), 'match_motm', rules.points_motm ?? 15, 'Player of the Match');
  return out.filter(c => c.points !== 0);
}

const FIELDS: { key: keyof Omit<MatchStatLine, 'member_id'>; label: string }[] = [
  { key: 'played', label: 'played' },
  { key: 'minutes', label: 'minutes' },
  { key: 'goals', label: 'goals' },
  { key: 'assists', label: 'assists' },
  { key: 'yellow_cards', label: 'yellow cards' },
  { key: 'red_cards', label: 'red cards' },
  { key: 'clean_sheet', label: 'clean sheet' },
  { key: 'motm', label: 'Player of the Match' },
];

/** Plain words for what changed: "minutes 30 → 35", "clean sheet added" */
export function describeChange(before: MatchStatLine, after: MatchStatLine): string[] {
  return FIELDS.flatMap(({ key, label }) => {
    const a = before[key], b = after[key];
    if (a === b) return [];
    if (typeof a === 'boolean') return [`${label} ${b ? 'added' : 'taken off'}`];
    return [`${label} ${a} → ${b}`];
  });
}

/** Keeps numbers in the ranges the database allows */
export function cleanLine(l: MatchStatLine): MatchStatLine {
  const n = (v: number, max: number) => Math.min(max, Math.max(0, Math.round(Number(v) || 0)));
  return {
    ...l,
    minutes: n(l.minutes, 200), goals: n(l.goals, 50), assists: n(l.assists, 50),
    yellow_cards: n(l.yellow_cards, 2), red_cards: n(l.red_cards, 1),
  };
}
