'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getSupabaseClient } from '@/lib/supabase/client';
import { cleanBoards, defaultBoards, type TacticsBoard } from '@/lib/tactics-board';

export type TacticsSaveState = 'idle' | 'saving' | 'saved' | 'error';

// Without a database (local preview) the boards stay in this browser
const LOCAL_KEY = 'itsfootball_tactics_v1';
const readLocal = (): Record<string, unknown> => {
  try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || '{}') || {}; } catch { return {}; }
};

/**
 * A fixture's tactics boards (table match_tactics, migration 20261170). `ready` stays false until
 * the table answers, so the Tactics board switch is hidden on a database that doesn't have it yet.
 * Every change saves itself a moment later; a change still waiting is saved before another fixture
 * loads and when the page is left.
 */
export function useMatchTactics(clubId?: string, matchId?: string) {
  const [boards, setBoardsState] = useState<TacticsBoard[]>(defaultBoards);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<TacticsSaveState>('idle');
  const pending = useRef<{ clubId: string; matchId: string; boards: TacticsBoard[] } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    const job = pending.current;
    if (!job) return;
    pending.current = null;
    setSaveState('saving');
    const sb = getSupabaseClient();
    let failed = false;
    if (sb) {
      const { error } = await sb.from('match_tactics')
        .upsert({ match_id: job.matchId, club_id: job.clubId, boards: job.boards, updated_at: new Date().toISOString() });
      failed = !!error;
    } else {
      try { localStorage.setItem(LOCAL_KEY, JSON.stringify({ ...readLocal(), [job.matchId]: job.boards })); } catch { failed = true; }
    }
    // A failed save stays queued (unless a newer change has replaced it) so Retry sends it again
    if (failed) pending.current ??= job;
    setSaveState(failed ? 'error' : pending.current ? 'saving' : 'saved');
  }, []);

  useEffect(() => {
    if (!matchId) return;
    let live = true;
    void (async () => {
      await flush();
      const sb = getSupabaseClient();
      let raw: unknown = null;
      if (sb) {
        const { data, error } = await sb.from('match_tactics').select('boards').eq('match_id', matchId).maybeSingle();
        if (error) return; // no table yet, or offline: the board stays hidden rather than risk drawing over saved work
        raw = data?.boards;
      } else {
        raw = readLocal()[matchId];
      }
      if (!live) return;
      setBoardsState(cleanBoards(raw));
      setSaveState('idle');
      setLoadedFor(matchId);
    })();
    return () => { live = false; };
  }, [matchId, flush]);

  // Leaving the page or putting the phone away: send what's waiting now
  useEffect(() => {
    const onHide = () => { if (document.visibilityState === 'hidden') void flush(); };
    document.addEventListener('visibilitychange', onHide);
    return () => { document.removeEventListener('visibilitychange', onHide); void flush(); };
  }, [flush]);

  const ready = !!matchId && loadedFor === matchId;
  const setBoards = useCallback((next: TacticsBoard[]) => {
    if (!clubId || !matchId || loadedFor !== matchId) return;
    setBoardsState(next);
    pending.current = { clubId, matchId, boards: next };
    setSaveState('saving');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), 1200);
  }, [clubId, matchId, loadedFor, flush]);

  return { ready, boards, setBoards, saveState, retry: flush };
}

/** The boards a coach has switched on for players, for one game (member_match_tactics checks who is asking) */
export async function loadSharedBoards(matchId: string): Promise<TacticsBoard[]> {
  const sb = getSupabaseClient();
  if (!sb) return cleanBoards(readLocal()[matchId]).filter(b => b.show);
  const { data, error } = await sb.rpc('member_match_tactics', { p_match_id: matchId });
  return error ? [] : cleanBoards(data).filter(b => b.show);
}
