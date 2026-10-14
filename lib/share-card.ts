'use client';

// Matchday graphics (fixture / result / starting XI) drawn on a canvas in the browser, in two sizes:
// a 9:16 story (Instagram and Facebook stories, WhatsApp status) and a 4:5 post (Instagram feed,
// Facebook groups, WhatsApp chats). Nothing runs on the server and nothing new is installed.
import { DEFAULT_CREST } from '@/lib/crest';
import { corsCopy } from '@/lib/image-color';
import { SITE_URL } from '@/lib/slugs';
import { readableClubInk } from '@/lib/theme-utils';
import { juniorPublicName } from '@/lib/teams';
import type { Club, Match, MatchEvent } from '@/lib/supabase/types';

/** score: fixture or result; lineup: the XI on the pitch; lineup-list: the XI as a numbered list */
export type CardKind = 'score' | 'lineup' | 'lineup-list';
export type CardFormat = 'story' | 'post';

export const CARD_SIZES: Record<CardFormat, { w: number; h: number }> = {
  story: { w: 1080, h: 1920 },
  post: { w: 1080, h: 1350 },
};

export interface CardOptions {
  format?: CardFormat;
  /** The team hides its scores publicly (junior grassroots rules): no score and no scorers */
  hideScore?: boolean;
  /** The match's events, already shortened for junior players; goals become the scorer lines */
  events?: Pick<MatchEvent, 'event_type' | 'team_side' | 'player_name' | 'minute' | 'added_minute'>[];
  /** Player photos by member id, as the public lineup shows them (none for juniors without consent) */
  photos?: Record<string, string | undefined>;
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

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
}

/** The site's glass panel: a faint white fill with a hairline border */
function glass(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r = 44) {
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
function kickoff(m: Pick<Match, 'match_date' | 'match_time'>, locale?: string): { day: string; time: string } {
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
      const minute = `${e.minute}${e.added_minute ? `+${e.added_minute}` : ''}'${e.event_type === 'penalty' ? ' (P)' : ''}`;
      byName.set(e.player_name, [...(byName.get(e.player_name) || []), minute]);
    });
  return [...byName].map(([name, minutes]) => `${name} ${minutes.join(', ')}`);
}

export async function drawMatchCard(match: Match, club: Club, kind: CardKind, link: string, opts: CardOptions = {}): Promise<Blob> {
  const format = opts.format || 'post';
  const { w: W, h: H } = CARD_SIZES[format];
  const story = format === 'story';
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

  // Background: near-black with the club colour glowing in from the top, a soft streak across,
  // the pass card's dot grid and the crest large and faded behind everything
  ctx.fillStyle = BASE;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W * 0.3, -H * 0.05, 0, W * 0.3, -H * 0.05, H * 0.75);
  glow.addColorStop(0, rgba(primary, 0.75));
  glow.addColorStop(0.45, rgba(primary, 0.22));
  glow.addColorStop(1, rgba(primary, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
  const low = ctx.createRadialGradient(W, H, 0, W, H, H * 0.55);
  low.addColorStop(0, rgba(secondary === primary ? primary : secondary, 0.22));
  low.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = low;
  ctx.fillRect(0, 0, W, H);
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

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const M = 72; // side margin

  // Header: crest and club name on the left, the competition on the right
  // Stories keep clear of the app's own bars (profile at the top, reply box at the bottom)
  const headY = story ? 270 : 100;
  drawContain(ctx, clubCrest, M + 50, headY, 100);
  ctx.textAlign = 'left';
  ctx.fillStyle = INK;
  fit(ctx, club.name, 800, 40, W - M * 2 - 130 - 300, heading);
  ctx.fillText(club.name, M + 124, headY - 20);
  ctx.fillStyle = FAINT;
  spaced(ctx, 4);
  ctx.font = `700 24px ${body}`;
  const eyebrow = kind !== 'score' ? 'TEAM NEWS' : match.status === 'completed' ? 'RESULT' : match.status === 'live' || match.status === 'halftime' ? 'LIVE' : 'FIXTURE';
  ctx.fillText(eyebrow, M + 124, headY + 26);
  spaced(ctx, 0);
  const competition = (match.title || match.competition || '').toUpperCase();
  if (competition) {
    spaced(ctx, 2);
    const size = fit(ctx, competition, 700, 24, 280, body, 18);
    const pillW = ctx.measureText(competition).width + 44;
    roundRect(ctx, W - M - pillW, headY - 26, pillW, 52, 26);
    ctx.fillStyle = rgba(primary, 0.18);
    ctx.fill();
    ctx.strokeStyle = rgba(ink, 0.55);
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = ink;
    ctx.font = `700 ${size}px ${body}`;
    ctx.fillText(competition, W - M - pillW + 22, headY + 1);
    spaced(ctx, 0);
  }
  ctx.textAlign = 'center';

  const scored = kind === 'score' && !opts.hideScore && ['completed', 'live', 'halftime'].includes(match.status);
  const [first, second] = kind !== 'score' ? ['STARTING', 'XI'] : headline(match, scored);

  // Headline
  const hlY = story ? 500 : 290;
  const hlSize = story ? 170 : 132;
  ctx.font = `900 ${hlSize}px ${heading}`;
  const gap = hlSize * 0.12;
  const wA = ctx.measureText(first).width;
  const wB = ctx.measureText(second).width;
  const scale = Math.min(1, (W - M * 2) / (wA + gap + wB));
  ctx.font = `900 ${Math.floor(hlSize * scale)}px ${heading}`;
  const startX = W / 2 - (wA + gap + wB) * scale / 2;
  ctx.textAlign = 'left';
  ctx.fillStyle = INK;
  ctx.fillText(first, startX, hlY);
  ctx.fillStyle = ink;
  ctx.fillText(second, startX + (wA + gap) * scale, hlY);
  ctx.textAlign = 'center';

  if (kind !== 'score') {
    const home = match.is_club_home ?? true;
    const xi = [...((home ? match.home_lineup_coords : match.away_lineup_coords) || [])]
      .sort((a, b) => a.x - b.x || a.y - b.y) // the pitch runs left to right: goalkeeper first, then back to front
      .slice(0, 11);
    const opponent = home ? match.away_team_name : match.home_team_name;
    const formation = home ? match.home_formation : match.away_formation;
    const { day, time } = kickoff(match);

    ctx.fillStyle = MUTED;
    const sub = `vs ${opponent}${formation ? ` · ${formation}` : ''}`;
    fit(ctx, sub, 600, 38, W - M * 2, body);
    ctx.fillText(sub, W / 2, hlY + 100);

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
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
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
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.lineWidth = 2 * k;
        ctx.stroke();
        if (!photo) {
          const parts = p.name.trim().split(/\s+/);
          const initials = (parts[0].charAt(0) + (parts.length > 1 ? parts[parts.length - 1].charAt(0) : '')).toUpperCase();
          ctx.fillStyle = '#FFFFFF';
          ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
          ctx.shadowBlur = 3 * k;
          ctx.font = `900 ${15 * k}px ${heading}`;
          ctx.fillText(initials, cx, cy + 1);
          ctx.shadowBlur = 0;
        }

        // Shirt number tag (bottom-left)
        if (p.number > 0) {
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
        ctx.fillText(String(p.number ?? ''), M + 90, y);
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
  } else {
    const [homeCrest, awayCrest] = await Promise.all([crest(match.home_team_logo), crest(match.away_team_logo)]);
    const panelTop = story ? 640 : 400;
    const panelH = story ? 540 : 420;
    glass(ctx, M, panelTop, W - M * 2, panelH);
    const crestBox = story ? 210 : 170;
    const colX = [M + 200, W - M - 200];
    const crestY = panelTop + (story ? 200 : 150);
    drawContain(ctx, homeCrest, colX[0], crestY, crestBox);
    drawContain(ctx, awayCrest, colX[1], crestY, crestBox);
    ctx.fillStyle = INK;
    const nameY = panelTop + panelH - (story ? 110 : 82);
    wrapTwo(ctx, match.home_team_name, 800, story ? 44 : 38, 340, heading, colX[0], nameY);
    wrapTwo(ctx, match.away_team_name, 800, story ? 44 : 38, 340, heading, colX[1], nameY);

    if (scored) {
      ctx.fillStyle = INK;
      const score = `${match.home_score ?? 0}–${match.away_score ?? 0}`;
      fit(ctx, score, 900, story ? 160 : 132, 270, heading, 60);
      ctx.fillText(score, W / 2, crestY);
      if (match.home_penalty_score != null && match.away_penalty_score != null) {
        ctx.fillStyle = MUTED;
        ctx.font = `700 28px ${body}`;
        ctx.fillText(`${match.home_penalty_score}–${match.away_penalty_score} on pens`, W / 2, crestY + (story ? 120 : 96));
      }
    } else {
      // "VS" in a ring of the club colour
      ctx.beginPath();
      ctx.arc(W / 2, crestY, story ? 74 : 60, 0, Math.PI * 2);
      ctx.fillStyle = rgba(primary, 0.2);
      ctx.fill();
      ctx.strokeStyle = rgba(ink, 0.7);
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = INK;
      ctx.font = `900 ${story ? 60 : 50}px ${heading}`;
      ctx.fillText('VS', W / 2, crestY + 3);
    }

    const below = panelTop + panelH + (story ? 70 : 50);
    if (scored && opts.events?.length) {
      // Goalscorers under each team
      ctx.font = `600 ${story ? 32 : 28}px ${body}`;
      const lineH = story ? 48 : 40;
      const max = story ? 6 : 3;
      (['home', 'away'] as const).forEach((side, i) => {
        const lines = scorerLines(opts.events!, side);
        const shown = lines.length > max ? [...lines.slice(0, max - 1), `+${lines.length - max + 1} more`] : lines;
        shown.forEach((line, j) => {
          ctx.fillStyle = MUTED;
          fit(ctx, line, 600, story ? 32 : 28, 400, body, 20);
          ctx.fillText(line, colX[i], below + j * lineH);
        });
      });
    }

    // Kick-off, date and ground: on a fixture always, on a result as one quiet line
    const { day, time } = kickoff(match);
    if (!scored) {
      const top = below - (story ? 10 : 15);
      const cardH = story ? 270 : 210;
      glass(ctx, M, top, W - M * 2, cardH, 36);
      const cells: [string, string][] = [['DATE', day], ['KICK-OFF', time]];
      cells.forEach(([label, value], i) => {
        const cx = M + (W - M * 2) * (i === 0 ? 0.27 : 0.73);
        ctx.fillStyle = FAINT;
        spaced(ctx, 3);
        ctx.font = `700 22px ${body}`;
        ctx.fillText(label, cx, top + (story ? 56 : 46));
        spaced(ctx, 0);
        ctx.fillStyle = INK;
        fit(ctx, value || 'TBC', 800, story ? 54 : 46, (W - M * 2) / 2 - 60, heading);
        ctx.fillText(value || 'TBC', cx, top + (story ? 110 : 96));
      });
      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.fillRect(W / 2 - 1, top + 30, 2, story ? 115 : 100);
      if (match.venue) {
        ctx.fillRect(M + 40, top + (story ? 170 : 140), W - M * 2 - 80, 2);
        ctx.fillStyle = MUTED;
        fit(ctx, match.venue, 600, story ? 34 : 30, W - M * 2 - 80, body);
        ctx.fillText(match.venue, W / 2, top + (story ? 222 : 176));
      }
    } else {
      ctx.fillStyle = FAINT;
      const line = [day, match.venue].filter(Boolean).join(' · ');
      fit(ctx, line, 600, 28, W - M * 2, body);
      ctx.fillText(line, W / 2, H - (story ? 310 : 150));
    }
  }

  // Watermark: a quiet link to the club's page, so the graphic leads people back to the site
  const markY = H - (story ? 240 : 64);
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
