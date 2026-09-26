'use client';

import React from 'react';
import { Match } from '@/lib/supabase/types';
import { STAGE_TITLES } from '@/lib/tournament-engine';
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
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '16px',
          padding: '3rem',
          textAlign: 'center',
          color: 'var(--text-secondary)',
        }}
      >
        <Trophy size={36} style={{ opacity: 0.3, margin: '0 auto 1rem auto' }} />
        <h3 style={{ margin: '0 0 0.5rem 0', color: '#FFFFFF', fontWeight: 800 }}>
          No Knockout Tiesheet Generated Yet
        </h3>
        <p style={{ margin: 0, fontSize: '0.85rem' }}>
          Generate the tournament tiesheet or complete group stage fixtures to unlock the knockout bracket.
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
    <div style={{ width: '100%' }}>
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
                    background:
                      rIdx === totalRounds - 1
                        ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(16, 185, 129, 0.15) 100%)'
                        : 'rgba(255, 255, 255, 0.03)',
                    borderRadius: '10px',
                    border:
                      rIdx === totalRounds - 1
                        ? '1px solid rgba(245, 158, 11, 0.4)'
                        : '1px solid rgba(255, 255, 255, 0.06)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
                    {rIdx === totalRounds - 1 && <Trophy size={15} color="#F59E0B" />}
                    <span
                      style={{
                        fontWeight: 800,
                        fontSize: '0.85rem',
                        color: rIdx === totalRounds - 1 ? '#F59E0B' : '#FFFFFF',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}
                    >
                      {heading}
                    </span>
                  </div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
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
                          background: 'linear-gradient(145deg, #111827 0%, #0F172A 100%)',
                          border: isLive
                            ? '1.5px solid #EF4444'
                            : isCompleted
                            ? '1px solid rgba(16, 185, 129, 0.35)'
                            : '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: '12px',
                          overflow: 'hidden',
                          boxShadow: isLive
                            ? '0 0 15px rgba(239, 68, 68, 0.25)'
                            : '0 8px 20px rgba(0, 0, 0, 0.4)',
                          cursor: onSelectMatch ? 'pointer' : 'default',
                          transition: 'transform 0.15s ease, border-color 0.15s ease',
                          position: 'relative',
                        }}
                        onMouseEnter={e => {
                          if (onSelectMatch) {
                            e.currentTarget.style.transform = 'translateY(-2px)';
                            e.currentTarget.style.borderColor = '#10B981';
                          }
                        }}
                        onMouseLeave={e => {
                          if (onSelectMatch) {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.borderColor = isLive
                              ? '#EF4444'
                              : isCompleted
                              ? 'rgba(16, 185, 129, 0.35)'
                              : 'rgba(255, 255, 255, 0.1)';
                          }
                        }}
                      >
                        {/* Match Card Header Info */}
                        <div
                          style={{
                            padding: '0.45rem 0.75rem',
                            background: 'rgba(0, 0, 0, 0.4)',
                            borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            fontSize: '0.7rem',
                          }}
                        >
                          <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>
                            M#{match.tournament_match_number || '-'}
                          </span>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            {isLive && (
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '3px',
                                  color: '#EF4444',
                                  fontWeight: 800,
                                }}
                              >
                                <span
                                  style={{
                                    width: '6px',
                                    height: '6px',
                                    borderRadius: '50%',
                                    background: '#EF4444',
                                    animation: 'pulse 1.5s infinite',
                                  }}
                                />
                                <LiveMinute match={match} />&apos; LIVE
                              </span>
                            )}
                            {isCompleted && (
                              <span style={{ color: '#10B981', fontWeight: 800 }}>
                                FT
                              </span>
                            )}
                            {!isLive && !isCompleted && (
                              <span style={{ color: 'var(--text-secondary)' }}>
                                {match.match_date ? `${match.match_date.slice(5, 10)}${match.match_time ? ` ${match.match_time}` : ''}` : 'Upcoming'}
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
                              background: isHomeWinner ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                              marginBottom: '2px',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
                              <img loading="lazy" decoding="async" width={22} height={22}
                                src={match.home_team_logo || DEFAULT_CREST}
                                alt=""
                                style={{ width: '22px', height: '22px', objectFit: 'contain', flexShrink: 0 }}
                              />
                              <div style={{ minWidth: 0 }}>
                                <div
                                  style={{
                                    fontSize: '0.8rem',
                                    fontWeight: isHomeWinner ? 800 : 600,
                                    color: isHomeWinner ? '#FFFFFF' : isCompleted ? 'rgba(255,255,255,0.6)' : '#FFFFFF',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    maxWidth: '135px',
                                  }}
                                >
                                  {match.home_team_name}
                                </div>
                                {match.home_team_source && (
                                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                    {match.home_team_source}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Score & Penalty indicator */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              {match.home_penalty_score !== undefined && (
                                <span style={{ fontSize: '0.7rem', color: '#F59E0B', fontWeight: 700 }}>
                                  ({match.home_penalty_score})
                                </span>
                              )}
                              <span
                                style={{
                                  fontSize: '0.95rem',
                                  fontWeight: 800,
                                  color: isHomeWinner ? '#10B981' : isCompleted ? '#CBD5E1' : 'var(--text-muted)',
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
                              background: isAwayWinner ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
                              <img loading="lazy" decoding="async" width={22} height={22}
                                src={match.away_team_logo || DEFAULT_CREST}
                                alt=""
                                style={{ width: '22px', height: '22px', objectFit: 'contain', flexShrink: 0 }}
                              />
                              <div style={{ minWidth: 0 }}>
                                <div
                                  style={{
                                    fontSize: '0.8rem',
                                    fontWeight: isAwayWinner ? 800 : 600,
                                    color: isAwayWinner ? '#FFFFFF' : isCompleted ? 'rgba(255,255,255,0.6)' : '#FFFFFF',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    maxWidth: '135px',
                                  }}
                                >
                                  {match.away_team_name}
                                </div>
                                {match.away_team_source && (
                                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                    {match.away_team_source}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Score & Penalty indicator */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              {match.away_penalty_score !== undefined && (
                                <span style={{ fontSize: '0.7rem', color: '#F59E0B', fontWeight: 700 }}>
                                  ({match.away_penalty_score})
                                </span>
                              )}
                              <span
                                style={{
                                  fontSize: '0.95rem',
                                  fontWeight: 800,
                                  color: isAwayWinner ? '#10B981' : isCompleted ? '#CBD5E1' : 'var(--text-muted)',
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
            background: 'rgba(0, 0, 0, 0.35)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Award size={22} color="#F59E0B" />
            <div>
              <div style={{ fontWeight: 800, fontSize: '0.85rem', color: '#FFFFFF' }}>
                3rd Place Playoff
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                {thirdPlaceMatch.home_team_name} vs {thirdPlaceMatch.away_team_name}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span
              style={{
                fontSize: '1rem',
                fontWeight: 900,
                color: thirdPlaceMatch.status === 'completed' ? '#10B981' : 'var(--text-muted)',
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
