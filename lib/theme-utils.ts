/**
 * Color and WCAG 2.2 AA Contrast Utilities for Dynamic Multi-Tenant Theming
 */

export interface ContrastResult {
  contrastWithWhite: number;
  contrastWithDark: number;
  bestTextColor: '#FFFFFF' | '#090D16';
  isWcagAA: boolean; // Meets 4.5:1 for normal text or 3:1 for large text / components
  ratioFormatted: string;
}

export function hexToRgb(hex: string): { r: number; g: number; b: number; rgbString: string } {
  const clean = hex.replace('#', '').trim();
  let r = 16;
  let g = 185;
  let b = 129;
  // Only unreadable text falls back: 00 is a real channel (#ff0040 has no green)
  const channel = (text: string, fallback: number) => {
    const n = parseInt(text, 16);
    return Number.isNaN(n) ? fallback : n;
  };

  if (clean.length === 3) {
    r = channel(clean[0] + clean[0], r);
    g = channel(clean[1] + clean[1], g);
    b = channel(clean[2] + clean[2], b);
  } else if (clean.length >= 6) {
    r = channel(clean.substring(0, 2), r);
    g = channel(clean.substring(2, 4), g);
    b = channel(clean.substring(4, 6), b);
  }

  return { r, g, b, rgbString: `${r}, ${g}, ${b}` };
}

// Calculate relative luminance per WCAG definition
export function getRelativeLuminance(r: number, g: number, b: number): number {
  const srgb = [r / 255, g / 255, b / 255];
  const linear = srgb.map(c => {
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

// Calculate contrast ratio between two luminance values
export function getContrastRatio(lum1: number, lum2: number): number {
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  return (lighter + 0.05) / (darker + 0.05);
}

// Evaluate contrast of a background hex color against white & dark text
export function evaluateColorContrast(bgHex: string): ContrastResult {
  const { r, g, b } = hexToRgb(bgHex);
  const lum = getRelativeLuminance(r, g, b);
  const lumWhite = 1.0;
  const lumDark = getRelativeLuminance(9, 13, 22); // #090D16

  const contrastWithWhite = getContrastRatio(lum, lumWhite);
  const contrastWithDark = getContrastRatio(lum, lumDark);

  const bestTextColor = contrastWithWhite >= 4.5 || contrastWithWhite >= contrastWithDark
    ? '#FFFFFF'
    : '#090D16';

  const highestRatio = Math.max(contrastWithWhite, contrastWithDark);

  return {
    contrastWithWhite: Number(contrastWithWhite.toFixed(2)),
    contrastWithDark: Number(contrastWithDark.toFixed(2)),
    bestTextColor,
    isWcagAA: highestRatio >= 4.5,
    ratioFormatted: `${highestRatio.toFixed(1)}:1`,
  };
}

/** Mixes a colour toward another by `amount` (0 to 1), as #rrggbb */
function mixHex(hex: string, toward: { r: number; g: number; b: number }, amount: number): string {
  const c = hexToRgb(hex);
  const ch = (a: number, b: number) => Math.round(a + (b - a) * amount).toString(16).padStart(2, '0');
  return `#${ch(c.r, toward.r)}${ch(c.g, toward.g)}${ch(c.b, toward.b)}`;
}

/**
 * A club colour used as text: the colour itself where it already reads at 4.5:1, otherwise moved
 * toward white (dark theme) or black (light theme) just far enough. Measured against the club colour's
 * own light tint over a card, the background of badges and highlighted rows, which is the hardest case.
 */
export function readableClubInk(hex: string, theme: 'dark' | 'light'): string {
  const target = theme === 'dark' ? { r: 255, g: 255, b: 255 } : { r: 0, g: 0, b: 0 };
  const surface = theme === 'dark' ? { r: 30, g: 37, b: 48 } : { r: 243, g: 245, b: 249 };
  const bg = mixHex(`#${[surface.r, surface.g, surface.b].map(v => v.toString(16).padStart(2, '0')).join('')}`, hexToRgb(hex), 0.18);
  const bgRgb = hexToRgb(bg);
  const bgLum = getRelativeLuminance(bgRgb.r, bgRgb.g, bgRgb.b);
  for (let step = 0; step <= 20; step++) {
    const ink = mixHex(hex, target, step / 20);
    const c = hexToRgb(ink);
    if (getContrastRatio(getRelativeLuminance(c.r, c.g, c.b), bgLum) >= 4.6) return ink;
  }
  return theme === 'dark' ? '#FFFFFF' : '#000000';
}

/** CSS variables for an element showing a club colour as text in either theme: give the element (or a
 *  parent) the class `club-theme-root` and use `color: var(--club-ink)` */
export function clubInkVars(hex: string | null | undefined): Record<string, string> {
  const base = hex || '#10B981';
  return { '--club-ink-dark': readableClubInk(base, 'dark'), '--club-ink-light': readableClubInk(base, 'light') };
}

// Curated professional football club color presets
export const FOOTBALL_COLOR_PALETTES = [
  {
    name: 'Green and navy',
    primary: '#10B981',
    secondary: '#0F172A',
    accent: '#F59E0B',
  },
  {
    name: 'Claret and blue',
    primary: '#A50044',
    secondary: '#004D98',
    accent: '#EDBB00',
  },
  {
    name: 'Sky blue and gold',
    primary: '#0284C7',
    secondary: '#0B132B',
    accent: '#FBBF24',
  },
  {
    name: 'Red and black',
    primary: '#DC2626',
    secondary: '#18181B',
    accent: '#F97316',
  },
  {
    name: 'Purple and black',
    primary: '#8B5CF6',
    secondary: '#090D16',
    accent: '#10B981',
  },
  {
    name: 'Gold and black',
    primary: '#EAB308',
    secondary: '#171717',
    accent: '#FFFFFF',
  },
];
