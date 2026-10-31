'use client';

import Link from 'next/link';
import { CalendarPlus, MapPin, ChevronRight, Radio } from 'lucide-react';
import type { Club, Match } from '@/lib/supabase/types';
import { matchPath } from '@/lib/slugs';
import { clubResult, hasKickoffTime, kickoff } from '@/lib/fixtures';
import { downloadMatchIcs, directionsUrl } from '@/lib/match-ics';
import LocalTime from '@/components/LocalTime';
import { formatClock } from '@/lib/dates';
import KickoffCountdown from '@/components/KickoffCountdown';
import ResultChip from '@/components/ResultChip';

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
 * directions) and the last result with W/D/L. The hero slider moves on; this stays put.
 * A live match takes the first tile.
 */
export default function MatchdayStrip({ club, next, live, last, lastScoreHidden }: {
  club: Club;
  next?: Match;
  live?: Match;
  last?: Match;
  lastScoreHidden?: boolean;
}) {
  const first = live || next;
  const showLast = !!last && !lastScoreHidden;
  if (!first && !showLast) return null;
  const result = showLast && last ? clubResult(last) : null;

  return (
    <section aria-label="Matchday" className="matchday-strip">
      <div className="container">
        <div className="matchday-strip-grid">
          {first && (
            <div className="glass-panel matchday-tile matchday-tile-next">
              <div className="matchday-tile-head">
                {live ? (
                  <span className="badge badge-live"><span className="pulse-dot" /> Live now</span>
                ) : (
                  <span className="badge badge-primary">Next match</span>
                )}
                <span className="text-meta matchday-tile-comp">{competitionOf(first) || (first.is_club_home ? 'Home' : 'Away')}</span>
              </div>
              <div className="matchday-teams">
                <span className={first.is_club_home ? 'matchday-us' : undefined}>{first.home_team_name}</span>
                {live ? (
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
          )}

          {showLast && last && result && (
            <Link href={matchPath(club.slug, last)} className="glass-panel glass-panel-interactive matchday-tile matchday-tile-last" style={{ color: 'inherit', textDecoration: 'none' }}>
              <div className="matchday-tile-head">
                <span className="badge" style={{ background: 'rgba(var(--tint-rgb), 0.06)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}>Last result</span>
                <span className="text-meta matchday-tile-comp"><When m={last} /></span>
              </div>
              <div className="matchday-result">
                {result.outcome && <ResultChip outcome={result.outcome} size="md" />}
                <div className="matchday-teams matchday-teams-result">
                  <span className={last.is_club_home ? 'matchday-us' : undefined}>{last.home_team_name}</span>
                  <span className="matchday-score">{last.home_score ?? 0} - {last.away_score ?? 0}</span>
                  <span className={!last.is_club_home ? 'matchday-us' : undefined}>{last.away_team_name}</span>
                </div>
              </div>
              <div className="text-meta">{[competitionOf(last), last.venue].filter(Boolean).join(' · ')}{result.onPens ? ' · decided on penalties' : ''}</div>
              <span className="matchday-link">Match report <ChevronRight size={14} aria-hidden="true" /></span>
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
