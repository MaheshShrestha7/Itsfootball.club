import { Club, Match, NewsArticle, ClubEvent, HeroSliderPinnedItem } from './supabase/types';

/**
 * Returns default hero pinned slides for a club if none have been explicitly customized.
 * Includes:
 * 1. Live match or next upcoming fixture
 * 2. Featured news story
 * 3. Upcoming training or open event
 * 4. Stadium & fortress showcase banner
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

  // 1. Fixture / Matchday live
  const liveOrUpcoming = clubMatches.find(m => m.status === 'live') || clubMatches[0];
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
      badge: isLive ? `MATCHDAY LIVE • ${liveOrUpcoming.current_minute}' IN PLAY` : `PINNED FIXTURE • ${compLabel.toUpperCase()}`,
      image_url: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=1600&auto=format&fit=crop&q=80',
      cta_label: isLive ? 'Enter Match Center Live' : 'Match Preview & Lineups',
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
      image_url: featuredArticle.cover_image_url || club.banner_url || 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=1600&auto=format&fit=crop&q=80',
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
      image_url: 'https://images.unsplash.com/photo-1517466787929-bc90951d0974?w=1600&auto=format&fit=crop&q=80',
      cta_label: 'RSVP / Event Details',
      cta_link: `/${club.slug}#events`,
      is_active: true,
      order: defaults.length + 1,
    });
  }

  // 4. Stadium Fortress Spotlight
  defaults.push({
    id: 'pin-image-fortress',
    type: 'image',
    image_url: club.slider_images?.[1] || club.banner_url || 'https://images.unsplash.com/photo-1522778119026-d647f0596c20?w=1600&auto=format&fit=crop&q=80',
    title: `${club.stadium_name} Fortress`,
    subtitle: `${club.stadium_capacity?.toLocaleString() || '12,500'} Covered Seats • ${club.stadium_pitch_type || 'Natural Hybrid Turf'}`,
    badge: 'HOME FORTRESS',
    cta_label: 'View Stadium Map',
    cta_link: `/${club.slug}#stadium`,
    is_active: true,
    order: defaults.length + 1,
  });

  return defaults;
}
