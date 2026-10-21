// "Import from map" in Mission Control -> Grounds: finds soccer pitches in one council area on
// OpenStreetMap and turns them into ground candidates, one per park. Pure functions only (the
// fetching is in lib/ground-import-fetch.ts), so lib/ground-import.check.ts can test them.
//
// OpenStreetMap data is © OpenStreetMap contributors, available under the ODbL: pages built from it
// credit OpenStreetMap, and the names, pins and pitches we import must be shareable under the ODbL
// if anyone asks. Suburbs, postcodes and council areas come from ABS ASGS 2021 boundaries (CC BY 4.0).
import type { Pitch } from './grounds';

export const OSM_CREDIT = '© OpenStreetMap contributors';
export const OSM_COPYRIGHT_URL = 'https://www.openstreetmap.org/copyright';

/** [lng, lat] rings, as the ABS ArcGIS service returns them (outer rings and holes alike) */
export type Rings = number[][][];

export interface Bbox { south: number; west: number; north: number; east: number }

export interface OsmElement {
  type: 'node' | 'way' | 'relation' | 'area';
  id: number;
  tags?: Record<string, string>;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  geometry?: ({ lat: number; lon: number } | null)[];
  members?: { type: string; role?: string; geometry?: ({ lat: number; lon: number } | null)[] }[];
}

export interface Candidate {
  /** 'osm:way/123': the park, or the first pitch when the pitches aren't inside a named park */
  ref: string;
  /** '' when the map has no name for it: the admin types one */
  name: string;
  lat: number;
  lng: number;
  pitches: Pitch[];
  /** Inside school grounds, or marked private on the map: shown, but not ticked */
  school: boolean;
  private: boolean;
  suburb: string;
  postcode: string;
  /** Already in the directory (or the site's built-in list): can't be added again */
  existing: { id: string; name: string } | null;
}

/**
 * One Overpass query: the soccer pitches in the box, and the named parks and school grounds they
 * sit in (only those, via is_in, so a big council doesn't pull every park's outline).
 */
export function overpassQuery(b: Bbox): string {
  const box = [b.south, b.west, b.north, b.east].map(n => n.toFixed(5)).join(',');
  return `[out:json][timeout:90];
nwr["leisure"="pitch"]["sport"~"(^|;)soccer(;|$)"](${box})->.p;
.p out tags center;
(node(w.p); node.p;)->.pn;
.pn is_in->.ar;
(area.ar["name"]["leisure"~"^(park|recreation_ground|sports_centre|stadium|common|nature_reserve)$"]; area.ar["name"]["landuse"="recreation_ground"];)->.parks;
area.ar["amenity"~"^(school|college|university|kindergarten)$"]->.schools;
(way(pivot.parks); rel(pivot.parks); way(pivot.schools); rel(pivot.schools);)->.outlines;
.outlines out tags geom;`;
}

/** Even-odd test, so holes in a ring set count as outside */
export function inRings(lng: number, lat: number, rings: Rings): boolean {
  let inside = false;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
    }
  }
  return inside;
}

export function ringsBbox(rings: Rings): Bbox | null {
  let south = Infinity, west = Infinity, north = -Infinity, east = -Infinity;
  for (const ring of rings) for (const [x, y] of ring) {
    if (y < south) south = y;
    if (y > north) north = y;
    if (x < west) west = x;
    if (x > east) east = x;
  }
  return isFinite(south) ? { south, west, north, east } : null;
}

/** Metres between two points (close enough at ground scale) */
export function metres(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const r = 6371000;
  const toRad = Math.PI / 180;
  const dLat = (lat2 - lat1) * toRad;
  const dLng = (lng2 - lng1) * toRad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(a));
}

/** Closed outlines of a way or multipolygon relation, as [lng, lat] rings */
function outlineRings(e: OsmElement): Rings {
  const toRing = (g: OsmElement['geometry']) => {
    const pts = (g || []).filter((p): p is { lat: number; lon: number } => !!p).map(p => [p.lon, p.lat]);
    const closed = pts.length >= 4 && pts[0][0] === pts[pts.length - 1][0] && pts[0][1] === pts[pts.length - 1][1];
    return closed ? pts : null;
  };
  if (e.type === 'way') return [toRing(e.geometry)].filter((r): r is number[][] => !!r);
  // Relations: member ways that close on their own (most park multipolygons); others are skipped
  return (e.members || []).map(m => toRing(m.geometry)).filter((r): r is number[][] => !!r);
}

function ringArea(rings: Rings): number {
  let area = 0;
  for (const ring of rings) for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) area += (ring[j][0] + ring[i][0]) * (ring[j][1] - ring[i][1]);
  return Math.abs(area / 2);
}

const SURFACE: Record<string, string> = {
  grass: 'Grass', natural_grass: 'Grass', dirt: 'Grass',
  artificial_turf: 'Synthetic', artificial: 'Synthetic', synthetic: 'Synthetic', 'artificial_grass': 'Synthetic',
  hybrid: 'Hybrid', hybrid_grass: 'Hybrid',
};

/** 'Field 2', 'Pitch 3A' from the map's ref or name; otherwise numbered in order */
function pitchLabel(tags: Record<string, string>, i: number, parkName: string): string {
  const ref = (tags.ref || '').trim();
  if (ref) return /^[0-9]+[a-z]?$/i.test(ref) ? `Pitch ${ref.toUpperCase()}` : ref.slice(0, 40);
  const name = (tags.name || '').trim();
  if (name && name.toLowerCase() !== parkName.toLowerCase() && name.length <= 40) return name;
  return `Pitch ${i + 1}`;
}

interface PitchPoint { el: OsmElement; lat: number; lng: number; tags: Record<string, string> }

/** Groups the pitches found in one council area into ground candidates, one per park */
export function buildCandidates(elements: OsmElement[], council: Rings): Omit<Candidate, 'suburb' | 'postcode' | 'existing'>[] {
  const pitches: PitchPoint[] = [];
  const seen = new Set<string>();
  const parks: { el: OsmElement; rings: Rings; area: number; name: string }[] = [];
  const schools: Rings[] = [];

  for (const el of elements) {
    const tags = el.tags || {};
    if (tags.leisure === 'pitch') {
      const key = `${el.type}/${el.id}`;
      const lat = el.center?.lat ?? el.lat;
      const lng = el.center?.lon ?? el.lon;
      if (seen.has(key) || lat == null || lng == null) continue;
      seen.add(key);
      // Only pitches inside the council area (the query asked for its whole bounding box)
      if (council.length && !inRings(lng, lat, council)) continue;
      pitches.push({ el, lat, lng, tags });
    } else if (el.type === 'way' || el.type === 'relation') {
      const rings = outlineRings(el);
      if (!rings.length) continue;
      if (/^(school|college|university|kindergarten)$/.test(tags.amenity || '')) schools.push(rings);
      else if (tags.name) parks.push({ el, rings, area: ringArea(rings), name: tags.name.trim() });
    }
  }

  // The smallest named park around each pitch (a sports ground inside a bigger reserve wins)
  const groups = new Map<string, { park: (typeof parks)[number] | null; items: PitchPoint[] }>();
  const loose: PitchPoint[] = [];
  for (const p of pitches) {
    const park = parks.filter(k => inRings(p.lng, p.lat, k.rings)).sort((a, b) => a.area - b.area)[0];
    if (!park) { loose.push(p); continue; }
    const key = `${park.el.type}/${park.el.id}`;
    groups.set(key, { park, items: [...(groups.get(key)?.items || []), p] });
  }
  // Pitches outside any named park: those within 150 m of each other are one ground
  for (const p of loose) {
    const near = [...groups.entries()].find(([k, g]) => k.startsWith('loose:') && g.items.some(q => metres(p.lat, p.lng, q.lat, q.lng) <= 150));
    if (near) near[1].items.push(p);
    else groups.set(`loose:${p.el.type}/${p.el.id}`, { park: null, items: [p] });
  }

  return [...groups.entries()].map(([key, g]) => {
    const items = [...g.items].sort((a, b) => (a.tags.ref || '').localeCompare(b.tags.ref || '', undefined, { numeric: true }) || a.el.id - b.el.id);
    const lat = items.reduce((s, p) => s + p.lat, 0) / items.length;
    const lng = items.reduce((s, p) => s + p.lng, 0) / items.length;
    const parkName = g.park?.name || '';
    const named = items.find(p => (p.tags.name || '').trim())?.tags.name?.trim() || '';
    const labels = new Set<string>();
    const pitchList: Pitch[] = items.map((p, i) => {
      let label = pitchLabel(p.tags, i, parkName);
      while (labels.has(label)) label = `${label} (${i + 1})`;
      labels.add(label);
      const surface = SURFACE[(p.tags.surface || '').toLowerCase()];
      return { label, ...(surface ? { surface } : {}), ...(p.tags.lit === 'yes' ? { lights: true } : {}) };
    });
    return {
      ref: `osm:${key.replace(/^loose:/, '')}`,
      name: (parkName || named).slice(0, 120),
      lat: Math.round(lat * 1e6) / 1e6,
      lng: Math.round(lng * 1e6) / 1e6,
      pitches: pitchList,
      school: schools.some(r => inRings(lng, lat, r)),
      private: items.every(p => /^(private|no|customers)$/.test(p.tags.access || '')),
    };
  }).sort((a, b) => (a.name ? 0 : 1) - (b.name ? 0 : 1) || a.name.localeCompare(b.name));
}

/** The ground already in the directory at the same spot (within 200 m), with the same map ref, or the same name */
export function findExisting(
  c: { ref: string; name: string; lat: number; lng: number },
  existing: { id: string; name: string; slug: string; lat: number | null; lng: number | null; source_ref?: string | null }[],
  slug: (s: string) => string,
): { id: string; name: string } | null {
  const s = c.name ? slug(c.name) : '';
  const hit = existing.find(g =>
    g.source_ref === c.ref ||
    (g.lat != null && g.lng != null && metres(c.lat, c.lng, g.lat, g.lng) <= 200) ||
    (!!s && g.slug === s && g.lat != null && g.lng != null && metres(c.lat, c.lng, g.lat, g.lng) <= 3000)
  );
  return hit ? { id: hit.id, name: hit.name } : null;
}

/** 'Austral (NSW)' -> 'Austral'; ABS suburb names carry the state when a name is used twice */
export const absPlaceName = (name: string) => name.replace(/\s*\([^)]*\)\s*$/, '').trim();

/** "3 pitches (1 synthetic, lights)" for the import list */
export function pitchesLine(pitches: Pitch[]): string {
  const n = pitches.length;
  const synthetic = pitches.filter(p => p.surface === 'Synthetic').length;
  const lit = pitches.some(p => p.lights);
  const extra = [synthetic && synthetic < n ? `${synthetic} synthetic` : '', lit ? 'lights' : ''].filter(Boolean).join(', ');
  const kind = synthetic === n ? 'synthetic ' : pitches.every(p => p.surface === 'Grass') ? 'grass ' : '';
  return `${n} ${kind}${n === 1 ? 'pitch' : 'pitches'}${extra ? ` (${extra})` : ''}`;
}
