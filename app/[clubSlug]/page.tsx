'use client';

import React, { useState, useEffect, use, useMemo } from 'react';
import Link from 'next/link';
import { useClub } from '@/lib/club-context';
import { useAuth } from '@/lib/auth-context';
import ContactModal from '@/components/ContactModal';
import ClubScoreLeaderboard from '@/components/ClubScoreLeaderboard';
import ClubIdentitySection from '@/components/ClubIdentitySection';
import { DEFAULT_CREST } from '@/lib/crest';
import {
  Shield,
  Radio,
  CreditCard,
  Calendar,
  Clock,
  MapPin,
  Trophy,
  Users,
  Award,
  ChevronRight,
  ChevronLeft,
  ExternalLink,
  Mail,
  Flame,
  Play,
  ArrowRight,
  Sparkles,
  Info,
  Zap,
  Pause,
  Newspaper,
  Image as ImageIcon,
  QrCode
} from 'lucide-react';
import { Match, ClubEvent, NewsArticle, isPlayerMember } from '@/lib/supabase/types';
import { getLiveMinute } from '@/lib/match-clock';
import LiveMinute from '@/components/LiveMinute';
import { defaultSeasonLabel } from '@/lib/season';

interface HomeHeroSlide {
  id: string;
  category: 'club' | 'match' | 'news' | 'event' | 'stadium' | 'image';
  tabLabel: string;
  badge: string;
  bgImage: string;
  title: string;
  subtitle: string;
  ctaLabel?: string;
  ctaLink?: string;
  targetMatch?: Match;
  targetNews?: NewsArticle;
  targetEvent?: ClubEvent;
}

export default function ClubPublicPage({
  params,
}: {
  params: Promise<{ clubSlug: string }>;
}) {
  const resolvedParams = use(params);
  const {
    clubs,
    selectClubBySlug,
    isHydrated,
    members,
    playerStats,
    matches,
    events,
    sponsors,
    news,
    gallery,
    clubScoreProfiles,
    seasons,
    getActiveSeason
  } = useClub();

  const matchedClub = selectClubBySlug(resolvedParams.clubSlug);
  // Wait for hydration before falling back to a case-insensitive lookup
  const club = matchedClub || (isHydrated ? clubs.find(c => c.slug.toLowerCase() === resolvedParams.clubSlug.toLowerCase()) || null : null);

  // Squad availability is a coaching tool: only club admins are offered it
  const { hasClubAdminAccess } = useAuth();
  const isClubAdmin = !!club && hasClubAdminAccess(club.id);

  // Canonical URL sync ONLY if accessed via a confirmed older slug alias AND hydrated
  useEffect(() => {
    if (!isHydrated || !club) return;
    const currentParam = resolvedParams.clubSlug.toLowerCase();
    const isOldAlias = Array.isArray(club.previous_slugs) &&
      club.previous_slugs.some(prev => prev.toLowerCase() === currentParam);
    
    if (isOldAlias) {
      window.history.replaceState(null, '', `/${club.slug}`);
    }
  }, [isHydrated, club, resolvedParams.clubSlug]);

  // Tab & Filter states
  const [squadFilter, setSquadFilter] = useState<'ALL' | 'GK' | 'DEF' | 'MID' | 'FWD'>('ALL');
  const [fixturesTab, setFixturesTab] = useState<'upcoming' | 'results'>('upcoming');
  const [fixturesSeasonFilter, setFixturesSeasonFilter] = useState<string>('CURRENT');
  const [leaderboardTab, setLeaderboardTab] = useState<'goals' | 'assists' | 'appearances'>('goals');
  const [leaderboardMode, setLeaderboardMode] = useState<'clubscore' | 'traditional'>('clubscore');
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [activeNewsModal, setActiveNewsModal] = useState<any | null>(null);

  // Hero Slider states
  const [activeSlide, setActiveSlide] = useState(0);
  const [isSliderPaused, setIsSliderPaused] = useState(false);
  const [heroLogoError, setHeroLogoError] = useState(false);

  // Reset logo error whenever club branding updates
  useEffect(() => {
    setHeroLogoError(false);
  }, [club?.logo_url]);

  // Filtered data for this club
  const clubId = club?.id || '';
  const clubSeasons = seasons.filter(s => s.club_id === clubId);
  const activeSeason = getActiveSeason ? getActiveSeason(clubId) : null;
  const clubMembers = members.filter(m => m.club_id === clubId);
  const squadPlayers = clubMembers.filter(m => isPlayerMember(m));
  const executiveStaff = clubMembers.filter(m => m.is_executive).sort((a, b) => (a.executive_order || 99) - (b.executive_order || 99));
  const clubMatches = matches.filter(m => m.club_id === clubId);
  const liveMatch = clubMatches.find(m => m.status === 'live');

  const resolvedSeasonName = fixturesSeasonFilter === 'CURRENT'
    ? (activeSeason?.name || defaultSeasonLabel())
    : fixturesSeasonFilter;

  const filteredClubMatches = clubMatches.filter(m => {
    if (fixturesSeasonFilter === 'ALL') return true;
    return m.season === resolvedSeasonName;
  });

  const upcomingMatches = filteredClubMatches.filter(m => m.status === 'upcoming');
  const pastMatches = filteredClubMatches.filter(m => m.status === 'completed');
  const clubEvents = events.filter(e => e.club_id === clubId);
  // Club-wide showcase only - event-scoped sponsors show on their own event's page instead.
  const clubSponsors = sponsors.filter(s => s.club_id === clubId && !s.event_id);
  const clubNews = news.filter(n => n.club_id === clubId);
  const featuredArticle = clubNews.find(n => n.is_featured) || clubNews[0] || null;

  // Squad filtering
  const filteredSquad = squadPlayers.filter(p => {
    if (squadFilter === 'ALL') return true;
    if (squadFilter === 'GK') return p.player_position === 'GK';
    if (squadFilter === 'DEF') return ['CB', 'LB', 'RB'].includes(p.player_position || '');
    if (squadFilter === 'MID') return ['CDM', 'CM', 'CAM'].includes(p.player_position || '');
    if (squadFilter === 'FWD') return ['LW', 'RW', 'ST'].includes(p.player_position || '');
    return true;
  });

  // Top leaderboard players
  const leaderboardList = [...playerStats]
    .filter(s => s.club_id === clubId)
    .sort((a, b) => {
      if (leaderboardTab === 'goals') return b.goals - a.goals;
      if (leaderboardTab === 'assists') return b.assists - a.assists;
      return b.appearances - a.appearances;
    })
    .slice(0, 5)
    .map(stat => {
      const player = clubMembers.find(m => m.id === stat.member_id);
      return { stat, player };
    });

  // Dynamic multi-slider definition reading admin pinned items or falling back to defaults
  const heroSlides: HomeHeroSlide[] = useMemo(() => {
    if (!club) return [];

    const activePins = (club.hero_pinned_items || []).filter(p => p.is_active);

    if (activePins.length > 0) {
      const pinnedSlides: HomeHeroSlide[] = activePins.map((item, idx) => {
        if (item.type === 'fixture') {
          const matchItem = matches.find(m => m.id === item.target_id) || liveMatch || upcomingMatches[0];
          const isLive = matchItem?.status === 'live';
          const compClean = (!matchItem?.competition || matchItem.competition === 'Premier Regional League')
            ? (matchItem?.match_type ? `${matchItem.match_type.charAt(0).toUpperCase() + matchItem.match_type.slice(1)} Match` : 'Club Friendly')
            : matchItem.competition;
          return {
            id: item.id || `pin-fixture-${idx}`,
            category: 'match',
            tabLabel: item.title ? (item.title.length > 18 ? item.title.substring(0, 16) + '...' : item.title) : 'Fixture',
            badge: item.badge || (isLive ? `MATCHDAY LIVE • ${getLiveMinute(matchItem)}' IN PLAY` : `FIXTURE • ${compClean}`),
            bgImage: item.image_url || 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=1600&auto=format&fit=crop&q=80',
            title: item.title || (matchItem ? `${matchItem.home_team_name} vs ${matchItem.away_team_name}` : `${club.name} Matchday`),
            subtitle: item.subtitle || (matchItem ? `${compClean} • ${matchItem.venue}` : 'Official Club Match Schedule'),
            ctaLabel: item.cta_label || (isLive ? 'Enter Match Center Live' : 'Match Preview & Lineups'),
            ctaLink: item.cta_link || (matchItem ? `/${club.slug}/match/${matchItem.id}` : `/${club.slug}`),
            targetMatch: matchItem,
          };
        }

        if (item.type === 'news') {
          const article = news.find(n => n.id === item.target_id) || featuredArticle;
          return {
            id: item.id || `pin-news-${idx}`,
            category: 'news',
            tabLabel: item.title ? (item.title.length > 18 ? item.title.substring(0, 16) + '...' : item.title) : 'News',
            badge: item.badge || `BREAKING NEWS • ${article?.tags?.[0] || 'FIRST TEAM'}`,
            bgImage: item.image_url || article?.cover_image_url || club.banner_url || 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=1600&auto=format&fit=crop&q=80',
            title: item.title || article?.title || `${club.name} Dispatches`,
            subtitle: item.subtitle || article?.summary || 'Latest match summaries and announcements.',
            ctaLabel: item.cta_label || 'Read Full Story',
            ctaLink: item.cta_link || `/${club.slug}#news`,
            targetNews: article,
          };
        }

        if (item.type === 'event') {
          const evt = events.find(e => e.id === item.target_id) || clubEvents[0];
          return {
            id: item.id || `pin-event-${idx}`,
            category: 'event',
            tabLabel: item.title ? (item.title.length > 18 ? item.title.substring(0, 16) + '...' : item.title) : 'Event',
            badge: item.badge || `UPCOMING EVENT • ${evt?.category?.toUpperCase() || 'CALENDAR'}`,
            bgImage: item.image_url || 'https://images.unsplash.com/photo-1517466787929-bc90951d0974?w=1600&auto=format&fit=crop&q=80',
            title: item.title || evt?.title || `${club.name} Open Event`,
            subtitle: item.subtitle || evt?.description || 'Fan sessions and trial opportunities.',
            ctaLabel: item.cta_label || 'RSVP / Inquire for Event',
            ctaLink: item.cta_link || `/${club.slug}#events`,
            targetEvent: evt,
          };
        }

        // Custom Image / Promo Banner slide
        return {
          id: item.id || `pin-image-${idx}`,
          category: 'image',
          tabLabel: item.title ? (item.title.length > 18 ? item.title.substring(0, 16) + '...' : item.title) : 'Spotlight',
          badge: item.badge || 'SPECIAL FEATURE',
          bgImage: item.image_url || club.banner_url || 'https://images.unsplash.com/photo-1522778119026-d647f0596c20?w=1600&auto=format&fit=crop&q=80',
          title: item.title || `${club.name} Feature`,
          subtitle: item.subtitle || club.motto || 'Strength, Passion, and Football Heritage',
          ctaLabel: item.cta_label || 'Explore Feature',
          ctaLink: item.cta_link || `/${club.slug}`,
        };
      });

      return pinnedSlides;
    }

    // Default dynamic 4-slide carousel when no custom pins are set
    return [
      {
        id: 'matchday-hub',
        category: 'match',
        tabLabel: liveMatch ? 'Matchday Live' : 'Matchday Hub',
        badge: liveMatch
          ? `MATCHDAY LIVE • ${getLiveMinute(liveMatch)}' IN PLAY`
          : upcomingMatches[0]
          ? `UPCOMING FIXTURE • ${(!upcomingMatches[0].competition || upcomingMatches[0].competition === 'Premier Regional League') ? (upcomingMatches[0].match_type ? `${upcomingMatches[0].match_type.toUpperCase()} MATCH` : 'CLUB FRIENDLY') : upcomingMatches[0].competition.toUpperCase()}`
          : 'MATCHDAY HUB',
        bgImage: (club.slider_images && club.slider_images[0]) || club.banner_url || 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=1600&auto=format&fit=crop&q=80',
        title: liveMatch
          ? `${liveMatch.home_team_name} vs ${liveMatch.away_team_name}`
          : upcomingMatches[0]
          ? `${upcomingMatches[0].home_team_name} vs ${upcomingMatches[0].away_team_name}`
          : `${club.name} Matchday Hub`,
        subtitle: liveMatch
          ? `${(!liveMatch.competition || liveMatch.competition === 'Premier Regional League') ? 'Club Match' : liveMatch.competition} • In Play at ${liveMatch.venue}`
          : upcomingMatches[0]
          ? `${(!upcomingMatches[0].competition || upcomingMatches[0].competition === 'Premier Regional League') ? 'Club Fixture' : upcomingMatches[0].competition} • Kickoff Countdown`
          : 'Official Match Schedule & Match Reports',
        targetMatch: liveMatch || upcomingMatches[0],
      },
      {
        id: 'latest-news',
        category: 'news',
        tabLabel: 'Latest News',
        badge: `BREAKING NEWS • ${featuredArticle?.tags?.[0] || 'FIRST TEAM'}`,
        bgImage: featuredArticle?.cover_image_url || club.banner_url || 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=1600&auto=format&fit=crop&q=80',
        title: featuredArticle?.title || `${club.name} First Team Dispatches`,
        subtitle: featuredArticle?.summary || 'Latest match summaries, tactical insights, and club announcements.',
        targetNews: featuredArticle,
      },
      {
        id: 'club-events',
        category: 'event',
        tabLabel: 'Events & Trials',
        badge: `UPCOMING EVENT • ${clubEvents[0]?.category?.toUpperCase() || 'CALENDAR'}`,
        bgImage: club.banner_url || 'https://images.unsplash.com/photo-1517466787929-bc90951d0974?w=1600&auto=format&fit=crop&q=80',
        title: clubEvents[0]?.title || `${club.name} Open Training Session`,
        subtitle: clubEvents[0]?.description || 'Fan sessions, community training camps, and player trial opportunities.',
        targetEvent: clubEvents[0],
      },
      {
        id: 'stadium-atmosphere',
        category: 'stadium',
        tabLabel: 'Home Ground & Fortress',
        badge: `HOME FORTRESS • ${club.stadium_name}`,
        bgImage: (club.slider_images && club.slider_images[1]) || gallery[0]?.media_url || 'https://images.unsplash.com/photo-1489944445391-11dd35366433?w=1600&auto=format&fit=crop&q=80',
        title: club.stadium_name,
        subtitle: club.stadium_pitch_type,
      }
    ];
  }, [club, club?.hero_pinned_items, matches, liveMatch, upcomingMatches, news, featuredArticle, events, clubEvents, gallery]);

  // Autoplay ticker with pause-on-hover
  useEffect(() => {
    if (isSliderPaused || heroSlides.length <= 1) return;
    const interval = setInterval(() => {
      setActiveSlide(prev => (prev + 1) % heroSlides.length);
    }, 6500);
    return () => clearInterval(interval);
  }, [isSliderPaused, heroSlides.length]);

  const currentSlide = heroSlides[activeSlide] || heroSlides[0];

  // Loading state while hydrating
  if (!club) {
    if (!isHydrated) {
      return (
        <div style={{
          minHeight: '70vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1.25rem',
          padding: '2rem',
          textAlign: 'center',
        }}>
          <div style={{
            position: 'relative',
            width: '64px',
            height: '64px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <div style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              border: '3px solid rgba(255,255,255,0.08)',
              borderTopColor: 'var(--club-primary, #10B981)',
              animation: 'spin 0.9s linear infinite',
            }} />
            <Shield size={28} color="var(--club-primary, #10B981)" style={{ opacity: 0.9 }} />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#FFFFFF', letterSpacing: '0.02em' }}>
              Loading Club Headquarters...
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.25rem' }}>
              Syncing matchday lineups, squad rosters, and live turnstiles
            </p>
          </div>
        </div>
      );
    }

    return (
      <div style={{
        minHeight: '70vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1.25rem',
        padding: '3rem 1.5rem',
        textAlign: 'center'
      }}>
        <span className="badge badge-gold">CLUB NOT FOUND</span>
        <h2 style={{ fontSize: '2.2rem', fontWeight: 900 }}>Club Not Found</h2>
        <p style={{ color: 'var(--text-secondary)', maxWidth: '480px' }}>
          No football club was found at <code>/{resolvedParams.clubSlug}</code>. The club may have moved or changed its address.
        </p>
        <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
          <Link href="/clubs" className="btn btn-primary">
            Explore All Clubs
          </Link>
          <Link href="/" className="btn btn-secondary">
            Platform Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative' }}>
      {/* 4.1 HERO SHOWCASE SECTION (MULTI-SLIDE CAROUSEL & CREST EMBLEM) */}
      <section
        onMouseEnter={() => setIsSliderPaused(true)}
        onMouseLeave={() => setIsSliderPaused(false)}
        style={{
          position: 'relative',
          minHeight: '560px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-start',
          background: `linear-gradient(to bottom, rgba(7, 10, 15, 0.45) 0%, rgba(7, 10, 15, 0.88) 75%, var(--bg-pitch) 100%), url(${currentSlide.bgImage}) center/cover no-repeat`,
          borderBottom: '1px solid var(--border-subtle)',
          padding: '2.5rem 0 2.5rem 0',
          transition: 'background-image 0.7s cubic-bezier(0.16, 1, 0.3, 1)',
          overflow: 'hidden',
        }}
      >
        {/* Heraldic Shield Watermark in Background */}
        <div style={{
          position: 'absolute',
          right: '5%',
          top: '50%',
          transform: 'translateY(-50%)',
          width: '460px',
          height: '460px',
          opacity: 0.035,
          pointerEvents: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 0,
        }}>
          {club.logo_url && !heroLogoError ? (
            <img src={club.logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', filter: 'grayscale(100%)' }} />
          ) : (
            <Shield size={400} color="#FFFFFF" />
          )}
        </div>

        <div className="container" style={{ width: '100%', position: 'relative', zIndex: 1 }}>
          <div className="club-hero-grid">
            {/* Left Column: Slide Content (Dynamic based on currentSlide.category) */}
            <div>
              {/* Helper references for active slide items */}
              {(() => {
                const activeSlideMatch = currentSlide.targetMatch || liveMatch || upcomingMatches[0];
                const activeSlideNews = currentSlide.targetNews || featuredArticle;
                const activeSlideEvent = currentSlide.targetEvent || clubEvents[0];

                return (
                  <>
                    {/* SLIDE: MATCHDAY LIVE / FIXTURE CLASH */}
                    {currentSlide.category === 'match' && (
                      <div>
                        <div style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.65rem',
                          background: 'rgba(0,0,0,0.5)',
                          padding: '0.35rem 0.85rem',
                          borderRadius: '30px',
                          border: '1px solid rgba(255,255,255,0.12)',
                          marginBottom: '1rem',
                        }}>
                          <div style={{ width: '22px', height: '22px', borderRadius: '6px', border: `1.5px solid ${club.primary_color}`, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {club.logo_url && !heroLogoError ? (
                              <img src={club.logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                            ) : (
                              <Shield size={13} color={club.primary_color} />
                            )}
                          </div>
                          <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#FFFFFF' }}>{club.name}</span>
                          <span style={{ color: 'var(--text-muted)' }}>•</span>
                          <span style={{ fontSize: '0.75rem', color: activeSlideMatch?.status === 'live' ? '#EF4444' : 'var(--club-primary)', fontWeight: 700 }}>
                            {currentSlide.badge}
                          </span>
                        </div>

                        <h1 style={{
                          fontSize: 'clamp(2.2rem, 4.5vw, 3.6rem)',
                          fontWeight: 900,
                          lineHeight: 1.1,
                          letterSpacing: '-0.03em',
                          marginBottom: '1rem',
                          color: '#FFFFFF',
                        }}>
                          {currentSlide.title}
                        </h1>

                        <p style={{
                          fontSize: '1.15rem',
                          color: 'var(--text-secondary)',
                          marginBottom: '1.75rem',
                          lineHeight: 1.5,
                        }}>
                          {currentSlide.subtitle}
                        </p>

                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.85rem' }}>
                          <Link
                            href={activeSlideMatch ? `/${club.slug}/match/${activeSlideMatch.id}` : `/${club.slug}`}
                            className="btn btn-primary"
                            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                          >
                            <Zap size={16} />
                            <span>{currentSlide.ctaLabel || (activeSlideMatch?.status === 'live' ? 'Enter Match Center Live' : 'Full Fixture Center')}</span>
                          </Link>

                          {isClubAdmin && (

                          <Link
                            href={`/${club.slug}/availability`}
                            className="btn btn-secondary"
                            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                          >
                            <Users size={16} color="var(--club-primary)" />
                            <span>Squad Availability</span>
                          </Link>
                          )}
                        </div>
                      </div>
                    )}

                    {/* SLIDE 3: BREAKING NEWS */}
                    {currentSlide.category === 'news' && (
                      <div>
                        <div style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.65rem',
                          background: 'rgba(0,0,0,0.5)',
                          padding: '0.35rem 0.85rem',
                          borderRadius: '30px',
                          border: '1px solid rgba(255,255,255,0.12)',
                          marginBottom: '1rem',
                        }}>
                          <Newspaper size={14} color="var(--club-primary)" />
                          <span style={{ fontSize: '0.75rem', color: 'var(--club-primary)', fontWeight: 800 }}>
                            {currentSlide.badge}
                          </span>
                        </div>

                        <h1 style={{
                          fontSize: 'clamp(2rem, 4.2vw, 3.2rem)',
                          fontWeight: 900,
                          lineHeight: 1.15,
                          letterSpacing: '-0.02em',
                          marginBottom: '1rem',
                          color: '#FFFFFF',
                        }}>
                          {currentSlide.title}
                        </h1>

                        <p style={{
                          fontSize: '1.1rem',
                          color: 'var(--text-secondary)',
                          marginBottom: '1.75rem',
                          lineHeight: 1.6,
                        }}>
                          {currentSlide.subtitle}
                        </p>

                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.85rem' }}>
                          {activeSlideNews && (
                            <button
                              onClick={() => setActiveNewsModal(activeSlideNews)}
                              className="btn btn-primary"
                              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                            >
                              <Newspaper size={16} />
                              <span>{currentSlide.ctaLabel || 'Read Full Story'}</span>
                            </button>
                          )}

                          <a
                            href="#news"
                            className="btn btn-secondary"
                            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                          >
                            <span>All Club News</span>
                            <ArrowRight size={14} />
                          </a>
                        </div>
                      </div>
                    )}

                    {/* SLIDE 4: CLUB EVENTS & TRIALS */}
                    {currentSlide.category === 'event' && (
                      <div>
                        <div style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.65rem',
                          background: 'rgba(0,0,0,0.5)',
                          padding: '0.35rem 0.85rem',
                          borderRadius: '30px',
                          border: '1px solid rgba(255,255,255,0.12)',
                          marginBottom: '1rem',
                        }}>
                          <Calendar size={14} color="var(--club-accent, #F59E0B)" />
                          <span style={{ fontSize: '0.75rem', color: '#F59E0B', fontWeight: 800 }}>
                            {currentSlide.badge}
                          </span>
                        </div>

                        <h1 style={{
                          fontSize: 'clamp(2rem, 4.2vw, 3.2rem)',
                          fontWeight: 900,
                          lineHeight: 1.15,
                          letterSpacing: '-0.02em',
                          marginBottom: '1rem',
                          color: '#FFFFFF',
                        }}>
                          {currentSlide.title}
                        </h1>

                        <p style={{
                          fontSize: '1.1rem',
                          color: 'var(--text-secondary)',
                          marginBottom: '1.75rem',
                          lineHeight: 1.6,
                        }}>
                          {currentSlide.subtitle}
                        </p>

                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.85rem' }}>
                          <button
                            onClick={() => setContactModalOpen(true)}
                            className="btn btn-primary"
                            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                          >
                            <Mail size={16} />
                            <span>{currentSlide.ctaLabel || 'RSVP / Inquire for Event'}</span>
                          </button>

                          <a
                            href="#events"
                            className="btn btn-secondary"
                            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                          >
                            <Calendar size={16} />
                            <span>Full Club Calendar</span>
                          </a>
                        </div>
                      </div>
                    )}

                    {/* SLIDE: CUSTOM IMAGE BANNER SPOTLIGHT */}
                    {currentSlide.category === 'image' && (
                      <div>
                        <div style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.65rem',
                          background: 'rgba(0,0,0,0.5)',
                          padding: '0.35rem 0.85rem',
                          borderRadius: '30px',
                          border: '1px solid rgba(255,255,255,0.12)',
                          marginBottom: '1rem',
                        }}>
                          <Sparkles size={14} color="var(--club-accent, #F59E0B)" />
                          <span style={{ fontSize: '0.75rem', color: '#F59E0B', fontWeight: 800 }}>
                            {currentSlide.badge}
                          </span>
                        </div>

                        <h1 style={{
                          fontSize: 'clamp(2rem, 4.2vw, 3.2rem)',
                          fontWeight: 900,
                          lineHeight: 1.15,
                          letterSpacing: '-0.02em',
                          marginBottom: '1rem',
                          color: '#FFFFFF',
                        }}>
                          {currentSlide.title}
                        </h1>

                        <p style={{
                          fontSize: '1.1rem',
                          color: 'var(--text-secondary)',
                          marginBottom: '1.75rem',
                          lineHeight: 1.6,
                        }}>
                          {currentSlide.subtitle}
                        </p>

                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.85rem' }}>
                          <Link
                            href={currentSlide.ctaLink || `/${club.slug}`}
                            className="btn btn-primary"
                            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                          >
                            <Sparkles size={16} />
                            <span>{currentSlide.ctaLabel || 'Explore Feature'}</span>
                          </Link>

                          <Link
                            href={`/${club.slug}/member`}
                            className="btn btn-secondary"
                            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                          >
                            <CreditCard size={16} color="var(--club-primary)" />
                            <span>Member Pass</span>
                          </Link>
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}

              {/* SLIDE 5: STADIUM FORTRESS */}
              {currentSlide.category === 'stadium' && (
                <div>
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.65rem',
                    background: 'rgba(0,0,0,0.5)',
                    padding: '0.35rem 0.85rem',
                    borderRadius: '30px',
                    border: '1px solid rgba(255,255,255,0.12)',
                    marginBottom: '1rem',
                  }}>
                    <MapPin size={14} color="var(--club-primary)" />
                    <span style={{ fontSize: '0.75rem', color: 'var(--club-primary)', fontWeight: 800 }}>
                      {currentSlide.badge}
                    </span>
                  </div>

                  <h1 style={{
                    fontSize: 'clamp(2.2rem, 4.5vw, 3.6rem)',
                    fontWeight: 900,
                    lineHeight: 1.1,
                    letterSpacing: '-0.03em',
                    marginBottom: '1rem',
                    color: '#FFFFFF',
                  }}>
                    {club.stadium_name}
                  </h1>

                  <p style={{
                    fontSize: '1.15rem',
                    color: 'var(--text-secondary)',
                    marginBottom: '1.75rem',
                    lineHeight: 1.6,
                  }}>
                    The official home pitch of {club.name}. Built with {club.stadium_pitch_type}.
                  </p>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.85rem' }}>
                    <a
                      href="#stadium"
                      className="btn btn-primary"
                      style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                    >
                      <MapPin size={16} />
                      <span>View Home Ground Map & Directions</span>
                    </a>

                    <a
                      href="#squad"
                      className="btn btn-secondary"
                      style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                    >
                      <Users size={16} />
                      <span>First Team Squad</span>
                    </a>
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Interactive Card matching slide content */}
            <div>
              {/* SLIDE: LIVE MATCH SCOREBOARD OR NEXT FIXTURE */}
              {currentSlide.category === 'match' && (
                <div>
                  {(() => {
                    const activeSlideMatch = currentSlide.targetMatch || liveMatch || upcomingMatches[0];
                    const isLive = activeSlideMatch?.status === 'live';
                    if (!activeSlideMatch) return null;
                    return isLive ? (
                      <div className="glass-panel" style={{
                        padding: '1.5rem',
                        border: '2px solid #EF4444',
                        boxShadow: '0 0 35px rgba(239, 68, 68, 0.35)',
                        background: 'rgba(18, 26, 38, 0.92)',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <span className="badge badge-live">
                            <span className="pulse-dot" /> {activeSlideMatch.is_paused ? 'MATCHDAY PAUSED' : 'MATCHDAY LIVE'} • <LiveMinute match={activeSlideMatch} />&apos;
                          </span>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            {activeSlideMatch.competition === 'Premier Regional League' ? (activeSlideMatch.match_type ? activeSlideMatch.match_type.toUpperCase() + ' MATCH' : 'CLUB FRIENDLY') : activeSlideMatch.competition}
                          </span>
                        </div>

                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '0.75rem',
                          marginBottom: '1.5rem',
                        }}>
                          {/* Home Team */}
                          <div style={{ textAlign: 'center', flex: 1, minWidth: 0 }}>
                            <img
                              src={activeSlideMatch.home_team_logo || DEFAULT_CREST}
                              alt={activeSlideMatch.home_team_name}
                              onError={e => { if (e.currentTarget.src !== DEFAULT_CREST) e.currentTarget.src = DEFAULT_CREST; }}
                              style={{ width: '48px', height: '48px', borderRadius: '12px', objectFit: 'cover', margin: '0 auto 0.5rem auto', border: '1px solid var(--border-subtle)' }}
                            />
                            <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#FFFFFF', wordBreak: 'break-word' }}>{activeSlideMatch.home_team_name}</div>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Home</span>
                          </div>

                          {/* Live Score */}
                          <div style={{
                            padding: '0.5rem 1rem',
                            background: 'rgba(0, 0, 0, 0.6)',
                            borderRadius: '16px',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            textAlign: 'center',
                            flexShrink: 0,
                          }}>
                            <div style={{
                              fontFamily: 'var(--font-heading)',
                              fontSize: 'clamp(2rem, 5vw, 2.8rem)',
                              fontWeight: 900,
                              letterSpacing: '0.05em',
                              color: '#FFFFFF',
                              lineHeight: 1,
                            }}>
                              {activeSlideMatch.home_score} : {activeSlideMatch.away_score}
                            </div>
                            <div style={{ fontSize: '0.68rem', color: '#EF4444', fontWeight: 700, marginTop: '4px', textTransform: 'uppercase' }}>
                              {activeSlideMatch.period === 'first_half'
                                ? '1st Half'
                                : activeSlideMatch.period === 'halftime'
                                ? 'Half Time'
                                : activeSlideMatch.period === 'second_half'
                                ? '2nd Half'
                                : activeSlideMatch.period === 'extra_time'
                                ? 'Extra Time'
                                : activeSlideMatch.period === 'penalties'
                                ? 'Penalties'
                                : 'In Play'}
                            </div>
                          </div>

                          {/* Away Team */}
                          <div style={{ textAlign: 'center', flex: 1, minWidth: 0 }}>
                            <img
                              src={activeSlideMatch.away_team_logo || DEFAULT_CREST}
                              alt={activeSlideMatch.away_team_name}
                              onError={e => { if (e.currentTarget.src !== DEFAULT_CREST) e.currentTarget.src = DEFAULT_CREST; }}
                              style={{ width: '48px', height: '48px', borderRadius: '12px', objectFit: 'cover', margin: '0 auto 0.5rem auto', border: '1px solid var(--border-subtle)' }}
                            />
                            <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#FFFFFF', wordBreak: 'break-word' }}>{activeSlideMatch.away_team_name}</div>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Away</span>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            Venue: <strong style={{ color: '#FFFFFF' }}>{activeSlideMatch.venue}</strong>
                          </div>
                          <Link
                            href={`/${club.slug}/match/${activeSlideMatch.id}`}
                            className="btn btn-primary btn-sm touch-target"
                            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                          >
                            <span>Full Match Center</span>
                            <ChevronRight size={14} />
                          </Link>
                        </div>
                      </div>
                    ) : (
                      /* Next Fixture Countdown Card */
                      <div className="glass-panel" style={{ padding: '1.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <span className="badge badge-primary">FIXTURE SPOTLIGHT</span>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            {activeSlideMatch.competition === 'Premier Regional League' ? (activeSlideMatch.match_type ? activeSlideMatch.match_type.toUpperCase() + ' FIXTURE' : 'CLUB FRIENDLY') : (activeSlideMatch.competition || 'Club Match')}
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '1.5rem' }}>
                          <div style={{ textAlign: 'center', flex: 1, minWidth: 0 }}>
                            <img
                              src={activeSlideMatch.home_team_logo || DEFAULT_CREST}
                              alt={activeSlideMatch.home_team_name}
                              onError={e => { if (e.currentTarget.src !== DEFAULT_CREST) e.currentTarget.src = DEFAULT_CREST; }}
                              style={{ width: '48px', height: '48px', borderRadius: '12px', objectFit: 'cover', margin: '0 auto 0.5rem auto' }}
                            />
                            <div style={{ fontWeight: 800, fontSize: '0.9rem', wordBreak: 'break-word' }}>{activeSlideMatch.home_team_name}</div>
                          </div>
                          <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-muted)', padding: '0 0.5rem', flexShrink: 0 }}>VS</div>
                          <div style={{ textAlign: 'center', flex: 1, minWidth: 0 }}>
                            <img
                              src={activeSlideMatch.away_team_logo || DEFAULT_CREST}
                              alt={activeSlideMatch.away_team_name}
                              onError={e => { if (e.currentTarget.src !== DEFAULT_CREST) e.currentTarget.src = DEFAULT_CREST; }}
                              style={{ width: '48px', height: '48px', borderRadius: '12px', objectFit: 'cover', margin: '0 auto 0.5rem auto' }}
                            />
                            <div style={{ fontWeight: 800, fontSize: '0.9rem', wordBreak: 'break-word' }}>{activeSlideMatch.away_team_name}</div>
                          </div>
                        </div>
                        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', textAlign: 'center', marginBottom: '1.25rem' }}>
                          Kickoff: {new Date(activeSlideMatch.match_date).toLocaleDateString()} at {new Date(activeSlideMatch.match_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {activeSlideMatch.venue}
                        </div>
                        <Link
                          href={`/${club.slug}/match/${activeSlideMatch.id}`}
                          className="btn btn-primary btn-sm touch-target"
                          style={{ width: '100%', justifyContent: 'center' }}
                        >
                          Match Preview & Lineups
                        </Link>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* SLIDE 3 RIGHT: FEATURED NEWS SPOTLIGHT CARD */}
              {currentSlide.category === 'news' && (
                <div>
                  {(() => {
                    const activeSlideNews = currentSlide.targetNews || featuredArticle;
                    if (!activeSlideNews) return null;
                    return (
                      <div
                        onClick={() => setActiveNewsModal(activeSlideNews)}
                        className="glass-panel glass-panel-interactive"
                        style={{
                          cursor: 'pointer',
                          overflow: 'hidden',
                          display: 'flex',
                          flexDirection: 'column',
                          border: '1.5px solid var(--border-medium)',
                        }}
                      >
                        <div style={{ height: '200px', position: 'relative' }}>
                          <img
                            src={activeSlideNews.cover_image_url || club.banner_url}
                            alt={activeSlideNews.title}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                          <div style={{ position: 'absolute', top: '12px', left: '12px' }}>
                            <span className="badge badge-gold">EXCLUSIVE STORY</span>
                          </div>
                        </div>

                        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                          <div style={{ fontSize: '0.75rem', color: 'var(--club-primary)', fontWeight: 700, textTransform: 'uppercase' }}>
                            {activeSlideNews.tags?.join(' • ') || 'First Team'}
                          </div>
                          <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#FFFFFF', lineHeight: 1.3 }}>
                            {activeSlideNews.title}
                          </h3>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.75rem' }}>
                            <span>By {activeSlideNews.author_name || 'Media Team'}</span>
                            <span style={{ color: 'var(--club-primary)', fontWeight: 700 }}>Read Article &rarr;</span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* SLIDE 4 RIGHT: EVENT PASS & RSVP STATUS CARD */}
              {currentSlide.category === 'event' && (
                <div>
                  {(() => {
                    const activeSlideEvent = currentSlide.targetEvent || clubEvents[0];
                    if (!activeSlideEvent) return null;
                    return (
                      <div className="glass-panel" style={{
                        padding: '2rem',
                        border: '1.5px solid rgba(245, 158, 11, 0.3)',
                        background: 'rgba(14, 20, 30, 0.9)',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                          <span className="badge badge-gold">EVENT INVITATION</span>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            {activeSlideEvent.is_public ? 'Public Access' : 'Members Only'}
                          </span>
                        </div>

                        <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#FFFFFF', marginBottom: '0.75rem' }}>
                          {activeSlideEvent.title}
                        </h3>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Calendar size={15} color="var(--club-primary)" />
                            <span>{new Date(activeSlideEvent.start_time).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <MapPin size={15} color="var(--club-primary)" />
                            <span>{activeSlideEvent.location || club.stadium_name}</span>
                          </div>
                        </div>

                        {/* Attendance Progress Meter */}
                        <div style={{ marginBottom: '1.5rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.35rem' }}>
                            <span style={{ color: 'var(--text-muted)' }}>RSVP Capacity</span>
                            <strong style={{ color: '#FFFFFF' }}>{activeSlideEvent.rsvp_count} / {activeSlideEvent.max_capacity} Attending</strong>
                          </div>
                          <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{
                              width: `${Math.min(100, Math.round((activeSlideEvent.rsvp_count / activeSlideEvent.max_capacity) * 100))}%`,
                              height: '100%',
                              background: 'linear-gradient(90deg, #10B981, #F59E0B)',
                            }} />
                          </div>
                        </div>

                        <button
                          onClick={() => setContactModalOpen(true)}
                          className="btn btn-primary btn-sm"
                          style={{ width: '100%', justifyContent: 'center' }}
                        >
                          Confirm RSVP Attendance
                        </button>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* SLIDE 5 RIGHT: STADIUM FORTRESS MAP & STATS */}
              {currentSlide.category === 'stadium' && (
                <div className="glass-panel" style={{
                  padding: '2rem',
                  border: '1.5px solid var(--border-medium)',
                  background: 'rgba(14, 20, 30, 0.9)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                    <span className="badge badge-primary">FORTRESS SPECS</span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Grounds & Facility</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                      <MapPin size={18} color="var(--club-primary)" />
                      <div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Address</div>
                        <div style={{ fontWeight: 700, color: '#FFFFFF', fontSize: '0.9rem' }}>{club.stadium_address}</div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                      <Shield size={18} color="var(--club-primary)" />
                      <div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Pitch Surface</div>
                        <div style={{ fontWeight: 700, color: '#FFFFFF', fontSize: '0.9rem' }}>{club.stadium_pitch_type}</div>
                      </div>
                    </div>
                  </div>

                  <a
                    href={`https://maps.google.com/?q=${encodeURIComponent(club.stadium_address)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-primary btn-sm"
                    style={{ width: '100%', justifyContent: 'center', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                  >
                    <span>Get Home Ground Directions</span>
                    <ExternalLink size={14} />
                  </a>
                </div>
              )}

              {/* SLIDE 6 RIGHT: CUSTOM IMAGE / SPOTLIGHT PROMO CARD */}
              {currentSlide.category === 'image' && (
                <div className="glass-panel" style={{
                  overflow: 'hidden',
                  border: '1.5px solid rgba(245, 158, 11, 0.35)',
                  background: 'rgba(14, 20, 30, 0.92)',
                  display: 'flex',
                  flexDirection: 'column',
                }}>
                  <div style={{ height: '220px', position: 'relative' }}>
                    <img
                      src={currentSlide.bgImage}
                      alt={currentSlide.title}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(14,20,30,0.95) 0%, transparent 60%)' }} />
                    <div style={{ position: 'absolute', top: '12px', left: '12px' }}>
                      <span className="badge badge-gold">{currentSlide.badge}</span>
                    </div>
                  </div>

                  <div style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#FFFFFF', lineHeight: 1.3 }}>
                      {currentSlide.title}
                    </h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                      {currentSlide.subtitle}
                    </p>
                    <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem', marginTop: '0.5rem' }}>
                      <Link
                        href={currentSlide.ctaLink || `/${club.slug}`}
                        className="btn btn-primary btn-sm"
                        style={{ width: '100%', justifyContent: 'center' }}
                      >
                        {currentSlide.ctaLabel || 'Learn More'}
                      </Link>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* BOTTOM SLIDER CONTROLS: CATEGORY TABS, AUTOPLAY TIMER & PREV/NEXT */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.85rem',
            marginTop: '2.5rem',
            paddingTop: '1.25rem',
            borderTop: '1px solid rgba(255,255,255,0.08)',
          }}>
            {/* Category Select Tabs: Mobile Horizontal Scroll Pill Strip */}
            <div className="scroll-pill-strip" style={{ flex: 1, minWidth: 0 }}>
              {heroSlides.map((slide, idx) => {
                const isActive = activeSlide === idx;
                return (
                  <button
                    key={slide.id}
                    onClick={() => setActiveSlide(idx)}
                    className="scroll-pill-item"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.5rem 0.95rem',
                      borderRadius: '30px',
                      border: isActive ? `1.5px solid ${club.primary_color}` : '1px solid rgba(255,255,255,0.08)',
                      background: isActive ? 'rgba(var(--club-primary-rgb), 0.2)' : 'rgba(0,0,0,0.45)',
                      color: isActive ? '#FFFFFF' : 'var(--text-muted)',
                      cursor: 'pointer',
                      fontWeight: 700,
                      fontSize: '0.8rem',
                      transition: 'all 0.2s ease',
                      position: 'relative',
                      overflow: 'hidden',
                      minHeight: '38px',
                    }}
                  >
                    {slide.category === 'match' && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                        {slide.targetMatch?.status === 'live' ? (
                          <span className="pulse-dot" style={{ width: '8px', height: '8px' }} />
                        ) : (
                          <Zap size={14} color={isActive ? club.primary_color : 'currentColor'} />
                        )}
                      </span>
                    )}
                    {slide.category === 'news' && <Newspaper size={14} color={isActive ? club.primary_color : 'currentColor'} />}
                    {slide.category === 'event' && <Calendar size={14} color={isActive ? club.primary_color : 'currentColor'} />}
                    {slide.category === 'stadium' && <MapPin size={14} color={isActive ? club.primary_color : 'currentColor'} />}
                    {slide.category === 'image' && <Sparkles size={14} color={isActive ? '#F59E0B' : 'currentColor'} />}
                    <span>{slide.tabLabel}</span>

                    {/* Animated Progress Timer Bar when active and not paused */}
                    {isActive && !isSliderPaused && (
                      <div
                        key={`progress-${idx}-${activeSlide}`}
                        style={{
                          position: 'absolute',
                          bottom: 0,
                          left: 0,
                          height: '2.5px',
                          background: club.primary_color,
                          animation: 'sliderProgress 6.5s linear forwards',
                        }}
                      />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Slider Navigation Arrows & Hover State */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
              {isSliderPaused && (
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontStyle: 'italic', display: 'none', alignItems: 'center', gap: '0.3rem', marginRight: '0.3rem' }}>
                  <Pause size={10} />
                </span>
              )}
              <button
                onClick={() => setActiveSlide(prev => (prev - 1 + heroSlides.length) % heroSlides.length)}
                aria-label="Previous Slide"
                className="touch-target"
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '50%',
                  border: '1px solid rgba(255,255,255,0.14)',
                  background: 'rgba(0,0,0,0.5)',
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                <ChevronLeft size={18} />
              </button>
              <button
                onClick={() => setActiveSlide(prev => (prev + 1) % heroSlides.length)}
                aria-label="Next Slide"
                className="touch-target"
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '50%',
                  border: '1px solid rgba(255,255,255,0.14)',
                  background: 'rgba(0,0,0,0.5)',
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 4.2 DEDICATED CLUB IDENTITY SECTION (DYNAMIC SUM COUNTS FROM RAW DATASET) */}
      <ClubIdentitySection
        club={club}
        members={members}
        matches={matches}
        events={events}
        sponsors={sponsors}
        playerStats={playerStats}
        onOpenContactModal={() => setContactModalOpen(true)}
      />

      {/* 4.3 SPONSORS SHOWCASE */}
      {clubSponsors.length > 0 && (() => {
        const getSponsorScale = (sponsor: any): 'xl' | 'lg' | 'md' | 'sm' => {
          if (sponsor.size_scale && sponsor.size_scale !== 'auto') {
            return sponsor.size_scale;
          }
          switch (sponsor.tier) {
            case 'platinum':
              return 'xl';
            case 'gold':
              return 'lg';
            case 'silver':
              return 'md';
            case 'bronze':
            case 'grassroots':
            default:
              return 'sm';
          }
        };

        const sortedSponsors = [...clubSponsors].sort((a, b) => {
          const scaleRank = { xl: 4, lg: 3, md: 2, sm: 1 };
          const diff = (scaleRank[getSponsorScale(b)] || 1) - (scaleRank[getSponsorScale(a)] || 1);
          if (diff !== 0) return diff;
          return (a.display_order ?? 0) - (b.display_order ?? 0);
        });

        return (
          <section style={{ padding: '3rem 0', borderBottom: '1px solid var(--border-subtle)', background: 'linear-gradient(180deg, rgba(255,255,255,0.015) 0%, rgba(0,0,0,0.2) 100%)' }}>
            <div className="container">
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.75rem' }}>
                <div>
                  <span style={{ fontSize: '0.72rem', fontWeight: 900, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--club-primary, #10B981)', display: 'block', marginBottom: '0.2rem' }}>
                    Commercial Backers &amp; Kit Partners
                  </span>
                  <h3 style={{ fontSize: '1.35rem', fontWeight: 900, color: '#FFFFFF', margin: 0 }}>
                    Official Club Sponsors
                  </h3>
                </div>
                <button
                  onClick={() => setContactModalOpen(true)}
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid var(--border-subtle)',
                    padding: '0.5rem 1rem',
                    borderRadius: '8px',
                    color: 'var(--club-primary, #FFFFFF)',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  Become a Club Sponsor &rarr;
                </button>
              </div>

              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'stretch',
                gap: '1.25rem',
                justifyContent: 'center',
              }}>
                {sortedSponsors.map(sponsor => {
                  const scale = getSponsorScale(sponsor);
                  const isXL = scale === 'xl';
                  const isLG = scale === 'lg';
                  const isMD = scale === 'md';

                  const badgeText =
                    sponsor.tier === 'platinum'
                      ? '★ PRINCIPAL PARTNER'
                      : sponsor.tier === 'gold'
                      ? 'GOLD PARTNER'
                      : sponsor.tier === 'silver'
                      ? 'OFFICIAL SUPPLIER'
                      : 'COMMUNITY SUPPORTER';

                  return (
                    <a
                      key={sponsor.id}
                      href={sponsor.website_url || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="glass-panel"
                      style={{
                        padding: isXL ? '1.35rem 2rem' : isLG ? '1.1rem 1.6rem' : isMD ? '0.85rem 1.25rem' : '0.65rem 1rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: isXL ? '1.5rem' : isLG ? '1.1rem' : isMD ? '0.85rem' : '0.65rem',
                        textDecoration: 'none',
                        borderRadius: isXL ? '16px' : isLG ? '14px' : '10px',
                        minWidth: isXL ? '300px' : isLG ? '230px' : isMD ? '175px' : '135px',
                        flex: isXL ? '2 1 340px' : isLG ? '1.5 1 250px' : isMD ? '1 1 180px' : '0.7 1 140px',
                        maxWidth: isXL ? '560px' : isLG ? '440px' : isMD ? '320px' : '240px',
                        background: isXL
                          ? 'radial-gradient(ellipse at top left, rgba(245, 158, 11, 0.16), rgba(15, 23, 42, 0.85))'
                          : isLG
                          ? 'radial-gradient(ellipse at top left, rgba(245, 158, 11, 0.07), rgba(15, 23, 42, 0.65))'
                          : 'rgba(255, 255, 255, 0.025)',
                        border: isXL
                          ? '1px solid rgba(245, 158, 11, 0.45)'
                          : isLG
                          ? '1px solid rgba(245, 158, 11, 0.22)'
                          : isMD
                          ? '1px solid rgba(255, 255, 255, 0.1)'
                          : '1px solid rgba(255, 255, 255, 0.05)',
                        boxShadow: isXL ? '0 10px 32px rgba(245, 158, 11, 0.14)' : isLG ? '0 6px 20px rgba(0, 0, 0, 0.25)' : 'none',
                        transition: 'transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease',
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.transform = 'translateY(-3px)';
                        if (isXL) e.currentTarget.style.borderColor = '#F59E0B';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        if (isXL) e.currentTarget.style.borderColor = 'rgba(245, 158, 11, 0.45)';
                      }}
                    >
                      <img
                        src={sponsor.logo_url}
                        alt={sponsor.name}
                        style={{
                          height: isXL ? '54px' : isLG ? '40px' : isMD ? '30px' : '24px',
                          maxWidth: isXL ? '170px' : isLG ? '130px' : isMD ? '95px' : '75px',
                          objectFit: 'contain',
                          filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.3))',
                        }}
                      />
                      <div style={{ overflow: 'hidden' }}>
                        <div style={{
                          fontWeight: 900,
                          fontSize: isXL ? '1.15rem' : isLG ? '0.98rem' : isMD ? '0.86rem' : '0.78rem',
                          color: '#FFFFFF',
                          whiteSpace: 'nowrap',
                          textOverflow: 'ellipsis',
                          overflow: 'hidden',
                          letterSpacing: '-0.01em',
                        }}>
                          {sponsor.name}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '3px' }}>
                          <span className="badge" style={{
                            fontSize: isXL ? '0.65rem' : isLG ? '0.6rem' : '0.55rem',
                            padding: isXL ? '0.2rem 0.55rem' : '0.15rem 0.4rem',
                            fontWeight: 800,
                            backgroundColor: sponsor.tier === 'platinum'
                              ? 'rgba(245, 158, 11, 0.22)'
                              : sponsor.tier === 'gold'
                              ? 'rgba(234, 179, 8, 0.18)'
                              : 'rgba(255, 255, 255, 0.08)',
                            color: sponsor.tier === 'platinum'
                              ? '#F59E0B'
                              : sponsor.tier === 'gold'
                              ? '#FBBF24'
                              : 'var(--text-muted)',
                            letterSpacing: '0.04em',
                          }}>
                            {badgeText}
                          </span>
                        </div>
                      </div>
                    </a>
                  );
                })}
              </div>
            </div>
          </section>
        );
      })()}

      {/* 4.3 FIXTURES & RESULTS */}
      <section id="fixtures" style={{ padding: '4.5rem 0', borderBottom: '1px solid var(--border-subtle)' }}>
        <div className="container">
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '2rem' }}>
            <div>
              <span className="badge badge-primary" style={{ marginBottom: '0.4rem' }}>SCHEDULE</span>
              <h2 style={{ fontSize: '2rem', fontWeight: 900 }}>Fixtures & Match Results</h2>
            </div>

            {/* Filter controls: Season dropdown & Tab switcher */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700 }}>SEASON:</span>
                <select
                  value={fixturesSeasonFilter}
                  onChange={(e) => setFixturesSeasonFilter(e.target.value)}
                  style={{
                    padding: '0.45rem 0.85rem',
                    background: 'rgba(255, 255, 255, 0.07)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    color: '#FFFFFF',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <option value="CURRENT" style={{ background: '#111827', color: '#FFFFFF' }}>
                    Current Season ({activeSeason?.name || defaultSeasonLabel()})
                  </option>
                  <option value="ALL" style={{ background: '#111827', color: '#FFFFFF' }}>All Seasons</option>
                  {clubSeasons.map(s => (
                    <option key={s.id} value={s.name} style={{ background: '#111827', color: '#FFFFFF' }}>
                      {s.name} {s.is_current ? '(Active)' : `(${s.status})`}
                    </option>
                  ))}
                </select>
              </div>

              {/* Tab switchers */}
              <div style={{ display: 'flex', background: 'rgba(255, 255, 255, 0.05)', padding: '4px', borderRadius: 'var(--radius-md)', flex: 1, minWidth: '220px' }}>
                <button
                  onClick={() => setFixturesTab('upcoming')}
                  style={{
                    flex: 1,
                    padding: '0.5rem 0.85rem',
                    borderRadius: 'var(--radius-sm)',
                    border: 'none',
                    background: fixturesTab === 'upcoming' ? 'var(--club-primary)' : 'transparent',
                    color: fixturesTab === 'upcoming' ? '#FFFFFF' : 'var(--text-muted)',
                    fontWeight: 700,
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                    textAlign: 'center',
                    minHeight: '40px',
                  }}
                >
                  Upcoming
                </button>
                <button
                  onClick={() => setFixturesTab('results')}
                  style={{
                    flex: 1,
                    padding: '0.5rem 0.85rem',
                    borderRadius: 'var(--radius-sm)',
                    border: 'none',
                    background: fixturesTab === 'results' ? 'var(--club-primary)' : 'transparent',
                    color: fixturesTab === 'results' ? '#FFFFFF' : 'var(--text-muted)',
                    fontWeight: 700,
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                    textAlign: 'center',
                    minHeight: '40px',
                  }}
                >
                  Results
                </button>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {(fixturesTab === 'upcoming' ? upcomingMatches : pastMatches).map(match => (
              <div
                key={match.id}
                className="glass-panel glass-panel-interactive fixture-card"
              >
                {/* Competition & Date */}
                <div className="fixture-meta">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'inherit' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--club-primary)', textTransform: 'uppercase' }}>
                      {match.competition === 'Premier Regional League' ? (match.match_type ? `${match.match_type.toUpperCase()} MATCH` : 'CLUB FRIENDLY') : match.competition}
                    </span>
                    {match.match_type && (
                      <span className="badge" style={{ fontSize: '0.62rem', background: 'rgba(255, 255, 255, 0.08)', color: '#FFFFFF', textTransform: 'uppercase' }}>
                        {match.match_type}
                      </span>
                    )}
                    {match.season && (
                      <span className="badge" style={{ fontSize: '0.62rem', background: 'rgba(255, 255, 255, 0.08)', color: 'var(--text-muted)' }}>
                        {match.season}
                      </span>
                    )}
                  </div>
                  {match.title && (
                    <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#F59E0B', marginTop: '2px' }}>
                      {match.title}
                    </div>
                  )}
                  <div style={{ fontSize: '0.9rem', color: '#FFFFFF', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '3px', justifyContent: 'inherit' }}>
                    <Calendar size={14} color="var(--text-muted)" />
                    {new Date(match.match_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {match.match_time || new Date(match.match_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {match.venue}
                  </div>
                </div>

                {/* Scoreline / Teams */}
                <div className="fixture-teams" style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                  <div style={{ textAlign: 'right', flex: 1, fontWeight: 700, color: '#FFFFFF', fontSize: '0.95rem' }}>
                    {match.home_team_name}
                  </div>

                  <div style={{
                    padding: '0.35rem 0.85rem',
                    background: match.status === 'completed' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.4)',
                    borderRadius: '8px',
                    fontFamily: 'var(--font-heading)',
                    fontWeight: 900,
                    fontSize: '1.2rem',
                    color: '#FFFFFF',
                    minWidth: '70px',
                    textAlign: 'center',
                    flexShrink: 0,
                  }}>
                    {match.status === 'live' ? (
                      <span style={{ color: '#EF4444' }}>{match.home_score} - {match.away_score}</span>
                    ) : match.status === 'completed' ? (
                      `${match.home_score} - ${match.away_score}`
                    ) : (
                      'VS'
                    )}
                  </div>

                  <div style={{ textAlign: 'left', flex: 1, fontWeight: 700, color: '#FFFFFF', fontSize: '0.95rem' }}>
                    {match.away_team_name}
                  </div>
                </div>

                {/* Action Link */}
                <div className="fixture-actions" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {match.status === 'upcoming' && isClubAdmin && (
                    <Link
                      href={`/${club.slug}/availability`}
                      className="btn btn-sm touch-target"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.3rem',
                        background: 'rgba(16, 185, 129, 0.15)',
                        border: '1px solid #10B981',
                        color: '#10B981',
                        fontSize: '0.78rem',
                        padding: '0.4rem 0.75rem',
                      }}
                    >
                      <span>RSVP Availability</span>
                    </Link>
                  )}

                  {match.status === 'upcoming' && match.door_qr_checkin_enabled && (
                    <Link
                      href={`/${club.slug}/match/${match.id}/checkin`}
                      className="btn btn-sm touch-target"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.3rem',
                        background: 'rgba(59, 130, 246, 0.15)',
                        border: '1px solid #3B82F6',
                        color: '#3B82F6',
                        fontSize: '0.78rem',
                        padding: '0.4rem 0.75rem',
                      }}
                    >
                      <QrCode size={13} />
                      <span>Door Check-In</span>
                    </Link>
                  )}

                  <Link
                    href={`/${club.slug}/match/${match.id}`}
                    className="btn btn-secondary btn-sm touch-target"
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem' }}
                  >
                    <span>{match.status === 'completed' ? 'Match Report' : 'Match Center'}</span>
                    <ChevronRight size={14} />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4.4 SCHEDULED SOCIAL EVENTS */}
      <section id="events" style={{ padding: '4.5rem 0', background: 'rgba(255,255,255,0.01)', borderBottom: '1px solid var(--border-subtle)' }}>
        <div className="container">
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '2rem' }}>
            <div>
              <span className="badge badge-gold" style={{ marginBottom: '0.4rem' }}>CLUB CALENDAR</span>
              <h2 style={{ fontSize: '2rem', fontWeight: 900 }}>Upcoming Events & Trainings</h2>
            </div>
            <Link href={`/${club.slug}/member`} className="btn btn-secondary btn-sm">
              <CreditCard size={14} color="var(--club-primary)" />
              <span>Get Digital Check-In Pass</span>
            </Link>
          </div>

          <div className="grid-responsive-3">
            {clubEvents.map(evt => (
              <div key={evt.id} className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                    <span className="badge" style={{
                      backgroundColor: evt.category === 'training' ? 'rgba(16, 185, 129, 0.15)' : evt.category === 'social' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                      color: evt.category === 'training' ? '#10B981' : evt.category === 'social' ? '#F59E0B' : '#3B82F6',
                    }}>
                      {evt.category.toUpperCase()}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      RSVP: {evt.rsvp_count} / {evt.max_capacity}
                    </span>
                  </div>

                  <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#FFFFFF', marginBottom: '0.5rem' }}>
                    {evt.title}
                  </h3>

                  <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '1.25rem' }}>
                    {evt.description}
                  </p>
                </div>

                <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Calendar size={14} color="var(--club-primary)" />
                    <span style={{ color: '#FFFFFF' }}>{new Date(evt.start_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <MapPin size={14} color="var(--club-primary)" />
                    <span>{evt.location}</span>
                  </div>
                </div>

                <Link
                  href={`/${club.slug}/events/${evt.id}`}
                  className="btn btn-secondary btn-sm"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem' }}
                >
                  <span>View Details</span>
                  <ChevronRight size={14} />
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4.5 LATEST NEWS SHOWCASE & VIDEO */}
      <section id="news" style={{ padding: '4.5rem 0', borderBottom: '1px solid var(--border-subtle)' }}>
        <div className="container">
          <div style={{ marginBottom: '2.5rem' }}>
            <span className="badge badge-primary" style={{ marginBottom: '0.4rem' }}>MEDIA & DISPATCHES</span>
            <h2 style={{ fontSize: '2rem', fontWeight: 900 }}>Latest Club News & Video</h2>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(320px, 100%), 1fr))',
            gap: '2rem',
            marginBottom: '3rem',
          }}>
            {/* Featured Article */}
            {featuredArticle && (
              <div
                onClick={() => setActiveNewsModal(featuredArticle)}
                className="glass-panel glass-panel-interactive"
                style={{
                  cursor: 'pointer',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <div style={{ height: '240px', position: 'relative' }}>
                  <img
                    src={featuredArticle.cover_image_url}
                    alt={featuredArticle.title}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                  <div style={{ position: 'absolute', top: '12px', left: '12px' }}>
                    <span className="badge badge-gold">FEATURED STORY</span>
                  </div>
                </div>

                <div style={{ padding: '1.75rem', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#FFFFFF', marginBottom: '0.6rem', lineHeight: 1.3 }}>
                      {featuredArticle.title}
                    </h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '1.25rem' }}>
                      {featuredArticle.summary}
                    </p>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    <span>By {featuredArticle.author_name}</span>
                    <span style={{ color: 'var(--club-primary)', fontWeight: 700 }}>Read Article &rarr;</span>
                  </div>
                </div>
              </div>
            )}

            {/* News Feed Grid */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {clubNews.filter(n => n.id !== featuredArticle?.id).map(article => (
                <div
                  key={article.id}
                  onClick={() => setActiveNewsModal(article)}
                  className="glass-panel glass-panel-interactive"
                  style={{
                    padding: '1.25rem',
                    display: 'flex',
                    gap: '1.25rem',
                    alignItems: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <img
                    src={article.cover_image_url}
                    alt={article.title}
                    style={{ width: '90px', height: '90px', borderRadius: '10px', objectFit: 'cover' }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.3rem' }}>
                      {article.tags?.slice(0, 2).map(tag => (
                        <span key={tag} className="badge" style={{ fontSize: '0.65rem', background: 'rgba(255,255,255,0.07)' }}>
                          {tag}
                        </span>
                      ))}
                    </div>
                    <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#FFFFFF', lineHeight: 1.3, marginBottom: '0.3rem' }}>
                      {article.title}
                    </h4>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {new Date(article.published_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 4.6 EXECUTIVE COMMITTEE SHOWCASE */}
      <section style={{ padding: '4.5rem 0', background: 'rgba(255,255,255,0.015)', borderBottom: '1px solid var(--border-subtle)' }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <span className="badge badge-primary">LEADERSHIP</span>
              {activeSeason && (
                <span className="badge" style={{ background: 'rgba(255, 255, 255, 0.08)', color: '#FFFFFF', fontSize: '0.72rem' }}>
                  🗓️ {activeSeason.name} Tenure
                </span>
              )}
            </div>
            <h2 style={{ fontSize: '2rem', fontWeight: 900 }}>Executive Committee & Governance</h2>
            <p style={{ color: 'var(--text-secondary)', maxWidth: '600px', margin: '0 auto' }}>
              The dedicated board, management, and technical staff guiding {club.name}.
            </p>
          </div>

          <div className="grid-responsive-4">
            {executiveStaff.map(exec => (
              <div key={exec.id} className="glass-panel" style={{ padding: '1.5rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <img
                  src={exec.photo_url}
                  alt={exec.full_name}
                  style={{
                    width: '96px',
                    height: '96px',
                    borderRadius: '50%',
                    objectFit: 'cover',
                    border: `2px solid var(--club-primary)`,
                    boxShadow: '0 8px 16px rgba(0,0,0,0.4)',
                    marginBottom: '1rem',
                  }}
                />
                <h4 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#FFFFFF', marginBottom: '0.2rem' }}>
                  {exec.full_name}
                </h4>
                <div style={{ color: 'var(--club-primary)', fontWeight: 700, fontSize: '0.8rem', marginBottom: '0.3rem' }}>
                  {exec.executive_title}
                </div>
                {(exec.executive_season || activeSeason) && (
                  <span className="badge" style={{ fontSize: '0.65rem', background: 'rgba(255, 255, 255, 0.07)', color: 'var(--text-muted)', marginBottom: '0.6rem' }}>
                    Tenure: {exec.executive_season || activeSeason?.name || defaultSeasonLabel()}
                  </span>
                )}
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  {exec.executive_bio}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4.7 PLAYERS (SQUAD ROSTER) & LEADERBOARD */}
      <section id="squad" style={{ padding: '5rem 0', borderBottom: '1px solid var(--border-subtle)' }}>
        <div className="container">
          {/* Section Header & Position Filters */}
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            gap: '1.5rem',
            marginBottom: '2.5rem',
          }}>
            <div>
              <span className="badge badge-gold" style={{ marginBottom: '0.4rem' }}>FIRST TEAM ROSTER</span>
              <h2 style={{ fontSize: '2.2rem', fontWeight: 900 }}>Senior Squad & Player Stats</h2>
            </div>

            {/* Position Filter Pills: Scrollable on mobile */}
            <div className="scroll-pill-strip" style={{ maxWidth: '100%' }}>
              {(['ALL', 'GK', 'DEF', 'MID', 'FWD'] as const).map(pos => (
                <button
                  key={pos}
                  onClick={() => setSquadFilter(pos)}
                  className="btn btn-sm scroll-pill-item touch-target"
                  style={{
                    background: squadFilter === pos ? 'var(--club-primary)' : 'rgba(255,255,255,0.06)',
                    color: squadFilter === pos ? '#FFFFFF' : 'var(--text-secondary)',
                    border: '1px solid var(--border-subtle)',
                    minHeight: '38px',
                  }}
                >
                  {pos === 'ALL' ? 'All Squad' : pos === 'GK' ? 'Goalkeepers' : pos === 'DEF' ? 'Defenders' : pos === 'MID' ? 'Midfielders' : 'Forwards'}
                </button>
              ))}
            </div>
          </div>

          {/* Squad Grid */}
          <div className="grid-responsive-3" style={{ marginBottom: '3.5rem' }}>
            {filteredSquad.map(player => {
              const stat = playerStats.find(s => s.member_id === player.id);

              return (
                <div
                  key={player.id}
                  className="glass-panel glass-panel-interactive"
                  style={{
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  {/* Photo & Number Banner */}
                  <div style={{ height: '220px', position: 'relative', overflow: 'hidden' }}>
                    <img
                      src={player.photo_url}
                      alt={player.full_name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(14,20,30,0.9), transparent)' }} />
                    <div style={{
                      position: 'absolute',
                      top: '12px',
                      right: '12px',
                      fontFamily: 'var(--font-heading)',
                      fontWeight: 900,
                      fontSize: '1.75rem',
                      color: '#FFFFFF',
                      textShadow: '0 2px 8px rgba(0,0,0,0.8)',
                    }}>
                      #{player.jersey_number}
                    </div>
                    <div style={{ position: 'absolute', bottom: '12px', left: '16px' }}>
                      <span className="badge" style={{ backgroundColor: 'var(--club-primary)', color: '#FFFFFF', marginBottom: '4px' }}>
                        {player.player_position}
                      </span>
                      <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#FFFFFF' }}>
                        {player.full_name}
                      </h3>
                    </div>
                  </div>

                  {/* Player Stats Mini Grid */}
                  <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', textAlign: 'center' }}>
                      <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.5rem 0.2rem', borderRadius: '6px' }}>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>APPS</div>
                        <div style={{ fontWeight: 800, color: '#FFFFFF' }}>{stat?.appearances || 0}</div>
                      </div>
                      <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.5rem 0.2rem', borderRadius: '6px' }}>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>GOALS</div>
                        <div style={{ fontWeight: 800, color: '#10B981' }}>{stat?.goals || 0}</div>
                      </div>
                      <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.5rem 0.2rem', borderRadius: '6px' }}>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>ASSISTS</div>
                        <div style={{ fontWeight: 800, color: '#F59E0B' }}>{stat?.assists || 0}</div>
                      </div>
                      <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.5rem 0.2rem', borderRadius: '6px' }}>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>MOTM</div>
                        <div style={{ fontWeight: 800, color: '#3B82F6' }}>{stat?.motm_awards || 0}</div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      <span>Nationality: <strong style={{ color: 'var(--text-secondary)' }}>{player.nationality || 'Local'}</strong></span>
                      <Link href={`/${club.slug}/member`} style={{ color: 'var(--club-primary)', fontWeight: 700 }}>
                        View Pass &rarr;
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Leaderboard View Switcher */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '2rem' }}>
            <div style={{
              display: 'inline-flex',
              background: 'rgba(0,0,0,0.4)',
              padding: '0.35rem',
              borderRadius: '12px',
              border: '1px solid var(--border-subtle)',
              gap: '0.4rem'
            }}>
              <button
                onClick={() => setLeaderboardMode('clubscore')}
                style={{
                  padding: '0.55rem 1.25rem',
                  borderRadius: '8px',
                  border: 'none',
                  background: leaderboardMode === 'clubscore' ? 'var(--club-primary)' : 'transparent',
                  color: leaderboardMode === 'clubscore' ? '#FFFFFF' : 'var(--text-muted)',
                  fontWeight: 800,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  transition: 'all 0.2s',
                }}
              >
                <Trophy size={16} color={leaderboardMode === 'clubscore' ? '#FFFFFF' : '#F59E0B'} />
                <span>🏆 ClubScore Fantasy League</span>
              </button>

              <button
                onClick={() => setLeaderboardMode('traditional')}
                style={{
                  padding: '0.55rem 1.25rem',
                  borderRadius: '8px',
                  border: 'none',
                  background: leaderboardMode === 'traditional' ? 'var(--club-primary)' : 'transparent',
                  color: leaderboardMode === 'traditional' ? '#FFFFFF' : 'var(--text-muted)',
                  fontWeight: 800,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  transition: 'all 0.2s',
                }}
              >
                <Award size={16} />
                <span>⚽ Traditional Match Stats</span>
              </button>
            </div>
          </div>

          {leaderboardMode === 'clubscore' ? (
            <div id="leaderboard">
              <ClubScoreLeaderboard
                club={club}
                members={clubMembers}
                profiles={clubScoreProfiles}
              />
            </div>
          ) : (
            /* Golden Boot & Playmaker Leaderboard */
            <div id="leaderboard" className="glass-panel" style={{ padding: '2rem' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.5rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Trophy size={20} color="#F59E0B" /> Traditional Club Leaderboard (2025/2026)
                  </h3>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Top individual season performances</span>
                </div>

                {/* Leaderboard Metric Selector */}
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {(['goals', 'assists', 'appearances'] as const).map(tab => (
                    <button
                      key={tab}
                      onClick={() => setLeaderboardTab(tab)}
                      style={{
                        padding: '0.35rem 0.75rem',
                        borderRadius: '6px',
                        border: 'none',
                        background: leaderboardTab === tab ? 'var(--club-primary)' : 'rgba(255,255,255,0.06)',
                        color: leaderboardTab === tab ? '#FFFFFF' : 'var(--text-muted)',
                        fontWeight: 700,
                        fontSize: '0.75rem',
                        textTransform: 'uppercase',
                        cursor: 'pointer',
                      }}
                    >
                      {tab === 'goals' ? 'Top Scorers' : tab === 'assists' ? 'Top Assists' : 'Most Appearances'}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {leaderboardList.map((item, index) => (
                  <div
                    key={item.player?.id || index}
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <div style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        background: index === 0 ? '#F59E0B' : index === 1 ? '#94A3B8' : index === 2 ? '#B45309' : 'rgba(255,255,255,0.1)',
                        color: '#000000',
                        fontWeight: 900,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.8rem',
                      }}>
                        {index + 1}
                      </div>

                      <img
                        src={item.player?.photo_url}
                        alt={item.player?.full_name}
                        style={{ width: '36px', height: '36px', borderRadius: '8px', objectFit: 'cover' }}
                      />

                      <div>
                        <div style={{ fontWeight: 800, color: '#FFFFFF', fontSize: '0.95rem' }}>{item.player?.full_name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          #{item.player?.jersey_number} • {item.player?.player_position}
                        </div>
                      </div>
                    </div>

                    <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 900, fontSize: '1.4rem', color: 'var(--club-primary)' }}>
                      {leaderboardTab === 'goals' ? `${item.stat.goals} Goals` : leaderboardTab === 'assists' ? `${item.stat.assists} Assists` : `${item.stat.appearances} Apps`}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* 4.8 HOME GROUND DETAILS & MAP */}
      <section id="stadium" style={{ padding: '5rem 0', background: 'rgba(255,255,255,0.015)' }}>
        <div className="container">
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(320px, 100%), 1fr))',
            gap: '3rem',
            alignItems: 'center',
          }}>
            <div>
              <span className="badge badge-primary" style={{ marginBottom: '0.6rem' }}>HOME GROUND</span>
              <h2 style={{ fontSize: '2.2rem', fontWeight: 900, marginBottom: '1rem' }}>
                {club.stadium_name}
              </h2>

              <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '1.5rem' }}>
                Our sacred home fortress. Built to host premier championship fixtures, youth tournament finals, and community training camps.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
                <div className="glass-panel" style={{ padding: '0.85rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <MapPin size={20} color="var(--club-primary)" />
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Location Address</div>
                    <div style={{ fontWeight: 700, color: '#FFFFFF' }}>{club.stadium_address}</div>
                  </div>
                </div>

                <div className="glass-panel" style={{ padding: '0.85rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <Shield size={20} color="var(--club-primary)" />
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Pitch Surface</div>
                    <div style={{ fontWeight: 700, color: '#FFFFFF' }}>{club.stadium_pitch_type}</div>
                  </div>
                </div>
              </div>

              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                Parking: {club.stadium_parking_info}
              </div>
            </div>

            {/* Interactive Map Embed / Visual Map Presentation */}
            <div className="glass-panel" style={{ overflow: 'hidden', border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-xl)' }}>
              <div style={{ height: '380px', position: 'relative', background: '#131b26' }}>
                {/* Embedded Map Representation */}
                <iframe
                  title="Home Ground Map"
                  width="100%"
                  height="100%"
                  frameBorder="0"
                  scrolling="no"
                  marginHeight={0}
                  marginWidth={0}
                  src="https://www.openstreetmap.org/export/embed.html?bbox=-74.015%2C40.705%2C-73.995%2C40.720&amp;layer=mapnik&amp;marker=40.7128%2C-74.006"
                  style={{ border: 'none', filter: 'invert(90%) hue-rotate(180deg)' }}
                />
                <div style={{
                  position: 'absolute',
                  bottom: '16px',
                  left: '16px',
                  right: '16px',
                  background: 'rgba(10, 15, 23, 0.9)',
                  backdropFilter: 'blur(10px)',
                  padding: '0.85rem 1.25rem',
                  borderRadius: '12px',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#FFFFFF' }}>{club.stadium_name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Gates open 90m before kickoff</div>
                  </div>
                  <a
                    href={`https://maps.google.com/?q=${encodeURIComponent(club.stadium_address)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-primary btn-sm"
                    style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                  >
                    <span>Directions</span>
                    <ExternalLink size={12} />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4.9 CONTACT MODAL */}
      <ContactModal
        club={club}
        isOpen={contactModalOpen}
        onClose={() => setContactModalOpen(false)}
      />

      {/* News Article Modal */}
      {activeNewsModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 999,
          background: 'rgba(0, 0, 0, 0.85)',
          backdropFilter: 'blur(12px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem',
        }}>
          <div className="glass-panel" style={{
            width: '100%',
            maxWidth: '650px',
            maxHeight: '85vh',
            overflowY: 'auto',
            background: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-medium)',
            borderRadius: 'var(--radius-xl)',
            padding: '2rem',
          }}>
            <img
              src={activeNewsModal.cover_image_url}
              alt={activeNewsModal.title}
              style={{ width: '100%', height: '220px', borderRadius: '12px', objectFit: 'cover', marginBottom: '1.25rem' }}
            />
            <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#FFFFFF', marginBottom: '0.5rem' }}>
              {activeNewsModal.title}
            </h3>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
              Published by {activeNewsModal.author_name} • {new Date(activeNewsModal.published_at).toLocaleDateString()}
            </div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.925rem', lineHeight: 1.7, whiteSpace: 'pre-line', marginBottom: '2rem' }}>
              {activeNewsModal.content}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setActiveNewsModal(null)} className="btn btn-primary btn-sm">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
