'use client';

import { PageSkeleton } from '@/components/Skeleton';
import React, { useState, useEffect, use, useMemo, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { useClub } from '@/lib/club-context';
import { useAuth } from '@/lib/auth-context';
import ContactModal from '@/components/ContactModal';
import ClubContactSection from '@/components/ClubContactSection';
import MatchGlideLink from '@/components/MatchGlideLink';
import ClubIdentitySection from '@/components/ClubIdentitySection';
import MatchdayStrip, { When as MatchWhen, KickoffTime } from '@/components/MatchdayStrip';
import PlayerAvatar from '@/components/PlayerAvatar';
import ResultChip from '@/components/ResultChip';
import { clubPlaysIn, clubResult, hasKickoffTime, kickoff, latestFirst, publicFixtures, soonestFirst } from '@/lib/fixtures';
import SponsorShowcase from '@/components/SponsorShowcase';
import CoverImage from '@/components/CoverImage';
import { isSponsorOnSite, sortSponsorsByTier } from '@/lib/sponsors';
import LocalTime from '@/components/LocalTime';
import { DEFAULT_CREST, crestFallbackRef, crestOnError } from '@/lib/crest';
import {
  Shield,
  CreditCard,
  Calendar,
  MapPin,
  Users,
  ChevronRight,
  ChevronLeft,
  ExternalLink,
  Newspaper,
  Image as ImageIcon,
  CalendarPlus
} from 'lucide-react';
import { Match, ClubEvent, EventCategory, NewsArticle, isPlayerMember } from '@/lib/supabase/types';
import LiveMinute from '@/components/LiveMinute';
import { defaultSeasonLabel } from '@/lib/season';
import { clubTeamsOf, defaultTeamOf, juniorMemberIds, publicScoreHidden, teamLabel, teamMemberIds, teamOfMatch, withTeamSide } from '@/lib/teams';
import { SITE_URL, matchPath, newsPath } from '@/lib/slugs';
import { HOME_NEWS_COUNT, newestFirst } from '@/lib/news';
import { POSITION_NAMES, initialsOf } from '@/lib/positions';
import { type PositionGroup, type StatKey, hasSeasonStats, inPositionGroup, rankPlaces, rankPlayers, rankView } from '@/lib/top-players';
import TopPlayerLeader from '@/components/TopPlayerLeader';


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

const SHORT_DATE = { weekday: 'short', day: 'numeric', month: 'short' } as const;

/** The competition's real name, else the kind of match; the old placeholder default isn't a name */
const competitionName = (m: Pick<Match, 'competition' | 'match_type'>) => {
  if (m.competition && m.competition !== 'Premier Regional League') return m.competition;
  return m.match_type ? m.match_type.charAt(0).toUpperCase() + m.match_type.slice(1) : 'Match';
};

interface HomeHeroSlide {
  id: string;
  category: 'club' | 'match' | 'news' | 'event' | 'stadium' | 'image';
  tabLabel: string;
  // Short category word shown on phones in place of a pinned title, which would be cut off there
  phoneTabLabel?: string;
  /** The plain line over the headline; the page adds the date to it where a slide has one */
  kicker: string;
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
  const [squadFilter, setSquadFilter] = useState<PositionGroup>('ALL');
  // Null until the visitor picks a tab: it then opens on whichever tab has games in it
  const [fixturesTabPicked, setFixturesTab] = useState<'upcoming' | 'results' | null>(null);
  const [fixturesSeasonFilter, setFixturesSeasonFilter] = useState<string>('CURRENT');
  // Clubs with several teams: 'ALL' = every team, else a team id
  const [fixturesTeamId, setFixturesTeamId] = useState<string>('ALL');
  const [rankBy, setRankBy] = useState<StatKey>('goals');
  const [showAllPlayers, setShowAllPlayers] = useState(false);
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
  // The hero and matchday strip lead with the main team's games;
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
  // The fixtures list can be narrowed to one team; internal and tournament matches show under every team
  const inFixturesTeam = (m: typeof clubMatches[number]) => {
    if (!multiTeam || fixturesTeamId === 'ALL') return true;
    const team = teamOfMatch(m, clubTeams);
    return !team || team.id === fixturesTeamId;
  };
  const upcomingShown = upcomingFixtures.filter(inFixturesTeam);
  // Nothing coming up: open on Results, never on an "Upcoming" tab listing old games
  const fixturesTab = fixturesTabPicked ?? (upcomingShown.length > 0 ? 'upcoming' : 'results');
  const seasonResults = pastMatches.filter(inFixturesTeam);
  // Same source as Upcoming, so the current view reaches back past a season rollover rather than going empty
  const recentResults = upcomingSource.filter(m => m.status === 'completed' && inFixturesTeam(m)).sort(latestFirst).slice(0, 5);
  const fixtureCards = fixturesTab === 'upcoming' ? upcomingShown
    // Until a tab is picked it's a short list; "All fixtures & results" has the rest
    : fixturesTabPicked === null ? (seasonResults.length > 0 ? seasonResults.slice(0, 5) : recentResults)
    : seasonResults;
  const clubEvents = events.filter(e => e.club_id === clubId);
  // Soonest first, and only events that haven't finished yet
  const nowMs = Date.now();
  const upcomingEvents = clubEvents
    .filter(e => { const end = Date.parse(e.end_time || e.start_time); return Number.isNaN(end) || end >= nowMs; })
    .sort((a, b) => (Date.parse(a.start_time) || 0) - (Date.parse(b.start_time) || 0));
  const nextEvent = upcomingEvents[0] || clubEvents[0];
  // No fixtures to show, but a cup or match day is on the calendar: the fixtures section points to it
  const nextFootballEvent = upcomingShown.length === 0
    ? upcomingEvents.find(e => e.category === 'tournament' || e.category === 'match')
    : undefined;
  // The strip's next match skips a game left on "upcoming" after it was played (no result entered yet)
  const stripNextMatch = upcomingMatches.find(m => kickoff(m) >= nowMs - 3 * 3600000);
  // Club-wide showcase only - event-scoped sponsors show on their own event's page instead.
  // Admins also load hidden and ended sponsors; they see the same showcase as fans.
  const clubSponsors = sponsors.filter(s => s.club_id === clubId && !s.event_id && isSponsorOnSite(s));
  const clubNews = newestFirst(news.filter(n => n.club_id === clubId));
  const featuredArticle = clubNews.find(n => n.is_featured) || clubNews[0] || null;

  // Squad filtering
  const filteredSquad = squadPlayers.filter(p => inPositionGroup(p.player_position, squadFilter));

  // Players ranked on the pitch this season. Outfield: goals, then assists, Player of the Match, games.
  // Keepers and defenders: clean sheets first, like the Golden Glove (lib/top-players.ts).
  // Not ClubScore XP: its sign-up and attendance points put brand-new members above people who played.
  const currentSeasonName = activeSeason?.name || defaultSeasonLabel();
  const statFor = (memberId: string) =>
    playerStats.find(st => st.member_id === memberId && st.season === currentSeasonName);
  const view = rankView(squadFilter);
  // A tab from another position (Goals, then switching to GK) falls back to that position's first tab
  const rankOn: StatKey = view.tabs.some(([k]) => k === rankBy) ? rankBy : view.tabs[0][0];
  const ranked = rankPlayers(filteredSquad, statFor, squadFilter, rankOn);
  const places = rankPlaces(ranked, statFor, squadFilter, rankOn);
  const topPlayers = showAllPlayers ? ranked : ranked.slice(0, 5);
  // A rank only means something once a player has the figure: no "1st" for whoever sorts first by name
  const rankedOn = (memberId: string) => (statFor(memberId)?.[rankOn] ?? 0) > 0;
  const anyRanked = topPlayers.some(p => hasSeasonStats(statFor(p.id)));
  // The leader card only for someone who has earned 1st; everyone else is a table row
  const leader = topPlayers[0] && rankedOn(topPlayers[0].id) ? topPlayers[0] : null;
  const firstRow = leader ? 1 : 0;
  const tableRows = topPlayers.slice(firstRow).map((player, i) => {
    const at = places[firstRow + i];
    return { player, rank: rankedOn(player.id) ? `${at.tied ? '=' : ''}${at.place}` : null };
  });


  // The hero slides: what the admin pinned, else what the club really has. A pin whose match, story or
  // event has gone is left out, and no slide is filled in with wording the club didn't write. Badge and
  // button wording saved on old pins was generated, never typed by the club, so it isn't read back here.
  const heroSlides: HomeHeroSlide[] = useMemo(() => {
    if (!club) return [];

    const fixtureSlide = (m: Match, id: string, tabLabel: string, title?: string): HomeHeroSlide => ({
      id,
      category: 'match',
      tabLabel,
      phoneTabLabel: m.status === 'live' ? 'Live' : 'Match',
      kicker: competitionName(m),
      bgImage: (club.slider_images && club.slider_images[0]) || club.banner_url || '',
      title: title || `${m.home_team_name} vs ${m.away_team_name}`,
      subtitle: m.venue || '',
      targetMatch: m,
    });
    const newsSlide = (a: NewsArticle, id: string, tabLabel: string, overrides: Partial<HomeHeroSlide> = {}): HomeHeroSlide => ({
      id,
      category: 'news',
      tabLabel,
      phoneTabLabel: a.tags?.[0] || 'News',
      kicker: a.tags?.[0] || 'News',
      bgImage: a.cover_image_url || club.banner_url || '',
      title: a.title,
      subtitle: a.summary || '',
      targetNews: a,
      ...overrides,
    });
    const eventSlide = (e: ClubEvent, id: string, tabLabel: string, overrides: Partial<HomeHeroSlide> = {}): HomeHeroSlide => ({
      id,
      category: 'event',
      tabLabel,
      phoneTabLabel: EVENT_TAB_LABELS[e.category] || 'Event',
      kicker: EVENT_TAB_LABELS[e.category] || 'Event',
      bgImage: e.flyer_url || club.banner_url || '',
      bgIsFlyer: Boolean(e.flyer_url),
      title: e.title,
      subtitle: e.description || e.location || club.stadium_name || '',
      targetEvent: e,
      ...overrides,
    });

    const shortTab = (title: string | undefined, fallback: string) =>
      title ? (title.length > 18 ? `${title.substring(0, 16)}...` : title) : fallback;

    const activePins = (club.hero_pinned_items || []).filter(p => p.is_active);
    if (activePins.length > 0) {
      const pinned = activePins.flatMap((item, idx): HomeHeroSlide[] => {
        if (item.type === 'fixture') {
          const m = clubMatches.find(x => x.id === item.target_id) || liveMatch || upcomingMatches[0];
          if (!m) return [];
          const slide = fixtureSlide(m, item.id || `pin-fixture-${idx}`, shortTab(item.title, 'Fixture'), item.title);
          return [item.image_url ? { ...slide, bgImage: item.image_url } : slide];
        }
        if (item.type === 'news') {
          const a = news.find(n => n.id === item.target_id) || featuredArticle;
          if (!a) return [];
          return [newsSlide(a, item.id || `pin-news-${idx}`, shortTab(item.title, 'News'), {
            title: item.title || a.title,
            subtitle: item.subtitle || a.summary || '',
            bgImage: item.image_url || a.cover_image_url || club.banner_url || '',
          })];
        }
        if (item.type === 'event') {
          const e = events.find(x => x.id === item.target_id) || nextEvent;
          if (!e) return [];
          return [eventSlide(e, item.id || `pin-event-${idx}`, shortTab(item.title, 'Event'), {
            title: item.title || e.title,
            subtitle: item.subtitle || e.description || e.location || club.stadium_name || '',
            bgImage: e.flyer_url || item.image_url || club.banner_url || '',
          })];
        }
        // Custom image / promo banner: the one slide whose wording the admin types in
        return [{
          id: item.id || `pin-image-${idx}`,
          category: 'image',
          phoneTabLabel: 'Spotlight',
          tabLabel: shortTab(item.title, 'Spotlight'),
          // Older default home ground slides were saved as "HOME FORTRESS" / "<ground> Fortress"
          kicker: (item.badge || '').replace(/^HOME FORTRESS$/i, 'Home ground').replace(/^HOME GROUND$/, 'Home ground').replace(/^SPOTLIGHT$/, ''),
          bgImage: item.image_url || club.banner_url || '',
          title: (item.title || club.name).replace(/ Fortress$/, ''),
          subtitle: item.subtitle || club.motto || '',
          ctaLabel: item.cta_label || 'Find out more',
          ctaLink: item.cta_link || `/${club.slug}`,
        }];
      });
      if (pinned.length > 0) return pinned;
    }

    // Nothing pinned: one slide for each thing the club actually has
    const nextMatch = liveMatch || upcomingMatches[0];
    const comingEvent = upcomingEvents[0];
    const slides: HomeHeroSlide[] = [];
    if (nextMatch) slides.push(fixtureSlide(nextMatch, 'matchday', liveMatch ? 'Live match' : 'Next match'));
    if (featuredArticle) slides.push(newsSlide(featuredArticle, 'latest-news', 'Latest news'));
    if (comingEvent) slides.push(eventSlide(comingEvent, 'next-event', 'Next event'));

    // A club with nothing posted yet gets its name and a way to join, not placeholder news and events
    if (slides.length === 0) {
      return [{
        id: 'club',
        category: 'club',
        tabLabel: club.name,
        kicker: '',
        bgImage: (club.slider_images && club.slider_images[0]) || club.banner_url || '',
        title: club.name,
        subtitle: club.stadium_name ? `Home ground: ${club.stadium_name}` : '',
      }];
    }
    if (club.stadium_name) {
      slides.push({
        id: 'home-ground',
        category: 'stadium',
        tabLabel: 'Home ground',
        kicker: 'Home ground',
        bgImage: (club.slider_images && club.slider_images[1]) || gallery[0]?.media_url || '',
        title: club.stadium_name,
        subtitle: `Where ${club.name} play home matches.`,
      });
    }
    return slides;
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  const heroMatch = currentSlide?.targetMatch;
  const heroNews = currentSlide?.targetNews;
  const heroEvent = currentSlide?.targetEvent;
  const heroIsLive = heroMatch?.status === 'live';
  // A club with nothing posted and no photo: a flat field of its colour, so the text and buttons can't sit on a photo
  const heroIsFlat = currentSlide?.category === 'club' && !currentSlide.bgImage;

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
      {/* 4.1 HERO: pinned or real slides. One layout for every slide: a plain line, the headline, buttons */}
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
          ...(currentSlide.category === 'club' ? { minHeight: 0 } : {}),
          background: currentSlide.bgIsFlyer
            ? 'var(--bg-pitch)'
            : heroIsFlat
            ? 'var(--club-ink-light, var(--club-primary))'
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
            <div>
              {(heroIsLive || currentSlide.kicker) && (
                <p style={{
                  margin: '0 0 0.75rem',
                  fontSize: '0.875rem',
                  fontWeight: 700,
                  color: heroIsLive ? 'var(--c-red)' : currentSlide.category === 'event' ? 'var(--c-amber)' : 'var(--club-ink)',
                }}>
                  {heroIsLive && heroMatch ? (
                    <>Live · <LiveMinute match={heroMatch} />&apos;</>
                  ) : (
                    <>
                      {currentSlide.kicker}
                      {heroMatch && <> · <MatchWhen m={heroMatch} /></>}
                      {heroNews?.published_at && <> · <LocalTime value={heroNews.published_at} options={SHORT_DATE} /></>}
                      {heroEvent && <> · <LocalTime value={heroEvent.start_time} options={SHORT_DATE} /></>}
                    </>
                  )}
                </p>
              )}

              <h2 style={{
                fontSize: 'clamp(2.1rem, 4.4vw, 3.5rem)',
                fontWeight: 900,
                lineHeight: 1.1,
                letterSpacing: '-0.03em',
                marginBottom: '1rem',
                color: heroIsFlat ? '#FFFFFF' : 'var(--text-primary)',
              }}>
                {currentSlide.title}
              </h2>

              {currentSlide.subtitle && (
                <p style={{
                  fontSize: '1.125rem',
                  color: heroIsFlat ? '#FFFFFF' : 'var(--text-secondary)',
                  marginBottom: '1.75rem',
                  lineHeight: 1.5,
                }}>
                  {currentSlide.subtitle}
                </p>
              )}

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.85rem' }}>
                {currentSlide.category === 'match' && heroMatch && (
                  <>
                    <Link href={matchPath(club.slug, heroMatch)} className="btn btn-primary">
                      {heroIsLive ? 'Follow live' : heroMatch.status === 'completed' ? 'Match report' : 'Match preview'}
                    </Link>
                    {isClubAdmin && (
                      <Link href={`/${club.slug}/availability`} className="btn btn-secondary">
                        <Users size={16} aria-hidden="true" /> Squad availability
                      </Link>
                    )}
                  </>
                )}
                {currentSlide.category === 'news' && heroNews && (
                  <>
                    <Link href={newsPath(club.slug, heroNews.slug)} className="btn btn-primary">Read the story</Link>
                    <a href="#news" className="btn btn-secondary">All news</a>
                  </>
                )}
                {currentSlide.category === 'event' && heroEvent && (
                  <>
                    <Link href={`/${club.slug}/events/${heroEvent.id}`} className="btn btn-primary">Event details</Link>
                    <Link href={`/${club.slug}/calendar`} className="btn btn-secondary">Club calendar</Link>
                  </>
                )}
                {currentSlide.category === 'image' && (
                  <>
                    <Link href={currentSlide.ctaLink || `/${club.slug}`} className="btn btn-primary">{currentSlide.ctaLabel || 'Find out more'}</Link>
                    <Link href={`/${club.slug}/member`} className="btn btn-secondary">
                      <CreditCard size={16} aria-hidden="true" /> Member pass
                    </Link>
                  </>
                )}
                {currentSlide.category === 'stadium' && (
                  <>
                    <a href="#stadium" className="btn btn-primary"><MapPin size={16} aria-hidden="true" /> Map &amp; directions</a>
                    <a href="#squad" className="btn btn-secondary">Squad</a>
                  </>
                )}
                {currentSlide.category === 'club' && (
                  <>
                    <Link href={`/${club.slug}/member?join=1`} className="btn btn-primary" style={heroIsFlat ? { background: '#FFFFFF', color: 'var(--club-ink-light, #0E141E)', boxShadow: 'none' } : undefined}>Join the club</Link>
                    <a href="#contact" className="btn btn-secondary" style={heroIsFlat ? { background: 'transparent', color: '#FFFFFF', borderColor: 'rgba(255, 255, 255, 0.6)' } : undefined}>Contact us</a>
                  </>
                )}
              </div>
            </div>

            {/* Right column: one clickable card for the slide. On phones an upcoming fixture's or a
                story's card only repeats the headline (and the matchday strip below), so it's left out
                there and the slide tabs stay above the bottom menu; a live score always shows. */}
            {currentSlide.category !== 'club' && (
            <div className={
              (currentSlide.category === 'match' && !['live', 'halftime'].includes(heroMatch?.status || ''))
              || currentSlide.category === 'news' ? 'club-hero-side-repeat' : undefined
            }>
              {currentSlide.category === 'match' && heroMatch && (
                <Link
                  href={matchPath(club.slug, heroMatch)}
                  className="glass-panel glass-panel-interactive"
                  style={{ display: 'block', padding: '1.5rem', color: 'inherit', background: 'rgba(var(--dk-18-26-38), 0.92)' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {heroIsLive ? (
                      <span className="badge badge-live">
                        <span className="pulse-dot" /> {heroMatch.is_paused ? 'Paused' : 'Live'} · <LiveMinute match={heroMatch} />&apos;
                      </span>
                    ) : (
                      <strong style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>Next match</strong>
                    )}
                    <span className="text-note">{competitionName(heroMatch)}</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '1.5rem' }}>
                    <div style={{ textAlign: 'center', flex: 1, minWidth: 0 }}>
                      <img loading="eager" decoding="async" width={48} height={48}
                        src={heroMatch.home_team_logo || DEFAULT_CREST}
                        alt={`${heroMatch.home_team_name} crest`}
                        ref={crestFallbackRef}
                        onError={crestOnError}
                        style={{ width: '48px', height: '48px', borderRadius: '12px', objectFit: 'contain', padding: '4px', margin: '0 auto 0.5rem auto' }}
                      />
                      <div style={{ fontWeight: 800, fontSize: '0.9rem', wordBreak: 'break-word' }}>{heroMatch.home_team_name}</div>
                    </div>

                    {heroIsLive ? (
                      <div style={{ textAlign: 'center', flexShrink: 0 }}>
                        <div style={{ fontFamily: 'var(--font-heading)', fontSize: 'clamp(2rem, 5vw, 2.8rem)', fontWeight: 900, letterSpacing: '0.05em', lineHeight: 1 }}>
                          {publicScoreHidden(heroMatch, clubTeams) ? 'vs' : `${heroMatch.home_score} : ${heroMatch.away_score}`}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--c-red)', fontWeight: 700, marginTop: '4px' }}>
                          {heroMatch.period === 'first_half' ? '1st half'
                            : heroMatch.period === 'halftime' ? 'Half time'
                            : heroMatch.period === 'second_half' ? '2nd half'
                            : heroMatch.period === 'extra_time' ? 'Extra time'
                            : heroMatch.period === 'penalties' ? 'Penalties'
                            : 'In play'}
                        </div>
                      </div>
                    ) : (
                      <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-muted)', padding: '0 0.5rem', flexShrink: 0 }}>vs</div>
                    )}

                    <div style={{ textAlign: 'center', flex: 1, minWidth: 0 }}>
                      <img loading="eager" decoding="async" width={48} height={48}
                        src={heroMatch.away_team_logo || DEFAULT_CREST}
                        alt={`${heroMatch.away_team_name} crest`}
                        ref={crestFallbackRef}
                        onError={crestOnError}
                        style={{ width: '48px', height: '48px', borderRadius: '12px', objectFit: 'contain', padding: '4px', margin: '0 auto 0.5rem auto' }}
                      />
                      <div style={{ fontWeight: 800, fontSize: '0.9rem', wordBreak: 'break-word' }}>{heroMatch.away_team_name}</div>
                    </div>
                  </div>

                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', textAlign: 'center', marginBottom: '1rem' }}>
                    <MatchWhen m={heroMatch} />{heroMatch.venue ? ` · ${heroMatch.venue}` : ''}
                  </div>
                  <span className="btn btn-primary btn-sm" style={{ width: '100%' }}>
                    {heroIsLive ? 'Follow live' : heroMatch.status === 'completed' ? 'Match report' : 'Match preview'}
                  </span>
                </Link>
              )}

              {currentSlide.category === 'news' && heroNews && (
                <Link
                  href={newsPath(club.slug, heroNews.slug)}
                  className="glass-panel glass-panel-interactive"
                  style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', color: 'inherit' }}
                >
                  <div style={{ height: '200px', position: 'relative' }}>
                    <CoverImage
                      loading="eager"
                      src={heroNews.cover_image_url || club.banner_url}
                      alt={heroNews.title}
                      crestUrl={club.logo_url}
                      style={{ width: '100%', height: '100%' }}
                    />
                  </div>
                  <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {!!heroNews.tags?.length && <div className="text-meta">{heroNews.tags.join(' · ')}</div>}
                    <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.3 }}>{heroNews.title}</h3>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      <span>{heroNews.author_name ? `By ${heroNews.author_name}` : ''}</span>
                      <span style={{ color: 'var(--club-ink)', fontWeight: 700 }}>Read article &rarr;</span>
                    </div>
                  </div>
                </Link>
              )}

              {currentSlide.category === 'event' && heroEvent && (
                <Link
                  href={`/${club.slug}/events/${heroEvent.id}`}
                  className="glass-panel glass-panel-interactive"
                  style={{ display: 'block', overflow: 'hidden', color: 'inherit', background: 'rgba(var(--dk-14-20-30), 0.9)' }}
                >
                  {heroEvent.flyer_url && (
                    <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', height: '220px', overflow: 'hidden', background: 'rgba(0, 0, 0, 0.35)' }}>
                      <div aria-hidden style={{ position: 'absolute', inset: '-20px', backgroundImage: `url(${JSON.stringify(heroEvent.flyer_url)})`, backgroundSize: 'cover', backgroundPosition: 'center', filter: 'blur(20px)', opacity: 0.45 }} />
                      <img src={heroEvent.flyer_url} alt={`${heroEvent.title} flyer`} decoding="async" style={{ position: 'relative', height: '100%', maxWidth: '100%', objectFit: 'contain' }} />
                    </div>
                  )}
                  <div style={{ padding: '1.5rem' }}>
                    <p className="text-meta" style={{ margin: '0 0 0.35rem' }}>
                      {EVENT_TAB_LABELS[heroEvent.category] || 'Event'} · {heroEvent.is_public ? 'All welcome' : 'Members only'}
                    </p>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>{heroEvent.title}</h3>
                    <p style={{ margin: '0 0 0.85rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                      <LocalTime value={heroEvent.start_time} options={SHORT_DATE} /> · {heroEvent.location || club.stadium_name}
                    </p>
                    {/* Only once people have checked in ("0 checked in" reads as nobody coming) */}
                    {heroEvent.rsvp_count > 0 && (
                      <p className="text-meta" style={{ margin: '0 0 0.85rem' }}>
                        {heroEvent.rsvp_count}{heroEvent.max_capacity > 0 ? ` / ${heroEvent.max_capacity}` : ''} checked in
                      </p>
                    )}
                    <span style={{ color: 'var(--club-ink)', fontWeight: 700, fontSize: '0.875rem' }}>
                      {(heroEvent.ticket_price_cents ?? 0) > 0 ? 'Get tickets' : 'View event'} &rarr;
                    </span>
                  </div>
                </Link>
              )}

              {currentSlide.category === 'stadium' && (
                <a
                  href={`https://maps.google.com/?q=${encodeURIComponent([club.stadium_name, club.stadium_address].filter(Boolean).join(', '))}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="glass-panel glass-panel-interactive"
                  style={{ display: 'block', padding: '1.75rem', color: 'inherit', background: 'rgba(var(--dk-14-20-30), 0.9)' }}
                >
                  {club.stadium_address && <p style={{ margin: '0 0 0.35rem', fontWeight: 700, color: 'var(--text-primary)' }}>{club.stadium_address}</p>}
                  {club.stadium_pitch_type && <p className="text-meta" style={{ margin: '0 0 0.85rem' }}>{club.stadium_pitch_type}</p>}
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--club-ink)', fontWeight: 700, fontSize: '0.875rem' }}>
                    Directions <ExternalLink size={14} aria-hidden="true" />
                  </span>
                </a>
              )}

              {currentSlide.category === 'image' && (
                <Link
                  href={currentSlide.ctaLink || `/${club.slug}`}
                  className="glass-panel glass-panel-interactive"
                  style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', color: 'inherit', background: 'rgba(var(--dk-14-20-30), 0.92)' }}
                >
                  <div style={{ height: '220px', position: 'relative' }}>
                    <CoverImage
                      loading="eager"
                      src={currentSlide.bgImage}
                      alt={currentSlide.title}
                      crestUrl={club.logo_url}
                      style={{ width: '100%', height: '100%' }}
                    />
                  </div>
                  <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.3 }}>{currentSlide.title}</h3>
                    <span style={{ color: 'var(--club-ink)', fontWeight: 700, fontSize: '0.875rem' }}>{currentSlide.ctaLabel || 'Find out more'} &rarr;</span>
                  </div>
                </Link>
              )}
            </div>
            )}
          </div>

          {/* Slide tabs and prev/next: left out when there's only the one slide */}
          {heroSlides.length > 1 && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.85rem',
            marginTop: '2.5rem',
            paddingTop: '1.25rem',
            borderTop: '1px solid rgba(var(--tint-rgb), 0.08)',
          }}>
            <div className="scroll-pill-strip" style={{ flex: 1, minWidth: 0 }}>
              {heroSlides.map((slide, idx) => {
                const isActive = activeSlide === idx;
                const iconColor = isActive ? club.primary_color : 'currentColor';
                return (
                  <button
                    key={slide.id}
                    type="button"
                    onClick={() => setActiveSlide(idx)}
                    aria-pressed={isActive}
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
                      minHeight: '44px',
                    }}
                  >
                    {slide.category === 'match' && (slide.targetMatch?.status === 'live'
                      ? <span className="pulse-dot" style={{ width: '8px', height: '8px' }} />
                      : <Calendar size={14} color={iconColor} aria-hidden="true" />)}
                    {slide.category === 'news' && <Newspaper size={14} color={iconColor} aria-hidden="true" />}
                    {slide.category === 'event' && <Calendar size={14} color={iconColor} aria-hidden="true" />}
                    {slide.category === 'stadium' && <MapPin size={14} color={iconColor} aria-hidden="true" />}
                    {slide.category === 'image' && <ImageIcon size={14} color={iconColor} aria-hidden="true" />}
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

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
              <button
                type="button"
                onClick={() => setActiveSlide(prev => (prev - 1 + heroSlides.length) % heroSlides.length)}
                aria-label="Previous slide"
                className="touch-target"
                data-theme="dark" style={{
                  width: '44px',
                  height: '44px',
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
                <ChevronLeft size={18} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => setActiveSlide(prev => (prev + 1) % heroSlides.length)}
                aria-label="Next slide"
                className="touch-target"
                data-theme="dark" style={{
                  width: '44px',
                  height: '44px',
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
                <ChevronRight size={18} aria-hidden="true" />
              </button>
            </div>
          </div>
          )}
        </div>
      </section>

      {/* 4.15 MATCHDAY STRIP: the live or next match, always in view under the hero */}
      <MatchdayStrip club={club} live={liveMatch} next={stripNextMatch} />

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

      {/* 4.3 FIXTURES & RESULTS: plain rows; each whole row opens the match */}
      <section id="fixtures" className="club-reveal club-section" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        <div className="container">
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.5rem' }}>
            <div>
              <h2 style={{ fontSize: '2rem', fontWeight: 900 }}>Fixtures &amp; results</h2>
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
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700 }}>Team</span>
                  <select aria-label="Team"
                    value={fixturesTeamId}
                    onChange={(e) => setFixturesTeamId(e.target.value)}
                    style={{
                      minHeight: '44px',
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
                    <option value="ALL" style={{ background: 'rgb(var(--dk-17-24-39))', color: 'var(--text-primary)' }}>All teams</option>
                  </select>
                </div>
              )}
              <div className="row">
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700 }}>Season</span>
                <select aria-label="Season"
                  value={fixturesSeasonFilter}
                  onChange={(e) => setFixturesSeasonFilter(e.target.value)}
                  style={{
                    minHeight: '44px',
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
                    Current season ({activeSeason?.name || defaultSeasonLabel()})
                  </option>
                  <option value="ALL" style={{ background: 'rgb(var(--dk-17-24-39))', color: 'var(--text-primary)' }}>All seasons</option>
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
                {(['upcoming', 'results'] as const).map(tab => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setFixturesTab(tab)}
                    aria-pressed={fixturesTab === tab}
                    style={{
                      flex: 1,
                      padding: '0.5rem 0.85rem',
                      borderRadius: 'var(--radius-sm)',
                      border: 'none',
                      position: 'relative',
                      background: 'transparent',
                      color: fixturesTab === tab ? 'var(--club-primary-contrast, #090D16)' : 'var(--text-muted)',
                      transition: 'color 0.25s ease',
                      fontWeight: 700,
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                      textAlign: 'center',
                      minHeight: '44px',
                    }}
                  >
                    {tab === 'upcoming' ? 'Upcoming' : 'Results'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* A cup or match-day event with no fixtures entered yet: say so, rather than "nothing coming up" */}
          {nextFootballEvent && (
            <Link
              href={`/${club.slug}/events/${nextFootballEvent.id}`}
              className="glass-panel glass-panel-interactive fx-next"
            >
              <span>
                <strong>Next up: {nextFootballEvent.title}</strong>
                <span className="text-meta"> · <LocalTime value={nextFootballEvent.start_time} options={SHORT_DATE} />{nextFootballEvent.location ? ` · ${nextFootballEvent.location}` : ''}</span>
              </span>
              <span style={{ color: 'var(--club-ink)', fontWeight: 700, fontSize: '0.875rem' }}>View event &rarr;</span>
            </Link>
          )}

          {fixtureCards.length === 0 ? (
            <p className="fx-empty">
              {fixturesTabPicked === null ? 'No matches listed yet.'
                : fixturesTab === 'results' ? 'No results yet this season.' : 'No matches scheduled yet.'}
            </p>
          ) : (
            <div className="fx-list">
              {fixtureCards.map(match => {
                const matchTeam = multiTeam ? teamOfMatch(match, clubTeams) : undefined;
                const hideScore = publicScoreHidden(match, clubTeams);
                const outcome = match.status === 'completed' && !hideScore ? clubResult(match).outcome : null;
                const details = [...new Set([
                  // A title that only repeats the two teams isn't worth a second line of the same names
                  match.title && !/\bvs?\b/i.test(match.title) ? match.title : '',
                  competitionName(match),
                  match.venue,
                  matchTeam ? teamLabel(matchTeam) : '',
                  fixturesSeasonFilter === 'ALL' ? match.season : '',
                ].filter(Boolean))].join(' · ');
                return (
                  // data-glide-card: opening the match glides this row into the match page's scoreboard (MatchGlideLink)
                  <div key={match.id} data-glide-card className="fx-row">
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                        <LocalTime value={match.match_date} options={SHORT_DATE} />
                        {(hasKickoffTime(match) || match.match_time) && <> · <KickoffTime m={match} /></>}
                      </div>
                      <div className="text-meta">{details}</div>
                      {match.status === 'postponed' && (
                        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--c-amber)' }}>Postponed</div>
                      )}
                    </div>

                    <div className="fx-teams">
                      <span className="fx-chip">{outcome && <ResultChip outcome={outcome} />}</span>
                      <span className="fx-home">{match.home_team_name}</span>
                      <span data-glide-score className="fx-score" style={match.status === 'live' ? { color: 'var(--c-red)' } : undefined}>
                        {match.status === 'live' ? (hideScore ? 'LIVE' : `${match.home_score} – ${match.away_score}`)
                          : match.status === 'completed' ? (hideScore ? 'FT' : `${match.home_score} – ${match.away_score}`)
                          : 'vs'}
                      </span>
                      <span className="fx-away">{match.away_team_name}</span>
                    </div>

                    <div className="fx-actions">
                      {match.status === 'upcoming' && isClubAdmin && (
                        <Link href={`/${club.slug}/availability`} className="fx-admin">Availability</Link>
                      )}
                      <MatchGlideLink matchId={match.id} href={matchPath(club.slug, match)} className="fx-go">
                        {match.status === 'completed' ? 'Match report' : match.status === 'live' ? 'Follow live' : 'Match preview'}
                        <ChevronRight size={14} aria-hidden="true" />
                      </MatchGlideLink>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* 4.35 SPONSORS SHOWCASE (after the fixtures: fans come for the games first) */}
      {clubSponsors.length > 0 && (
        <section className="club-section" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <div className="container">
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.6rem', fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>Thank you to our sponsors</h2>
              <Link href={`/${club.slug}/sponsor`} style={{ display: 'inline-flex', alignItems: 'center', minHeight: '44px', color: 'var(--club-ink)', fontSize: '0.875rem', fontWeight: 700 }}>
                Become a sponsor &rarr;
              </Link>
            </div>
            {/* Highest tier first (a size override changes a card's size, not its place in the order) */}
            <SponsorShowcase sponsors={sortSponsorsByTier(clubSponsors)} placement="club_home_showcase" />
          </div>
        </section>
      )}

      {/* 4.4 EVENTS: each card opens the event */}
      <section id="events" className="club-reveal club-section" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        <div className="container">
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '2rem', fontWeight: 900 }}>Events &amp; training</h2>
            <Link href={`/${club.slug}/events`} style={{ display: 'inline-flex', alignItems: 'center', minHeight: '44px', color: 'var(--club-ink)', fontSize: '0.875rem', fontWeight: 700 }}>
              All events &amp; tickets &rarr;
            </Link>
          </div>

          {upcomingEvents.length === 0 && (
            <p className="fx-empty">No upcoming events right now.</p>
          )}
          <div className="club-cards">
            {upcomingEvents.map(evt => (
              <Link
                key={evt.id}
                href={`/${club.slug}/events/${evt.id}`}
                className="glass-panel glass-panel-interactive"
                style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', color: 'inherit' }}
              >
                {evt.flyer_url && (
                  <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', height: '180px', overflow: 'hidden', background: 'rgba(var(--shade-rgb), 0.35)', flexShrink: 0 }}>
                    <div aria-hidden style={{ position: 'absolute', inset: '-20px', backgroundImage: `url(${JSON.stringify(evt.flyer_url)})`, backgroundSize: 'cover', backgroundPosition: 'center', filter: 'blur(20px)', opacity: 0.45 }} />
                    <img src={evt.flyer_url} alt={`${evt.title} flyer`} loading="lazy" decoding="async" style={{ position: 'relative', height: '100%', maxWidth: '100%', objectFit: 'contain' }} />
                  </div>
                )}
                <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', flex: 1 }}>
                  <p className="text-meta" style={{ margin: '0 0 0.25rem' }}>{EVENT_TAB_LABELS[evt.category] || 'Event'}</p>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>{evt.title}</h3>
                  {evt.description && (
                    <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: '0 0 0.75rem' }}>{evt.description}</p>
                  )}
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: '0 0 0.75rem' }}>
                    <LocalTime value={evt.start_time} />{evt.location ? ` · ${evt.location}` : ''}
                  </p>
                  <span style={{ marginTop: 'auto', color: 'var(--club-ink)', fontWeight: 700, fontSize: '0.875rem' }}>View details &rarr;</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* 4.5 LATEST NEWS */}
      <section id="news" className="club-reveal club-section" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        <div className="container">
          <h2 style={{ fontSize: '2rem', fontWeight: 900, marginBottom: '1.5rem' }}>Latest news</h2>

          {clubNews.length === 0 && <p className="fx-empty">No news yet.</p>}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(320px, 100%), 1fr))',
            gap: '1.5rem',
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
                  color: 'inherit',
                }}
              >
                <div style={{ height: '240px', position: 'relative' }}>
                  <CoverImage
                    src={featuredArticle.cover_image_url}
                    alt={featuredArticle.title}
                    crestUrl={club.logo_url}
                    style={{ width: '100%', height: '100%' }}
                  />
                </div>

                <div style={{ padding: '1.5rem', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    {!!featuredArticle.tags?.length && <p className="text-meta" style={{ margin: '0 0 0.35rem' }}>{featuredArticle.tags.slice(0, 2).join(' · ')}</p>}
                    <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.6rem', lineHeight: 1.3 }}>
                      {featuredArticle.title}
                    </h3>
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '1.25rem' }}>
                      {featuredArticle.summary}
                    </p>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    <span>{featuredArticle.author_name ? `By ${featuredArticle.author_name}` : ''}</span>
                    <span style={{ color: 'var(--club-ink)', fontWeight: 700 }}>Read article &rarr;</span>
                  </div>
                </div>
              </Link>
            )}

            {/* News Feed */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {clubNews.filter(n => n.id !== featuredArticle?.id).slice(0, HOME_NEWS_COUNT).map(article => (
                <Link
                  key={article.id}
                  id={`news-${article.slug}`}
                  href={newsPath(club.slug, article.slug)}
                  className="glass-panel glass-panel-interactive"
                  style={{
                    scrollMarginTop: '6rem',
                    padding: '1rem',
                    display: 'flex',
                    gap: '1rem',
                    alignItems: 'center',
                    color: 'inherit',
                  }}
                >
                  <CoverImage
                    width={84} height={84}
                    src={article.cover_image_url}
                    alt={article.title}
                    crestUrl={club.logo_url}
                    style={{ width: '84px', height: '84px', borderRadius: '10px', flexShrink: 0 }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p className="text-meta" style={{ margin: '0 0 0.2rem' }}>
                      {[...(article.tags?.slice(0, 2) || [])].join(' · ')}{article.tags?.length ? ' · ' : ''}<LocalTime value={article.published_at} options={SHORT_DATE} />
                    </p>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.3 }}>
                      {article.title}
                    </h3>
                  </div>
                </Link>
              ))}
              {clubNews.length > 0 && (
                <Link href={`/${club.slug}/news`} style={{ display: 'inline-flex', alignItems: 'center', minHeight: '44px', color: 'var(--club-ink)', fontWeight: 700, fontSize: '0.875rem' }}>
                  All news &rarr;
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* 4.6 COMMITTEE: left out until the club lists someone */}
      {executiveStaff.length > 0 && (
      <section className="club-reveal club-section" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        <div className="container">
          <h2 style={{ fontSize: '2rem', fontWeight: 900, marginBottom: '1.5rem' }}>Committee</h2>
          <div className="committee-list">
            {executiveStaff.map(exec => (
              <div key={exec.id} style={{ display: 'flex', alignItems: 'center', gap: '0.9rem', minWidth: 0 }}>
                <PlayerAvatar photoUrl={exec.photo_url} name={exec.full_name} size={64} style={{ flexShrink: 0 }} />
                <div style={{ minWidth: 0 }}>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>{exec.full_name}</h3>
                  <div className="text-meta">{exec.executive_title}</div>
                  {exec.executive_bio && (
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.5, margin: '0.25rem 0 0' }}>{exec.executive_bio}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
      )}

      {/* 4.7 TOP PLAYERS: the leader in club colours, then a standings table (Hallmark redesign) */}
      <section id="squad" className="club-reveal club-section" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        <div className="container">
          <div className="tp-head">
            <div>
              <h2 className="tp-title">Top players</h2>
              <p className="tp-sub">
                {anyRanked
                  ? `${currentSeasonName} ${squadFilter === 'GK' ? 'goalkeepers' : squadFilter === 'DEF' ? 'defenders' : 'season'}`
                  : `${currentSeasonName}: rankings appear once the first match stats are saved.`}
              </p>
            </div>
            <div className="tp-seg" role="group" aria-label="Filter players by position">
              {(['ALL', 'GK', 'DEF', 'MID', 'FWD'] as const).map(pos => (
                <button key={pos} type="button" onClick={() => { setSquadFilter(pos); setShowAllPlayers(false); }} aria-pressed={squadFilter === pos}
                  aria-label={pos === 'ALL' ? 'All positions' : pos === 'GK' ? 'Goalkeepers' : pos === 'DEF' ? 'Defenders' : pos === 'MID' ? 'Midfielders' : 'Forwards'}>
                  {pos === 'ALL' ? 'All' : pos}
                </button>
              ))}
            </div>
          </div>

          {topPlayers.length === 0 && (
            <p className="tp-empty">No players in this position yet.</p>
          )}

          {topPlayers.length > 0 && (
          <div className={`tp-grid${leader ? '' : ' tp-grid-solo'}`}>
            {leader && (
              <TopPlayerLeader
                href={`/${club.slug}/squad/${leader.id}`}
                name={leader.full_name}
                position={leader.player_position ? POSITION_NAMES[leader.player_position] || leader.player_position : null}
                photoUrl={leader.photo_url || null}
                joint={places[0]?.tied}
                figures={view.leader.map(f => ({ label: f.label, abbr: f.abbr, n: statFor(leader.id)?.[f.key] ?? 0 }))}
                line={squadFilter === 'GK' && (statFor(leader.id)?.appearances ?? 0) > 0
                  ? `Kept a clean sheet in ${statFor(leader.id)?.clean_sheets ?? 0} of ${statFor(leader.id)?.appearances ?? 0} game${statFor(leader.id)?.appearances === 1 ? '' : 's'}.`
                  : null}
              />
            )}

            <div id="leaderboard">
              <div className="tp-tabs" role="group" aria-label="Rank players by">
                {view.tabs.map(([key, label]) => (
                  <button key={key} type="button" onClick={() => setRankBy(key)} aria-pressed={rankOn === key}>{label}</button>
                ))}
              </div>
              <table className="tp-table">
                <thead>
                  <tr>
                    <th scope="col"><span className="sr-only">Rank</span></th>
                    <th scope="col" className="tp-th-player">Player</th>
                    {view.columns.map(c => (
                      <th key={c.key} scope="col" className={c.wide ? 'tp-col-gp' : undefined}>
                        {c.abbr ? <abbr title={c.label}>{c.abbr}</abbr> : c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                {/* Keyed so a new filter or tab fades in rather than snapping (.tp-table tbody) */}
                <tbody key={`${squadFilter}-${rankOn}`}>
                  {tableRows.map(({ player, rank }) => {
                    const stat = statFor(player.id);
                    return (
                      <tr key={player.id}>
                        <td className="tp-rank">{rank ?? '–'}</td>
                        <td className="tp-who">
                          <Link href={`/${club.slug}/squad/${player.id}`}>
                            {player.photo_url
                              ? <span className="tp-kit tp-kit-photo"><PlayerAvatar photoUrl={player.photo_url} name={player.full_name} fill /></span>
                              : <span className={`tp-kit${player.jersey_number == null ? ' tp-kit-none' : ''}`} aria-hidden="true">{player.jersey_number ?? initialsOf(player.full_name)}</span>}
                            <span className="min-w-0">
                              <strong>{player.full_name}</strong>
                              {player.player_position && <small>{POSITION_NAMES[player.player_position] || player.player_position}</small>}
                            </span>
                          </Link>
                        </td>
                        {view.columns.map(c => (
                          <td key={c.key} className={[c.wide && 'tp-col-gp', rankOn === c.key && 'tp-key'].filter(Boolean).join(' ') || undefined}>
                            {stat?.[c.key] ?? 0}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="tp-more-row">
                {ranked.length > 5 && (
                  <button type="button" className="tp-more" aria-expanded={showAllPlayers} onClick={() => setShowAllPlayers(open => !open)}>
                    {showAllPlayers ? 'Show top 5' : `Show all ${ranked.length}`}
                  </button>
                )}
                <Link href={`/${club.slug}/squad`} className="tp-more">
                  View squad <ChevronRight size={16} aria-hidden="true" />
                </Link>
              </div>
            </div>
          </div>
          )}
        </div>
      </section>

      {/* 4.8 HOME GROUND DETAILS & MAP */}
      <section id="stadium" className="club-reveal club-section" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        <div className="container">
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(320px, 100%), 1fr))',
            gap: 'clamp(1.5rem, 4vw, 3rem)',
            alignItems: 'center',
          }}>
            <div>
              <h2 style={{ fontSize: '2rem', fontWeight: 900, marginBottom: '0.75rem' }}>
                Home ground: {club.stadium_name}
              </h2>

              <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '1.25rem' }}>
                Where {club.name} play home matches. Check the fixture list for kick-off times and which pitch.
              </p>

              <dl className="club-facts">
                {club.stadium_address?.trim() && <div><dt>Address</dt><dd>{club.stadium_address}</dd></div>}
                {club.stadium_pitch_type?.trim() && <div><dt>Surface</dt><dd>{club.stadium_pitch_type}</dd></div>}
                {club.stadium_parking_info?.trim() && <div><dt>Parking</dt><dd>{club.stadium_parking_info}</dd></div>}
              </dl>
            </div>

            <div>
              {/* Geocoded live from the club's own stadium address */}
              <div style={{ height: '340px', overflow: 'hidden', borderRadius: 'var(--radius-lg)', background: 'rgb(var(--dk-19-27-38))' }}>
                <iframe
                  title="Home ground map"
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
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', marginTop: '0.85rem' }}>
                <strong style={{ color: 'var(--text-primary)' }}>{club.stadium_name}</strong>
                <a
                  href={`https://maps.google.com/?q=${encodeURIComponent([club.stadium_name, club.stadium_address].filter(Boolean).join(', '))}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-primary"
                >
                  Directions <ExternalLink size={14} aria-hidden="true" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4.85 GET IN TOUCH: a contact form anyone can find (the Sponsor page and #contact links point here) */}
      <div className="club-reveal club-section">
        <div className="container">
          <ClubContactSection club={club} />
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
