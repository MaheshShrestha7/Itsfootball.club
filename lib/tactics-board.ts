// The coach's tactics board: one board per situation (open play, our corner, ...), each with its own
// drawings and its own player positions. Everything is a percentage of the upright pitch,
// [left, top], so a board drawn on a phone looks the same on a desk and in the downloaded image.

export type Pt = [number, number];
export type LineKind = 'run' | 'pass' | 'dribble' | 'pen';
export type PieceKind = 'ball' | 'cone' | 'opp';

export type BoardItem =
  | { t: LineKind; c: string; p: Pt[] }
  | { t: 'zone'; c: string; x: number; y: number; w: number; h: number }
  | { t: PieceKind; x: number; y: number; n?: number };

export interface TacticsBoard {
  id: string;
  name: string;
  /** Players may see this board in the club app once the line-up is published */
  show: boolean;
  note: string;
  /** Where a player stands on this board, by line-up slot id; the rest stand where the line-up has them */
  players: Record<string, Pt>;
  items: BoardItem[];
}

export const BOARD_COLORS = ['#FFFFFF', '#FACC15', '#38BDF8', '#FB7185'];
export const MAX_BOARDS = 10;
export const MAX_ITEMS = 60;
export const MAX_NOTE = 280;
const MAX_POINTS = 60;
const LINES = ['run', 'pass', 'dribble', 'pen'];
const PIECES = ['ball', 'cone', 'opp'];

const STARTERS: [string, string][] = [
  ['open', 'Open play'], ['corner', 'Our corner'], ['their-corner', 'Their corner'], ['free-kick', 'Free kick'], ['goal-kick', 'Goal kick'],
];
export const isStarterBoard = (id: string) => STARTERS.some(s => s[0] === id);
export const defaultBoards = (): TacticsBoard[] =>
  STARTERS.map(([id, name]) => ({ id, name, show: false, note: '', players: {}, items: [] }));

const num = (v: unknown, lo: number, hi: number): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v * 100) / 100)) : null;
// Drawings may run a little past the touchline (a corner taker, a ball on the corner arc)
const pt = (v: unknown): Pt | null => {
  if (!Array.isArray(v)) return null;
  const x = num(v[0], -5, 105), y = num(v[1], -5, 105);
  return x === null || y === null ? null : [x, y];
};
const color = (v: unknown) => (typeof v === 'string' && BOARD_COLORS.includes(v) ? v : BOARD_COLORS[0]);

function cleanItem(raw: unknown): BoardItem | null {
  const i = raw as Record<string, unknown>;
  if (!i || typeof i !== 'object') return null;
  if (LINES.includes(i.t as string)) {
    const p = (Array.isArray(i.p) ? i.p : []).map(pt).filter((q): q is Pt => !!q).slice(0, MAX_POINTS);
    return p.length < 2 ? null : { t: i.t as LineKind, c: color(i.c), p };
  }
  const x = num(i.x, -5, 105), y = num(i.y, -5, 105);
  if (x === null || y === null) return null;
  if (i.t === 'zone') {
    const w = num(i.w, 0, 110), h = num(i.h, 0, 110);
    return w === null || h === null ? null : { t: 'zone', c: color(i.c), x, y, w, h };
  }
  if (!PIECES.includes(i.t as string)) return null;
  const n = num(i.n, 1, 99);
  return i.t === 'opp' ? { t: 'opp', x, y, n: n === null ? 1 : Math.round(n) } : { t: i.t as PieceKind, x, y };
}

/**
 * Boards as the app will draw them, whatever came back from the database or the browser's storage:
 * the five starter boards are always there, in order, and anything malformed is dropped rather than
 * drawn. Colours come from the palette only, so nothing typed into the data reaches the page as markup.
 */
export function cleanBoards(raw: unknown): TacticsBoard[] {
  const seen = new Set<string>();
  const list = (Array.isArray(raw) ? raw : []).map((r): TacticsBoard | null => {
    const b = r as Record<string, unknown>;
    if (!b || typeof b !== 'object' || typeof b.id !== 'string' || !/^[\w-]{1,40}$/.test(b.id) || seen.has(b.id)) return null;
    seen.add(b.id);
    const players: Record<string, Pt> = {};
    if (b.players && typeof b.players === 'object') {
      for (const [id, v] of Object.entries(b.players as object).slice(0, 30)) {
        const p = pt(v);
        if (p && id.length <= 40) players[id] = [Math.min(98, Math.max(2, p[0])), Math.min(98, Math.max(2, p[1]))];
      }
    }
    return {
      id: b.id,
      name: (typeof b.name === 'string' ? b.name.trim().slice(0, 30) : '') || 'Board',
      show: b.show === true,
      note: typeof b.note === 'string' ? b.note.slice(0, MAX_NOTE) : '',
      players,
      items: (Array.isArray(b.items) ? b.items : []).map(cleanItem).filter((i): i is BoardItem => !!i).slice(0, MAX_ITEMS),
    };
  }).filter((b): b is TacticsBoard => !!b);
  const starters = defaultBoards().map(d => {
    const saved = list.find(b => b.id === d.id);
    return saved ? { ...saved, name: d.name } : d;
  });
  return [...starters, ...list.filter(b => !isStarterBoard(b.id))].slice(0, MAX_BOARDS);
}

/** True when nothing has been drawn, moved or written on any board (nothing worth saving yet) */
export const boardsAreBlank = (boards: TacticsBoard[]) =>
  boards.every(b => isStarterBoard(b.id) && !b.items.length && !b.note && !b.show && !Object.keys(b.players).length);

// ---- Geometry ----

/** Ramer-Douglas-Peucker: a shaky finger trail becomes the few points that carry its shape */
export function simplify(pts: Pt[], eps: number): Pt[] {
  if (pts.length < 3) return pts;
  const a = pts[0], b = pts[pts.length - 1];
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  let max = 0, idx = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = Math.abs((b[0] - a[0]) * (a[1] - pts[i][1]) - (a[0] - pts[i][0]) * (b[1] - a[1])) / len;
    if (d > max) { max = d; idx = i; }
  }
  return max > eps ? [...simplify(pts.slice(0, idx + 1), eps).slice(0, -1), ...simplify(pts.slice(idx), eps)] : [a, b];
}

/** Points every `step` pixels along the smooth curve (Catmull-Rom) through `pts`; the last one is the tip */
export function sampleCurve(pts: Pt[], step = 2): Pt[] {
  if (pts.length < 2) return pts;
  const fine: Pt[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    for (let k = 0; k < 24; k++) {
      const t = k / 24, t2 = t * t, t3 = t2 * t;
      fine.push([0, 1].map(d => 0.5 * (2 * p1[d] + (p2[d] - p0[d]) * t + (2 * p0[d] - 5 * p1[d] + 4 * p2[d] - p3[d]) * t2 + (3 * p1[d] - p0[d] - 3 * p2[d] + p3[d]) * t3)) as Pt);
    }
  }
  fine.push(pts[pts.length - 1]);
  // Walk the fine points and drop one every `step` pixels, so dashes and waves keep an even rhythm
  const out: Pt[] = [fine[0]];
  let carry = 0;
  for (let i = 1; i < fine.length; i++) {
    const a = fine[i - 1], b = fine[i], seg = Math.hypot(b[0] - a[0], b[1] - a[1]);
    let at = step - carry;
    while (at <= seg) { out.push([a[0] + (b[0] - a[0]) * at / seg, a[1] + (b[1] - a[1]) * at / seg]); at += step; }
    carry = (carry + seg) % step;
  }
  const tip = fine[fine.length - 1], last = out[out.length - 1];
  if (last[0] !== tip[0] || last[1] !== tip[1]) out.push(tip);
  return out;
}

const HEAD = 13;
const f = (n: number) => n.toFixed(1);
const poly = (pts: Pt[]) => 'M' + pts.map(q => `${f(q[0])} ${f(q[1])}`).join('L');

/**
 * A drawn line in pixels: the stroke's path and, for an arrow, the three corners of its head.
 * A run is a plain curve, a pass is the same curve dashed by the caller, a dribble waves along the
 * curve and straightens into the head, and the pen has no head at all.
 */
export function lineShape(kind: LineKind, pts: Pt[]): { d: string; head: string } {
  const curve = sampleCurve(pts, 2);
  if (kind === 'pen' || curve.length * 2 < HEAD * 1.5) return { d: poly(curve), head: '' };
  const tip = curve[curve.length - 1];
  const back = curve[Math.max(0, curve.length - 1 - Math.round(HEAD / 2))];
  const ang = Math.atan2(tip[1] - back[1], tip[0] - back[0]);
  const wing = (a: number): Pt => [tip[0] - HEAD * Math.cos(ang + a), tip[1] - HEAD * Math.sin(ang + a)];
  const head = [tip, wing(0.42), wing(-0.42)].map(q => `${f(q[0])},${f(q[1])}`).join(' ');
  // The stroke stops inside the head, so a thick line never pokes out past the point
  const body = curve.slice(0, Math.max(2, curve.length - Math.round(HEAD * 0.8 / 2)));
  if (kind !== 'dribble') return { d: poly(body), head };
  const WAVE = 16, AMP = 4, end = (body.length - 1) * 2;
  const wavy = body.map((q, i): Pt => {
    const next = body[Math.min(body.length - 1, i + 1)], prev = body[Math.max(0, i - 1)];
    const n = Math.atan2(next[1] - prev[1], next[0] - prev[0]) + Math.PI / 2;
    const l = i * 2, fade = Math.max(0, Math.min(1, l / 8, (end - l) / 10));
    const off = Math.sin(l / WAVE * Math.PI * 2) * AMP * fade;
    return [q[0] + Math.cos(n) * off, q[1] + Math.sin(n) * off];
  });
  return { d: poly(wavy), head };
}

/** The drawing under a tap, for Erase: its index in `items`, or -1. `w` and `h` are the pitch in pixels. */
export function hitItem(items: BoardItem[], at: Pt, w: number, h: number): number {
  const P: Pt = [at[0] * w / 100, at[1] * h / 100];
  let best = -1, bestD = 18;
  // Later drawings sit on top, so they win a tie
  items.forEach((it, i) => {
    let d = 99;
    if ('p' in it) {
      for (const q of sampleCurve(it.p.map((p): Pt => [p[0] * w / 100, p[1] * h / 100]), 4)) d = Math.min(d, Math.hypot(q[0] - P[0], q[1] - P[1]));
    } else if (it.t === 'zone') {
      d = at[0] >= it.x && at[0] <= it.x + it.w && at[1] >= it.y && at[1] <= it.y + it.h ? 12 : 99;
    } else {
      d = Math.hypot(it.x * w / 100 - P[0], it.y * h / 100 - P[1]) - 6;
    }
    if (d <= bestD) { bestD = d; best = i; }
  });
  return best;
}
