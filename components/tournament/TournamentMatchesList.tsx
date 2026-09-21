'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Match } from '@/lib/supabase/types';
import { Calendar, MapPin, Radio, CheckCircle2, Trophy, Clock, Edit3, ArrowRight } from 'lucide-react';
import { DEFAULT_CREST } from '@/lib/crest';

interface TournamentMatchesListProps {
  matches: Match[];
  clubSlug: string;
  onSelectMatch?: (match: Match) => void;
  isAdmin?: boolean;
}

export default function TournamentMatchesList({
  matches,
  clubSlug,
  onSelectMatch,
  isAdmin = false,
}: TournamentMatchesListProps) {
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Extract available stages
  const availableStages = Array.from(new Set(matches.map(m => m.tournament_stage || 'group')));

  const filteredMatches = matches.filter(m => {
    if (stageFilter !== 'all' && (m.tournament_stage || 'group') !== stageFilter) return false;
    if (statusFilter !== 'all' && m.status !== statusFilter) return false;
    return true;
  });

  if (matches.length === 0) {
    return (
      <div
        style={{
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '14px',
          padding: '3rem',
          textAlign: 'center',
          color: 'var(--text-secondary)',
        }}
      >
        <Calendar size={32} style={{ opacity: 0.4, margin: '0 auto 0.75rem auto' }} />
        <h3 style={{ margin: '0 0 0.5rem 0', color: '#FFFFFF', fontWeight: 800 }}>
          No Tournament Fixtures Scheduled
        </h3>
        <p style={{ margin: 0, fontSize: '0.85rem' }}>
          Generate the tournament tiesheet to create round-by-round match fixtures.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Filter Bar */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.75rem',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '1.25rem',
          padding: '0.75rem 1rem',
          background: 'rgba(15, 23, 42, 0.6)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '12px',
        }}
      >
        {/* Stage Filter Pills */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
          <button
            onClick={() => setStageFilter('all')}
            style={{
              padding: '0.35rem 0.75rem',
              borderRadius: '8px',
              border: stageFilter === 'all' ? '1px solid #10B981' : '1px solid rgba(255, 255, 255, 0.1)',
              background: stageFilter === 'all' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.04)',
              color: stageFilter === 'all' ? '#10B981' : '#FFFFFF',
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            All Stages ({matches.length})
          </button>
          {availableStages.map(stage => {
            const label =
              stage === 'group'
                ? 'Group Stage'
                : stage === 'quarter_final'
                ? 'Quarter-Finals'
                : stage === 'semi_final'
                ? 'Semi-Finals'
                : stage === 'final'
                ? 'Final'
                : stage === 'third_place'
                ? '3rd Place'
                : stage.replace('_', ' ');

            const count = matches.filter(m => (m.tournament_stage || 'group') === stage).length;

            return (
              <button
                key={stage}
                onClick={() => setStageFilter(stage)}
                style={{
                  padding: '0.35rem 0.75rem',
                  borderRadius: '8px',
                  border: stageFilter === stage ? '1px solid #10B981' : '1px solid rgba(255, 255, 255, 0.1)',
                  background: stageFilter === stage ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                  color: stageFilter === stage ? '#10B981' : '#FFFFFF',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                }}
              >
                {label} ({count})
              </button>
            );
          })}
        </div>

        {/* Status Filter */}
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          {(['all', 'live', 'upcoming', 'completed'] as const).map(st => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              style={{
                padding: '0.35rem 0.65rem',
                borderRadius: '6px',
                border: statusFilter === st ? '1px solid var(--club-primary)' : '1px solid rgba(255, 255, 255, 0.08)',
                background: statusFilter === st ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                color: statusFilter === st ? '#FFFFFF' : 'var(--text-secondary)',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
                textTransform: 'capitalize',
              }}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Matches Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 360px), 1fr))',
          gap: '1rem',
        }}
      >
        {filteredMatches.map(match => {
          const isLive = match.status === 'live';
          const isCompleted = match.status === 'completed';

          return (
            <div
              key={match.id}
              style={{
                background: 'rgba(15, 23, 42, 0.75)',
                border: isLive
                  ? '1.5px solid #EF4444'
                  : '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '12px',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: isLive ? '0 0 15px rgba(239, 68, 68, 0.2)' : 'none',
              }}
            >
              {/* Card Header */}
              <div
                style={{
                  padding: '0.65rem 1rem',
                  background: 'rgba(0, 0, 0, 0.35)',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '0.75rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)' }}>
                  <Calendar size={13} />
                  <span>{match.match_date ? match.match_date.slice(0, 10) : 'TBD'}</span>
                  {match.match_time && <span>• {match.match_time}</span>}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  {isLive && (
                    <span
                      style={{
                        color: '#EF4444',
                        fontWeight: 800,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px',
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
                      {match.current_minute}&apos; LIVE
                    </span>
                  )}
                  {isCompleted && (
                    <span
                      style={{
                        color: '#10B981',
                        fontWeight: 800,
                        background: 'rgba(16, 185, 129, 0.1)',
                        padding: '1px 6px',
                        borderRadius: '4px',
                      }}
                    >
                      FT
                    </span>
                  )}
                  {!isLive && !isCompleted && (
                    <span style={{ color: 'var(--text-muted)' }}>Upcoming</span>
                  )}
                </div>
              </div>

              {/* Match Content (Teams & Score) */}
              <div style={{ padding: '1rem', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr auto 1fr',
                    alignItems: 'center',
                    gap: '0.75rem',
                  }}
                >
                  {/* Home Team */}
                  <div style={{ textAlign: 'center' }}>
                    <img
                      src={match.home_team_logo || DEFAULT_CREST}
                      alt={match.home_team_name}
                      style={{ width: '38px', height: '38px', objectFit: 'contain', margin: '0 auto 0.4rem auto' }}
                    />
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: '0.85rem',
                        color: '#FFFFFF',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {match.home_team_name}
                    </div>
                  </div>

                  {/* Score */}
                  <div style={{ textAlign: 'center', minWidth: '70px' }}>
                    {isCompleted || isLive ? (
                      <div>
                        <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#FFFFFF', letterSpacing: '0.05em' }}>
                          {match.home_score} - {match.away_score}
                        </div>
                        {match.home_penalty_score !== undefined && match.away_penalty_score !== undefined && (
                          <div style={{ fontSize: '0.7rem', color: '#F59E0B', fontWeight: 700 }}>
                            ({match.home_penalty_score} - {match.away_penalty_score} pens)
                          </div>
                        )}
                      </div>
                    ) : (
                      <div
                        style={{
                          fontSize: '0.9rem',
                          fontWeight: 800,
                          color: 'var(--text-secondary)',
                          background: 'rgba(255, 255, 255, 0.05)',
                          padding: '0.25rem 0.65rem',
                          borderRadius: '6px',
                        }}
                      >
                        VS
                      </div>
                    )}
                  </div>

                  {/* Away Team */}
                  <div style={{ textAlign: 'center' }}>
                    <img
                      src={match.away_team_logo || DEFAULT_CREST}
                      alt={match.away_team_name}
                      style={{ width: '38px', height: '38px', objectFit: 'contain', margin: '0 auto 0.4rem auto' }}
                    />
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: '0.85rem',
                        color: '#FFFFFF',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {match.away_team_name}
                    </div>
                  </div>
                </div>

                {/* Venue & Title Info */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    fontSize: '0.75rem',
                    color: 'var(--text-muted)',
                    marginTop: '0.75rem',
                  }}
                >
                  <MapPin size={12} />
                  <span>{match.venue || 'Stadium Arena'}</span>
                </div>
              </div>

              {/* Action Footer */}
              <div
                style={{
                  padding: '0.65rem 1rem',
                  background: 'rgba(0, 0, 0, 0.25)',
                  borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.5rem',
                }}
              >
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                  {match.tournament_group || (match.tournament_stage ? match.tournament_stage.replace('_', ' ').toUpperCase() : 'Match')}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {isAdmin && onSelectMatch && (
                    <button
                      onClick={() => onSelectMatch(match)}
                      className="btn btn-sm btn-secondary"
                      style={{
                        padding: '0.3rem 0.6rem',
                        fontSize: '0.75rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                        background: 'rgba(255, 255, 255, 0.08)',
                        color: '#FFFFFF',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        borderRadius: '6px',
                        cursor: 'pointer',
                      }}
                    >
                      <Edit3 size={12} color="#10B981" />
                      <span>Update Score</span>
                    </button>
                  )}

                  <Link
                    href={`/${clubSlug}/match/${match.id}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      fontSize: '0.75rem',
                      color: 'var(--club-primary)',
                      textDecoration: 'none',
                      fontWeight: 700,
                    }}
                  >
                    <span>Match Center</span>
                    <ArrowRight size={12} />
                  </Link>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
