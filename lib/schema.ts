// schema.org JSON-LD builders, rendered server-side from live data (see components/JsonLd.tsx).
import { AREA_SERVED, SITE_NAME, SITE_URL, SOCIAL_PROFILES } from './seo';
import { CONTACT_EMAIL, FEE_PHRASE } from './faq';
import { newsPath } from './slugs';
import { isPlayed } from './public-tournaments';
import { groundPath, type GroundRow } from './grounds';
import type {
  ClubMetadataRow,
  EventMetadataRow,
  EventTournamentRow,
  MatchMetadataRow,
  NewsArticleRow,
  NewsMetadataRow,
  ShopProductRow,
  TournamentMetadataRow,
} from './supabase/club-lookup';

type Json = { [key: string]: unknown };

const abs = (path: string) => `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
// An inline data: image (e.g. a default crest) has no URL to give, so it's left out
const absUrl = (url?: string | null) => (!url || url.startsWith('data:') ? undefined : /^https?:\/\//.test(url) ? url : abs(url));

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
const BASED_IN = 'Sydney, NSW, Australia';
/** Who builds the platform: E-E-A-T for search and AI engines, described in full on /about */
export const FOUNDER = {
  '@type': 'Person',
  '@id': `${SITE_URL}/about#founder`,
  name: 'Mahesh Shrestha',
  jobTitle: 'Founder',
  url: `${SITE_URL}/about`,
  sameAs: ['https://www.linkedin.com/in/maheshshrestha'],
};
const clubUrl = (club: ClubMetadataRow) => abs(`/${club.slug}`);
const clubId = (club: ClubMetadataRow) => `${clubUrl(club)}#club`;

/** /about: who is behind the platform, tied to the homepage's Organization by @id */
export function aboutSchema() {
  return graph(
    { '@type': 'AboutPage', url: `${SITE_URL}/about`, name: `About ${SITE_NAME}`, mainEntity: { '@id': ORGANIZATION_ID } },
    { '@type': 'Organization', '@id': ORGANIZATION_ID, name: SITE_NAME, url: SITE_URL, email: CONTACT_EMAIL, founder: { '@id': FOUNDER['@id'] } },
    { ...FOUNDER, worksFor: { '@id': ORGANIZATION_ID }, homeLocation: { '@type': 'Place', name: BASED_IN } },
  );
}

/** Platform homepage: the publisher, the product (free for clubs) and the site, with a sitelinks search box backed by /clubs?q= */
export function homeSchema() {
  const sameAs = SOCIAL_PROFILES.map(p => p.url);
  return graph(
    {
      '@type': 'Organization',
      '@id': ORGANIZATION_ID,
      name: SITE_NAME,
      url: SITE_URL,
      logo: { '@type': 'ImageObject', url: abs('/logo.png?v=2'), width: 512, height: 512 },
      description: 'A free platform for grassroots and community football and soccer clubs: club websites, live match centres, lineups, digital member passes, club merch shops and sponsor showcases.',
      email: CONTACT_EMAIL,
      areaServed: AREA_SERVED,
      sameAs,
      founder: FOUNDER,
      foundingLocation: { '@type': 'Place', name: BASED_IN },
    },
    // A Service, not a SoftwareApplication: Google treats any SoftwareApplication as a software-app rich result,
    // which is invalid without aggregateRating/review (Search Console error). We have no genuine reviews to cite.
    {
      '@type': 'Service',
      '@id': `${SITE_URL}/#app`,
      name: SITE_NAME,
      url: SITE_URL,
      serviceType: 'Football club website and management platform',
      description: 'Free club website and management platform for grassroots football and soccer clubs, run by club volunteers from one dashboard. Works in any web browser and installs on iPhone and Android.',
      hasOfferCatalog: {
        '@type': 'OfferCatalog',
        name: 'Features',
        itemListElement: [
          'Club website with custom colours, logo and domain',
          'Live match centre with goals, cards and substitutions',
          'Player availability and lineups',
          'Digital member passes with QR check-in',
          'Online membership payments',
          'Club merch shop',
          'Tournaments with group tables and knockout brackets',
          'Sponsor showcase and applications',
          'Club news, gallery and analytics',
        ].map(name => ({ '@type': 'Offer', itemOffered: { '@type': 'Service', name } })),
      },
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'AUD',
        description: `Free for clubs, every feature included. Card payments made to a club carry ${FEE_PHRASE}, paid by the payer.`,
      },
      areaServed: AREA_SERVED,
      provider: { '@id': ORGANIZATION_ID },
      sameAs,
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
    },
    {
      '@type': 'FAQPage',
      '@id': `${SITE_URL}/#faq`,
      mainEntity: HOMEPAGE_FAQS.map(f => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: {
          '@type': 'Answer',
          text: f.a,
        },
      })),
    }
  );
}

export const HOMEPAGE_FAQS = [
  {
    q: 'Is itsfootball.club really free for grassroots clubs?',
    a: 'Yes. There is no monthly subscription, no setup fee and no paid plan. Every club gets a custom website, live match centre, digital member passes with QR check-in, lineup builder and club shop. The only charge is a booking fee on online card payments, paid by the person paying, not the club.',
  },
  {
    q: 'Do supporters or parents need to install an app to follow live matches?',
    a: 'No app is required. itsfootball.club runs directly in any phone or desktop browser. Anyone with your club link can view live scores, goalscorers, pitch formations, and match commentary with zero downloads.',
  },
  {
    q: 'Can we connect our club’s own custom web address?',
    a: 'Yes. You can link your own custom domain (e.g. yourclub.com.au) to your itsfootball.club website for free, with custom club crest, colors, and branding.',
  },
  {
    q: 'How does itsfootball.club compare to Pitchero, Spond, or Stack Team App?',
    a: 'Unlike Pitchero (which charges £38–£99/mo and limits free clubs to 1 team) or Stack Team App (which charges $4.99–$9.99/mo per team to remove ads), itsfootball.club is completely free, ad-free, and includes an open public website and live match centre.',
  },
  {
    q: 'How does matchday live scoring work on mobile?',
    a: 'Club coaches or volunteers open the Match Centre on their phone at the touchline to record goals, assists, yellow/red cards, and substitutions. Scores and stats update on the public match page in real time.',
  },
  {
    q: 'How do online membership payments and registrations work?',
    a: 'Clubs connect their own Stripe account to collect annual registration fees, tournament entry fees, and merchandise sales. A transparent card booking fee is paid by the payer at checkout, ensuring the club receives 100% of its fees.',
  },
];

function clubRef(club: ClubMetadataRow): Json {
  return { '@type': ['SportsClub', 'SportsOrganization', 'SportsTeam'], '@id': clubId(club), name: club.name, url: clubUrl(club) };
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

/** Club homepage: the club (SportsClub / SportsOrganization) plus news postings and match fixtures */
function clubNode(club: ClubMetadataRow) {
  const logo = absUrl(club.logo_url);
  return {
    '@type': ['SportsClub', 'SportsOrganization', 'SportsTeam'],
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
  };
}

export function clubSchema(
  club: ClubMetadataRow,
  news: NewsMetadataRow[] = [],
  matches: MatchMetadataRow[] = []
) {
  return graph(
    clubNode(club),
    ...news.map(article => articleNode(club, article)),
    ...matches.map(m => matchNode(club, m))
  );
}

/** A club's /about page: about the club itself */
export function clubAboutSchema(club: ClubMetadataRow) {
  return graph(
    { '@type': 'AboutPage', url: `${clubUrl(club)}/about`, name: `About ${club.name}`, mainEntity: { '@id': clubId(club) } },
    clubNode(club),
  );
}

/** A club's /shop: one Product per item on sale, sold (and collected) from the club */
export function clubShopSchema(club: ClubMetadataRow, products: ShopProductRow[], currency: string) {
  if (!products.length) return null;
  const url = `${clubUrl(club)}/shop`;
  return graph(
    clubNode(club),
    ...products.map(p => ({
      '@type': 'Product',
      name: p.name,
      description: p.description || undefined,
      image: p.photos.map(absUrl).filter(Boolean),
      url,
      brand: { '@type': 'Brand', name: club.name },
      offers: {
        '@type': 'Offer',
        price: (p.price_cents / 100).toFixed(2),
        priceCurrency: currency,
        availability: 'https://schema.org/InStock',
        url,
        seller: { '@id': clubId(club) },
      },
    })),
  );
}

/** /clubs: the directory as a list of club sites */
export function clubsDirectorySchema(clubs: ClubMetadataRow[]) {
  return graph({
    '@type': 'CollectionPage',
    url: abs('/clubs'),
    name: 'Football Clubs Directory',
    isPartOf: { '@id': WEBSITE_ID },
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: clubs.length,
      itemListElement: clubs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, url: clubUrl(c) })),
    },
  });
}

/** Step-by-step instructions shown on a page (each step's name and text as displayed there) */
export function howToSchema(name: string, path: string, steps: { name: string; text: string }[]) {
  return graph({
    '@type': 'HowTo',
    name,
    url: abs(path),
    step: steps.map((s, i) => ({ '@type': 'HowToStep', position: i + 1, name: s.name, text: s.text })),
  });
}

const MATCH_STATUS: Record<string, string> = {
  postponed: 'https://schema.org/EventPostponed',
  cancelled: 'https://schema.org/EventCancelled',
  canceled: 'https://schema.org/EventCancelled',
};

/** Combines match date and local kick-off time into ISO 8601 strings with timezone offset and calculates match end time */
export function matchIsoDates(matchDate: string, matchTime?: string | null): { startDate: string; endDate: string } {
  const d = new Date(matchDate);
  if (isNaN(d.getTime())) return { startDate: matchDate, endDate: matchDate };
  const timeParts = matchTime?.match(/^(\d{1,2}):(\d{2})$/);
  if (timeParts && d.getUTCHours() === 0 && d.getUTCMinutes() === 0) {
    const year = d.getUTCFullYear();
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    const hours = Number(timeParts[1]);
    const mins = Number(timeParts[2]);

    // Australia/Sydney timezone offset (AEST +10:00 or AEDT +11:00)
    const testDate = new Date(`${year}-${month}-${day}T12:00:00Z`);
    const offsetPart = new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Sydney', timeZoneName: 'shortOffset' })
      .formatToParts(testDate)
      .find(p => p.type === 'timeZoneName')?.value;
    const offsetMatch = offsetPart?.match(/GMT([+-]\d+)/);
    const offsetHours = offsetMatch ? Number(offsetMatch[1]) : 11;
    const offsetStr = `${offsetHours >= 0 ? '+' : '-'}${String(Math.abs(offsetHours)).padStart(2, '0')}:00`;

    const startIso = `${year}-${month}-${day}T${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:00${offsetStr}`;
    const totalMinutes = hours * 60 + mins + 105; // 90 min match + 15 min halftime
    const endH = Math.floor(totalMinutes / 60) % 24;
    const endM = totalMinutes % 60;
    const endIso = `${year}-${month}-${day}T${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}:00${offsetStr}`;
    return { startDate: startIso, endDate: endIso };
  }
  const startIso = d.toISOString();
  const endIso = new Date(d.getTime() + 105 * 60 * 1000).toISOString();
  return { startDate: startIso, endDate: endIso };
}

/** SportsEvent node for a live or scheduled match fixture */
export function matchNode(club: ClubMetadataRow, match: MatchMetadataRow, ground?: GroundRow | null): Json {
  const clubIsHome = match.is_club_home !== false;
  const team = (name: string, logo: string | null, isClub: boolean): Json =>
    isClub ? { ...clubRef(club), logo: absUrl(logo) || absUrl(club.logo_url) } : { '@type': 'SportsTeam', name, logo: absUrl(logo) };
  const home = team(match.home_team_name, match.home_team_logo, clubIsHome);
  const away = team(match.away_team_name, match.away_team_logo, !clubIsHome);
  const played = ['completed', 'full_time', 'live', 'halftime'].includes(match.status);
  const isLive = match.status === 'live' || match.status === 'halftime';
  const venue = match.venue || club.stadium_name;

  const { startDate, endDate } = matchIsoDates(match.match_date, match.match_time);

  let locationNode: Json | undefined = undefined;
  if (ground) {
    locationNode = {
      '@type': 'Place',
      '@id': abs(`${groundPath(ground)}#place`),
      name: ground.name,
      url: abs(groundPath(ground)),
      address: {
        '@type': 'PostalAddress',
        ...(ground.address ? { streetAddress: ground.address } : {}),
        addressLocality: ground.suburb,
        addressRegion: ground.state,
        ...(ground.postcode ? { postalCode: ground.postcode } : {}),
        addressCountry: 'AU',
      },
      ...(ground.lat != null && ground.lng != null ? {
        geo: {
          '@type': 'GeoCoordinates',
          latitude: ground.lat,
          longitude: ground.lng,
        },
      } : {}),
    };
  } else if (venue) {
    locationNode = {
      '@type': 'Place',
      name: venue,
      address: club.stadium_address ? {
        '@type': 'PostalAddress',
        streetAddress: club.stadium_address,
        addressCountry: 'AU',
      } : venue,
    };
  }

  return {
    '@type': 'SportsEvent',
    '@id': abs(`/${club.slug}/match/${match.id}#event`),
    url: abs(`/${club.slug}/match/${match.id}`),
    name: `${match.home_team_name} vs ${match.away_team_name}`,
    description: played && !match.score_hidden
      ? `${isLive ? 'LIVE: ' : ''}${match.home_team_name} ${match.home_score}-${match.away_score} ${match.away_team_name}${match.competition ? ` (${match.competition})` : ''}`
      : `${match.home_team_name} vs ${match.away_team_name}${match.competition ? `, ${match.competition}` : ''}`,
    sport: 'Soccer',
    startDate,
    endDate,
    eventStatus: MATCH_STATUS[match.status] || 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    location: locationNode,
    homeTeam: home,
    awayTeam: away,
    competitor: [home, away],
    organizer: clubRef(club),
    image: absUrl(club.banner_url) || absUrl(club.logo_url),
    superEvent: match.competition ? { '@type': 'SportsEvent', name: match.competition } : undefined,
  };
}

/** A fixture: both teams, kick-off, venue, and the live/final score in the description */
export function matchSchema(club: ClubMetadataRow, match: MatchMetadataRow, ground?: GroundRow | null) {
  return graph(matchNode(club, match, ground));
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
    image: absUrl(event.flyer_url) || absUrl(club.banner_url) || absUrl(club.logo_url),
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

/** A public tournament page (/tournaments/{slug}): the event, its organiser, and a breadcrumb */
export function publicTournamentSchema(club: ClubMetadataRow, tournament: EventTournamentRow, summary: string) {
  const url = abs(`/tournaments/${club.slug}`);
  const organiser = club.config?.organiser;
  const place = (name?: string | null) => (name ? { '@type': 'Place', name, address: name } : undefined);
  const team = (name: string) => ({ '@type': 'SportsTeam', name, sport: 'Soccer' });
  return graph(
    {
      '@type': 'SportsEvent',
      '@id': `${url}#event`,
      url,
      name: tournament.name,
      // The answer-first summary (format, teams, venue, result so far) unless the organiser wrote their own
      description: tournament.description || summary,
      sport: 'Soccer',
      startDate: tournament.start_date,
      endDate: tournament.end_date,
      eventStatus: tournament.status === 'cancelled' ? 'https://schema.org/EventCancelled' : 'https://schema.org/EventScheduled',
      eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
      isAccessibleForFree: true,
      location: place(tournament.venue),
      organizer: organiser ? { '@type': 'Organization', name: organiser } : undefined,
      image: absUrl(tournament.banner_url),
      competitor: tournament.team_names.map(team),
      // Each fixture with its teams, kick-off and (once played) score; the bracket's TBD slots are left out
      subEvent: tournament.matches
        .filter(m => m.home_team_name !== 'TBD' && m.away_team_name !== 'TBD')
        .slice(0, 80)
        .map(m => ({
          '@type': 'SportsEvent',
          name: `${m.home_team_name} vs ${m.away_team_name}`,
          description: isPlayed(m) ? `${m.home_team_name} ${m.home_score ?? 0}-${m.away_score ?? 0} ${m.away_team_name}` : undefined,
          sport: 'Soccer',
          startDate: m.match_date,
          eventStatus: MATCH_STATUS[m.status] || 'https://schema.org/EventScheduled',
          eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
          location: place(m.venue || tournament.venue),
          homeTeam: team(m.home_team_name),
          awayTeam: team(m.away_team_name),
        })),
      mainEntityOfPage: { '@id': `${url}#page` },
    },
    {
      '@type': 'WebPage',
      '@id': `${url}#page`,
      url,
      name: `${tournament.name} fixtures, table and bracket`,
      isPartOf: { '@id': WEBSITE_ID },
      about: { '@id': `${url}#event` },
      inLanguage: 'en-AU',
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: SITE_NAME, item: SITE_URL },
        { '@type': 'ListItem', position: 2, name: 'Tournament maker', item: abs('/tools/tournament-maker') },
        { '@type': 'ListItem', position: 3, name: tournament.name, item: url },
      ],
    }
  );
}
