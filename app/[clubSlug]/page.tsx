'use client';

import { PageSkeleton } from '@/components/Skeleton';
import React, { useState, useEffect, use, useMemo, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { useClub } from '@/lib/club-context';
import { matchTypeTag } from '@/lib/fixture-label';
import { useAuth } from '@/lib/auth-context';
import ContactModal from '@/components/ContactModal';
import ClubContactSection from '@/components/ClubContactSection';
import MatchGlideLink from '@/components/MatchGlideLink';
import ClubIdentitySection from '@/components/ClubIdentitySection';
import MatchdayStrip, { When as MatchWhen } from '@/components/MatchdayStrip';
import PlayerAvatar from '@/components/PlayerAvatar';
import { clubPlaysIn, kickoff, latestFirst, publicFixtures, soonestFirst } from '@/lib/fixtures';
import SponsorLogo from '@/components/SponsorLogo';
import CoverImage from '@/components/CoverImage';
import SponsorTrackedLink from '@/components/SponsorTrackedLink';
import { isSponsorOnSite, sortSponsorsByTier, sponsorLabel } from '@/lib/sponsors';
import LocalTime from '@/components/LocalTime';
import { DEFAULT_CREST, crestFallbackRef, crestOnError } from '@/lib/crest';
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
  X,
  CalendarPlus
} from 'lucide-react';
import { Match, ClubEvent, EventCategory, NewsArticle, isPlayerMember } from '@/lib/supabase/types';
import { getLiveMinute } from '@/lib/match-clock';
import LiveMinute from '@/components/LiveMinute';
import { defaultSeasonLabel } from '@/lib/season';
import { clubTeamsOf, defaultTeamOf, juniorMemberIds, publicPlayerIds, publicScoreHidden, teamLabel, teamMemberIds, teamOfMatch, withTeamSide } from '@/lib/teams';
import { SITE_URL, matchPath, newsPath } from '@/lib/slugs';
import { HOME_NEWS_COUNT, newestFirst } from '@/lib/news';

const EVENT_TAB_LABELS: Record<EventCategory, string> = {
  match: 'Match',
  training: 'Training',
  social: 'Social',
  agm: 'AGM',
  trial: 'Trials',
  tournament: 'Tournament',
};

// Visitors who ask for less motion get a still hero (no autoplay)
const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';
const subscribeReducedMotion = (onChange: () => void) => {
  const mq = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(REDUCED_MOTION) : null;
  mq?.addEventListener?.('change', onChange);
  return () => mq?.removeEventListener?.('change', onChange);
};
const reducedMotionNow = () => typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia(REDUCED_MOTION).matches;

interface HomeHeroSlide {
  id: string;
  category: 'club' | 'match' | 'news' | 'event' | 'stadium' | 'image';
  tabLabel: string;
  // Short category word shown on phones in place of a pinned title, which would be cut off there
  phoneTabLabel?: string;
  badge: string;
  bgImage: string;
  /** A flyer used as the background: shown softly blurred so the headline over it stays readable */
  bgIsFlyer?: boolean;
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
    seasons,
    getActiveSeason,
    clubTeams,
    clubTeamMembers,
    tournamentParticipants,
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
  // Clubs with several teams: '' = the main team, 'ALL' = every team, else a team id
  const [fixturesTeamFilter, setFixturesTeamFilter] = useState<string>('');
  const [leaderboardTab, setLeaderboardTab] = useState<'goals' | 'assists' | 'appearances'>('goals');
  const [contactModalOpen, setContactModalOpen] = useState(false);

  // Hero Slider states
  const [activeSlide, setActiveSlide] = useState(0);
  const [isSliderPaused, setIsSliderPaused] = useState(false);
  // Touch, keyboard or a swipe on the slider stops autoplay for good: phones have no hover to pause it
  const [sliderTouched, setSliderStopped] = useState(false);
  const prefersReducedMotion = useSyncExternalStore(subscribeReducedMotion, reducedMotionNow, () => false);
  const sliderStopped = sliderTouched || prefersReducedMotion;
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
  // Clubs with several teams: the home page shows the main team's squad (everyone if it has no list yet)
  const teams = clubTeamsOf(clubTeams, clubId);
  const multiTeam = teams.length > 1;
  const mainTeam = defaultTeamOf(clubTeams, clubId);
  const mainSquadIds = multiTeam && mainTeam ? new Set(teamMemberIds(clubTeamMembers, mainTeam.id)) : null;
  // Junior players stay out of the public squad, rankings and leaderboards
  const juniorIds = juniorMemberIds(clubMembers, clubTeams, clubTeamMembers, { includeU18: club?.junior_includes_u18 !== false });
  const publicMembers = clubMembers.filter(m => !juniorIds.has(m.id));
  const squadPlayers = publicMembers.filter(m => isPlayerMember(m) && (!mainSquadIds?.size || mainSquadIds.has(m.id)));
  // 99 is "no order set"; 0 is a real position (e.g. the President first)
  const executiveStaff = clubMembers.filter(m => m.is_executive).sort((a, b) => (a.executive_order ?? 99) - (b.executive_order ?? 99));
  // A junior or reserve game names our side after its team ("Rovers U12"), not the club
  const clubMatches = matches.filter(m => m.club_id === clubId).map(m => (club ? withTeamSide(m, club, clubTeams) : m));
  const liveMatch = publicFixtures(clubMatches).find(m => m.status === 'live');

  const resolvedSeasonName = fixturesSeasonFilter === 'CURRENT'
    ? (activeSeason?.name || defaultSeasonLabel())
    : fixturesSeasonFilter;

  // A club that never set up a season runs on the fallback label, which rolls over on 1 August
  // (lib/season.ts). An Australian winter season spans that date, so games saved under last
  // year's label in the same calendar year still count as current. Rows with no season always do.
  const previousFallback = defaultSeasonLabel(new Date(new Date().getFullYear() - 1, new Date().getMonth(), 15));
  const inCurrentSeason = (m: typeof clubMatches[number]) => {
    if (!m.season || m.season === resolvedSeasonName) return true;
    if (clubSeasons.length > 0 || fixturesSeasonFilter !== 'CURRENT') return false;
    return m.season === previousFallback && new Date(m.match_date).getFullYear() === new Date().getFullYear();
  };
  const filteredClubMatches = clubMatches.filter(m => fixturesSeasonFilter === 'ALL' || inCurrentSeason(m));

  // Only games the club's own players are in: a hosted cup between other clubs stays on its tournament page
  // and in-house games (two of the club's own sides) stay with the squad, not the public fixture list
  const ourMatches = publicFixtures(filteredClubMatches.filter(m => clubPlaysIn(m, tournamentParticipants, club?.name || '')), clubMatches);
  // What's coming up never hides behind a season label: the current view lists every future game
  const ourAllMatches = publicFixtures(clubMatches.filter(m => clubPlaysIn(m, tournamentParticipants, club?.name || '')), clubMatches);
  const upcomingSource = fixturesSeasonFilter === 'CURRENT' ? ourAllMatches : ourMatches;
  // The hero and matchday strip lead with the main team's games (as the Fixtures list below does);
  // another team's game only when the main team has nothing coming up
  const mainTeamFirst = (a: typeof clubMatches[number], b: typeof clubMatches[number]) => {
    const otherTeam = (m: typeof clubMatches[number]) => {
      const team = teamOfMatch(m, clubTeams);
      return Number(!!mainTeam && !!team && team.id !== mainTeam.id);
    };
    return otherTeam(a) - otherTeam(b);
  };
  const upcomingMatches = upcomingSource.filter(m => m.status === 'upcoming').sort((a, b) => mainTeamFirst(a, b) || soonestFirst(a, b));
  // The Upcoming list also keeps postponed games, so fans can see a game was moved rather than lose it
  const upcomingFixtures = upcomingSource.filter(m => m.status === 'upcoming' || m.status === 'postponed').sort(soonestFirst);
  const pastMatches = ourMatches.filter(m => m.status === 'completed').sort(latestFirst);
  // Matchday strip: the latest result of any season, so it never empties when a season rolls over
  const lastResult = ourAllMatches.filter(m => m.status === 'completed').sort((a, b) => mainTeamFirst(a, b) || latestFirst(a, b))[0];
  // The fixtures list can be narrowed to one team; internal and tournament matches show under every team
  const fixturesTeamId = fixturesTeamFilter || mainTeam?.id || 'ALL';
  const inFixturesTeam = (m: typeof clubMatches[number]) => {
    if (!multiTeam || fixturesTeamId === 'ALL') return true;
    const team = teamOfMatch(m, clubTeams);
    return !team || team.id === fixturesTeamId;
  };
  const clubEvents = events.filter(e => e.club_id === clubId);
  // Soonest first, and only events that haven't finished yet
  const nowMs = Date.now();
  const upcomingEvents = clubEvents
    .filter(e => { const end = Date.parse(e.end_time || e.start_time); return Number.isNaN(end) || end >= nowMs; })
    .sort((a, b) => (Date.parse(a.start_time) || 0) - (Date.parse(b.start_time) || 0));
  const nextEvent = upcomingEvents[0] || clubEvents[0];
  // The strip's next match skips a game left on "upcoming" after it was played (no result entered yet)
  const stripNextMatch = upcomingMatches.find(m => kickoff(m) >= nowMs - 3 * 3600000);
  // Club-wide showcase only - event-scoped sponsors show on their own event's page instead.
  // Admins also load hidden and ended sponsors; they see the same showcase as fans.
  const clubSponsors = sponsors.filter(s => s.club_id === clubId && !s.event_id && isSponsorOnSite(s));
  const clubNews = newestFirst(news.filter(n => n.club_id === clubId));
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

  // Players ranked on the pitch this season: goals, then assists, Player of the Match, appearances.
  // Not ClubScore XP: its sign-up and attendance points put brand-new members above people who played.
  const currentSeasonName = activeSeason?.name || defaultSeasonLabel();
  const statFor = (memberId: string) =>
    playerStats.find(st => st.member_id === memberId && st.season === currentSeasonName);
  const rankedSquad = [...filteredSquad].sort((a, b) =>
    (statFor(b.id)?.goals ?? 0) - (statFor(a.id)?.goals ?? 0) ||
    (statFor(b.id)?.assists ?? 0) - (statFor(a.id)?.assists ?? 0) ||
    (statFor(b.id)?.motm_awards ?? 0) - (statFor(a.id)?.motm_awards ?? 0) ||
    (statFor(b.id)?.appearances ?? 0) - (statFor(a.id)?.appearances ?? 0) ||
    a.full_name.localeCompare(b.full_name)
  );
  const topPlayers = rankedSquad.slice(0, 5);
  // A rank only means something once a player has played: no "1st" for whoever sorts first by name
  const hasSeasonStats = (memberId: string) => {
    const st = statFor(memberId);
    return !!(st?.appearances || st?.goals || st?.assists || st?.motm_awards);
  };
  const anyRanked = topPlayers.some(p => hasSeasonStats(p.id));
  const countOf = (n: number | undefined, word: string) => `${n || 0} ${word}${n === 1 ? '' : 's'}`;

  const positionPills = (
    <div className="scroll-pill-strip" style={{ maxWidth: '100%', flexWrap: 'wrap' }} role="group" aria-label="Filter players by position">
      {(['ALL', 'GK', 'DEF', 'MID', 'FWD'] as const).map(pos => (
        <button
          key={pos}
          type="button"
          onClick={() => setSquadFilter(pos)}
          aria-pressed={squadFilter === pos}
          className="btn btn-sm scroll-pill-item touch-target"
          style={{
            background: squadFilter === pos ? 'var(--club-primary)' : 'rgba(255,255,255,0.06)',
            color: squadFilter === pos ? 'var(--club-primary-contrast, #090D16)' : 'var(--text-secondary)',
            border: '1px solid var(--border-subtle)',
            minHeight: '38px',
          }}
        >
          {pos === 'ALL' ? 'All Positions' : pos === 'GK' ? 'Goalkeepers' : pos === 'DEF' ? 'Defenders' : pos === 'MID' ? 'Midfielders' : 'Forwards'}
        </button>
      ))}
    </div>
  );

  // Top leaderboard players: this season only, and only people with at least one of the stat
  const leaderboardValue = (s: { goals: number; assists: number; appearances: number }) =>
    leaderboardTab === 'goals' ? s.goals : leaderboardTab === 'assists' ? s.assists : s.appearances;
  const leaderboardList = [...playerStats]
    .filter(s => s.club_id === clubId && !juniorIds.has(s.member_id) && s.season === currentSeasonName && (leaderboardValue(s) || 0) > 0)
    .sort((a, b) => leaderboardValue(b) - leaderboardValue(a))
    .slice(0, 5)
    .map(stat => {
      const player = clubMembers.find(m => m.id === stat.member_id);
      return { stat, player };
    });
  // Who has a public player page (adult players), for the leaderboard's name links
  const playerPageIds = publicPlayerIds(clubMembers, clubTeams, clubTeamMembers, { includeU18: club?.junior_includes_u18 !== false });

  // Dynamic multi-slider definition reading admin pinned items or falling back to defaults
  const heroSlides: HomeHeroSlide[] = useMemo(() => {
    if (!club) return [];

    const activePins = (club.hero_pinned_items || []).filter(p => p.is_active);

    if (activePins.length > 0) {
      const pinnedSlides: HomeHeroSlide[] = activePins.map((item, idx) => {
        if (item.type === 'fixture') {
          const matchItem = clubMatches.find(m => m.id === item.target_id) || liveMatch || upcomingMatches[0];
          const isLive = matchItem?.status === 'live';
          const compClean = (!matchItem?.competition || matchItem.competition === 'Premier Regional League')
            ? (matchItem?.match_type ? `${matchItem.match_type.charAt(0).toUpperCase() + matchItem.match_type.slice(1)} Match` : 'Club Friendly')
            : matchItem.competition;
          return {
            id: item.id || `pin-fixture-${idx}`,
            category: 'match',
            phoneTabLabel: isLive ? 'Live Match' : 'Fixture',
            tabLabel: item.title ? (item.title.length > 18 ? item.title.substring(0, 16) + '...' : item.title) : 'Fixture',
            badge: item.badge || (isLive ? `MATCHDAY LIVE • ${getLiveMinute(matchItem)}' IN PLAY` : `FIXTURE • ${compClean}`),
            bgImage: item.image_url || club.banner_url || '',
            title: item.title || (matchItem ? `${matchItem.home_team_name} vs ${matchItem.away_team_name}` : `${club.name} Matchday`),
            subtitle: item.subtitle || (matchItem ? `${compClean} • ${matchItem.venue}` : 'Official Club Match Schedule'),
            ctaLabel: item.cta_label || (isLive ? 'Enter Match Centre Live' : 'Match Preview & Lineups'),
            ctaLink: item.cta_link || (matchItem ? matchPath(club.slug, matchItem) : `/${club.slug}`),
            targetMatch: matchItem,
          };
        }

        if (item.type === 'news') {
          const article = news.find(n => n.id === item.target_id) || featuredArticle;
          return {
            id: item.id || `pin-news-${idx}`,
            category: 'news',
            phoneTabLabel: article?.tags?.[0] || 'News',
            tabLabel: item.title ? (item.title.length > 18 ? item.title.substring(0, 16) + '...' : item.title) : 'News',
            // Slides saved before Oct 2026 carry a made-up "BREAKING NEWS" label; the club never chose it
            badge: (item.badge || '').replace(/^BREAKING NEWS/i, 'LATEST NEWS') || (article?.tags?.[0] ? `LATEST NEWS • ${article.tags[0]}` : 'LATEST NEWS'),
            bgImage: item.image_url || article?.cover_image_url || club.banner_url || '',
            title: item.title || article?.title || `${club.name} news`,
            subtitle: item.subtitle || article?.summary || 'Latest match summaries and announcements.',
            ctaLabel: item.cta_label || 'Read Full Story',
            ctaLink: item.cta_link || `/${club.slug}#news`,
            targetNews: article,
          };
        }

        if (item.type === 'event') {
          const evt = events.find(e => e.id === item.target_id) || nextEvent;
          return {
            id: item.id || `pin-event-${idx}`,
            category: 'event',
            phoneTabLabel: evt?.category ? EVENT_TAB_LABELS[evt.category] : 'Event',
            tabLabel: item.title ? (item.title.length > 18 ? item.title.substring(0, 16) + '...' : item.title) : 'Event',
            badge: item.badge || `UPCOMING EVENT • ${evt?.category?.toUpperCase() || 'CALENDAR'}`,
            bgImage: evt?.flyer_url || item.image_url || club.banner_url || '',
            bgIsFlyer: Boolean(evt?.flyer_url),
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
          phoneTabLabel: 'Spotlight',
          tabLabel: item.title ? (item.title.length > 18 ? item.title.substring(0, 16) + '...' : item.title) : 'Spotlight',
          // Older default home ground slides were saved as "HOME FORTRESS" / "<ground> Fortress"
          badge: (item.badge || 'SPOTLIGHT').replace(/^HOME FORTRESS$/i, 'HOME GROUND'),
          bgImage: item.image_url || club.banner_url || '',
          title: (item.title || club.name).replace(/ Fortress$/, ''),
          subtitle: item.subtitle || club.motto || '',
          ctaLabel: item.cta_label || 'Find out more',
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
        bgImage: (club.slider_images && club.slider_images[0]) || club.banner_url || '',
        title: liveMatch
          ? `${liveMatch.home_team_name} vs ${liveMatch.away_team_name}`
          : upcomingMatches[0]
          ? `${upcomingMatches[0].home_team_name} vs ${upcomingMatches[0].away_team_name}`
          : `${club.name} Matchday Hub`,
        subtitle: liveMatch
          ? `${(!liveMatch.competition || liveMatch.competition === 'Premier Regional League') ? 'Club Match' : liveMatch.competition} • In Play at ${liveMatch.venue}`
          : upcomingMatches[0]
          ? `${(!upcomingMatches[0].competition || upcomingMatches[0].competition === 'Premier Regional League') ? 'Club Fixture' : upcomingMatches[0].competition}${upcomingMatches[0].venue ? ` • ${upcomingMatches[0].venue}` : ''}`
          : 'Official Match Schedule & Match Reports',
        targetMatch: liveMatch || upcomingMatches[0],
      },
      {
        id: 'latest-news',
        category: 'news',
        tabLabel: 'Latest News',
        badge: featuredArticle?.tags?.[0] ? `LATEST NEWS • ${featuredArticle.tags[0]}` : 'LATEST NEWS',
        bgImage: featuredArticle?.cover_image_url || club.banner_url || '',
        title: featuredArticle?.title || `${club.name} news`,
        subtitle: featuredArticle?.summary || 'Match reports and club announcements.',
        targetNews: featuredArticle,
      },
      {
        id: 'club-events',
        category: 'event',
        tabLabel: 'Events & Trials',
        badge: `UPCOMING EVENT • ${nextEvent?.category?.toUpperCase() || 'CALENDAR'}`,
        bgImage: nextEvent?.flyer_url || club.banner_url || '',
        bgIsFlyer: Boolean(nextEvent?.flyer_url),
        title: nextEvent?.title || `${club.name} Open Training Session`,
        subtitle: nextEvent?.description || 'Fan sessions, community training camps, and player trial opportunities.',
        targetEvent: nextEvent,
      },
      {
        id: 'stadium-atmosphere',
        category: 'stadium',
        tabLabel: 'Home ground',
        badge: `HOME GROUND • ${club.stadium_name}`,
        bgImage: (club.slider_images && club.slider_images[1]) || gallery[0]?.media_url || '',
        title: club.stadium_name,
        subtitle: club.stadium_pitch_type,
      }
    ];
  }, [club, club?.hero_pinned_items, matches, liveMatch, upcomingMatches, news, featuredArticle, events, nextEvent, gallery]);

  // Autoplay ticker with pause-on-hover
  useEffect(() => {
    if (isSliderPaused || sliderStopped || heroSlides.length <= 1) return;
    const interval = setInterval(() => {
      setActiveSlide(prev => (prev + 1) % heroSlides.length);
    }, 6500);
    return () => clearInterval(interval);
  }, [isSliderPaused, sliderStopped, heroSlides.length]);

  const currentSlide = heroSlides[activeSlide] || heroSlides[0];

  // Loading state while hydrating
  if (!club) {
    if (!isHydrated) {
      return (
        <PageSkeleton label="Loading the club" />
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
    // The page's main landmark, so screen-reader users can jump past the menu straight to it
    <main style={{ position: 'relative' }}>
      <h1 style={{ position: 'absolute', width: '1px', height: '1px', padding: 0, margin: '-1px', overflow: 'hidden', clip: 'rect(0, 0, 0, 0)', whiteSpace: 'nowrap', border: 0 }}>
        {club.name}
      </h1>
      {/* 4.1 HERO SHOWCASE SECTION (MULTI-SLIDE CAROUSEL & CREST EMBLEM) */}
      <section
        onMouseEnter={() => setIsSliderPaused(true)}
        onMouseLeave={() => setIsSliderPaused(false)}
        onTouchStart={() => setSliderStopped(true)}
        onFocusCapture={() => setSliderStopped(true)}
        className="club-hero-section"
        data-theme="dark" style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-start',
          background: currentSlide.bgIsFlyer
            ? 'var(--bg-pitch)'
            : `linear-gradient(to bottom, rgba(var(--dk-7-10-15), 0.45) 0%, rgba(var(--dk-7-10-15), 0.88) 75%, var(--bg-pitch) 100%), ${currentSlide.bgImage ? `url(${currentSlide.bgImage}) center/cover no-repeat` : 'var(--club-primary)'}`,
          borderBottom: '1px solid var(--border-subtle)',
          padding: '2.5rem 0 2.5rem 0',
          transition: 'background-image 0.7s cubic-bezier(0.16, 1, 0.3, 1)',
          overflow: 'hidden',
        }}
      >
        {currentSlide.bgIsFlyer && (
          <>
            <div aria-hidden style={{ position: 'absolute', inset: '-24px', zIndex: 0, pointerEvents: 'none', background: `url(${JSON.stringify(currentSlide.bgImage)}) center/cover no-repeat`, filter: 'blur(6px) saturate(1.15)' }} />
            <div aria-hidden style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none', background: 'linear-gradient(to bottom, rgba(var(--dk-7-10-15), 0.55) 0%, rgba(var(--dk-7-10-15), 0.9) 75%, var(--bg-pitch) 100%)' }} />
          </>
        )}
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
            <img loading="eager" decoding="async" fetchPriority="high" src={club.logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', filter: 'grayscale(100%)' }} />
          ) : (
            <Shield size={400} color="var(--text-primary)" />
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
                const activeSlideEvent = currentSlide.targetEvent || nextEvent;

                return (
                  <>
                    {/* SLIDE: MATCHDAY LIVE / FIXTURE CLASH */}
                    {currentSlide.category === 'match' && (
                      <div>
                        <div data-theme="dark" style={{
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
                              <img loading="eager" decoding="async" src={club.logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                            ) : (
                              <Shield size={13} color={club.primary_color} />
                            )}
                          </div>
                          <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-primary)' }}>{club.name}</span>
                          <span className="text-muted">•</span>
                          <span style={{ fontSize: '0.75rem', color: activeSlideMatch?.status === 'live' ? 'var(--c-red)' : 'var(--club-primary)', fontWeight: 700 }}>
                            {currentSlide.badge}
                          </span>
                        </div>

                        <h2 style={{
                          fontSize: 'clamp(2.2rem, 4.5vw, 3.6rem)',
                          fontWeight: 900,
                          lineHeight: 1.1,
                          letterSpacing: '-0.03em',
                          marginBottom: '1rem',
                          color: 'var(--text-primary)',
                        }}>
                          {currentSlide.title}
                        </h2>

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
                            href={activeSlideMatch ? matchPath(club.slug, activeSlideMatch) : `/${club.slug}`}
                            className="btn btn-primary"
                            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                          >
                            <Zap size={16} />
                            <span>{currentSlide.ctaLabel || (activeSlideMatch?.status === 'live' ? 'Enter Match Centre Live' : 'Full Fixture Centre')}</span>
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
                        <div data-theme="dark" style={{
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
                          <span style={{ fontSize: '0.75rem', color: 'var(--club-ink)', fontWeight: 800 }}>
                            {currentSlide.badge}
                          </span>
                        </div>

                        <h2 style={{
                          fontSize: 'clamp(2rem, 4.2vw, 3.2rem)',
                          fontWeight: 900,
                          lineHeight: 1.15,
                          letterSpacing: '-0.02em',
                          marginBottom: '1rem',
                          color: 'var(--text-primary)',
                        }}>
                          {currentSlide.title}
                        </h2>

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
                            <Link
                              href={newsPath(club.slug, activeSlideNews.slug)}
                              className="btn btn-primary row"
                            >
                              <Newspaper size={16} />
                              <span>{currentSlide.ctaLabel || 'Read Full Story'}</span>
                            </Link>
                          )}

                          <a
                            href="#news"
                            className="btn btn-secondary row"
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
                        <div data-theme="dark" style={{
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
                          <span style={{ fontSize: '0.75rem', color: 'var(--c-amber)', fontWeight: 800 }}>
                            {currentSlide.badge}
                          </span>
                        </div>

                        <h2 style={{
                          fontSize: 'clamp(2rem, 4.2vw, 3.2rem)',
                          fontWeight: 900,
                          lineHeight: 1.15,
                          letterSpacing: '-0.02em',
                          marginBottom: '1rem',
                          color: 'var(--text-primary)',
                        }}>
                          {currentSlide.title}
                        </h2>

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
                            className="btn btn-primary row"
                          >
                            <Mail size={16} />
                            <span>{currentSlide.ctaLabel || 'RSVP / Inquire for Event'}</span>
                          </button>

                          <a
                            href="#events"
                            className="btn btn-secondary row"
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
                        <div data-theme="dark" style={{
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
                          <span style={{ fontSize: '0.75rem', color: 'var(--c-amber)', fontWeight: 800 }}>
                            {currentSlide.badge}
                          </span>
                        </div>

                        <h2 style={{
                          fontSize: 'clamp(2rem, 4.2vw, 3.2rem)',
                          fontWeight: 900,
                          lineHeight: 1.15,
                          letterSpacing: '-0.02em',
                          marginBottom: '1rem',
                          color: 'var(--text-primary)',
                        }}>
                          {currentSlide.title}
                        </h2>

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
                            <span>{currentSlide.ctaLabel || 'Find out more'}</span>
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

              {/* SLIDE 5: HOME GROUND */}
              {currentSlide.category === 'stadium' && (
                <div>
                  <div data-theme="dark" style={{
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
                    <span style={{ fontSize: '0.75rem', color: 'var(--club-ink)', fontWeight: 800 }}>
                      {currentSlide.badge}
                    </span>
                  </div>

                  <h2 style={{
                    fontSize: 'clamp(2.2rem, 4.5vw, 3.6rem)',
                    fontWeight: 900,
                    lineHeight: 1.1,
                    letterSpacing: '-0.03em',
                    marginBottom: '1rem',
                    color: 'var(--text-primary)',
                  }}>
                    {club.stadium_name}
                  </h2>

                  <p style={{
                    fontSize: '1.15rem',
                    color: 'var(--text-secondary)',
                    marginBottom: '1.75rem',
                    lineHeight: 1.6,
                  }}>
                    Where {club.name} play home matches.{club.stadium_pitch_type ? ` Surface: ${club.stadium_pitch_type}.` : ''}
                  </p>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.85rem' }}>
                    <a
                      href="#stadium"
                      className="btn btn-primary row"
                    >
                      <MapPin size={16} />
                      <span>View Home Ground Map & Directions</span>
                    </a>

                    <a
                      href="#squad"
                      className="btn btn-secondary row"
                    >
                      <Users size={16} />
                      <span>First Team Squad</span>
                    </a>
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Interactive Card matching slide content. On phones an upcoming fixture's or
                a story's card only repeats the headline (and the matchday strip below), so it's left out
                there and the slide tabs stay above the bottom menu; a live score always shows. */}
            <div className={
              (currentSlide.category === 'match' && !['live', 'halftime'].includes(currentSlide.targetMatch?.status || ''))
              || currentSlide.category === 'news' ? 'club-hero-side-repeat' : undefined
            }>
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
                        background: 'rgba(var(--dk-18-26-38), 0.92)',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <span className="badge badge-live">
                            <span className="pulse-dot" /> {activeSlideMatch.is_paused ? 'MATCHDAY PAUSED' : 'MATCHDAY LIVE'} • <LiveMinute match={activeSlideMatch} />&apos;
                          </span>
                          <span className="text-note">
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
                            <img loading="eager" decoding="async" width={48} height={48}
                              src={activeSlideMatch.home_team_logo || DEFAULT_CREST}
                              alt={`${activeSlideMatch.home_team_name} crest`}
                              ref={crestFallbackRef}
                              onError={crestOnError}
                              style={{ width: '48px', height: '48px', borderRadius: '12px', objectFit: 'contain', padding: '4px', margin: '0 auto 0.5rem auto', border: '1px solid var(--border-subtle)' }}
                            />
                            <div style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--text-primary)', wordBreak: 'break-word' }}>{activeSlideMatch.home_team_name}</div>
                            <span className="text-meta">Home</span>
                          </div>

                          {/* Live Score */}
                          <div data-theme="dark" style={{
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
                              color: 'var(--text-primary)',
                              lineHeight: 1,
                            }}>
                              {publicScoreHidden(activeSlideMatch, clubTeams) ? 'VS' : `${activeSlideMatch.home_score} : ${activeSlideMatch.away_score}`}
                            </div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--c-red)', fontWeight: 700, marginTop: '4px', textTransform: 'uppercase' }}>
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
                            <img loading="eager" decoding="async" width={48} height={48}
                              src={activeSlideMatch.away_team_logo || DEFAULT_CREST}
                              alt={`${activeSlideMatch.away_team_name} crest`}
                              ref={crestFallbackRef}
                              onError={crestOnError}
                              style={{ width: '48px', height: '48px', borderRadius: '12px', objectFit: 'contain', padding: '4px', margin: '0 auto 0.5rem auto', border: '1px solid var(--border-subtle)' }}
                            />
                            <div style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--text-primary)', wordBreak: 'break-word' }}>{activeSlideMatch.away_team_name}</div>
                            <span className="text-meta">Away</span>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                          <div className="text-note">
                            Venue: <strong className="text-primary">{activeSlideMatch.venue}</strong>
                          </div>
                          <Link
                            href={matchPath(club.slug, activeSlideMatch)}
                            className="btn btn-primary btn-sm touch-target"
                            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                          >
                            <span>Full Match Centre</span>
                            <ChevronRight size={14} />
                          </Link>
                        </div>
                      </div>
                    ) : (
                      /* Next Fixture Countdown Card */
                      <div className="glass-panel" style={{ padding: '1.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <span className="badge badge-primary">FIXTURE SPOTLIGHT</span>
                          <span className="text-note">
                            {activeSlideMatch.competition === 'Premier Regional League' ? (activeSlideMatch.match_type ? activeSlideMatch.match_type.toUpperCase() + ' FIXTURE' : 'CLUB FRIENDLY') : (activeSlideMatch.competition || 'Club Match')}
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '1.5rem' }}>
                          <div style={{ textAlign: 'center', flex: 1, minWidth: 0 }}>
                            <img loading="eager" decoding="async" width={48} height={48}
                              src={activeSlideMatch.home_team_logo || DEFAULT_CREST}
                              alt={`${activeSlideMatch.home_team_name} crest`}
                              ref={crestFallbackRef}
                              onError={crestOnError}
                              style={{ width: '48px', height: '48px', borderRadius: '12px', objectFit: 'contain', padding: '4px', margin: '0 auto 0.5rem auto' }}
                            />
                            <div style={{ fontWeight: 800, fontSize: '0.9rem', wordBreak: 'break-word' }}>{activeSlideMatch.home_team_name}</div>
                          </div>
                          <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-muted)', padding: '0 0.5rem', flexShrink: 0 }}>VS</div>
                          <div style={{ textAlign: 'center', flex: 1, minWidth: 0 }}>
                            <img loading="eager" decoding="async" width={48} height={48}
                              src={activeSlideMatch.away_team_logo || DEFAULT_CREST}
                              alt={`${activeSlideMatch.away_team_name} crest`}
                              ref={crestFallbackRef}
                              onError={crestOnError}
                              style={{ width: '48px', height: '48px', borderRadius: '12px', objectFit: 'contain', padding: '4px', margin: '0 auto 0.5rem auto' }}
                            />
                            <div style={{ fontWeight: 800, fontSize: '0.9rem', wordBreak: 'break-word' }}>{activeSlideMatch.away_team_name}</div>
                          </div>
                        </div>
                        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', textAlign: 'center', marginBottom: '1.25rem' }}>
                          Kick-off: <MatchWhen m={activeSlideMatch} />{activeSlideMatch.venue ? ` · ${activeSlideMatch.venue}` : ''}
                        </div>
                        <Link
                          href={matchPath(club.slug, activeSlideMatch)}
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
                      <Link
                        href={newsPath(club.slug, activeSlideNews.slug)}
                        className="glass-panel glass-panel-interactive"
                        style={{
                          overflow: 'hidden',
                          display: 'flex',
                          flexDirection: 'column',
                          border: '1.5px solid var(--border-medium)',
                        }}
                      >
                        <div style={{ height: '200px', position: 'relative' }}>
                          <CoverImage
                            loading="eager"
                            src={activeSlideNews.cover_image_url || club.banner_url}
                            alt={activeSlideNews.title}
                            crestUrl={club.logo_url}
                            style={{ width: '100%', height: '100%' }}
                          />
                          <div style={{ position: 'absolute', top: '12px', left: '12px' }}>
                            <span className="badge badge-gold">{activeSlideNews.is_featured ? 'FEATURED' : 'LATEST NEWS'}</span>
                          </div>
                        </div>

                        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                          <div style={{ fontSize: '0.75rem', color: 'var(--club-ink)', fontWeight: 700, textTransform: 'uppercase' }}>
                            {activeSlideNews.tags?.join(' • ') || 'First Team'}
                          </div>
                          <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.3 }}>
                            {activeSlideNews.title}
                          </h3>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.75rem' }}>
                            <span>By {activeSlideNews.author_name || 'Media Team'}</span>
                            <span style={{ color: 'var(--club-ink)', fontWeight: 700 }}>Read Article &rarr;</span>
                          </div>
                        </div>
                      </Link>
                    );
                  })()}
                </div>
              )}

              {/* SLIDE 4 RIGHT: EVENT PASS & RSVP STATUS CARD */}
              {currentSlide.category === 'event' && (
                <div>
                  {(() => {
                    const activeSlideEvent = currentSlide.targetEvent || nextEvent;
                    if (!activeSlideEvent) return null;
                    return (
                      <div className="glass-panel" style={{
                        padding: '2rem',
                        border: '1.5px solid rgba(245, 158, 11, 0.3)',
                        background: 'rgba(var(--dk-14-20-30), 0.9)',
                      }}>
                        {activeSlideEvent.flyer_url && (
                          <Link
                            href={`/${club.slug}/events/${activeSlideEvent.id}`}
                            aria-label={`${activeSlideEvent.title} flyer`}
                            style={{ position: 'relative', display: 'flex', justifyContent: 'center', height: '220px', overflow: 'hidden', borderRadius: 'var(--radius-md)', background: 'rgba(0, 0, 0, 0.35)', margin: '-0.75rem -0.75rem 1.25rem' }}
                          >
                            <div aria-hidden style={{ position: 'absolute', inset: '-20px', backgroundImage: `url(${JSON.stringify(activeSlideEvent.flyer_url)})`, backgroundSize: 'cover', backgroundPosition: 'center', filter: 'blur(20px)', opacity: 0.45 }} />
                            <img src={activeSlideEvent.flyer_url} alt="" decoding="async" style={{ position: 'relative', height: '100%', maxWidth: '100%', objectFit: 'contain' }} />
                          </Link>
                        )}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                          <span className="badge badge-gold">EVENT INVITATION</span>
                          <span className="text-note">
                            {activeSlideEvent.is_public ? 'Public Access' : 'Members Only'}
                          </span>
                        </div>

                        <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
                          {activeSlideEvent.title}
                        </h3>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                          <div className="row">
                            <Calendar size={15} color="var(--club-primary)" />
                            <span><LocalTime value={activeSlideEvent.start_time} options={{ weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }} /></span>
                          </div>
                          <div className="row">
                            <MapPin size={15} color="var(--club-primary)" />
                            <span>{activeSlideEvent.location || club.stadium_name}</span>
                          </div>
                        </div>

                        {/* Attendance Progress Meter: only once people have checked in ("0 checked in" reads as nobody coming) */}
                        {activeSlideEvent.rsvp_count > 0 && (
                        <div style={{ marginBottom: '1.5rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.35rem' }}>
                            <span className="text-muted">Checked In</span>
                            <strong className="text-primary">{activeSlideEvent.rsvp_count}{activeSlideEvent.max_capacity > 0 ? ` / ${activeSlideEvent.max_capacity}` : ''} checked in</strong>
                          </div>
                          <div style={{ width: '100%', height: '6px', background: 'rgba(var(--tint-rgb), 0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{
                              width: `${activeSlideEvent.max_capacity > 0 ? Math.min(100, Math.round((activeSlideEvent.rsvp_count / activeSlideEvent.max_capacity) * 100)) : 0}%`,
                              height: '100%',
                              background: 'linear-gradient(90deg, var(--club-primary), var(--club-accent, var(--club-primary)))',
                            }} />
                          </div>
                        </div>
                        )}

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

              {/* SLIDE 5 RIGHT: HOME GROUND MAP */}
              {currentSlide.category === 'stadium' && (
                <div className="glass-panel" style={{
                  padding: '2rem',
                  border: '1.5px solid var(--border-medium)',
                  background: 'rgba(var(--dk-14-20-30), 0.9)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                    <span className="badge badge-primary">HOME GROUND</span>
                    <span className="text-note">Grounds & Facility</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                      <MapPin size={18} color="var(--club-primary)" />
                      <div>
                        <div className="text-meta">Address</div>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.9rem' }}>{club.stadium_address}</div>
                      </div>
                    </div>

                    {club.stadium_pitch_type && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                        <Shield size={18} color="var(--club-primary)" />
                        <div>
                          <div className="text-meta">Pitch Surface</div>
                          <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.9rem' }}>{club.stadium_pitch_type}</div>
                        </div>
                      </div>
                    )}
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
                  background: 'rgba(var(--dk-14-20-30), 0.92)',
                  display: 'flex',
                  flexDirection: 'column',
                }}>
                  <div style={{ height: '220px', position: 'relative' }}>
                    <CoverImage
                      loading="eager"
                      src={currentSlide.bgImage}
                      alt={currentSlide.title}
                      crestUrl={club.logo_url}
                      style={{ width: '100%', height: '100%' }}
                    />
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(var(--dk-14-20-30),0.95) 0%, transparent 60%)' }} />
                    <div style={{ position: 'absolute', top: '12px', left: '12px' }}>
                      <span className="badge badge-gold">{currentSlide.badge}</span>
                    </div>
                  </div>

                  <div style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.3 }}>
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
            borderTop: '1px solid rgba(var(--tint-rgb), 0.08)',
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
                    title={slide.title}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.5rem 0.95rem',
                      borderRadius: '30px',
                      border: isActive ? `1.5px solid ${club.primary_color}` : '1px solid rgba(var(--tint-rgb), 0.08)',
                      background: isActive ? 'rgba(var(--club-primary-rgb), 0.2)' : 'rgba(var(--shade-rgb), 0.45)',
                      color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
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
                      <span className="row row-inline row-tight">
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
                    {slide.phoneTabLabel ? (
                      <>
                        <span className="hero-tab-desktop">{slide.tabLabel}</span>
                        <span className="hero-tab-phone">{slide.phoneTabLabel}</span>
                      </>
                    ) : (
                      <span>{slide.tabLabel}</span>
                    )}

                    {/* Animated Progress Timer Bar when active and not paused */}
                    {isActive && !isSliderPaused && !sliderStopped && (
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
                data-theme="dark" style={{
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
                data-theme="dark" style={{
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

      {/* 4.15 MATCHDAY STRIP: next match and last result, always in view under the hero */}
      <MatchdayStrip
        club={club}
        live={liveMatch}
        next={stripNextMatch}
        last={lastResult}
        lastScoreHidden={lastResult ? publicScoreHidden(lastResult, clubTeams) : false}
      />

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

      {/* 4.3 FIXTURES & RESULTS */}
      <section id="fixtures" className="club-reveal club-section" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        <div className="container">
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '2rem' }}>
            <div>
              <span className="badge badge-primary" style={{ marginBottom: '0.4rem' }}>SCHEDULE</span>
              <h2 style={{ fontSize: '2rem', fontWeight: 900 }}>Fixtures & Match Results</h2>
              {/* webcal:// opens the device's calendar app with a subscription that keeps itself up to date */}
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', columnGap: '1rem' }}>
                <a
                  href={`${SITE_URL.replace(/^https?:/, 'webcal:')}/${club.slug}/calendar.ics`}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', minHeight: '44px', fontSize: '0.85rem', fontWeight: 700, color: 'var(--club-ink)' }}
                >
                  <CalendarPlus size={15} aria-hidden="true" /> Subscribe to fixtures &amp; events
                </a>
                {/* Android and desktop browsers often have no webcal:// handler; the file imports anywhere */}
                <a href={`/${club.slug}/calendar.ics`} download style={{ display: 'inline-flex', alignItems: 'center', minHeight: '44px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  or download .ics
                </a>
                <Link href={`/${club.slug}/fixtures`} style={{ display: 'inline-flex', alignItems: 'center', minHeight: '44px', fontSize: '0.85rem', fontWeight: 700, color: 'var(--club-ink)' }}>
                  All fixtures &amp; results →
                </Link>
              </div>
            </div>

            {/* Filter controls: Team & Season dropdowns & Tab switcher */}
            <div className="row row-loose row-wrap">
              {multiTeam && (
                <div className="row">
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700 }}>TEAM:</span>
                  <select aria-label="Team"
                    value={fixturesTeamId}
                    onChange={(e) => setFixturesTeamFilter(e.target.value)}
                    style={{
                      padding: '0.45rem 0.85rem',
                      background: 'rgba(var(--tint-rgb), 0.07)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      color: 'var(--text-primary)',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    {teams.map(t => (
                      <option key={t.id} value={t.id} style={{ background: 'rgb(var(--dk-17-24-39))', color: 'var(--text-primary)' }}>{t.name}</option>
                    ))}
                    <option value="ALL" style={{ background: 'rgb(var(--dk-17-24-39))', color: 'var(--text-primary)' }}>All Teams</option>
                  </select>
                </div>
              )}
              <div className="row">
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700 }}>SEASON:</span>
                <select aria-label="Season"
                  value={fixturesSeasonFilter}
                  onChange={(e) => setFixturesSeasonFilter(e.target.value)}
                  style={{
                    padding: '0.45rem 0.85rem',
                    background: 'rgba(var(--tint-rgb), 0.07)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text-primary)',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  <option value="CURRENT" style={{ background: 'rgb(var(--dk-17-24-39))', color: 'var(--text-primary)' }}>
                    Current Season ({activeSeason?.name || defaultSeasonLabel()})
                  </option>
                  <option value="ALL" style={{ background: 'rgb(var(--dk-17-24-39))', color: 'var(--text-primary)' }}>All Seasons</option>
                  {clubSeasons.map(s => (
                    <option key={s.id} value={s.name} style={{ background: 'rgb(var(--dk-17-24-39))', color: 'var(--text-primary)' }}>
                      {s.name} {s.is_current ? '(Active)' : `(${s.status})`}
                    </option>
                  ))}
                </select>
              </div>

              {/* Tab switchers */}
              <div style={{ display: 'flex', position: 'relative', background: 'rgba(var(--tint-rgb), 0.05)', padding: '4px', borderRadius: 'var(--radius-md)', flex: 1, minWidth: '220px' }}>
                {/* One club-colour pill that slides between the two tabs */}
                <span
                  aria-hidden="true"
                  className="tab-slider"
                  style={{
                    position: 'absolute', top: 4, bottom: 4, left: 4, width: 'calc(50% - 4px)',
                    borderRadius: 'var(--radius-sm)', background: 'var(--club-primary)',
                    translate: fixturesTab === 'results' ? '100% 0' : '0 0',
                  }}
                />
                <button
                  onClick={() => setFixturesTab('upcoming')}
                  style={{
                    flex: 1,
                    padding: '0.5rem 0.85rem',
                    borderRadius: 'var(--radius-sm)',
                    border: 'none',
                    position: 'relative',
                    background: 'transparent',
                    color: fixturesTab === 'upcoming' ? 'var(--club-primary-contrast, #090D16)' : 'var(--text-muted)',
                    transition: 'color 0.25s ease',
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
                    position: 'relative',
                    background: 'transparent',
                    color: fixturesTab === 'results' ? 'var(--club-primary-contrast, #090D16)' : 'var(--text-muted)',
                    transition: 'color 0.25s ease',
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

          <div className="stack">
            {(fixturesTab === 'upcoming' ? upcomingFixtures : pastMatches).filter(inFixturesTeam).length === 0 && (
              <div className="glass-panel" style={{ padding: '1.25rem 1.5rem', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: '0.5rem 1rem', textAlign: 'center' }}>
                <span className="text-meta">{fixturesTab === 'upcoming' ? 'No upcoming fixtures yet. Check back soon.' : 'No results yet this season.'}</span>
                {fixturesTab === 'upcoming' && pastMatches.some(inFixturesTeam) && (
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setFixturesTab('results')}>See latest results</button>
                )}
              </div>
            )}
            {(fixturesTab === 'upcoming' ? upcomingFixtures : pastMatches).filter(inFixturesTeam).map(match => {
              const matchTeam = multiTeam ? teamOfMatch(match, clubTeams) : undefined;
              const hideScore = publicScoreHidden(match, clubTeams);
              const competitionLabel = match.competition === 'Premier Regional League' ? (match.match_type ? `${match.match_type.toUpperCase()} MATCH` : 'CLUB FRIENDLY') : match.competition;
              // The match type badge, unless the competition label already says it ("Friendly" + "FRIENDLY")
              const typeTag = matchTypeTag({ match_type: match.match_type, competition: competitionLabel });
              return (
              // data-glide-card: opening the match glides this card into the match page's scoreboard (MatchGlideLink)
              <div key={match.id} data-glide-card className="glass-panel glass-panel-interactive fixture-card">
                {/* Competition & Date */}
                <div className="fixture-meta">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'inherit' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--club-ink)', textTransform: 'uppercase' }}>
                      {competitionLabel}
                    </span>
                    {match.status === 'postponed' && (
                      <span className="badge" style={{ fontSize: '0.7rem', background: 'rgba(245, 158, 11, 0.18)', color: 'var(--c-amber)', border: '1px solid rgba(245, 158, 11, 0.45)' }}>
                        POSTPONED
                      </span>
                    )}
                    {typeTag && (
                      <span className="badge" style={{ fontSize: '0.7rem', background: 'rgba(var(--tint-rgb), 0.08)', color: 'var(--text-primary)', textTransform: 'uppercase' }}>
                        {typeTag}
                      </span>
                    )}
                    {match.season && (
                      <span className="badge" style={{ fontSize: '0.7rem', background: 'rgba(var(--tint-rgb), 0.08)', color: 'var(--text-muted)' }}>
                        {match.season}
                      </span>
                    )}
                    {matchTeam && (
                      <span className="badge" style={{ fontSize: '0.7rem', background: `${matchTeam.color || club.primary_color}22`, color: 'var(--text-primary)', border: `1px solid ${matchTeam.color || club.primary_color}66` }}>
                        {teamLabel(matchTeam)}
                      </span>
                    )}
                  </div>
                  {match.title && (
                    <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--c-amber)', marginTop: '2px' }}>
                      {match.title}
                    </div>
                  )}
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '3px', justifyContent: 'inherit' }}>
                    <Calendar size={14} color="var(--text-muted)" />
                    <LocalTime value={match.match_date} options={{ weekday: 'short', month: 'short', day: 'numeric' }} />
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {match.match_time || <LocalTime value={match.match_date} format="time" options={{ hour: '2-digit', minute: '2-digit' }} />} • {match.venue}
                  </div>
                </div>

                {/* Scoreline / Teams */}
                <div className="fixture-teams" style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                  <div style={{ textAlign: 'right', flex: 1, minWidth: 0, overflowWrap: 'anywhere', fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.95rem' }}>
                    {match.home_team_name}
                  </div>

                  <div data-glide-score style={{
                    padding: '0.35rem 0.85rem',
                    background: match.status === 'completed' ? 'rgba(var(--tint-rgb), 0.1)' : 'rgba(var(--shade-rgb), 0.4)',
                    borderRadius: '8px',
                    fontFamily: 'var(--font-heading)',
                    fontWeight: 900,
                    fontSize: '1.2rem',
                    color: 'var(--text-primary)',
                    minWidth: '70px',
                    textAlign: 'center',
                    flexShrink: 0,
                  }}>
                    {match.status === 'live' ? (
                      <span style={{ color: 'var(--c-red)' }}>{hideScore ? 'LIVE' : `${match.home_score} - ${match.away_score}`}</span>
                    ) : match.status === 'completed' ? (
                      hideScore ? 'FT' : `${match.home_score} - ${match.away_score}`
                    ) : (
                      'VS'
                    )}
                  </div>

                  <div style={{ textAlign: 'left', flex: 1, minWidth: 0, overflowWrap: 'anywhere', fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.95rem' }}>
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
                        background: 'rgba(var(--club-primary-rgb), 0.12)',
                        border: '1px solid var(--club-primary)',
                        color: 'var(--club-ink)',
                        fontSize: '0.78rem',
                        padding: '0.4rem 0.75rem',
                      }}
                    >
                      <span>RSVP Availability</span>
                    </Link>
                  )}


                  <MatchGlideLink
                    matchId={match.id}
                    href={matchPath(club.slug, match)}
                    className="btn btn-secondary btn-sm touch-target"
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem' }}
                  >
                    <span>{match.status === 'completed' ? 'Match Report' : 'Match Centre'}</span>
                    <ChevronRight size={14} />
                  </MatchGlideLink>
                </div>
              </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 4.35 SPONSORS SHOWCASE (after the fixtures: fans come for the games first) */}
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

        // Highest tier first (a size override changes a card's size, not its place in the order)
        const sortedSponsors = sortSponsorsByTier(clubSponsors);

        return (
          <section className="club-section" style={{ borderBottom: '1px solid var(--border-subtle)', background: 'linear-gradient(180deg, rgba(var(--tint-rgb), 0.015) 0%, rgba(var(--shade-rgb), 0.2) 100%)' }}>
            <div className="container">
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.75rem' }}>
                <div>
                  <span style={{ fontSize: '0.72rem', fontWeight: 900, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--club-primary, #10B981)', display: 'block', marginBottom: '0.2rem' }}>
                    Thank you to our
                  </span>
                  <h3 style={{ fontSize: '1.35rem', fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>
                    Club Sponsors
                  </h3>
                </div>
                <Link
                  href={`/${club.slug}/sponsor`}
                  style={{
                    display: 'inline-block',
                    textDecoration: 'none',
                    background: 'rgba(var(--tint-rgb), 0.05)',
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
                </Link>
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

                  const badgeText = (sponsor.tier === 'platinum' ? '★ ' : '') + sponsorLabel(sponsor).toUpperCase();

                  return (
                    <SponsorTrackedLink
                      key={sponsor.id}
                      clubId={sponsor.club_id}
                      sponsorId={sponsor.id}
                      placement="club_home_showcase"
                      href={sponsor.website_url || '#'}
                      className="glass-panel"
                      style={{
                        padding: isXL ? '1.6rem 2.2rem' : isLG ? '1.3rem 1.75rem' : isMD ? '1.05rem 1.4rem' : '0.85rem 1.15rem',
                        display: 'flex',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        gap: isXL ? '1.25rem 1.75rem' : isLG ? '1rem 1.4rem' : isMD ? '0.8rem 1.1rem' : '0.65rem 0.85rem',
                        textDecoration: 'none',
                        borderRadius: isXL ? '18px' : isLG ? '16px' : '12px',
                        minWidth: isXL ? 'min(100%, 340px)' : isLG ? 'min(100%, 280px)' : isMD ? 'min(100%, 220px)' : 'min(100%, 170px)',
                        flex: isXL ? '2 1 420px' : isLG ? '1.5 1 320px' : isMD ? '1 1 240px' : '0.7 1 180px',
                        maxWidth: isXL ? '720px' : isLG ? '560px' : isMD ? '420px' : '320px',
                        background: isXL
                          ? 'radial-gradient(ellipse at top left, rgba(245, 158, 11, 0.16), rgba(var(--dk-15-23-42), 0.85))'
                          : isLG
                          ? 'radial-gradient(ellipse at top left, rgba(245, 158, 11, 0.07), rgba(var(--dk-15-23-42), 0.65))'
                          : 'rgba(var(--tint-rgb), 0.025)',
                        border: isXL
                          ? '1px solid rgba(245, 158, 11, 0.45)'
                          : isLG
                          ? '1px solid rgba(245, 158, 11, 0.22)'
                          : isMD
                          ? '1px solid rgba(var(--tint-rgb), 0.1)'
                          : '1px solid rgba(var(--tint-rgb), 0.05)',
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
                      <SponsorLogo
                        src={sponsor.logo_url}
                        name={sponsor.name}
                        height={isXL ? 100 : isLG ? 76 : isMD ? 58 : 44}
                        style={{
                          maxWidth: isXL ? 'min(100%, 300px)' : isLG ? 'min(100%, 230px)' : isMD ? 'min(100%, 170px)' : 'min(100%, 130px)',
                          filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.3))',
                        }}
                      />
                      {/* Below ~180px beside the logo, the name moves under it rather than squeezing into a thin column */}
                      <div style={{ overflow: 'hidden', minWidth: 0, flex: '1 1 180px' }}>
                        <div style={{
                          fontWeight: 900,
                          fontSize: isXL ? '1.3rem' : isLG ? '1.1rem' : isMD ? '0.95rem' : '0.85rem',
                          color: 'var(--text-primary)',
                          lineHeight: 1.25,
                          // Up to two lines: long business names stay readable instead of cutting off
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          overflowWrap: 'anywhere',
                          letterSpacing: '-0.01em',
                        }} title={sponsor.name}>
                          {sponsor.name}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '3px' }}>
                          <span className="badge" style={{
                            fontSize: isXL ? '0.72rem' : '0.68rem',
                            padding: isXL ? '0.2rem 0.55rem' : '0.15rem 0.4rem',
                            fontWeight: 800,
                            backgroundColor: sponsor.tier === 'platinum'
                              ? 'rgba(245, 158, 11, 0.22)'
                              : sponsor.tier === 'gold'
                              ? 'rgba(234, 179, 8, 0.18)'
                              : 'rgba(var(--tint-rgb), 0.08)',
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
                    </SponsorTrackedLink>
                  );
                })}
              </div>
            </div>
          </section>
        );
      })()}

      {/* 4.4 SCHEDULED SOCIAL EVENTS */}
      <section id="events" className="club-reveal club-section" style={{ background: 'rgba(var(--tint-rgb), 0.01)', borderBottom: '1px solid var(--border-subtle)' }}>
        <div className="container">
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '2rem' }}>
            <div>
              <span className="badge badge-gold" style={{ marginBottom: '0.4rem' }}>CLUB CALENDAR</span>
              <h2 style={{ fontSize: '2rem', fontWeight: 900 }}>Upcoming Events & Trainings</h2>
            </div>
            <Link href={`/${club.slug}/events`} className="btn btn-secondary btn-sm">
              <span>All events &amp; tickets</span>
            </Link>
          </div>

          {upcomingEvents.length === 0 && (
            <p className="text-meta glass-panel" style={{ padding: '1.25rem 1.5rem', textAlign: 'center' }}>No upcoming events right now. Check back soon.</p>
          )}
          <div className="club-cards">
            {upcomingEvents.map(evt => (
              <div key={evt.id} className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  {evt.flyer_url && (
                    <Link
                      href={`/${club.slug}/events/${evt.id}`}
                      aria-label={`${evt.title} flyer`}
                      style={{ position: 'relative', display: 'flex', justifyContent: 'center', height: '180px', overflow: 'hidden', borderRadius: 'var(--radius-md)', background: 'rgba(var(--shade-rgb), 0.35)', margin: '-0.5rem -0.5rem 1rem' }}
                    >
                      <div aria-hidden style={{ position: 'absolute', inset: '-20px', backgroundImage: `url(${JSON.stringify(evt.flyer_url)})`, backgroundSize: 'cover', backgroundPosition: 'center', filter: 'blur(20px)', opacity: 0.45 }} />
                      <img src={evt.flyer_url} alt="" loading="lazy" decoding="async" style={{ position: 'relative', height: '100%', maxWidth: '100%', objectFit: 'contain' }} />
                    </Link>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                    <span className="badge" style={{
                      backgroundColor: evt.category === 'training' ? 'rgba(16, 185, 129, 0.15)' : evt.category === 'social' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                      color: evt.category === 'training' ? 'var(--c-green)' : evt.category === 'social' ? 'var(--c-amber)' : 'var(--c-blue)',
                    }}>
                      {evt.category.toUpperCase()}
                    </span>
                  </div>

                  <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                    {evt.title}
                  </h3>

                  <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '1.25rem' }}>
                    {evt.description}
                  </p>
                </div>

                <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                  <div className="row">
                    <Calendar size={14} color="var(--club-primary)" />
                    <span className="text-primary"><LocalTime value={evt.start_time} options={{ month: 'short', day: 'numeric', year: 'numeric' }} /></span>
                  </div>
                  <div className="row">
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
      <section id="news" className="club-reveal club-section" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        <div className="container">
          <div style={{ marginBottom: '2.5rem' }}>
            <span className="badge badge-primary" style={{ marginBottom: '0.4rem' }}>CLUB NEWS</span>
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
              <Link
                id={`news-${featuredArticle.slug}`}
                href={newsPath(club.slug, featuredArticle.slug)}
                className="glass-panel glass-panel-interactive"
                style={{
                  scrollMarginTop: '6rem',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <div style={{ height: '240px', position: 'relative' }}>
                  <CoverImage
                    src={featuredArticle.cover_image_url}
                    alt={featuredArticle.title}
                    crestUrl={club.logo_url}
                    style={{ width: '100%', height: '100%' }}
                  />
                  <div style={{ position: 'absolute', top: '12px', left: '12px' }}>
                    <span className="badge badge-gold">FEATURED STORY</span>
                  </div>
                </div>

                <div style={{ padding: '1.75rem', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.6rem', lineHeight: 1.3 }}>
                      {featuredArticle.title}
                    </h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '1.25rem' }}>
                      {featuredArticle.summary}
                    </p>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    <span>By {featuredArticle.author_name}</span>
                    <span style={{ color: 'var(--club-ink)', fontWeight: 700 }}>Read Article &rarr;</span>
                  </div>
                </div>
              </Link>
            )}

            {/* News Feed Grid */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {clubNews.filter(n => n.id !== featuredArticle?.id).slice(0, HOME_NEWS_COUNT).map(article => (
                <Link
                  key={article.id}
                  id={`news-${article.slug}`}
                  href={newsPath(club.slug, article.slug)}
                  className="glass-panel glass-panel-interactive"
                  style={{
                    scrollMarginTop: '6rem',
                    padding: '1.25rem',
                    display: 'flex',
                    gap: '1.25rem',
                    alignItems: 'center',
                  }}
                >
                  <CoverImage
                    width={90} height={90}
                    src={article.cover_image_url}
                    alt={article.title}
                    crestUrl={club.logo_url}
                    style={{ width: '90px', height: '90px', borderRadius: '10px' }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.3rem' }}>
                      {article.tags?.slice(0, 2).map(tag => (
                        <span key={tag} className="badge" style={{ fontSize: '0.7rem', background: 'rgba(var(--tint-rgb), 0.07)' }}>
                          {tag}
                        </span>
                      ))}
                    </div>
                    <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.3, marginBottom: '0.3rem' }}>
                      {article.title}
                    </h4>
                    <span className="text-meta">
                      <LocalTime value={article.published_at} />
                    </span>
                  </div>
                </Link>
              ))}
              {clubNews.length > 0 && (
                <Link href={`/${club.slug}/news`} className="btn btn-secondary" style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                  All news <ChevronRight size={16} aria-hidden="true" />
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* 4.6 EXECUTIVE COMMITTEE SHOWCASE: left out until the club lists someone */}
      {executiveStaff.length > 0 && (
      <section className="club-reveal club-section" style={{ background: 'rgba(var(--tint-rgb), 0.015)', borderBottom: '1px solid var(--border-subtle)' }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <span className="badge badge-primary">LEADERSHIP</span>
              {activeSeason && (
                <span className="badge" style={{ background: 'rgba(var(--tint-rgb), 0.08)', color: 'var(--text-primary)', fontSize: '0.72rem' }}>
                  🗓️ {activeSeason.name} Tenure
                </span>
              )}
            </div>
            <h2 style={{ fontSize: '2rem', fontWeight: 900 }}>Executive Committee & Governance</h2>
            <p style={{ color: 'var(--text-secondary)', maxWidth: '600px', margin: '0 auto' }}>
              The dedicated board, management, and technical staff guiding {club.name}.
            </p>
          </div>

          <div className="club-cards club-cards-sm">
            {executiveStaff.map(exec => (
              <div key={exec.id} className="glass-panel" style={{ padding: '1.5rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <PlayerAvatar
                  photoUrl={exec.photo_url}
                  name={exec.full_name}
                  size={96}
                  style={{
                    border: `2px solid var(--club-primary)`,
                    boxShadow: '0 8px 16px rgba(0,0,0,0.4)',
                    marginBottom: '1rem',
                  }}
                />
                <h4 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.2rem' }}>
                  {exec.full_name}
                </h4>
                <div style={{ color: 'var(--club-ink)', fontWeight: 700, fontSize: '0.8rem', marginBottom: '0.3rem' }}>
                  {exec.executive_title}
                </div>
                {(exec.executive_season || activeSeason) && (
                  <span className="badge" style={{ fontSize: '0.7rem', background: 'rgba(var(--tint-rgb), 0.07)', color: 'var(--text-muted)', marginBottom: '0.6rem' }}>
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
      )}

      {/* 4.7 PLAYERS (SQUAD ROSTER) & LEADERBOARD */}
      <section id="squad" className="club-reveal club-section" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
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
              <h2 style={{ fontSize: '2.2rem', fontWeight: 900 }}>Top Players</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
                {anyRanked
                  ? `${currentSeasonName}: ranked by goals, then assists, Player of the Match and appearances.`
                  : `${currentSeasonName}: rankings appear once the first match stats are saved.`}
              </p>
            </div>

            {/* Position Filter Pills: Scrollable on mobile */}
            {positionPills}
          </div>

          {/* Top five this season */}
          {topPlayers.length === 0 && (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem 0' }}>No players in this position yet.</p>
          )}
          <div className="club-cards top-players" style={{ marginBottom: rankedSquad.length > 0 ? '1.5rem' : '3.5rem' }}>
            {topPlayers.map((player, rank) => {
              const stat = statFor(player.id);
              const hasStats = !!(stat?.appearances || stat?.goals || stat?.assists || stat?.motm_awards);

              return (
                <Link
                  key={player.id}
                  href={`/${club.slug}/squad/${player.id}`}
                  className="glass-panel glass-panel-interactive top-player"
                  style={{
                    color: 'inherit',
                    textDecoration: 'none',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  {/* Photo & Number Banner */}
                  <div className="top-player-photo" style={{ height: '220px', position: 'relative', overflow: 'hidden' }}>
                    <PlayerAvatar photoUrl={player.photo_url} name={player.full_name} fill />
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(var(--dk-14-20-30),0.9), transparent)' }} />
                    <div style={{
                      position: 'absolute',
                      top: '12px',
                      right: '12px',
                      fontFamily: 'var(--font-heading)',
                      fontWeight: 900,
                      fontSize: '1.75rem',
                      color: 'var(--text-primary)',
                      textShadow: '0 2px 8px rgba(0,0,0,0.8)',
                    }}>
                      {/* Labelled as the jersey number so it doesn't read as a rank next to the "2nd" badge */}
                      {player.jersey_number ? (
                        <><span style={{ fontSize: '0.8rem', fontWeight: 700, opacity: 0.85, marginRight: '0.25rem' }}>Jersey No.</span>{player.jersey_number}</>
                      ) : ''}
                    </div>
                    <div style={{ position: 'absolute', top: '12px', left: '12px', display: 'flex', gap: '0.35rem' }}>
                      {hasStats && (
                        <span className="badge" data-theme="dark" style={{ background: 'rgba(0,0,0,0.65)', color: '#FFFFFF' }}>{['1st', '2nd', '3rd', '4th', '5th'][rank]}</span>
                      )}
                    </div>
                    <div style={{ position: 'absolute', bottom: '12px', left: '16px' }}>
                      {player.player_position && (
                        <span className="badge" style={{ backgroundColor: 'var(--club-primary)', color: 'var(--club-primary-contrast, #090D16)', marginBottom: '4px' }}>
                          {player.player_position}
                        </span>
                      )}
                      <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                        {player.full_name}
                      </h3>
                    </div>
                  </div>

                  {/* Player Stats Mini Grid */}
                  <div className="top-player-body" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                    {/* All zeros says nothing: shown once the player has a stat */}
                    {hasStats && (
                    <div className="top-player-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', textAlign: 'center' }}>
                      <div style={{ background: 'rgba(var(--shade-rgb), 0.3)', padding: '0.5rem 0.2rem', borderRadius: '6px' }}>
                        <div className="text-meta">APPS</div>
                        <div style={{ fontWeight: 800, color: 'var(--text-primary)' }}>{stat?.appearances || 0}</div>
                      </div>
                      <div style={{ background: 'rgba(var(--shade-rgb), 0.3)', padding: '0.5rem 0.2rem', borderRadius: '6px' }}>
                        <div className="text-meta">GOALS</div>
                        <div style={{ fontWeight: 800, color: 'var(--c-green)' }}>{stat?.goals || 0}</div>
                      </div>
                      <div style={{ background: 'rgba(var(--shade-rgb), 0.3)', padding: '0.5rem 0.2rem', borderRadius: '6px' }}>
                        <div className="text-meta">ASSISTS</div>
                        <div style={{ fontWeight: 800, color: 'var(--c-amber)' }}>{stat?.assists || 0}</div>
                      </div>
                      <div style={{ background: 'rgba(var(--shade-rgb), 0.3)', padding: '0.5rem 0.2rem', borderRadius: '6px' }}>
                        <div className="text-meta">MOTM</div>
                        <div style={{ fontWeight: 800, color: 'var(--c-blue)' }}>{stat?.motm_awards || 0}</div>
                      </div>
                    </div>
                    )}
                    {/* Phone: one line instead of the four tiles */}
                    {hasStats && (
                      <div className="top-player-line text-meta">
                        {countOf(stat?.appearances, 'app')} · {countOf(stat?.goals, 'goal')} · {countOf(stat?.assists, 'assist')}
                      </div>
                    )}

                    {player.nationality && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Nationality: <strong className="text-secondary">{player.nationality}</strong>
                      </div>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>

          {rankedSquad.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '3.5rem' }}>
              <Link href={`/${club.slug}/squad`} className="btn btn-secondary">
                <Users size={16} />
                <span>View full squad ({rankedSquad.length})</span>
              </Link>
            </div>
          )}

          {/* Golden Boot & Playmaker: the one leaderboard on the page (ClubScore stays on members' own pages) */}
            <div id="leaderboard" className="glass-panel" style={{ padding: 'clamp(1rem, 4vw, 2rem)' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.5rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Trophy size={20} color="var(--c-amber)" /> Season Leaderboard ({activeSeason?.name || defaultSeasonLabel()})
                  </h3>
                  <span className="text-note">Top individual season performances</span>
                </div>

                {/* Leaderboard Metric Selector */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {(['goals', 'assists', 'appearances'] as const).map(tab => (
                    <button
                      key={tab}
                      onClick={() => setLeaderboardTab(tab)}
                      style={{
                        padding: '0.35rem 0.75rem',
                        borderRadius: '6px',
                        border: 'none',
                        background: leaderboardTab === tab ? 'var(--club-primary)' : 'rgba(255,255,255,0.06)',
                        color: leaderboardTab === tab ? 'var(--club-primary-contrast, #090D16)' : 'var(--text-muted)',
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
                {leaderboardList.length === 0 && (
                  <div className="text-meta" style={{ textAlign: 'center', padding: '1.25rem 1rem', background: 'rgba(var(--shade-rgb), 0.25)', borderRadius: '8px', border: '1px dashed var(--border-subtle)' }}>
                    {leaderboardTab === 'goals' ? 'No goals' : leaderboardTab === 'assists' ? 'No assists' : 'No appearances'} recorded yet this season. The table fills in as match stats are saved at full time.
                  </div>
                )}
                {leaderboardList.map((item, index) => (
                  <div
                    key={item.player?.id || index}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '0.75rem',
                      padding: '0.75rem 1rem',
                      background: 'rgba(var(--shade-rgb), 0.25)',
                      borderRadius: '8px',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
                      <div style={{
                        flexShrink: 0,
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

                      <PlayerAvatar photoUrl={item.player?.photo_url} name={item.player?.full_name || 'Player'} size={36} style={{ borderRadius: '8px' }} />

                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '0.95rem', overflowWrap: 'anywhere' }}>
                          {item.player && playerPageIds.has(item.player.id)
                            ? <Link href={`/${club.slug}/squad/${item.player.id}`} className="player-name-link">{item.player.full_name}</Link>
                            : item.player?.full_name}
                        </div>
                        <div className="text-meta">
                          {[item.player?.jersey_number != null && `#${item.player.jersey_number}`, item.player?.player_position].filter(Boolean).join(' • ')}
                        </div>
                      </div>
                    </div>

                    <div style={{ flexShrink: 0, whiteSpace: 'nowrap', fontFamily: 'var(--font-heading)', fontWeight: 900, fontSize: '1.4rem', color: 'var(--club-ink)' }}>
                      {leaderboardTab === 'goals' ? item.stat.goals : leaderboardTab === 'assists' ? item.stat.assists : item.stat.appearances}
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginLeft: '0.3rem' }}>
                        {(() => {
                          const n = leaderboardValue(item.stat);
                          const word = leaderboardTab === 'goals' ? 'goal' : leaderboardTab === 'assists' ? 'assist' : 'app';
                          return n === 1 ? word : `${word}s`;
                        })()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
        </div>
      </section>

      {/* 4.8 HOME GROUND DETAILS & MAP */}
      <section id="stadium" className="club-reveal club-section" style={{ background: 'rgba(var(--tint-rgb), 0.015)' }}>
        <div className="container">
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(320px, 100%), 1fr))',
            gap: 'clamp(1.5rem, 4vw, 3rem)',
            alignItems: 'center',
          }}>
            <div>
              <span className="badge badge-primary" style={{ marginBottom: '0.6rem' }}>HOME GROUND</span>
              <h2 style={{ fontSize: '2.2rem', fontWeight: 900, marginBottom: '1rem' }}>
                {club.stadium_name}
              </h2>

              <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '1.5rem' }}>
                Where {club.name} play home matches. Check the fixture list for kickoff times and which pitch.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
                <div className="glass-panel" style={{ padding: '0.85rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <MapPin size={20} color="var(--club-primary)" />
                  <div>
                    <div className="text-meta">Location Address</div>
                    <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{club.stadium_address || 'Not listed yet'}</div>
                  </div>
                </div>

                <div className="glass-panel" style={{ padding: '0.85rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <Shield size={20} color="var(--club-primary)" />
                  <div>
                    <div className="text-meta">Pitch Surface</div>
                    <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{club.stadium_pitch_type || 'Not listed yet'}</div>
                  </div>
                </div>
              </div>

              {club.stadium_parking_info?.trim() && (
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  Parking: {club.stadium_parking_info}
                </div>
              )}
            </div>

            {/* Interactive Map Embed / Visual Map Presentation */}
            <div className="glass-panel" style={{ overflow: 'hidden', border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-xl)' }}>
              <div style={{ height: '380px', position: 'relative', background: 'rgb(var(--dk-19-27-38))' }}>
                {/* Embedded Map Representation, geocoded live from the club's own stadium address */}
                <iframe
                  title="Home Ground Map"
                  width="100%"
                  height="100%"
                  frameBorder="0"
                  scrolling="no"
                  marginHeight={0}
                  marginWidth={0}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  src={`https://www.google.com/maps?q=${encodeURIComponent(
                    [club.stadium_name, club.stadium_address].filter(Boolean).join(', ')
                  )}&z=15&output=embed`}
                  style={{ border: 'none' }}
                />
                <div style={{
                  position: 'absolute',
                  bottom: '16px',
                  left: '16px',
                  right: '16px',
                  background: 'rgba(var(--dk-10-15-23), 0.9)',
                  backdropFilter: 'blur(10px)',
                  padding: '0.85rem 1.25rem',
                  borderRadius: '12px',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{club.stadium_name}</div>
                    {club.stadium_address?.trim() && <div className="text-meta">{club.stadium_address}</div>}
                  </div>
                  <a
                    href={`https://maps.google.com/?q=${encodeURIComponent(club.stadium_address)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-primary btn-sm row row-tight"
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

      {/* 4.85 GET IN TOUCH: a contact form anyone can find (the Sponsor page and #contact links point here) */}
      <div className="club-reveal club-section">
        <div className="container" style={{ maxWidth: '860px' }}>
          <ClubContactSection club={club} heading={`Get in touch with ${club.name}`} />
        </div>
      </div>

      {/* 4.9 CONTACT MODAL */}
      <ContactModal
        club={club}
        isOpen={contactModalOpen}
        onClose={() => setContactModalOpen(false)}
      />


    </main>
  );
}
