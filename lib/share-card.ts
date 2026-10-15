'use client';

// Matchday graphics (fixture / result / starting XI / Player of the Match) drawn on a canvas in the
// browser: a 9:16 story (Instagram and Facebook stories, WhatsApp status), a 4:5 post (Instagram feed,
// Facebook groups, WhatsApp chats) and a 1:1 square (the free result graphic maker only, for Facebook
// posts and websites). Nothing runs on the server and nothing new is installed.
import { DEFAULT_CREST } from '@/lib/crest';
import { corsCopy } from '@/lib/image-color';
import { SITE_URL } from '@/lib/slugs';
import { readableClubInk } from '@/lib/theme-utils';
import { juniorPublicName } from '@/lib/teams';
import type { Club, Match, MatchEvent } from '@/lib/supabase/types';
import { DATE_LOCALE } from '@/lib/dates';

/** score: fixture or result; lineup: the XI on the pitch; lineup-list: the XI as a numbered list;
 *  motm: Player of the Match (the free result graphic maker) */
export type CardKind = 'score' | 'lineup' | 'lineup-list' | 'motm';
/** square is laid out for the score and motm cards only (the lineup cards offer story and post) */
export type CardFormat = 'story' | 'post' | 'square';

export const CARD_SIZES: Record<CardFormat, { w: number; h: number }> = {
  story: { w: 1080, h: 1920 },
  post: { w: 1080, h: 1350 },
  square: { w: 1080, h: 1080 },
};

export interface CardOptions {
  format?: CardFormat;
  /** The team hides its scores publicly (junior grassroots rules): no score and no scorers */
  hideScore?: boolean;
  /** The match's events, already shortened for junior players; goals become the scorer lines */
  events?: Pick<MatchEvent, 'event_type' | 'team_side' | 'player_name' | 'minute' | 'added_minute'>[];
  /** Player photos by member id, as the public lineup shows them (none for juniors without consent) */
  photos?: Record<string, string | undefined>;
  /** The two-tone headline in place of the default (the free lineup builder's "STARTING FIVE") */
  headline?: [string, string];
  /** Keep the lineup in the order given (the free lineup builder's own list order) instead of back to front */
  keepOrder?: boolean;
  /** The player marker's shape on the pitch (circle unless chosen in the free lineup builder) */
  marker?: MarkerShape;
  /** A photo behind the card (the free result graphic maker): darkened by `dim` (0–1), with
   *  `focusY` (0 top – 1 bottom) choosing which part of a tall photo shows. Panels turn to frosted glass over it */
  background?: { src: string; focusY?: number; dim?: number };
  /** Player of the Match: a row on the result card, and the subject of the motm card */
  motm?: { name: string; photo?: string; line?: string; focusY?: number; /** The photo is a cut-out (background removed) */ cutout?: boolean; /** Font family for the name (a brush script on the free tool), so it stands apart from the headline */ nameFont?: string;
    /** Zoom on the photo (1 = fit) and its sideways position (0 to 1, 0.5 = centred; on a cut-out also focusY moves it, 0.3 = resting) */ zoom?: number; focusX?: number };
  /** Scorer lines with a ball beside each, as left-aligned blocks (the free result graphic maker) */
  scorerBalls?: boolean;
  /** Icons beside the date, the ground and the Player of the Match's stats (the free result graphic maker) */
  icons?: boolean;
}

export type MarkerShape = 'circle' | 'jersey' | 'square' | 'triangle' | 'hexagon';

/** Outline points of the non-circle markers in a 100 × 100 box, shared by the builder's pitch (SVG) and the image */
export const MARKER_POINTS: Record<'jersey' | 'triangle' | 'hexagon', [number, number][]> = {
  jersey: [[35, 6], [43, 6], [50, 15], [57, 6], [65, 6], [96, 22], [87, 44], [76, 39], [76, 96], [24, 96], [24, 39], [13, 44], [4, 22]],
  triangle: [[50, 4], [97, 92], [3, 92]],
  hexagon: [[50, 2], [93, 26], [93, 74], [50, 98], [7, 74], [7, 26]],
};

/** How far a marker's initials sit below its centre (a triangle's and a shirt's middle is lower), as a share of its radius */
export const MARKER_TEXT_DROP: Record<MarkerShape, number> = { circle: 0, square: 0, hexagon: 0, jersey: 0.14, triangle: 0.32 };
/** How big a marker's initials are next to a circle's (a shirt's body and a triangle's middle are narrower) */
export const MARKER_TEXT_SCALE: Record<MarkerShape, number> = { circle: 1, square: 1, hexagon: 1, jersey: 0.9, triangle: 0.72 };

/** Starts a new path in the marker's shape, centred on (cx, cy) with "radius" r */
function markerPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, shape: MarkerShape = 'circle') {
  ctx.beginPath();
  if (shape === 'circle') {
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    return;
  }
  const R = r * 1.1; // the corners of a shape need a little more room than a circle to look the same size
  if (shape === 'square') {
    if (typeof ctx.roundRect === 'function') ctx.roundRect(cx - R * 0.9, cy - R * 0.9, R * 1.8, R * 1.8, R * 0.38);
    else ctx.rect(cx - R * 0.9, cy - R * 0.9, R * 1.8, R * 1.8);
    return;
  }
  MARKER_POINTS[shape].forEach(([x, y], i) => {
    const px = cx - R + (x / 100) * 2 * R;
    const py = cy - R + (y / 100) * 2 * R;
    if (i) ctx.lineTo(px, py);
    else ctx.moveTo(px, py);
  });
  ctx.closePath();
}

const BASE = '#070B12';
const INK = '#F8FAFC';
const MUTED = 'rgba(248, 250, 252, 0.68)';
const FAINT = 'rgba(248, 250, 252, 0.42)';

const hex = (c: string | undefined, fallback: string) => (c && /^#[0-9a-f]{6}$/i.test(c) ? c : fallback);
const rgba = (c: string, a: number) => {
  const n = parseInt(c.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise(resolve => {
    const img = new Image();
    img.crossOrigin = 'anonymous'; // without CORS the canvas would be tainted and couldn't be exported
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = /^(data|blob):/i.test(src) ? src : corsCopy(src);
  });
}

/** A crest, or the neutral shield when it's missing or its host doesn't allow CORS */
async function crest(src: string | undefined) {
  return (src && (await loadImage(src))) || loadImage(DEFAULT_CREST);
}

/** Largest font size (down to `min`) at which `text` fits `maxWidth` */
function fit(ctx: CanvasRenderingContext2D, text: string, weight: number, size: number, maxWidth: number, family: string, min = 24) {
  for (; size > min; size -= 2) {
    ctx.font = `${weight} ${size}px ${family}`;
    if (ctx.measureText(text).width <= maxWidth) return size;
  }
  ctx.font = `${weight} ${min}px ${family}`;
  return min;
}

/** `text` cut with "…" to fit `maxWidth` at the current font */
function ellipsize(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxWidth) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
}

/** Up to two centred lines (a long team name wraps instead of shrinking to nothing) */
function wrapTwo(ctx: CanvasRenderingContext2D, text: string, weight: number, size: number, maxWidth: number, family: string, x: number, y: number) {
  ctx.font = `${weight} ${size}px ${family}`;
  if (ctx.measureText(text).width <= maxWidth || !text.includes(' ')) {
    fit(ctx, text, weight, size, maxWidth, family);
    ctx.fillText(text, x, y);
    return;
  }
  const words = text.split(' ');
  let best = 1;
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(' ');
    const b = words.slice(i).join(' ');
    const bestA = words.slice(0, best).join(' ');
    const bestB = words.slice(best).join(' ');
    if (Math.max(ctx.measureText(a).width, ctx.measureText(b).width) < Math.max(ctx.measureText(bestA).width, ctx.measureText(bestB).width)) best = i;
  }
  const lines = [words.slice(0, best).join(' '), words.slice(best).join(' ')];
  const s = Math.min(...lines.map(l => fit(ctx, l, weight, Math.round(size * 0.86), maxWidth, family)));
  ctx.font = `${weight} ${s}px ${family}`;
  ctx.fillText(lines[0], x, y - s * 0.55);
  ctx.fillText(lines[1], x, y + s * 0.55);
}

function drawContain(ctx: CanvasRenderingContext2D, img: HTMLImageElement | null, cx: number, cy: number, box: number) {
  if (!img) return;
  const scale = Math.min(box / (img.naturalWidth || box), box / (img.naturalHeight || box));
  const w = (img.naturalWidth || box) * scale;
  const h = (img.naturalHeight || box) * scale;
  ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h);
}

/** Fills the box with the image, cropped to fit; `focusY` picks which part of a tall image shows */
function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number, focusY = 0.5, zoom = 1, focusX = 0.5) {
  const scale = Math.max(w / (img.naturalWidth || w), h / (img.naturalHeight || h)) * Math.max(1, zoom);
  const iw = (img.naturalWidth || w) * scale;
  const ih = (img.naturalHeight || h) * scale;
  ctx.drawImage(img, x + (w - iw) * Math.min(1, Math.max(0, focusX)), y + (h - ih) * Math.min(1, Math.max(0, focusY)), iw, ih);
}

/** A football: white with a dark pentagon, for the scorer lines */
function ball(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = INK;
  ctx.fill();
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    const px = cx + Math.cos(a) * r * 0.36;
    const py = cy + Math.sin(a) * r * 0.36;
    if (i) ctx.lineTo(px, py);
    else ctx.moveTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = '#0B1220';
  ctx.fill();
}

/** A five-point star */
function star(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, fill: string) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 ? r * 0.45 : r;
    ctx.lineTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

// Line icons on a 24 × 24 grid (calendar, map pin and shield are Lucide's, ISC licence; the boot is ours)
type IconName = 'calendar' | 'pin' | 'ball' | 'boot' | 'shield' | 'glove' | 'star';
const ICON_PATHS: Partial<Record<IconName, string[]>> = {
  calendar: ['M8 2v4', 'M16 2v4', 'M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z', 'M3 10h18'],
  pin: ['M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0', 'M15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0'],
  shield: ['M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z'],
  boot: ['M4 5h6v5l7.5 2.6c2 .7 3.5 2.3 3.5 4.4V18H4z', 'M4 14h17', 'M7 18v2', 'M12 18v2', 'M17 18v2'],
  glove: ['M7 21h9a3 3 0 0 0 3-3v-7a1.5 1.5 0 0 0-3 0V7a1.5 1.5 0 0 0-3 0V5a1.5 1.5 0 0 0-3 0v1a1.5 1.5 0 0 0-3 0v8l-1.6-1.6a1.5 1.5 0 0 0-2.1 2.1L7 18z'],
};

/** One icon, centred on (cx, cy) and `size` across, in `colour` */
function icon(ctx: CanvasRenderingContext2D, name: IconName, cx: number, cy: number, size: number, colour: string) {
  if (name === 'ball') return ball(ctx, cx, cy, size * 0.42);
  if (name === 'star') return star(ctx, cx, cy, size * 0.5, colour);
  ctx.save();
  ctx.translate(cx - size / 2, cy - size / 2);
  ctx.scale(size / 24, size / 24);
  ctx.strokeStyle = colour;
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const d of ICON_PATHS[name] || []) ctx.stroke(new Path2D(d));
  ctx.restore();
}

/** The icon for one part of a Player of the Match line, like "2 goals" or "1 assist" */
function statIcon(part: string): IconName {
  const p = part.toLowerCase();
  if (/goal|hat.?trick|brace|scor/.test(p)) return 'ball';
  if (/assist/.test(p)) return 'boot';
  if (/clean sheet|tackle|block|intercept|defen/.test(p)) return 'shield';
  if (/save|keeper|stop/.test(p)) return 'glove';
  return 'star';
}

/** A centred row of icon + text pairs at `y`, shrunk to fit `maxWidth` */
function iconRow(ctx: CanvasRenderingContext2D, items: { icon: IconName; text: string }[], y: number, size: number, weight: number,
  family: string, maxWidth: number, textColour: string, iconColour: string) {
  items = items.filter(i => i.text.trim());
  if (!items.length) return;
  const widthAt = (s: number) => {
    ctx.font = `${weight} ${s}px ${family}`;
    return items.reduce((w, i) => w + s * 1.05 + s * 0.4 + ctx.measureText(i.text).width, 0) + (items.length - 1) * s * 1.1;
  };
  let s = size;
  while (s > 16 && widthAt(s) > maxWidth) s -= 1;
  const total = widthAt(s);
  let cursor = ctx.canvas.width / 2 - total / 2;
  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  for (const it of items) {
    icon(ctx, it.icon, cursor + s * 0.52, y, s * 1.05, iconColour);
    cursor += s * 1.05 + s * 0.4;
    ctx.fillStyle = textColour;
    ctx.fillText(it.text, cursor, y);
    cursor += ctx.measureText(it.text).width + s * 1.1;
  }
  ctx.restore();
}

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '';
  return (parts[0].charAt(0) + (parts.length > 1 ? parts[parts.length - 1].charAt(0) : '')).toUpperCase();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
}

/** The site's glass panel: a faint white fill with a hairline border. Over a photo (`backdrop`) the
 *  photo shows through blurred, like frosted glass */
function glass(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r = 44, backdrop?: HTMLCanvasElement) {
  if (backdrop) {
    // Blur by drawing the backdrop tiny and scaling it back up (no canvas filter needed, so it works in every browser)
    const small = document.createElement('canvas');
    small.width = Math.max(1, Math.round(w / 24));
    small.height = Math.max(1, Math.round(h / 24));
    small.getContext('2d')?.drawImage(backdrop, x, y, w, h, 0, 0, small.width, small.height);
    ctx.save();
    roundRect(ctx, x, y, w, h, r);
    ctx.clip();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(small, x, y, w, h);
    ctx.fillStyle = 'rgba(8, 12, 18, 0.38)';
    ctx.fillRect(x, y, w, h);
    ctx.restore();
  }
  roundRect(ctx, x, y, w, h, r);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.055)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 2;
  ctx.stroke();
}

/** Letter-spaced text where the browser supports it (small caps labels) */
function spaced(ctx: CanvasRenderingContext2D, px: number) {
  if ('letterSpacing' in ctx) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${px}px`;
}

/** "Sat 4 Oct" and "14:30". Date-only fixtures (tournaments) keep their own date and local kick-off time */
function kickoff(m: Pick<Match, 'match_date' | 'match_time'>, locale: string = DATE_LOCALE): { day: string; time: string } {
  const d = new Date(m.match_date);
  if (isNaN(d.getTime())) return { day: '', time: m.match_time || '' };
  const dateOnly = !!m.match_time && d.getUTCHours() === 0 && d.getUTCMinutes() === 0;
  const day = d.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short', ...(dateOnly ? { timeZone: 'UTC' } : {}) });
  const time = m.match_time || d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  return { day, time };
}

/** The big two-tone headline: first word white, second in the club colour */
function headline(m: Pick<Match, 'status'>, scored: boolean): [string, string] {
  if (m.status === 'completed') return ['FULL', 'TIME'];
  if (m.status === 'live') return scored ? ['LIVE', 'SCORE'] : ['MATCH', 'DAY'];
  if (m.status === 'halftime') return ['HALF', 'TIME'];
  if (m.status === 'postponed') return ['POST', 'PONED'];
  if (m.status === 'cancelled') return ['CANCEL', 'LED'];
  return ['MATCH', 'DAY'];
}

/** "Leo Park 23', 67' (P)", one line per scorer, in the order they first scored */
function scorerLines(events: NonNullable<CardOptions['events']>, side: 'home' | 'away'): string[] {
  const byName = new Map<string, string[]>();
  events
    .filter(e => e.team_side === side && (e.event_type === 'goal' || e.event_type === 'penalty') && e.player_name)
    .sort((a, b) => a.minute - b.minute || (a.added_minute || 0) - (b.added_minute || 0))
    .forEach(e => {
      // A negative minute is a goal with no time given (the free result graphic maker): just "(P)" if a penalty
      const minute = e.minute < 0
        ? (e.event_type === 'penalty' ? '(P)' : '')
        : `${e.minute}${e.added_minute ? `+${e.added_minute}` : ''}'${e.event_type === 'penalty' ? ' (P)' : ''}`;
      byName.set(e.player_name, [...(byName.get(e.player_name) || []), minute]);
    });
  return [...byName].map(([name, minutes]) => {
    const times = minutes.filter(Boolean);
    // Two untimed goals: "Leo Park ×2"
    const untimed = minutes.length - times.length;
    return [name, times.join(', '), untimed > 1 && !times.length ? `×${untimed}` : ''].filter(Boolean).join(' ');
  });
}

export async function drawMatchCard(match: Match, club: Club, kind: CardKind, link: string, opts: CardOptions = {}): Promise<Blob> {
  const format = opts.format || 'post';
  const { w: W, h: H } = CARD_SIZES[format];
  const story = format === 'story';
  const square = format === 'square';
  /** The value for this size: story, post or square */
  const by = <T,>(st: T, po: T, sq: T): T => (story ? st : square ? sq : po);
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available in this browser.');

  // The site's own fonts: Outfit for headings, Plus Jakarta Sans for text
  const rootStyle = getComputedStyle(document.documentElement);
  const body = getComputedStyle(document.body).fontFamily || 'system-ui, sans-serif';
  const outfit = rootStyle.getPropertyValue('--font-outfit').trim();
  const heading = outfit ? `${outfit}, ${body}` : body;
  const jetbrains = rootStyle.getPropertyValue('--font-jetbrains').trim();
  const mono = jetbrains ? `${jetbrains}, monospace` : 'monospace';
  await Promise.all([`900 100px ${heading}`, `800 40px ${heading}`, `700 30px ${body}`, `600 30px ${body}`]
    .map(f => document.fonts?.load(f).catch(() => null)));

  const primary = hex(club.primary_color, '#10B981');
  const secondary = hex(club.secondary_color, primary);
  const ink = readableClubInk(primary, 'dark'); // the club colour, lifted until it reads on the dark card
  const clubCrest = await crest(club.logo_url);
  const [backgroundPhoto, motmPhoto] = await Promise.all([
    opts.background?.src ? loadImage(opts.background.src) : Promise.resolve(null),
    kind === 'motm' && opts.motm?.photo ? loadImage(opts.motm.photo) : Promise.resolve(null),
  ]);
  // On the Player of the Match card the player's own photo takes the place of the background photo,
  // unless it's a cut-out: then the player stands in front of it (or of the club colours)
  const cutout = !!motmPhoto && !!opts.motm?.cutout;
  const photo = motmPhoto && !cutout ? null : backgroundPhoto;
  // The Player of the Match photo fills the top of its card and fades into the background below
  const motmPhotoH = by(1300, 960, 760);
  const overPhoto = !!photo || (!!motmPhoto && !cutout);

  // Background: near-black with the club colour glowing in from the top, a soft streak across,
  // the pass card's dot grid and the crest large and faded behind everything (over a photo: the
  // photo, darkened so the text reads, and a softer glow)
  ctx.fillStyle = BASE;
  ctx.fillRect(0, 0, W, H);
  if (photo) {
    drawCover(ctx, photo, 0, 0, W, H, opts.background?.focusY ?? 0.5);
    const dim = Math.min(0.9, Math.max(0.15, opts.background?.dim ?? 0.55));
    const shade = ctx.createLinearGradient(0, 0, 0, H);
    shade.addColorStop(0, `rgba(7, 11, 18, ${Math.min(0.95, dim + 0.15)})`);
    shade.addColorStop(0.35, `rgba(7, 11, 18, ${dim - 0.1})`);
    shade.addColorStop(0.7, `rgba(7, 11, 18, ${Math.min(0.95, dim + 0.1)})`);
    shade.addColorStop(1, 'rgba(7, 11, 18, 0.94)');
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, W, H);
  }
  if (motmPhoto && !cutout) {
    drawCover(ctx, motmPhoto, 0, 0, W, motmPhotoH, opts.motm?.focusY ?? 0.3, opts.motm?.zoom, opts.motm?.focusX);
    const fade = ctx.createLinearGradient(0, 0, 0, motmPhotoH);
    fade.addColorStop(0, 'rgba(7, 11, 18, 0.75)');
    fade.addColorStop(0.3, 'rgba(7, 11, 18, 0.1)');
    fade.addColorStop(0.62, 'rgba(7, 11, 18, 0.25)');
    fade.addColorStop(1, BASE);
    ctx.fillStyle = fade;
    ctx.fillRect(0, 0, W, motmPhotoH);
    ctx.fillStyle = BASE;
    ctx.fillRect(0, motmPhotoH - 1, W, H - motmPhotoH + 1);
  }
  const glow = ctx.createRadialGradient(W * 0.3, -H * 0.05, 0, W * 0.3, -H * 0.05, H * 0.75);
  glow.addColorStop(0, rgba(primary, overPhoto ? 0.55 : 0.75));
  glow.addColorStop(0.45, rgba(primary, overPhoto ? 0.14 : 0.22));
  glow.addColorStop(1, rgba(primary, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
  const low = ctx.createRadialGradient(W, H, 0, W, H, H * 0.55);
  low.addColorStop(0, rgba(secondary === primary ? primary : secondary, 0.22));
  low.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = low;
  ctx.fillRect(0, 0, W, H);
  if (!overPhoto) {
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.rotate(-0.42);
    const streak = ctx.createLinearGradient(-90, 0, 90, 0);
    streak.addColorStop(0, 'rgba(255, 255, 255, 0)');
    streak.addColorStop(0.5, rgba(primary, 0.16));
    streak.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = streak;
    ctx.fillRect(-90, -H, 180, H * 2);
    ctx.restore();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.045)';
    for (let y = 24; y < H; y += 36) for (let x = 24; x < W; x += 36) ctx.fillRect(x, y, 3, 3);
    if (clubCrest) {
      ctx.save();
      ctx.globalAlpha = 0.07;
      ctx.filter = 'grayscale(1) brightness(1.8)';
      drawContain(ctx, clubCrest, W / 2, H * 0.56, story ? 1100 : 900);
      ctx.restore();
    }
  }
  if (motmPhoto && cutout) {
    // The cut-out player, standing on the headline with a glow of the club colour behind them,
    // fading out at the bottom so the headline reads over their kit
    const top = by(330, 170, 130);
    const bottom = by(1180, 880, 680);
    const boxW = W - 144;
    const zoom = Math.max(1, opts.motm?.zoom ?? 1);
    const scale = Math.min(boxW / motmPhoto.naturalWidth, (bottom - top) / motmPhoto.naturalHeight) * zoom;
    // Moved by the person: sideways by focusX, and up or down by focusY from its resting 0.3
    const dx = ((opts.motm?.focusX ?? 0.5) - 0.5) * W;
    const dy = ((opts.motm?.focusY ?? 0.3) - 0.3) * H;
    const pw = Math.round(motmPhoto.naturalWidth * scale);
    const ph = Math.round(motmPhoto.naturalHeight * scale);
    const player = document.createElement('canvas');
    player.width = pw;
    player.height = ph;
    const pctx = player.getContext('2d');
    if (pctx) {
      pctx.drawImage(motmPhoto, 0, 0, pw, ph);
      pctx.globalCompositeOperation = 'destination-out';
      const fadeOut = pctx.createLinearGradient(0, ph * 0.72, 0, ph);
      fadeOut.addColorStop(0, 'rgba(0, 0, 0, 0)');
      fadeOut.addColorStop(1, 'rgba(0, 0, 0, 1)');
      pctx.fillStyle = fadeOut;
      pctx.fillRect(0, 0, pw, ph);
      const halo = ctx.createRadialGradient(W / 2 + dx, bottom + dy - ph * 0.55, 0, W / 2 + dx, bottom + dy - ph * 0.55, Math.max(pw, ph) * 0.7);
      halo.addColorStop(0, rgba(primary, 0.45));
      halo.addColorStop(1, rgba(primary, 0));
      ctx.fillStyle = halo;
      ctx.fillRect(0, 0, W, H);
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
      ctx.shadowBlur = 40;
      ctx.drawImage(player, (W - pw) / 2 + dx, bottom + dy - ph);
      ctx.restore();
    }
  }
  // What the frosted panels blur, when there's a photo
  let backdrop: HTMLCanvasElement | undefined;
  if (overPhoto) {
    backdrop = document.createElement('canvas');
    backdrop.width = W;
    backdrop.height = H;
    backdrop.getContext('2d')?.drawImage(canvas, 0, 0);
  }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const M = 72; // side margin

  // Header: crest and club name on the left, the competition on the right, or on a row of its own
  // underneath when a long club name leaves no room for it
  // Stories keep clear of the app's own bars (profile at the top, reply box at the bottom)
  const headY = by(270, 100, 84);
  const textX = M + 124;
  drawContain(ctx, clubCrest, M + 50, headY, 100);
  ctx.textAlign = 'left';
  ctx.fillStyle = INK;
  fit(ctx, club.name, 800, 40, W - M - textX, heading, 26);
  const clubName = ellipsize(ctx, club.name, W - M - textX);
  ctx.fillText(clubName, textX, headY - 20);
  const nameW = ctx.measureText(clubName).width;
  ctx.fillStyle = FAINT;
  spaced(ctx, 4);
  ctx.font = `700 24px ${body}`;
  const eyebrow = kind === 'motm' ? 'AWARD' : kind !== 'score' ? 'TEAM NEWS' : match.status === 'completed' ? 'RESULT' : match.status === 'live' || match.status === 'halftime' ? 'LIVE' : 'FIXTURE';
  ctx.fillText(eyebrow, textX, headY + 26);
  spaced(ctx, 0);
  // The competition only: a custom title ("X vs Y") repeats what the card already shows
  const competition = (match.competition || '').trim().toUpperCase();
  if (competition) {
    spaced(ctx, 2);
    ctx.font = `700 22px ${body}`;
    const room = W - M - (textX + Math.max(nameW, ctx.measureText(eyebrow).width + 60)) - 32;
    const sameRow = ctx.measureText(competition).width + 44 <= room;
    const label = sameRow ? competition : ellipsize(ctx, competition, W - M * 2 - 44);
    const pillW = ctx.measureText(label).width + 44;
    const pillX = sameRow ? W - M - pillW : M;
    const pillY = sameRow ? headY : headY + by(96, 72, 72);
    roundRect(ctx, pillX, pillY - 25, pillW, 50, 25);
    ctx.fillStyle = rgba(primary, overPhoto ? 0.32 : 0.18);
    ctx.fill();
    ctx.strokeStyle = rgba(ink, 0.55);
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = ink;
    ctx.fillText(label, pillX + 22, pillY + 1);
    spaced(ctx, 0);
  }
  ctx.textAlign = 'center';

  const scored = kind === 'score' && !opts.hideScore && ['completed', 'live', 'halftime'].includes(match.status);
  const [first, second] = opts.headline
    || (kind === 'motm' ? ['PLAYER OF', 'THE MATCH'] : kind !== 'score' ? ['STARTING', 'XI'] : headline(match, scored));

  // Headline (on the Player of the Match card it sits under the photo, and under the player's name when
  // the name is in its own script font, which then takes the headline's place)
  const nameFirst = kind === 'motm' && !!opts.motm?.name && !!opts.motm.nameFont;
  const nameTopY = by(1150, 840, 640);
  const hlY = nameFirst ? nameTopY + by(104, 88, 76) : kind === 'motm' ? nameTopY : by(500, 290, 230);
  const hlSize = nameFirst ? by(84, 72, 60) : kind === 'motm' ? by(128, 108, 92) : by(170, 132, 116);
  ctx.font = `900 ${hlSize}px ${heading}`;
  const gap = hlSize * 0.12;
  const wA = ctx.measureText(first).width;
  const wB = ctx.measureText(second).width;
  const scale = Math.min(1, (W - M * 2) / (wA + gap + wB));
  ctx.font = `900 ${Math.floor(hlSize * scale)}px ${heading}`;
  const startX = W / 2 - (wA + gap + wB) * scale / 2;
  ctx.textAlign = 'left';
  ctx.save();
  if (overPhoto) {
    ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
    ctx.shadowBlur = 30;
  }
  ctx.fillStyle = INK;
  ctx.fillText(first, startX, hlY);
  ctx.fillStyle = ink;
  ctx.fillText(second, startX + (wA + gap) * scale, hlY);
  ctx.restore();
  ctx.textAlign = 'center';

  if (kind === 'lineup' || kind === 'lineup-list') {
    const home = match.is_club_home ?? true;
    const xi = [...((home ? match.home_lineup_coords : match.away_lineup_coords) || [])]
      .sort((a, b) => (opts.keepOrder ? 0 : a.x - b.x || a.y - b.y)) // the pitch runs left to right: goalkeeper first, then back to front
      .slice(0, 11);
    const opponent = home ? match.away_team_name : match.home_team_name;
    const formation = home ? match.home_formation : match.away_formation;
    const { day, time } = kickoff(match);

    ctx.fillStyle = MUTED;
    const sub = [opponent?.trim() && `vs ${opponent.trim()}`, formation && formation.toLowerCase() !== 'custom' && formation]
      .filter(Boolean).join(' · ');
    if (sub) {
      fit(ctx, sub, 600, 38, W - M * 2, body);
      ctx.fillText(sub, W / 2, hlY + 100);
    }

    // Players placed on the lineup pitch: drawn where the coach put them, else (or when asked) as a numbered list
    const placed = xi.filter(p => p.name?.trim() && Number.isFinite(p.x) && Number.isFinite(p.y));
    let after: number;
    if (kind === 'lineup' && lineupHasPositions(match)) {
      // The match page's vertical TacticalPitch, redrawn: striped grass, its markings, and each
      // player as a photo (or initials in club colours) with a shirt-number tag, armband and name tag
      const pitchH = story ? 920 : 800;
      const pitchW = Math.round(Math.min(W - M * 2, pitchH * (9 / 13) * 1.05));
      const top = story ? 625 : 430;
      const left = (W - pitchW) / 2;
      const k = pitchW / 400; // the app's pitch is ~400px wide on a phone, where a marker is 44px
      ctx.save();
      roundRect(ctx, left, top, pitchW, pitchH, 16 * k);
      ctx.clip();
      for (let i = 0; i < 10; i++) {
        ctx.fillStyle = i % 2 ? '#133823' : '#0f2e1c';
        ctx.fillRect(left, top + (pitchH / 10) * i, pitchW, pitchH / 10 + 1);
      }
      const inner = ctx.createRadialGradient(W / 2, top + pitchH / 2, Math.min(pitchW, pitchH) * 0.35, W / 2, top + pitchH / 2, pitchH * 0.75);
      inner.addColorStop(0, 'rgba(0, 0, 0, 0)');
      inner.addColorStop(1, 'rgba(0, 0, 0, 0.55)');
      ctx.fillStyle = inner;
      ctx.fillRect(left, top, pitchW, pitchH);
      const line = (a: number) => { ctx.strokeStyle = `rgba(255, 255, 255, ${a})`; ctx.lineWidth = 2 * k * 0.8; };
      const X = (pct: number) => left + (pitchW * pct) / 100;
      const Y = (pct: number) => top + (pitchH * pct) / 100;
      line(0.35);
      ctx.beginPath();
      ctx.moveTo(left, Y(50));
      ctx.lineTo(left + pitchW, Y(50));
      ctx.moveTo(W / 2 + pitchW * 0.13, Y(50));
      ctx.arc(W / 2, Y(50), pitchW * 0.13, 0, Math.PI * 2);
      ctx.strokeRect(X(18), Y(0) - 2, pitchW * 0.64, pitchH * 0.16 + 2);
      ctx.strokeRect(X(18), Y(84), pitchW * 0.64, pitchH * 0.16 + 2);
      ctx.stroke();
      line(0.3);
      ctx.strokeRect(X(32), Y(0) - 2, pitchW * 0.36, pitchH * 0.06 + 2);
      ctx.strokeRect(X(32), Y(94), pitchW * 0.36, pitchH * 0.06 + 2);
      line(0.32);
      const arcR = pitchW * 0.05;
      ctx.beginPath();
      ctx.arc(W / 2, Y(16), arcR, 0, Math.PI);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(W / 2, Y(84), arcR, Math.PI, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      for (const y of [Y(11), Y(50), Y(89)]) {
        ctx.beginPath();
        ctx.arc(W / 2, y, (y === Y(50) ? 4 : 3) * k, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      roundRect(ctx, left, top, pitchW, pitchH, 16 * k);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.lineWidth = 3 * k * 0.8;
      ctx.stroke();

      const photos = await Promise.all(placed.map(p => {
        const url = p.member_id ? opts.photos?.[p.member_id] : undefined;
        return url ? loadImage(url) : Promise.resolve(null);
      }));
      const r = 22 * k;
      placed.forEach((p, i) => {
        // TacticalPitch centres the whole marker (circle + name tag) on the spot
        const cx = X(Math.min(100, Math.max(0, p.y)));
        const cy = Y(100 - Math.min(100, Math.max(0, p.x))) - 12 * k;
        const gk = p.position === 'GK';
        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.shadowBlur = 12 * k;
        ctx.shadowOffsetY = 4 * k;
        markerPath(ctx, cx, cy, r, opts.marker);
        const photo = photos[i];
        if (photo) {
          ctx.fillStyle = '#0B0F14';
          ctx.fill();
          ctx.shadowColor = 'transparent';
          ctx.clip();
          const scale = Math.max((r * 2) / photo.naturalWidth, (r * 2) / photo.naturalHeight);
          ctx.drawImage(photo, cx - (photo.naturalWidth * scale) / 2, cy - (photo.naturalHeight * scale) / 2, photo.naturalWidth * scale, photo.naturalHeight * scale);
        } else {
          // Same fill as the marker: amber for the keeper, else the club colour shading to dark
          const g = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
          if (gk) {
            g.addColorStop(0, '#F59E0B');
            g.addColorStop(1, '#D97706');
          } else {
            g.addColorStop(0, 'rgba(0, 0, 0, 0)');
            g.addColorStop(1, 'rgba(0, 0, 0, 0.3)');
            ctx.fillStyle = primary;
            ctx.fill();
            ctx.shadowColor = 'transparent';
          }
          ctx.fillStyle = g;
          ctx.fill();
        }
        ctx.restore();
        markerPath(ctx, cx, cy, r, opts.marker);
        ctx.lineJoin = 'round';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.lineWidth = 2 * k;
        ctx.stroke();
        const shape = opts.marker || 'circle';
        // A shirt carries its number, like a real one; other markers show initials
        const shirtNumber = shape === 'jersey' && p.number > 0;
        if (!photo && (shirtNumber || p.name !== p.position)) { // an unnamed slot (the free lineup builder names it by its position) stays blank
          const parts = p.name.trim().split(/\s+/);
          const initials = (parts[0].charAt(0) + (parts.length > 1 ? parts[parts.length - 1].charAt(0) : '')).toUpperCase();
          ctx.fillStyle = '#FFFFFF';
          ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
          ctx.shadowBlur = 3 * k;
          ctx.font = `900 ${15 * k * MARKER_TEXT_SCALE[shape]}px ${heading}`;
          ctx.fillText(shirtNumber ? String(p.number) : initials, cx, cy + 1 + r * MARKER_TEXT_DROP[shape]);
          ctx.shadowBlur = 0;
        }

        // Shirt number tag (bottom-left), unless the shirt already carries it
        if (p.number > 0 && !(shirtNumber && !photo)) {
          ctx.font = `800 ${11 * k}px ${mono}`;
          const tw = Math.max(18 * k, ctx.measureText(String(p.number)).width + 8 * k);
          const tx = cx - r - 6 * k;
          const ty = cy + r + 4 * k - 16 * k;
          roundRect(ctx, tx, ty, tw, 16 * k, 5 * k);
          ctx.fillStyle = 'rgba(8, 12, 18, 0.92)';
          ctx.fill();
          ctx.strokeStyle = gk ? '#F59E0B' : primary;
          ctx.lineWidth = 1 * k;
          ctx.stroke();
          ctx.fillStyle = '#FFFFFF';
          ctx.fillText(String(p.number), tx + tw / 2, ty + 8.5 * k);
        }
        // Captain's armband (top-left)
        if (p.is_captain) {
          const bx = cx - r * 0.78;
          const by = cy - r * 0.78;
          ctx.beginPath();
          ctx.arc(bx, by, 8 * k, 0, Math.PI * 2);
          ctx.fillStyle = '#F59E0B';
          ctx.fill();
          ctx.strokeStyle = '#000';
          ctx.lineWidth = 1.5 * k;
          ctx.stroke();
          ctx.fillStyle = '#000';
          ctx.font = `900 ${10 * k}px ${body}`;
          ctx.fillText('C', bx, by + 0.5 * k);
        }
        // Name tag: "Mahesh S.", the pitch's default name style
        const label = juniorPublicName(p.name);
        const size = fit(ctx, label, 700, 11.5 * k, 100 * k, body, 8 * k);
        const lw = ctx.measureText(label).width + 14 * k;
        const lh = size + 8 * k;
        const ly = cy + r + 6 * k;
        roundRect(ctx, cx - lw / 2, ly, lw, lh, 5 * k);
        ctx.fillStyle = 'rgba(8, 12, 18, 0.88)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 1 * k;
        ctx.stroke();
        ctx.fillStyle = INK;
        ctx.font = `700 ${size}px ${body}`;
        ctx.fillText(label, cx, ly + lh / 2 + 1);
      });
      after = top + pitchH;
    } else {
      const rowH = story ? 74 : 64;
      const top = story ? 670 : 470;
      glass(ctx, M, top, W - M * 2, rowH * xi.length + 48);
      ctx.textAlign = 'left';
      xi.forEach((p, i) => {
        const y = top + 24 + rowH * i + rowH / 2;
        if (i > 0) {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.07)';
          ctx.fillRect(M + 40, y - rowH / 2, W - M * 2 - 80, 2);
        }
        ctx.fillStyle = ink;
        ctx.font = `900 ${story ? 44 : 38}px ${heading}`;
        ctx.textAlign = 'center';
        if (p.number > 0) ctx.fillText(String(p.number), M + 90, y); // no shirt number: no "0"
        ctx.textAlign = 'left';
        ctx.fillStyle = INK;
        const name = `${p.name}${p.is_captain ? ' (C)' : ''}`;
        fit(ctx, name, 700, story ? 42 : 36, W - M * 2 - 220, body);
        ctx.fillText(name, M + 160, y);
      });
      ctx.textAlign = 'center';
      after = top + rowH * xi.length + 48;
    }
    if (story && (day || time)) {
      ctx.fillStyle = MUTED;
      const when = [day, time, match.venue].filter(Boolean).join(' · ');
      fit(ctx, when, 600, 34, W - M * 2, body);
      ctx.fillText(when, W / 2, after + 64);
    }
  } else if (kind === 'motm') {
    // Player of the Match: the photo fills the top (drawn with the background); without one, a big
    // star in a ring of the club colour stands in. Then the name, a short line and the result
    const m = opts.motm;
    if (!motmPhoto) {
      const cy = by(720, 520, 400);
      const r = by(200, 170, 130);
      ctx.beginPath();
      ctx.arc(W / 2, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = rgba(primary, 0.2);
      ctx.fill();
      ctx.strokeStyle = rgba(ink, 0.7);
      ctx.lineWidth = 4;
      ctx.stroke();
      if (m?.name) {
        ctx.fillStyle = INK;
        ctx.font = `900 ${Math.round(r * 0.8)}px ${heading}`;
        ctx.fillText(initialsOf(m.name), W / 2, cy + r * 0.05);
      } else star(ctx, W / 2, cy, r * 0.6, ink);
    }
    const nameSize = by(64, 54, 46);
    const nameY = hlY + hlSize * by(1.05, 1, 1);
    if (m?.name && m.nameFont) {
      // The name in its own (script) font, large and above the headline
      const size = by(116, 100, 86);
      await document.fonts?.load(`400 ${size}px ${m.nameFont}`).catch(() => null);
      ctx.save();
      if (overPhoto) {
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.shadowBlur = 30;
      }
      ctx.fillStyle = INK;
      fit(ctx, m.name, 400, size, W - M * 2, m.nameFont);
      ctx.fillText(m.name, W / 2, nameTopY);
      ctx.restore();
    } else if (m?.name) {
      const name = m.name.toUpperCase();
      ctx.fillStyle = INK;
      spaced(ctx, 2);
      fit(ctx, name, 800, nameSize, W - M * 2, heading);
      ctx.fillText(name, W / 2, nameY);
      spaced(ctx, 0);
    }
    if (m?.line && opts.icons) {
      const parts = m.line.split(/\s*[·•,|]\s*/).filter(Boolean);
      iconRow(ctx, parts.map(t => ({ icon: statIcon(t), text: t })), nameFirst ? hlY + by(66, 54, 48) : nameY + by(62, 50, 50),
        by(32, 28, 28), 600, body, W - M * 2, MUTED, ink);
    } else if (m?.line) {
      ctx.fillStyle = MUTED;
      fit(ctx, m.line, 600, by(32, 28, 28), W - M * 2, body);
      ctx.fillText(m.line, W / 2, nameFirst ? hlY + by(66, 54, 48) : nameY + by(62, 50, 50));
    }
    // The result: both crests, names and the score in one glass strip
    const [homeCrest, awayCrest] = await Promise.all([crest(match.home_team_logo), crest(match.away_team_logo)]);
    const stripH = by(150, 124, 104);
    const stripY = by(1390, 1060, 830);
    glass(ctx, M, stripY, W - M * 2, stripH, 36, backdrop);
    const mid = stripY + stripH / 2;
    const cb = stripH - 44;
    drawContain(ctx, homeCrest, M + 30 + cb / 2, mid, cb);
    drawContain(ctx, awayCrest, W - M - 30 - cb / 2, mid, cb);
    const score = opts.hideScore ? 'v' : `${match.home_score ?? 0}–${match.away_score ?? 0}`;
    ctx.font = `900 ${by(64, 56, 48)}px ${heading}`;
    const scoreW = ctx.measureText(score).width;
    const room = (W - M * 2 - 2 * (50 + cb) - scoreW - 60) / 2;
    // Both names at the same size: the size the longer one fits at
    const stripNameSize = Math.min(...[match.home_team_name, match.away_team_name].map(n => fit(ctx, n, 700, by(32, 28, 28), room, heading, 18)));
    ctx.font = `700 ${stripNameSize}px ${heading}`;
    ctx.fillStyle = INK;
    ctx.textAlign = 'left';
    ctx.fillText(ellipsize(ctx, match.home_team_name, room), M + 50 + cb, mid);
    ctx.textAlign = 'right';
    ctx.fillText(ellipsize(ctx, match.away_team_name, room), W - M - 50 - cb, mid);
    ctx.textAlign = 'center';
    ctx.font = `900 ${by(64, 56, 48)}px ${heading}`;
    ctx.fillText(score, W / 2, mid + 2);
    const { day } = kickoff(match);
    const when = [day, match.venue].filter(Boolean).join(' · ');
    if (when && !square && opts.icons) {
      iconRow(ctx, [{ icon: 'calendar', text: day }, { icon: 'pin', text: match.venue || '' }], stripY + stripH + by(60, 48, 48),
        by(30, 26, 26), 600, body, W - M * 2, MUTED, ink);
    } else if (when && !square) {
      ctx.fillStyle = FAINT;
      fit(ctx, when, 600, by(30, 26, 26), W - M * 2, body);
      ctx.fillText(when, W / 2, stripY + stripH + by(60, 48, 48));
    }
  } else {
    const [homeCrest, awayCrest] = await Promise.all([crest(match.home_team_logo), crest(match.away_team_logo)]);
    const panelTop = by(640, 400, 320);
    const panelH = by(540, 420, 330);
    glass(ctx, M, panelTop, W - M * 2, panelH, 44, backdrop);
    const crestBox = by(210, 170, 140);
    const colX = [M + 200, W - M - 200];
    const crestY = panelTop + by(200, 150, 125);
    drawContain(ctx, homeCrest, colX[0], crestY, crestBox);
    drawContain(ctx, awayCrest, colX[1], crestY, crestBox);
    ctx.fillStyle = INK;
    const nameY = panelTop + panelH - by(110, 82, 70);
    wrapTwo(ctx, match.home_team_name, 800, by(44, 38, 34), 340, heading, colX[0], nameY);
    wrapTwo(ctx, match.away_team_name, 800, by(44, 38, 34), 340, heading, colX[1], nameY);

    if (scored) {
      ctx.fillStyle = INK;
      const score = `${match.home_score ?? 0}–${match.away_score ?? 0}`;
      fit(ctx, score, 900, by(160, 132, 120), 270, heading, 60);
      ctx.fillText(score, W / 2, crestY);
      if (match.home_penalty_score != null && match.away_penalty_score != null) {
        ctx.fillStyle = MUTED;
        ctx.font = `700 28px ${body}`;
        ctx.fillText(`${match.home_penalty_score}–${match.away_penalty_score} on pens`, W / 2, crestY + by(120, 96, 88));
      }
    } else {
      // "VS" in a ring of the club colour
      ctx.beginPath();
      ctx.arc(W / 2, crestY, by(74, 60, 56), 0, Math.PI * 2);
      ctx.fillStyle = rgba(primary, 0.2);
      ctx.fill();
      ctx.strokeStyle = rgba(ink, 0.7);
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = INK;
      ctx.font = `900 ${by(60, 50, 46)}px ${heading}`;
      ctx.fillText('VS', W / 2, crestY + 3);
    }

    const below = panelTop + panelH + by(70, 50, 44);
    // With a Player of the Match row under them, the scorers get fewer lines
    const chip = scored && !!opts.motm?.name;
    if (scored && opts.events?.length) {
      // Goalscorers under each team
      ctx.font = `600 ${by(32, 28, 26)}px ${body}`;
      const lineH = by(48, 40, 38);
      const max = chip ? by(4, 3, 2) : by(6, 3, 3);
      (['home', 'away'] as const).forEach((side, i) => {
        const lines = scorerLines(opts.events!, side);
        const shown = lines.length > max ? [...lines.slice(0, max - 1), `+${lines.length - max + 1} more`] : lines;
        if (opts.scorerBalls) {
          // One left-aligned block per team, a ball beside each line
          const size = Math.min(...shown.map(line => fit(ctx, line, 600, by(32, 28, 26), 360, body, 20)));
          ctx.font = `600 ${size}px ${body}`;
          const blockW = Math.max(0, ...shown.map(line => ctx.measureText(line).width)) + size * 1.1;
          const x0 = colX[i] - blockW / 2;
          ctx.textAlign = 'left';
          shown.forEach((line, j) => {
            ball(ctx, x0 + size * 0.4, below + j * lineH, size * 0.4);
            ctx.fillStyle = MUTED;
            ctx.fillText(line, x0 + size * 1.1, below + j * lineH);
          });
          ctx.textAlign = 'center';
          return;
        }
        shown.forEach((line, j) => {
          ctx.fillStyle = MUTED;
          fit(ctx, line, 600, by(32, 28, 26), 400, body, 20);
          ctx.fillText(line, colX[i], below + j * lineH);
        });
      });
    }

    // Player of the Match: a glass row with their photo (or initials), the label, the name and a star
    if (chip) {
      const chipH = by(150, 112, 96);
      const chipY = by(1480, 1045, 860);
      const cw = W - M * 2;
      glass(ctx, M, chipY - chipH / 2, cw, chipH, chipH / 2, backdrop);
      const pr = chipH / 2 - 14;
      const px = M + 14 + pr;
      const chipPhoto = opts.motm!.photo ? await loadImage(opts.motm!.photo) : null;
      ctx.save();
      ctx.beginPath();
      ctx.arc(px, chipY, pr, 0, Math.PI * 2);
      ctx.clip();
      ctx.fillStyle = rgba(primary, 0.35);
      ctx.fillRect(px - pr, chipY - pr, pr * 2, pr * 2);
      if (chipPhoto) drawCover(ctx, chipPhoto, px - pr, chipY - pr, pr * 2, pr * 2, opts.motm!.cutout ? 0 : opts.motm!.focusY ?? 0.3);
      else {
        ctx.fillStyle = INK;
        ctx.font = `900 ${Math.round(pr * 0.8)}px ${heading}`;
        ctx.fillText(initialsOf(opts.motm!.name), px, chipY + 2);
      }
      ctx.restore();
      ctx.beginPath();
      ctx.arc(px, chipY, pr, 0, Math.PI * 2);
      ctx.strokeStyle = ink;
      ctx.lineWidth = 4;
      ctx.stroke();
      const tx = px + pr + 26;
      ctx.textAlign = 'left';
      ctx.fillStyle = ink;
      spaced(ctx, 3);
      ctx.font = `800 ${by(22, 20, 19)}px ${body}`;
      ctx.fillText('PLAYER OF THE MATCH', tx, chipY - by(24, 21, 19));
      spaced(ctx, 0);
      ctx.fillStyle = INK;
      const room = W - M - by(66, 60, 56) - 50 - tx;
      fit(ctx, opts.motm!.name, 800, by(48, 40, 36), room, heading);
      ctx.fillText(ellipsize(ctx, opts.motm!.name, room), tx, chipY + by(20, 18, 16));
      ctx.textAlign = 'center';
      star(ctx, W - M - by(66, 60, 56), chipY, by(32, 28, 26), ink);
    }

    // Kick-off, date and ground: on a fixture always, on a result as one quiet line
    const { day, time } = kickoff(match);
    if (!scored) {
      const top = below - by(10, 15, 15);
      const cardH = by(270, 210, 200);
      glass(ctx, M, top, W - M * 2, cardH, 36, backdrop);
      const cells: [string, string][] = [['DATE', day], ['KICK-OFF', time]];
      cells.forEach(([label, value], i) => {
        const cx = M + (W - M * 2) * (i === 0 ? 0.27 : 0.73);
        ctx.fillStyle = FAINT;
        spaced(ctx, 3);
        ctx.font = `700 22px ${body}`;
        ctx.fillText(label, cx, top + by(56, 46, 46));
        spaced(ctx, 0);
        ctx.fillStyle = INK;
        fit(ctx, value || 'TBC', 800, by(54, 46, 44), (W - M * 2) / 2 - 60, heading);
        ctx.fillText(value || 'TBC', cx, top + by(110, 96, 92));
      });
      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.fillRect(W / 2 - 1, top + 30, 2, by(115, 100, 95));
      if (match.venue) {
        ctx.fillRect(M + 40, top + by(170, 140, 134), W - M * 2 - 80, 2);
        ctx.fillStyle = MUTED;
        fit(ctx, match.venue, 600, by(34, 30, 28), W - M * 2 - 80, body);
        ctx.fillText(match.venue, W / 2, top + by(222, 176, 168));
      }
    } else if (opts.icons) {
      iconRow(ctx, [{ icon: 'calendar', text: day }, { icon: 'pin', text: match.venue || '' }], H - by(310, 150, 100),
        28, 600, body, W - M * 2, MUTED, ink);
    } else {
      ctx.fillStyle = FAINT;
      const line = [day, match.venue].filter(Boolean).join(' · ');
      fit(ctx, line, 600, 28, W - M * 2, body);
      ctx.fillText(line, W / 2, H - by(310, 150, 100));
    }
  }

  // Watermark: a quiet link to the club's page, so the graphic leads people back to the site
  const markY = H - by(240, 64, 46);
  ctx.globalAlpha = 0.62;
  ctx.font = `600 26px ${body}`;
  spaced(ctx, 1);
  const linkW = ctx.measureText(link).width;
  const dot = 16;
  const totalW = dot + 14 + linkW;
  ctx.beginPath();
  ctx.arc(W / 2 - totalW / 2 + dot / 2, markY, dot / 2, 0, Math.PI * 2);
  ctx.fillStyle = ink;
  ctx.fill();
  ctx.fillStyle = INK;
  ctx.textAlign = 'left';
  ctx.fillText(link, W / 2 - totalW / 2 + dot + 14, markY + 1);
  spaced(ctx, 0);
  ctx.globalAlpha = 1;

  return new Promise((resolve, reject) =>
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Could not create the image.'))), 'image/png'));
}

/** The club's address for the watermark: its own domain when it has one, else itsfootball.club/<slug> */
export function shareLink(club: Pick<Club, 'slug' | 'custom_domain'>): string {
  return club.custom_domain || `${new URL(SITE_URL).host}/${club.slug}`;
}

/** The club's side of the saved lineup */
function clubLineup(match: Match) {
  return ((match.is_club_home ?? true) ? match.home_lineup_coords : match.away_lineup_coords) || [];
}

/** Whether the saved lineup has players placed on the pitch (not all on one spot), so it can be drawn there */
export function lineupHasPositions(match: Match): boolean {
  const placed = clubLineup(match).filter(p => p.name?.trim() && Number.isFinite(p.x) && Number.isFinite(p.y));
  return placed.length > 1 && new Set(placed.map(p => `${Math.round(p.x)}:${Math.round(p.y)}`)).size > 1;
}
