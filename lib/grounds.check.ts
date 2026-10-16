// Self-check for the grounds directory helpers.
// Run: npx esbuild lib/grounds.check.ts --bundle --platform=node --log-level=warning | node
import assert from 'node:assert/strict';
import { areaName, matchFromAttributes } from './council-lookup';
import { COUNCILS } from './councils';
import {
  cleanGroundInput, cleanSuggestion, factCount, groundForMatch, groundPath, mergeFixtures, pitchAnchor, venueText, groundQuestions, groundSitemapEntries, groundSummary, isIndexableGround,
  parseLatLng, pitchSummary, slugify, venueMatchesGround, type GroundRow,
} from './grounds';

// Slugs
assert.equal(slugify('Craik Park'), 'craik-park');
assert.equal(slugify("St Mary's  Oval & Reserve"), 'st-marys-oval-and-reserve');
assert.equal(slugify('Café Park'), 'cafe-park');
assert.equal(slugify('  --  '), '');

// Map pins from pasted links
assert.deepEqual(parseLatLng('https://www.google.com/maps/place/Craik+Park/@-33.9312,150.8121,17z/data=!3m1'), { lat: -33.9312, lng: 150.8121 });
assert.deepEqual(parseLatLng('https://www.google.com/maps/place/X/data=!4m6!3m5!1s0x0:0x0!8m2!3d-33.93123!4d150.81234'), { lat: -33.93123, lng: 150.81234 });
assert.deepEqual(parseLatLng('https://maps.google.com/?q=-33.9,150.8'), { lat: -33.9, lng: 150.8 });
assert.deepEqual(parseLatLng('https://maps.apple.com/?ll=-33.9,150.8&q=Pin'), { lat: -33.9, lng: 150.8 });
assert.deepEqual(parseLatLng('https://www.openstreetmap.org/#map=17/-33.93/150.81'), { lat: -33.93, lng: 150.81 });
assert.deepEqual(parseLatLng(' -33.93, 150.80 '), { lat: -33.93, lng: 150.8 });
assert.equal(parseLatLng('https://www.google.com/maps/@51.5,-0.12,15z'), null); // London: not Australia
assert.equal(parseLatLng('Craik Park'), null);

// Venue text naming the ground
assert.ok(venueMatchesGround('Craik Park', 'Craik Park'));
assert.ok(venueMatchesGround('Craik Park, Field 2', 'Craik Park'));
assert.ok(venueMatchesGround('Pitch 3 - Craik Park', 'Craik Park'));
assert.ok(!venueMatchesGround('Craik Parkway Reserve', 'Craik Park'));
assert.ok(!venueMatchesGround('', 'Craik Park'));

const base: GroundRow = {
  id: 'g1', steward_club_id: 'c1', name: 'Craik Park', slug: 'craik-park', suburb: 'Austral', suburb_slug: 'austral', state: 'NSW',
  postcode: '2179', address: 'Fifteenth Avenue', lat: -33.93, lng: 150.81, council_key: 'liverpool', council_name: null,
  pitches: [{ label: 'Pitch 1', surface: 'Grass', size: 'Full size' }, { label: 'Pitch 2', surface: 'Grass' }, { label: 'Pitch 3', surface: 'Grass' }],
  parking: 'Free car park off Fifteenth Avenue.', toilets: 'By Pitch 1.', canteen: null, accessibility: null, notes: null,
  is_published: true, previous_paths: [], facts_checked_at: '2026-10-12T00:00:00Z', updated_at: '2026-10-12T00:00:00Z',
};

assert.equal(groundPath(base), '/grounds/austral/craik-park');
assert.equal(pitchSummary(base.pitches), '3 grass pitches');
assert.equal(pitchSummary([{ label: 'A', surface: 'Grass' }, { label: 'B', surface: 'Synthetic' }]), '2 pitches');
assert.equal(pitchSummary([{ label: 'A' }]), '1 pitch');
assert.equal(factCount(base), 3);

// The answer-first summary only states what was entered
assert.equal(
  groundSummary(base, [{ name: 'Austral FC' }]),
  'Craik Park is a soccer ground in Austral, NSW (Liverpool City Council) with 3 grass pitches, parking and toilets. Home ground of Austral FC.'
);
assert.equal(groundSummary({ ...base, pitches: [], parking: null, toilets: null, council_key: null }), 'Craik Park is a soccer ground in Austral, NSW.');

// Indexing rule: pin, council, 3 facts, a club using it
assert.ok(isIndexableGround(base, 1));
assert.ok(!isIndexableGround(base, 0));
assert.ok(!isIndexableGround({ ...base, lat: null }, 1));
assert.ok(!isIndexableGround({ ...base, council_key: null }, 1));
assert.ok(isIndexableGround({ ...base, council_key: 'other', council_name: 'Wollondilly Shire Council' }, 1));
assert.ok(!isIndexableGround({ ...base, council_key: 'other', council_name: '' }, 1));
assert.ok(!isIndexableGround({ ...base, toilets: null }, 1));

// FAQ: only questions the facts answer
const qs = groundQuestions(base).map(q => q.q);
assert.deepEqual(qs, ['Is Craik Park open today?', 'Where do I park at Craik Park?', 'Are there toilets and a canteen at Craik Park?', 'How many pitches are at Craik Park?']);
assert.ok(groundQuestions(base)[0].a.includes('Liverpool City Council'));
assert.deepEqual(groundQuestions({ ...base, parking: null, toilets: null, pitches: [] }).map(q => q.q), ['Is Craik Park open today?']);

// Sitemap: indexable grounds; suburb pages with 2+; the directory with 3+
const g2 = { ...base, id: 'g2', name: 'Austral Oval', slug: 'austral-oval' };
const g3 = { ...base, id: 'g3', name: 'Jamison Park', slug: 'jamison-park', suburb: 'South Penrith', suburb_slug: 'south-penrith', council_key: 'penrith' };
const thin = { ...base, id: 'g4', name: 'Thin Park', slug: 'thin-park', parking: null, toilets: null };
const use = new Map([['g1', 1], ['g2', 1], ['g3', 1], ['g4', 1]]);
const paths = groundSitemapEntries([base, g2, g3, thin], use).map(e => e.path);
assert.deepEqual(paths, ['/grounds', '/grounds/austral', '/grounds/austral/craik-park', '/grounds/austral/austral-oval', '/grounds/south-penrith/jamison-park']);
assert.deepEqual(groundSitemapEntries([base, thin], use).map(e => e.path), ['/grounds/austral/craik-park']);
assert.deepEqual(groundSitemapEntries([thin], use), []);

// Admin input
const ok = cleanGroundInput({ name: ' Craik  Park ', suburb: 'Austral', state: 'nsw', postcode: '2179', pin: 'https://maps.google.com/?q=-33.9,150.8', council_key: 'liverpool', pitches: [{ label: 'Pitch 1', surface: 'Grass', lights: true }, { label: '' }], parking: '<b>Free</b> car park' });
assert.ok('row' in ok);
if ('row' in ok) {
  assert.equal(ok.row.name, 'Craik Park');
  assert.equal(ok.row.slug, 'craik-park');
  assert.equal(ok.row.state, 'NSW');
  assert.equal(ok.row.lat, -33.9);
  assert.deepEqual(ok.row.pitches, [{ label: 'Pitch 1', surface: 'Grass', lights: true }]);
  assert.equal(ok.row.parking, 'Free car park');
  assert.equal(ok.row.council_name, null);
}
assert.ok('error' in cleanGroundInput({ name: 'X', suburb: 'Austral', state: 'NSW' }));
assert.ok('error' in cleanGroundInput({ name: 'Craik Park', suburb: 'Austral', state: 'XX' }));
assert.ok('error' in cleanGroundInput({ name: 'Craik Park', suburb: 'Austral', state: 'NSW', postcode: '21' }));
assert.ok('error' in cleanGroundInput({ name: 'Craik Park', suburb: 'Austral', state: 'NSW', pin: 'not a link' }));
assert.ok('error' in cleanGroundInput({ name: 'Craik Park', suburb: 'Austral', state: 'NSW', council_key: 'made-up' }));

// Council from a map pin (ABS LGA attributes)
assert.deepEqual(matchFromAttributes({ lga_code_2021: '14900', lga_name_2021: 'Liverpool', state_name_2021: 'New South Wales' }), { key: 'liverpool', name: 'Liverpool City Council', lgaCode: '14900', state: 'NSW' });
assert.deepEqual(matchFromAttributes({ lga_code_2021: '18400', lga_name_2021: 'Wollondilly', state_name_2021: 'New South Wales' }), { key: 'other', name: 'Wollondilly council area', lgaCode: '18400', state: 'NSW' });
assert.equal(areaName('Campbelltown (NSW)'), 'Campbelltown council area');
assert.equal(areaName('Latrobe (Vic.)'), 'Latrobe council area');
assert.equal(matchFromAttributes({ lga_code_2021: '19499', lga_name_2021: 'No usual address (NSW)' }), null);
assert.equal(matchFromAttributes(undefined), null);
// Every listed council has a unique 5-digit ABS code and an https link
assert.equal(new Set(COUNCILS.map(c => c.lgaCode)).size, COUNCILS.length);
assert.ok(COUNCILS.every(c => /^\d{5}$/.test(c.lgaCode) && c.url.startsWith('https://')));

// Phase 2: fixtures linked to a ground
assert.equal(venueText('Craik Park', 'Pitch 2'), 'Craik Park, Pitch 2');
assert.equal(venueText('Craik Park', ''), 'Craik Park');
assert.ok(venueMatchesGround(venueText('Craik Park', 'Pitch 2'), 'Craik Park'));
assert.equal(pitchAnchor('Pitch 2 (Mini)'), 'pitch-pitch-2-mini');
const fx = (id: string, date: string, pitch?: string) => ({ id, clubSlug: 'austral', home: 'A', away: 'B', date, status: 'upcoming', homeScore: null, awayScore: null, competition: null, ...(pitch ? { pitch } : {}) });
const merged = mergeFixtures([fx('m1', '2026-10-01T00:00:00Z', 'Pitch 2'), fx('m3', '2026-10-20T00:00:00Z')], [fx('m1', '2026-10-01T00:00:00Z'), fx('m2', '2026-10-10T00:00:00Z')]);
assert.deepEqual(merged.map(f => f.id), ['m3', 'm2', 'm1']);
assert.equal(merged[2].pitch, 'Pitch 2'); // the linked copy (with its pitch) wins
assert.equal(mergeFixtures([fx('a', '2026-10-01T00:00:00Z')], [fx('b', '2026-10-02T00:00:00Z')], 1).length, 1);

// "Getting there": the linked ground, else the home ground when the venue names it
assert.equal(groundForMatch({ ground_id: 'g1', is_club_home: false, venue: 'Anywhere' }, base, null)?.id, 'g1');
assert.equal(groundForMatch({ ground_id: 'g1', is_club_home: true, venue: 'Craik Park' }, { ...base, is_published: false }, base), null);
assert.equal(groundForMatch({ ground_id: 'gX', is_club_home: true, venue: 'Craik Park' }, base, base), null);
assert.equal(groundForMatch({ is_club_home: true, venue: 'Craik Park, Field 2' }, null, base)?.id, 'g1');
assert.equal(groundForMatch({ is_club_home: true, venue: 'Jamison Park' }, null, base), null);
assert.equal(groundForMatch({ is_club_home: false, venue: 'Craik Park' }, null, base), null); // away: we don't know their ground

// Suggest an edit
const sug = cleanSuggestion({ topic: 'canteen', message: '  The canteen <b>closes</b> at 2pm  ', contact: ' sam@example.com ' });
assert.deepEqual(sug, { row: { topic: 'canteen', message: 'The canteen closes at 2pm', contact: 'sam@example.com' } });
assert.deepEqual(cleanSuggestion({ topic: 'made-up', message: 'Gate is on Fifth Ave' }), { row: { topic: 'other', message: 'Gate is on Fifth Ave', contact: null } });
assert.ok('error' in cleanSuggestion({ message: 'hi' }));
assert.ok('error' in cleanSuggestion({ message: 42 }));
const long = cleanSuggestion({ message: 'x'.repeat(5000) });
assert.ok('row' in long && long.row.message.length === 1000);

console.log('grounds.check: ok');
