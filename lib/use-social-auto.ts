'use client';

import { useEffect, useRef } from 'react';
import { useClub } from '@/lib/club-context';
import { useAuth } from '@/lib/auth-context';
import { clubTimeZone } from '@/lib/dates';
import { drawMatchCard, shareLink } from '@/lib/share-card';
import { matchCardSponsors } from '@/lib/sponsors';
import { AUTO_TRIGGERS, autoTriggerFor, socialCaption } from '@/lib/social-posts';
import { publishSocial, useSocialAccount } from '@/lib/social-publish';
import { useMatchShare } from '@/lib/use-match-share';
import type { Club, Match } from '@/lib/supabase/types';

const WINDOW_MS = 36 * 3600000;

/**
 * Kick-off, half time and full time posts that the club set to go out by themselves (Admin > Social
 * media > When to post), made by the screen of whoever moves the game on: Match Centre, Fixtures, a
 * result typed in. Like the followers' alerts (useMatchAlerts), the first look only records where each
 * game stands. The server posts each one once however many admins are watching.
 * shortcut: rules and the connected Page are read once per admin visit; a change shows after a reload.
 */
export function useSocialAuto(club: Club) {
  const { matches, isHydrated, syncStatus, sponsors } = useClub();
  const { can, user } = useAuth();
  const allowed = can(club.id, 'content', 'edit') || can(club.id, 'match-center', 'edit') || can(club.id, 'matches', 'edit');
  const { account } = useSocialAccount(club.id, allowed);
  const shareProps = useMatchShare(club);
  const seen = useRef<Record<string, Match['status']>>({});
  const settled = useRef(false);
  const loaded = isHydrated && syncStatus.phase !== 'loading';
  const settings = account?.connected ? account.settings : undefined;
  const on = !!settings && AUTO_TRIGGERS.some(t => settings.rules[t].on && settings.rules[t].auto);

  useEffect(() => {
    if (!allowed) return;
    if (loaded) settled.current = true;
    for (const m of matches) {
      if (m.club_id !== club.id) continue;
      const prev = seen.current[m.id];
      if (!settled.current) continue;
      seen.current[m.id] = m.status;
      if (!on || !settings || !prev) continue;
      const trigger = autoTriggerFor(prev, m.status);
      if (!trigger || !settings.rules[trigger].on || !settings.rules[trigger].auto) continue;
      // The club's own team games only, as the Social media list has them
      if (m.tournament_id || (m.match_type || 'friendly') === 'internal') continue;
      if (Math.abs(Date.now() - new Date(m.match_date).getTime()) > WINDOW_MS) continue;
      const share = shareProps(m);
      if (trigger === 'halftime' && share.hideScore) continue;
      const kickoff00 = trigger === 'kickoff' && m.home_score + m.away_score === 0;
      const cardSponsors = matchCardSponsors(sponsors, club.id);
      void drawMatchCard(share.match, club, 'score', shareLink(club), {
        hideScore: share.hideScore, format: 'post', events: share.hideScore ? undefined : share.events,
        ...(kickoff00 ? { headline: ['KICK', 'OFF'] as [string, string] } : {}),
        ...(cardSponsors.length ? { sponsors: cardSponsors, sponsorsLabel: 'CLUB SPONSORS' } : {}),
      }).then(image => publishSocial({
        clubId: club.id, key: `${trigger}:${m.id}`, auto: true, by: user?.full_name || '', image,
        caption: socialCaption(trigger, { club, settings, timeZone: clubTimeZone(club) }, { match: m, hideScore: share.hideScore }),
      })).catch(() => undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [club.id, allowed, loaded, matches, on]);
}
