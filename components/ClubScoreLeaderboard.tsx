'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Club, ClubMember, ClubScoreProfile, GamificationActivityLog } from '@/lib/supabase/types';
import { useClub } from '@/lib/club-context';
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
  CheckCircle2,
  Zap
} from 'lucide-react';

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
  const { activityLogs } = useClub();
  const [filter, setFilter] = useState<'season' | 'weekly' | 'streak'>('season');
  const [selectedPlayerModal, setSelectedPlayerModal] = useState<{
    member: ClubMember;
    profile: ClubScoreProfile;
    logs: GamificationActivityLog[];
  } | null>(null);

  // Filter & sort leaderboard
  const sortedProfiles = [...profiles]
    .filter(p => p.club_id === club.id)
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
      case 'flame': return <Flame size={16} color="#EF4444" />;
      case 'shield': return <Shield size={16} color="#3B82F6" />;
      case 'crown': return <Crown size={16} color="#F59E0B" />;
      case 'sparkles': return <Sparkles size={16} color="#EC4899" />;
      default: return <Award size={16} color="#10B981" />;
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
            <span className="badge badge-gold" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Zap size={12} fill="#F59E0B" /> FANTASY SQUAD LEAGUE
            </span>
            <span className="badge badge-primary">2025/26 ACTIVE</span>
          </div>
          <h3 style={{ fontSize: '1.5rem', fontWeight: 900, color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Trophy size={24} color="#F59E0B" />
            <span>ClubScore Fantasy Standings</span>
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.825rem', marginTop: '2px' }}>
            Combines pitch-side match performance with verified training attendance streaks.
          </p>
        </div>

        {/* Metric Selector Buttons */}
        <div style={{ display: 'flex', background: 'rgba(0,0,0,0.4)', padding: '0.25rem', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
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
            <span>This Week's MVP</span>
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

      {/* Leaderboard Rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {sortedProfiles.map((profile, idx) => {
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
                background: isTopThree ? 'rgba(245, 158, 11, 0.04)' : 'rgba(0,0,0,0.25)',
                cursor: 'pointer',
              }}
            >
              {/* Left Side: Rank, Player Details & Tier */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', minWidth: 0 }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: idx === 0 ? '#F59E0B' : idx === 1 ? '#94A3B8' : idx === 2 ? '#B45309' : 'rgba(255,255,255,0.08)',
                  color: idx < 3 ? '#000000' : '#FFFFFF',
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
                  <img
                    src={player.photo_url}
                    alt={player.full_name}
                    style={{ width: '42px', height: '42px', borderRadius: '10px', objectFit: 'cover', border: '1px solid var(--border-subtle)' }}
                  />
                  {profile.current_streak >= 3 && (
                    <div style={{
                      position: 'absolute',
                      bottom: '-4px',
                      right: '-4px',
                      background: '#0F172A',
                      borderRadius: '50%',
                      padding: '2px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '1px solid #EF4444'
                    }}>
                      <Flame size={12} color="#EF4444" fill="#EF4444" />
                    </div>
                  )}
                </div>

                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 800, color: '#FFFFFF', fontSize: '1rem' }}>
                      {player.full_name}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      #{player.jersey_number} • {player.player_position}
                    </span>
                    <span
                      className="badge"
                      style={{
                        background: `${tierColor}18`,
                        color: tierColor,
                        border: `1px solid ${tierColor}40`,
                        fontSize: '0.65rem',
                        padding: '0.15rem 0.4rem',
                      }}
                    >
                      {profile.tier}
                    </span>
                  </div>

                  {/* Badges preview row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '3px' }}>
                    {profile.current_streak > 0 && (
                      <span style={{ fontSize: '0.72rem', color: '#EF4444', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                        <Flame size={12} color="#EF4444" />
                        {profile.current_streak}-week streak
                      </span>
                    )}
                    {profile.badges.length > 0 && (
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
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
                    color: filter === 'streak' ? '#EF4444' : filter === 'weekly' ? '#10B981' : 'var(--club-primary)'
                  }}>
                    {filter === 'season' && `${profile.total_points} PTS`}
                    {filter === 'weekly' && `+${profile.weekly_points} PTS`}
                    {filter === 'streak' && `${profile.current_streak} WEEKS`}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    {filter === 'season' ? 'Season Fantasy Total' : filter === 'weekly' ? 'Earned This Week' : `Best: ${profile.highest_streak} weeks`}
                  </div>
                </div>

                <div style={{ color: 'var(--text-muted)' }}>
                  <ChevronRight size={18} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer Info Box: Gamification Explanation */}
      <div style={{
        marginTop: '2rem',
        padding: '1rem 1.25rem',
        borderRadius: '8px',
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid var(--border-subtle)',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          <Sparkles size={16} color="#F59E0B" />
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
                background: 'rgba(255,255,255,0.08)',
                border: 'none',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#FFFFFF',
                cursor: 'pointer'
              }}
            >
              <X size={16} />
            </button>

            {/* Player Profile Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
              <img
                src={selectedPlayerModal.member.photo_url}
                alt={selectedPlayerModal.member.full_name}
                style={{ width: '64px', height: '64px', borderRadius: '12px', objectFit: 'cover', border: '2px solid var(--club-primary)' }}
              />
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#FFFFFF' }}>
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
              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.75rem', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>SEASON PTS</div>
                <div style={{ fontWeight: 900, fontSize: '1.3rem', color: 'var(--club-primary)' }}>
                  {selectedPlayerModal.profile.total_points}
                </div>
              </div>

              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.75rem', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>THIS WEEK</div>
                <div style={{ fontWeight: 900, fontSize: '1.3rem', color: '#10B981' }}>
                  +{selectedPlayerModal.profile.weekly_points}
                </div>
              </div>

              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.75rem', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>STREAK</div>
                <div style={{ fontWeight: 900, fontSize: '1.3rem', color: '#EF4444', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.2rem' }}>
                  <Flame size={16} color="#EF4444" fill="#EF4444" />
                  <span>{selectedPlayerModal.profile.current_streak}w</span>
                </div>
              </div>
            </div>

            {/* Badges Earned Showcase */}
            <div style={{ marginBottom: '1.75rem' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#FFFFFF', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Award size={16} color="#F59E0B" />
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
                        background: 'rgba(255,255,255,0.03)',
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
                        background: 'rgba(0,0,0,0.4)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        {getBadgeIcon(badge.icon)}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: '0.75rem', color: '#FFFFFF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {badge.name}
                        </div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Verified</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Activity Ledger Feed */}
            <div>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#FFFFFF', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
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
                        background: 'rgba(0,0,0,0.2)',
                        borderRadius: '6px',
                        border: '1px solid var(--border-subtle)',
                        fontSize: '0.78rem',
                      }}
                    >
                      <div style={{ minWidth: 0, paddingRight: '0.5rem' }}>
                        <div style={{ color: '#FFFFFF', fontWeight: 600 }}>{log.description}</div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.68rem' }}>
                          {new Date(log.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      <div style={{
                        fontWeight: 900,
                        color: log.final_points >= 0 ? '#10B981' : '#EF4444',
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
