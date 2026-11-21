'use client';

import { useEffect, useRef } from 'react';
import { useClub } from '@/lib/club-context';
import { useAuth } from '@/lib/auth-context';
import { getAccessToken } from '@/lib/supabase/client';

// Only games around today
const WINDOW_MS = 36 * 3600000;

/**
 * Keeps the live scoreboards in scorers' chats in step with changes made on this admin screen (Match Centre,
 * Fixtures, a tournament page). It asks the server to rewrite them once the change is saved to the database,
 * since the board is rebuilt from there. The server does nothing when no chat has a board for the game.
 */
export function useChatBoards(clubId: string | undefined) {
  const { matches, matchEvents, syncStatus } = useClub();
  const { can } = useAuth();
  const seen = useRef<Record<string, string>>({});
  const dirty = useRef<Set<string>>(new Set());
  const allowed = !!clubId && (can(clubId, 'match-center', 'edit') || can(clubId, 'matches', 'edit') || can(clubId, 'tournaments', 'edit'));

  useEffect(() => {
    if (!clubId || !allowed || syncStatus.phase === 'loading' || syncStatus.phase === 'off') return;
    for (const m of matches) {
      if (m.club_id !== clubId || m.status === 'upcoming') continue;
      if (Math.abs(Date.now() - new Date(m.match_date).getTime()) > WINDOW_MS) continue;
      // What the board shows: state, score and the goals and cards
      const events = matchEvents
        .filter(e => e.match_id === m.id && ['goal', 'penalty', 'own_goal', 'yellow_card', 'red_card'].includes(e.event_type))
        .map(e => `${e.id}:${e.minute}:${e.player_name}:${e.assist_player_name || ''}`).sort().join(',');
      const sig = `${m.status}|${m.period}|${m.home_score}-${m.away_score}|${m.home_penalty_score ?? ''}-${m.away_penalty_score ?? ''}|${events}`;
      const prev = seen.current[m.id];
      seen.current[m.id] = sig;
      // The first look only records where the game stands
      if (prev !== undefined && prev !== sig) dirty.current.add(m.id);
    }
    // Once this screen's changes are in the database
    if (syncStatus.phase !== 'idle' || !dirty.current.size) return;
    const ids = [...dirty.current];
    dirty.current.clear();
    void getAccessToken().then(token => Promise.all(ids.map(matchId => fetch('/api/chat/board', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ clubId, matchId }),
    })))).catch(() => undefined);
  }, [clubId, allowed, matches, matchEvents, syncStatus.phase]);
}
