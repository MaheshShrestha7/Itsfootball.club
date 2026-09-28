'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Club, ClubMember, ClubScoreProfile, GamificationActivityLog } from '@/lib/supabase/types';
import { useClub } from '@/lib/club-context';
import { defaultSeasonLabel } from '@/lib/season';
import {
  Trophy,
  Flame,
  Award,
  Sparkles,
  Shield,
  Crown,
  ChevronRight,
  TrendingUp,
  History,
  X,
  Zap
} from 'lucide-react';
import PlayerAvatar from './PlayerAvatar';
import LocalTime from './LocalTime';

interface ClubScoreLeaderboardProps {
  club: Club;
  members: ClubMember[];
  profiles: ClubScoreProfile[];
}

export default function ClubScoreLeaderboard({
  club,
  members,
  profiles,
}: ClubScoreLeaderboardProps) {
  const { activityLogs, getActiveSeason } = useClub();
  const [filter, setFilter] = useState<'season' | 'weekly' | 'streak'>('season');
  const [selectedPlayerModal, setSelectedPlayerModal] = useState<{
    member: ClubMember;
    profile: ClubScoreProfile;
    logs: GamificationActivityLog[];
  } | null>(null);

  // Profiles are per season: pick one (the active season, else the latest one with scores)
  const clubProfiles = profiles.filter(p => p.club_id === club.id && members.some(m => m.id === p.member_id));
  const seasons = Array.from(new Set(clubProfiles.map(p => p.season).filter(Boolean))).sort().reverse();
  const activeSeasonName = getActiveSeason(club.id)?.name;
  const defaultSeason = activeSeasonName && seasons.includes(activeSeasonName) ? activeSeasonName : seasons[0] || '';
  const [seasonChoice, setSeasonChoice] = useState<string | null>(null);
  const season = seasonChoice !== null && seasons.includes(seasonChoice) ? seasonChoice : defaultSeason;
  const [showAll, setShowAll] = useState(false);
  const TOP_COUNT = 5;

  // Filter & sort leaderboard
  const sortedProfiles = clubProfiles
    .filter(p => !season || p.season === season)
    .sort((a, b) => {
      if (filter === 'season') return b.total_points - a.total_points;
      if (filter === 'weekly') return b.weekly_points - a.weekly_points;
      return b.current_streak - a.current_streak;
    });

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'Club Legend': return '#F59E0B'; // Gold
      case 'All-Star': return '#A855F7'; // Purple
      case 'First Team': return '#3B82F6'; // Blue
      case 'Prospect': return '#10B981'; // Green
      default: return '#94A3B8'; // Slate
    }
  };

  const getBadgeIcon = (iconName: string) => {
    switch (iconName) {
      case 'flame': return <Flame size={16} color="var(--c-red)" />;
      case 'shield': return <Shield size={16} color="var(--c-blue)" />;
      case 'crown': return <Crown size={16} color="var(--c-amber)" />;
      case 'sparkles': return <Sparkles size={16} color="#EC4899" />;
      default: return <Award size={16} color="var(--c-green)" />;
    }
  };

  return (
    <div className="glass-panel" style={{ padding: '2rem', position: 'relative', overflow: 'hidden' }}>
      {/* Background Accent Glow */}
      <div style={{
        position: 'absolute',
        top: '-10%',
        right: '-5%',
        width: '280px',
        height: '280px',
        background: 'radial-gradient(circle, rgba(245, 158, 11, 0.12) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* Header & Tabs */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1.25rem',
        marginBottom: '2rem',
        borderBottom: '1px solid var(--border-subtle)',
        paddingBottom: '1.25rem',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <span className="badge badge-gold row row-tight">
              <Zap size={12} fill="#F59E0B" /> FANTASY SQUAD LEAGUE
            </span>
            <span className="badge badge-primary">{getActiveSeason(club.id)?.name || defaultSeasonLabel()} ACTIVE</span>
          </div>
          <h3 style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Trophy size={24} color="var(--c-amber)" />
            <span>ClubScore Fantasy Standings</span>
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.825rem', marginTop: '2px' }}>
            Combines pitch-side match performance with verified training attendance streaks.
          </p>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.75rem' }}>
        {seasons.length > 1 && (
          <select
            aria-label="Season"
            className="form-select"
            value={season}
            onChange={e => { setSeasonChoice(e.target.value); setShowAll(false); }}
            style={{ width: 'auto', padding: '0.45rem 0.75rem', fontSize: '0.8rem' }}
          >
            {seasons.map(s => <option key={s} value={s}>{s}{s === activeSeasonName ? ' (current)' : ''}</option>)}
          </select>
        )}

        {/* Metric Selector Buttons */}
        <div style={{ display: 'flex', background: 'rgba(var(--shade-rgb), 0.4)', padding: '0.25rem', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
          <button
            id="tab-clubscore-season"
            onClick={() => setFilter('season')}
            style={{
              padding: '0.45rem 0.9rem',
              borderRadius: '6px',
              border: 'none',
              background: filter === 'season' ? 'var(--club-primary)' : 'transparent',
              color: filter === 'season' ? '#FFFFFF' : 'var(--text-muted)',
              fontWeight: 700,
              fontSize: '0.75rem',
              cursor: 'pointer',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem'
            }}
          >
            <Trophy size={13} />
            <span>Season Overall</span>
          </button>

          <button
            id="tab-clubscore-weekly"
            onClick={() => setFilter('weekly')}
            style={{
              padding: '0.45rem 0.9rem',
              borderRadius: '6px',
              border: 'none',
              background: filter === 'weekly' ? 'var(--club-primary)' : 'transparent',
              color: filter === 'weekly' ? '#FFFFFF' : 'var(--text-muted)',
              fontWeight: 700,
              fontSize: '0.75rem',
              cursor: 'pointer',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem'
            }}
          >
            <TrendingUp size={13} />
            <span>This Week&apos;s MVP</span>
          </button>

          <button
            id="tab-clubscore-streak"
            onClick={() => setFilter('streak')}
            style={{
              padding: '0.45rem 0.9rem',
              borderRadius: '6px',
              border: 'none',
              background: filter === 'streak' ? 'var(--club-primary)' : 'transparent',
              color: filter === 'streak' ? '#FFFFFF' : 'var(--text-muted)',
              fontWeight: 700,
              fontSize: '0.75rem',
              cursor: 'pointer',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem'
            }}
          >
            <Flame size={13} color={filter === 'streak' ? '#FFFFFF' : '#EF4444'} />
            <span>Iron Streaks</span>
          </button>
        </div>
        </div>
      </div>

      {/* Leaderboard Rows */}
      <div className="stack stack-sm">
        {sortedProfiles.length === 0 && (
          <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            No ClubScore points recorded{season ? ` for ${season}` : ''} yet.
          </div>
        )}
        {(showAll ? sortedProfiles : sortedProfiles.slice(0, TOP_COUNT)).map((profile, idx) => {
          const player = members.find(m => m.id === profile.member_id);
          if (!player) return null;

          const isTopThree = idx < 3;
          const tierColor = getTierColor(profile.tier);

          return (
            <div
              key={profile.id}
              onClick={() => {
                const logs = activityLogs.filter(l => l.member_id === player.id);
                setSelectedPlayerModal({ member: player, profile, logs });
              }}
              className="glass-panel glass-panel-interactive"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.9rem 1.25rem',
                borderRadius: '10px',
                border: isTopThree ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid var(--border-subtle)',
                background: isTopThree ? 'rgba(245, 158, 11, 0.04)' : 'rgba(var(--shade-rgb), 0.25)',
                cursor: 'pointer',
              }}
            >
              {/* Left Side: Rank, Player Details & Tier */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', minWidth: 0 }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: idx === 0 ? '#F59E0B' : idx === 1 ? '#94A3B8' : idx === 2 ? '#B45309' : 'rgba(var(--tint-rgb), 0.08)',
                  color: idx < 3 ? '#000000' : 'var(--text-primary)',
                  fontWeight: 900,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.85rem',
                  flexShrink: 0
                }}>
                  {idx + 1}
                </div>

                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <PlayerAvatar photoUrl={player.photo_url} name={player.full_name} size={42} style={{ borderRadius: '10px', border: '1px solid var(--border-subtle)' }} />
                  {profile.current_streak >= 3 && (
                    <div style={{
                      position: 'absolute',
                      bottom: '-4px',
                      right: '-4px',
                      background: 'rgb(var(--dk-15-23-42))',
                      borderRadius: '50%',
                      padding: '2px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '1px solid #EF4444'
                    }}>
                      <Flame size={12} color="var(--c-red)" fill="#EF4444" />
                    </div>
                  )}
                </div>

                <div className="min-w-0">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '1rem' }}>
                      {player.full_name}
                    </span>
                    <span className="text-meta">
                      #{player.jersey_number} • {player.player_position}
                    </span>
                    <span
                      className="badge"
                      style={{
                        background: `${tierColor}18`,
                        color: `color-mix(in srgb, ${tierColor}, var(--text-primary) var(--accent-ink))`,
                        border: `1px solid ${tierColor}40`,
                        fontSize: '0.7rem',
                        padding: '0.15rem 0.4rem',
                      }}
                    >
                      {profile.tier}
                    </span>
                  </div>

                  {/* Badges preview row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '3px' }}>
                    {profile.current_streak > 0 && (
                      <span style={{ fontSize: '0.72rem', color: 'var(--c-red)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                        <Flame size={12} color="var(--c-red)" />
                        {profile.current_streak}-week streak
                      </span>
                    )}
                    {profile.badges.length > 0 && (
                      <span className="text-meta">
                        • {profile.badges.length} {profile.badges.length === 1 ? 'badge' : 'badges'}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Side: Points & Click Prompt */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexShrink: 0 }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{
                    fontFamily: 'var(--font-heading)',
                    fontWeight: 900,
                    fontSize: '1.45rem',
                    color: filter === 'streak' ? 'var(--c-red)' : filter === 'weekly' ? 'var(--c-green)' : 'var(--club-primary)'
                  }}>
                    {filter === 'season' && `${profile.total_points} PTS`}
                    {filter === 'weekly' && `+${profile.weekly_points} PTS`}
                    {filter === 'streak' && `${profile.current_streak} WEEKS`}
                  </div>
                  <div className="text-meta">
                    {filter === 'season' ? 'Season Fantasy Total' : filter === 'weekly' ? 'Earned This Week' : `Best: ${profile.highest_streak} weeks`}
                  </div>
                </div>

                <div className="text-muted">
                  <ChevronRight size={18} />
                </div>
              </div>
            </div>
          );
        })}
        {sortedProfiles.length > TOP_COUNT && (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setShowAll(v => !v)}
            aria-expanded={showAll}
            style={{ alignSelf: 'center', marginTop: '0.25rem' }}
          >
            {showAll ? `Show top ${TOP_COUNT} only` : `Show full standings (${sortedProfiles.length})`}
          </button>
        )}
      </div>

      {/* Footer Info Box: Gamification Explanation */}
      <div style={{
        marginTop: '2rem',
        padding: '1rem 1.25rem',
        borderRadius: '8px',
        background: 'rgba(var(--tint-rgb), 0.02)',
        border: '1px solid var(--border-subtle)',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          <Sparkles size={16} color="var(--c-amber)" />
          <span>
            <strong>How points work:</strong> Match Goals (+10), Assists (+7), Clean Sheets (+10), Training QR Check-Ins (+10). Consistent 3+ week streaks unlock up to <strong>1.5x multiplier bonuses</strong>.
          </span>
        </div>
        <Link
          href={`/${club.slug}/member`}
          className="btn btn-secondary btn-sm"
          style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem' }}
        >
          <span>View My Pass & Score</span>
          <ChevronRight size={14} />
        </Link>
      </div>

      {/* Modal: Player Point Breakdown & Ledger Audit */}
      {selectedPlayerModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(0,0,0,0.85)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem',
          }}
          onClick={() => setSelectedPlayerModal(null)}
        >
          <div
            className="glass-panel"
            style={{
              maxWidth: '520px',
              width: '100%',
              padding: '2rem',
              maxHeight: '90vh',
              overflowY: 'auto',
              position: 'relative'
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={() => setSelectedPlayerModal(null)}
              style={{
                position: 'absolute',
                top: '1.25rem',
                right: '1.25rem',
                background: 'rgba(var(--tint-rgb), 0.08)',
                border: 'none',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-primary)',
                cursor: 'pointer'
              }}
            >
              <X size={16} />
            </button>

            {/* Player Profile Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
              <PlayerAvatar photoUrl={selectedPlayerModal.member.photo_url} name={selectedPlayerModal.member.full_name} size={64} eager style={{ borderRadius: '12px', border: '2px solid var(--club-primary)' }} />
              <div>
                <div className="row">
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    {selectedPlayerModal.member.full_name}
                  </h3>
                  <span
                    className="badge"
                    style={{
                      background: `${getTierColor(selectedPlayerModal.profile.tier)}18`,
                      color: getTierColor(selectedPlayerModal.profile.tier),
                      border: `1px solid ${getTierColor(selectedPlayerModal.profile.tier)}40`,
                      fontSize: '0.7rem'
                    }}
                  >
                    {selectedPlayerModal.profile.tier}
                  </span>
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  #{selectedPlayerModal.member.jersey_number} • {selectedPlayerModal.member.player_position} • {club.name}
                </div>
              </div>
            </div>

            {/* Fantasy Stat Summary Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '0.75rem',
              marginBottom: '1.75rem'
            }}>
              <div style={{ background: 'rgba(var(--shade-rgb), 0.3)', padding: '0.75rem', borderRadius: '8px', textAlign: 'center' }}>
                <div className="text-meta">SEASON PTS</div>
                <div style={{ fontWeight: 900, fontSize: '1.3rem', color: 'var(--club-primary)' }}>
                  {selectedPlayerModal.profile.total_points}
                </div>
              </div>

              <div style={{ background: 'rgba(var(--shade-rgb), 0.3)', padding: '0.75rem', borderRadius: '8px', textAlign: 'center' }}>
                <div className="text-meta">THIS WEEK</div>
                <div style={{ fontWeight: 900, fontSize: '1.3rem', color: 'var(--c-green)' }}>
                  +{selectedPlayerModal.profile.weekly_points}
                </div>
              </div>

              <div style={{ background: 'rgba(var(--shade-rgb), 0.3)', padding: '0.75rem', borderRadius: '8px', textAlign: 'center' }}>
                <div className="text-meta">STREAK</div>
                <div style={{ fontWeight: 900, fontSize: '1.3rem', color: 'var(--c-red)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.2rem' }}>
                  <Flame size={16} color="var(--c-red)" fill="#EF4444" />
                  <span>{selectedPlayerModal.profile.current_streak}w</span>
                </div>
              </div>
            </div>

            {/* Badges Earned Showcase */}
            <div style={{ marginBottom: '1.75rem' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Award size={16} color="var(--c-amber)" />
                <span>Unlocked Achievement Badges ({selectedPlayerModal.profile.badges.length})</span>
              </div>

              {selectedPlayerModal.profile.badges.length === 0 ? (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  No badges unlocked yet. Attend 5 consecutive trainings to unlock the Iron Man badge!
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.6rem' }}>
                  {selectedPlayerModal.profile.badges.map(badge => (
                    <div
                      key={badge.id}
                      style={{
                        background: 'rgba(var(--tint-rgb), 0.03)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '8px',
                        padding: '0.6rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                      }}
                    >
                      <div style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '6px',
                        background: 'rgba(var(--shade-rgb), 0.4)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        {getBadgeIcon(badge.icon)}
                      </div>
                      <div className="min-w-0">
                        <div style={{ fontWeight: 700, fontSize: '0.75rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {badge.name}
                        </div>
                        <div className="text-meta">Verified</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Activity Ledger Feed */}
            <div>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <History size={16} color="var(--club-primary)" />
                <span>Recent Point Audit Trail</span>
              </div>

              {selectedPlayerModal.logs.length === 0 ? (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  No recent logged activity.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '200px', overflowY: 'auto' }}>
                  {selectedPlayerModal.logs.slice(0, 6).map(log => (
                    <div
                      key={log.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.5rem 0.75rem',
                        background: 'rgba(var(--shade-rgb), 0.2)',
                        borderRadius: '6px',
                        border: '1px solid var(--border-subtle)',
                        fontSize: '0.78rem',
                      }}
                    >
                      <div style={{ minWidth: 0, paddingRight: '0.5rem' }}>
                        <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{log.description}</div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>
                          <LocalTime value={log.created_at} />
                        </div>
                      </div>
                      <div style={{
                        fontWeight: 900,
                        color: log.final_points >= 0 ? 'var(--c-green)' : 'var(--c-red)',
                        whiteSpace: 'nowrap'
                      }}>
                        {log.final_points >= 0 ? `+${log.final_points}` : log.final_points} PTS
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
