'use client';

import React from 'react';
import { Match } from '@/lib/supabase/types';
import { STAGE_TITLES, fixtureWhenLabel } from '@/lib/tournament-engine';
import { Trophy, Edit3, Award } from 'lucide-react';
import { DEFAULT_CREST } from '@/lib/crest';
import LiveMinute from '@/components/LiveMinute';

interface TournamentBracketViewProps {
  matches: Match[];
  onSelectMatch?: (match: Match) => void;
  isAdmin?: boolean;
}

export default function TournamentBracketView({
  matches,
  onSelectMatch,
  isAdmin = false,
}: TournamentBracketViewProps) {
  // Filter only knockout stages (exclude group matches)
  const koMatches = matches.filter(
    m => m.tournament_stage && m.tournament_stage !== 'group' && m.tournament_stage !== 'third_place'
  );

  const thirdPlaceMatch = matches.find(m => m.tournament_stage === 'third_place');

  if (koMatches.length === 0) {
    return (
      <div
        style={{
          background: 'rgba(var(--tint-rgb), 0.02)',
          border: '1px solid rgba(var(--tint-rgb), 0.08)',
          borderRadius: '16px',
          padding: '3rem',
          textAlign: 'center',
          color: 'var(--text-secondary)',
        }}
      >
        <Trophy size={36} style={{ opacity: 0.3, margin: '0 auto 1rem auto' }} />
        <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-primary)', fontWeight: 800 }}>
          {isAdmin ? 'No knockout draw yet' : 'Knockout bracket coming soon'}
        </h3>
        <p style={{ margin: 0, fontSize: '0.85rem' }}>
          {isAdmin
            ? 'Make the draw, or finish the group games, and the knockout rounds show here.'
            : 'The knockout rounds will appear here once the group stage is finished.'}
        </p>
      </div>
    );
  }

  // Group knockout matches by round number
  const roundsMap = new Map<number, Match[]>();
  koMatches.forEach(m => {
    const r = m.tournament_round || 1;
    const list = roundsMap.get(r) || [];
    list.push(m);
    roundsMap.set(r, list);
  });

  const sortedRoundNumbers = Array.from(roundsMap.keys()).sort((a, b) => a - b);
  const totalRounds = sortedRoundNumbers.length;

  const getRoundHeading = (roundNum: number, matchSample?: Match) => {
    if (matchSample?.tournament_stage && STAGE_TITLES[matchSample.tournament_stage]) {
      return STAGE_TITLES[matchSample.tournament_stage];
    }
    const roundsFromEnd = totalRounds - roundNum;
    if (roundsFromEnd === 0) return 'Grand Final';
    if (roundsFromEnd === 1) return 'Semi-Finals';
    if (roundsFromEnd === 2) return 'Quarter-Finals';
    if (roundsFromEnd === 3) return 'Round of 16';
    return `Round ${roundNum}`;
  };

  return (
    <div className="w-full">
      {/* Visual Bracket Container with Horizontal Scroll */}
      <div
        style={{
          overflowX: 'auto',
          padding: '1rem 0.5rem 2rem 0.5rem',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        <div
          style={{
            display: 'flex',
            gap: '2.5rem',
            alignItems: 'stretch',
            minWidth: `${sortedRoundNumbers.length * 280}px`,
            position: 'relative',
          }}
        >
          {sortedRoundNumbers.map((roundNum, rIdx) => {
            const roundMatches = roundsMap.get(roundNum) || [];
            const heading = getRoundHeading(roundNum, roundMatches[0]);

            return (
              <div
                key={roundNum}
                style={{
                  flex: '0 0 270px',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                {/* Round Column Header */}
                <div
                  style={{
                    textAlign: 'center',
                    marginBottom: '1.25rem',
                    padding: '0.65rem',
                    // The final in the club's own colour (AI10-1)
                    background:
                      rIdx === totalRounds - 1
                        ? 'rgba(var(--club-primary-rgb), 0.06)'
                        : 'rgba(var(--tint-rgb), 0.03)',
                    borderRadius: '10px',
                    border:
                      rIdx === totalRounds - 1
                        ? '1px solid rgba(var(--club-primary-rgb), 0.45)'
                        : '1px solid var(--border-subtle)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
                    {rIdx === totalRounds - 1 && <Trophy size={15} color="var(--club-ink)" aria-hidden="true" />}
                    <span
                      style={{
                        fontWeight: 700,
                        fontSize: '0.9rem',
                        color: rIdx === totalRounds - 1 ? 'var(--club-ink)' : 'var(--text-primary)',
                      }}
                    >
                      {heading}
                    </span>
                  </div>
                  <span className="text-meta">
                    {roundMatches.length} {roundMatches.length === 1 ? 'Match' : 'Matches'}
                  </span>
                </div>

                {/* Match Cards Stack */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-around',
                    flex: 1,
                    gap: '1.5rem',
                  }}
                >
                  {roundMatches.map(match => {
                    const isLive = match.status === 'live';
                    const isCompleted = match.status === 'completed';
                    const isHomeWinner = match.winner_side === 'home';
                    const isAwayWinner = match.winner_side === 'away';

                    return (
                      <div
                        key={match.id}
                        onClick={() => onSelectMatch && onSelectMatch(match)}
                        style={{
                          background: 'rgb(var(--dk-17-24-39))',
                          border: isLive ? '1.5px solid var(--c-red)' : '1px solid var(--border-medium)',
                          borderRadius: '12px',
                          overflow: 'hidden',
                          cursor: onSelectMatch ? 'pointer' : 'default',
                          transition: 'transform 0.15s ease, border-color 0.15s ease',
                          position: 'relative',
                        }}
                        onMouseEnter={e => {
                          if (onSelectMatch) {
                            e.currentTarget.style.transform = 'translateY(-2px)';
                            e.currentTarget.style.borderColor = 'var(--club-primary)';
                          }
                        }}
                        onMouseLeave={e => {
                          if (onSelectMatch) {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.borderColor = isLive ? 'var(--c-red)' : 'var(--border-medium)';
                          }
                        }}
                      >
                        {/* Match Card Header Info */}
                        <div
                          style={{
                            padding: '0.45rem 0.75rem',
                            background: 'rgba(var(--shade-rgb), 0.4)',
                            borderBottom: '1px solid rgba(var(--tint-rgb), 0.05)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            fontSize: '0.7rem',
                          }}
                        >
                          <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>
                            M#{match.tournament_match_number || '-'}
                          </span>

                          <div className="row">
                            {isLive && (
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '3px',
                                  color: 'var(--c-red)',
                                  fontWeight: 800,
                                }}
                              >
                                <span
                                  style={{
                                    width: '6px',
                                    height: '6px',
                                    borderRadius: '50%',
                                    background: 'var(--c-red)',
                                    animation: 'pulse 1.5s infinite',
                                  }}
                                />
                                <LiveMinute match={match} />&apos; LIVE
                              </span>
                            )}
                            {isCompleted && (
                              <span style={{ color: 'var(--text-secondary)', fontWeight: 800 }}>
                                FT
                              </span>
                            )}
                            {!isLive && !isCompleted && (
                              <span className="text-secondary">
                                {match.match_date ? `${fixtureWhenLabel(match)}${match.pitch_label ? ` · ${match.pitch_label}` : ''}` : 'Upcoming'}
                              </span>
                            )}
                            {isAdmin && (
                              <Edit3 size={11} color="var(--club-primary)" style={{ opacity: 0.8 }} />
                            )}
                          </div>
                        </div>

                        {/* Teams Box */}
                        <div style={{ padding: '0.5rem 0.65rem' }}>
                          {/* Home Team Row */}
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '0.35rem 0.45rem',
                              borderRadius: '6px',
                              background: isHomeWinner ? 'rgba(var(--club-primary-rgb), 0.08)' : 'transparent',
                              marginBottom: '2px',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
                              <img loading="lazy" decoding="async" width={22} height={22}
                                src={match.home_team_logo || DEFAULT_CREST}
                                alt=""
                                style={{ width: '22px', height: '22px', objectFit: 'contain', flexShrink: 0 }}
                              />
                              <div className="min-w-0">
                                <div
                                  style={{
                                    fontSize: '0.8rem',
                                    fontWeight: isHomeWinner ? 800 : 600,
                                    color: isHomeWinner ? 'var(--text-primary)' : isCompleted ? 'rgba(var(--tint-rgb), 0.6)' : '#FFFFFF',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    maxWidth: '135px',
                                  }}
                                >
                                  {match.home_team_name}
                                </div>
                                {match.home_team_source && (
                                  <div className="text-meta">
                                    {match.home_team_source}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Score & Penalty indicator */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              {match.home_penalty_score !== undefined && (
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 700 }}>
                                  ({match.home_penalty_score})
                                </span>
                              )}
                              <span
                                style={{
                                  fontSize: '0.95rem',
                                  fontWeight: 800,
                                  color: isHomeWinner ? 'var(--club-ink)' : isCompleted ? 'var(--text-primary)' : 'var(--text-muted)',
                                  minWidth: '18px',
                                  textAlign: 'right',
                                }}
                              >
                                {isCompleted || isLive ? match.home_score : '-'}
                              </span>
                            </div>
                          </div>

                          {/* Away Team Row */}
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '0.35rem 0.45rem',
                              borderRadius: '6px',
                              background: isAwayWinner ? 'rgba(var(--club-primary-rgb), 0.08)' : 'transparent',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
                              <img loading="lazy" decoding="async" width={22} height={22}
                                src={match.away_team_logo || DEFAULT_CREST}
                                alt=""
                                style={{ width: '22px', height: '22px', objectFit: 'contain', flexShrink: 0 }}
                              />
                              <div className="min-w-0">
                                <div
                                  style={{
                                    fontSize: '0.8rem',
                                    fontWeight: isAwayWinner ? 800 : 600,
                                    color: isAwayWinner ? 'var(--text-primary)' : isCompleted ? 'rgba(var(--tint-rgb), 0.6)' : '#FFFFFF',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    maxWidth: '135px',
                                  }}
                                >
                                  {match.away_team_name}
                                </div>
                                {match.away_team_source && (
                                  <div className="text-meta">
                                    {match.away_team_source}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Score & Penalty indicator */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              {match.away_penalty_score !== undefined && (
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 700 }}>
                                  ({match.away_penalty_score})
                                </span>
                              )}
                              <span
                                style={{
                                  fontSize: '0.95rem',
                                  fontWeight: 800,
                                  color: isAwayWinner ? 'var(--club-ink)' : isCompleted ? 'var(--text-primary)' : 'var(--text-muted)',
                                  minWidth: '18px',
                                  textAlign: 'right',
                                }}
                              >
                                {isCompleted || isLive ? match.away_score : '-'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3rd Place Playoff Card if applicable */}
      {thirdPlaceMatch && (
        <div
          style={{
            marginTop: '1.5rem',
            background: 'rgb(var(--dk-17-24-39))',
            border: '1px solid var(--border-medium)',
            borderRadius: '12px',
            padding: '1rem 1.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            maxWidth: '520px',
            cursor: onSelectMatch ? 'pointer' : 'default',
          }}
          onClick={() => onSelectMatch && onSelectMatch(thirdPlaceMatch)}
        >
          <div className="row row-loose">
            <Award size={22} color="var(--text-muted)" aria-hidden="true" />
            <div>
              <div style={{ fontWeight: 800, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                3rd Place Playoff
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                {thirdPlaceMatch.home_team_name} vs {thirdPlaceMatch.away_team_name}
              </div>
            </div>
          </div>
          <div className="row row-loose">
            <span
              style={{
                fontSize: '1rem',
                fontWeight: 900,
                color: thirdPlaceMatch.status === 'completed' ? 'var(--text-primary)' : 'var(--text-muted)',
              }}
            >
              {thirdPlaceMatch.status === 'completed'
                ? `${thirdPlaceMatch.home_score} - ${thirdPlaceMatch.away_score}`
                : 'VS'}
            </span>
            {isAdmin && <Edit3 size={14} color="var(--club-primary)" />}
          </div>
        </div>
      )}
    </div>
  );
}
