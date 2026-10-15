// The equal playing time calculator (/tools/equal-playing-time-calculator): works out a substitution
// schedule that gives every player in the squad the same minutes.
//
// It uses the "wrap-around" rule: lay the field positions end to end as one long strip of minutes
// (positions × match length), cut the strip into one equal piece per player, then wrap the strip back
// onto the positions. Every piece is no longer than the match, so nobody is ever in two places at once,
// and the cut points are the substitution times. Each player gets one spell on the bench, so the plan
// uses as few changes as possible. All times are in whole seconds; `unit` rounds them (60 = whole minutes).

export type KeeperMode =
  /** The first player keeps goal all game; everyone else rotates */
  | 'fixed'
  /** A different keeper each period, swapped at the break; they rotate outfield in the other periods */
  | 'per-period'
  /** No set keeper: the keeper's shirt rotates like any other position */
  | 'rolling';

export interface PlanInput {
  /** Players on the pitch at once, keeper included (5 for 5-a-side) */
  onField: number;
  /** 1 (one period), 2 (halves), 3 (thirds) or 4 (quarters) */
  periods: number;
  /** Length of each period in minutes */
  periodMinutes: number;
  /** Number of players in the squad */
  squad: number;
  keeper: KeeperMode;
  /** For 'per-period': the player (index) in goal each period. Defaults to players 0, 1, 2… */
  keepers?: number[];
  /** Rounding of substitution times in seconds: 60 for whole minutes (default), 1 for to the second */
  unit?: number;
}

export interface Stint { player: number; start: number; end: number; keeper: boolean }

export interface Change {
  /** Seconds from kick-off, on the running match clock */
  time: number;
  /** The period this change happens in (0-based); a change at a break belongs to the period that starts */
  period: number;
  atBreak: boolean;
  /** Each player going off paired with the player replacing them */
  swaps: { off: number; on: number }[];
}

export interface Plan {
  ok: boolean;
  error?: string;
  /** Match length in seconds */
  total: number;
  periodLength: number;
  /** Exact fair share of the match in seconds (outfield share when the keeper is fixed) */
  target: number;
  /** Seconds each player is on the pitch */
  seconds: number[];
  stints: Stint[];
  changes: Change[];
  /** Players on the pitch at kick-off */
  starters: number[];
  /** The keeper in each period, or null when the keeper rotates with everyone */
  keeperByPeriod: (number | null)[];
  /** Number of individual substitutions (one player off, one on) not counting breaks */
  subs: number;
}

/** A piece of the wrapped strip: one player on one position (lane) from `start` to `end` (time units within the lane) */
interface Piece { slot: number; lane: number; start: number; end: number }

/**
 * Cut a strip of `lanes` lanes, each `laneLen` units long, into consecutive pieces of the given lengths,
 * starting `shift` units in (and wrapping round), then fold it back onto the lanes.
 */
function wrap(lengths: number[], lanes: number, laneLen: number, shift: number): Piece[] {
  const total = lanes * laneLen;
  const pieces: Piece[] = [];
  let pos = shift;
  lengths.forEach((len, slot) => {
    let left = len;
    let at = pos % total;
    while (left > 0) {
      const lane = Math.floor(at / laneLen);
      const inLane = at - lane * laneLen;
      const take = Math.min(left, laneLen - inLane);
      pieces.push({ slot, lane, start: inLane, end: inLane + take });
      left -= take;
      at = (at + take) % total;
    }
    pos += len;
  });
  return pieces;
}

/**
 * Score a wrapped layout (lower is better): no very short spells on the pitch, as few separate stoppages
 * as possible, and changes that fall at a break (half time) are free.
 */
function score(pieces: Piece[], laneLen: number, breaks: number[], minPiece: number): number {
  let s = 0;
  const times = new Set<number>();
  for (const p of pieces) {
    if (p.end - p.start < minPiece) s += 1000;
    for (const t of [p.start, p.end]) if (t > 0 && t < laneLen) times.add(t);
  }
  for (const t of times) s += breaks.includes(t) ? -15 : 10;
  return s;
}

/** The lowest-scoring shift of the strip, trying every unit (or a coarser step when there are a lot) */
function bestWrap(lengths: number[], lanes: number, laneLen: number, breaks: number[], minPiece: number, step: number): Piece[] {
  let best: Piece[] = wrap(lengths, lanes, laneLen, 0);
  let bestScore = score(best, laneLen, breaks, minPiece);
  for (let shift = step; shift < laneLen; shift += step) {
    const pieces = wrap(lengths, lanes, laneLen, shift);
    const sc = score(pieces, laneLen, breaks, minPiece);
    if (sc < bestScore) { best = pieces; bestScore = sc; }
  }
  return best;
}

/** Split `total` units into `n` whole-unit lengths that differ by at most one (largest remainder) */
function evenSplit(total: number, n: number): number[] {
  const cuts = Array.from({ length: n + 1 }, (_, k) => Math.round((k * total) / n));
  return cuts.slice(1).map((c, k) => c - cuts[k]);
}

/**
 * Keeper per period, on one strip over the whole match: each keeper's outfield minutes (if any) are a
 * single piece placed in a period when they are not in goal. Tries every place for the keepers' pieces in
 * the order and every shift (in whole minutes) and keeps the best valid layout, or returns null if none fits.
 */
function keeperStrip(squad: number, lanes: number, periods: number, periodLength: number, unit: number, keepers: number[], target: number, breaks: number[]): Stint[] | null {
  if (lanes === 0) return [];
  const total = periods * periodLength;
  const laneUnits = Math.round(total / unit);
  const periodUnits = Math.round(periodLength / unit);
  const keeperSet = [...new Set(keepers)];
  const kept = (i: number) => keepers.filter(k => k === i).length;
  const keeperNeed = keeperSet.map(k => Math.max(0, Math.round((target - kept(k) * periodLength) / unit)));
  const others = Array.from({ length: squad }, (_, i) => i).filter(i => !keeperSet.includes(i));
  const outfieldKeepers = keeperSet.filter((_, j) => keeperNeed[j] > 0);
  const capacity = lanes * laneUnits;
  const keeperUnits = keeperNeed.reduce((a, b) => a + b, 0);
  if (others.length === 0 || keeperUnits >= capacity) return null;
  // Everyone who never keeps shares what is left equally (never more than the whole match)
  const otherLengths = evenSplit(capacity - keeperUnits, others.length);
  if (Math.max(...otherLengths) > laneUnits) return null;

  const step = Math.max(1, Math.round(60 / unit));
  const minPiece = Math.min(Math.round(180 / unit), Math.floor(Math.min(...otherLengths) / 3));
  const breakUnits = breaks.map(b => Math.round(b / unit));
  let best: { pieces: Piece[]; owner: number[] } | null = null;
  let bestScore = Infinity;

  // Every way to insert the outfield keepers' pieces among the others' pieces
  // (with a big squad and several keepers, only every few places, to keep it quick on a phone)
  let places = Array.from({ length: others.length + 1 }, (_, i) => i);
  while (places.length > 2 && places.length ** outfieldKeepers.length > 1200) places = places.filter((_, i) => i % 2 === 0);
  const inserts = (k: number): number[][] => k === 0 ? [[]] : inserts(k - 1).flatMap(r => places.map(i => [...r, i]));
  for (const at of inserts(outfieldKeepers.length)) {
    // owner[slot]: a keeper's player index, or -1 - j for the j-th other player's slot
    const owner: number[] = [];
    const lengths: number[] = [];
    for (let i = 0; i <= others.length; i++) {
      outfieldKeepers.forEach((k, j) => { if (at[j] === i) { owner.push(k); lengths.push(keeperNeed[keeperSet.indexOf(k)]); } });
      if (i < others.length) { owner.push(-1 - i); lengths.push(otherLengths[i]); }
    }
    for (let shift = 0; shift < laneUnits; shift += step) {
      const pieces = wrap(lengths, lanes, laneUnits, shift);
      // A keeper's outfield piece must stay out of the periods they are in goal
      const clash = pieces.some(p => owner[p.slot] >= 0 && keepers.some((k, q) => k === owner[p.slot] && p.start < (q + 1) * periodUnits && p.end > q * periodUnits));
      if (clash) continue;
      const sc = score(pieces, laneUnits, breakUnits, minPiece);
      if (sc < bestScore) { bestScore = sc; best = { pieces, owner }; }
    }
  }
  if (!best) return null;

  // The others take their slots in list order: starters first, then in the order they come on
  const { pieces, owner } = best;
  const otherSlots = owner.map((o, slot) => ({ o, slot })).filter(x => x.o < 0).map(x => x.slot);
  const firstOn = (slot: number) => Math.min(...pieces.filter(p => p.slot === slot).map(p => p.start));
  otherSlots.sort((a, b) => firstOn(a) - firstOn(b) || a - b);
  const playerOf = new Map<number, number>();
  owner.forEach((o, slot) => { if (o >= 0) playerOf.set(slot, o); });
  otherSlots.forEach((slot, k) => playerOf.set(slot, others[k]));

  const stints: Stint[] = keepers.map((k, q) => ({ player: k, start: q * periodLength, end: (q + 1) * periodLength, keeper: true }));
  for (const p of pieces) stints.push({ player: playerOf.get(p.slot)!, start: p.start * unit, end: p.end * unit, keeper: false });
  return stints;
}

const blank = (total: number, periodLength: number, squad: number, error: string): Plan => ({
  ok: false, error, total, periodLength, target: 0, seconds: Array(Math.max(0, squad)).fill(0), stints: [], changes: [], starters: [], keeperByPeriod: [], subs: 0,
});

export function planRotation(input: PlanInput): Plan {
  const unit = input.unit && input.unit > 0 ? input.unit : 60;
  const onField = Math.floor(input.onField);
  const periods = Math.max(1, Math.floor(input.periods));
  const periodLength = Math.round(input.periodMinutes * 60);
  const total = periods * periodLength;
  const squad = Math.floor(input.squad);

  if (!(onField >= 2 && onField <= 11)) return blank(total, periodLength, squad, 'Choose between 2 and 11 players on the pitch.');
  if (!(periodLength >= 60)) return blank(total, periodLength, squad, 'Each period needs to be at least a minute long.');
  if (squad < onField) return blank(total, periodLength, squad, `You need at least ${onField} players for ${onField}-a-side.`);
  if (squad > 40) return blank(total, periodLength, squad, 'The calculator handles squads of up to 40.');

  const breaks = Array.from({ length: periods - 1 }, (_, i) => (i + 1) * periodLength);
  const keeperMode: KeeperMode = input.keeper === 'per-period' && periods < 2 ? 'fixed' : input.keeper;

  const stints: Stint[] = [];
  let keeperByPeriod: (number | null)[] = Array(periods).fill(null);
  let target: number;

  if (keeperMode === 'per-period') {
    // Each period's keeper is in goal for the whole period; the outfield positions are shared out per
    // period so that, over the game, every player (keepers included) ends up with the same minutes
    const keepers = Array.from({ length: periods }, (_, q) => {
      const k = input.keepers?.[q];
      return k != null && k >= 0 && k < squad ? k : q % squad;
    });
    keeperByPeriod = keepers;
    target = (onField * total) / squad;
    const lanes = onField - 1;
    const fromStrip = keeperStrip(squad, lanes, periods, periodLength, unit, keepers, target, breaks);
    if (fromStrip) stints.push(...fromStrip);
    else {
    const periodUnits = Math.round(periodLength / unit);
    const capacity = lanes * periodUnits;
    const keptPeriods = (i: number) => keepers.filter(k => k === i).length;
    const freePeriods = (i: number) => periods - keptPeriods(i);
    // What each player still needs on the outfield, spread evenly over the periods they are not in goal
    const need = Array.from({ length: squad }, (_, i) => Math.max(0, target - keptPeriods(i) * periodLength) / unit);
    const carry = Array(squad).fill(0);
    let prevEnd = new Set<number>();

    for (let q = 0; q < periods; q++) {
      const start = q * periodLength;
      stints.push({ player: keepers[q], start, end: start + periodLength, keeper: true });
      if (lanes === 0) continue;
      const avail = Array.from({ length: squad }, (_, i) => i).filter(i => i !== keepers[q]);
      let shares = avail.map(i => (freePeriods(i) ? need[i] / freePeriods(i) : 0));
      // Scale to exactly fill the outfield, never more than the whole period for anyone
      for (let round = 0; round < 5; round++) {
        const sum = shares.reduce((a, b) => a + b, 0);
        if (!sum) { shares = avail.map(() => capacity / avail.length); break; }
        shares = shares.map(s => Math.min(periodUnits, (s * capacity) / sum));
      }
      // Whole units, carrying each player's rounding into the next period so totals stay fair
      const desired = shares.map((s, j) => s + carry[avail[j]]);
      const given = desired.map(d => Math.max(0, Math.min(periodUnits, Math.floor(d))));
      let left = capacity - given.reduce((a, b) => a + b, 0);
      const order = desired.map((d, j) => j).sort((a, b) => (desired[b] - given[b]) - (desired[a] - given[a]));
      for (let pass = 0; left > 0 && pass < 3; pass++) {
        for (const j of order) if (left > 0 && given[j] < periodUnits) { given[j]++; left--; }
      }
      avail.forEach((i, j) => { carry[i] = desired[j] - given[j]; });

      // Players who finished the last period on the bench go first
      const slots = avail.map((i, j) => ({ i, len: given[j] })).filter(s => s.len > 0)
        .sort((a, b) => Number(prevEnd.has(a.i)) - Number(prevEnd.has(b.i)));
      const pieces = bestWrap(slots.map(s => s.len), lanes, periodUnits, [], Math.min(Math.round(180 / unit), Math.floor(capacity / Math.max(1, slots.length) / 3)), 1);
      const endOn = new Set<number>();
      for (const p of pieces) {
        const player = slots[p.slot].i;
        stints.push({ player, start: start + p.start * unit, end: start + p.end * unit, keeper: false });
        if (p.end === periodUnits) endOn.add(player);
      }
      prevEnd = endOn;
    }
    }
  } else {
    // One strip over the whole match: everyone gets one equal piece
    const fixed = keeperMode === 'fixed';
    const rotating = Array.from({ length: squad }, (_, i) => i).filter(i => !(fixed && i === 0));
    const lanes = onField - (fixed ? 1 : 0);
    if (fixed) { keeperByPeriod = Array(periods).fill(0); stints.push({ player: 0, start: 0, end: total, keeper: true }); }
    target = rotating.length ? (lanes * total) / rotating.length : total;
    const laneUnits = Math.round(total / unit);
    if (rotating.length <= lanes) {
      rotating.forEach(i => stints.push({ player: i, start: 0, end: total, keeper: false }));
    } else {
      const lengths = evenSplit(lanes * laneUnits, rotating.length);
      const minPiece = Math.min(Math.round(180 / unit), Math.floor(Math.min(...lengths) / 3));
      const step = laneUnits > 1200 ? Math.round(15 / unit) || 1 : 1;
      const pieces = bestWrap(lengths, lanes, laneUnits, breaks.map(b => Math.round(b / unit)), minPiece, step);
      // Hand the slots to the players in list order: starters first, then in the order they come on
      const firstOn = lengths.map((_, slot) => Math.min(...pieces.filter(p => p.slot === slot).map(p => p.start)));
      const slotOrder = lengths.map((_, slot) => slot).sort((a, b) => firstOn[a] - firstOn[b] || a - b);
      const playerOf = new Map(slotOrder.map((slot, k) => [slot, rotating[k]]));
      for (const p of pieces) stints.push({ player: playerOf.get(p.slot)!, start: p.start * unit, end: p.end * unit, keeper: false });
    }
  }

  stints.sort((a, b) => a.start - b.start || a.player - b.player);
  const seconds = Array(squad).fill(0);
  for (const s of stints) seconds[s.player] += s.end - s.start;

  // Changes: every moment the set of players on the pitch changes
  const onAt = (t: number) => new Set(stints.filter(s => s.start <= t && s.end > t).map(s => s.player));
  const times = [...new Set(stints.flatMap(s => [s.start, s.end]))].filter(t => t > 0 && t < total).sort((a, b) => a - b);
  const changes: Change[] = [];
  let subs = 0;
  for (const t of times) {
    const before = new Set(stints.filter(s => s.start < t && s.end >= t).map(s => s.player));
    const after = onAt(t);
    const off = [...before].filter(p => !after.has(p));
    const on = [...after].filter(p => !before.has(p));
    if (!off.length && !on.length) continue;
    const atBreak = breaks.includes(t);
    // Pair each player going off with the one taking their place: a keeper with a keeper, then by order
    const offKeeper = off.filter(p => stints.some(s => s.player === p && s.keeper && s.end === t));
    const onKeeper = on.filter(p => stints.some(s => s.player === p && s.keeper && s.start === t));
    const offRest = off.filter(p => !offKeeper.includes(p));
    const onRest = on.filter(p => !onKeeper.includes(p));
    const swaps: { off: number; on: number }[] = [];
    const n = Math.min(offKeeper.length, onKeeper.length);
    for (let k = 0; k < n; k++) swaps.push({ off: offKeeper[k], on: onKeeper[k] });
    const offLeft = [...offKeeper.slice(n), ...offRest];
    const onLeft = [...onKeeper.slice(n), ...onRest];
    offLeft.forEach((p, k) => { if (onLeft[k] != null) swaps.push({ off: p, on: onLeft[k] }); });
    if (!atBreak) subs += swaps.length;
    changes.push({ time: t, period: Math.min(periods - 1, Math.floor(t / periodLength)), atBreak, swaps });
  }

  return {
    ok: true,
    total,
    periodLength,
    target,
    seconds,
    stints,
    changes,
    starters: [...onAt(0)].sort((a, b) => a - b),
    keeperByPeriod,
    subs,
  };
}

/** "14'" for whole minutes, "14:30" otherwise, on the running match clock */
export function clock(seconds: number): string {
  if (seconds % 60 === 0) return `${seconds / 60}'`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Minutes for display: "41" or "41.5" or "41:32" (to the second) */
export function minutes(seconds: number, exact = false): string {
  if (seconds % 60 === 0) return String(seconds / 60);
  if (exact) return `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, '0')}`;
  return (Math.round((seconds / 60) * 10) / 10).toString();
}

export const PERIOD_NAMES: Record<number, string[]> = {
  1: ['Match'],
  2: ['1st half', '2nd half'],
  3: ['1st third', '2nd third', '3rd third'],
  4: ['1st quarter', '2nd quarter', '3rd quarter', '4th quarter'],
};

/** Equal minutes per player for a format, squad and match length, rounded to a tenth (for the reference tables) */
export function fairMinutes(onField: number, squad: number, matchMinutes: number): number {
  return Math.round(((onField * matchMinutes) / squad) * 10) / 10;
}
