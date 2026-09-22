'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Shield,
  MapPin,
  Calendar,
  Users,
  Trophy,
  Flame,
  Award,
  ExternalLink,
  Database
} from 'lucide-react';
import { Club, ClubMember, Match, ClubEvent, Sponsor, PlayerStats } from '@/lib/supabase/types';

interface ClubIdentitySectionProps {
  club: Club;
  members: ClubMember[];
  matches: Match[];
  events: ClubEvent[];
  sponsors: Sponsor[];
  playerStats?: PlayerStats[];
  onOpenContactModal?: () => void;
}

interface DynamicIdentityStats {
  totalMembers: number;
  totalPlayers: number;
  matchesPlayed: number;
  eventsCount: number;
  sponsorsCount: number;
  goalsScored: number;
  currentSeason: string;
  source: 'supabase_raw_dataset' | 'client_context_raw' | 'loading';
}

/**
 * AnimatedCounter: Eased count-up ticker triggered once section is in viewport.
 * Uses cubic-bezier ease-out (0.16, 1, 0.3, 1) and respects prefers-reduced-motion.
 */
function AnimatedCounter({
  value,
  duration = 850,
  enabled = true,
}: {
  value: number;
  duration?: number;
  enabled?: boolean;
}) {
  const [displayCount, setDisplayCount] = useState(0);

  useEffect(() => {
    // Immediate fallback for prefers-reduced-motion or zero values
    if (
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      setDisplayCount(value);
      return;
    }

    if (!enabled || value === 0) {
      setDisplayCount(value);
      return;
    }

    let startTimestamp: number | null = null;
    let animationFrameId: number;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      // Snappy cubic ease-out curve
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(easeProgress * value);
      setDisplayCount(current);

      if (progress < 1) {
        animationFrameId = window.requestAnimationFrame(step);
      } else {
        setDisplayCount(value);
      }
    };

    animationFrameId = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(animationFrameId);
  }, [value, duration, enabled]);

  return <>{displayCount.toLocaleString()}</>;
}

export default function ClubIdentitySection({
  club,
  members,
  matches,
  events,
  sponsors,
}: ClubIdentitySectionProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const [isInView, setIsInView] = useState(false);
  const [hoveredCardIndex, setHoveredCardIndex] = useState<number | null>(null);

  // Compute immediate raw arithmetic values from context dataset as ground truth
  const clubId = club.id;
  const rawClubMembers = members.filter(m => m.club_id === clubId);
  const rawTotalMembers = rawClubMembers.length;
  const rawTotalPlayers = rawClubMembers.filter(
    m => m.role === 'player' || Boolean(m.player_position)
  ).length;

  const rawClubMatches = matches.filter(m => m.club_id === clubId);
  const rawPlayedMatches = rawClubMatches.filter(
    m => m.status === 'completed' || m.status === 'live' || m.status === 'halftime'
  );
  const rawMatchesPlayed = rawPlayedMatches.length;

  const rawCurrentSeason = rawPlayedMatches[0]?.season || '2025/2026';
  const rawSeasonMatches = rawPlayedMatches.filter(
    m => !m.season || m.season === rawCurrentSeason
  );
  const rawGoalsScored = rawSeasonMatches.reduce((acc, m) => {
    const scored = m.is_club_home ? (m.home_score ?? 0) : (m.away_score ?? 0);
    return acc + scored;
  }, 0);

  const rawEventsCount = events.filter(e => e.club_id === clubId).length;
  const rawSponsorsCount = sponsors.filter(s => s.club_id === clubId && s.is_active !== false).length;

  // Real-time dynamic stats state initialized with exact raw counts
  const [stats, setStats] = useState<DynamicIdentityStats>({
    totalMembers: rawTotalMembers,
    totalPlayers: rawTotalPlayers,
    matchesPlayed: rawMatchesPlayed,
    eventsCount: rawEventsCount,
    sponsorsCount: rawSponsorsCount,
    goalsScored: rawGoalsScored,
    currentSeason: rawCurrentSeason,
    source: 'client_context_raw',
  });

  // IntersectionObserver to trigger count-up and entrance stagger
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const currentRef = sectionRef.current;
    if (!currentRef) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );

    observer.observe(currentRef);
    return () => observer.disconnect();
  }, []);

  // Fetch verified raw dataset directly from server-side Supabase API
  useEffect(() => {
    let isMounted = true;
    async function fetchSupabaseStats() {
      try {
        const res = await fetch(`/api/clubs/${encodeURIComponent(club.slug)}/identity-stats`);
        if (!res.ok) return;
        const json = await res.json();
        if (json.success && json.stats && isMounted) {
          setStats({
            totalMembers: json.stats.totalMembers,
            totalPlayers: json.stats.totalPlayers,
            matchesPlayed: json.stats.matchesPlayed,
            eventsCount: json.stats.eventsCount,
            sponsorsCount: json.stats.sponsorsCount,
            goalsScored: json.stats.goalsScored,
            currentSeason: json.stats.currentSeason || rawCurrentSeason,
            source: 'supabase_raw_dataset',
          });
        }
      } catch (err) {
        console.warn('[ClubIdentitySection] Failed to fetch Supabase stats, retaining verified context counts', err);
      }
    }

    fetchSupabaseStats();
    return () => {
      isMounted = false;
    };
  }, [club.slug, club.id, rawCurrentSeason]);

  // Keep stats reactive if local context updates
  useEffect(() => {
    if (stats.source !== 'supabase_raw_dataset') {
      setStats({
        totalMembers: rawTotalMembers,
        totalPlayers: rawTotalPlayers,
        matchesPlayed: rawMatchesPlayed,
        eventsCount: rawEventsCount,
        sponsorsCount: rawSponsorsCount,
        goalsScored: rawGoalsScored,
        currentSeason: rawCurrentSeason,
        source: 'client_context_raw',
      });
    }
  }, [
    rawTotalMembers,
    rawTotalPlayers,
    rawMatchesPlayed,
    rawEventsCount,
    rawSponsorsCount,
    rawGoalsScored,
    rawCurrentSeason,
    stats.source,
  ]);

  const primaryColor = club.primary_color || '#10B981';

  // Configured stat cards data
  const statCards = [
    {
      id: 'members',
      label: 'Total Members',
      sublabel: 'Registered Club Members',
      value: stats.totalMembers,
      icon: Users,
      accentColor: primaryColor,
      isHighlight: false,
    },
    {
      id: 'players',
      label: 'Total Players',
      sublabel: 'Senior & Roster Athletes',
      value: stats.totalPlayers,
      icon: Shield,
      accentColor: primaryColor,
      isHighlight: false,
    },
    {
      id: 'matches',
      label: 'Matches Played',
      sublabel: 'Completed & In-Play Fixtures',
      value: stats.matchesPlayed,
      icon: Trophy,
      accentColor: '#F59E0B',
      isHighlight: false,
    },
    {
      id: 'goals',
      label: 'Goals Scored',
      sublabel: `Season ${stats.currentSeason} Total`,
      value: stats.goalsScored,
      icon: Flame,
      accentColor: '#F59E0B',
      isHighlight: true, // Emotional centerpiece
    },
    {
      id: 'events',
      label: 'Events & Trials',
      sublabel: 'Scheduled Sessions & AGMs',
      value: stats.eventsCount,
      icon: Calendar,
      accentColor: primaryColor,
      isHighlight: false,
    },
    {
      id: 'sponsors',
      label: 'Sponsors Count',
      sublabel: 'Commercial Partners',
      value: stats.sponsorsCount,
      icon: Award,
      accentColor: primaryColor,
      isHighlight: false,
    },
  ];

  return (
    <section
      ref={sectionRef}
      id="club-identity"
      aria-label={`${club.name} Impact & Identity`}
      style={{
        position: 'relative',
        padding: '3.5rem 0 3.25rem 0',
        background: 'linear-gradient(180deg, rgba(14, 20, 30, 0.96) 0%, rgba(8, 12, 18, 0.99) 100%)',
        borderBottom: '1px solid var(--border-subtle)',
        overflow: 'hidden',
        scrollMarginTop: '90px',
      }}
    >
      {/* Dynamic Keyframes & Scoped Animation Styles */}
      <style>{`
        @keyframes goalsBreathingGlow {
          0%, 100% {
            box-shadow: 0 4px 16px rgba(0,0,0,0.4), 0 0 16px rgba(245, 158, 11, 0.16);
            border-color: rgba(245, 158, 11, 0.38);
          }
          50% {
            box-shadow: 0 6px 24px rgba(0,0,0,0.5), 0 0 28px rgba(245, 158, 11, 0.32);
            border-color: rgba(245, 158, 11, 0.65);
          }
        }

        @keyframes badgeSyncFlash {
          0% {
            transform: scale(0.97);
            background: rgba(16, 185, 129, 0.1);
          }
          50% {
            transform: scale(1.02);
            background: rgba(16, 185, 129, 0.25);
            box-shadow: 0 0 14px rgba(16, 185, 129, 0.4);
          }
          100% {
            transform: scale(1);
            background: rgba(16, 185, 129, 0.1);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .impact-stat-card, .impact-section-header, .goals-highlight-card {
            animation: none !important;
            transition: none !important;
            transform: none !important;
            opacity: 1 !important;
          }
        }
      `}</style>

      {/* Ambient background glow matching club primary color */}
      <div
        style={{
          position: 'absolute',
          top: '-120px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '700px',
          height: '280px',
          background: `radial-gradient(circle, ${primaryColor}22 0%, transparent 70%)`,
          filter: 'blur(60px)',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      <div className="container" style={{ position: 'relative', zIndex: 1 }}>
        {/* HEADER WITH METADATA & LIVE SOURCE STATUS */}
        <div
          className="impact-section-header"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1.25rem',
            marginBottom: '1.75rem',
            opacity: isInView ? 1 : 0,
            transform: isInView ? 'translateY(0)' : 'translateY(8px)',
            transition: 'opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1), transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
              <span className="badge badge-primary" style={{ fontSize: '0.7rem', padding: '0.25rem 0.65rem' }}>
                EST. {club.founded_year || 2018}
              </span>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#FFFFFF' }}>{club.name}</span>
              {club.motto && (
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                  • &ldquo;{club.motto}&rdquo;
                </span>
              )}
            </div>
            <h2
              style={{
                fontSize: 'clamp(1.6rem, 3.2vw, 2.3rem)',
                fontWeight: 900,
                letterSpacing: '-0.02em',
                color: '#FFFFFF',
                margin: 0,
              }}
            >
              Club&apos;s Impact in Numbers
            </h2>
          </div>

          {/* Live Data Badge with Pulse */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.4rem 0.95rem',
              borderRadius: '20px',
              background: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              fontSize: '0.75rem',
              fontWeight: 700,
              color: '#10B981',
              animation: stats.source === 'supabase_raw_dataset' ? 'badgeSyncFlash 0.6s ease-out' : 'none',
              transition: 'all 0.25s ease',
            }}
          >
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: '#10B981',
                boxShadow: '0 0 8px #10B981',
                display: 'inline-block',
                animation: 'pulse 2s infinite',
              }}
            />
            <Database size={13} />
            <span>
              {stats.source === 'supabase_raw_dataset'
                ? 'Verified Live Data • Supabase Database'
                : 'Live Registry Synced • Dynamic Counts'}
            </span>
          </div>
        </div>

        {/* DYNAMIC LIVE STATS 6-METRIC GRID WITH COUNT-UP TICKER & ENTRANCE STAGGER */}
        <div className="club-impact-grid">
          {statCards.map((card, idx) => {
            const Icon = card.icon;
            const isHovered = hoveredCardIndex === idx;
            const delayMs = idx * 40; // 0ms, 40ms, 80ms, 120ms, 160ms, 200ms

            return (
              <div
                key={card.id}
                className={`glass-panel impact-stat-card ${card.isHighlight ? 'goals-highlight-card' : ''}`}
                onMouseEnter={() => setHoveredCardIndex(idx)}
                onMouseLeave={() => setHoveredCardIndex(null)}
                style={{
                  padding: '1.25rem',
                  border: card.isHighlight
                    ? isHovered
                      ? `1px solid rgba(245, 158, 11, 0.8)`
                      : `1px solid rgba(245, 158, 11, 0.38)`
                    : isHovered
                    ? `1px solid ${card.accentColor}80`
                    : '1px solid rgba(255, 255, 255, 0.09)',
                  background: card.isHighlight
                    ? isHovered
                      ? 'rgba(32, 26, 20, 0.95)'
                      : 'rgba(25, 22, 18, 0.82)'
                    : isHovered
                    ? 'rgba(24, 34, 48, 0.88)'
                    : 'rgba(18, 26, 38, 0.75)',
                  boxShadow: isHovered
                    ? `0 14px 30px rgba(0,0,0,0.55), 0 0 20px ${card.accentColor}30`
                    : card.isHighlight
                    ? '0 4px 16px rgba(0,0,0,0.4), 0 0 16px rgba(245, 158, 11, 0.16)'
                    : 'none',
                  transform: isHovered
                    ? 'translateY(-4px)'
                    : isInView
                    ? 'translateY(0)'
                    : 'translateY(12px)',
                  opacity: isInView ? 1 : 0,
                  transition: `opacity 0.45s cubic-bezier(0.16, 1, 0.3, 1) ${delayMs}ms, transform 0.45s cubic-bezier(0.16, 1, 0.3, 1) ${delayMs}ms, border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease`,
                  animation: card.isHighlight && isInView && !isHovered ? 'goalsBreathingGlow 4s infinite ease-in-out' : 'none',
                  cursor: 'default',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {/* Header: Label & Icon badge */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '0.65rem',
                  }}
                >
                  <span
                    style={{
                      fontSize: '0.68rem',
                      fontWeight: 800,
                      color: card.isHighlight ? '#F59E0B' : 'var(--text-muted)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      transition: 'color 0.2s ease',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {card.label}
                  </span>

                  {/* Icon badge with hover scale */}
                  <div
                    style={{
                      padding: '5px',
                      borderRadius: '8px',
                      background: card.isHighlight
                        ? 'rgba(245, 158, 11, 0.16)'
                        : isHovered
                        ? `${card.accentColor}25`
                        : 'rgba(255,255,255,0.06)',
                      transform: isHovered ? 'scale(1.12)' : 'scale(1)',
                      transition: 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), background 0.2s ease',
                      flexShrink: 0,
                    }}
                  >
                    <Icon size={15} color={card.accentColor} />
                  </div>
                </div>

                {/* Number with smooth Eased Count-Up Ticker */}
                <div
                  className="impact-stat-value"
                  style={{
                    fontSize: '2rem',
                    fontWeight: 900,
                    color: '#FFFFFF',
                    lineHeight: 1,
                    letterSpacing: '-0.02em',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  <AnimatedCounter value={card.value} enabled={isInView} duration={850} />
                </div>

                {/* Subtext */}
                <div
                  style={{
                    fontSize: '0.72rem',
                    color: card.isHighlight ? '#F59E0B' : 'var(--text-muted)',
                    marginTop: '0.45rem',
                    fontWeight: card.isHighlight ? 700 : 500,
                    lineHeight: 1.3,
                  }}
                >
                  {card.sublabel}
                </div>
              </div>
            );
          })}
        </div>

        {/* HOME GROUND SPECIFICATIONS SUB-PANEL */}
        <div
          className="glass-panel stadium-subpanel"
          style={{
            padding: '1.25rem 1.75rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1.25rem',
            background: 'rgba(12, 17, 26, 0.85)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            opacity: isInView ? 1 : 0,
            transform: isInView ? 'translateY(0)' : 'translateY(8px)',
            transition: 'opacity 0.45s cubic-bezier(0.16, 1, 0.3, 1) 240ms, transform 0.45s cubic-bezier(0.16, 1, 0.3, 1) 240ms',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                background: `rgba(var(--club-primary-rgb), 0.15)`,
                border: `1px solid ${primaryColor}40`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'transform 0.2s ease',
                flexShrink: 0,
              }}
            >
              <MapPin size={20} color={primaryColor} />
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 800 }}>
                Official Home Ground
              </div>
              <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#FFFFFF' }}>
                {club.stadium_name}
                {club.stadium_address && (
                  <span style={{ fontSize: '0.82rem', fontWeight: 500, color: 'var(--text-muted)', marginLeft: '0.6rem' }}>
                    • {club.stadium_address}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="stadium-specs-group" style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
            {club.stadium_pitch_type && (
              <div className="stadium-spec-item" style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                  Pitch Surface
                </div>
                <div style={{ fontSize: '0.92rem', fontWeight: 800, color: primaryColor }}>
                  {club.stadium_pitch_type}
                </div>
              </div>
            )}

            {club.stadium_address && (
              <a
                href={`https://maps.google.com/?q=${encodeURIComponent(club.stadium_address)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary btn-sm touch-target"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  transition: 'transform 0.15s ease, background 0.15s ease',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
                }}
              >
                <span>Directions</span>
                <ExternalLink size={13} />
              </a>
            )}
          </div>
        </div>

        <style jsx>{`
          .club-impact-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
            gap: 1.15rem;
            margin-bottom: 2rem;
          }
          @media (max-width: 640px) {
            .club-impact-grid {
              grid-template-columns: repeat(2, 1fr) !important;
              gap: 0.65rem !important;
            }
            .impact-stat-card {
              padding: 0.9rem 0.8rem !important;
            }
            .impact-stat-value {
              font-size: 1.55rem !important;
            }
            .stadium-subpanel {
              padding: 1.1rem 1rem !important;
              flex-direction: column !important;
              align-items: flex-start !important;
              gap: 1rem !important;
            }
            .stadium-specs-group {
              width: 100% !important;
              justify-content: space-between !important;
            }
            .stadium-spec-item {
              text-align: left !important;
            }
          }
        `}</style>
      </div>
    </section>
  );
}
