'use client';

import React from 'react';
import Link from 'next/link';
import { countsTowardClubRecord, type Match } from '@/lib/supabase/types';
import { matchPath } from '@/lib/slugs';
import { clubResult, hasKickoffTime } from '@/lib/fixtures';
import LocalTime from '@/components/LocalTime';
import ResultChip from '@/components/ResultChip';

/** One fixture or result as a row linking to its match page (team pages, /club/fixtures).
 *  A date tile on the left, the opponent and details in the middle, and on the right the
 *  club's own score first with W/D/L (an away 1-2 loss reads "L 1-2", never "2-1"). */
export default function FixtureRow({ match, clubSlug, hideScore, teamLabel }: { match: Match; clubSlug: string; hideScore: boolean; teamLabel?: string }) {
  const opponent = match.opponent_name || (match.is_club_home ? match.away_team_name : match.home_team_name);
  const played = match.status === 'completed';
  const live = match.status === 'live' || match.status === 'halftime';
  const result = played ? clubResult(match) : null;
  const timed = hasKickoffTime(match);
  // Date-only values (older cup fixtures) are already the local day; read them at noon so no zone moves them
  const when = timed ? match.match_date : `${match.match_date?.slice(0, 10)}T12:00:00`;
  const kickoffTime = timed
    ? <LocalTime value={match.match_date} format="time" options={{ hour: 'numeric', minute: '2-digit' }} />
    : match.match_time || null;
  return (
    <Link href={matchPath(clubSlug, match)} className="glass-panel glass-panel-interactive fixture-row" style={{ color: 'inherit', textDecoration: 'none' }}>
      <div className="fixture-row-date" aria-hidden="true">
        <span className="fixture-row-dow"><LocalTime value={when} options={{ weekday: 'short' }} /></span>
        <span className="fixture-row-day"><LocalTime value={when} options={{ day: 'numeric' }} /></span>
        <span className="fixture-row-month"><LocalTime value={when} options={{ month: 'short' }} /></span>
      </div>
      <div className="min-w-0" style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.95rem' }}>
          {/* An in-house game is two of the club's own sides, so both names (never "vs Bibs") */}
          {match.match_type === 'internal' ? `${match.home_team_name} v ${match.away_team_name}` : `${match.is_club_home ? 'vs' : 'at'} ${opponent}`}
        </div>
        <div className="text-meta">
          <span className="sr-only"><LocalTime value={when} options={{ weekday: 'long', day: 'numeric', month: 'long' }} />{' · '}</span>
          {!played && kickoffTime && <>{kickoffTime}{' · '}</>}
          {[teamLabel, match.competition, match.venue].filter(Boolean).join(' · ')}
        </div>
      </div>
      <div className="shrink-0 fixture-row-end">
        {live ? (
          <span className="badge badge-live"><span className="pulse-dot" /> LIVE</span>
        ) : played && !hideScore && result ? (
          <>
            {result.outcome && <ResultChip outcome={result.outcome} />}
            <span className="fixture-row-score">{result.us} - {result.them}{result.onPens ? <span className="text-meta"> (pens)</span> : null}</span>
          </>
        ) : played ? (
          <span className="text-meta">Played</span>
        ) : match.status === 'postponed' || match.status === 'cancelled' ? (
          <span className="text-meta" style={{ textTransform: 'capitalize' }}>{match.status}</span>
        ) : countsTowardClubRecord(match) ? (
          <span className="fixture-row-ha">{match.is_club_home ? 'Home' : 'Away'}</span>
        ) : null}
      </div>
    </Link>
  );
}
