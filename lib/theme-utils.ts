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

  if (clean.length === 3) {
    r = parseInt(clean[0] + clean[0], 16) || 16;
    g = parseInt(clean[1] + clean[1], 16) || 185;
    b = parseInt(clean[2] + clean[2], 16) || 129;
  } else if (clean.length >= 6) {
    r = parseInt(clean.substring(0, 2), 16) || 16;
    g = parseInt(clean.substring(2, 4), 16) || 185;
    b = parseInt(clean.substring(4, 6), 16) || 129;
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

// Curated professional football club color presets
export const FOOTBALL_COLOR_PALETTES = [
  {
    name: 'Royal Emerald & Slate',
    primary: '#10B981',
    secondary: '#0F172A',
    accent: '#F59E0B',
  },
  {
    name: 'Blaugrana Passion',
    primary: '#A50044',
    secondary: '#004D98',
    accent: '#EDBB00',
  },
  {
    name: 'Midnight Azure & Gold',
    primary: '#0284C7',
    secondary: '#0B132B',
    accent: '#FBBF24',
  },
  {
    name: 'Striker Crimson & Onyx',
    primary: '#DC2626',
    secondary: '#18181B',
    accent: '#F97316',
  },
  {
    name: 'Electric Neon & Obsidian',
    primary: '#8B5CF6',
    secondary: '#090D16',
    accent: '#10B981',
  },
  {
    name: 'Dorado & Carbon',
    primary: '#EAB308',
    secondary: '#171717',
    accent: '#FFFFFF',
  },
];
