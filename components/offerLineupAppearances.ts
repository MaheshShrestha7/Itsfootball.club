'use client';

// A line-up published on a match whose stats are already saved: players in it with no appearance
// from that match are offered one, so the season "Games" count keeps up with the line-up
// (stats saved first and the line-up put in afterwards left players a game short).
import { confirmAction } from '@/components/ConfirmDialog';
import { lineupAdditions, type MatchStatLine } from '@/lib/match-stats';
import type { Match } from '@/lib/supabase/types';

interface Deps {
  loadMatchStatLines: (matchId: string) => Promise<MatchStatLine[] | null>;
  fixMatchStats: (matchId: string, before: MatchStatLine[], after: MatchStatLine[], adminName: string) => Promise<{ success: boolean; message: string; changed: number }>;
  adminName: string;
}

/** Returns a message for the admin, or null when nothing needed doing (or they said no) */
export async function offerLineupAppearances(games: Match[], lineupIds: (string | null | undefined)[], deps: Deps): Promise<{ ok: boolean; message: string } | null> {
  const plans: { match: Match; saved: MatchStatLine[]; added: MatchStatLine[] }[] = [];
  for (const match of games.filter(g => g.is_audited)) {
    // null: saved before per-match stats were kept, so there's nothing to add to safely
    const saved = await deps.loadMatchStatLines(match.id);
    if (!saved) continue;
    const added = lineupAdditions(saved, lineupIds, match.match_format);
    if (added.length) plans.push({ match, saved, added });
  }
  if (!plans.length) return null;

  const players = new Set(plans.flatMap(p => p.added.map(l => l.member_id))).size;
  const ok = await confirmAction({
    title: `Add ${players} player${players === 1 ? '' : 's'} to the saved stats?`,
    message: plans.length === 1
      ? `This match's stats are already saved, and ${players === 1 ? 'one player' : `${players} players`} in this line-up ${players === 1 ? 'has' : 'have'} no appearance from it. Adding them gives each one the game, full-match minutes and appearance points.`
      : `Stats are already saved for ${plans.length} of these games, and players in this line-up have no appearance from them. Adding them gives each one the game, full-match minutes and appearance points.`,
    confirmLabel: 'Add appearances',
    cancelLabel: 'Not now',
  });
  if (!ok) return { ok: true, message: 'Line-up saved. Stats unchanged: use Fix Stats on the match to add the appearances later.' };

  let added = 0;
  for (const { match, saved, added: lines } of plans) {
    const byId = new Map(saved.map(l => [l.member_id, l]));
    lines.forEach(l => byId.set(l.member_id, l));
    const res = await deps.fixMatchStats(match.id, saved, [...byId.values()], deps.adminName);
    if (!res.success) return { ok: false, message: res.message };
    added += res.changed;
  }
  return { ok: true, message: `Line-up saved and ${added} appearance${added === 1 ? '' : 's'} added to the saved stats.` };
}
