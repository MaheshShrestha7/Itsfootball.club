'use client';

import React from 'react';
import Link from 'next/link';
import type { Match } from '@/lib/supabase/types';
import { matchPath } from '@/lib/slugs';
import { fixtureWhenLabel } from '@/lib/tournament-engine';

/** One fixture or result as a row linking to its match page (team pages, /club/fixtures) */
export default function FixtureRow({ match, clubSlug, hideScore, teamLabel }: { match: Match; clubSlug: string; hideScore: boolean; teamLabel?: string }) {
  const opponent = match.opponent_name || (match.is_club_home ? match.away_team_name : match.home_team_name);
  const played = match.status === 'completed';
  const live = match.status === 'live' || match.status === 'halftime';
  return (
    <Link href={matchPath(clubSlug, match)} className="glass-panel row" style={{ padding: '0.85rem 1rem', justifyContent: 'space-between', color: 'inherit', textDecoration: 'none', gap: '0.75rem' }}>
      <div className="min-w-0">
        <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.95rem' }}>
          {match.is_club_home ? 'vs' : 'at'} {opponent}
        </div>
        <div className="text-meta">
          {[fixtureWhenLabel(match), teamLabel, match.competition, match.venue].filter(Boolean).join(' · ')}
        </div>
      </div>
      <div className="shrink-0" style={{ fontWeight: 800, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
        {live ? (
          <span className="badge badge-live"><span className="pulse-dot" /> LIVE</span>
        ) : played && !hideScore ? (
          `${match.home_score} - ${match.away_score}`
        ) : played ? (
          <span className="text-meta">Played</span>
        ) : match.status === 'postponed' || match.status === 'cancelled' ? (
          <span className="text-meta" style={{ textTransform: 'capitalize' }}>{match.status}</span>
        ) : null}
      </div>
    </Link>
  );
}
