'use client';

// Pro-level football player birthday cards drawn on an HTML5 canvas in the browser (1080×1350 post,
// 1080×1920 story, 1080×1080 square). Zero server rendering cost, zero new dependencies.
import { DEFAULT_CREST } from '@/lib/crest';
import { corsCopy } from '@/lib/image-color';
import { CARD_SIZES, type CardFormat, type CardSponsor } from '@/lib/share-card';
import type { Club } from '@/lib/supabase/types';
import {
  effectiveBirthdayStyle,
  hexToRgb,
  resolveBirthdayPalette,
  splitDisplayName,
  type BirthdayPaletteMode,
  type BirthdayStyle,
  type ResolvedBirthdayPalette,
} from '@/lib/birthday-card-meta';

export type { BirthdayPaletteMode, BirthdayStyle };

export interface BirthdayCardInput {
  displayName: string;
  jerseyNumber?: number;
  position?: string;
  teamName?: string;
  turningAge?: number;
  dateLabel: string;
  dateShort: string;
  isJunior?: boolean;
  photoUrl?: string;
}

export interface BirthdayCardOptions {
  style?: BirthdayStyle;
  format?: CardFormat;
  paletteMode?: BirthdayPaletteMode;
  customColor?: string;
  showAge?: boolean;
  /** Photo framing controls (focusX/focusY: 0..1, zoom: 1..2) */
  zoom?: number;
  focusX?: number;
  focusY?: number;
  /** True when photoUrl is a background-removed transparent PNG cutout */
  cutout?: boolean;
  sponsors?: CardSponsor[];
}

const DISPLAY_FONT = 'Impact, "Arial Narrow", "Helvetica Neue", system-ui, sans-serif';
const SANS_FONT = '"Helvetica Neue", Arial, system-ui, sans-serif';
const SERIF_FONT = 'Georgia, "Times New Roman", serif';
const MONO_FONT = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';

function rgba(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

async function loadImage(src: string | null | undefined): Promise<HTMLImageElement | null> {
  if (!src) return null;
  const safe = src.startsWith('data:') || src.startsWith('blob:') || src.startsWith('/') ? src : await corsCopy(src);
  if (!safe) return null;
  return new Promise(resolve => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = safe;
  });
}

function fitFontSize(ctx: CanvasRenderingContext2D, text: string, maxW: number, startPx: number, minPx: number, fontTpl: (px: number) => string): number {
  let px = startPx;
  while (px > minPx) {
    ctx.font = fontTpl(px);
    if (ctx.measureText(text).width <= maxW) break;
    px -= 2;
  }
  return px;
}

/** Subtle procedural film grain overlay for authentic print/broadcast finish */
function drawFilmGrain(ctx: CanvasRenderingContext2D, w: number, h: number, alpha = 0.05) {
  const tile = document.createElement('canvas');
  tile.width = 128;
  tile.height = 128;
  const tctx = tile.getContext('2d');
  if (!tctx) return;
  const img = tctx.createImageData(128, 128);
  let seed = 1337;
  for (let i = 0; i < img.data.length; i += 4) {
    seed = (seed * 16807) % 2147483647;
    const v = seed & 255;
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = Math.round(alpha * 255);
  }
  tctx.putImageData(img, 0, 0);
  const pat = ctx.createPattern(tile, 'repeat');
  if (!pat) return;
  ctx.save();
  ctx.fillStyle = pat;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

function drawHalftone(ctx: CanvasRenderingContext2D, w: number, h: number, color = 'rgba(255,255,255,0.09)', step = 22, r = 2.4) {
  ctx.save();
  ctx.fillStyle = color;
  for (let y = step / 2; y < h; y += step) {
    for (let x = step / 2; x < w; x += step) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

/** Cover-crop draw into box (x, y, bw, bh) with top-weighted default focus and optional monochrome */
function drawPhotoBox(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  bw: number,
  bh: number,
  opts: { zoom?: number; focusX?: number; focusY?: number; cutout?: boolean; grayscale?: boolean; fadeBottom?: boolean },
) {
  const zoom = Math.max(1, Math.min(2.2, opts.zoom ?? 1));
  const fx = Math.max(0, Math.min(1, opts.focusX ?? 0.5));
  const fy = Math.max(0, Math.min(1, opts.focusY ?? 0.22));
  const iw = img.naturalWidth || 1;
  const ih = img.naturalHeight || 1;

  // Render onto an offscreen canvas so fade/grayscale never affect the rest of the scene
  const off = document.createElement('canvas');
  off.width = Math.max(1, Math.round(bw));
  off.height = Math.max(1, Math.round(bh));
  const octx = off.getContext('2d');
  if (!octx) return;
  octx.imageSmoothingEnabled = true;
  octx.imageSmoothingQuality = 'high';

  if (opts.cutout) {
    // Fit cutout cleanly anchored to bottom of box so player stands inside the frame
    const scale = Math.min(bw / iw, bh / ih) * zoom * 0.96;
    const dw = iw * scale;
    const dh = ih * scale;
    const dx = (bw - dw) * fx;
    const dy = (bh - dh) * (0.2 + fy * 0.8);
    octx.drawImage(img, dx, dy, dw, dh);
  } else {
    const scale = Math.max(bw / iw, bh / ih) * zoom;
    const dw = iw * scale;
    const dh = ih * scale;
    const dx = (bw - dw) * fx;
    const dy = (bh - dh) * fy;
    octx.drawImage(img, dx, dy, dw, dh);
  }

  if (opts.grayscale) {
    const id = octx.getImageData(0, 0, off.width, off.height);
    const d = id.data;
    for (let i = 0; i < d.length; i += 4) {
      const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      // Punchy editorial contrast curve
      const c = Math.max(0, Math.min(255, (lum - 128) * 1.24 + 124));
      d[i] = c;
      d[i + 1] = c;
      d[i + 2] = c;
    }
    octx.putImageData(id, 0, 0);
  }

  if (opts.fadeBottom) {
    octx.globalCompositeOperation = 'destination-in';
    const g = octx.createLinearGradient(0, bh * 0.48, 0, bh);
    g.addColorStop(0, 'rgba(0,0,0,1)');
    g.addColorStop(0.75, 'rgba(0,0,0,0.45)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    octx.fillStyle = g;
    octx.fillRect(0, 0, bw, bh);
  }

  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, bw, bh);
  ctx.clip();
  ctx.drawImage(off, x, y);
  ctx.restore();
}

function drawCrest(ctx: CanvasRenderingContext2D, crest: HTMLImageElement | null, x: number, y: number, size: number, palette: ResolvedBirthdayPalette) {
  ctx.save();
  if (crest) {
    const r = Math.min(size / (crest.naturalWidth || 1), size / (crest.naturalHeight || 1));
    const dw = (crest.naturalWidth || size) * r;
    const dh = (crest.naturalHeight || size) * r;
    ctx.drawImage(crest, x + (size - dw) / 2, y + (size - dh) / 2, dw, dh);
  } else {
    // Clean geometric shield fallback
    ctx.beginPath();
    ctx.moveTo(x + size * 0.5, y);
    ctx.lineTo(x + size * 0.92, y + size * 0.16);
    ctx.lineTo(x + size * 0.92, y + size * 0.54);
    ctx.quadraticCurveTo(x + size * 0.92, y + size * 0.85, x + size * 0.5, y + size);
    ctx.quadraticCurveTo(x + size * 0.08, y + size * 0.85, x + size * 0.08, y + size * 0.54);
    ctx.lineTo(x + size * 0.08, y + size * 0.16);
    ctx.closePath();
    ctx.fillStyle = palette.primary;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = palette.accent;
    ctx.stroke();
  }
  ctx.restore();
}

function drawSponsorFooter(
  ctx: CanvasRenderingContext2D,
  w: number,
  y: number,
  padX: number,
  sponsors: CardSponsor[] | undefined,
  clubName: string,
  light = false,
) {
  const rule = light ? 'rgba(10,10,14,0.18)' : 'rgba(255,255,255,0.16)';
  const muted = light ? 'rgba(10,10,14,0.58)' : 'rgba(255,255,255,0.55)';
  const ink = light ? 'rgba(10,10,14,0.88)' : 'rgba(255,255,255,0.88)';
  ctx.save();
  ctx.strokeStyle = rule;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(padX, y);
  ctx.lineTo(w - padX, y);
  ctx.stroke();

  const names = (sponsors || [])
    .map(s => (typeof s === 'string' ? '' : s.name))
    .filter(Boolean)
    .slice(0, 3);

  ctx.textBaseline = 'middle';
  const cy = y + 34;
  if (names.length) {
    ctx.font = `700 20px ${MONO_FONT}`;
    ctx.fillStyle = muted;
    ctx.textAlign = 'left';
    ctx.fillText('PARTNERS', padX, cy);

    ctx.font = `800 22px ${SANS_FONT}`;
    ctx.fillStyle = ink;
    ctx.textAlign = 'right';
    ctx.fillText(names.map(n => n.toUpperCase()).join('  /  '), w - padX, cy, w - padX * 2 - 160);
  } else {
    ctx.font = `700 20px ${MONO_FONT}`;
    ctx.fillStyle = muted;
    ctx.textAlign = 'center';
    ctx.fillText(`${clubName.toUpperCase()}  //  ITSFOOTBALL.CLUB`, w / 2, cy, w - padX * 2);
  }
  ctx.restore();
}

function drawArchitecturalJersey(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  scale: number,
  numberText: string,
  nameplate: string,
  palette: ResolvedBirthdayPalette,
) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);

  // Soft club glow behind shirt
  const glow = ctx.createRadialGradient(0, 0, 20, 0, 0, 290);
  glow.addColorStop(0, rgba(palette.primary, 0.55));
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, 290, 0, Math.PI * 2);
  ctx.fill();

  // Jersey silhouette path centered around (0,0)
  ctx.beginPath();
  ctx.moveTo(-72, -195);
  ctx.lineTo(-34, -195);
  ctx.lineTo(0, -158);
  ctx.lineTo(34, -195);
  ctx.lineTo(72, -195);
  ctx.lineTo(185, -135);
  ctx.lineTo(154, -44);
  ctx.lineTo(102, -68);
  ctx.lineTo(102, 195);
  ctx.lineTo(-102, 195);
  ctx.lineTo(-102, -68);
  ctx.lineTo(-154, -44);
  ctx.lineTo(-185, -135);
  ctx.closePath();

  const grad = ctx.createLinearGradient(-150, -195, 150, 195);
  grad.addColorStop(0, palette.primary);
  grad.addColorStop(1, palette.deep);
  ctx.fillStyle = grad;
  ctx.fill();

  // Clip tonal vertical stripes inside shirt
  ctx.save();
  ctx.clip();
  ctx.fillStyle = 'rgba(255,255,255,0.07)';
  ctx.fillRect(-52, -200, 26, 420);
  ctx.fillRect(26, -200, 26, 420);
  ctx.restore();

  // Accent trim
  ctx.lineWidth = 6;
  ctx.strokeStyle = palette.accent;
  ctx.lineJoin = 'round';
  ctx.stroke();

  // V-collar inner trim
  ctx.beginPath();
  ctx.moveTo(-40, -195);
  ctx.lineTo(0, -152);
  ctx.lineTo(40, -195);
  ctx.lineWidth = 7;
  ctx.strokeStyle = palette.accent;
  ctx.stroke();

  // Nameplate
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const npSize = fitFontSize(ctx, nameplate, 178, 30, 16, px => `800 ${px}px ${SANS_FONT}`);
  ctx.font = `800 ${npSize}px ${SANS_FONT}`;
  ctx.fillText(nameplate, 0, -68);

  // Oversized squad number
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `900 176px ${DISPLAY_FONT}`;
  ctx.fillText(numberText, 0, 74);

  ctx.restore();
}

export async function drawBirthdayCard(
  player: BirthdayCardInput,
  club: Pick<Club, 'name' | 'slug' | 'logo_url' | 'primary_color' | 'secondary_color'>,
  options: BirthdayCardOptions = {},
): Promise<Blob> {
  const format: CardFormat = options.format || 'post';
  const { w, h } = CARD_SIZES[format];
  const palette = resolveBirthdayPalette(club.primary_color, club.secondary_color, options.paletteMode || 'club', options.customColor);
  const [photo, crest] = await Promise.all([
    loadImage(player.photoUrl),
    loadImage(club.logo_url || DEFAULT_CREST),
  ]);

  const style = effectiveBirthdayStyle(options.style || 'ucl', !!photo);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available in this browser.');

  const isSq = format === 'square';
  const isSt = format === 'story';
  const pad = 64;
  const showAge = !!options.showAge && !player.isJunior && typeof player.turningAge === 'number';
  const topDateLabel = showAge ? `TURNING ${player.turningAge}` : player.dateLabel.toUpperCase();
  const numStr = player.jerseyNumber != null ? String(player.jerseyNumber) : '';
  const { first, rest } = splitDisplayName(player.displayName);
  const fullUpper = player.displayName.toUpperCase();
  const roleLine = [player.position?.toUpperCase(), player.teamName?.toUpperCase()].filter(Boolean).join('  //  ') || club.name.toUpperCase();
  const footerY = h - 102;
  const photoOpts = { zoom: options.zoom, focusX: options.focusX, focusY: options.focusY, cutout: options.cutout };

  // ───────────────────────────────────────────────────────────────────────────
  // 01 // UCL NIGHTS
  // ───────────────────────────────────────────────────────────────────────────
  if (style === 'ucl') {
    ctx.fillStyle = '#05070B';
    ctx.fillRect(0, 0, w, h);

    // Volumetric club light leaks
    const g1 = ctx.createRadialGradient(w * 0.88, h * 0.14, 20, w * 0.88, h * 0.14, w * 0.72);
    g1.addColorStop(0, rgba(palette.primary, 0.65));
    g1.addColorStop(1, 'rgba(5,7,11,0)');
    ctx.fillStyle = g1;
    ctx.fillRect(0, 0, w, h);

    const g2 = ctx.createRadialGradient(w * 0.12, h * 0.82, 20, w * 0.12, h * 0.82, w * 0.55);
    g2.addColorStop(0, rgba(palette.accent, 0.24));
    g2.addColorStop(1, 'rgba(5,7,11,0)');
    ctx.fillStyle = g2;
    ctx.fillRect(0, 0, w, h);

    // Oversized background squad number
    if (numStr) {
      ctx.save();
      ctx.font = `900 ${isSt ? 560 : 480}px ${DISPLAY_FONT}`;
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(numStr, -18, 120);
      ctx.restore();
    }

    if (photo) {
      drawPhotoBox(ctx, photo, 0, isSt ? 150 : 60, w, h * (isSq ? 0.8 : 0.78), { ...photoOpts, fadeBottom: !options.cutout });
    }

    // Lower cinema scrim
    const scrim = ctx.createLinearGradient(0, h * 0.44, 0, h);
    scrim.addColorStop(0, 'rgba(5,7,11,0)');
    scrim.addColorStop(0.55, 'rgba(5,7,11,0.88)');
    scrim.addColorStop(1, '#05070B');
    ctx.fillStyle = scrim;
    ctx.fillRect(0, h * 0.42, w, h * 0.58);

    // Top architectural bar
    drawCrest(ctx, crest, pad, 56, 68, palette);
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `800 30px ${SANS_FONT}`;
    ctx.fillText(club.name.toUpperCase(), pad + 86, 62, w - 380);
    ctx.fillStyle = 'rgba(255,255,255,0.58)';
    ctx.font = `700 20px ${MONO_FONT}`;
    ctx.fillText((player.teamName || 'CLUB SQUAD').toUpperCase(), pad + 86, 98, w - 380);

    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(255,255,255,0.78)';
    ctx.font = `700 22px ${MONO_FONT}`;
    ctx.fillText(topDateLabel, w - pad, 64);
    if (numStr) {
      ctx.fillStyle = palette.accent;
      ctx.fillText(`NO. ${numStr}`, w - pad, 96);
    }

    ctx.strokeStyle = 'rgba(255,255,255,0.16)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(pad, 144);
    ctx.lineTo(w - pad, 144);
    ctx.stroke();

    // Hollow HAPPY + Solid BIRTHDAY
    const baseY = footerY - 170;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    const happyPx = isSq ? 128 : 148;
    const bdayPx = isSq ? 152 : 178;
    ctx.font = `900 ${happyPx}px ${DISPLAY_FONT}`;
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = 'rgba(255,255,255,0.48)';
    ctx.strokeText('HAPPY', pad, baseY - bdayPx * 0.84);

    ctx.font = `900 ${bdayPx}px ${DISPLAY_FONT}`;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText('BIRTHDAY', pad, baseY);

    // Player name + accent bar
    const namePx = fitFontSize(ctx, fullUpper, w - pad * 2 - 140, 56, 32, px => `900 ${px}px ${SANS_FONT}`);
    ctx.font = `900 ${namePx}px ${SANS_FONT}`;
    ctx.fillStyle = palette.accent;
    ctx.fillText(fullUpper, pad, baseY + 68);

    ctx.font = `700 22px ${MONO_FONT}`;
    ctx.fillStyle = 'rgba(255,255,255,0.62)';
    ctx.fillText(roleLine, pad, baseY + 108, w - pad * 2 - 140);

    ctx.fillStyle = palette.primary;
    ctx.fillRect(w - pad - 110, baseY + 74, 110, 12);

    drawSponsorFooter(ctx, w, footerY, pad, options.sponsors, club.name, false);
    drawFilmGrain(ctx, w, h, 0.05);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 02 // HERITAGE LUXE
  // ───────────────────────────────────────────────────────────────────────────
  else if (style === 'heritage') {
    const bg = ctx.createLinearGradient(0, 0, w * 0.4, h);
    bg.addColorStop(0, '#0D0D11');
    bg.addColorStop(1, palette.deep);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // Double gold hairline border
    ctx.strokeStyle = rgba(palette.accent, 0.42);
    ctx.lineWidth = 3;
    ctx.strokeRect(36, 36, w - 72, h - 72);
    ctx.strokeStyle = rgba(palette.accent, 0.18);
    ctx.lineWidth = 1.5;
    ctx.strokeRect(52, 52, w - 104, h - 104);

    // Top crest + metadata
    drawCrest(ctx, crest, w / 2 - 36, 76, 72, palette);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.font = `700 22px ${MONO_FONT}`;
    ctx.fillStyle = palette.accent;
    ctx.fillText(`${topDateLabel}  •  ${club.name.toUpperCase()}`, w / 2, 166, w - 160);

    // Framed editorial portrait
    const pw = isSq ? 460 : isSt ? 640 : 580;
    const ph = isSq ? 460 : isSt ? 840 : 620;
    const px = (w - pw) / 2;
    const py = isSt ? 260 : isSq ? 216 : 230;
    ctx.strokeStyle = rgba(palette.accent, 0.35);
    ctx.lineWidth = 2;
    ctx.strokeRect(px - 14, py - 14, pw + 28, ph + 28);
    ctx.fillStyle = '#07090D';
    ctx.fillRect(px, py, pw, ph);
    if (photo) drawPhotoBox(ctx, photo, px, py, pw, ph, photoOpts);

    // Gold NO. pill straddling bottom frame edge
    if (numStr) {
      const tagW = 190;
      const tagH = 48;
      ctx.fillStyle = palette.accent;
      ctx.fillRect(w / 2 - tagW / 2, py + ph - tagH / 2, tagW, tagH);
      ctx.fillStyle = '#0A0A0C';
      ctx.font = `800 24px ${MONO_FONT}`;
      ctx.textBaseline = 'middle';
      ctx.fillText(`NO. ${numStr}`, w / 2, py + ph);
    }

    // Editorial serif + wide-tracked name
    const textTop = py + ph + (isSq ? 44 : 58);
    ctx.textBaseline = 'top';
    ctx.font = `italic 52px ${SERIF_FONT}`;
    ctx.fillStyle = palette.accent;
    ctx.fillText('Happy Birthday', w / 2, textTop);

    const nameSize = fitFontSize(ctx, fullUpper, w - 180, 62, 34, s => `300 ${s}px ${SANS_FONT}`);
    ctx.font = `300 ${nameSize}px ${SANS_FONT}`;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(fullUpper, w / 2, textTop + 68);

    ctx.font = `700 21px ${MONO_FONT}`;
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillText(roleLine, w / 2, textTop + 144, w - 180);

    drawSponsorFooter(ctx, w, footerY - 12, 82, options.sponsors, club.name, false);
    drawFilmGrain(ctx, w, h, 0.045);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 03 // SWISS BRUTALIST
  // ───────────────────────────────────────────────────────────────────────────
  else if (style === 'swiss') {
    const lightInk = palette.inkOnPrimary === '#0A0A0C';
    const ink = palette.inkOnPrimary;
    const rule = lightInk ? 'rgba(10,10,14,0.28)' : 'rgba(255,255,255,0.32)';

    ctx.fillStyle = palette.primary;
    ctx.fillRect(0, 0, w, h);

    const headerH = isSq ? 160 : 185;
    const footerH = isSq ? 245 : 275;
    const bodyY = headerH;
    const bodyH = h - headerH - footerH;
    const railW = 148;

    // Header grid cells
    ctx.strokeStyle = rule;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(0, headerH); ctx.lineTo(w, headerH);
    ctx.moveTo(310, 0); ctx.lineTo(310, headerH);
    ctx.moveTo(w - 230, 0); ctx.lineTo(w - 230, headerH);
    ctx.moveTo(w - railW, bodyY); ctx.lineTo(w - railW, bodyY + bodyH);
    ctx.moveTo(0, bodyY + bodyH); ctx.lineTo(w, bodyY + bodyH);
    ctx.stroke();

    // Cell 1: Giant Number
    ctx.fillStyle = ink;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `900 118px ${DISPLAY_FONT}`;
    ctx.fillText(numStr || 'FC', 155, headerH / 2 + 6);

    // Cell 2: Technical Specs
    ctx.textAlign = 'left';
    ctx.font = `700 22px ${MONO_FONT}`;
    ctx.fillText(`DATE: ${player.dateShort}`, 346, headerH * 0.30);
    ctx.fillText(`ROLE: ${(player.position || 'PLAYER').toUpperCase()}`, 346, headerH * 0.53);
    ctx.fillText(`UNIT: ${(player.teamName || 'SQUAD').toUpperCase()}`, 346, headerH * 0.76, w - 600);

    // Cell 3: Crest
    drawCrest(ctx, crest, w - 158, headerH / 2 - 42, 84, palette);

    // Hero Portrait Cell
    ctx.fillStyle = '#07090D';
    ctx.fillRect(0, bodyY, w - railW, bodyH);
    if (photo) drawPhotoBox(ctx, photo, 0, bodyY, w - railW, bodyH, photoOpts);

    // Corner tag over photo
    const badge = showAge ? `AGE // ${player.turningAge}` : 'BIRTHDAY EDITION';
    ctx.fillStyle = 'rgba(7,9,13,0.85)';
    ctx.fillRect(32, bodyY + 32, 290, 48);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `700 20px ${MONO_FONT}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(badge, 50, bodyY + 56);

    // Vertical right rail text
    ctx.save();
    ctx.translate(w - railW / 2, bodyY + bodyH / 2);
    ctx.rotate(Math.PI / 2);
    ctx.fillStyle = ink;
    ctx.globalAlpha = 0.82;
    ctx.font = `700 24px ${MONO_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${club.name.toUpperCase()}  //  ${player.dateShort}`, 0, 0, bodyH - 60);
    ctx.restore();

    // Footer brutalist typography
    const fy = bodyY + bodyH;
    ctx.fillStyle = ink;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    const hbSize = fitFontSize(ctx, 'HAPPY BIRTHDAY', w - 96, 114, 72, s => `900 ${s}px ${DISPLAY_FONT}`);
    ctx.font = `900 ${hbSize}px ${DISPLAY_FONT}`;
    ctx.fillText('HAPPY BIRTHDAY', 48, fy + 24);

    const nmSize = fitFontSize(ctx, fullUpper, w - 260, 44, 28, s => `900 ${s}px ${SANS_FONT}`);
    ctx.font = `900 ${nmSize}px ${SANS_FONT}`;
    ctx.fillText(fullUpper, 48, fy + 24 + hbSize + 4);

    if (numStr) {
      ctx.textAlign = 'right';
      ctx.font = `700 24px ${MONO_FONT}`;
      ctx.fillText(`NO. ${numStr}`, w - 48, fy + 24 + hbSize + 14);
    }

    drawSponsorFooter(ctx, w, h - 84, 48, options.sponsors, club.name, lightInk);
    drawFilmGrain(ctx, w, h, 0.04);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 04 // KINETIC TYPE WALL
  // ───────────────────────────────────────────────────────────────────────────
  else if (style === 'kinetic') {
    const bg = ctx.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, palette.deep);
    bg.addColorStop(0.62, '#06080E');
    bg.addColorStop(1, rgba(palette.primary, 0.45));
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // Repeating stacked BIRTHDAY wall
    ctx.save();
    ctx.font = `900 168px ${DISPLAY_FONT}`;
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    const rows = Math.ceil(h / 145) + 1;
    for (let i = 0; i < rows; i++) {
      const y = i * 145 - 20;
      const x = i % 2 === 0 ? -40 : 40;
      const line = 'BIRTHDAY • BIRTHDAY • BIRTHDAY';
      if (i % 2 === 0) {
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.lineWidth = 3;
        ctx.strokeText(line, x, y);
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        ctx.fillText(line, x, y);
      }
    }
    ctx.restore();
    drawHalftone(ctx, w, h, 'rgba(255,255,255,0.08)', 26, 2.2);

    // Top bar
    ctx.fillStyle = palette.accent;
    ctx.fillRect(pad, 62, 310, 50);
    ctx.fillStyle = '#0A0A0C';
    ctx.font = `800 22px ${MONO_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(topDateLabel, pad + 155, 87, 290);
    drawCrest(ctx, crest, w - pad - 72, 54, 72, palette);

    // Center floating portrait breaking the wall
    const pw = isSq ? 540 : isSt ? 690 : 650;
    const ph = isSq ? 540 : isSt ? 940 : 720;
    const px = (w - pw) / 2;
    const py = isSq ? 168 : isSt ? 260 : 200;

    // Glow behind frame
    const gl = ctx.createRadialGradient(w / 2, py + ph / 2, 40, w / 2, py + ph / 2, pw * 0.72);
    gl.addColorStop(0, rgba(palette.primary, 0.58));
    gl.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gl;
    ctx.fillRect(0, py - 120, w, ph + 240);

    ctx.fillStyle = '#07090D';
    ctx.fillRect(px, py, pw, ph);
    if (photo) drawPhotoBox(ctx, photo, px, py, pw, ph, photoOpts);
    ctx.strokeStyle = palette.accent;
    ctx.lineWidth = 6;
    ctx.strokeRect(px, py, pw, ph);

    // Angled kinetic name slash
    ctx.save();
    ctx.translate(w / 2, py + ph - 70);
    ctx.rotate(-0.045);
    const slashW = pw + 70;
    ctx.fillStyle = palette.primary;
    ctx.fillRect(-slashW / 2, -48, slashW, 96);
    ctx.fillStyle = palette.inkOnPrimary;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const snPx = fitFontSize(ctx, fullUpper, slashW - 230, 56, 30, s => `900 ${s}px ${DISPLAY_FONT}`);
    ctx.font = `900 ${snPx}px ${DISPLAY_FONT}`;
    ctx.fillText(fullUpper, -slashW / 2 + 36, 2);
    if (numStr) {
      ctx.textAlign = 'right';
      ctx.font = `900 50px ${DISPLAY_FONT}`;
      ctx.fillText(`#${numStr}`, slashW / 2 - 36, 2);
    }
    ctx.restore();

    // Bottom lockup (auto-fitted so it never collides with team label)
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    const kineticHbPx = fitFontSize(ctx, 'HAPPY BIRTHDAY', w - pad * 2 - 280, 84, 56, s => `900 ${s}px ${DISPLAY_FONT}`);
    ctx.font = `900 ${kineticHbPx}px ${DISPLAY_FONT}`;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText('HAPPY BIRTHDAY', pad, footerY - 34);

    ctx.textAlign = 'right';
    ctx.font = `700 20px ${MONO_FONT}`;
    ctx.fillStyle = 'rgba(255,255,255,0.72)';
    ctx.fillText((player.teamName || club.name).toUpperCase(), w - pad, footerY - 40, 250);

    drawSponsorFooter(ctx, w, footerY, pad, options.sponsors, club.name, false);
    drawFilmGrain(ctx, w, h, 0.05);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 05 // DUOTONE MONOGRAPH
  // ───────────────────────────────────────────────────────────────────────────
  else if (style === 'monograph') {
    ctx.fillStyle = '#0A0A0C';
    ctx.fillRect(0, 0, w, h);

    const railW = 128;
    if (photo) {
      drawPhotoBox(ctx, photo, 0, 0, w - railW, h, { ...photoOpts, grayscale: true });
    }

    // Editorial dark vignette left/bottom
    const vig = ctx.createLinearGradient(0, 0, 0, h);
    vig.addColorStop(0, 'rgba(8,8,10,0.52)');
    vig.addColorStop(0.45, 'rgba(8,8,10,0.18)');
    vig.addColorStop(0.84, 'rgba(8,8,10,0.96)');
    vig.addColorStop(1, '#08080A');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, w - railW, h);

    // Electric club-colour right rail
    ctx.fillStyle = palette.primary;
    ctx.fillRect(w - railW, 0, railW, h);
    ctx.fillStyle = palette.inkOnPrimary;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.font = `900 68px ${DISPLAY_FONT}`;
    ctx.fillText(numStr || 'FC', w - railW / 2, 54);

    ctx.save();
    ctx.translate(w - railW / 2, h / 2 + 20);
    ctx.rotate(Math.PI / 2);
    ctx.font = `800 26px ${MONO_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`HAPPY BIRTHDAY  //  ${player.dateShort}`, 0, 0, h - 280);
    ctx.restore();

    // Top-left crest + club
    drawCrest(ctx, crest, pad, 56, 66, palette);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = `700 24px ${MONO_FONT}`;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText(club.name.toUpperCase(), pad + 84, 89, w - railW - pad * 2 - 90);

    // Bottom editorial serif + stacked display name (clear breathing room above subtitle)
    const maxNameW = w - railW - pad * 2;
    const nameY = footerY - 144;
    ctx.fillStyle = palette.primary;
    ctx.fillRect(pad, nameY - 224, 96, 8);

    ctx.textBaseline = 'alphabetic';
    ctx.font = `italic 54px ${SERIF_FONT}`;
    ctx.fillStyle = 'rgba(255,255,255,0.88)';
    ctx.fillText('Happy Birthday,', pad, nameY - 152);

    if (first) {
      const fPx = fitFontSize(ctx, first, maxNameW, 118, 62, s => `900 ${s}px ${DISPLAY_FONT}`);
      ctx.font = `900 ${fPx}px ${DISPLAY_FONT}`;
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(first, pad, nameY - 38);
    }
    const rPx = fitFontSize(ctx, rest, maxNameW, 122, 62, s => `900 ${s}px ${DISPLAY_FONT}`);
    ctx.font = `900 ${rPx}px ${DISPLAY_FONT}`;
    ctx.fillStyle = palette.accent;
    ctx.fillText(rest, pad, nameY + 66);

    ctx.font = `700 22px ${MONO_FONT}`;
    ctx.fillStyle = 'rgba(255,255,255,0.62)';
    const sub = showAge ? `TURNING ${player.turningAge}  //  ${roleLine}` : roleLine;
    ctx.fillText(sub, pad, footerY - 26, maxNameW);

    drawSponsorFooter(ctx, w - railW, footerY, pad, options.sponsors, club.name, false);
    drawFilmGrain(ctx, w, h, 0.055);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 06 // STADIUM MAGAZINE
  // ───────────────────────────────────────────────────────────────────────────
  else if (style === 'magazine') {
    ctx.fillStyle = '#090B10';
    ctx.fillRect(0, 0, w, h);

    // Start portrait cleanly below the masthead so the headline never covers the player's face
    const magPhotoY = isSq ? 175 : 210;
    if (photo) drawPhotoBox(ctx, photo, 0, magPhotoY, w, h - magPhotoY, photoOpts);

    // Top masthead blend + bottom cover scrim
    const topG = ctx.createLinearGradient(0, magPhotoY - 20, 0, magPhotoY + 120);
    topG.addColorStop(0, '#090B10');
    topG.addColorStop(1, 'rgba(9,11,16,0)');
    ctx.fillStyle = topG;
    ctx.fillRect(0, 0, w, magPhotoY + 120);

    const botG = ctx.createLinearGradient(0, h * 0.5, 0, h);
    botG.addColorStop(0, 'rgba(7,9,14,0)');
    botG.addColorStop(0.55, 'rgba(7,9,14,0.8)');
    botG.addColorStop(1, '#07090E');
    ctx.fillStyle = botG;
    ctx.fillRect(0, h * 0.5, w, h * 0.5);

    // Magazine Header Line
    ctx.textBaseline = 'top';
    ctx.font = `700 21px ${MONO_FONT}`;
    ctx.fillStyle = 'rgba(255,255,255,0.76)';
    ctx.textAlign = 'left';
    ctx.fillText(`${club.name.toUpperCase()} OFFICIAL`, pad, 52);
    ctx.textAlign = 'right';
    ctx.fillText(`ISSUE ${numStr || '01'}  •  ${player.dateShort}`, w - pad, 52);

    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(pad, 88);
    ctx.lineTo(w - pad, 88);
    ctx.stroke();

    // Giant Masthead BIRTHDAY
    ctx.textAlign = 'center';
    const mastPx = fitFontSize(ctx, 'BIRTHDAY', w - pad * 2, isSq ? 165 : 185, 110, s => `900 ${s}px ${DISPLAY_FONT}`);
    ctx.font = `900 ${mastPx}px ${DISPLAY_FONT}`;
    ctx.fillStyle = palette.accent;
    ctx.fillText('BIRTHDAY', w / 2, 100);

    // Bottom Magazine Cover Lockup
    const tagText = showAge ? `CELEBRATING ${player.turningAge} YEARS` : 'HAPPY BIRTHDAY';
    ctx.font = `800 22px ${MONO_FONT}`;
    const tagW = Math.min(w - pad * 2, ctx.measureText(tagText).width + 48);
    const lockY = footerY - 210;
    ctx.fillStyle = palette.primary;
    ctx.fillRect(pad, lockY - 46, tagW, 44);
    ctx.fillStyle = palette.inkOnPrimary;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(tagText, pad + 24, lockY - 24);

    ctx.textBaseline = 'alphabetic';
    const maxW = w - pad * 2 - 140;
    if (first) {
      const fPx = fitFontSize(ctx, first, maxW, 66, 36, s => `300 ${s}px ${SANS_FONT}`);
      ctx.font = `300 ${fPx}px ${SANS_FONT}`;
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.fillText(first, pad, lockY + 66);
    }
    const lPx = fitFontSize(ctx, rest, maxW, 134, 66, s => `900 ${s}px ${DISPLAY_FONT}`);
    ctx.font = `900 ${lPx}px ${DISPLAY_FONT}`;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(rest, pad, lockY + 174);

    drawCrest(ctx, crest, w - pad - 88, lockY + 64, 88, palette);
    ctx.textAlign = 'right';
    ctx.font = `700 20px ${MONO_FONT}`;
    ctx.fillStyle = 'rgba(255,255,255,0.72)';
    ctx.fillText(`${numStr ? `#${numStr} ` : ''}${(player.position || '').toUpperCase()}`.trim(), w - pad, lockY + 174);

    drawSponsorFooter(ctx, w, footerY, pad, options.sponsors, club.name, false);
    drawFilmGrain(ctx, w, h, 0.05);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 07 // ARCHITECTURAL KIT (No-Photo / Junior Safe)
  // ───────────────────────────────────────────────────────────────────────────
  else {
    const bg = ctx.createRadialGradient(w / 2, h * 0.4, 40, w / 2, h * 0.4, h * 0.72);
    bg.addColorStop(0, rgba(palette.primary, 0.42));
    bg.addColorStop(1, '#070A12');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // Architectural pitch lines
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 2;
    ctx.strokeRect(48, 48, w - 96, h - 96);
    ctx.beginPath();
    ctx.moveTo(48, h / 2);
    ctx.lineTo(w - 48, h / 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 155, 0, Math.PI * 2);
    ctx.stroke();

    // Top bar
    drawCrest(ctx, crest, 76, 76, 68, palette);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = `800 30px ${SANS_FONT}`;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(club.name.toUpperCase(), 162, 110, w - 420);

    ctx.textAlign = 'right';
    ctx.font = `700 22px ${MONO_FONT}`;
    ctx.fillStyle = palette.accent;
    ctx.fillText(topDateLabel, w - 76, 110);

    ctx.strokeStyle = 'rgba(255,255,255,0.16)';
    ctx.beginPath();
    ctx.moveTo(76, 166);
    ctx.lineTo(w - 76, 166);
    ctx.stroke();

    // Architectural jersey centerpiece
    const jScale = isSq ? 1.12 : isSt ? 1.56 : 1.36;
    const jY = isSq ? h * 0.44 : isSt ? h * 0.47 : h * 0.46;
    drawArchitecturalJersey(ctx, w / 2, jY, jScale, numStr || '★', rest || fullUpper, palette);

    // Bottom typography
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.font = `700 24px ${MONO_FONT}`;
    ctx.fillStyle = palette.accent;
    ctx.fillText('HAPPY BIRTHDAY', w / 2, footerY - 148);

    const kName = fitFontSize(ctx, fullUpper, w - 160, 108, 52, s => `900 ${s}px ${DISPLAY_FONT}`);
    ctx.font = `900 ${kName}px ${DISPLAY_FONT}`;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(fullUpper, w / 2, footerY - 62);

    ctx.font = `700 22px ${MONO_FONT}`;
    ctx.fillStyle = 'rgba(255,255,255,0.58)';
    ctx.fillText(roleLine, w / 2, footerY - 24, w - 160);

    drawSponsorFooter(ctx, w, footerY, 76, options.sponsors, club.name, false);
    drawFilmGrain(ctx, w, h, 0.05);
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => (blob ? resolve(blob) : reject(new Error('Could not build birthday graphic.'))), 'image/png');
  });
}
