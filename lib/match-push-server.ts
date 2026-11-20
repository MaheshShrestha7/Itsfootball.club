import type { SupabaseClient } from '@supabase/supabase-js';
import { durableRateLimit } from './rate-limit';
import { pushConfigured, pushToClub } from './push';
import { matchAlert, type AlertKind } from './match-alerts';
import { isJuniorFixture, publicScoreHidden } from './teams';
import { matchPath } from './slugs';
import type { ClubTeam, Match } from './supabase/types';

/**
 * Sends one live-score alert to the club's followers (server only). Used by Match Centre through
 * /api/push/match and by score by chat. Each alert goes once (per score for goals), however often it's
 * asked for. No alerts for a match an admin muted, nor (except the line-up) for a team that hides its
 * scores; a junior team's goal alert carries no scorer name.
 */
export async function sendMatchAlert(
  db: SupabaseClient,
  clubSlug: string,
  match: Match,
  teams: ClubTeam[],
  kind: AlertKind,
  home: number,
  away: number,
  minute?: number,
  scorerName?: string,
): Promise<{ pushed: number; skipped?: string; alreadySent?: boolean }> {
  if (!pushConfigured()) return { pushed: 0, skipped: 'not set up' };
  // An admin turned follower alerts off for this match (e.g. correcting it after full time)
  if (match.alerts_muted) return { pushed: 0, skipped: 'alerts muted' };
  // The line-up alert carries no score, so it still goes for a team that hides its scores
  if (kind !== 'lineup' && publicScoreHidden(match, teams)) return { pushed: 0, skipped: 'scores hidden' };

  const key = `match-push:${match.id}:${kind}${kind === 'goal' ? `:${home}-${away}` : ''}`;
  if (!(await durableRateLimit(key, 1, 24 * 60 * 60 * 1000))) return { pushed: 0, alreadySent: true };
  // The scorer's name, for a goal. Never for a junior team's game, where names are shortened in public.
  const scorer = kind === 'goal' && typeof scorerName === 'string' && !isJuniorFixture(match, teams)
    ? scorerName.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 60) || undefined
    : undefined;
  const pushed = await pushToClub(db, match.club_id, {
    ...matchAlert(kind, match, home, away, Number.isInteger(minute) ? minute : undefined, scorer),
    url: matchPath(clubSlug, match),
    tag: `match-${match.id}`, // one notification per match on the lock screen, updated as it goes
  });
  return { pushed };
}
