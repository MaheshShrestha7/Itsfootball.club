// The public grounds directory: /grounds, /grounds/{suburb} and /grounds/{suburb}/{ground}.
// Ground facts (pins, pitches, parking, toilets, canteen) are public once a ground is saved; a club's
// name and fixtures only appear when the club has opted in (clubs.grounds_directory_listed).
// See migration 20261109_grounds.sql and /mnt/project-files/plans/grounds-directory-proposal.md.
import { SITE_URL } from './slugs';
import { COUNCILS, councilByKey, stateName, type AuState, type Council } from './councils';

export const GROUNDS_PATH = '/grounds';

export interface Pitch {
  label: string;
  surface?: string;
  size?: string;
  lights?: boolean;
}

export interface GroundRow {
  id: string;
  steward_club_id: string | null;
  name: string;
  slug: string;
  suburb: string;
  suburb_slug: string;
  state: AuState;
  postcode: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  council_key: string | null;
  council_name: string | null;
  pitches: Pitch[] | null;
  parking: string | null;
  toilets: string | null;
  canteen: string | null;
  accessibility: string | null;
  notes: string | null;
  is_published: boolean;
  previous_paths: string[] | null;
  facts_checked_at: string;
  updated_at: string;
}

/** A club shown on a ground page: only clubs that opted in */
export interface GroundClub {
  id: string;
  slug: string;
  name: string;
  short_name: string;
  logo_url: string | null;
  primary_color: string | null;
}

export interface GroundFixture {
  id: string;
  clubSlug: string;
  home: string;
  away: string;
  date: string;
  status: string;
  homeScore: number | null;
  awayScore: number | null;
  competition: string | null;
  /** The pitch, when the fixture was linked to the ground with one */
  pitch?: string | null;
}

/** 'Craik Park' -> 'craik-park'; accents dropped, '&' read as 'and' */
export function slugify(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90)
    .replace(/-+$/, '');
}

export const groundPath = (g: Pick<GroundRow, 'suburb_slug' | 'slug'>) => `${GROUNDS_PATH}/${g.suburb_slug}/${g.slug}`;
export const suburbPath = (suburbSlug: string) => `${GROUNDS_PATH}/${suburbSlug}`;

const clean = (s: string | null | undefined) => (s || '').trim();

/** The council's display name ('other' councils carry their own) */
export function councilName(g: Pick<GroundRow, 'council_key' | 'council_name'>): string {
  return councilByKey(g.council_key)?.name || (g.council_key === 'other' ? clean(g.council_name) : '');
}

export const groundCouncil = (g: Pick<GroundRow, 'council_key'>): Council | undefined => councilByKey(g.council_key);

/** The facts that make a ground page worth reading, for the indexing rule */
export function factCount(g: GroundRow): number {
  return [
    (g.pitches || []).length > 0,
    !!clean(g.parking),
    !!clean(g.toilets),
    !!clean(g.canteen),
    !!clean(g.accessibility),
  ].filter(Boolean).length;
}

export const MIN_INDEXABLE_FACTS = 3;
/** The directory is a list; it's worth indexing once it lists this many real ground guides */
export const MIN_INDEXABLE_DIRECTORY = 3;
/** A suburb page is a list; with one ground it adds nothing over the ground page itself */
export const MIN_INDEXABLE_SUBURB_GROUNDS = 2;

/**
 * Whether search engines may index a ground page: a map pin, a council (so the wet-weather link
 * works), at least three facts, and a club actually using it. Anything less is a thin page, the
 * problem the 2026-10-14 SEO audit found with empty club pages. The page still works for visitors.
 */
export function isIndexableGround(g: GroundRow, clubsUsing: number): boolean {
  return g.is_published && g.lat != null && g.lng != null && !!councilName(g) && factCount(g) >= MIN_INDEXABLE_FACTS && clubsUsing > 0;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** '3 grass pitches', '2 pitches (1 synthetic)' */
export function pitchSummary(pitches: Pitch[] | null | undefined): string {
  const list = pitches || [];
  if (!list.length) return '';
  const surfaces = [...new Set(list.map(p => clean(p.surface).toLowerCase()).filter(Boolean))];
  if (surfaces.length === 1 && list.every(p => clean(p.surface))) return `${plural(list.length, `${surfaces[0]} pitch`, `${surfaces[0]} pitches`)}`;
  return plural(list.length, 'pitch', 'pitches');
}

/** Short facts for a list card: '3 grass pitches · parking · canteen' */
export function factTags(g: GroundRow): string {
  return [pitchSummary(g.pitches), clean(g.parking) && 'parking', clean(g.toilets) && 'toilets', clean(g.canteen) && 'canteen']
    .filter(Boolean)
    .join(' · ');
}

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const listJoin = (items: string[]) => (items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`);

/**
 * The answer-first summary (what search snippets and AI answers quote), built only from facts that
 * were entered: 'Craik Park is a soccer ground in Austral, NSW (Liverpool City Council) with 3 grass
 * pitches, parking, toilets and a canteen. Home ground of Austral FC.'
 */
export function groundSummary(g: GroundRow, homeClubs: Pick<GroundClub, 'name'>[] = []): string {
  const council = councilName(g);
  const has = [
    pitchSummary(g.pitches),
    clean(g.parking) && 'parking',
    clean(g.toilets) && 'toilets',
    clean(g.canteen) && 'a canteen',
  ].filter(Boolean) as string[];
  const where = `${g.suburb}, ${g.state}${council ? ` (${council})` : ''}`;
  const first = `${g.name} is a soccer ground in ${where}${has.length ? ` with ${listJoin(has)}` : ''}.`;
  const home = homeClubs.length ? ` Home ground of ${listJoin(homeClubs.map(c => c.name))}.` : '';
  return first + home;
}

/** One-line answer to 'is it open today', from the council's own status page */
export function wetWeatherAnswer(g: GroundRow): string {
  const council = groundCouncil(g);
  if (council) {
    return `${council.name} decides when its sportsgrounds close after rain. ${council.note} Your club or association will also tell you if a match is called off.`;
  }
  const name = councilName(g);
  return `${name || 'The local council'} decides when its grounds close after rain. Check with your club or association before you travel, as they are told about closures and call matches off.`;
}

export interface GroundQuestion { q: string; a: string }

/** FAQ entries, only for questions the ground's facts actually answer */
export function groundQuestions(g: GroundRow): GroundQuestion[] {
  const out: GroundQuestion[] = [{ q: `Is ${g.name} open today?`, a: wetWeatherAnswer(g) }];
  if (clean(g.parking)) out.push({ q: `Where do I park at ${g.name}?`, a: clean(g.parking) });
  if (clean(g.toilets) || clean(g.canteen)) {
    const parts = [clean(g.toilets) && `Toilets: ${lowerFirst(clean(g.toilets))}`, clean(g.canteen) && `Canteen: ${lowerFirst(clean(g.canteen))}`].filter(Boolean);
    out.push({ q: `Are there toilets and a canteen at ${g.name}?`, a: parts.map(p => (/[.!?]$/.test(p as string) ? p : `${p}.`)).join(' ') });
  }
  if ((g.pitches || []).length) {
    out.push({
      q: `How many pitches are at ${g.name}?`,
      a: `${g.name} has ${pitchSummary(g.pitches)}: ${(g.pitches || []).map(p => [p.label, clean(p.size)].filter(Boolean).join(', ')).join('; ')}.`,
    });
  }
  if (clean(g.accessibility)) out.push({ q: `Is ${g.name} accessible?`, a: clean(g.accessibility) });
  return out;
}

export const directionsUrl = (g: GroundRow) =>
  g.lat != null && g.lng != null
    ? `https://www.google.com/maps/dir/?api=1&destination=${g.lat},${g.lng}`
    : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent([g.name, g.address, g.suburb, g.state].filter(Boolean).join(', '))}`;

export const mapEmbedUrl = (g: GroundRow) =>
  g.lat != null && g.lng != null
    ? `https://www.google.com/maps?q=${g.lat},${g.lng}&z=16&output=embed`
    : `https://www.google.com/maps?q=${encodeURIComponent([g.name, g.address, g.suburb, g.state].filter(Boolean).join(', '))}&output=embed`;

export const mapLink = (g: GroundRow) =>
  g.lat != null && g.lng != null ? `https://www.google.com/maps/search/?api=1&query=${g.lat},${g.lng}` : directionsUrl(g);

/**
 * Reads a pin from a pasted Google Maps (or Apple Maps / OpenStreetMap) link or a typed
 * '-33.93, 150.80'. Returns null when there's no Australian latitude/longitude in it.
 */
export function parseLatLng(input: string): { lat: number; lng: number } | null {
  const text = decodeURIComponent((input || '').trim());
  const patterns = [
    /@(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/, // google.com/maps/place/...@-33.9,150.8,17z
    /!3d(-?\d{1,2}\.\d+)!4d(-?\d{1,3}\.\d+)/, // google data params
    /[?&](?:q|query|ll|destination|daddr)=(-?\d{1,2}\.\d+),\s*(-?\d{1,3}\.\d+)/, // ?q=-33.9,150.8 (also Apple Maps ll=)
    /[#&]map=\d+\/(-?\d{1,2}\.\d+)\/(-?\d{1,3}\.\d+)/, // openstreetmap.org/#map=17/-33.9/150.8
    /^(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)$/, // typed
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (!m) continue;
    const lat = Number(m[1]);
    const lng = Number(m[2]);
    if (lat >= -44 && lat <= -9 && lng >= 112 && lng <= 154) return { lat: Math.round(lat * 1e6) / 1e6, lng: Math.round(lng * 1e6) / 1e6 };
  }
  return null;
}

/** Fixtures the directory may show: opted-in clubs' senior home games, 12 months back to 60 days ahead */
export const FIXTURE_DAYS_BACK = 365;
export const FIXTURE_DAYS_AHEAD = 60;

/** Whether a match's venue text names this ground ('Craik Park, Field 2' names Craik Park) */
export function venueMatchesGround(venue: string | null | undefined, groundName: string): boolean {
  const v = slugify(venue || '');
  const n = slugify(groundName);
  return !!n && (v === n || v.startsWith(`${n}-`) || v.includes(`-${n}-`) || v.endsWith(`-${n}`));
}

/** The anchor of a pitch on its ground's page: 'Pitch 2' -> 'pitch-pitch-2' */
export const pitchAnchor = (label: string) => `pitch-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;

/** What a fixture's venue reads when its ground is picked from the directory: 'Craik Park, Pitch 2' */
export const venueText = (groundName: string, pitch?: string | null) => (pitch ? `${groundName}, ${pitch}` : groundName);

/** Fixtures from both reads (linked to the ground, or naming it in the venue), once each, newest first */
export function mergeFixtures(linked: GroundFixture[], named: GroundFixture[], limit = 20): GroundFixture[] {
  const byId = new Map<string, GroundFixture>();
  for (const f of [...named, ...linked]) byId.set(f.id, { ...byId.get(f.id), ...f });
  return [...byId.values()].sort((a, b) => Date.parse(b.date) - Date.parse(a.date)).slice(0, limit);
}

/**
 * Which ground guide a match page's "Getting there" uses: the ground the fixture is linked to, else
 * (for a home fixture whose venue names it) the club's home ground. Unpublished grounds never.
 */
export function groundForMatch(
  match: { ground_id?: string | null; is_club_home: boolean; venue?: string | null },
  linked: GroundRow | null,
  home: GroundRow | null,
): GroundRow | null {
  if (match.ground_id) return linked?.id === match.ground_id && linked.is_published ? linked : null;
  if (match.is_club_home && home?.is_published && venueMatchesGround(match.venue, home.name)) return home;
  return null;
}

// "Suggest an edit" on a ground guide (table ground_suggestions, migration 20261110)
export const SUGGESTION_TOPICS = [
  { key: 'parking', label: 'Parking' },
  { key: 'pitches', label: 'Pitches' },
  { key: 'toilets', label: 'Toilets' },
  { key: 'canteen', label: 'Canteen' },
  { key: 'accessibility', label: 'Accessibility' },
  { key: 'address', label: 'Address or map pin' },
  { key: 'council', label: 'Council or wet weather' },
  { key: 'other', label: 'Something else' },
] as const;
export type SuggestionTopic = (typeof SUGGESTION_TOPICS)[number]['key'];
export const SUGGESTION_MAX = 1000;

export function cleanSuggestion(input: { topic?: unknown; message?: unknown; contact?: unknown }):
  { error: string } | { row: { topic: SuggestionTopic; message: string; contact: string | null } } {
  const topic = SUGGESTION_TOPICS.find(t => t.key === input.topic)?.key || 'other';
  const message = cut(input.message, SUGGESTION_MAX);
  if (message.length < 5) return { error: 'Tell us what needs changing.' };
  return { row: { topic, message, contact: cut(input.contact, 200) || null } };
}

/** Validates and cleans what an admin typed. Returns an error message, or the row to save. */
export interface GroundInput {
  name: string;
  suburb: string;
  state: string;
  postcode?: string;
  address?: string;
  pin?: string;
  lat?: number | null;
  lng?: number | null;
  council_key?: string;
  council_name?: string;
  pitches?: Pitch[];
  parking?: string;
  toilets?: string;
  canteen?: string;
  accessibility?: string;
  notes?: string;
}

const cut = (s: unknown, max: number) => (typeof s === 'string' ? s.replace(/<[^>]*>?/g, '').replace(/\s+/g, ' ').trim().slice(0, max) : '');
const orNull = (s: string) => (s ? s : null);

export function cleanGroundInput(input: GroundInput): { error: string } | { row: Omit<GroundRow, 'id' | 'steward_club_id' | 'is_published' | 'previous_paths' | 'facts_checked_at' | 'updated_at'> } {
  const name = cut(input.name, 120);
  const suburb = cut(input.suburb, 80);
  const state = cut(input.state, 3).toUpperCase() as AuState;
  if (name.length < 2) return { error: 'Add the ground’s name, e.g. Craik Park.' };
  if (suburb.length < 2) return { error: 'Add the suburb the ground is in.' };
  if (!['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT'].includes(state)) return { error: 'Pick the state.' };
  const postcode = cut(input.postcode, 4);
  if (postcode && !/^\d{4}$/.test(postcode)) return { error: 'The postcode should be 4 digits.' };

  let lat = typeof input.lat === 'number' && isFinite(input.lat) ? input.lat : null;
  let lng = typeof input.lng === 'number' && isFinite(input.lng) ? input.lng : null;
  if (input.pin && input.pin.trim()) {
    const p = parseLatLng(input.pin);
    if (!p) return { error: 'We couldn’t read a map pin from that link. Paste a Google Maps link to the ground, or type it as -33.93, 150.80.' };
    ({ lat, lng } = p);
  }
  if (lat != null && lng != null && !(lat >= -44 && lat <= -9 && lng >= 112 && lng <= 154)) return { error: 'That map pin isn’t in Australia.' };

  const councilKey = cut(input.council_key, 64);
  if (councilKey && councilKey !== 'other' && !COUNCILS.some(c => c.key === councilKey)) return { error: 'Pick the council from the list.' };
  const council_name = councilKey === 'other' ? cut(input.council_name, 120) : '';

  const pitches: Pitch[] = (Array.isArray(input.pitches) ? input.pitches : [])
    .slice(0, 30)
    .map(p => ({ label: cut(p?.label, 40), surface: cut(p?.surface, 30), size: cut(p?.size, 60), lights: !!p?.lights }))
    .filter(p => p.label)
    .map(p => ({ label: p.label, ...(p.surface ? { surface: p.surface } : {}), ...(p.size ? { size: p.size } : {}), ...(p.lights ? { lights: true } : {}) }));

  return {
    row: {
      name,
      slug: slugify(name),
      suburb,
      suburb_slug: slugify(suburb),
      state,
      postcode: orNull(postcode),
      address: orNull(cut(input.address, 200)),
      lat,
      lng,
      council_key: orNull(councilKey),
      council_name: orNull(council_name),
      pitches,
      parking: orNull(cut(input.parking, 400)),
      toilets: orNull(cut(input.toilets, 400)),
      canteen: orNull(cut(input.canteen, 400)),
      accessibility: orNull(cut(input.accessibility, 400)),
      notes: orNull(cut(input.notes, 600)),
    },
  };
}

/**
 * The ground pages search engines should know about, matching each page's own noindex rule: every
 * indexable ground, suburb pages with 2+ of them, and the directory once it lists 3+.
 */
export function groundSitemapEntries(grounds: GroundRow[], clubsUsing: Map<string, number>): { path: string; lastModified: string; priority: number }[] {
  const indexable = grounds.filter(g => isIndexableGround(g, clubsUsing.get(g.id) || 0));
  if (!indexable.length) return [];
  const newest = (list: GroundRow[]) => list.map(g => g.facts_checked_at).sort().slice(-1)[0];
  const bySuburb = new Map<string, GroundRow[]>();
  for (const g of indexable) bySuburb.set(g.suburb_slug, [...(bySuburb.get(g.suburb_slug) || []), g]);
  return [
    ...(indexable.length >= MIN_INDEXABLE_DIRECTORY ? [{ path: GROUNDS_PATH, lastModified: newest(indexable), priority: 0.6 }] : []),
    ...[...bySuburb.entries()]
      .filter(([, list]) => list.length >= MIN_INDEXABLE_SUBURB_GROUNDS)
      .map(([suburb, list]) => ({ path: suburbPath(suburb), lastModified: newest(list), priority: 0.5 })),
    ...indexable.map(g => ({ path: groundPath(g), lastModified: g.facts_checked_at, priority: 0.6 })),
  ];
}

// ---------- schema.org ----------

const amenity = (name: string, value: string | null) =>
  value ? { '@type': 'LocationFeatureSpecification', name, value: true, description: value } : null;

/** Place JSON-LD with the pin, amenities, pitches and fixtures, plus breadcrumbs and an FAQ */
export function groundSchema(g: GroundRow, homeClubs: GroundClub[], fixtures: GroundFixture[], questions: GroundQuestion[]) {
  const url = `${SITE_URL}${groundPath(g)}`;
  const council = councilName(g);
  const place = {
    // A plain Place (not the LocalBusiness subtype) so search engines don't expect opening hours or a phone
    '@type': 'Place',
    additionalType: 'https://schema.org/SportsActivityLocation',
    '@id': `${url}#place`,
    name: g.name,
    description: groundSummary(g, homeClubs),
    url,
    address: {
      '@type': 'PostalAddress',
      ...(g.address ? { streetAddress: g.address } : {}),
      addressLocality: g.suburb,
      addressRegion: g.state,
      ...(g.postcode ? { postalCode: g.postcode } : {}),
      addressCountry: 'AU',
    },
    ...(g.lat != null && g.lng != null ? { geo: { '@type': 'GeoCoordinates', latitude: g.lat, longitude: g.lng }, hasMap: mapLink(g) } : {}),
    ...(council ? { containedInPlace: { '@type': 'AdministrativeArea', name: council } } : {}),
    amenityFeature: [amenity('Parking', g.parking), amenity('Toilets', g.toilets), amenity('Canteen', g.canteen), amenity('Accessibility', g.accessibility)].filter(Boolean),
    ...((g.pitches || []).length
      ? { containsPlace: (g.pitches || []).map(p => ({ '@type': 'Place', name: `${g.name} ${p.label}`, description: [p.surface, p.size, p.lights ? 'floodlit' : ''].filter(Boolean).join(', ') || undefined })) }
      : {}),
    ...(fixtures.length
      ? {
          event: fixtures.slice(0, 10).map(f => ({
            '@type': 'SportsEvent',
            name: `${f.home} v ${f.away}`,
            startDate: f.date,
            sport: 'Soccer',
            url: `${SITE_URL}/${f.clubSlug}/match/${f.id}`,
            eventStatus: f.status === 'cancelled' ? 'https://schema.org/EventCancelled' : f.status === 'postponed' ? 'https://schema.org/EventPostponed' : 'https://schema.org/EventScheduled',
            location: { '@id': `${url}#place` },
            homeTeam: { '@type': 'SportsTeam', name: f.home },
            awayTeam: { '@type': 'SportsTeam', name: f.away },
          })),
        }
      : {}),
  };
  return {
    '@context': 'https://schema.org',
    '@graph': [
      place,
      {
        '@type': 'WebPage',
        '@id': `${url}#page`,
        url,
        name: `${g.name}, ${g.suburb}: parking, pitches and wet weather`,
        inLanguage: 'en-AU',
        about: { '@id': `${url}#place` },
        dateModified: g.facts_checked_at,
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Grounds', item: `${SITE_URL}${GROUNDS_PATH}` },
          { '@type': 'ListItem', position: 2, name: `${g.suburb} ${g.state}`, item: `${SITE_URL}${suburbPath(g.suburb_slug)}` },
          { '@type': 'ListItem', position: 3, name: g.name, item: url },
        ],
      },
      {
        '@type': 'FAQPage',
        mainEntity: questions.map(i => ({ '@type': 'Question', name: i.q, acceptedAnswer: { '@type': 'Answer', text: i.a } })),
      },
    ],
  };
}

/** ItemList JSON-LD for the directory and suburb pages */
export function groundListSchema(name: string, path: string, grounds: GroundRow[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name,
    url: `${SITE_URL}${path}`,
    numberOfItems: grounds.length,
    itemListElement: grounds.map((g, i) => ({ '@type': 'ListItem', position: i + 1, name: `${g.name}, ${g.suburb} ${g.state}`, url: `${SITE_URL}${groundPath(g)}` })),
  };
}

export { stateName };
