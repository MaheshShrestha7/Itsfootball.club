'use client';

import Link from 'next/link';
import { CalendarPlus, MapPin, ChevronRight, Users } from 'lucide-react';
import type { Club, Match } from '@/lib/supabase/types';
import { matchPath } from '@/lib/slugs';
import { clubResult, hasKickoffTime, kickoff, latestFirst } from '@/lib/fixtures';
import { downloadMatchIcs, directionsUrl } from '@/lib/match-ics';
import LocalTime from '@/components/LocalTime';
import KickoffCountdown from '@/components/KickoffCountdown';
import ResultChip from '@/components/ResultChip';

const norm = (s?: string | null) => (s || '').trim().toLowerCase();
const opponentOf = (m: Match) => m.opponent_name || (m.is_club_home ? m.away_team_name : m.home_team_name);

/** The club's latest finished game against the same opponent (league and friendlies only) */
export function lastMeeting(match: Match, clubMatches: Match[]): Match | undefined {
  if (match.tournament_id || match.match_type === 'internal') return undefined;
  const opp = norm(opponentOf(match));
  if (!opp) return undefined;
  return clubMatches
    .filter(m => m.id !== match.id && m.status === 'completed' && !m.tournament_id && m.match_type !== 'internal' && norm(opponentOf(m)) === opp)
    .sort(latestFirst)[0];
}

/**
 * The match page before kick-off: a countdown, calendar and directions, whether the line-up is out,
 * and the last time the club played this opponent. Replaces the empty Timeline and Stats tabs.
 */
export default function PreMatchPanel({ club, match, previous, previousScoreHidden, lineupAnnounced, onShowLineup }: {
  club: Club;
  match: Match;
  previous?: Match;
  previousScoreHidden?: boolean;
  lineupAnnounced: boolean;
  onShowLineup?: () => void;
}) {
  const postponed = match.status === 'postponed';
  const prev = previous && !previousScoreHidden ? previous : undefined;
  const prevResult = prev ? clubResult(prev) : null;

  return (
    <section className="prematch" aria-label="Before kick-off">
      <div className="glass-panel prematch-tile prematch-countdown">
        <div className="prematch-label">{postponed ? 'Postponed' : 'Kick-off in'}</div>
        {postponed ? (
          <p className="text-note" style={{ margin: 0 }}>This game has been postponed. The club will post the new date here.</p>
        ) : hasKickoffTime(match) ? (
          <KickoffCountdown kickoff={kickoff(match)} fallback={<LocalTime value={match.match_date} format="both" options={{ weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }} />} />
        ) : (
          <div className="text-note">{match.match_time ? `Kick-off ${match.match_time}` : 'Kick-off time to be confirmed'}</div>
        )}
        <div className="matchday-actions">
          {!postponed && (
            <button type="button" className="btn btn-primary btn-sm" onClick={() => downloadMatchIcs(club.name, club.slug, match)}>
              <CalendarPlus size={14} aria-hidden="true" /> Add to calendar
            </button>
          )}
          {match.venue && (
            <a href={directionsUrl(match.venue)} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm">
              <MapPin size={14} aria-hidden="true" /> Directions
            </a>
          )}
        </div>
      </div>

      <div className="glass-panel prematch-tile">
        <div className="prematch-label">Team news</div>
        {lineupAnnounced ? (
          <>
            <p className="text-note" style={{ margin: 0 }}>The line-up is out.</p>
            {onShowLineup && (
              <button type="button" className="btn btn-secondary btn-sm" style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }} onClick={onShowLineup}>
                <Users size={14} aria-hidden="true" /> See the line-up
              </button>
            )}
          </>
        ) : (
          <p className="text-note" style={{ margin: 0 }}>The line-up hasn&apos;t been announced yet. It shows here once the coach picks the team.</p>
        )}
      </div>

      {prev && prevResult && (
        <Link href={matchPath(club.slug, prev)} className="glass-panel glass-panel-interactive prematch-tile" style={{ color: 'inherit', textDecoration: 'none' }}>
          <div className="prematch-label">Last time we played {opponentOf(match)}</div>
          <div className="matchday-result">
            {prevResult.outcome && <ResultChip outcome={prevResult.outcome} size="md" />}
            <div className="matchday-teams matchday-teams-result">
              <span className={prev.is_club_home ? 'matchday-us' : undefined}>{prev.home_team_name}</span>
              <span className="matchday-score">{prev.home_score ?? 0} - {prev.away_score ?? 0}</span>
              <span className={!prev.is_club_home ? 'matchday-us' : undefined}>{prev.away_team_name}</span>
            </div>
          </div>
          <div className="text-meta">
            <LocalTime value={prev.match_date} options={{ day: 'numeric', month: 'short', year: 'numeric' }} />
            {prev.venue ? ` · ${prev.venue}` : ''}
          </div>
          <span className="matchday-link">Match report <ChevronRight size={14} aria-hidden="true" /></span>
        </Link>
      )}
    </section>
  );
}
