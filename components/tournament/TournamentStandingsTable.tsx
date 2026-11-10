'use client';

import React from 'react';
import { TournamentStanding } from '@/lib/supabase/types';
import { Trophy } from 'lucide-react';
import { DEFAULT_CREST } from '@/lib/crest';

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
          background: 'rgba(var(--tint-rgb), 0.02)',
          border: '1px solid rgba(var(--tint-rgb), 0.08)',
          borderRadius: '12px',
          padding: '2.5rem',
          textAlign: 'center',
          color: 'var(--text-secondary)',
        }}
      >
        <Trophy size={28} style={{ opacity: 0.3, margin: '0 auto 0.75rem auto' }} />
        <p style={{ margin: 0, fontWeight: 600 }}>No games played yet.</p>
        <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>The table fills in as results come in.</span>
      </div>
    );
  }

  return (
    <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
      {/* Table Header / Title */}
      {groupTitle && (
        <div
          style={{
            padding: '0.9rem 1.25rem',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div className="row">
            <span style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-primary)' }}>{groupTitle}</span>
          </div>
          <div className="text-meta">
            3 points for a win, 1 for a draw
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
                background: 'rgba(var(--shade-rgb), 0.35)',
                borderBottom: '1px solid rgba(var(--tint-rgb), 0.08)',
                color: 'var(--text-secondary)',
                fontSize: '0.75rem',
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
              <th style={{ padding: '0.75rem 0.9rem', textAlign: 'center', width: '55px' }}>Pts</th>
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
                    borderBottom: '1px solid rgba(var(--tint-rgb), 0.04)',
                    background: 'transparent',
                    transition: 'background 0.15s ease',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(var(--tint-rgb), 0.04)')}
                  onMouseLeave={e =>
                    (e.currentTarget.style.background = 'transparent')
                  }
                >
                  {/* Position / Rank */}
                  {/* Teams going through get a bar in the club's colour (explained under the table) */}
                  <td style={{
                    padding: '0.85rem 1rem', textAlign: 'center', fontFamily: 'var(--font-mono)', fontWeight: 600,
                    color: 'var(--text-secondary)', boxShadow: isAdvancing ? 'inset 3px 0 0 var(--club-primary)' : undefined,
                  }}>
                    {rank}
                  </td>

                  {/* Team Crest & Name */}
                  <td style={{ padding: '0.85rem 1rem' }}>
                    <div className="row row-loose">
                      <img loading="lazy" decoding="async" width={26} height={26}
                        src={team.logo_url || DEFAULT_CREST}
                        alt={`${team.name} crest`}
                        style={{ width: '26px', height: '26px', objectFit: 'contain', flexShrink: 0 }}
                      />
                      <span style={{ fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                        {team.name}
                      </span>
                    </div>
                  </td>

                  {/* P */}
                  <td style={{ padding: '0.85rem 0.6rem', textAlign: 'center', color: 'var(--text-primary)' }}>
                    {team.played}
                  </td>
                  {/* W */}
                  <td style={{ padding: '0.85rem 0.6rem', textAlign: 'center', color: 'var(--text-primary)' }}>
                    {team.won}
                  </td>
                  {/* D */}
                  <td style={{ padding: '0.85rem 0.6rem', textAlign: 'center', color: 'var(--text-primary)' }}>
                    {team.drawn}
                  </td>
                  {/* L */}
                  <td style={{ padding: '0.85rem 0.6rem', textAlign: 'center', color: 'var(--text-primary)' }}>
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
                      color: 'var(--text-secondary)',
                    }}
                  >
                    {team.goal_difference > 0 ? `+${team.goal_difference}` : team.goal_difference}
                  </td>
                  {/* Points */}
                  <td
                    style={{
                      padding: '0.85rem 0.9rem',
                      textAlign: 'center',
                      fontWeight: 800,
                      fontSize: '0.95rem',
                      color: 'var(--text-primary)',
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
                            // Green means a win; a draw is grey and a loss just an outline, so the guide reads at a glance
                            const look: React.CSSProperties = res === 'W'
                              ? { background: 'var(--c-green)', color: '#FFFFFF' }
                              : res === 'D'
                              ? { background: 'rgba(var(--tint-rgb), 0.18)', color: 'var(--text-primary)' }
                              : { background: 'transparent', color: 'var(--text-secondary)', boxShadow: 'inset 0 0 0 1px var(--border-medium)' };
                            return (
                              <span
                                key={fIdx}
                                style={{
                                  width: '18px',
                                  height: '18px',
                                  borderRadius: '4px',
                                  ...look,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '0.7rem',
                                  fontWeight: 900,
                                }}
                              >
                                {res}
                              </span>
                            );
                          })
                        ) : (
                          <span className="text-meta">-</span>
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
      {advancingCount > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.7rem 1.25rem', borderTop: '1px solid var(--border-subtle)', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          <span aria-hidden="true" style={{ width: '3px', height: '14px', borderRadius: '2px', background: 'var(--club-primary)' }} />
          Top {advancingCount} go through to the knockouts
        </div>
      )}
    </div>
  );
}
