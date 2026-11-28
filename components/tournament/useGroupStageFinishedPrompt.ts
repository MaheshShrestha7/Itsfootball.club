'use client';

import { useEffect, useRef } from 'react';
import { confirmAction } from '@/components/ConfirmDialog';
import { groupGamesLeft, knockoutStarted, START_KNOCKOUT_CONFIRM } from '@/lib/tournament-engine';
import type { Match, Tournament } from '@/lib/supabase/types';

/**
 * The moment a group + knockout tournament's last group game reaches full time, asks the host to
 * confirm the group tables are final; `start` runs on yes. Saying "Not yet" leaves the Start button.
 */
export function useGroupStageFinishedPrompt(
  tournament: Tournament | undefined,
  matches: Match[],
  enabled: boolean,
  start: (tournament: Tournament) => void
) {
  const left = tournament ? groupGamesLeft(tournament.id, matches) : 0;
  // Keyed by tournament, so moving between tournaments never looks like a group stage finishing
  const prev = useRef<{ id?: string; left: number }>({ id: tournament?.id, left });
  useEffect(() => {
    const was = prev.current;
    prev.current = { id: tournament?.id, left };
    if (!tournament || !enabled || was.id !== tournament.id || was.left === 0 || left !== 0) return;
    if (tournament.format !== 'group_knockout' || knockoutStarted(tournament, matches)) return;
    if (!matches.some(m => m.tournament_id === tournament.id && m.tournament_stage && m.tournament_stage !== 'group')) return;
    confirmAction(START_KNOCKOUT_CONFIRM).then(ok => { if (ok) start(tournament); });
    // Only a change in the games left (or the tournament) should ask
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournament?.id, left]);
}
