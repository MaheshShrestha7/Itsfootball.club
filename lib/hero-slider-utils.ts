import { Club, Match, NewsArticle, ClubEvent, HeroSliderPinnedItem } from './supabase/types';
import { getLiveMinute } from './match-clock';
import { publicFixtures, soonestFirst } from './fixtures';

/**
 * Returns default hero pinned slides for a club if none have been explicitly customized.
 * Includes:
 * 1. Live match or next upcoming fixture
 * 2. Featured news story
 * 3. Upcoming training or open event
 * 4. Home ground banner
 */
export function getDefaultHeroPinnedItems(
  club: Club,
  matches: Match[] = [],
  news: NewsArticle[] = [],
  events: ClubEvent[] = []
): HeroSliderPinnedItem[] {
  const defaults: HeroSliderPinnedItem[] = [];
  const clubMatches = matches.filter(m => m.club_id === club.id);
  const clubNews = news.filter(n => n.club_id === club.id);
  const clubEvents = events.filter(e => e.club_id === club.id);

  // 1. Fixture / Matchday live: a game fans can come to, not an in-house training game
  const shown = publicFixtures(clubMatches);
  const liveOrUpcoming = shown.find(m => m.status === 'live')
    || shown.filter(m => m.status === 'upcoming').sort(soonestFirst)[0]
    || shown[0];
  if (liveOrUpcoming) {
    const isLive = liveOrUpcoming.status === 'live';
    const compLabel = (!liveOrUpcoming.competition || liveOrUpcoming.competition === 'Premier Regional League')
      ? (liveOrUpcoming.match_type ? `${liveOrUpcoming.match_type.charAt(0).toUpperCase() + liveOrUpcoming.match_type.slice(1)} Match` : 'Club Friendly')
      : liveOrUpcoming.competition;
    defaults.push({
      id: `pin-fixture-${liveOrUpcoming.id}`,
      type: 'fixture',
      target_id: liveOrUpcoming.id,
      title: `${liveOrUpcoming.home_team_name} vs ${liveOrUpcoming.away_team_name}`,
      subtitle: `${compLabel} • ${liveOrUpcoming.venue}`,
      badge: isLive ? `MATCHDAY LIVE • ${getLiveMinute(liveOrUpcoming)}' IN PLAY` : `PINNED FIXTURE • ${compLabel.toUpperCase()}`,
      image_url: '',
      cta_label: isLive ? 'Enter Match Centre Live' : 'Match Preview & Lineups',
      cta_link: `/${club.slug}/match/${liveOrUpcoming.id}`,
      is_active: true,
      order: 1,
    });
  }

  // 2. Featured News Story
  const featuredArticle = clubNews.find(n => n.is_featured) || clubNews[0];
  if (featuredArticle) {
    defaults.push({
      id: `pin-news-${featuredArticle.id}`,
      type: 'news',
      target_id: featuredArticle.id,
      title: featuredArticle.title,
      subtitle: featuredArticle.summary,
      badge: `FEATURED STORY • ${featuredArticle.tags?.[0] || 'FIRST TEAM'}`,
      image_url: featuredArticle.cover_image_url || club.banner_url || '',
      cta_label: 'Read Full Story',
      cta_link: `/${club.slug}#news`,
      is_active: true,
      order: defaults.length + 1,
    });
  }

  // 3. Upcoming Event / Trials
  if (clubEvents[0]) {
    defaults.push({
      id: `pin-event-${clubEvents[0].id}`,
      type: 'event',
      target_id: clubEvents[0].id,
      title: clubEvents[0].title,
      subtitle: clubEvents[0].description,
      badge: `UPCOMING EVENT • ${clubEvents[0].category.toUpperCase()}`,
      image_url: '',
      cta_label: 'RSVP / Event Details',
      cta_link: `/${club.slug}#events`,
      is_active: true,
      order: defaults.length + 1,
    });
  }

  // 4. Home ground (the surface only when the club set one)
  defaults.push({
    id: 'pin-image-fortress',
    type: 'image',
    image_url: club.slider_images?.[1] || club.banner_url || '',
    title: club.stadium_name || 'Home ground',
    subtitle: club.stadium_pitch_type || club.stadium_address || '',
    badge: 'HOME GROUND',
    cta_label: 'View Home Ground Map',
    cta_link: `/${club.slug}#stadium`,
    is_active: true,
    order: defaults.length + 1,
  });

  return defaults;
}
