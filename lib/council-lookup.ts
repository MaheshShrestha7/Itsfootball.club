// Which council a map pin is in, from the Australian Bureau of Statistics' local government area
// boundaries (ASGS 2021, free to use under CC BY 4.0). Server-side only; best effort: returns null
// when the service is slow or down, and the admin picks the council by hand as before.
import { councilByLgaCode, type AuState } from './councils';

const ABS_LGA_QUERY = 'https://geo.abs.gov.au/arcgis/rest/services/ASGS2021/LGA/MapServer/0/query';

const STATE_BY_ABS_NAME: Record<string, AuState> = {
  'New South Wales': 'NSW', Victoria: 'VIC', Queensland: 'QLD', 'Western Australia': 'WA', 'South Australia': 'SA',
  Tasmania: 'TAS', 'Australian Capital Territory': 'ACT', 'Northern Territory': 'NT',
};

export interface CouncilMatch {
  /** A key from lib/councils.ts, or 'other' for a council we don't list yet */
  key: string;
  /** The listed council's name, or the area's name for 'other' (e.g. 'Wollondilly council area') */
  name: string;
  lgaCode: string;
  state: AuState | null;
}

/** 'Campbelltown (NSW)' -> 'Campbelltown council area'; the ABS name has no 'Shire' or 'City' */
export function areaName(absName: string): string {
  return `${absName.replace(/\s*\((NSW|Vic\.|Qld|SA|WA|Tas\.|NT|ACT)\)\s*$/i, '').trim()} council area`;
}

/** Turns one ABS feature's attributes into a council match (exported for the self-check) */
export function matchFromAttributes(a: { lga_code_2021?: string; lga_name_2021?: string; state_name_2021?: string } | undefined): CouncilMatch | null {
  const code = a?.lga_code_2021;
  const absName = a?.lga_name_2021;
  // 'No usual address' and 'Migratory' areas aren't councils
  if (!code || !absName || /^(no usual address|migratory|unincorporated)/i.test(absName)) return null;
  const listed = councilByLgaCode(code);
  return {
    key: listed?.key || 'other',
    name: listed?.name || areaName(absName),
    lgaCode: code,
    state: STATE_BY_ABS_NAME[a?.state_name_2021 || ''] || null,
  };
}

export async function councilFromPin(lat: number, lng: number): Promise<CouncilMatch | null> {
  if (!(lat >= -44 && lat <= -9 && lng >= 112 && lng <= 154)) return null;
  const params = new URLSearchParams({
    geometry: `${lng},${lat}`,
    geometryType: 'esriGeometryPoint',
    inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    outFields: 'lga_code_2021,lga_name_2021,state_name_2021',
    returnGeometry: 'false',
    f: 'json',
  });
  try {
    const res = await fetch(`${ABS_LGA_QUERY}?${params}`, { signal: AbortSignal.timeout(4000), next: { revalidate: 86400 } });
    if (!res.ok) return null;
    const json = (await res.json()) as { features?: { attributes?: Record<string, string> }[] };
    return matchFromAttributes(json.features?.[0]?.attributes);
  } catch {
    return null;
  }
}
