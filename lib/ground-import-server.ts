// Server-side fetches for "Import from map" (Mission Control -> Grounds). Four requests per search:
// the council's outline, the suburbs and postcodes around it (ABS ASGS 2021, CC BY 4.0) and the
// pitches in it (OpenStreetMap through the Overpass API, ODbL). Points are matched to outlines
// locally, so a big council doesn't mean hundreds of lookups. Never import this from client code.
import { councilByLgaCode, type AuState } from './councils';
import { areaName } from './council-lookup';
import {
  absPlaceName, buildCandidates, inRings, overpassQuery, ringsBbox,
  type Bbox, type Candidate, type OsmElement, type Rings,
} from './ground-import';

const ABS = 'https://geo.abs.gov.au/arcgis/rest/services/ASGS2021';
const OVERPASS = 'https://overpass-api.de/api/interpreter';
const USER_AGENT = 'itsfootball.club grounds import (contact@itsfootball.club)';

const STATE_NAMES: Record<AuState, string> = {
  NSW: 'New South Wales', VIC: 'Victoria', QLD: 'Queensland', WA: 'Western Australia', SA: 'South Australia',
  TAS: 'Tasmania', ACT: 'Australian Capital Territory', NT: 'Northern Territory',
};

export interface LgaOption { code: string; name: string; listed: boolean }

interface ArcFeature { attributes?: Record<string, string>; geometry?: { rings?: Rings } }

async function arcQuery(layer: 'LGA' | 'SAL' | 'POA', params: Record<string, string>, timeoutMs = 20000): Promise<ArcFeature[]> {
  const res = await fetch(`${ABS}/${layer}/MapServer/0/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ f: 'json', outSR: '4326', ...params }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`ABS ${layer} ${res.status}`);
  const json = (await res.json()) as { features?: ArcFeature[]; error?: { message?: string } };
  if (json.error) throw new Error(`ABS ${layer}: ${json.error.message || 'error'}`);
  return json.features || [];
}

/** Every council area in a state, for the picker (the councils lib/councils.ts lists are marked) */
export async function councilAreas(state: AuState): Promise<LgaOption[]> {
  const features = await arcQuery('LGA', {
    where: `state_name_2021 = '${STATE_NAMES[state]}'`,
    outFields: 'lga_code_2021,lga_name_2021',
    returnGeometry: 'false',
    orderByFields: 'lga_name_2021',
  });
  return features
    .map(f => ({ code: f.attributes?.lga_code_2021 || '', abs: f.attributes?.lga_name_2021 || '' }))
    .filter(f => f.code && f.abs && !/^(no usual address|migratory|unincorporated)/i.test(f.abs))
    .map(f => {
      const listed = councilByLgaCode(f.code);
      return { code: f.code, name: listed?.name || areaName(f.abs), listed: !!listed };
    });
}

const envelope = (b: Bbox) => JSON.stringify({ xmin: b.west, ymin: b.south, xmax: b.east, ymax: b.north, spatialReference: { wkid: 4326 } });

/** Outlines that touch the box, simplified to about 20 m (plenty for "which suburb is this pin in") */
async function outlines(layer: 'SAL' | 'POA', field: string, box: Bbox) {
  const features = await arcQuery(layer, {
    geometry: envelope(box),
    geometryType: 'esriGeometryEnvelope',
    inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    outFields: field,
    returnGeometry: 'true',
    maxAllowableOffset: '0.0002',
    geometryPrecision: '5',
  }, 30000);
  return features.filter(f => f.geometry?.rings?.length).map(f => ({ value: f.attributes?.[field] || '', rings: f.geometry!.rings! }));
}

export interface ImportSearch {
  council: { code: string; name: string; key: string; councilName: string | null; state: AuState | null };
  candidates: Omit<Candidate, 'existing'>[];
}

/** The ground candidates in one council area (existing grounds are matched by the caller) */
export async function findGroundsInCouncil(lgaCode: string): Promise<ImportSearch> {
  const [lga] = await arcQuery('LGA', {
    where: `lga_code_2021 = '${lgaCode.replace(/[^0-9]/g, '')}'`,
    outFields: 'lga_code_2021,lga_name_2021,state_name_2021',
    returnGeometry: 'true',
    maxAllowableOffset: '0.0005',
    geometryPrecision: '5',
  }, 30000);
  const rings = lga?.geometry?.rings || [];
  const box = ringsBbox(rings);
  if (!lga || !box) throw new Error('That council area wasn’t found.');

  const res = await fetch(OVERPASS, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': USER_AGENT },
    body: new URLSearchParams({ data: overpassQuery(box) }),
    signal: AbortSignal.timeout(100000),
  });
  if (!res.ok) throw new Error(res.status === 429 || res.status === 504 ? 'OpenStreetMap is busy right now. Try again in a minute.' : `OpenStreetMap returned ${res.status}.`);
  const { elements = [] } = (await res.json()) as { elements?: OsmElement[] };
  const found = buildCandidates(elements, rings);

  const [suburbs, postcodes] = found.length
    ? await Promise.all([
        outlines('SAL', 'sal_name_2021', box).catch(() => []),
        outlines('POA', 'poa_code_2021', box).catch(() => []),
      ])
    : [[], []];
  const at = (list: { value: string; rings: Rings }[], lat: number, lng: number) => list.find(o => inRings(lng, lat, o.rings))?.value || '';

  const code = lga.attributes?.lga_code_2021 || lgaCode;
  const listed = councilByLgaCode(code);
  const absName = lga.attributes?.lga_name_2021 || '';
  const stateEntry = Object.entries(STATE_NAMES).find(([, n]) => n === lga.attributes?.state_name_2021);
  return {
    council: {
      code,
      name: listed?.name || areaName(absName),
      key: listed?.key || 'other',
      councilName: listed ? null : areaName(absName),
      state: (stateEntry?.[0] as AuState) || null,
    },
    candidates: found.map(c => ({
      ...c,
      suburb: absPlaceName(at(suburbs, c.lat, c.lng)),
      postcode: /^\d{4}$/.test(at(postcodes, c.lat, c.lng)) ? at(postcodes, c.lat, c.lng) : '',
    })),
  };
}
