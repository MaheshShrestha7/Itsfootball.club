'use client';

import React, { useState, use } from 'react';
import Link from 'next/link';
import { useClub } from '@/lib/club-context';
import VirtualPassCard from '@/components/VirtualPassCard';
import QRScannerModal from '@/components/QRScannerModal';
import {
  Shield,
  CreditCard,
  Trophy,
  Activity,
  Calendar,
  CheckCircle2,
  ArrowLeft,
  QrCode,
  Sparkles,
  Users,
  Award,
  Flame,
  Crown,
  Zap,
  TrendingUp,
  History
} from 'lucide-react';

export default function MemberPortalPage({
  params,
}: {
  params: Promise<{ clubSlug: string }>;
}) {
  const resolvedParams = use(params);
  const { clubs, selectClubBySlug, members, playerStats, getMemberClubScore, getMemberActivityLogs } = useClub();

  const club = selectClubBySlug(resolvedParams.clubSlug) || clubs[0];
  const clubMembers = members.filter(m => m.club_id === club.id);

  // Selected member to inspect in the virtual portal
  const [selectedMemberId, setSelectedMemberId] = useState<string>(clubMembers[4]?.id || clubMembers[0]?.id || '');
  const [scannerOpen, setScannerOpen] = useState(false);

  const currentMember = clubMembers.find(m => m.id === selectedMemberId) || clubMembers[0];
  const currentStats = playerStats.find(s => s.member_id === currentMember?.id);
  const currentClubScore = getMemberClubScore(currentMember?.id);
  const memberActivityLogs = getMemberActivityLogs(currentMember?.id);

  return (
    <div style={{ padding: '3rem 0 5rem 0' }}>
      <div className="container">
        {/* Top Header */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          marginBottom: '2rem',
          borderBottom: '1px solid var(--border-subtle)',
          paddingBottom: '1.5rem',
        }}>
          <div>
            <Link
              href={`/${club.slug}`}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '0.5rem' }}
            >
              <ArrowLeft size={16} />
              <span>Back to {club.name}</span>
            </Link>
            <h1 style={{ fontSize: '2.2rem', fontWeight: 900, color: '#FFFFFF' }}>
              Member Digital Clubhouse & Matchday Pass
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Official matchday season pass, player stats, and stadium gate turnstile access.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              onClick={() => setScannerOpen(true)}
              className="btn btn-secondary btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', border: '1px solid rgba(16, 185, 129, 0.4)' }}
            >
              <QrCode size={16} color="var(--club-primary)" />
              <span>Turnstile Gate Scanner</span>
            </button>
          </div>
        </div>

        {/* Member Selector Switcher (Demonstration tool) */}
        <div className="glass-panel" style={{ padding: '1rem 1.25rem', marginBottom: '2.5rem' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
              Viewing Club Member Profile:
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {clubMembers.slice(0, 6).map(m => (
                <button
                  key={m.id}
                  onClick={() => setSelectedMemberId(m.id)}
                  style={{
                    padding: '0.35rem 0.75rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border-subtle)',
                    background: selectedMemberId === m.id ? 'var(--club-primary)' : 'rgba(255, 255, 255, 0.05)',
                    color: selectedMemberId === m.id ? '#FFFFFF' : 'var(--text-secondary)',
                    fontWeight: 700,
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                  }}
                >
                  <span>{m.full_name}</span>
                  <span style={{ opacity: 0.75, fontSize: '0.7rem' }}>({m.player_position || 'Staff'})</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Main Grid: Virtual Pass Left + Stats & Activity Right */}
        {currentMember && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
            gap: '3rem',
            alignItems: 'flex-start',
          }}>
            {/* Left: The Tactile Virtual Member Pass */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ width: '100%', maxWidth: '380px' }}>
                <VirtualPassCard club={club} member={currentMember} />
              </div>
            </div>

            {/* Right: Player Statistics & Attendance History */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              {/* Gamification & ClubScore Progress Hub */}
              {currentClubScore && (
                <div className="glass-panel" style={{ padding: '2rem', position: 'relative', overflow: 'hidden' }}>
                  <div style={{
                    position: 'absolute',
                    top: '-15%',
                    right: '-10%',
                    width: '240px',
                    height: '240px',
                    background: 'radial-gradient(circle, rgba(245, 158, 11, 0.15) 0%, transparent 70%)',
                    pointerEvents: 'none'
                  }} />

                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.5rem' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.3rem' }}>
                        <span className="badge badge-gold" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          <Zap size={12} fill="#F59E0B" /> CLUBSCORE FANTASY
                        </span>
                        <span className="badge" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#60A5FA' }}>
                          {currentClubScore.season}
                        </span>
                      </div>
                      <h3 style={{ fontSize: '1.35rem', fontWeight: 900, color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Trophy size={20} color="#F59E0B" />
                        <span>Level & Attendance Streak Hub</span>
                      </h3>
                    </div>

                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      background: 'rgba(245, 158, 11, 0.12)',
                      border: '1px solid rgba(245, 158, 11, 0.3)',
                      padding: '0.4rem 0.8rem',
                      borderRadius: '8px',
                    }}>
                      <Crown size={16} color="#F59E0B" />
                      <span style={{ fontWeight: 800, color: '#F59E0B', fontSize: '0.85rem' }}>
                        {currentClubScore.tier}
                      </span>
                    </div>
                  </div>

                  {/* Level Progress Bar */}
                  <div style={{ marginBottom: '1.75rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        Current Season Points: <strong style={{ color: '#FFFFFF', fontSize: '0.95rem' }}>{currentClubScore.total_points} PTS</strong>
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Next Tier: {currentClubScore.tier === 'Club Legend' ? 'Max Rank (500+ PTS)' : currentClubScore.tier === 'All-Star' ? '500 PTS (Club Legend)' : currentClubScore.tier === 'First Team' ? '300 PTS (All-Star)' : '150 PTS (First Team)'}
                      </span>
                    </div>

                    <div style={{ width: '100%', height: '10px', background: 'rgba(0,0,0,0.4)', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
                      <div
                        style={{
                          height: '100%',
                          width: `${Math.min(100, Math.max(15, (currentClubScore.total_points / 500) * 100))}%`,
                          background: 'linear-gradient(90deg, var(--club-primary) 0%, #F59E0B 100%)',
                          borderRadius: '6px',
                          transition: 'width 0.5s ease',
                        }}
                      />
                    </div>
                  </div>

                  {/* Streak and Multiplier Highlights */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                    gap: '1rem',
                    marginBottom: '1.75rem'
                  }}>
                    <div style={{ background: 'rgba(0,0,0,0.25)', padding: '1rem', borderRadius: '10px', border: '1px solid var(--border-subtle)', textAlign: 'center' }}>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Active Streak</div>
                      <div style={{ fontFamily: 'var(--font-heading)', fontSize: '1.75rem', fontWeight: 900, color: '#EF4444', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem' }}>
                        <Flame size={20} color="#EF4444" fill="#EF4444" />
                        <span>{currentClubScore.current_streak}w</span>
                      </div>
                      <div style={{ fontSize: '0.7rem', color: '#10B981', marginTop: '2px', fontWeight: 600 }}>
                        {currentClubScore.current_streak >= 10 ? '+50% Point Multiplier' : currentClubScore.current_streak >= 5 ? '+25% Point Multiplier' : currentClubScore.current_streak >= 3 ? '+15% Multiplier' : 'Standard 1.0x'}
                      </div>
                    </div>

                    <div style={{ background: 'rgba(0,0,0,0.25)', padding: '1rem', borderRadius: '10px', border: '1px solid var(--border-subtle)', textAlign: 'center' }}>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>This Week</div>
                      <div style={{ fontFamily: 'var(--font-heading)', fontSize: '1.75rem', fontWeight: 900, color: '#10B981' }}>
                        +{currentClubScore.weekly_points}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        Rolling 7-Day PTS
                      </div>
                    </div>

                    <div style={{ background: 'rgba(0,0,0,0.25)', padding: '1rem', borderRadius: '10px', border: '1px solid var(--border-subtle)', textAlign: 'center' }}>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Best Streak</div>
                      <div style={{ fontFamily: 'var(--font-heading)', fontSize: '1.75rem', fontWeight: 900, color: '#F59E0B' }}>
                        {currentClubScore.highest_streak}w
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        Career Record
                      </div>
                    </div>
                  </div>

                  {/* Badges Trophy Shelf */}
                  <div style={{ marginBottom: '1.75rem' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#FFFFFF', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Award size={16} color="#F59E0B" />
                      <span>Unlocked Achievement Badges ({currentClubScore.badges.length})</span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.6rem' }}>
                      {currentClubScore.badges.map(badge => (
                        <div
                          key={badge.id}
                          style={{
                            background: 'rgba(255,255,255,0.03)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: '8px',
                            padding: '0.65rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                          }}
                        >
                          <div style={{
                            width: '30px',
                            height: '30px',
                            borderRadius: '6px',
                            background: 'rgba(0,0,0,0.4)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            {badge.icon === 'flame' && <Flame size={16} color="#EF4444" />}
                            {badge.icon === 'shield' && <Shield size={16} color="#3B82F6" />}
                            {badge.icon === 'crown' && <Crown size={16} color="#F59E0B" />}
                            {badge.icon === 'sparkles' && <Sparkles size={16} color="#EC4899" />}
                            {badge.icon === 'award' && <Award size={16} color="#10B981" />}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 700, fontSize: '0.78rem', color: '#FFFFFF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {badge.name}
                            </div>
                            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Achieved</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Member Activity Point Feed */}
                  <div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#FFFFFF', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <History size={16} color="var(--club-primary)" />
                      <span>Recent Activity & Points Ledger</span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '180px', overflowY: 'auto' }}>
                      {memberActivityLogs.slice(0, 5).map(log => (
                        <div
                          key={log.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '0.55rem 0.85rem',
                            background: 'rgba(0,0,0,0.2)',
                            borderRadius: '6px',
                            border: '1px solid var(--border-subtle)',
                            fontSize: '0.8rem',
                          }}
                        >
                          <div>
                            <div style={{ color: '#FFFFFF', fontWeight: 600 }}>{log.description}</div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>
                              {new Date(log.created_at).toLocaleDateString()}
                            </div>
                          </div>
                          <span style={{ fontWeight: 900, color: log.final_points >= 0 ? '#10B981' : '#EF4444' }}>
                            {log.final_points >= 0 ? `+${log.final_points}` : log.final_points} PTS
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Season Stats Card */}
              <div className="glass-panel" style={{ padding: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Activity size={20} color="var(--club-primary)" />
                    <span>Season Performance (2025/2026)</span>
                  </h3>
                  <span className="badge badge-primary">SENIOR ROSTER</span>
                </div>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
                  gap: '1rem',
                  marginBottom: '1.5rem',
                }}>
                  <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '12px', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Appearances</div>
                    <div style={{ fontFamily: 'var(--font-heading)', fontSize: '1.8rem', fontWeight: 900, color: '#FFFFFF' }}>
                      {currentStats?.appearances || 0}
                    </div>
                  </div>

                  <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '12px', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Goals</div>
                    <div style={{ fontFamily: 'var(--font-heading)', fontSize: '1.8rem', fontWeight: 900, color: '#10B981' }}>
                      {currentStats?.goals || 0}
                    </div>
                  </div>

                  <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '12px', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Assists</div>
                    <div style={{ fontFamily: 'var(--font-heading)', fontSize: '1.8rem', fontWeight: 900, color: '#F59E0B' }}>
                      {currentStats?.assists || 0}
                    </div>
                  </div>

                  <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '12px', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Clean Sheets</div>
                    <div style={{ fontFamily: 'var(--font-heading)', fontSize: '1.8rem', fontWeight: 900, color: '#3B82F6' }}>
                      {currentStats?.clean_sheets || 0}
                    </div>
                  </div>

                  <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '12px', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>MOTM Awards</div>
                    <div style={{ fontFamily: 'var(--font-heading)', fontSize: '1.8rem', fontWeight: 900, color: '#A855F7' }}>
                      {currentStats?.motm_awards || 0}
                    </div>
                  </div>

                  <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '12px', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Discipline</div>
                    <div style={{ fontFamily: 'var(--font-heading)', fontSize: '1.2rem', fontWeight: 900, color: '#EF4444', marginTop: '6px' }}>
                      {currentStats?.yellow_cards || 0}Y • {currentStats?.red_cards || 0}R
                    </div>
                  </div>
                </div>

                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Total Playing Minutes: <strong style={{ color: '#FFFFFF' }}>{currentStats?.minutes_played || 0} mins</strong>
                </div>
              </div>

              {/* Turnstile QR Check-in & Event Log */}
              <div className="glass-panel" style={{ padding: '2rem' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#FFFFFF', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <CheckCircle2 size={20} color="#10B981" />
                  <span>Verified Match & Event Check-In Stamps</span>
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {[
                    { title: 'Championship Match vs Metro Rovers', venue: club.stadium_name, date: 'Today • 14:15', status: 'Gate 2 Validated' },
                    { title: 'First Team Tactical Training', venue: 'Training Pitch 1', date: '3 days ago', status: 'Coach Verified' },
                    { title: 'Pre-Season Medical & Fitness Check', venue: 'Apex Medical Suite', date: '12 days ago', status: 'Accredited' },
                  ].map((log, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.75rem 1rem',
                        background: 'rgba(0, 0, 0, 0.25)',
                        borderRadius: '8px',
                        border: '1px solid var(--border-subtle)',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, color: '#FFFFFF', fontSize: '0.9rem' }}>{log.title}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{log.venue} • {log.date}</div>
                      </div>
                      <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10B981', fontSize: '0.7rem' }}>
                        {log.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* QR Scanner Reticle Modal */}
      <QRScannerModal
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        mode="verify_pass"
      />
    </div>
  );
}
