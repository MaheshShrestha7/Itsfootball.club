// Self-check for schema.org JSON-LD builders.
// Run: npx esbuild lib/schema.check.ts --bundle --platform=node --log-level=warning | node
import assert from 'node:assert/strict';
import { homeSchema, clubSchema, matchSchema, matchNode } from './schema';
import type { ClubMetadataRow, MatchMetadataRow, NewsMetadataRow } from './supabase/club-lookup';

// 1. Homepage schema: Organization and SoftwareApplication with sameAs
const home = homeSchema() as { '@context': string; '@graph': any[] };
assert.equal(home['@context'], 'https://schema.org');
const nodes = home['@graph'];

const org = nodes.find(n => n['@type'] === 'Organization');
assert.ok(org, 'Organization node must be present');
assert.ok(Array.isArray(org.sameAs), 'Organization must have sameAs array');
assert.ok(org.sameAs.includes('https://www.facebook.com/ItsFootball.Club'), 'Organization sameAs must include Facebook page');

const app = nodes.find(n => Array.isArray(n['@type']) ? n['@type'].includes('SoftwareApplication') : n['@type'] === 'SoftwareApplication');
assert.ok(app, 'SoftwareApplication node must be present');
assert.ok(Array.isArray(app.sameAs), 'SoftwareApplication must have sameAs array');
assert.ok(app.sameAs.includes('https://www.facebook.com/ItsFootball.Club'), 'SoftwareApplication sameAs must include Facebook page');

// 2. Active public club schema: SportsClub / SportsOrganization
const mockClub: ClubMetadataRow = {
  id: '00000000-0000-0000-0000-000000000001',
  name: 'Ashfield FC',
  short_name: 'Ashfield',
  motto: 'Pride & Passion',
  logo_url: 'https://example.com/logo.png',
  banner_url: 'https://example.com/banner.png',
  slug: 'ashfield-fc',
  previous_slugs: null,
  stadium_name: 'Pratten Park',
  stadium_address: 'Arthur St, Ashfield NSW',
  founded_year: 1970,
  config: null,
};

const mockNews: NewsMetadataRow[] = [
  {
    id: 'news-1',
    title: 'Ashfield wins season opener',
    slug: 'season-opener-win',
    summary: 'A great 3-1 victory to start the year.',
    cover_image_url: 'https://example.com/news.jpg',
    author_name: 'Ashfield Media',
    tags: ['First Grade'],
    published_at: '2026-03-01T10:00:00Z',
  },
];

const mockLiveMatch: MatchMetadataRow = {
  id: 'match-live-1',
  club_id: mockClub.id,
  home_team_name: 'Ashfield FC',
  away_team_name: 'Burwood FC',
  home_score: 2,
  away_score: 1,
  status: 'live',
  competition: 'Premier League',
  match_date: '2026-10-18T15:00:00Z',
  venue: 'Pratten Park',
  is_club_home: true,
  home_team_logo: null,
  away_team_logo: null,
  score_hidden: false,
};

const clubData = clubSchema(mockClub, mockNews, [mockLiveMatch]) as { '@context': string; '@graph': any[] };
assert.equal(clubData['@context'], 'https://schema.org');

const clubEntity = clubData['@graph'].find(n => n.name === 'Ashfield FC' && Array.isArray(n['@type']));
assert.ok(clubEntity, 'Club entity node must exist');
assert.ok(clubEntity['@type'].includes('SportsClub'), 'Club must include SportsClub in @type');
assert.ok(clubEntity['@type'].includes('SportsOrganization'), 'Club must include SportsOrganization in @type');

// 3. SportsEvent on live match fixtures
const liveMatchEvent = clubData['@graph'].find(n => n['@type'] === 'SportsEvent' && n.name === 'Ashfield FC vs Burwood FC');
assert.ok(liveMatchEvent, 'SportsEvent schema must be emitted for live match fixture');
assert.equal(liveMatchEvent.sport, 'Soccer');
assert.ok(liveMatchEvent.description.startsWith('LIVE: 2-1') || liveMatchEvent.description.includes('LIVE: Ashfield FC 2-1 Burwood FC'), `Description should indicate live match: ${liveMatchEvent.description}`);
assert.equal(liveMatchEvent.eventStatus, 'https://schema.org/EventScheduled');
assert.ok(Array.isArray(liveMatchEvent.organizer['@type']) && liveMatchEvent.organizer['@type'].includes('SportsClub'), 'Match organizer must be SportsClub');

// 4. Match schema standalone
const standaloneMatch = matchSchema(mockClub, mockLiveMatch) as { '@context': string; '@graph': any[] };
const standaloneEvent = standaloneMatch['@graph'][0];
assert.equal(standaloneEvent['@type'], 'SportsEvent');
assert.ok(standaloneEvent.description.includes('LIVE:'));

// 5. Match with score hidden (junior rules)
const mockJuniorMatch: MatchMetadataRow = {
  ...mockLiveMatch,
  id: 'match-junior-1',
  score_hidden: true,
};
const juniorNode = matchNode(mockClub, mockJuniorMatch);
const desc = String(juniorNode.description || '');
assert.ok(!desc.includes('2-1'), 'Hidden score must not leak score into description');

// 6. Competitor comparison routes & data validation
import { COMPETITORS, competitorBySlugOrAlternative, ALL_COMPARE_SLUGS } from './competitors';
assert.ok(ALL_COMPARE_SLUGS.includes('pitchero-alternative'), 'pitchero-alternative slug must exist');
assert.ok(ALL_COMPARE_SLUGS.includes('spond-alternative'), 'spond-alternative slug must exist');
assert.ok(ALL_COMPARE_SLUGS.includes('teamapp-alternative'), 'teamapp-alternative slug must exist');

for (const slug of ['pitchero', 'pitchero-alternative', 'spond', 'spond-alternative', 'teamapp', 'teamapp-alternative']) {
  const comp = competitorBySlugOrAlternative(slug);
  assert.ok(comp, `Slug ${slug} must resolve to a valid competitor`);
  assert.ok(comp.aiOverview && comp.aiOverview.length > 50, `${comp.name} must have an AEO aiOverview`);
  assert.ok(comp.keyTakeaways && comp.keyTakeaways.length >= 3, `${comp.name} must have key takeaways`);
  assert.ok(comp.faqs && comp.faqs.length >= 2, `${comp.name} must have FAQs`);
  assert.ok(comp.rows.length >= 5, `${comp.name} must have comparison rows`);
}

console.log('schema checks passed');

