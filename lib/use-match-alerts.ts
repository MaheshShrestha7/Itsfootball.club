'use client';

import { useEffect, useRef } from 'react';
import { useClub } from '@/lib/club-context';
import { useAuth } from '@/lib/auth-context';
import { alertFor, type MatchState } from '@/lib/match-alerts';
import { getLiveMinute } from '@/lib/match-clock';
import { getAccessToken } from '@/lib/supabase/client';
import { GOAL_EVENT_TYPES, goalScoringSide, juniorMemberIds, juniorPublicName } from '@/lib/teams';
import { compareEventMinute } from '@/lib/match-length';

// Only games around today: a result typed in for last month's game isn't news for followers' phones
const ALERT_WINDOW_MS = 36 * 3600000;

/**
 * Followers' live-score alerts (kick-off, each goal, full time) for a club's games, sent as this
 * admin's screen sees them change. It runs on every admin page, so a result entered on Fixtures or a
 * tournament page alerts followers the same way Match Centre does. The first look at a game only
 * records where it stands, and the server sends each alert once however many admins are signed in.
 */
export function useMatchAlerts(clubId: string | undefined) {
  const { matches, matchEvents, isHydrated, syncStatus, members, clubs, clubTeams, clubTeamMembers } = useClub();
  const { can } = useAuth();
  const seen = useRef<Record<string, MatchState>>({});
  // True from the first finished load on. Later refreshes (the tab coming back into view) don't reset
  // it, so a goal tapped the moment a phone is unlocked still goes out.
  const settledRef = useRef(false);
  const loaded = isHydrated && syncStatus.phase !== 'loading';
  const allowed = !!clubId && (can(clubId, 'match-center', 'edit') || can(clubId, 'matches', 'edit') || can(clubId, 'tournaments', 'edit'));

  useEffect(() => {
    if (!clubId || !allowed) return;
    if (loaded) settledRef.current = true;
    const settled = settledRef.current;
    for (const m of matches) {
      if (m.club_id !== clubId) continue;
      const now: MatchState = { status: m.status, home: m.home_score ?? 0, away: m.away_score ?? 0 };
      const prev = seen.current[m.id];
      // During the first load, the saved copy catching up with the database isn't a change
      if (!settled) continue;
      seen.current[m.id] = now;
      const kind = prev ? alertFor(prev, now) : null;
      if (!kind || m.alerts_muted) continue;
      if (Math.abs(Date.now() - new Date(m.match_date).getTime()) > ALERT_WINDOW_MS) continue;
      // The goal just logged for the side whose score went up names its scorer in the alert
      let scorer: string | undefined;
      if (kind === 'goal' && prev) {
        const side = now.home > prev.home ? 'home' : 'away';
        const goals = matchEvents
          .filter(e => e.match_id === m.id && GOAL_EVENT_TYPES.includes(e.event_type) && goalScoringSide(e) === side)
          .sort((a, b) => compareEventMinute(b, a));
        // Only when the log accounts for every goal (a score typed in by hand has no scorer to name)
        if (goals.length === now[side] && goals[0].event_type !== 'own_goal') {
          // A junior's name goes out the way the public pages show it ("Sam T.")
          const name = goals[0].player_name;
          const club = clubs.find(c => c.id === clubId);
          const juniors = juniorMemberIds(members, clubTeams, clubTeamMembers, { includeU18: club?.junior_includes_u18 !== false });
          const member = members.find(p => p.club_id === clubId && p.full_name.trim().toLowerCase() === (name || '').trim().toLowerCase());
          scorer = member && juniors.has(member.id) ? juniorPublicName(name) : name;
        }
      }
      void getAccessToken().then(token => fetch('/api/push/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ clubId, matchId: m.id, kind, home: now.home, away: now.away, minute: getLiveMinute(m), ...(scorer ? { scorer } : {}) }),
      })).catch(() => undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clubId, allowed, loaded, matches]);
}
