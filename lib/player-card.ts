// The football player card drawn by the free player card maker (/tools/player-card-maker): rating and
// position, the player's photo, name, six season stats, nation tag, badge and season, in one of six
// finishes. Drawn on a canvas in the browser, so the photo never leaves the device. The card is laid out
// on a 440 x 530 design box (the outline and side rails fill it) and scaled up for each image size.

export type PlayerCardFinish = 'blackgold' | 'club' | 'gold' | 'silver' | 'bronze' | 'inform';
export type PlayerCardSize = 'card' | 'story' | 'post' | 'square';
export type PlayerStatKey = 'goals' | 'assists' | 'apps' | 'motm' | 'streak' | 'att' | 'cs' | 'saves';

export const POSITIONS = ['GK', 'CB', 'LB', 'RB', 'LWB', 'RWB', 'CDM', 'CM', 'CAM', 'LM', 'RM', 'LW', 'RW', 'CF', 'ST'] as const;
export type Position = (typeof POSITIONS)[number];

/** Each stat: its short label on the card and its name in the form */
export const PLAYER_STATS: { key: PlayerStatKey; short: string; label: string; max: number }[] = [
  { key: 'goals', short: 'GLS', label: 'Goals', max: 999 },
  { key: 'assists', short: 'AST', label: 'Assists', max: 999 },
  { key: 'apps', short: 'APP', label: 'Appearances', max: 999 },
  { key: 'motm', short: 'MOTM', label: 'Player of the Match', max: 999 },
  { key: 'streak', short: 'STRK', label: 'Attendance streak', max: 999 },
  { key: 'att', short: 'ATT', label: 'Attendance %', max: 100 },
  { key: 'cs', short: 'CS', label: 'Clean sheets', max: 999 },
  { key: 'saves', short: 'SVS', label: 'Saves', max: 9999 },
];
export const MAX_SHOWN_STATS = 6;
export const OUTFIELD_STATS: PlayerStatKey[] = ['goals', 'assists', 'apps', 'motm', 'streak', 'att'];
export const KEEPER_STATS: PlayerStatKey[] = ['cs', 'saves', 'apps', 'motm', 'streak', 'att'];

/** Positions whose clean sheets count towards the rating */
const DEFENSIVE = new Set<string>(['GK', 'CB', 'LB', 'RB', 'LWB', 'RWB']);

export type PlayerStats = Partial<Record<PlayerStatKey, number>>;

/**
 * The rating worked out from the season's stats (the same formula is explained on the tool page):
 * 55, plus per game played: goals × 12, assists × 8, Player of the Match awards × 10, clean sheets × 10
 * (keepers and defenders only) and saves × 1, plus attendance % × 0.1 and 0.25 for each game of the
 * attendance streak (up to 20). Kept between 45 and 95; 96 to 99 only by setting your own.
 */
export function autoRating(stats: PlayerStats, position: string): number {
  const apps = stats.apps || 0;
  const per = (n: number | undefined) => (apps > 0 ? (n || 0) / apps : 0);
  let r = 55
    + 12 * per(stats.goals)
    + 8 * per(stats.assists)
    + 10 * per(stats.motm)
    + (DEFENSIVE.has(position) ? 10 * per(stats.cs) : 0)
    + 1 * per(stats.saves)
    + 0.1 * Math.min(100, stats.att || 0)
    + 0.25 * Math.min(20, stats.streak || 0);
  if (!Number.isFinite(r)) r = 55;
  return Math.round(Math.min(95, Math.max(45, r)));
}

interface FinishStyle {
  /** Background gradient stops along the 165° line */
  bg: [number, string][];
  ink: string;
  /** Rating, position, name, chips and season */
  hi: string;
  sub: string;
  line: string;
  edge: string;
  /** The dark line between the two edge lines */
  gap: string;
  beam: string;
  beamAlpha: number;
}

const mix = (a: string, b: string, t: number) => {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (s: number) => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t);
  return `#${[16, 8, 0].map(s => ch(s).toString(16).padStart(2, '0')).join('')}`;
};
const isHex = (c: string) => /^#[0-9a-f]{6}$/i.test(c);
const luminance = (c: string) => {
  const n = parseInt(c.slice(1), 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
};

function finishStyle(finish: PlayerCardFinish, colour: string): FinishStyle {
  switch (finish) {
    case 'blackgold':
      return { bg: [[0, '#2A2A2C'], [0.55, '#0B0B0C'], [1, '#1A1712']], ink: '#F7E3A6', hi: '#F2D27A', sub: 'rgba(247,227,166,0.7)', line: 'rgba(242,210,122,0.45)', edge: '#E8C46A', gap: '#111111', beam: '#D9AE4A', beamAlpha: 0.55 };
    case 'gold':
      return { bg: [[0, '#F7DC8E'], [1, '#A97A1F']], ink: '#2B1E05', hi: '#2B1E05', sub: 'rgba(43,30,5,0.68)', line: 'rgba(43,30,5,0.32)', edge: '#FFF1C2', gap: '#9A6D18', beam: '#FFFFFF', beamAlpha: 0.22 };
    case 'silver':
      return { bg: [[0, '#F2F5F8'], [1, '#8995A6']], ink: '#18202D', hi: '#18202D', sub: 'rgba(24,32,45,0.66)', line: 'rgba(24,32,45,0.3)', edge: '#FFFFFF', gap: '#7D889A', beam: '#FFFFFF', beamAlpha: 0.22 };
    case 'bronze':
      return { bg: [[0, '#E8AE7C'], [1, '#6E3A1A']], ink: '#2A1407', hi: '#2A1407', sub: 'rgba(42,20,7,0.7)', line: 'rgba(42,20,7,0.32)', edge: '#FFD2AE', gap: '#5E3015', beam: '#FFFFFF', beamAlpha: 0.22 };
    case 'inform':
      return { bg: [[0, '#1B2944'], [1, '#05070C']], ink: '#FFFFFF', hi: '#34D399', sub: 'rgba(255,255,255,0.66)', line: 'rgba(52,211,153,0.5)', edge: '#34D399', gap: '#06100D', beam: '#10B981', beamAlpha: 0.4 };
    case 'club':
    default: {
      const c = isHex(colour) ? colour : '#DC2626';
      // A light club colour (white, yellow) gets dark text, like the gold and silver finishes
      const light = luminance(c) > 0.62;
      const top = light ? mix(c, '#FFFFFF', 0.15) : mix(c, '#FFFFFF', 0.1);
      const bottom = light ? mix(c, '#000000', 0.35) : mix(c, '#000000', 0.7);
      const ink = light ? '#111827' : '#FFFFFF';
      return {
        bg: [[0, top], [1, bottom]], ink, hi: ink,
        sub: light ? 'rgba(17,24,39,0.68)' : 'rgba(255,255,255,0.72)',
        line: light ? 'rgba(17,24,39,0.3)' : 'rgba(255,255,255,0.35)',
        edge: light ? mix(c, '#000000', 0.45) : mix(c, '#FFFFFF', 0.55),
        gap: light ? mix(c, '#FFFFFF', 0.4) : mix(c, '#000000', 0.6),
        beam: '#FFFFFF', beamAlpha: 0.22,
      };
    }
  }
}

/** The outline: a crown at the top centre (a point between two scooped dips and two rounded bumps),
 *  sweeping down to rounded corners, straight sides and a gentle point at the base */
const OUTLINE = 'M32 92 C32 84 34 78 40 76 C80 46 124 24 166 22 Q176 19 181 27 C188 37 210 36 220 16 C230 36 252 37 259 27 Q264 19 274 22 C316 24 360 46 400 76 C406 78 408 84 408 92 L408 470 Q408 486 392 490 Q300 500 240 508 Q228 510 220 516 Q212 510 200 508 Q140 500 48 490 Q32 486 32 470 Z';
/** The thin rails beside each side */
const RAILS: [number, number, number][] = [[22, 112, 448], [14, 150, 410], [7, 190, 370]];

export const CARD_BOX = { w: 440, h: 530 };

/** Image sizes, and where the card sits on each (its scale and top edge, in pixels) */
export const PLAYER_CARD_SIZES: Record<PlayerCardSize, { w: number; h: number; k: number; top: number }> = {
  card: { w: 1100, h: 1325, k: 2.5, top: 0 },
  story: { w: 1080, h: 1920, k: 2.2, top: 390 },
  post: { w: 1080, h: 1350, k: 2.15, top: 52 },
  square: { w: 1080, h: 1080, k: 1.8, top: 28 },
};

export interface PlayerCardPhoto {
  src: string;
  /** A cut-out (transparent background): it stands on the card instead of filling a frame */
  cutout: boolean;
  zoom: number;
  /** Offset from its starting place, in design-box units */
  x: number;
  y: number;
}

export interface PlayerCardData {
  finish: PlayerCardFinish;
  colour: string;
  name: string;
  rating: number;
  position: string;
  altPositions: string[];
  foot: '' | 'R' | 'L' | 'LR';
  number: string;
  nation: string;
  club: string;
  season: string;
  crest: string | null;
  stats: { short: string; value: string }[];
  photo: PlayerCardPhoto | null;
}

/** A shield with the club's initials in its colour, for a club with no badge uploaded */
function shield(name: string, colour: string): string {
  const words = name.trim().split(/\s+/).filter(w => /^[a-z0-9]/i.test(w));
  const text = (words.length === 1 ? words[0].slice(0, 3) : words.slice(0, 3).map(w => w[0]).join('')).toUpperCase() || '?';
  const c = isHex(colour) ? colour : '#DC2626';
  const light = luminance(c) > 0.62;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 112"><path d="M50 4 10 18v34c0 27 17 46 40 56 23-10 40-29 40-56V18L50 4Z" fill="${c}" stroke="${light ? '#0F172A' : '#F8FAFC'}" stroke-width="6" stroke-opacity="0.85"/><text x="50" y="66" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="900" font-size="${text.length > 2 ? 24 : 32}" fill="${light ? '#0F172A' : '#FFFFFF'}">${text.replace(/[<&>]/g, '')}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** A linear gradient across a w x h box at a CSS angle (0° points up, 90° right) */
function cssGradient(ctx: CanvasRenderingContext2D, w: number, h: number, deg: number, stops: [number, string][]) {
  const a = (deg * Math.PI) / 180;
  const vx = Math.sin(a);
  const vy = -Math.cos(a);
  const half = (Math.abs(w * vx) + Math.abs(h * vy)) / 2;
  const g = ctx.createLinearGradient(w / 2 - vx * half, h / 2 - vy * half, w / 2 + vx * half, h / 2 + vy * half);
  for (const [o, c] of stops) g.addColorStop(Math.min(1, Math.max(0, o)), c);
  return g;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Letter spacing where the browser supports it on a canvas (it does not change the layout otherwise) */
function spacing(ctx: CanvasRenderingContext2D, px: number) {
  if ('letterSpacing' in ctx) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${px}px`;
}

function fitFont(ctx: CanvasRenderingContext2D, text: string, weight: number, size: number, min: number, family: string, maxWidth: number) {
  let s = size;
  ctx.font = `${weight} ${s}px ${family}`;
  while (s > min && ctx.measureText(text).width > maxWidth) {
    s -= 1;
    ctx.font = `${weight} ${s}px ${family}`;
  }
  return s;
}

/** A plain head-and-shoulders outline, shown until a photo is added */
function placeholder(ctx: CanvasRenderingContext2D, colour: string) {
  ctx.save();
  ctx.globalAlpha = 0.22;
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.ellipse(220, 128, 46, 56, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(100, 322);
  ctx.bezierCurveTo(104, 246, 150, 206, 220, 202);
  ctx.bezierCurveTo(290, 206, 336, 246, 340, 322);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** The player's photo, faded out towards the name */
function drawPhoto(ctx: CanvasRenderingContext2D, img: HTMLImageElement, p: PlayerCardPhoto, k: number) {
  const layer = document.createElement('canvas');
  layer.width = Math.ceil(CARD_BOX.w * k);
  layer.height = Math.ceil(CARD_BOX.h * k);
  const l = layer.getContext('2d');
  if (!l) return;
  l.scale(k, k);
  l.imageSmoothingQuality = 'high';
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  const frame = { x: 70, y: 22, w: 300, h: 300 };
  if (p.cutout) {
    // Fit the player's height to the frame, standing on its bottom edge
    const h = frame.h * p.zoom;
    const w = (h * iw) / ih;
    l.drawImage(img, frame.x + frame.w / 2 - w / 2 + p.x, frame.y + frame.h - h + p.y, w, h);
  } else {
    // Fill the frame, and only the frame
    const s = Math.max(frame.w / iw, frame.h / ih) * p.zoom;
    const w = iw * s;
    const h = ih * s;
    l.save();
    roundRect(l, frame.x, frame.y, frame.w, frame.h, 18);
    l.clip();
    l.drawImage(img, frame.x + frame.w / 2 - w / 2 + p.x, frame.y + frame.h / 2 - h / 2 + p.y, w, h);
    l.restore();
  }
  l.globalCompositeOperation = 'destination-in';
  const fade = l.createLinearGradient(0, frame.y + frame.h * 0.72, 0, frame.y + frame.h * 0.99);
  fade.addColorStop(0, 'rgba(0,0,0,1)');
  fade.addColorStop(1, 'rgba(0,0,0,0)');
  l.fillStyle = fade;
  l.fillRect(0, 0, CARD_BOX.w, CARD_BOX.h);
  ctx.drawImage(layer, 0, 0, CARD_BOX.w, CARD_BOX.h);
}

interface Fonts { heading: string; body: string }

async function siteFonts(): Promise<Fonts> {
  const rootStyle = getComputedStyle(document.documentElement);
  const body = getComputedStyle(document.body).fontFamily || 'system-ui, sans-serif';
  const outfit = rootStyle.getPropertyValue('--font-outfit').trim();
  const heading = outfit ? `${outfit}, ${body}` : body;
  await Promise.all([`800 76px ${heading}`, `700 30px ${heading}`, `600 12px ${body}`]
    .map(f => document.fonts?.load(f).catch(() => null)));
  return { heading, body };
}

/** The card itself, at scale k with its top-left corner at (x, y) */
async function drawCard(ctx: CanvasRenderingContext2D, d: PlayerCardData, x: number, y: number, k: number, f: Fonts, watermark: boolean) {
  const st = finishStyle(d.finish, d.colour);
  const [photo, crest] = await Promise.all([d.photo ? loadImage(d.photo.src) : null, d.crest ? loadImage(d.crest) : d.club.trim() ? loadImage(shield(d.club, d.colour)) : null]);
  const { w: W, h: H } = CARD_BOX;
  const outline = new Path2D(OUTLINE);

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(k, k);

  // Inside the outline: background, light beams, fine stripes, the photo
  ctx.save();
  ctx.clip(outline);
  ctx.fillStyle = cssGradient(ctx, W, H, 165, st.bg);
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.globalAlpha = st.beamAlpha;
  const beam = (deg: number, at: number, to: number) => {
    ctx.fillStyle = cssGradient(ctx, W, H, deg, [[0, 'transparent'], [at, 'transparent'], [at + 0.003, st.beam], [to, 'transparent'], [1, 'transparent']]);
    ctx.fillRect(0, 0, W, H);
  };
  beam(122, 0.54, 0.6);
  beam(122, 0.66, 0.71);
  beam(58, 0.14, 0.21);
  ctx.save();
  ctx.translate(W * 0.62, H * 0.22);
  ctx.scale(1, (H * 0.55) / (W * 0.8));
  const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, W * 0.8 * 0.6);
  glow.addColorStop(0, 'rgba(255,255,255,0.35)');
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(-W, -H * 2, W * 2, H * 4);
  ctx.restore();
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = 0.08;
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 1;
  ctx.translate(W / 2, H / 2);
  ctx.rotate((32 * Math.PI) / 180);
  for (let i = -60; i <= 60; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 9, -H);
    ctx.lineTo(i * 9, H);
    ctx.stroke();
  }
  ctx.restore();

  if (photo && d.photo) drawPhoto(ctx, photo, d.photo, k);
  else placeholder(ctx, st.ink);
  ctx.restore();

  // Rating and position, top left
  ctx.fillStyle = st.hi;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  spacing(ctx, -2);
  ctx.font = `800 76px ${f.heading}`;
  ctx.fillText(String(d.rating), 100, 134);
  spacing(ctx, 0.5);
  fitFont(ctx, d.position, 700, 30, 18, f.heading, 92);
  ctx.fillText(d.position, 100, 168);

  // Chips down the right: other positions, then preferred foot and shirt number
  const chips = (items: string[], top: number) => {
    let cy = top;
    spacing(ctx, 0);
    ctx.font = `700 19px ${f.heading}`;
    for (const t of items) {
      const w = Math.max(46, ctx.measureText(t).width + 16);
      const h = 30;
      roundRect(ctx, 394 - w, cy, w, h, 8);
      ctx.lineWidth = 2;
      ctx.strokeStyle = st.hi;
      ctx.stroke();
      ctx.fillStyle = st.hi;
      ctx.textAlign = 'center';
      ctx.fillText(t, 394 - w / 2, cy + 22);
      cy += h + 7;
    }
  };
  chips(d.altPositions.filter(Boolean).slice(0, 2), 78);
  chips([d.foot ? (d.foot === 'LR' ? 'L/R' : d.foot) : '', d.number ? `#${d.number}` : ''].filter(Boolean), 236);

  // Name
  const name = d.name.trim() || 'Your Name';
  ctx.fillStyle = st.hi;
  ctx.textAlign = 'center';
  spacing(ctx, 0.2);
  fitFont(ctx, name, 800, 38, 22, f.heading, 330);
  ctx.fillText(name, W / 2, 346);

  // Stats, in one row: label over value
  const stats = d.stats.slice(0, MAX_SHOWN_STATS);
  const col = 56;
  const start = W / 2 - (stats.length * col) / 2;
  stats.forEach((s, i) => {
    const cx = start + col * i + col / 2;
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = st.hi;
    spacing(ctx, 0.3);
    fitFont(ctx, s.short, 700, 15, 11, f.heading, col - 4);
    ctx.fillText(s.short, cx, 376);
    ctx.globalAlpha = 1;
    ctx.fillStyle = st.ink;
    spacing(ctx, 0);
    fitFont(ctx, s.value, 700, 30, 18, f.heading, col - 2);
    ctx.fillText(s.value, cx, 408);
  });

  // Nation tag, badge and season
  ctx.font = `800 13px ${f.heading}`;
  spacing(ctx, 1);
  const bits: { w: number; draw: (bx: number) => void }[] = [];
  const nation = d.nation.trim().toUpperCase();
  if (nation) {
    const tw = ctx.measureText(nation).width + 16;
    bits.push({ w: tw, draw: bx => {
      roundRect(ctx, bx, 430, tw, 23, 5);
      ctx.lineWidth = 1;
      ctx.strokeStyle = st.line;
      ctx.stroke();
      ctx.fillStyle = st.ink;
      ctx.font = `800 13px ${f.heading}`;
      spacing(ctx, 1);
      ctx.textAlign = 'center';
      ctx.fillText(nation, bx + tw / 2, 446);
    } });
  }
  if (crest) {
    const ch = 35;
    const cw = Math.min(44, (ch * crest.naturalWidth) / Math.max(1, crest.naturalHeight));
    bits.push({ w: cw, draw: bx => ctx.drawImage(crest, bx, 424, cw, ch) });
  }
  const season = d.season.trim();
  if (season) {
    ctx.font = `800 14px ${f.heading}`;
    const sw = ctx.measureText(season).width;
    bits.push({ w: sw, draw: bx => {
      ctx.fillStyle = st.hi;
      ctx.font = `800 14px ${f.heading}`;
      spacing(ctx, 1);
      ctx.textAlign = 'left';
      ctx.fillText(season, bx, 447);
    } });
  }
  const gap = 30;
  let bx = W / 2 - (bits.reduce((n, b) => n + b.w, 0) + gap * Math.max(0, bits.length - 1)) / 2;
  for (const b of bits) {
    b.draw(bx);
    bx += b.w + gap;
  }

  // Club name and the watermark, near the base
  ctx.textAlign = 'center';
  ctx.fillStyle = st.sub;
  const club = d.club.trim().toUpperCase();
  if (club) {
    spacing(ctx, 2.2);
    fitFont(ctx, club, 700, 10.5, 8, f.heading, 280);
    ctx.fillText(club, W / 2, 478);
  }
  if (watermark) {
    spacing(ctx, 0);
    ctx.font = `600 9px ${f.body}`;
    ctx.fillText('● Made at itsfootball.club', W / 2, 496);
  }

  // The edge: a double line, then the rails
  ctx.lineJoin = 'round';
  ctx.lineWidth = 9;
  ctx.strokeStyle = st.edge;
  ctx.stroke(outline);
  ctx.lineWidth = 4.5;
  ctx.strokeStyle = st.gap;
  ctx.stroke(outline);
  ctx.globalAlpha = 0.8;
  ctx.lineWidth = 1.8;
  ctx.lineCap = 'round';
  ctx.strokeStyle = st.edge;
  for (const [rx, y0, y1] of RAILS) {
    for (const xx of [rx, W - rx]) {
      ctx.beginPath();
      ctx.moveTo(xx, y0);
      ctx.lineTo(xx, y1);
      ctx.stroke();
    }
  }
  ctx.restore();
  spacing(ctx, 0);
}

/** The finished image as a PNG: the card alone (see-through around it), or on a story, post or square */
export async function drawPlayerCard(d: PlayerCardData, size: PlayerCardSize): Promise<Blob> {
  const { w: W, h: H, k, top } = PLAYER_CARD_SIZES[size];
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available in this browser.');
  const f = await siteFonts();
  const st = finishStyle(d.finish, d.colour);
  const left = (W - CARD_BOX.w * k) / 2;

  if (size !== 'card') {
    // A dark backdrop lit in the card's edge colour, with fine diagonal lines
    ctx.fillStyle = '#070A0F';
    ctx.fillRect(0, 0, W, H);
    const glow = ctx.createRadialGradient(W / 2, top + CARD_BOX.h * k * 0.42, 0, W / 2, top + CARD_BOX.h * k * 0.42, Math.max(W, H) * 0.6);
    glow.addColorStop(0, `${st.edge}66`);
    glow.addColorStop(1, `${st.edge}00`);
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.globalAlpha = 0.1;
    ctx.strokeStyle = st.edge;
    ctx.lineWidth = 2;
    ctx.translate(W / 2, H / 2);
    ctx.rotate((32 * Math.PI) / 180);
    for (let i = -80; i <= 80; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 36, -H * 1.2);
      ctx.lineTo(i * 36, H * 1.2);
      ctx.stroke();
    }
    ctx.restore();

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = 60;
    ctx.shadowOffsetY = 30;
    // The shadow comes from a plain copy of the outline under the card
    ctx.translate(left, top);
    ctx.scale(k, k);
    ctx.fillStyle = '#000000';
    ctx.fill(new Path2D(OUTLINE));
    ctx.restore();

    if (size === 'story') {
      ctx.textAlign = 'center';
      if (d.season.trim()) {
        ctx.fillStyle = st.edge;
        spacing(ctx, 8);
        ctx.font = `700 34px ${f.heading}`;
        ctx.fillText(`SEASON ${d.season.trim().toUpperCase()}`, W / 2, 210);
      }
      ctx.fillStyle = '#FFFFFF';
      spacing(ctx, -1);
      ctx.font = `900 84px ${f.heading}`;
      ctx.fillText('PLAYER CARD', W / 2, 310);
      spacing(ctx, 0);
    }
  }

  await drawCard(ctx, d, left, top, k, f, size === 'card');

  if (size !== 'card') {
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.72)';
    spacing(ctx, 0);
    ctx.font = `600 ${size === 'story' ? 30 : 24}px ${f.body}`;
    ctx.fillText('● Made at itsfootball.club', W / 2, size === 'story' ? H - 150 : H - 26);
  }

  return new Promise((resolve, reject) => canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Could not create the image.'))), 'image/png'));
}
