'use client';

import { DATE_LOCALE } from '@/lib/dates';
import { crest, drawContain, drawCover, ellipsize, fit, hex, loadImage, roundRect, spaced } from '@/lib/share-card';
import type { Club, ClubEvent, EventCategory } from '@/lib/supabase/types';

// The flyer maker in Admin > Events: an event flyer drawn from the event itself (title, date, place,
// price), in club colours, with a QR to the event page and the sponsors whose package includes event
// flyers. Paper sizes share one A-series shape (printed to fit A5, A4 or A3); Story and Post are for socials.

export type FlyerSize = 'paper' | 'story' | 'post';
export const FLYER_SIZES: Record<FlyerSize, { w: number; h: number }> = {
  paper: { w: 1754, h: 2480 }, // A-series, 300dpi at A5 and 150dpi at A3
  story: { w: 1080, h: 1920 },
  post: { w: 1080, h: 1350 },
};

const CATEGORY_LABEL: Record<EventCategory, string> = {
  match: 'Match day', training: 'Training', social: 'Social event', agm: 'AGM', trial: 'Trials', tournament: 'Tournament',
};

const INK = '#0F172A';
const MUTED = '#64748B';
const LINE = '#E2E8F0';

export interface FlyerOptions {
  size: FlyerSize;
  /** "$25" when ticket prices are on the flyer */
  price?: string;
  /** The QR (a drawn QR canvas) and the address printed beside it */
  qr?: { canvas: HTMLCanvasElement; link: string; ticketed: boolean };
  sponsors?: { src?: string; name: string }[];
  /** A photo behind the title, from the admin's device */
  photo?: string;
}

/** Mixes `c` towards a deep navy, for the dark end of the title band */
const deepen = (c: string, k: number) => {
  const n = parseInt(c.slice(1), 16);
  const to = [11, 21, 48];
  const ch = (v: number, i: number) => Math.round(v + (to[i] - v) * k);
  return `rgb(${ch((n >> 16) & 255, 0)}, ${ch((n >> 8) & 255, 1)}, ${ch(n & 255, 2)})`;
};

/** "Friday 21 November · 7:00 pm", with the finish time when it ends the same day */
export function flyerWhen(event: Pick<ClubEvent, 'start_time' | 'end_time'>): string {
  const start = new Date(event.start_time);
  const time = (d: Date) => d.toLocaleTimeString(DATE_LOCALE, { hour: 'numeric', minute: '2-digit' });
  const day = start.toLocaleDateString(DATE_LOCALE, { weekday: 'long', day: 'numeric', month: 'long' });
  const end = event.end_time ? new Date(event.end_time) : null;
  const sameDay = end && !isNaN(end.getTime()) && end > start && end.toDateString() === start.toDateString();
  return `${day} · ${time(start)}${sameDay ? ` to ${time(end)}` : ''}`;
}

/** Up to three lines of `text` at the largest size (down to `min`) that fits `maxWidth` */
function titleLines(ctx: CanvasRenderingContext2D, text: string, family: string, size: number, min: number, maxWidth: number) {
  const words = text.split(/\s+/).filter(Boolean);
  for (let s = size; s >= min; s -= 4) {
    ctx.font = `900 ${s}px ${family}`;
    const lines: string[] = [];
    for (const w of words) {
      const last = lines[lines.length - 1];
      if (last && ctx.measureText(`${last} ${w}`).width <= maxWidth) lines[lines.length - 1] = `${last} ${w}`;
      else lines.push(w);
    }
    if (lines.length <= 3 && lines.every(l => ctx.measureText(l).width <= maxWidth)) return { lines, size: s };
  }
  ctx.font = `900 ${min}px ${family}`;
  const lines = [text];
  return { lines: lines.map(l => ellipsize(ctx, l, maxWidth)), size: min };
}

export async function drawEventFlyer(event: ClubEvent, club: Pick<Club, 'name' | 'logo_url' | 'primary_color'>, opts: FlyerOptions): Promise<Blob> {
  const { w: W, h: H } = FLYER_SIZES[opts.size];
  const u = W / 1080; // every measure below is for a 1080px-wide flyer
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available in this browser.');

  // The site's own fonts, as the share graphics use them
  const rootStyle = getComputedStyle(document.documentElement);
  const body = getComputedStyle(document.body).fontFamily || 'system-ui, sans-serif';
  const outfit = rootStyle.getPropertyValue('--font-outfit').trim();
  const heading = outfit ? `${outfit}, ${body}` : body;
  await Promise.all([`900 100px ${heading}`, `800 40px ${heading}`, `700 30px ${body}`, `600 30px ${body}`]
    .map(f => document.fonts?.load(f).catch(() => null)));

  const primary = hex(club.primary_color, '#2563EB');
  const [clubCrest, photo, sponsorImgs] = await Promise.all([
    crest(club.logo_url),
    opts.photo ? loadImage(opts.photo) : Promise.resolve(null),
    Promise.all((opts.sponsors || []).slice(0, 5).map(async s => ({ name: s.name, img: s.src ? await loadImage(s.src) : null }))),
  ]);

  const M = 84 * u;
  // Post is the shortest, so its band and rows are tighter
  const post = opts.size === 'post';
  const k = post ? 0.86 : 1;
  const bandH = H * (post ? 0.38 : 0.4);

  // White page, then the title band in club colours (or the photo, tinted in club colours)
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, W, H);
  if (photo) {
    drawCover(ctx, photo, 0, 0, W, bandH, 0.4);
    const tint = ctx.createLinearGradient(0, 0, 0, bandH);
    tint.addColorStop(0, deepen(primary, 0.2).replace('rgb', 'rgba').replace(')', ', 0.55)'));
    tint.addColorStop(1, deepen(primary, 0.75).replace('rgb', 'rgba').replace(')', ', 0.92)'));
    ctx.fillStyle = tint;
  } else {
    const band = ctx.createLinearGradient(0, 0, W * 0.4, bandH);
    band.addColorStop(0, primary);
    band.addColorStop(1, deepen(primary, 0.7));
    ctx.fillStyle = band;
  }
  ctx.fillRect(0, 0, W, bandH);

  // Crest on a dark tile and the club name
  const crestBox = 104 * u;
  roundRect(ctx, M, M, crestBox, crestBox, 22 * u);
  ctx.fillStyle = 'rgba(11, 21, 48, 0.85)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.lineWidth = 4 * u;
  ctx.stroke();
  drawContain(ctx, clubCrest, M + crestBox / 2, M + crestBox / 2, crestBox * 0.72);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#FFFFFF';
  fit(ctx, club.name, 800, 44 * u, W - M * 2 - crestBox - 28 * u, heading, 24 * u);
  ctx.fillText(ellipsize(ctx, club.name, W - M * 2 - crestBox - 28 * u), M + crestBox + 28 * u, M + crestBox / 2);

  // The event title, bottom-aligned in the band, with its category above
  const title = titleLines(ctx, event.title.toUpperCase(), heading, (post ? 116 : 132) * u, 60 * u, W - M * 2);
  const lineH = title.size * 0.98;
  let y = bandH - M * 0.85 - lineH * (title.lines.length - 1);
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.82)';
  ctx.font = `800 ${28 * u}px ${body}`;
  spaced(ctx, 7 * u);
  ctx.fillText(CATEGORY_LABEL[event.category]?.toUpperCase() || 'EVENT', M, y - title.size * 0.9);
  spaced(ctx, 0);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `900 ${title.size}px ${heading}`;
  for (const line of title.lines) {
    ctx.fillText(line, M, y);
    y += lineH;
  }

  // When, where and tickets, with the QR beside the last of them
  const qrBox = opts.qr ? (post ? 220 : 270) * u : 0;
  const rows: { label: string; value: string; note?: string }[] = [
    { label: 'When', value: flyerWhen(event) },
    ...(event.location ? [{ label: 'Where', value: event.location }] : []),
  ];
  if (opts.price) rows.push({ label: 'Tickets', value: opts.price, note: opts.qr ? `Scan to buy, or ${opts.qr.link}` : undefined });
  else if (opts.qr) rows.push({ label: 'Details', value: opts.qr.ticketed ? 'Tickets online' : 'Scan for details', note: opts.qr.link });

  const sponsorsH = sponsorImgs.length ? 230 * u : 0;
  const rowGap = (post ? 14 : 56) * u;
  const rowH = 118 * k * u;
  let top = bandH + (post ? 50 : 92) * u;
  rows.forEach((row, i) => {
    const last = i === rows.length - 1;
    const width = W - M * 2 - (last && qrBox ? qrBox + 40 * u : 0);
    ctx.textAlign = 'left';
    ctx.fillStyle = MUTED;
    ctx.font = `800 ${26 * k * u}px ${body}`;
    spaced(ctx, 6 * u);
    ctx.fillText(row.label.toUpperCase(), M, top + 26 * k * u);
    spaced(ctx, 0);
    ctx.fillStyle = INK;
    fit(ctx, row.value, 700, 50 * k * u, width, body, 30 * u);
    ctx.fillText(ellipsize(ctx, row.value, width), M, top + 90 * k * u);
    if (row.note) {
      ctx.fillStyle = MUTED;
      fit(ctx, row.note, 500, 28 * k * u, width, body, 18 * u);
      ctx.fillText(ellipsize(ctx, row.note, width), M, top + 138 * k * u);
    }
    if (last && opts.qr && qrBox) {
      const qx = W - M - qrBox;
      const qy = Math.min(top - 20 * u, H - sponsorsH - M - qrBox - 20 * u);
      roundRect(ctx, qx, qy, qrBox, qrBox, 26 * u);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 5 * u;
      ctx.stroke();
      const pad = 22 * u;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(opts.qr.canvas, qx + pad, qy + pad, qrBox - pad * 2, qrBox - pad * 2);
      ctx.imageSmoothingEnabled = true;
    }
    top += rowH + (row.note ? 40 * k * u : 0) + rowGap;
  });

  // The event's description in the space that's left, so a flyer without a QR or sponsors isn't half empty
  const limit = H - M - (sponsorImgs.length ? sponsorsH + 40 * u : 0);
  const about = (event.description || '').replace(/\s+/g, ' ').trim();
  if (about && limit - top > 120 * u) {
    const size = 34 * k * u;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#334155';
    ctx.font = `500 ${size}px ${body}`;
    const lines: string[] = [];
    for (const word of about.split(' ')) {
      const last = lines[lines.length - 1];
      if (last !== undefined && ctx.measureText(`${last} ${word}`).width <= W - M * 2) lines[lines.length - 1] = `${last} ${word}`;
      else lines.push(word);
    }
    const fits = Math.max(0, Math.floor((limit - top) / (size * 1.45)));
    const shown = lines.slice(0, fits);
    if (lines.length > fits && shown.length) shown[shown.length - 1] = ellipsize(ctx, `${shown[shown.length - 1]}…`, W - M * 2);
    shown.forEach((line, i) => ctx.fillText(line, M, top + size + i * size * 1.45));
  }

  // The event's sponsors along the bottom, on white tiles with a hairline border
  if (sponsorImgs.length) {
    const tileH = 120 * u;
    const gap = 22 * u;
    const tileW = Math.min(300 * u, (W - M * 2 - gap * (sponsorImgs.length - 1)) / sponsorImgs.length);
    const ty = H - M - tileH;
    ctx.strokeStyle = LINE;
    ctx.lineWidth = 3 * u;
    ctx.beginPath();
    ctx.moveTo(M, ty - 96 * u);
    ctx.lineTo(W - M, ty - 96 * u);
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.fillStyle = MUTED;
    ctx.font = `800 ${24 * u}px ${body}`;
    spaced(ctx, 6 * u);
    ctx.fillText('THIS EVENT IS SUPPORTED BY', W / 2, ty - 34 * u);
    spaced(ctx, 0);
    let x = W / 2 - (tileW * sponsorImgs.length + gap * (sponsorImgs.length - 1)) / 2;
    for (const { img, name } of sponsorImgs) {
      roundRect(ctx, x, ty, tileW, tileH, 18 * u);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
      ctx.strokeStyle = LINE;
      ctx.lineWidth = 3 * u;
      ctx.stroke();
      const pad = 20 * u;
      if (img) {
        const scale = Math.min((tileW - pad * 2) / img.naturalWidth, (tileH - pad * 2) / img.naturalHeight);
        ctx.drawImage(img, x + (tileW - img.naturalWidth * scale) / 2, ty + (tileH - img.naturalHeight * scale) / 2, img.naturalWidth * scale, img.naturalHeight * scale);
      } else {
        ctx.fillStyle = INK;
        ctx.textBaseline = 'middle';
        fit(ctx, name.toUpperCase(), 800, 30 * u, tileW - pad * 2, heading, 14 * u);
        ctx.fillText(ellipsize(ctx, name.toUpperCase(), tileW - pad * 2), x + tileW / 2, ty + tileH / 2);
        ctx.textBaseline = 'alphabetic';
      }
      x += tileW + gap;
    }
  }

  return new Promise((resolve, reject) =>
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Could not create the image.'))), 'image/png'));
}
