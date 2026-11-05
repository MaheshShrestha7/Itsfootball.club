import type { PlayerPosition } from '@/lib/supabase/types';

/** Position codes written out, for public pages (CM -> Midfielder) */
export const POSITION_NAMES: Record<string, string> = {
  GK: 'Goalkeeper', CB: 'Centre-back', LB: 'Left-back', RB: 'Right-back', LWB: 'Left wing-back', RWB: 'Right wing-back',
  CDM: 'Defensive midfielder', CM: 'Midfielder', CAM: 'Attacking midfielder', LM: 'Left midfielder', RM: 'Right midfielder',
  LW: 'Left winger', RW: 'Right winger', ST: 'Striker', CF: 'Centre-forward',
};

/** Where each position sits on a vertical pitch, attacking up: [left %, top %] */
export const POSITION_SPOTS: Partial<Record<PlayerPosition | 'LWB' | 'RWB' | 'LM' | 'RM' | 'CF', [number, number]>> = {
  GK: [50, 90], CB: [50, 76], LB: [16, 72], RB: [84, 72], LWB: [12, 60], RWB: [88, 60],
  CDM: [50, 64], CM: [50, 50], CAM: [50, 34], LM: [16, 48], RM: [84, 48],
  LW: [20, 24], RW: [80, 24], CF: [50, 22], ST: [50, 14],
};

/** The lines of a squad, in pitch order, as the squad and team pages show them */
export const SQUAD_LINES = [
  { key: 'GK', title: 'Goalkeepers', positions: ['GK'] },
  { key: 'DEF', title: 'Defenders', positions: ['CB', 'LB', 'RB', 'LWB', 'RWB'] },
  { key: 'MID', title: 'Midfielders', positions: ['CDM', 'CM', 'CAM', 'LM', 'RM'] },
  { key: 'FWD', title: 'Forwards', positions: ['LW', 'RW', 'ST', 'CF'] },
] as const;
export type SquadLineKey = (typeof SQUAD_LINES)[number]['key'] | 'OTHER';

/** Players by line, leaving out empty lines; anyone without a known position goes last, under "Squad" */
export function groupByLine<P extends { player_position?: string | null }>(players: P[]): { key: SquadLineKey; title: string; list: P[] }[] {
  const on = (positions: readonly string[]) => players.filter(p => positions.includes(p.player_position || ''));
  const known = SQUAD_LINES.flatMap(l => [...l.positions]) as string[];
  return [
    ...SQUAD_LINES.map(l => ({ key: l.key as SquadLineKey, title: l.title as string, list: on(l.positions) })),
    { key: 'OTHER' as SquadLineKey, title: 'Squad', list: players.filter(p => !known.includes(p.player_position || '')) },
  ].filter(g => g.list.length > 0);
}

export const initialsOf = (name: string) =>
  name.trim().split(/\s+/).map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '?';
