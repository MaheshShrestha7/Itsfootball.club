// schema.org JSON-LD builders, rendered server-side from live data (see components/JsonLd.tsx).
import { AREA_SERVED, SITE_NAME, SITE_URL, SOCIAL_PROFILES } from './seo';
import { CONTACT_EMAIL, FEE_PHRASE } from './faq';
import { newsPath } from './slugs';
import type {
  ClubMetadataRow,
  EventMetadataRow,
  MatchMetadataRow,
  NewsArticleRow,
  NewsMetadataRow,
  TournamentMetadataRow,
} from './supabase/club-lookup';

type Json = { [key: string]: unknown };

const abs = (path: string) => `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
const absUrl = (url?: string | null) => (!url ? undefined : /^https?:\/\//.test(url) ? url : abs(url));

/** Drops null/undefined/empty values (recursively) so optional fields never emit `"x": null` */
function compact<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map(compact).filter(v => v !== undefined && v !== null && !(typeof v === 'object' && !Array.isArray(v) && Object.keys(v as object).length === 0)) as T;
  }
  if (value && typeof value === 'object') {
    const out: Json = {};
    for (const [k, v] of Object.entries(value as Json)) {
      const c = compact(v);
      if (c === undefined || c === null || c === '' || (Array.isArray(c) && c.length === 0)) continue;
      out[k] = c;
    }
    return out as T;
  }
  return value;
}

const graph = (...nodes: Json[]) => compact({ '@context': 'https://schema.org', '@graph': nodes });

export const ORGANIZATION_ID = `${SITE_URL}/#organization`;
export const WEBSITE_ID = `${SITE_URL}/#website`;
const clubUrl = (club: ClubMetadataRow) => abs(`/${club.slug}`);
const clubId = (club: ClubMetadataRow) => `${clubUrl(club)}#club`;

/** Platform homepage: the publisher, the product (free for clubs) and the site, with a sitelinks search box backed by /clubs?q= */
export function homeSchema() {
  return graph(
    {
      '@type': 'Organization',
      '@id': ORGANIZATION_ID,
      name: SITE_NAME,
      url: SITE_URL,
      logo: { '@type': 'ImageObject', url: abs('/logo.png'), width: 512, height: 512 },
      description: 'A free platform for grassroots and community football clubs: club websites, live match centres, lineups, digital member passes, club merch shops and sponsor showcases.',
      email: CONTACT_EMAIL,
      areaServed: AREA_SERVED,
      sameAs: SOCIAL_PROFILES.map(p => p.url),
    },
    {
      '@type': 'WebApplication',
      '@id': `${SITE_URL}/#app`,
      name: SITE_NAME,
      url: SITE_URL,
      applicationCategory: 'SportsApplication',
      operatingSystem: 'Any (web browser; installable on iPhone and Android)',
      description: 'Free club website and management platform for grassroots football clubs, run by club volunteers from one dashboard.',
      featureList: [
        'Club website with custom colours, logo and domain',
        'Live match centre with goals, cards and substitutions',
        'Player availability and lineups',
        'Digital member passes with QR check-in',
        'Online membership payments',
        'Club merch shop',
        'Tournaments with group tables and knockout brackets',
        'Sponsor showcase and applications',
        'Club news, gallery and analytics',
      ],
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'AUD',
        description: `Free for clubs, every feature included. Card payments made to a club carry ${FEE_PHRASE}, paid by the payer.`,
      },
      areaServed: AREA_SERVED,
      publisher: { '@id': ORGANIZATION_ID },
    },
    {
      '@type': 'WebSite',
      '@id': WEBSITE_ID,
      url: SITE_URL,
      name: SITE_NAME,
      publisher: { '@id': ORGANIZATION_ID },
      potentialAction: {
        '@type': 'SearchAction',
        target: { '@type': 'EntryPoint', urlTemplate: `${SITE_URL}/clubs?q={search_term_string}` },
        'query-input': 'required name=search_term_string',
      },
    }
  );
}

function clubRef(club: ClubMetadataRow): Json {
  return { '@type': 'SportsTeam', '@id': clubId(club), name: club.name, url: clubUrl(club) };
}

// "Club Media Team" is an organisation, not a person
const author = (name: string | null, club: ClubMetadataRow): Json =>
  !name || /\b(team|media|club|staff|desk|office|committee)\b/i.test(name)
    ? { '@type': 'Organization', name: name || `${club.name} Media Team`, url: clubUrl(club) }
    : { '@type': 'Person', name };

/** A news article, identified by its own page (/{club}/news/{slug}) */
function articleNode(club: ClubMetadataRow, article: NewsMetadataRow & { updated_at?: string | null }): Json {
  const url = abs(newsPath(club.slug, article.slug));
  const logo = absUrl(club.logo_url);
  return {
    '@type': 'BlogPosting',
    '@id': `${url}#article`,
    url,
    mainEntityOfPage: url,
    // Google truncates headlines past 110 characters
    headline: article.title.length > 110 ? `${article.title.slice(0, 109)}…` : article.title,
    description: article.summary,
    image: absUrl(article.cover_image_url) ? [absUrl(article.cover_image_url)] : undefined,
    datePublished: article.published_at,
    dateModified: article.updated_at && article.updated_at > article.published_at ? article.updated_at : undefined,
    author: author(article.author_name, club),
    publisher: { '@type': 'Organization', name: club.name, url: clubUrl(club), logo: logo ? { '@type': 'ImageObject', url: logo } : undefined },
    about: { '@id': clubId(club) },
    keywords: article.tags?.join(', '),
    articleSection: article.tags?.[0],
  };
}

/** A news article's own page: the article plus a breadcrumb back to its club */
export function newsArticleSchema(club: ClubMetadataRow, article: NewsArticleRow) {
  return graph(articleNode(club, article), {
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: club.name, item: clubUrl(club) },
      { '@type': 'ListItem', position: 2, name: 'News', item: `${clubUrl(club)}#news` },
      { '@type': 'ListItem', position: 3, name: article.title },
    ],
  });
}

/** Club homepage: the club itself plus a BlogPosting for each news article shown in its News section */
export function clubSchema(club: ClubMetadataRow, news: NewsMetadataRow[]) {
  const logo = absUrl(club.logo_url);
  return graph(
    {
      '@type': 'SportsTeam',
      '@id': clubId(club),
      name: club.name,
      alternateName: club.short_name !== club.name ? club.short_name : undefined,
      url: clubUrl(club),
      sport: 'Soccer',
      logo,
      image: absUrl(club.banner_url) || logo,
      description: club.motto,
      foundingDate: club.founded_year ? String(club.founded_year) : undefined,
      location: club.stadium_name
        ? { '@type': 'Place', name: club.stadium_name, address: club.stadium_address || club.stadium_name }
        : undefined,
    },
    ...news.map(article => articleNode(club, article))
  );
}

const MATCH_STATUS: Record<string, string> = {
  postponed: 'https://schema.org/EventPostponed',
  cancelled: 'https://schema.org/EventCancelled',
  canceled: 'https://schema.org/EventCancelled',
};

/** A fixture: both teams, kick-off, venue, and the live/final score in the description */
export function matchSchema(club: ClubMetadataRow, match: MatchMetadataRow) {
  const clubIsHome = match.is_club_home !== false;
  const team = (name: string, logo: string | null, isClub: boolean): Json =>
    isClub ? { ...clubRef(club), logo: absUrl(logo) || absUrl(club.logo_url) } : { '@type': 'SportsTeam', name, logo: absUrl(logo) };
  const home = team(match.home_team_name, match.home_team_logo, clubIsHome);
  const away = team(match.away_team_name, match.away_team_logo, !clubIsHome);
  const played = ['completed', 'full_time', 'live', 'halftime'].includes(match.status);
  const venue = match.venue || club.stadium_name;

  return graph({
    '@type': 'SportsEvent',
    '@id': abs(`/${club.slug}/match/${match.id}#event`),
    url: abs(`/${club.slug}/match/${match.id}`),
    name: `${match.home_team_name} vs ${match.away_team_name}`,
    description: played
      ? `${match.home_team_name} ${match.home_score}-${match.away_score} ${match.away_team_name}${match.competition ? ` (${match.competition})` : ''}`
      : `${match.home_team_name} vs ${match.away_team_name}${match.competition ? `, ${match.competition}` : ''}`,
    sport: 'Soccer',
    startDate: match.match_date,
    eventStatus: MATCH_STATUS[match.status] || 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    location: venue ? { '@type': 'Place', name: venue, address: venue } : undefined,
    homeTeam: home,
    awayTeam: away,
    competitor: [home, away],
    organizer: clubRef(club),
    image: absUrl(club.banner_url) || absUrl(club.logo_url),
    superEvent: match.competition ? { '@type': 'SportsEvent', name: match.competition } : undefined,
  });
}

/** A public club event (social, AGM, training day...) */
export function eventSchema(club: ClubMetadataRow, event: EventMetadataRow) {
  const place = event.location || club.stadium_name;
  return graph({
    '@type': 'Event',
    '@id': abs(`/${club.slug}/events/${event.id}#event`),
    url: abs(`/${club.slug}/events/${event.id}`),
    name: event.title,
    description: event.description,
    startDate: event.start_time,
    endDate: event.end_time,
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    location: place ? { '@type': 'Place', name: place, address: place } : undefined,
    organizer: clubRef(club),
    image: absUrl(club.banner_url) || absUrl(club.logo_url),
  });
}

/** A club-run tournament or cup */
export function tournamentSchema(club: ClubMetadataRow, tournament: TournamentMetadataRow) {
  const name = `${tournament.name}${tournament.season ? ` ${tournament.season}` : ''}`;
  const place = tournament.venue || club.stadium_name;
  return graph({
    '@type': 'SportsEvent',
    '@id': abs(`/${club.slug}/tournaments/${tournament.id}#event`),
    url: abs(`/${club.slug}/tournaments/${tournament.id}`),
    name,
    description: tournament.description,
    sport: 'Soccer',
    startDate: tournament.start_date,
    endDate: tournament.end_date,
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    location: place ? { '@type': 'Place', name: place, address: place } : undefined,
    organizer: clubRef(club),
    image: absUrl(tournament.banner_url) || absUrl(club.banner_url) || absUrl(club.logo_url),
  });
}
