// ==============================================================================
// Which pitch slot suits which player, for filling a default line-up (components/TacticalPitch.tsx)
// ==============================================================================
import type { ClubMember } from './supabase/types';

// Line of each pitch position: 0 goal, 1 defence, 2 midfield, 3 attack
const LINE_OF: Record<string, number> = {
  GK: 0,
  CB: 1, LB: 1, RB: 1, LWB: 1, RWB: 1,
  CDM: 2, CM: 2, CAM: 2, AM: 2, LAM: 2, RAM: 2, LM: 2, RM: 2,
  LW: 3, RW: 3, ST: 3, CF: 3,
};

/** How well a player suits a pitch slot, lower is better; null = never (keepers stay in goal, outfield
 *  players stay out of it). Their own position, then a listed second position, then the same line, then a
 *  neighbouring line. Players with no position on file can go anywhere, after everyone who fits. */
export function slotFit(player: Pick<ClubMember, 'player_position' | 'secondary_positions'>, slot: string): number | null {
  const own = player.player_position && player.player_position !== 'SUB' ? player.player_position : null;
  const slotLine = LINE_OF[slot] ?? 2;
  if (!own) return 5;
  const ownLine = LINE_OF[own] ?? 2;
  if ((ownLine === 0) !== (slotLine === 0)) return null;
  if (own === slot) return 0;
  if (player.secondary_positions?.includes(slot as never)) return 1;
  if (ownLine === slotLine) return 2;
  return 2 + Math.abs(ownLine - slotLine);
}

/** Players for each open slot (same order as `slots`; undefined = left empty), best fit first. Earlier
 *  players in the list win ties, so a list sorted by availability keeps "In" players ahead. */
export function fillSlots<P extends Pick<ClubMember, 'player_position' | 'secondary_positions'>>(slots: string[], players: P[]): (P | undefined)[] {
  const pairs: { s: number; p: number; fit: number }[] = [];
  slots.forEach((slot, s) => players.forEach((player, p) => {
    const fit = slotFit(player, slot);
    if (fit !== null) pairs.push({ s, p, fit });
  }));
  pairs.sort((a, b) => a.fit - b.fit || a.p - b.p || a.s - b.s);
  const out: (P | undefined)[] = slots.map(() => undefined);
  const used = new Set<number>();
  for (const { s, p } of pairs) {
    if (out[s] || used.has(p)) continue;
    out[s] = players[p];
    used.add(p);
  }
  return out;
}
