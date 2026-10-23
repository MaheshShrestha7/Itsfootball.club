'use client';

// The free lineup builder at /tools/lineup-builder: pick a format and shape, type the names, drag
// players around the pitch, add the subs and sponsors, and download the graphic. No login and nothing is
// saved on the server; the image (badge and sponsor logos included) is drawn in the browser by the same
// code as a club's matchday share cards.
import { useEffect, useId, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import Link from 'next/link';
import { ArrowRight, Download, GripVertical, ImagePlus, Lock, RotateCcw, Share2, X } from 'lucide-react';
import { FORMAT_PRESETS } from '@/components/TacticalPitch';
import { MARKER_POINTS, MARKER_TEXT_DROP, MARKER_TEXT_SCALE, drawMatchCard, type CardFormat, type CardLook, type MarkerShape } from '@/lib/share-card';
import type { Club, Match, PitchPosition } from '@/lib/supabase/types';
import { juniorPublicName } from '@/lib/teams';

export type LineupFormat = '5v5' | '7v7' | '9v9' | '11v11';
type Format = LineupFormat;
type Shape = { position: string; x: number; y: number }[];

// x runs from your own goal (0) to theirs (100), y across the pitch, as in TacticalPitch
const FIVE_A_SIDE: Record<string, { name: string; coords: Shape }> = {
  '1-2-1': {
    name: '1-2-1 Diamond',
    coords: [
      { position: 'GK', x: 8, y: 50 },
      { position: 'CB', x: 28, y: 50 },
      { position: 'LM', x: 54, y: 22 },
      { position: 'RM', x: 54, y: 78 },
      { position: 'ST', x: 84, y: 50 },
    ],
  },
  '2-1-1': {
    name: '2-1-1 Pyramid',
    coords: [
      { position: 'GK', x: 8, y: 50 },
      { position: 'CB', x: 28, y: 32 },
      { position: 'CB', x: 28, y: 68 },
      { position: 'CM', x: 55, y: 50 },
      { position: 'ST', x: 84, y: 50 },
    ],
  },
  '2-2': {
    name: '2-2 Box',
    coords: [
      { position: 'GK', x: 8, y: 50 },
      { position: 'CB', x: 30, y: 32 },
      { position: 'CB', x: 30, y: 68 },
      { position: 'ST', x: 72, y: 32 },
      { position: 'ST', x: 72, y: 68 },
    ],
  },
};

// Shorthand for the extra shapes below: [position, x, y]
type Row = [string, number, number];
const shape = (name: string, rows: Row[]) => ({ name, coords: rows.map(([position, x, y]) => ({ position, x, y })) });
const BACK_FOUR: Row[] = [['GK', 8, 50], ['LB', 26, 15], ['CB', 22, 38], ['CB', 22, 62], ['RB', 26, 85]];
const BACK_FIVE: Row[] = [['GK', 8, 50], ['LWB', 30, 10], ['CB', 22, 30], ['CB', 20, 50], ['CB', 22, 70], ['RWB', 30, 90]];
const BACK_THREE: Row[] = [['GK', 8, 50], ['CB', 24, 25], ['CB', 22, 50], ['CB', 24, 75]];

// More shapes than the club lineup screen offers, added after its own
const EXTRA: Record<Format, Record<string, { name: string; coords: Shape }>> = {
  '5v5': {
    '1-1-2': shape('1-1-2 Twin Strikers', [['GK', 8, 50], ['CB', 28, 50], ['CM', 50, 50], ['ST', 78, 32], ['ST', 78, 68]]),
  },
  '7v7': {
    '3-1-2': shape('3-1-2 Twin Strikers', [['GK', 8, 50], ['LB', 28, 20], ['CB', 24, 50], ['RB', 28, 80], ['CM', 50, 50], ['ST', 80, 32], ['ST', 80, 68]]),
    '1-3-2': shape('1-3-2 Attack', [['GK', 8, 50], ['CB', 24, 50], ['LM', 50, 18], ['CM', 48, 50], ['RM', 50, 82], ['ST', 80, 35], ['ST', 80, 65]]),
    '2-1-2-1': shape('2-1-2-1 Diamond', [['GK', 8, 50], ['CB', 26, 35], ['CB', 26, 65], ['CDM', 44, 50], ['LM', 60, 22], ['RM', 60, 78], ['ST', 86, 50]]),
  },
  '9v9': {
    '3-4-1': shape('3-4-1 Wide Midfield', [...BACK_THREE, ['LM', 52, 15], ['CM', 48, 38], ['CM', 48, 62], ['RM', 52, 85], ['ST', 85, 50]]),
    '2-4-2': shape('2-4-2 Twin Strikers', [['GK', 8, 50], ['CB', 26, 35], ['CB', 26, 65], ['LM', 52, 12], ['CM', 48, 38], ['CM', 48, 62], ['RM', 52, 88], ['ST', 82, 35], ['ST', 82, 65]]),
    '4-2-2': shape('4-2-2 Flat Back Four', [['GK', 8, 50], ['LB', 28, 15], ['CB', 24, 38], ['CB', 24, 62], ['RB', 28, 85], ['CM', 52, 35], ['CM', 52, 65], ['ST', 82, 35], ['ST', 82, 65]]),
  },
  '11v11': {
    '4-1-4-1': shape('4-1-4-1 Holding Midfielder', [...BACK_FOUR, ['CDM', 40, 50], ['LM', 60, 15], ['CM', 58, 38], ['CM', 58, 62], ['RM', 60, 85], ['ST', 86, 50]]),
    '4-4-1-1': shape('4-4-1-1 Second Striker', [...BACK_FOUR, ['LM', 50, 15], ['CM', 48, 38], ['CM', 48, 62], ['RM', 50, 85], ['CF', 70, 50], ['ST', 87, 50]]),
    '4-1-2-1-2': shape('4-1-2-1-2 Diamond', [...BACK_FOUR, ['CDM', 40, 50], ['CM', 55, 28], ['CM', 55, 72], ['CAM', 70, 50], ['ST', 86, 35], ['ST', 86, 65]]),
    '4-5-1': shape('4-5-1 Compact', [...BACK_FOUR, ['LM', 55, 12], ['CM', 50, 32], ['CM', 46, 50], ['CM', 50, 68], ['RM', 55, 88], ['ST', 86, 50]]),
    '3-4-3': shape('3-4-3 Front Three', [...BACK_THREE, ['LM', 52, 12], ['CM', 48, 38], ['CM', 48, 62], ['RM', 52, 88], ['LW', 80, 20], ['ST', 87, 50], ['RW', 80, 80]]),
    '5-3-2': shape('5-3-2 Wing-Backs', [...BACK_FIVE, ['CM', 52, 28], ['CM', 48, 50], ['CM', 52, 72], ['ST', 84, 36], ['ST', 84, 64]]),
    '5-4-1': shape('5-4-1 Low Block', [...BACK_FIVE, ['LM', 55, 15], ['CM', 52, 38], ['CM', 52, 62], ['RM', 55, 85], ['ST', 86, 50]]),
  },
};

const SHAPES: Record<Format, Record<string, { name: string; coords: Shape }>> = {
  '5v5': { ...FIVE_A_SIDE, ...EXTRA['5v5'] },
  '7v7': { ...FORMAT_PRESETS['7v7'], ...EXTRA['7v7'] },
  '9v9': { ...FORMAT_PRESETS['9v9'], ...EXTRA['9v9'] },
  '11v11': { ...FORMAT_PRESETS['11v11'], ...EXTRA['11v11'] },
};

/** The formation select's free-form entry: players stay wherever they were dragged */
const FREE = 'custom';

const FORMATS: { key: Format; label: string; size: number; word: string }[] = [
  { key: '5v5', label: '5-a-side', size: 5, word: 'FIVE' },
  { key: '7v7', label: '7-a-side', size: 7, word: 'SEVEN' },
  { key: '9v9', label: '9-a-side', size: 9, word: 'NINE' },
  { key: '11v11', label: '11-a-side', size: 11, word: 'XI' },
];

const MARKERS: { key: MarkerShape; label: string }[] = [
  { key: 'circle', label: 'Circle' },
  { key: 'jersey', label: 'Jersey' },
  { key: 'square', label: 'Square' },
  { key: 'hexagon', label: 'Hexagon' },
  { key: 'triangle', label: 'Triangle' },
];

/** The whole squad, starters and subs, is at most 20 players */
const MAX_SQUAD = 20;
/** Subs before anyone changes it: 4, so 15 players for 11-a-side */
const DEFAULT_SUBS = 4;
/** Sponsor logos on the image, in one row */
const MAX_SPONSORS = 6;

const COLOURS = ['#10B981', '#DC2626', '#2563EB', '#0EA5E9', '#FACC15', '#F97316', '#7C3AED', '#E5E7EB'];

interface Player { name: string; number: string }
interface State {
  format: Format;
  /** A preset key, or FREE once players are dragged off it */
  shape: string;
  /** The preset the free-form lineup started from, for Reset */
  base: string;
  coords: Shape;
  players: Player[];
  captain: number;
  team: string;
  opponent: string;
  competition: string;
  colour: string;
  size: CardFormat;
  /** The image shows the players on the pitch (default) or as a numbered list */
  layout: 'pitch' | 'list';
  /** The player icon on the pitch and the image */
  marker: MarkerShape;
  /** Players in the squad, starters included (the rest are subs), up to MAX_SQUAD */
  squad: number;
  /** Background shade, pattern and shine of the image */
  look: Required<CardLook>;
  /** The subs' names and numbers, as far as they've been typed (the rest take the next shirt numbers) */
  subs: Player[];
}

const STORAGE_KEY = 'ifc-lineup-builder';

function fresh(format: Format, shape?: string, players: Player[] = []): State {
  const key = shape && SHAPES[format][shape] ? shape : Object.keys(SHAPES[format])[0];
  const coords = SHAPES[format][key].coords.map(c => ({ position: c.position, x: c.x, y: c.y }));
  return {
    format,
    shape: key,
    base: key,
    coords,
    players: coords.map((_, i) => players[i] || { name: '', number: String(i + 1) }),
    captain: -1,
    team: '',
    opponent: '',
    competition: '',
    colour: COLOURS[0],
    size: 'post',
    layout: 'pitch',
    marker: 'circle',
    squad: Math.min(MAX_SQUAD, coords.length + DEFAULT_SUBS),
    subs: [],
    look: { shade: 'dark', second: '#0F172A', pattern: 'dots', shine: false },
  };
}

/** '#10B981' -> '16, 185, 129', for the glass tints in the team colour */
const hexRgb = (hex: string) => {
  const n = parseInt(/^#[0-9a-f]{6}$/i.test(hex) ? hex.slice(1) : '10B981', 16);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
};

const clamp = (n: number) => Math.min(96, Math.max(4, n));

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '';
  return (parts[0].charAt(0) + (parts.length > 1 ? parts[parts.length - 1].charAt(0) : '')).toUpperCase();
}

interface Props {
  /** The format and formation it opens on (the format landing pages, e.g. /tools/9-a-side-lineup-builder) */
  defaultFormat?: Format;
  defaultShape?: string;
}

export default function LineupBuilderTool({ defaultFormat = '11v11', defaultShape }: Props = {}) {
  const [state, setState] = useState<State>(() => fresh(defaultFormat, defaultShape));
  const [crest, setCrest] = useState<string | null>(null);
  const [sponsors, setSponsors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [downloaded, setDownloaded] = useState(false);
  const [canShare, setCanShare] = useState(false);
  const [dragging, setDragging] = useState<number | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  /** A sub being dragged off the bench: where the pointer is, and the pitch slot it's over */
  const [benchDrag, setBenchDrag] = useState<{ i: number; x: number; y: number; over: number | null } | null>(null);
  const press = useRef<{ i: number; x: number; y: number; moved: boolean } | null>(null);
  const pitchRef = useRef<HTMLDivElement>(null);
  const nameRefs = useRef<(HTMLInputElement | null)[]>([]);
  const loaded = useRef(false);

  // Remember the last lineup in this browser (a convenience only: it works the same without it)
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') as State | null;
      // A format page keeps the saved lineup only when it is that format, so it opens on the format it is about
      const sameFormat = !defaultShape || saved?.format === defaultFormat;
      if (saved && sameFormat && SHAPES[saved.format] && (saved.shape === FREE || SHAPES[saved.format][saved.shape]) && saved.coords?.length === saved.players?.length) {
        const base = SHAPES[saved.format][saved.base] ? saved.base : fresh(saved.format).base;
        const next = { ...fresh(saved.format), ...saved, base };
        // A lineup saved before subs existed, or a squad out of range, gets the default squad
        if (!Number.isInteger(next.squad) || next.squad < next.coords.length || next.squad > MAX_SQUAD) next.squad = fresh(saved.format).squad;
        if (!Array.isArray(next.subs)) next.subs = [];
        next.look = { ...fresh(saved.format).look, ...(saved.look || {}) };
        setState(next);
      }
    } catch { /* storage blocked or corrupt */ }
    loaded.current = true;
    try {
      setCanShare(typeof navigator.canShare === 'function' && navigator.canShare({ files: [new File([''], 'x.png', { type: 'image/png' })] }));
    } catch { /* no file sharing */ }
    // Once on mount: the defaults are fixed for each page
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!loaded.current) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* storage blocked */ }
  }, [state]);

  const update = (patch: Partial<State>) => { setState(s => ({ ...s, ...patch })); setDownloaded(false); };
  const setFormat = (format: Format) => {
    if (format === state.format) return;
    const next = fresh(format, undefined, state.players);
    // The same number of subs, as far as the squad limit allows
    const squad = Math.min(MAX_SQUAD, next.players.length + Math.max(0, state.squad - state.coords.length));
    update({ format, shape: next.shape, base: next.base, coords: next.coords, players: next.players, squad, captain: state.captain < next.players.length ? state.captain : -1 });
  };
  const setShape = (shape: string) => (shape === FREE ? update({ shape }) : update({ shape, base: shape, coords: fresh(state.format, shape).coords }));
  const setPlayer = (i: number, patch: Partial<Player>) =>
    update({ players: state.players.map((p, j) => (j === i ? { ...p, ...patch } : p)) });

  // The subs on the bench: those typed so far, then empty ones numbered on from the starters
  const subs = Array.from({ length: Math.max(0, state.squad - state.coords.length) }, (_, i) =>
    state.subs[i] || { name: '', number: String(state.coords.length + i + 1) });
  const setSub = (i: number, patch: Partial<Player>) =>
    update({ subs: subs.map((p, j) => (j === i ? { ...p, ...patch } : p)).concat(state.subs.slice(subs.length)) });

  // A sub dropped on a player swaps them: the sub takes the slot (name and number), the player goes to the bench
  const swapIn = (sub: number, slot: number) => {
    const bench = subs[sub];
    const starter = state.players[slot];
    update({
      players: state.players.map((p, j) => (j === slot ? { name: bench.name, number: bench.number } : p)),
      subs: subs.map((p, j) => (j === sub ? { name: starter.name, number: starter.number } : p)).concat(state.subs.slice(subs.length)),
      // The armband stays on the pitch only if its wearer does
      captain: state.captain === slot ? -1 : state.captain,
    });
  };
  const slotAt = (x: number, y: number) => {
    const el = document.elementFromPoint(x, y)?.closest('[data-slot]');
    return el ? Number(el.getAttribute('data-slot')) : null;
  };
  const onBenchDown = (i: number, e: ReactPointerEvent<HTMLElement>) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setEditing(null);
    setBenchDrag({ i, x: e.clientX, y: e.clientY, over: null });
  };
  const onBenchMove = (e: ReactPointerEvent) => {
    if (!benchDrag) return;
    setBenchDrag({ ...benchDrag, x: e.clientX, y: e.clientY, over: slotAt(e.clientX, e.clientY) });
  };
  const onBenchUp = () => {
    if (benchDrag?.over != null) swapIn(benchDrag.i, benchDrag.over);
    setBenchDrag(null);
  };

  // Dragging a player: the pitch is vertical, so left is across (y) and top runs from their goal down to ours (x)
  const move = (i: number, e: ReactPointerEvent) => {
    const rect = pitchRef.current?.getBoundingClientRect();
    if (!rect) return;
    const y = clamp(((e.clientX - rect.left) / rect.width) * 100);
    const x = clamp(100 - ((e.clientY - rect.top) / rect.height) * 100);
    // Moving a player off the preset makes the lineup free form (the formation line is left off the image)
    setState(s => ({ ...s, shape: FREE, coords: s.coords.map((c, j) => (j === i ? { ...c, x, y } : c)) }));
    setDownloaded(false);
  };
  const setPosition = (i: number, position: string) =>
    update({ coords: state.coords.map((c, j) => (j === i ? { ...c, position } : c)) });

  // A press that moves a few pixels is a drag; one that doesn't is a tap, which opens the player's editor
  const onDown = (i: number, e: ReactPointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    press.current = { i, x: e.clientX, y: e.clientY, moved: false };
  };
  const onMove = (i: number, e: ReactPointerEvent) => {
    const p = press.current;
    if (!p || p.i !== i) return;
    if (!p.moved && Math.hypot(e.clientX - p.x, e.clientY - p.y) < 6) return;
    p.moved = true;
    setDragging(i);
    setEditing(null);
    move(i, e);
  };
  const onUp = (i: number) => {
    const p = press.current;
    press.current = null;
    setDragging(null);
    if (p && p.i === i && !p.moved) setEditing(i);
  };

  const pickCrest = (file: File | undefined) => {
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => { setCrest(typeof reader.result === 'string' ? reader.result : null); setDownloaded(false); };
    reader.readAsDataURL(file);
  };

  // Sponsor logos are read in the browser like the badge and kept in memory only (not even in this browser's storage)
  const pickSponsors = (files: FileList | null) => {
    const images = [...(files || [])].filter(f => f.type.startsWith('image/')).slice(0, MAX_SPONSORS - sponsors.length);
    // Read together, then added in the order they were picked
    Promise.all(images.map(file => new Promise<string | null>(resolve => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    }))).then(srcs => {
      const added = srcs.filter((src): src is string => !!src);
      if (!added.length) return;
      setSponsors(list => [...list, ...added].slice(0, MAX_SPONSORS));
      setDownloaded(false);
    });
  };

  const size = FORMATS.find(f => f.key === state.format)!;
  const fileName = `${(state.team.trim() || 'lineup').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'lineup'}-${state.layout === 'list' ? 'matchday-squad' : `starting-${size.word.toLowerCase()}`}.png`;

  const render = async () => {
    const lineup: PitchPosition[] = state.coords.map((c, i) => ({
      id: `slot-${i}`,
      name: state.players[i].name.trim() || c.position, // an unnamed slot still shows on the graphic
      number: parseInt(state.players[i].number, 10) || 0,
      position: c.position,
      x: c.x,
      y: c.y,
      is_captain: i === state.captain,
    }));
    const team = state.team.trim() || 'My Team';
    const club = { name: team, slug: '', primary_color: state.colour, secondary_color: state.colour, logo_url: crest || undefined } as unknown as Club;
    const match = {
      status: 'scheduled',
      is_club_home: true,
      home_team_name: team,
      away_team_name: state.opponent.trim(),
      home_formation: state.shape === FREE || state.layout === 'list' ? 'Custom' : state.shape, // the list leaves the formation off
      home_lineup_coords: lineup,
      competition: state.competition.trim(),
      match_date: '',
    } as unknown as Match;
    return drawMatchCard(match, club, state.layout === 'list' ? 'lineup-list' : 'lineup', 'Made at itsfootball.club', {
      format: state.size, headline: state.layout === 'list' ? ['MATCHDAY', 'SQUAD'] : ['STARTING', size.word], keepOrder: true, marker: state.marker,
      look: state.look,
      subs: subs.map(p => ({ name: p.name.trim(), number: parseInt(p.number, 10) || 0 })).filter(p => p.name),
      sponsors,
    });
  };

  const run = async (share: boolean) => {
    setBusy(true);
    setError('');
    try {
      const blob = await render();
      const file = new File([blob], fileName, { type: 'image/png' });
      let shared = false;
      if (share && navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: `${state.team.trim() || 'Our'} ${state.layout === 'list' ? 'matchday squad' : `starting ${size.word === 'XI' ? 'XI' : size.word.toLowerCase()}`}` });
          shared = true;
        } catch { /* the share sheet was closed */ }
      }
      if (!share) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 10_000);
      }
      if (!share || shared) setDownloaded(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the image.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="lineup-tool" style={{ '--lb-rgb': hexRgb(state.colour) } as CSSProperties}>
      {/* The pitch */}
      <div className="lineup-tool-pitch-col lineup-tool-glass lineup-tool-pitch-frame">
        <div
          ref={pitchRef}
          className="tactical-pitch tactical-pitch-vertical lineup-tool-pitch"
          onPointerCancel={() => { press.current = null; setDragging(null); }}
          aria-label="Lineup pitch. Drag a player to move them, or tap one to name them."
        >
          <div className="tactical-pitch-surface">
            <div className="pitch-halfway-line" />
            <div className="pitch-center-circle" />
            <div className="pitch-center-spot" />
            <div className="pitch-penalty-box-left" />
            <div className="pitch-six-yard-left" />
            <div className="pitch-penalty-spot-left" />
            <div className="pitch-penalty-arc-left" />
            <div className="pitch-goal-left" />
            <div className="pitch-penalty-box-right" />
            <div className="pitch-six-yard-right" />
            <div className="pitch-penalty-spot-right" />
            <div className="pitch-penalty-arc-right" />
            <div className="pitch-goal-right" />
          </div>
          {state.coords.map((c, i) => {
            const p = state.players[i];
            const gk = c.position === 'GK';
            const label = juniorPublicName(p.name) || c.position; // "Mahesh S.", as the image shows it
            return (
              <div
                key={i}
                data-slot={i}
                className={`pitch-player-node ${dragging === i ? 'is-dragging' : ''} ${editing === i ? 'is-selected' : ''} ${benchDrag?.over === i ? 'is-drop-target' : ''}`}
                style={{ left: `${c.y}%`, top: `${100 - c.x}%` }}
                role="button"
                tabIndex={0}
                aria-label={`${p.name.trim() || `Empty ${c.position}`}${p.number ? `, number ${p.number}` : ''}. Press Enter to edit, arrow keys to move.`}
                onPointerDown={e => onDown(i, e)}
                onPointerMove={e => onMove(i, e)}
                onPointerUp={() => onUp(i)}
                onMouseDown={e => e.preventDefault()} // a tap mustn't pull focus back from the popup's name field
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setEditing(i); }
                  const step = { ArrowUp: [3, 0], ArrowDown: [-3, 0], ArrowLeft: [0, -3], ArrowRight: [0, 3] }[e.key];
                  if (step) {
                    e.preventDefault();
                    setState(s => ({ ...s, shape: FREE, coords: s.coords.map((d, j) => (j === i ? { ...d, x: clamp(d.x + step[0]), y: clamp(d.y + step[1]) } : d)) }));
                  }
                }}
              >
                <div
                  className="player-node-circle"
                  style={{
                    position: 'relative', width: 44, height: 44,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#FFFFFF', fontFamily: 'var(--font-heading)', fontWeight: 900, fontSize: '0.95rem',
                    textShadow: '0 1px 3px rgba(0,0,0,0.8)',
                    ...(state.marker === 'circle' ? {
                      borderRadius: '50%',
                      background: gk ? 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)' : `linear-gradient(135deg, ${state.colour} 0%, rgba(0,0,0,0.3) 100%), ${state.colour}`,
                      border: p.name.trim() ? '2px solid rgba(255,255,255,0.85)' : '2px dashed rgba(255,255,255,0.65)',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                    } : {}),
                  }}
                >
                  {state.marker !== 'circle' && (
                    <MarkerIcon shape={state.marker} fill={gk ? '#F59E0B' : state.colour} dashed={!p.name.trim()}
                      style={{ position: 'absolute', inset: '-5%', width: '110%', height: '110%', filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.5))' }} />
                  )}
                  <span style={{ position: 'relative', transform: `translateY(${MARKER_TEXT_DROP[state.marker] * 50}%)`, fontSize: `${MARKER_TEXT_SCALE[state.marker]}em` }}>
                    {(state.marker === 'jersey' && p.number) || initials(p.name) || '+'}
                  </span>
                  {p.number && state.marker !== 'jersey' && (
                    <span className="player-node-number" style={{
                      position: 'absolute', bottom: -4, left: -6, minWidth: 18, padding: '1px 4px', borderRadius: 5,
                      background: 'rgba(8, 12, 18, 0.92)', color: '#FFFFFF', fontFamily: 'var(--font-mono)',
                      fontSize: '0.68rem', fontWeight: 800, textAlign: 'center', textShadow: 'none',
                      border: `1px solid ${gk ? '#F59E0B' : state.colour}`,
                    }}>{p.number}</span>
                  )}
                  {state.captain === i && (
                    <span title="Captain" style={{
                      position: 'absolute', top: -5, left: -5, width: 16, height: 16, borderRadius: '50%',
                      background: '#F59E0B', color: '#000', fontSize: '0.62rem', fontWeight: 900, textShadow: 'none',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid #000',
                    }}>C</span>
                  )}
                </div>
                <div className="player-node-name lineup-tool-tag" style={{
                  marginTop: 6, padding: '2px 7px', borderRadius: 6, maxWidth: 96,
                  fontSize: '0.7rem', fontWeight: 700, color: p.name.trim() ? '#F8FAFC' : 'rgba(248,250,252,0.6)',
                  textAlign: 'center', lineHeight: 1.15, overflowWrap: 'anywhere',
                }}>
                  {label}
                </div>
              </div>
            );
          })}

          {editing !== null && state.coords[editing] && (
            <PlayerEditor
              key={editing}
              position={state.coords[editing].position}
              player={state.players[editing]}
              captain={state.captain === editing}
              above={state.coords[editing].x < 45}
              onName={name => setPlayer(editing, { name })}
              onNumber={number => setPlayer(editing, { number })}
              onPosition={position => setPosition(editing, position)}
              onCaptain={() => update({ captain: state.captain === editing ? -1 : editing })}
              onClose={() => setEditing(null)}
            />
          )}
        </div>
        {subs.some(p => p.name.trim()) && (
          <div className="lineup-tool-bench" aria-label="Subs">
            <span className="lineup-tool-bench-label">Subs</span>
            {subs.map((p, i) => p.name.trim() && (
              <span key={i} className={`lineup-tool-bench-chip ${benchDrag?.i === i ? 'is-lifted' : ''}`}
                role="button" tabIndex={0} aria-label={`${p.name}. Drag onto a player to swap them in.`}
                onPointerDown={e => onBenchDown(i, e)} onPointerMove={onBenchMove} onPointerUp={onBenchUp}
                onPointerCancel={() => setBenchDrag(null)}>
                <GripVertical size={12} aria-hidden="true" />{p.number && <b>{p.number}</b>}{juniorPublicName(p.name)}
              </span>
            ))}
          </div>
        )}
        {benchDrag && (
          <span className="lineup-tool-bench-chip lineup-tool-bench-ghost" style={{ left: Math.min(Math.max(benchDrag.x, 110), window.innerWidth - 110), top: benchDrag.y }} aria-hidden="true">
            {subs[benchDrag.i].number && <b>{subs[benchDrag.i].number}</b>}{juniorPublicName(subs[benchDrag.i].name)}
            {benchDrag.over != null && <em>⇄ {juniorPublicName(state.players[benchDrag.over].name) || state.coords[benchDrag.over].position}</em>}
          </span>
        )}
        <p className="lineup-tool-hint">
          Tap a player to name them. Drag to move them anywhere.
          {subs.some(p => p.name.trim()) && ' Drag a sub onto a player to swap them in.'}
        </p>
      </div>

      {/* Controls, in three short sections so they read well on a phone */}
      <div className="lineup-tool-controls lineup-tool-glass">
        {/* Up front, before anything is added: the badge, sponsor logos and any other photos never leave the device */}
        <p className="lineup-tool-privacy">
          <Lock size={14} aria-hidden="true" />
          <span><strong>Private by design.</strong> All photos you upload stay on your device. They are processed in your browser and never uploaded to or stored on our server.</span>
        </p>
        <h2 className="lineup-tool-section">Team</h2>
        <div className="lineup-tool-row">
          <div className="form-group">
            <label className="form-label" htmlFor="lb-format">Format</label>
            <select id="lb-format" className="form-select" value={state.format} onChange={e => setFormat(e.target.value as Format)}>
              {FORMATS.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="lb-shape">Formation</label>
            <select id="lb-shape" className="form-select" value={state.shape} onChange={e => setShape(e.target.value)}>
              {Object.entries(SHAPES[state.format]).map(([key, s]) => <option key={key} value={key}>{s.name}</option>)}
              <option value={FREE}>Free form (drag anywhere)</option>
            </select>
          </div>
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="lb-team">Team name</label>
          <input id="lb-team" className="form-input" value={state.team} maxLength={40} placeholder="My Team FC" autoComplete="off" onChange={e => update({ team: e.target.value })} />
        </div>
        <div className="lineup-tool-row">
          <div className="form-group">
            <label className="form-label" htmlFor="lb-opp">Opponent <span className="lineup-tool-optional">(optional)</span></label>
            <input id="lb-opp" className="form-input" value={state.opponent} maxLength={40} placeholder="Rivals United" autoComplete="off" onChange={e => update({ opponent: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="lb-comp">Competition <span className="lineup-tool-optional">(optional)</span></label>
            <input id="lb-comp" className="form-input" value={state.competition} maxLength={40} placeholder="Sunday League" autoComplete="off" onChange={e => update({ competition: e.target.value })} />
          </div>
        </div>

        <h2 className="lineup-tool-section">Look</h2>
        <div className="form-group">
          <span className="form-label" id="lb-icons">Player icons</span>
          <div className="lineup-tool-icons" role="radiogroup" aria-labelledby="lb-icons">
            {MARKERS.map(m => (
              <button key={m.key} type="button" role="radio" aria-checked={state.marker === m.key} title={m.label}
                className={`lineup-tool-icon ${state.marker === m.key ? 'is-active' : ''}`} onClick={() => update({ marker: m.key })}>
                <MarkerIcon shape={m.key} fill={state.colour} style={{ width: 22, height: 22 }} />
                <span>{m.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="form-group">
          <span className="form-label">Team colour and badge</span>
          <div className="lineup-tool-colours">
            {COLOURS.map(c => (
              <button key={c} type="button" aria-label={`Colour ${c}`} aria-pressed={state.colour === c}
                className={`lineup-tool-swatch ${state.colour === c ? 'is-active' : ''}`} style={{ background: c }} onClick={() => update({ colour: c })} />
            ))}
            <label className="lineup-tool-swatch lineup-tool-swatch-custom" title="Pick any colour">
              <input type="color" value={state.colour} aria-label="Pick any colour" onChange={e => update({ colour: e.target.value.toUpperCase() })} />
            </label>
            <span className="lineup-tool-divider" />
            {crest ? (
              <span className="lineup-tool-crest">
                <img src={crest} alt="Your badge" />
                <button type="button" aria-label="Remove badge" onClick={() => setCrest(null)}><X size={12} /></button>
              </span>
            ) : (
              <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
                <ImagePlus size={15} /> Add badge
                <input type="file" accept="image/*" hidden onChange={e => pickCrest(e.target.files?.[0])} />
              </label>
            )}
          </div>
        </div>

        <div className="form-group">
          <span className="form-label" id="lb-shade">Background</span>
          <div className="lineup-tool-segment" role="radiogroup" aria-labelledby="lb-shade">
            {([['dark', 'Dark'], ['midnight', 'Midnight'], ['club', 'Team colour'], ['duo', 'Two-tone']] as const).map(([key, label]) => (
              <button key={key} type="button" role="radio" aria-checked={state.look.shade === key}
                className={state.look.shade === key ? 'is-active' : ''} onClick={() => update({ look: { ...state.look, shade: key } })}>
                {label}
              </button>
            ))}
          </div>
          {state.look.shade === 'duo' && (
            <div className="lineup-tool-colours" style={{ marginTop: '0.5rem' }}>
              <span className="lineup-tool-optional" style={{ fontSize: '0.8rem' }}>Second colour</span>
              {['#0F172A', '#1E3A8A', '#7F1D1D', '#FACC15', '#F8FAFC', '#7C3AED'].map(c => (
                <button key={c} type="button" aria-label={`Second colour ${c}`} aria-pressed={state.look.second === c}
                  className={`lineup-tool-swatch ${state.look.second === c ? 'is-active' : ''}`} style={{ background: c }} onClick={() => update({ look: { ...state.look, second: c } })} />
              ))}
              <label className="lineup-tool-swatch lineup-tool-swatch-custom" title="Pick any colour">
                <input type="color" value={state.look.second} aria-label="Pick any second colour" onChange={e => update({ look: { ...state.look, second: e.target.value.toUpperCase() } })} />
              </label>
            </div>
          )}
        </div>

        <div className="form-group">
          <span className="form-label" id="lb-pattern">Pattern</span>
          <div className="lineup-tool-patterns" role="radiogroup" aria-labelledby="lb-pattern">
            {([['dots', 'Dots'], ['stripes', 'Stripes'], ['hoops', 'Hoops'], ['chevron', 'Chevron'], ['halftone', 'Halftone'], ['none', 'Plain']] as const).map(([key, label]) => (
              <button key={key} type="button" role="radio" aria-checked={state.look.pattern === key}
                className={`lineup-tool-pattern lineup-tool-pattern-${key} ${state.look.pattern === key ? 'is-active' : ''}`}
                onClick={() => update({ look: { ...state.look, pattern: key } })}>
                <span aria-hidden="true" />{label}
              </button>
            ))}
          </div>
          <label className="lineup-tool-toggle">
            <input type="checkbox" checked={state.look.shine} onChange={e => update({ look: { ...state.look, shine: e.target.checked } })} />
            <span>Light shine</span>
            <span className="lineup-tool-optional">Rays of light and a glossy sweep</span>
          </label>
        </div>

        <div className="form-group">
          <span className="form-label">Sponsors <span className="lineup-tool-optional">(optional, up to {MAX_SPONSORS} logos)</span></span>
          <div className="lineup-tool-sponsors">
            {sponsors.map((src, i) => (
              <span key={i} className="lineup-tool-sponsor">
                <img src={src} alt={`Sponsor logo ${i + 1}`} />
                <button type="button" aria-label={`Remove sponsor logo ${i + 1}`} onClick={() => { setSponsors(list => list.filter((_, j) => j !== i)); setDownloaded(false); }}><X size={12} /></button>
              </span>
            ))}
            {sponsors.length < MAX_SPONSORS && (
              <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
                <ImagePlus size={15} /> {sponsors.length ? 'Add another' : 'Add sponsor logos'}
                <input type="file" accept="image/*" multiple hidden data-sponsor-input onChange={e => { pickSponsors(e.target.files); e.target.value = ''; }} />
              </label>
            )}
          </div>
        </div>

        <div className="lineup-tool-row">
          <div className="form-group">
            <span className="form-label" id="lb-style">Image style</span>
            <div className="lineup-tool-segment" role="radiogroup" aria-labelledby="lb-style">
              {([['pitch', 'Pitch'], ['list', 'List']] as const).map(([key, label]) => (
                <button key={key} type="button" role="radio" aria-checked={state.layout === key}
                  className={state.layout === key ? 'is-active' : ''} onClick={() => update({ layout: key })}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="form-group">
            <span className="form-label" id="lb-size">Image size</span>
            <div className="lineup-tool-segment" role="radiogroup" aria-labelledby="lb-size">
              {([['post', 'Post 4:5'], ['story', 'Story 9:16']] as const).map(([key, label]) => (
                <button key={key} type="button" role="radio" aria-checked={state.size === key}
                  className={state.size === key ? 'is-active' : ''} onClick={() => update({ size: key })}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="lineup-tool-players-head">
          <h2 className="lineup-tool-section" style={{ margin: 0 }}>Players</h2>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => update({ shape: state.base, coords: fresh(state.format, state.base).coords })}>
            <RotateCcw size={14} /> Reset positions
          </button>
        </div>
        <ol className="lineup-tool-players">
          {state.coords.map((c, i) => (
            <li key={i}>
              <span className={`lineup-tool-pos ${c.position === 'GK' ? 'is-gk' : ''}`}>{c.position}</span>
              <input className="form-input lineup-tool-num" inputMode="numeric" maxLength={2} aria-label={`${c.position} shirt number`}
                value={state.players[i].number} onChange={e => setPlayer(i, { number: e.target.value.replace(/\D/g, '') })} />
              <input ref={el => { nameRefs.current[i] = el; }} className="form-input" maxLength={28} placeholder="Player name" aria-label={`${c.position} name`}
                autoComplete="off" enterKeyHint="next" value={state.players[i].name} onChange={e => setPlayer(i, { name: e.target.value })}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); nameRefs.current[i + 1]?.focus(); } }} />
              <button type="button" className={`lineup-tool-captain ${state.captain === i ? 'is-active' : ''}`}
                aria-pressed={state.captain === i} aria-label={`Make ${state.players[i].name || c.position} captain`} title="Captain"
                onClick={() => update({ captain: state.captain === i ? -1 : i })}>C</button>
            </li>
          ))}
        </ol>

        <div className="lineup-tool-players-head lineup-tool-subs-head">
          <h3 className="lineup-tool-subhead">Subs</h3>
          <select className="form-select lineup-tool-squad" aria-label="Squad size" value={state.squad} onChange={e => update({ squad: Number(e.target.value) })}>
            {Array.from({ length: MAX_SQUAD - state.coords.length + 1 }, (_, n) => (
              <option key={n} value={state.coords.length + n}>
                {n ? `${state.coords.length + n} players (${n} sub${n > 1 ? 's' : ''})` : 'No subs'}
              </option>
            ))}
          </select>
        </div>
        {subs.length > 0 && (
          <ol className="lineup-tool-players lineup-tool-subs">
            {subs.map((p, i) => (
              <li key={i}>
                <span className="lineup-tool-pos">SUB</span>
                <input className="form-input lineup-tool-num" inputMode="numeric" maxLength={2} aria-label={`Sub ${i + 1} shirt number`}
                  value={p.number} onChange={e => setSub(i, { number: e.target.value.replace(/\D/g, '') })} />
                <input className="form-input" maxLength={28} placeholder="Sub name" aria-label={`Sub ${i + 1} name`}
                  autoComplete="off" value={p.name} onChange={e => setSub(i, { name: e.target.value })} />
              </li>
            ))}
          </ol>
        )}
        <p className="lineup-tool-hint" style={{ textAlign: 'left', marginTop: '0.5rem' }}>{state.layout === 'list' ? 'Named subs are listed after the starters on the image.' : 'Named subs are listed under the lineup on the image.'} Drag a sub onto a player on the pitch to swap them in.</p>

        {/* Stays in reach at the bottom of the screen while scrolling through the players on a phone */}
        <div className="lineup-tool-actions">
          <button type="button" className="btn btn-primary btn-lg" disabled={busy} onClick={() => run(false)}>
            <Download size={18} /> {busy ? 'Drawing…' : 'Download image'}
          </button>
          {canShare && (
            <button type="button" className="btn btn-secondary btn-lg" disabled={busy} onClick={() => run(true)} aria-label="Share image">
              <Share2 size={18} /> <span className="lineup-tool-share-label">Share</span>
            </button>
          )}
        </div>
        {error && <p role="alert" style={{ color: 'var(--c-red)', marginTop: '0.6rem', fontSize: '0.85rem' }}>{error}</p>}

        <div className={`lineup-tool-prompt ${downloaded ? 'is-done' : ''}`} role="status">
          {downloaded && <strong className="lineup-tool-prompt-done">Image downloaded. </strong>}
          <span>Want to track player availability before picking your XI? </span>
          <Link href="/create-club" className="lineup-tool-prompt-link">
            Launch your free club site <ArrowRight size={15} />
          </Link>
        </div>
      </div>
    </div>
  );
}

/** The popup that opens when a player on the pitch is tapped: name, shirt number, position and captaincy */
function PlayerEditor({ position, player, captain, above, onName, onNumber, onPosition, onCaptain, onClose }: {
  position: string;
  player: Player;
  captain: boolean;
  /** Show the popup in the top half (the player is in the bottom half), so it never covers them */
  above: boolean;
  onName: (name: string) => void;
  onNumber: (number: string) => void;
  onPosition: (position: string) => void;
  onCaptain: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, []);
  useEffect(() => {
    const outside = (e: PointerEvent) => {
      const t = e.target as HTMLElement;
      if (!ref.current?.contains(t) && !t.closest('.pitch-player-node')) onClose();
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', esc); };
  }, [onClose]);

  return (
    <div
      ref={ref}
      data-theme="dark"
      className={`lineup-tool-editor ${above ? 'is-top' : 'is-bottom'}`}
      role="dialog"
      aria-label={`Edit ${player.name || position}`}
      onPointerDown={e => e.stopPropagation()}
    >
      <form onSubmit={e => { e.preventDefault(); onClose(); }}>
        <div className="lineup-tool-editor-row">
          <input className="form-input" autoFocus maxLength={28} placeholder="Player name" aria-label="Player name"
            value={player.name} onChange={e => onName(e.target.value)} />
        </div>
        <div className="lineup-tool-editor-row lineup-tool-editor-grid">
          <input className="form-input lineup-tool-num" inputMode="numeric" maxLength={2} placeholder="No." aria-label="Shirt number"
            value={player.number} onChange={e => onNumber(e.target.value.replace(/\D/g, ''))} />
          <input className="form-input lineup-tool-num" maxLength={4} placeholder="Pos" aria-label="Position"
            value={position} onChange={e => onPosition(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))} />
          <button type="button" className={`lineup-tool-captain ${captain ? 'is-active' : ''}`} aria-pressed={captain} title="Captain" onClick={onCaptain}>C</button>
          <button type="submit" className="btn btn-primary btn-sm">Done</button>
        </div>
      </form>
    </div>
  );
}

/** A player marker's shape as SVG: the club colour shading darker to one corner, with a white outline */
function MarkerIcon({ shape, fill, dashed, style }: { shape: MarkerShape; fill: string; dashed?: boolean; style?: CSSProperties }) {
  const id = useId();
  const outline = { stroke: dashed ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.85)', strokeWidth: 2, strokeDasharray: dashed ? '4 3' : undefined, strokeLinejoin: 'round' as const, vectorEffect: 'non-scaling-stroke' as const };
  const body = (props: Record<string, unknown>) =>
    shape === 'circle' ? <circle cx={50} cy={50} r={44} {...props} />
      : shape === 'square' ? <rect x={5} y={5} width={90} height={90} rx={19} {...props} />
      : <polygon points={MARKER_POINTS[shape].map(([x, y]) => `${x},${y}`).join(' ')} {...props} />;
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" style={style}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.3" />
        </linearGradient>
      </defs>
      {body({ fill })}
      {body({ fill: `url(#${id})`, ...outline })}
    </svg>
  );
}
