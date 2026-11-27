'use client';

import {
  BASE, CARD_SIZES, FAINT, INK, MAX_SPONSORS, MUTED, crest, drawContain, ellipsize, fit, hex, kickoff, loadSponsors,
  mixWhite, paintPattern, paintShade, rgba, roundRect, spaced, sponsorBlock, sponsorRow, type CardLook, type CardSponsor,
} from '@/lib/share-card';
import { soonestFirst } from '@/lib/fixtures';
import { readableClubInk } from '@/lib/theme-utils';
import type { Club, ClubEvent, Match } from '@/lib/supabase/types';

// The event fixtures poster (Admin > Events > Fixtures > Make poster): every club game linked to an
// event (an outside cup) on one story or post graphic, in the match graphics' look: crests and VS per
// game (the score once played), the day, time and pitch under each, the shared ground once with a pin,
// and the event's sponsors along the bottom.

export type PosterFormat = 'story' | 'post';

/** The poster's seven looks, built from the match graphics' backgrounds (the free lineup builder's
 *  shade, pattern and shine). Two-tone runs the club's first colour into its second */
export const POSTER_STYLES = {
  classic: { label: 'Classic', look: { shade: 'dark', pattern: 'dots' } },
  club: { label: 'Club colour', look: { shade: 'club', pattern: 'dots' } },
  twotone: { label: 'Two-tone', look: { shade: 'duo', pattern: 'none', shine: true } },
  stripes: { label: 'Kit stripes', look: { shade: 'club', pattern: 'stripes' } },
  hoops: { label: 'Hoops', look: { shade: 'midnight', pattern: 'hoops' } },
  chevron: { label: 'Chevron', look: { shade: 'dark', pattern: 'chevron', shine: true } },
  floodlights: { label: 'Floodlights', look: { shade: 'midnight', pattern: 'halftone', shine: true } },
} satisfies Record<string, { label: string; look: CardLook }>;
export type PosterStyle = keyof typeof POSTER_STYLES;

export interface PosterGame {
  match: Match;
  /** The team hides its scores publicly (junior grassroots rules) */
  hideScore?: boolean;
}

/** "Field 2" at the end of a venue typed as "Norford Park, Field 2" */
const PITCH_IN_VENUE = /,?\s*((?:field|pitch|court|oval)\s*[\w-]+)\s*$/i;

/** The ground every game shares (shown once, with a pin) and what each row shows: just the pitch
 *  when the ground is shared, else its own ground and pitch */
export function posterPlaces(games: Pick<Match, 'venue' | 'pitch_label'>[]) {
  const split = games.map(g => {
    const venue = (g.venue || '').trim();
    const typed = g.pitch_label?.trim() ? null : PITCH_IN_VENUE.exec(venue);
    return { ground: typed ? venue.slice(0, typed.index).trim() : venue, pitch: g.pitch_label?.trim() || typed?.[1] || '' };
  });
  const shared = split.length > 0 && split.every(s => s.ground && s.ground === split[0].ground) ? split[0].ground : '';
  return { shared, rows: split.map(s => (shared ? s.pitch : [s.ground, s.pitch].filter(Boolean).join(', '))) };
}

/** Earliest kick-off first: by date and time, then by the kick-off time typed on a date-only fixture */
export const posterOrder = (a: Pick<Match, 'match_date' | 'match_time'>, b: Pick<Match, 'match_date' | 'match_time'>) =>
  soonestFirst(a, b) || (a.match_time || '99').localeCompare(b.match_time || '99');

/** The most games a poster lists (rows shrink to fit up to this) */
export const POSTER_MAX_GAMES = 8;

export async function drawFixturesPoster(
  games: PosterGame[],
  event: Pick<ClubEvent, 'title'>,
  club: Pick<Club, 'name' | 'logo_url' | 'primary_color' | 'secondary_color'>,
  link: string,
  opts: { format?: PosterFormat; sponsors?: CardSponsor[]; style?: PosterStyle } = {},
): Promise<Blob> {
  const format = opts.format || 'story';
  const story = format === 'story';
  const by = <T,>(st: T, po: T): T => (story ? st : po);
  const { w: W, h: H } = CARD_SIZES[format];
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available in this browser.');

  // The site's own fonts, as the match graphics use them
  const rootStyle = getComputedStyle(document.documentElement);
  const body = getComputedStyle(document.body).fontFamily || 'system-ui, sans-serif';
  const outfit = rootStyle.getPropertyValue('--font-outfit').trim();
  const heading = outfit ? `${outfit}, ${body}` : body;
  await Promise.all([`900 100px ${heading}`, `800 40px ${heading}`, `700 30px ${body}`, `600 30px ${body}`]
    .map(f => document.fonts?.load(f).catch(() => null)));

  const list = [...games].sort((a, b) => posterOrder(a.match, b.match)).slice(0, POSTER_MAX_GAMES);
  const primary = hex(club.primary_color, '#10B981');
  const secondary = hex(club.secondary_color, primary);
  const look: CardLook = { ...POSTER_STYLES[opts.style || 'classic'].look };
  if (look.shade === 'duo') look.second = secondary === primary ? '#0F172A' : secondary;
  // On a background in the club colour the accent words are lifted most of the way to white, as on the match graphics
  const lifted = readableClubInk(primary, 'dark');
  const ink = look.shade === 'club' || look.shade === 'duo' ? mixWhite(lifted, 0.6) : lifted;
  const [clubCrest, sponsors, crests] = await Promise.all([
    crest(club.logo_url),
    loadSponsors(opts.sponsors, MAX_SPONSORS),
    Promise.all(list.map(async ({ match: m }) => {
      // [our crest, theirs]: our side falls back to the club crest when the fixture has none of its own
      const home = m.is_club_home ?? true;
      return Promise.all([
        crest((home ? m.home_team_logo : m.away_team_logo) || club.logo_url),
        crest((home ? m.away_team_logo : m.home_team_logo) || undefined),
      ]);
    })),
  ]);

  // Background: the match graphics' own (the style's shade, the club colour glowing in from the top,
  // the streak, pattern and shine, and the crest large and faded behind)
  ctx.fillStyle = BASE;
  ctx.fillRect(0, 0, W, H);
  paintShade(ctx, W, H, primary, look);
  const glow = ctx.createRadialGradient(W * 0.3, -H * 0.05, 0, W * 0.3, -H * 0.05, H * 0.75);
  glow.addColorStop(0, rgba(primary, 0.75));
  glow.addColorStop(0.45, rgba(primary, 0.22));
  glow.addColorStop(1, rgba(primary, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
  const low = ctx.createRadialGradient(W, H, 0, W, H, H * 0.55);
  low.addColorStop(0, rgba(secondary, 0.22));
  low.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = low;
  ctx.fillRect(0, 0, W, H);
  paintPattern(ctx, W, H, primary, look);
  if (clubCrest) {
    ctx.save();
    ctx.globalAlpha = 0.07;
    ctx.filter = 'grayscale(1) brightness(1.8)';
    drawContain(ctx, clubCrest, W / 2, H * 0.56, story ? 1100 : 900);
    ctx.restore();
  }

  const M = 72;
  ctx.textBaseline = 'middle';

  // Header: crest, club name and FIXTURES or RESULTS, as on the match graphics
  const played = list.filter(g => g.match.status === 'completed');
  const allPlayed = list.length > 0 && played.length === list.length;
  const scoresShown = allPlayed && list.every(g => !g.hideScore);
  const headY = by(270, 100);
  drawContain(ctx, clubCrest, M + 50, headY, 100);
  ctx.textAlign = 'left';
  ctx.fillStyle = INK;
  fit(ctx, club.name, 800, 40, W - M * 2 - 124, heading, 26);
  ctx.fillText(ellipsize(ctx, club.name, W - M * 2 - 124), M + 124, headY - 20);
  ctx.fillStyle = FAINT;
  spaced(ctx, 4);
  ctx.font = `700 24px ${body}`;
  ctx.fillText(allPlayed ? 'RESULTS' : 'FIXTURES', M + 124, headY + 26);
  spaced(ctx, 0);

  // Two-tone headline, then the event's name in a pill
  const [first, second] = scoresShown ? ['OUR', 'RESULTS'] : allPlayed ? ['OUR', 'GAMES'] : ['OUR', 'FIXTURES'];
  const hlY = by(470, 250);
  const hl = by(150, 118);
  ctx.font = `900 ${hl}px ${heading}`;
  const gap = hl * 0.12;
  const wA = ctx.measureText(first).width;
  const wB = ctx.measureText(second).width;
  const scale = Math.min(1, (W - M * 2) / (wA + gap + wB));
  ctx.font = `900 ${Math.floor(hl * scale)}px ${heading}`;
  const startX = W / 2 - ((wA + gap + wB) * scale) / 2;
  ctx.fillStyle = INK;
  ctx.fillText(first, startX, hlY);
  ctx.fillStyle = ink;
  ctx.fillText(second, startX + (wA + gap) * scale, hlY);
  ctx.textAlign = 'center';
  spaced(ctx, 2);
  ctx.font = `800 ${by(28, 25)}px ${body}`;
  const title = ellipsize(ctx, event.title.trim().toUpperCase(), W - M * 2 - 60);
  const pillW = ctx.measureText(title).width + 56;
  const pillY = hlY + by(108, 88);
  roundRect(ctx, W / 2 - pillW / 2, pillY - 30, pillW, 60, 30);
  ctx.fillStyle = rgba(primary, 0.18);
  ctx.fill();
  ctx.strokeStyle = rgba(ink, 0.55);
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = ink;
  ctx.fillText(title, W / 2, pillY + 1);
  spaced(ctx, 0);

  // Watermark at the bottom, the sponsors above it
  const linkY = H - by(250, 52);
  const labelH = by(40, 34);
  const laid = sponsorBlock(sponsors, labelH, by(124, 92), by(330, 230));
  const sponsorsTop = linkY - by(40, 34) - (sponsors.length ? laid.height : 0);
  if (sponsors.length) sponsorRow(ctx, laid, sponsorsTop, labelH, 'SUPPORTED BY', W, M, 240, body, heading);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `600 24px ${body}`;
  const linkW = ctx.measureText(link).width;
  ctx.beginPath();
  ctx.arc(W / 2 - linkW / 2 - 18, linkY, 6, 0, Math.PI * 2);
  ctx.fillStyle = rgba(primary, 0.9);
  ctx.fill();
  ctx.fillStyle = FAINT;
  ctx.fillText(link, W / 2 + 4, linkY);

  // The games, one glass panel each, sized to the room between the pill and the sponsors
  const places = posterPlaces(list.map(g => g.match));
  const venueH = places.shared ? by(76, 62) : 0;
  const listTop = pillY + by(70, 56);
  const listBottom = sponsorsTop - by(36, 26) - venueH;
  const n = Math.max(1, list.length);
  const rowGap = by(20, 14);
  const fullH = by(220, 170);
  const rowH = Math.min(fullH, (listBottom - listTop - rowGap * (n - 1)) / n);
  const k = Math.max(0.8, rowH / fullH);
  let y = listTop + Math.max(0, (listBottom - listTop - (rowH * n + rowGap * (n - 1))) / 2);
  list.forEach(({ match: m, hideScore }, i) => {
    roundRect(ctx, M, y, W - M * 2, rowH, 28 * k);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 2;
    ctx.stroke();
    const midY = y + rowH * 0.38;
    const crestS = Math.min(110, rowH * 0.46);
    drawContain(ctx, crests[i][0], M + 28 + crestS / 2, midY, crestS);
    drawContain(ctx, crests[i][1], W - M - 28 - crestS / 2, midY, crestS);
    const vsR = Math.min(44, rowH * 0.2);
    const nameMax = (W - M * 2) / 2 - crestS - 28 - vsR - 40;
    // The club's own side always on the left, home or away (as the club's posters read), the score in the same order
    const home = m.is_club_home ?? true;
    const sides: [string, number, CanvasTextAlign, boolean][] = [
      [(home ? m.home_team_name : m.away_team_name) || '', M + 28 + crestS + 20, 'left', true],
      [(home ? m.away_team_name : m.home_team_name) || '', W - M - 28 - crestS - 20, 'right', false],
    ];
    for (const [name, x, align, us] of sides) {
      ctx.textAlign = align;
      ctx.fillStyle = us ? INK : 'rgba(248, 250, 252, 0.86)';
      const size = fit(ctx, name, us ? 800 : 700, Math.round(38 * k), nameMax * 1.6, heading, 22);
      const words = name.split(/\s+/);
      if (ctx.measureText(name).width > nameMax && words.length > 1) {
        // A long name over two lines rather than shrunk to nothing
        let line = words[0];
        let j = 1;
        while (j < words.length && ctx.measureText(`${line} ${words[j]}`).width <= nameMax) line += ` ${words[j++]}`;
        ctx.fillText(ellipsize(ctx, line, nameMax), x, midY - size * 0.55);
        ctx.fillText(ellipsize(ctx, words.slice(j).join(' '), nameMax), x, midY + size * 0.55);
      } else ctx.fillText(ellipsize(ctx, name, nameMax), x, midY);
    }
    ctx.textAlign = 'center';
    const done = m.status === 'completed';
    if (done && !hideScore) {
      const sw = 150 * k;
      const sh = 72 * k;
      roundRect(ctx, W / 2 - sw / 2, midY - sh / 2, sw, sh, sh / 2);
      ctx.fillStyle = INK;
      ctx.fill();
      ctx.fillStyle = BASE;
      ctx.font = `900 ${Math.round(44 * k)}px ${heading}`;
      const [ourGoals, theirGoals] = home ? [m.home_score, m.away_score] : [m.away_score, m.home_score];
      ctx.fillText(`${ourGoals ?? 0} – ${theirGoals ?? 0}`, W / 2, midY + 2);
    } else {
      ctx.beginPath();
      ctx.arc(W / 2, midY, vsR, 0, Math.PI * 2);
      ctx.fillStyle = rgba(primary, 0.35);
      ctx.fill();
      ctx.strokeStyle = ink;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = INK;
      ctx.font = `900 ${Math.round(vsR * 0.8)}px ${heading}`;
      ctx.fillText(done ? 'FT' : 'VS', W / 2, midY + 1);
    }
    const { day, time } = kickoff(m);
    const state = done ? 'FULL TIME' : m.status === 'postponed' ? 'POSTPONED' : m.status === 'cancelled' ? 'CANCELLED' : time;
    const meta = [day, state, places.rows[i]].filter(Boolean).join('  ·  ').toUpperCase();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(M + 28, y + rowH * 0.7);
    ctx.lineTo(W - M - 28, y + rowH * 0.7);
    ctx.stroke();
    ctx.fillStyle = MUTED;
    spaced(ctx, 2);
    fit(ctx, meta, 700, Math.round(25 * k), W - M * 2 - 60, body, 18);
    ctx.fillText(ellipsize(ctx, meta, W - M * 2 - 60), W / 2, y + rowH * 0.85);
    spaced(ctx, 0);
    y += rowH + rowGap;
  });

  // The ground they all share, once, with a pin
  if (places.shared) {
    const vy = listBottom + by(36, 26) / 2 + venueH / 2 - 4;
    ctx.font = `700 ${by(32, 28)}px ${body}`;
    const text = ellipsize(ctx, places.shared, W - M * 2 - 60);
    const px = W / 2 - ctx.measureText(text).width / 2 - 26;
    ctx.fillStyle = ink;
    ctx.beginPath();
    ctx.arc(px, vy - 6, 13, Math.PI, 0);
    ctx.lineTo(px, vy + 18);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = BASE;
    ctx.beginPath();
    ctx.arc(px, vy - 6, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = INK;
    ctx.textAlign = 'left';
    ctx.fillText(text, px + 26, vy);
  }

  return new Promise((resolve, reject) =>
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Could not create the image.'))), 'image/png'));
}
