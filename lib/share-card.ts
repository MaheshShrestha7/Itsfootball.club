'use client';

// Matchday graphics (fixture / result / starting XI) drawn on a canvas in the browser, sized for an
// Instagram or WhatsApp post (1080 x 1350). Nothing runs on the server and nothing new is installed.
import { DEFAULT_CREST } from '@/lib/crest';
import { corsCopy } from '@/lib/image-color';
import type { Club, Match } from '@/lib/supabase/types';

export type CardKind = 'score' | 'lineup';

const W = 1080;
const H = 1350;
const INK = '#F8FAFC';
const MUTED = 'rgba(248, 250, 252, 0.72)';

const hex = (c: string | undefined, fallback: string) => (c && /^#[0-9a-f]{6}$/i.test(c) ? c : fallback);

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
    if (ctx.measureText(text).width <= maxWidth) return;
  }
  ctx.font = `${weight} ${min}px ${family}`;
}

function drawContain(ctx: CanvasRenderingContext2D, img: HTMLImageElement | null, cx: number, cy: number, box: number) {
  if (!img) return;
  const scale = Math.min(box / (img.naturalWidth || box), box / (img.naturalHeight || box));
  const w = (img.naturalWidth || box) * scale;
  const h = (img.naturalHeight || box) * scale;
  ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h);
}

/** "Sat 4 Oct · 14:30". Date-only fixtures (tournaments) keep their own date and local kick-off time */
function kickoffText(m: Pick<Match, 'match_date' | 'match_time'>, locale?: string): string {
  const d = new Date(m.match_date);
  if (isNaN(d.getTime())) return '';
  const dateOnly = !!m.match_time && d.getUTCHours() === 0 && d.getUTCMinutes() === 0;
  const day = d.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short', ...(dateOnly ? { timeZone: 'UTC' } : {}) });
  const time = m.match_time || d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  return `${day} · ${time}`;
}

function statusLabel(m: Pick<Match, 'status'>): string {
  return m.status === 'completed' ? 'FULL TIME'
    : m.status === 'live' ? 'LIVE'
    : m.status === 'halftime' ? 'HALF TIME'
    : m.status === 'postponed' ? 'POSTPONED'
    : m.status === 'cancelled' ? 'CANCELLED'
    : 'MATCHDAY';
}

export async function drawMatchCard(match: Match, club: Club, kind: CardKind, siteHost: string): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available in this browser.');
  await document.fonts?.ready;
  const family = getComputedStyle(document.body).fontFamily || 'system-ui, sans-serif';
  const primary = hex(club.primary_color, '#10B981');

  // Background: the club colour fading into near-black, with faint pitch markings
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, primary);
  bg.addColorStop(0.55, '#0B1119');
  bg.addColorStop(1, '#05080D');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(W / 2, H / 2, 220, 0, Math.PI * 2);
  ctx.moveTo(0, H / 2);
  ctx.lineTo(W, H / 2);
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Header: club crest and name, then the competition
  drawContain(ctx, await crest(club.logo_url), W / 2, 110, 110);
  ctx.fillStyle = INK;
  fit(ctx, club.name.toUpperCase(), 800, 44, W - 160, family);
  ctx.fillText(club.name.toUpperCase(), W / 2, 215);
  ctx.fillStyle = MUTED;
  const competition = match.title || match.competition || '';
  fit(ctx, competition, 600, 32, W - 160, family);
  ctx.fillText(competition, W / 2, 265);

  if (kind === 'lineup') {
    const home = match.is_club_home ?? true;
    const xi = [...((home ? match.home_lineup_coords : match.away_lineup_coords) || [])]
      .sort((a, b) => a.x - b.x || a.y - b.y) // the pitch runs left to right: goalkeeper first, then back to front
      .slice(0, 11);
    const opponent = home ? match.away_team_name : match.home_team_name;
    const formation = home ? match.home_formation : match.away_formation;

    ctx.fillStyle = INK;
    ctx.font = `900 92px ${family}`;
    ctx.fillText('STARTING XI', W / 2, 390);
    ctx.fillStyle = MUTED;
    const sub = `vs ${opponent}${formation ? ` · ${formation}` : ''}`;
    fit(ctx, sub, 600, 36, W - 160, family);
    ctx.fillText(sub, W / 2, 465);

    ctx.textAlign = 'left';
    xi.forEach((p, i) => {
      const y = 560 + i * 58;
      ctx.fillStyle = primary;
      ctx.font = `900 40px ${family}`;
      ctx.fillText(String(p.number ?? ''), 250, y);
      ctx.fillStyle = INK;
      const name = `${p.name}${p.is_captain ? ' (C)' : ''}`;
      fit(ctx, name, 700, 40, 560, family);
      ctx.fillText(name, 340, y);
    });
    ctx.textAlign = 'center';
  } else {
    const [homeCrest, awayCrest] = await Promise.all([crest(match.home_team_logo), crest(match.away_team_logo)]);
    drawContain(ctx, homeCrest, 260, 560, 260);
    drawContain(ctx, awayCrest, W - 260, 560, 260);
    ctx.fillStyle = INK;
    for (const [name, x] of [[match.home_team_name, 260], [match.away_team_name, W - 260]] as const) {
      fit(ctx, name, 800, 40, 400, family);
      ctx.fillText(name, x, 745);
    }

    const scored = ['completed', 'live', 'halftime'].includes(match.status);
    if (scored) {
      ctx.font = `900 150px ${family}`;
      ctx.fillText(`${match.home_score}–${match.away_score}`, W / 2, 900);
      if (match.home_penalty_score != null && match.away_penalty_score != null) {
        ctx.fillStyle = MUTED;
        ctx.font = `700 34px ${family}`;
        ctx.fillText(`${match.home_penalty_score}–${match.away_penalty_score} on penalties`, W / 2, 990);
      }
    } else {
      ctx.font = `900 120px ${family}`;
      ctx.fillText('VS', W / 2, 560);
      ctx.fillStyle = INK;
      const when = kickoffText(match);
      fit(ctx, when, 800, 56, W - 160, family);
      ctx.fillText(when, W / 2, 900);
    }

    // Status pill
    const label = statusLabel(match);
    ctx.font = `800 34px ${family}`;
    const pillW = ctx.measureText(label).width + 64;
    ctx.fillStyle = primary;
    ctx.beginPath();
    ctx.roundRect(W / 2 - pillW / 2, 1040, pillW, 64, 32);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(label, W / 2, 1073);
  }

  // Footer: venue and where to follow along
  ctx.fillStyle = MUTED;
  if (match.venue) {
    fit(ctx, match.venue, 600, 32, W - 160, family);
    ctx.fillText(match.venue, W / 2, 1180);
  }
  ctx.font = `700 30px ${family}`;
  ctx.fillText(`${siteHost}/${club.slug}`, W / 2, 1262);

  return new Promise((resolve, reject) =>
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Could not create the image.'))), 'image/png'));
}
