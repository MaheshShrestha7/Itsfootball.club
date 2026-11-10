'use client';

import Link from 'next/link';
import { CalendarPlus, MapPin, ChevronRight, Radio } from 'lucide-react';
import type { Club, Match } from '@/lib/supabase/types';
import { matchPath } from '@/lib/slugs';
import { hasKickoffTime, kickoff } from '@/lib/fixtures';
import { downloadMatchIcs, directionsUrl } from '@/lib/match-ics';
import LocalTime from '@/components/LocalTime';
import { formatClock } from '@/lib/dates';
import KickoffCountdown from '@/components/KickoffCountdown';
import LiveMinute from '@/components/LiveMinute';

/** The competition name worth showing (the old placeholder default isn't one) */
const competitionOf = (m: Match) => (m.competition && m.competition !== 'Premier Regional League' ? m.competition : null);

/** Date (and kick-off time when the fixture has one) in the site's style */
export function When({ m }: { m: Match }) {
  if (!hasKickoffTime(m)) {
    return <><LocalTime value={`${m.match_date.slice(0, 10)}T12:00:00`} options={{ weekday: 'short', day: 'numeric', month: 'short' }} />{m.match_time ? ` · ${formatClock(m.match_time)}` : ''}</>;
  }
  return <><LocalTime value={m.match_date} options={{ weekday: 'short', day: 'numeric', month: 'short' }} />{' · '}<KickoffTime m={m} /></>;
}

/** Kick-off time alone in the site's style ("3:00 pm"), or nothing when the fixture has none */
export function KickoffTime({ m }: { m: Pick<Match, 'match_date' | 'match_time'> }) {
  if (hasKickoffTime(m)) return <LocalTime value={m.match_date} format="time" options={{ hour: 'numeric', minute: '2-digit' }} />;
  return m.match_time ? <>{formatClock(m.match_time)}</> : null;
}

/**
 * Club home, straight under the hero: the next match (with a real countdown, calendar and
 * directions), or the live match while one is on. The hero slider moves on; this stays put.
 */
export default function MatchdayStrip({ club, next, live, hideScore }: {
  club: Club;
  next?: Match;
  live?: Match;
  /** The live game's team keeps scores off public pages (junior grassroots rules) */
  hideScore?: boolean;
}) {
  const first = live || next;
  if (!first) return null;

  return (
    <section aria-label="Matchday" className="matchday-strip">
      <div className="container">
        <div className="matchday-strip-grid">
          <div className="glass-panel matchday-tile matchday-tile-next">
            <div className="matchday-tile-head">
              {live ? (
                live.status === 'halftime'
                  ? <span className="badge badge-gold">Half-time</span>
                  : <span className="badge badge-live"><span className="pulse-dot" /> Live now{live.is_paused ? '' : <> · <LiveMinute match={live} />&prime;</>}</span>
              ) : (
                <strong style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>Next match</strong>
              )}
              <span className="text-meta matchday-tile-comp">{competitionOf(first) || (first.is_club_home ? 'Home' : 'Away')}</span>
            </div>
            <div className="matchday-teams">
              <span className={first.is_club_home ? 'matchday-us' : undefined}>{first.home_team_name}</span>
              {live && !hideScore ? (
                <span className="matchday-score">{live.home_score ?? 0} - {live.away_score ?? 0}</span>
              ) : (
                <span className="matchday-vs">vs</span>
              )}
              <span className={!first.is_club_home ? 'matchday-us' : undefined}>{first.away_team_name}</span>
            </div>
            <div className="text-meta matchday-when">
              <When m={first} />{first.venue ? ` · ${first.venue}` : ''}
            </div>
            {!live && hasKickoffTime(first) && (
              <KickoffCountdown kickoff={kickoff(first)} size="sm" />
            )}
            <div className="matchday-actions">
              <Link href={matchPath(club.slug, first)} className="btn btn-primary btn-sm">
                {live ? <><Radio size={14} aria-hidden="true" /> Follow live</> : <>Match preview <ChevronRight size={14} aria-hidden="true" /></>}
              </Link>
              {!live && (
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => downloadMatchIcs(club.name, club.slug, first)}>
                  <CalendarPlus size={14} aria-hidden="true" /> Add to calendar
                </button>
              )}
              {first.venue && (
                <a href={directionsUrl(first.venue)} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm">
                  <MapPin size={14} aria-hidden="true" /> Directions
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
