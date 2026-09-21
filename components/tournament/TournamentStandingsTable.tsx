'use client';

import React from 'react';
import { TournamentStanding } from '@/lib/supabase/types';
import { Trophy, CheckCircle2 } from 'lucide-react';

interface TournamentStandingsTableProps {
  standings: TournamentStanding[];
  groupTitle?: string;
  advancingCount?: number;
  showForm?: boolean;
}

export default function TournamentStandingsTable({
  standings,
  groupTitle,
  advancingCount = 2,
  showForm = true,
}: TournamentStandingsTableProps) {
  if (!standings || standings.length === 0) {
    return (
      <div
        style={{
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '12px',
          padding: '2.5rem',
          textAlign: 'center',
          color: 'var(--text-secondary)',
        }}
      >
        <Trophy size={28} style={{ opacity: 0.3, margin: '0 auto 0.75rem auto' }} />
        <p style={{ margin: 0, fontWeight: 600 }}>No participant standings calculated yet.</p>
        <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>Points table updates automatically as matches are played.</span>
      </div>
    );
  }

  return (
    <div
      style={{
        background: 'rgba(15, 23, 42, 0.75)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '14px',
        overflow: 'hidden',
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.4)',
      }}
    >
      {/* Table Header / Title */}
      {groupTitle && (
        <div
          style={{
            padding: '0.9rem 1.25rem',
            background: 'rgba(255, 255, 255, 0.03)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontWeight: 800, fontSize: '0.95rem', color: '#FFFFFF' }}>{groupTitle}</span>
            {advancingCount > 0 && (
              <span
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  color: '#10B981',
                  background: 'rgba(16, 185, 129, 0.12)',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                  padding: '2px 8px',
                  borderRadius: '10px',
                }}
              >
                Top {advancingCount} Advance to KO
              </span>
            )}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            FIFA Rules • 3 PTS Win / 1 PTS Draw
          </div>
        </div>
      )}

      {/* Table Container with smooth mobile scroll */}
      <div className="admin-table-container" style={{ width: '100%', overflowX: 'auto' }}>
        <table
          style={{
            width: '100%',
            minWidth: '640px',
            borderCollapse: 'collapse',
            fontSize: '0.85rem',
            textAlign: 'left',
          }}
        >
          <thead>
            <tr
              style={{
                background: 'rgba(0, 0, 0, 0.35)',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                color: 'var(--text-secondary)',
                fontSize: '0.75rem',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              <th style={{ padding: '0.75rem 1rem', width: '45px', textAlign: 'center' }}>#</th>
              <th style={{ padding: '0.75rem 1rem' }}>Team</th>
              <th style={{ padding: '0.75rem 0.6rem', textAlign: 'center', width: '42px' }}>P</th>
              <th style={{ padding: '0.75rem 0.6rem', textAlign: 'center', width: '42px' }}>W</th>
              <th style={{ padding: '0.75rem 0.6rem', textAlign: 'center', width: '42px' }}>D</th>
              <th style={{ padding: '0.75rem 0.6rem', textAlign: 'center', width: '42px' }}>L</th>
              <th style={{ padding: '0.75rem 0.6rem', textAlign: 'center', width: '45px' }}>GF</th>
              <th style={{ padding: '0.75rem 0.6rem', textAlign: 'center', width: '45px' }}>GA</th>
              <th style={{ padding: '0.75rem 0.6rem', textAlign: 'center', width: '48px' }}>GD</th>
              <th style={{ padding: '0.75rem 0.9rem', textAlign: 'center', width: '55px', color: '#10B981', fontWeight: 800 }}>PTS</th>
              {showForm && (
                <th style={{ padding: '0.75rem 1rem', textAlign: 'center', width: '120px' }}>Form</th>
              )}
            </tr>
          </thead>
          <tbody>
            {standings.map((team, idx) => {
              const rank = idx + 1;
              const isAdvancing = advancingCount > 0 && rank <= advancingCount;

              return (
                <tr
                  key={team.team_id || team.name}
                  style={{
                    borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                    background: isAdvancing ? 'rgba(16, 185, 129, 0.03)' : 'transparent',
                    transition: 'background 0.15s ease',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)')}
                  onMouseLeave={e =>
                    (e.currentTarget.style.background = isAdvancing ? 'rgba(16, 185, 129, 0.03)' : 'transparent')
                  }
                >
                  {/* Position / Rank */}
                  <td style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>
                    <div
                      style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '6px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 800,
                        fontSize: '0.75rem',
                        background: isAdvancing ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                        color: isAdvancing ? '#10B981' : 'var(--text-secondary)',
                        border: isAdvancing ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid transparent',
                      }}
                    >
                      {rank}
                    </div>
                  </td>

                  {/* Team Crest & Name */}
                  <td style={{ padding: '0.85rem 1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                      <img
                        src={team.logo_url || '/crests/apex-city.svg'}
                        alt={team.name}
                        style={{ width: '26px', height: '26px', objectFit: 'contain', flexShrink: 0 }}
                      />
                      <span style={{ fontWeight: 700, color: '#FFFFFF', whiteSpace: 'nowrap' }}>
                        {team.name}
                      </span>
                      {isAdvancing && (
                        <CheckCircle2
                          size={13}
                          color="#10B981"
                          style={{ flexShrink: 0, opacity: 0.85 }}
                        />
                      )}
                    </div>
                  </td>

                  {/* P */}
                  <td style={{ padding: '0.85rem 0.6rem', textAlign: 'center', color: '#E2E8F0' }}>
                    {team.played}
                  </td>
                  {/* W */}
                  <td style={{ padding: '0.85rem 0.6rem', textAlign: 'center', color: '#10B981', fontWeight: 600 }}>
                    {team.won}
                  </td>
                  {/* D */}
                  <td style={{ padding: '0.85rem 0.6rem', textAlign: 'center', color: '#F59E0B' }}>
                    {team.drawn}
                  </td>
                  {/* L */}
                  <td style={{ padding: '0.85rem 0.6rem', textAlign: 'center', color: '#EF4444' }}>
                    {team.lost}
                  </td>
                  {/* GF */}
                  <td style={{ padding: '0.85rem 0.6rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    {team.goals_for}
                  </td>
                  {/* GA */}
                  <td style={{ padding: '0.85rem 0.6rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    {team.goals_against}
                  </td>
                  {/* GD */}
                  <td
                    style={{
                      padding: '0.85rem 0.6rem',
                      textAlign: 'center',
                      fontWeight: 700,
                      color:
                        team.goal_difference > 0
                          ? '#10B981'
                          : team.goal_difference < 0
                          ? '#EF4444'
                          : 'var(--text-secondary)',
                    }}
                  >
                    {team.goal_difference > 0 ? `+${team.goal_difference}` : team.goal_difference}
                  </td>
                  {/* Points */}
                  <td
                    style={{
                      padding: '0.85rem 0.9rem',
                      textAlign: 'center',
                      fontWeight: 900,
                      fontSize: '0.95rem',
                      color: '#10B981',
                      background: 'rgba(16, 185, 129, 0.07)',
                    }}
                  >
                    {team.points}
                  </td>

                  {/* Form Pills */}
                  {showForm && (
                    <td style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px' }}>
                        {team.form.length > 0 ? (
                          team.form.map((res, fIdx) => {
                            const bg =
                              res === 'W' ? '#10B981' : res === 'D' ? '#F59E0B' : '#EF4444';
                            return (
                              <span
                                key={fIdx}
                                style={{
                                  width: '18px',
                                  height: '18px',
                                  borderRadius: '4px',
                                  background: bg,
                                  color: '#000000',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '0.65rem',
                                  fontWeight: 900,
                                }}
                              >
                                {res}
                              </span>
                            );
                          })
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>-</span>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
