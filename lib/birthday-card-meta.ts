// Pure metadata, colour palette resolution, and helpers for the 7 pro birthday card variations.
// Kept browser-free so unit tests (lib/birthday-card.check.ts) run in Node.
import { readableClubInk } from '@/lib/theme-utils';

export type BirthdayStyle = 'ucl' | 'heritage' | 'swiss' | 'kinetic' | 'monograph' | 'magazine' | 'kit';
export type BirthdayPaletteMode = 'club' | 'inverted' | 'gold' | 'noir' | 'custom';

export interface BirthdayStyleMeta {
  id: BirthdayStyle;
  num: string;
  label: string;
  hint: string;
  /** Works cleanly without a player photo */
  worksWithoutPhoto?: boolean;
}

export const BIRTHDAY_STYLES: BirthdayStyleMeta[] = [
  { id: 'ucl',       num: '01', label: 'UCL Nights',        hint: 'Dark broadcast & volumetric glow' },
  { id: 'heritage',  num: '02', label: 'Heritage Luxe',     hint: 'Double gold frame & editorial serif' },
  { id: 'swiss',     num: '03', label: 'Swiss Brutalist',   hint: 'Full club colour asymmetric grid' },
  { id: 'kinetic',   num: '04', label: 'Kinetic Type Wall', hint: 'Repeating outline type & slash' },
  { id: 'monograph', num: '05', label: 'Duotone Monograph', hint: 'Monochrome portrait & accent rail' },
  { id: 'magazine',  num: '06', label: 'Stadium Magazine',  hint: 'Full-bleed cover & masthead' },
  { id: 'kit',       num: '07', label: 'Architectural Kit', hint: 'No-photo / junior-safe club jersey', worksWithoutPhoto: true },
];

export const BIRTHDAY_PALETTES: { id: BirthdayPaletteMode; label: string }[] = [
  { id: 'club',     label: 'Club' },
  { id: 'inverted', label: 'Away' },
  { id: 'gold',     label: 'Gold Luxe' },
  { id: 'noir',     label: 'Noir' },
  { id: 'custom',   label: 'Custom' },
];

export interface ResolvedBirthdayPalette {
  primary: string;
  accent: string;
  deep: string;
  inkOnPrimary: '#FFFFFF' | '#0A0A0C';
}

const HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

export function normalizeHex(input: string | null | undefined, fallback: string): string {
  const raw = (input || '').trim();
  if (!HEX_RE.test(raw)) return fallback;
  if (raw.length === 4) {
    return `#${raw[1]}${raw[1]}${raw[2]}${raw[2]}${raw[3]}${raw[3]}`.toUpperCase();
  }
  return raw.toUpperCase();
}

export function hexToRgb(hex: string): [number, number, number] {
  const n = normalizeHex(hex, '#10B981');
  return [
    parseInt(n.slice(1, 3), 16),
    parseInt(n.slice(3, 5), 16),
    parseInt(n.slice(5, 7), 16),
  ];
}

export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map(v => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function mixHex(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  const c = (u: number, v: number) => Math.round(u + (v - u) * Math.max(0, Math.min(1, t)));
  const h = (n: number) => n.toString(16).padStart(2, '0').toUpperCase();
  return `#${h(c(r1, r2))}${h(c(g1, g2))}${h(c(b1, b2))}`;
}

export function resolveBirthdayPalette(
  clubPrimary: string | null | undefined,
  clubSecondary: string | null | undefined,
  mode: BirthdayPaletteMode = 'club',
  customHex?: string | null,
): ResolvedBirthdayPalette {
  const basePrimary = normalizeHex(clubPrimary, '#C8102E');
  const rawSecondary = normalizeHex(clubSecondary, '');
  const baseSecondary = rawSecondary && rawSecondary !== basePrimary ? rawSecondary : '#E5C158';

  let primary = basePrimary;
  let accent = baseSecondary;

  if (mode === 'inverted') {
    primary = baseSecondary;
    accent = basePrimary;
  } else if (mode === 'gold') {
    primary = basePrimary;
    accent = '#E5C158';
  } else if (mode === 'noir') {
    primary = '#181B22';
    accent = readableClubInk(basePrimary, 'dark');
  } else if (mode === 'custom') {
    primary = normalizeHex(customHex, basePrimary);
    accent = relativeLuminance(primary) > 0.55 ? '#0A0A0C' : '#E5C158';
  }

  // Ensure accent stays crisp on dark backdrops
  const safeAccent = relativeLuminance(accent) < 0.14 ? readableClubInk(accent, 'dark') : accent;
  const deep = mixHex(primary, '#05070B', 0.84);
  const inkOnPrimary: '#FFFFFF' | '#0A0A0C' = relativeLuminance(primary) > 0.48 ? '#0A0A0C' : '#FFFFFF';

  return { primary, accent: safeAccent, deep, inkOnPrimary };
}

/** Falls back to Architectural Kit when a photo-based template has no photo available */
export function effectiveBirthdayStyle(style: BirthdayStyle, hasPhoto: boolean): BirthdayStyle {
  if (hasPhoto || style === 'kit') return style;
  return 'kit';
}

/** Split a full display name into top/bottom lines for stacked editorial lockups */
export function splitDisplayName(displayName: string): { first: string; rest: string } {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { first: '', rest: (parts[0] || 'PLAYER').toUpperCase() };
  return { first: parts[0].toUpperCase(), rest: parts.slice(1).join(' ').toUpperCase() };
}

export function birthdayFileName(clubSlug: string, displayName: string, style: BirthdayStyle, format: string): string {
  const slug = displayName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'player';
  return `${clubSlug || 'club'}-birthday-${slug}-${style}-${format}.png`;
}
