'use client';

// The Season review's "season in numbers" card (X6), drawn on a canvas in the browser like the
// matchday graphics (lib/share-card.ts): a 9:16 story and a 4:5 post, in the club's colours.
import { CARD_SIZES, crest, ellipsize, fit, hex, mixWhite, roundRect, spaced } from '@/lib/share-card';
import type { PitchView } from '@/lib/season-review';

export type SeasonCardFormat = 'story' | 'post';

export interface SeasonCardInput {
  club: { name: string; logo_url?: string | null; primary_color?: string | null; secondary_color?: string | null };
  season: string;
  /** "The whole club, in numbers" or the team's name */
  subtitle: string;
  card: PitchView['card'];
  sponsors: number;
  site: string;
}

const deep = (c: string, k: number) => {
  const n = parseInt(c.slice(1), 16);
  return `rgb(${Math.round(((n >> 16) & 255) * k)}, ${Math.round(((n >> 8) & 255) * k)}, ${Math.round((n & 255) * k)})`;
};

export async function drawSeasonCard(i: SeasonCardInput, format: SeasonCardFormat): Promise<Blob> {
  const { w: W, h: H } = CARD_SIZES[format];
  const story = format === 'story';
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available in this browser.');

  const rootStyle = getComputedStyle(document.documentElement);
  const body = getComputedStyle(document.body).fontFamily || 'system-ui, sans-serif';
  const outfit = rootStyle.getPropertyValue('--font-outfit').trim();
  const heading = outfit ? `${outfit}, ${body}` : body;
  await Promise.all([`900 100px ${heading}`, `800 40px ${heading}`, `700 30px ${body}`, `600 30px ${body}`].map(f => document.fonts?.load(f).catch(() => null)));

  const primary = hex(i.club.primary_color || undefined, '#10B981');
  const secondary = hex(i.club.secondary_color || undefined, '#0F172A');
  // The club colour, deepened so white text reads on it, running into the second colour
  const g = ctx.createLinearGradient(0, 0, W * 0.5, H);
  g.addColorStop(0, deep(primary, 0.9));
  g.addColorStop(0.55, deep(primary, 0.5));
  g.addColorStop(1, deep(secondary === primary ? '#0F172A' : secondary, 0.55));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // Thin diagonal stripes, like a kit
  ctx.save();
  ctx.globalAlpha = 0.05;
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 6;
  for (let x = -H; x < W + H; x += 70) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + H * 0.45, H); ctx.stroke(); }
  ctx.restore();

  const pad = 80;
  let y = story ? 110 : 80;
  // Crest and club name
  const logo = await crest(i.club.logo_url || undefined);
  const cs = story ? 120 : 100;
  if (logo) {
    const k = Math.min(cs / logo.width, cs / logo.height);
    ctx.drawImage(logo, pad, y, logo.width * k, logo.height * k);
  }
  ctx.fillStyle = '#fff';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  fit(ctx, i.club.name, 700, story ? 40 : 36, W - pad * 2 - cs - 30, body, 24);
  ctx.fillText(ellipsize(ctx, i.club.name, W - pad * 2 - cs - 30), pad + cs + 30, y + cs / 2);
  y += cs + (story ? 110 : 60);

  // "Season 2026"
  ctx.textBaseline = 'alphabetic';
  const big = story ? 190 : 150;
  fit(ctx, 'SEASON', 900, big, W - pad * 2, heading, 80);
  ctx.fillText('SEASON', pad, y + big * 0.8);
  y += big * 0.95;
  fit(ctx, i.season, 900, big, W - pad * 2, heading, 60);
  ctx.fillStyle = mixWhite(primary, 0.75);
  ctx.fillText(i.season, pad, y + big * 0.8);
  y += big + (story ? 30 : 10);
  ctx.fillStyle = 'rgba(255,255,255,.85)';
  fit(ctx, i.subtitle, 600, 40, W - pad * 2, body, 26);
  ctx.fillText(ellipsize(ctx, i.subtitle, W - pad * 2), pad, y);
  y += story ? 60 : 40;

  // Four figures in a two-by-two grid of glass tiles
  const gap = 24;
  const tw = (W - pad * 2 - gap) / 2;
  const th = story ? 230 : 180;
  i.card.figures.slice(0, 4).forEach(([value, label], k) => {
    const x = pad + (k % 2) * (tw + gap);
    const ty = y + Math.floor(k / 2) * (th + gap);
    roundRect(ctx, x, ty, tw, th, 32);
    ctx.fillStyle = 'rgba(255,255,255,.12)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.22)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#fff';
    fit(ctx, value, 800, story ? 120 : 96, tw - 60, heading, 40);
    ctx.fillText(value, x + 32, ty + th * 0.6);
    ctx.font = `600 ${story ? 34 : 30}px ${body}`;
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    ctx.fillText(ellipsize(ctx, label, tw - 64), x + 32, ty + th * 0.85);
  });
  y += Math.ceil(Math.min(4, i.card.figures.length) / 2) * (th + gap) + (story ? 16 : 0);

  // The cup line on a white pill
  if (i.card.cup) {
    const ph = story ? 150 : 120;
    roundRect(ctx, pad, y, W - pad * 2, ph, 32);
    ctx.fillStyle = '#fff';
    ctx.fill();
    // A gold medal, drawn rather than an emoji so it looks the same on every phone
    const r = story ? 40 : 34;
    ctx.beginPath(); ctx.arc(pad + 30 + r, y + ph / 2, r, 0, Math.PI * 2);
    ctx.fillStyle = '#D4A017'; ctx.fill();
    ctx.beginPath(); ctx.arc(pad + 30 + r, y + ph / 2, r * 0.62, 0, Math.PI * 2);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.stroke();
    ctx.fillStyle = '#0f172a';
    fit(ctx, i.card.cup, 800, story ? 44 : 38, W - pad * 2 - 160, heading, 24);
    ctx.fillText(ellipsize(ctx, i.card.cup, W - pad * 2 - 160), pad + 130, y + (i.card.cupSub ? ph * 0.47 : ph * 0.6));
    if (i.card.cupSub) {
      ctx.fillStyle = '#64748b';
      ctx.font = `600 ${story ? 32 : 28}px ${body}`;
      ctx.fillText(ellipsize(ctx, i.card.cupSub, W - pad * 2 - 160), pad + 130, y + ph * 0.78);
    }
    y += ph + (story ? 40 : 24);
  }

  // The award line
  if (i.card.award && (story || !i.card.cup)) {
    ctx.fillStyle = '#fff';
    fit(ctx, i.card.award, 800, story ? 56 : 46, W - pad * 2, heading, 28);
    ctx.fillText(ellipsize(ctx, i.card.award, W - pad * 2), pad, y + 50);
    if (i.card.awardSub) {
      ctx.fillStyle = 'rgba(255,255,255,.85)';
      ctx.font = `600 ${story ? 34 : 30}px ${body}`;
      ctx.fillText(ellipsize(ctx, i.card.awardSub, W - pad * 2), pad, y + 100);
    }
  }

  // Footer: a thank-you to the sponsors and the site
  const fy = H - (story ? 110 : 70);
  ctx.strokeStyle = 'rgba(255,255,255,.3)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(pad, fy - 50); ctx.lineTo(W - pad, fy - 50); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.9)';
  ctx.font = `600 30px ${body}`;
  spaced(ctx, 1);
  if (i.sponsors > 0) ctx.fillText(`Thanks to our ${i.sponsors} sponsor${i.sponsors === 1 ? '' : 's'}`, pad, fy);
  ctx.textAlign = 'right';
  ctx.fillText(i.site, W - pad, fy);
  spaced(ctx, 0);

  return new Promise((resolve, reject) => canvas.toBlob(b => (b ? resolve(b) : reject(new Error('The card could not be made.'))), 'image/png'));
}
