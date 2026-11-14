'use client';

import React, { useEffect, useRef, useSyncExternalStore } from 'react';
import { DATE_LOCALE, SITE_TIME_ZONE } from '@/lib/dates';
import { lampRows } from '@/lib/lamp-digits';

/** A string ("3", "12", "8:00") drawn in lamps */
export function Lamps({ text, hot }: { text: string; hot?: boolean }) {
  return (
    <>
      {[...text].map((ch, i) => {
        const rows = lampRows(ch);
        if (!rows.length) return null;
        return (
          <span key={i} className={`stb-glyph${hot ? ' is-hot' : ''}`} style={{ gridTemplateColumns: `repeat(${rows[0].length}, var(--lamp))` }} aria-hidden="true">
            {rows.join('').split('').map((b, k) => <i key={k} className={b === '1' ? 'on' : undefined} style={hot ? { transitionDelay: `${(k * 37) % 420}ms` } : undefined} />)}
          </span>
        );
      })}
    </>
  );
}

const subscribeNothing = () => () => {};

/** "8:00" and "am" for a kick-off, in the visitor's zone once hydrated (the site's zone before, like LocalTime) */
export function useKickoffParts(value: string | undefined): { clock: string; suffix: string } | null {
  const hydrated = useSyncExternalStore(subscribeNothing, () => true, () => false);
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const text = date.toLocaleTimeString(DATE_LOCALE, { hour: 'numeric', minute: '2-digit', ...(hydrated ? {} : { timeZone: SITE_TIME_ZONE }) });
  const m = text.match(/^(\d{1,2}:\d{2})\s*(.*)$/);
  return m ? { clock: m[1], suffix: m[2] } : null;
}

export const GOAL_SEQUENCE_MS = 4200;

/**
 * The goal sequence: the board's middle becomes one lamp screen. Three floodlight strobes, "GOAL!"
 * scrolls in and flickers, the scoring team's name runs through like a ticker, then the board returns.
 * Drawn on a canvas laid over `host`; nothing runs under prefers-reduced-motion.
 */
export function useGoalSequence(host: React.RefObject<HTMLElement | null>, goal: { key: number; teamName: string } | null) {
  const running = useRef(0);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  // Stopped only by the next goal or by leaving the page, not when the page clears the alert
  useEffect(() => () => { running.current++; canvas.current?.remove(); }, []);
  useEffect(() => {
    const el = host.current;
    if (!goal || !el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const run = ++running.current;
    const alive = () => running.current === run;
    canvas.current?.remove();
    const cv = document.createElement('canvas');
    canvas.current = cv;
    cv.className = 'stb-fx';
    cv.setAttribute('aria-hidden', 'true');
    const W = el.clientWidth, H = el.clientHeight, dpr = window.devicePixelRatio || 1;
    if (!W || !H) return;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    el.appendChild(cv);

    const pitch = W < 600 ? 8 : 13;
    const cols = Math.floor(W / pitch), rows = Math.floor(H / pitch);
    const ox = (W - cols * pitch) / 2, oy = (H - rows * pitch) / 2;
    const sprite = (fill: string, glow?: string) => {
      const c = document.createElement('canvas');
      c.width = c.height = pitch * 3;
      const x = c.getContext('2d')!, m = pitch * 1.5;
      if (glow) { const g = x.createRadialGradient(m, m, 0, m, m, m); g.addColorStop(0, glow); g.addColorStop(1, 'rgba(255,184,28,0)'); x.fillStyle = g; x.fillRect(0, 0, c.width, c.height); }
      x.fillStyle = fill; x.beginPath(); x.arc(m, m, pitch * 0.42, 0, Math.PI * 2); x.fill();
      return c;
    };
    const OFF = sprite('rgba(255,184,28,0.09)'), ON = sprite('#FFB81C', 'rgba(255,184,28,0.55)'), HOT = sprite('#FFF6D6', 'rgba(255,214,120,0.8)');
    const draw = (lit: (c: number, r: number) => 0 | 1 | 2) => {
      ctx.clearRect(0, 0, W, H);
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const v = lit(c, r);
        ctx.drawImage(v === 2 ? HOT : v ? ON : OFF, ox + c * pitch - pitch, oy + r * pitch - pitch);
      }
    };
    // A word as a bitmap with one pixel per lamp
    const bitmap = (word: string, size: number) => {
      const t = document.createElement('canvas'), x = t.getContext('2d')!;
      const font = `900 ${size}px ${getComputedStyle(el).getPropertyValue('--font-heading') || 'sans-serif'}`;
      x.font = font;
      t.width = Math.ceil(x.measureText(word).width) + 2; t.height = rows;
      x.font = font; x.fillStyle = '#fff'; x.textBaseline = 'middle';
      x.fillText(word, 1, rows / 2 + size * 0.06);
      const d = x.getImageData(0, 0, t.width, t.height).data;
      return { w: t.width, on: (c: number, r: number) => c >= 0 && c < t.width && d[(r * t.width + c) * 4 + 3] > 110 };
    };
    const wait = (ms: number) => new Promise(res => setTimeout(res, ms));
    const scroll = (bm: ReturnType<typeof bitmap>, speed: number, hold: number) => new Promise<void>(res => {
      const start = performance.now(), mid = Math.round((cols - bm.w) / 2), fits = bm.w <= cols;
      const inMs = fits ? ((cols - mid) / speed) * 1000 : 0;
      const outFrom = fits ? mid : cols, outMs = ((outFrom + bm.w) / speed) * 1000;
      const step = (now: number) => {
        if (!alive()) return res();
        const t = now - start;
        let x: number, flick = false;
        if (t < inMs) x = cols - (t / 1000) * speed;
        else if (t < inMs + hold) { x = mid; flick = Math.floor((t - inMs) / 140) % 2 === 0; }
        else x = outFrom - ((t - inMs - hold) / 1000) * speed;
        draw((c, r) => (bm.on(Math.round(c - x), r) ? (flick ? 2 : 1) : 0));
        if (t < inMs + hold + outMs) requestAnimationFrame(step); else res();
      };
      requestAnimationFrame(step);
    });

    (async () => {
      cv.classList.add('is-on');
      for (let k = 0; k < 3 && alive(); k++) { draw(() => 2); await wait(90); draw(() => 0); await wait(80); }
      if (alive()) await scroll(bitmap('GOAL!', Math.min(rows - 2, Math.round(rows * 0.82))), cols * 2.6, 900);
      if (alive()) await scroll(bitmap(goal.teamName.toUpperCase(), Math.round(rows * 0.62)), cols * 1.9, 0);
      cv.classList.add('is-out');
      await wait(260);
      cv.remove();
    })();
  }, [goal?.key]); // eslint-disable-line react-hooks/exhaustive-deps
}
