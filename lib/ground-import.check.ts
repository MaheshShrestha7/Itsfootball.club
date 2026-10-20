// Self-check for "Import from map" (lib/ground-import.ts), with a made-up Overpass response.
// Run: npx esbuild lib/ground-import.check.ts --bundle --platform=node --log-level=warning | node
import assert from 'node:assert/strict';
import { absPlaceName, buildCandidates, findExisting, inRings, metres, overpassQuery, pitchesLine, ringsBbox, type OsmElement } from './ground-import';
import { slugify } from './grounds';

const square = (lng: number, lat: number, d: number) => [[lng - d, lat - d], [lng + d, lat - d], [lng + d, lat + d], [lng - d, lat + d], [lng - d, lat - d]];
const way = (id: number, tags: Record<string, string>, ring: number[][]): OsmElement =>
  ({ type: 'way', id, tags, geometry: ring.map(([lon, lat]) => ({ lat, lon })) });
const pitch = (id: number, lat: number, lon: number, tags: Record<string, string> = {}): OsmElement =>
  ({ type: 'way', id, tags: { leisure: 'pitch', sport: 'soccer', ...tags }, center: { lat, lon } });

// Point in polygon, holes included
const council = [square(150.8, -33.9, 0.1)];
assert.equal(inRings(150.8, -33.9, council), true);
assert.equal(inRings(151.0, -33.9, council), false);
assert.equal(inRings(150.8, -33.9, [square(150.8, -33.9, 0.1), square(150.8, -33.9, 0.01)]), false, 'inside a hole');
assert.deepEqual(ringsBbox(council), { south: -34, west: 150.70000000000002, north: -33.8, east: 150.9 });
assert.ok(Math.abs(metres(-33.9, 150.8, -33.9009, 150.8) - 100) < 1);

// The query asks only for soccer pitches in the box, and the parks and schools around them
const q = overpassQuery({ south: -34, west: 150.7, north: -33.8, east: 150.9 });
assert.match(q, /\["leisure"="pitch"\]\["sport"~"\(\^\|;\)soccer\(;\|\$\)"\]\(-34\.00000,150\.70000,-33\.80000,150\.90000\)/);
assert.match(q, /is_in/);

const elements: OsmElement[] = [
  // Craik Park: 3 pitches (one synthetic and lit), inside a big reserve; the smaller park wins
  pitch(1, -33.931, 150.812, { surface: 'grass', ref: '1' }),
  pitch(2, -33.9312, 150.8123, { surface: 'grass', ref: '2' }),
  pitch(3, -33.9314, 150.8126, { surface: 'artificial_turf', lit: 'yes', ref: '3' }),
  pitch(3, -33.9314, 150.8126, { surface: 'artificial_turf', lit: 'yes', ref: '3' }), // repeated by Overpass
  way(100, { leisure: 'park', name: 'Craik Park' }, square(150.8123, -33.9312, 0.002)),
  way(101, { leisure: 'nature_reserve', name: 'Big Creek Reserve' }, square(150.8123, -33.9312, 0.02)),
  // Two unnamed pitches 80 m apart with no park: one ground, no name
  pitch(4, -33.85, 150.75, {}),
  pitch(5, -33.8507, 150.75, {}),
  // A school pitch
  pitch(6, -33.88, 150.85, { access: 'private' }),
  way(200, { amenity: 'school', name: 'Prestons Public School' }, square(150.85, -33.88, 0.002)),
  // Outside the council area: dropped
  pitch(7, -33.5, 150.8, {}),
];
const found = buildCandidates(elements, council);
assert.equal(found.length, 3);

const craik = found.find(c => c.name === 'Craik Park')!;
assert.equal(craik.ref, 'osm:way/100');
assert.deepEqual(craik.pitches, [
  { label: 'Pitch 1', surface: 'Grass' },
  { label: 'Pitch 2', surface: 'Grass' },
  { label: 'Pitch 3', surface: 'Synthetic', lights: true },
]);
assert.equal(craik.school, false);
assert.equal(pitchesLine(craik.pitches), '3 pitches (1 synthetic, lights)');

const loose = found.find(c => c.ref === 'osm:way/4')!;
assert.equal(loose.name, '');
assert.equal(loose.pitches.length, 2);
assert.equal(found[0], craik, 'named grounds sort first');

const school = found.find(c => c.ref === 'osm:way/6')!;
assert.equal(school.school, true);
assert.equal(school.private, true);
assert.equal(school.name, '', "a school's name isn't the ground's name");

// Already in the directory: same map ref, within 200 m, or the same name nearby
const existing = [
  { id: 'a', name: 'Craik Park', slug: 'craik-park', lat: -33.9312, lng: 150.8121, source_ref: null },
  { id: 'b', name: 'Woodward Park', slug: 'woodward-park', lat: -33.92, lng: 150.92, source_ref: 'osm:way/555' },
];
assert.deepEqual(findExisting(craik, existing, slugify), { id: 'a', name: 'Craik Park' });
assert.deepEqual(findExisting({ ref: 'osm:way/555', name: 'Woodward', lat: -30, lng: 150 }, existing, slugify), { id: 'b', name: 'Woodward Park' });
assert.equal(findExisting(loose, existing, slugify), null);
assert.equal(findExisting({ ref: 'osm:way/9', name: 'Craik Park', lat: -34.5, lng: 150.8 }, existing, slugify), null, 'same name far away is another ground');

// Pitch lines and ABS place names
assert.equal(pitchesLine([{ label: 'Pitch 1', surface: 'Grass' }]), '1 grass pitch');
assert.equal(pitchesLine([{ label: 'A', surface: 'Synthetic', lights: true }]), '1 synthetic pitch (lights)');
assert.equal(pitchesLine([{ label: 'A' }, { label: 'B' }]), '2 pitches');
assert.equal(absPlaceName('Richmond (Vic.)'), 'Richmond');
assert.equal(absPlaceName('Austral'), 'Austral');

console.log('ground-import: all checks passed');
