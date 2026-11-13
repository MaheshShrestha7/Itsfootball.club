'use client';

// The coach's tactics board: draw runs, passes and dribbles over the line-up, drop a ball, cones and
// opposition players, one board per situation. TacticsBoard is the editor on the lineup workbench;
// TacticsBoardView is the read-only board players get in the club app.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Check, Download, Eraser, Eye, Move, Pencil, Plus, Redo2, Trash2, Type, Undo2, X } from 'lucide-react';
import type { PitchPosition } from '@/lib/supabase/types';
import { PitchMarkings, formatPitchName } from './TacticalPitch';
import {
  BOARD_COLORS, MAX_BOARDS, MAX_ITEMS, MAX_NOTE, hitItem, lineShape, simplify,
  type BoardItem, type LineKind, type Pt, type TacticsBoard as Board,
} from '@/lib/tactics-board';
import type { TacticsSaveState } from '@/lib/use-match-tactics';

type Tool = 'move' | LineKind | 'zone' | 'ball' | 'cone' | 'opp' | 'erase';
interface Disc { id: string; n: number; gk: boolean; cap: boolean; name: string; at: Pt }

const HINT: Record<Tool, string> = {
  move: 'Drag a player or a piece', run: 'Drag to draw a run', pass: 'Drag to draw a pass', dribble: 'Drag to draw a dribble',
  pen: 'Draw anything', zone: 'Drag out an area', ball: 'Tap to place the ball', cone: 'Tap to place a cone',
  opp: 'Tap to place an opponent', erase: 'Tap anything you drew to remove it',
};
const isPiece = (it: BoardItem) => it.t === 'ball' || it.t === 'cone' || it.t === 'opp';

/** The line-up's players as board discs: where this board has moved them, else where the line-up has them */
function discsFor(positions: PitchPosition[], board: Board | undefined): Disc[] {
  return positions.filter(p => p.member_id).map(p => ({
    id: p.id,
    n: p.number,
    gk: p.position === 'GK',
    cap: !!p.is_captain,
    name: formatPitchName(p.name, 'firstLastInitial'),
    // The line-up is stored lying down (x runs up the pitch); the board stands it up
    at: board?.players[p.id] || [p.y, 100 - p.x],
  }));
}

// ---- Drawing (plain SVG, so the screen, the players' view and the downloaded image share it) ----

const ICON = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
const ToolIcon = ({ tool }: { tool: Tool }) => {
  if (tool === 'move') return <Move size={22} aria-hidden="true" />;
  if (tool === 'pen') return <Pencil size={22} aria-hidden="true" />;
  if (tool === 'erase') return <Eraser size={22} aria-hidden="true" />;
  return (
    <svg viewBox="0 0 24 24" width={22} height={22} aria-hidden="true" {...ICON}>
      {tool === 'run' && <><path d="M4 20 19 5" /><path d="M10 5h9v9" /></>}
      {tool === 'pass' && <><path d="M4 20 19 5" strokeDasharray="3.5 3.5" /><path d="M10 5h9v9" /></>}
      {tool === 'dribble' && <><path d="M3 20c2-4 4 1 6-3s4 1 6-3 2-3 4-7" /><path d="M12 5h8v8" /></>}
      {tool === 'zone' && <rect x="3" y="5" width="18" height="14" rx="3" strokeDasharray="4 3" />}
      {tool === 'ball' && <><circle cx="12" cy="12" r="9" /><path d="m12 7.5 4 3-1.5 4.5h-5L8 10.5ZM12 3v4.5M3.5 9.5 8 10.5M20.5 9.5 16 10.5M6.5 19l3-4M17.5 19l-3-4" /></>}
      {tool === 'cone' && <path d="M12 3 5.5 19h13ZM3 21h18M8.5 12h7" />}
      {tool === 'opp' && <><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4" fill="currentColor" stroke="none" /></>}
    </svg>
  );
};

function ItemShape({ item, i, w, h }: { item: BoardItem; i: number; w: number; h: number }) {
  const X = (v: number) => v * w / 100, Y = (v: number) => v * h / 100;
  if (item.t === 'zone') {
    return <rect data-i={i} x={X(item.x)} y={Y(item.y)} width={X(item.w)} height={Y(item.h)} rx={10}
      fill={item.c} fillOpacity={0.2} stroke={item.c} strokeOpacity={0.9} strokeWidth={2} strokeDasharray="7 6" />;
  }
  if ('p' in item) {
    const { d, head } = lineShape(item.t, item.p.map((q): Pt => [X(q[0]), Y(q[1])]));
    const dash = item.t === 'pass' ? '9 7' : undefined;
    const stroke = { fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round', strokeDasharray: dash } as const;
    return (
      <g data-i={i}>
        {/* A wide invisible stroke, so a finger can pick the line up */}
        <path d={d} fill="none" stroke="transparent" strokeWidth={22} />
        {/* A dark edge keeps a white line readable on the light stripes */}
        <path d={d} {...stroke} stroke="#04110a" strokeOpacity={0.55} strokeWidth={6.5} />
        {head && <polygon points={head} fill="#04110a" fillOpacity={0.55} stroke="#04110a" strokeOpacity={0.55} strokeWidth={4} strokeLinejoin="round" />}
        <path d={d} {...stroke} stroke={item.c} strokeWidth={3.2} />
        {head && <polygon points={head} fill={item.c} stroke={item.c} strokeWidth={1.5} strokeLinejoin="round" />}
      </g>
    );
  }
  const at = `translate(${X(item.x).toFixed(1)} ${Y(item.y).toFixed(1)})`;
  if (item.t === 'ball') {
    return (
      <g data-i={i} transform={at}>
        <circle r={9} cy={2} fill="#000" opacity={0.35} />
        <circle r={8.5} fill="#fff" stroke="#0b0f14" strokeWidth={1.5} />
        <path d="M0-3.8 3.6-1.2 2.2 3.1h-4.4L-3.6-1.2Z" fill="#0b0f14" />
        <path d="M0-8.5V-3.8M8-2.6 3.6-1.2M5 6.9 2.2 3.1M-5 6.9-2.2 3.1M-8-2.6-3.6-1.2" stroke="#0b0f14" strokeWidth={1.2} fill="none" />
      </g>
    );
  }
  if (item.t === 'cone') {
    return (
      <g data-i={i} transform={at}>
        <ellipse cy={8} rx={11} ry={3.5} fill="#000" opacity={0.35} />
        <path d="M0-11 8 7.5H-8Z" fill="#F97316" stroke="#7C2D12" strokeWidth={1.2} strokeLinejoin="round" />
        <path d="M-3.3-3.5h6.6l1.8 4.2H-5.1Z" fill="#fff" opacity={0.92} />
        <rect x={-10.5} y={6.5} width={21} height={3.2} rx={1.6} fill="#EA580C" stroke="#7C2D12" strokeWidth={1} />
      </g>
    );
  }
  return (
    <g data-i={i} transform={at}>
      <circle r={14} cy={2.5} fill="#000" opacity={0.35} />
      <circle r={13.5} fill="#1E293B" stroke="#E2E8F0" strokeWidth={2} />
      <text y={4.6} textAnchor="middle" fill="#fff" fontFamily="var(--font-heading), sans-serif" fontWeight={800} fontSize={13}>{item.n}</text>
    </g>
  );
}

/** One layer of a board's drawings: lines and zones (under the players) or the pieces (on top of them) */
function Items({ items, pieces, w, h }: { items: BoardItem[]; pieces: boolean; w: number; h: number }) {
  return (
    <>
      {/* Zones first, so a line drawn through one stays on top of its shading */}
      {items.map((it, i) => (!pieces && it.t === 'zone' ? <ItemShape key={i} item={it} i={i} w={w} h={h} /> : null))}
      {items.map((it, i) => (isPiece(it) === pieces && it.t !== 'zone' ? <ItemShape key={i} item={it} i={i} w={w} h={h} /> : null))}
    </>
  );
}

function usePitchSize(ref: React.RefObject<HTMLDivElement | null>): [number, number] {
  const [size, setSize] = useState<[number, number]>([0, 0]);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setSize([el.clientWidth, el.clientHeight]);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}

/** The pitch with a board on it. `children` sit above everything (the editor's drawing surface and hint). */
function BoardPitch({ pitchRef, board, discs, names, draft, primaryColor, children, ...handlers }: {
  pitchRef: React.RefObject<HTMLDivElement | null>;
  board: Board;
  discs: Disc[];
  names: boolean;
  draft?: BoardItem | null;
  primaryColor: string;
  children?: React.ReactNode;
} & Pick<React.HTMLAttributes<HTMLDivElement>, 'onPointerDown' | 'onPointerMove' | 'onPointerUp' | 'onPointerCancel'>) {
  const [w, h] = usePitchSize(pitchRef);
  return (
    <div ref={pitchRef} className="tactical-pitch tactical-pitch-vertical tb-pitch" {...handlers}>
      <div className="tactical-pitch-surface">
        <PitchMarkings />
        <div className="tb-attack">Attack ↑</div>
      </div>
      {w > 0 && (
        <svg className="tb-svg" aria-hidden="true">
          <Items items={board.items} pieces={false} w={w} h={h} />
          {draft && <ItemShape item={draft} i={-1} w={w} h={h} />}
        </svg>
      )}
      {discs.map(d => (
        <div key={d.id} data-pid={d.id} className="pitch-player-node tb-node" style={{ left: `${d.at[0]}%`, top: `${d.at[1]}%` }} title={d.name}>
          <div className={d.gk ? 'tb-disc is-gk' : 'tb-disc'} style={d.gk ? undefined : { background: `linear-gradient(135deg, ${primaryColor} 0%, rgba(0,0,0,0.28) 100%), ${primaryColor}` }}>
            {d.n > 0 ? d.n : ''}
            {d.cap && <span className="tb-cap">C</span>}
          </div>
          {names && <div className="tb-disc-name">{d.name}</div>}
        </div>
      ))}
      {w > 0 && (
        <svg className="tb-svg tb-svg-top" aria-hidden="true">
          <Items items={board.items} pieces w={w} h={h} />
        </svg>
      )}
      {children}
    </div>
  );
}

const LINE_KEY = (
  <dl className="tb-key" aria-label="What the lines mean">
    <dt><svg viewBox="0 0 44 14" aria-hidden="true"><path d="M2 7h34" stroke="currentColor" strokeWidth={2.5} fill="none" strokeLinecap="round" /><path d="M42 7 33 2.5v9Z" fill="currentColor" /></svg></dt><dd>Player run</dd>
    <dt><svg viewBox="0 0 44 14" aria-hidden="true"><path d="M2 7h32" stroke="currentColor" strokeWidth={2.5} fill="none" strokeDasharray="5 4" strokeLinecap="round" /><path d="M42 7 33 2.5v9Z" fill="currentColor" /></svg></dt><dd>Pass or cross</dd>
    <dt><svg viewBox="0 0 44 14" aria-hidden="true"><path d="M2 7c2-5 4-5 6 0s4 5 6 0 4-5 6 0 4 5 6 0 4-5 6 0" stroke="currentColor" strokeWidth={2.5} fill="none" strokeLinecap="round" /><path d="M42 7 33 2.5v9Z" fill="currentColor" /></svg></dt><dd>Dribble with the ball</dd>
  </dl>
);

function BoardTabs({ boards, activeId, onPick, children }: { boards: Board[]; activeId: string; onPick: (id: string) => void; children?: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Sideways only: scrollIntoView would also drag the page down to the tabs
    const strip = ref.current, tab = strip?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (strip && tab) strip.scrollLeft = tab.offsetLeft - (strip.clientWidth - tab.offsetWidth) / 2;
  }, [activeId]);
  return (
    <div ref={ref} className="tb-tabs" role="tablist" aria-label="Boards">
      {boards.map(b => (
        <button key={b.id} type="button" role="tab" className="tb-tab" aria-selected={b.id === activeId} onClick={() => onPick(b.id)}>
          {b.name.trim() || 'Board'}
          {b.items.length > 0 && <span className="tb-count">{b.items.length}</span>}
        </button>
      ))}
      {children}
    </div>
  );
}

/** Read-only boards, as a player sees them: the tabs, the pitch and the coach's note */
export function TacticsBoardView({ boards, positions, primaryColor }: { boards: Board[]; positions: PitchPosition[]; primaryColor: string }) {
  const [pick, setPick] = useState('');
  const pitchRef = useRef<HTMLDivElement>(null);
  const [names, setNames] = useState(true);
  const board = boards.find(b => b.id === pick) || boards[0];
  const discs = useMemo(() => discsFor(positions, board), [positions, board]);
  if (!board) return <p className="tb-empty">The coach hasn&rsquo;t shared a board for this game yet.</p>;
  return (
    <div className="tb-root">
      <BoardTabs boards={boards} activeId={board.id} onPick={setPick}>
        <button type="button" className="tb-tab tb-tab-end" aria-pressed={names} onClick={() => setNames(v => !v)}>
          <Type size={15} aria-hidden="true" /> Names
        </button>
      </BoardTabs>
      <BoardPitch pitchRef={pitchRef} board={board} discs={discs} names={names} primaryColor={primaryColor} />
      <p className="tb-player-note"><small>From the coach · {board.name}</small>{board.note || 'No note for this board.'}</p>
      {LINE_KEY}
    </div>
  );
}

// ---- The downloaded image: the same drawing on a pitch drawn in SVG ----

const IMG = { w: 450, pad: 15, top: 62 };
const PW = IMG.w - IMG.pad * 2, PH = Math.round(PW * 13 / 9);
function wrapNote(note: string): string[] {
  const lines: string[] = [];
  for (const word of note.replace(/\s+/g, ' ').trim().split(' ')) {
    const last = lines[lines.length - 1];
    if (last !== undefined && (last + ' ' + word).length <= 62) lines[lines.length - 1] = last + ' ' + word;
    else if (word) lines.push(word);
  }
  return lines.slice(0, 6);
}
function BoardImage({ board, discs, names, title, primaryColor }: { board: Board; discs: Disc[]; names: boolean; title: string; primaryColor: string }) {
  const note = wrapNote(board.note);
  const noteH = note.length ? note.length * 18 + 14 : 0;
  const markY = IMG.top + PH + IMG.pad + noteH + 26;
  const height = markY + 24;
  const line = { fill: 'none', stroke: '#fff', strokeOpacity: 0.35, strokeWidth: 2 } as const;
  const font = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={IMG.w} height={height} viewBox={`0 0 ${IMG.w} ${height}`}>
      <rect width={IMG.w} height={height} fill="#0b0f14" />
      <text x={IMG.pad} y={28} fill="#fff" fontFamily={font} fontWeight={800} fontSize={20}>{board.name.trim() || 'Board'}</text>
      <text x={IMG.pad} y={47} fill="#9aa4b2" fontFamily={font} fontWeight={600} fontSize={12}>{title}</text>
      <g transform={`translate(${IMG.pad} ${IMG.top})`}>
        <clipPath id="tb-clip"><rect width={PW} height={PH} rx={12} /></clipPath>
        <g clipPath="url(#tb-clip)">
          <rect width={PW} height={PH} fill="#0f2e1c" />
          {[1, 3, 5, 7, 9].map(i => <rect key={i} y={PH * i / 10} width={PW} height={PH / 10} fill="#133823" />)}
          <path d={`M0 ${PH / 2}H${PW}`} {...line} />
          <circle cx={PW / 2} cy={PH / 2} r={PW * 0.13} {...line} />
          <circle cx={PW / 2} cy={PH / 2} r={4} fill="#fff" fillOpacity={0.6} />
          {[0, 1].map(end => (
            <g key={end} transform={end ? `translate(0 ${PH}) scale(1 -1)` : undefined}>
              <rect x={PW * 0.18} y={-2} width={PW * 0.64} height={PH * 0.16 + 2} {...line} />
              <rect x={PW * 0.32} y={-2} width={PW * 0.36} height={PH * 0.06 + 2} {...line} />
              <circle cx={PW / 2} cy={PH * 0.11} r={3} fill="#fff" fillOpacity={0.6} />
              <path d={`M${PW * 0.41} ${PH * 0.16}A${PW * 0.09} ${PW * 0.09} 0 0 0 ${PW * 0.59} ${PH * 0.16}`} {...line} />
            </g>
          ))}
        </g>
        <rect width={PW} height={PH} rx={12} fill="none" stroke="#fff" strokeOpacity={0.35} strokeWidth={3} />
        <Items items={board.items} pieces={false} w={PW} h={PH} />
        {discs.map(d => (
          <g key={d.id} transform={`translate(${d.at[0] * PW / 100} ${d.at[1] * PH / 100})`}>
            <circle r={16} cy={2} fill="#000" opacity={0.35} />
            <circle r={15} fill={d.gk ? '#F59E0B' : primaryColor} stroke="#fff" strokeOpacity={0.92} strokeWidth={2} />
            <text y={5} textAnchor="middle" fill={d.gk ? '#1a1205' : '#fff'} fontFamily={font} fontWeight={800} fontSize={14}>{d.n > 0 ? d.n : ''}</text>
            {names && (
              <text y={29} textAnchor="middle" fill="#fff" stroke="#080c12" strokeWidth={3} paintOrder="stroke" fontFamily={font} fontWeight={700} fontSize={10}>{d.name}</text>
            )}
          </g>
        ))}
        <Items items={board.items} pieces w={PW} h={PH} />
      </g>
      {note.map((l, i) => (
        <text key={i} x={IMG.pad} y={IMG.top + PH + IMG.pad + 16 + i * 18} fill="#e5e9ef" fontFamily={font} fontSize={13}>{l}</text>
      ))}
      {/* The itsfootball.club mark (the goal and ball from the logo) and name, under a thin rule */}
      <path d={`M${IMG.pad} ${markY - 20}H${IMG.w - IMG.pad}`} stroke="#fff" strokeOpacity={0.12} />
      <g transform={`translate(${IMG.w / 2 - 82} ${markY - 21}) scale(0.085)`}>
        <path d="M64 330V198H448V330" fill="none" stroke="#F8FAFC" strokeWidth={24} />
        <circle cx={99} cy={234} r={21} fill="#10B981" />
        <path d="M128 238 176 260M120 256 152 270" stroke="#10B981" strokeWidth={7} strokeLinecap="round" />
      </g>
      <text x={IMG.w / 2 - 34} y={markY + 6} fill="#fff" fontFamily={font} fontWeight={800} fontSize={14}>itsfootball.club</text>
    </svg>
  );
}

async function downloadBoardImage(props: React.ComponentProps<typeof BoardImage>): Promise<void> {
  // Only loaded when a coach downloads an image
  const { renderToStaticMarkup } = await import('react-dom/server');
  const svg = renderToStaticMarkup(<BoardImage {...props} />).replace(/var\(--font-heading\), /g, '');
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await img.decode();
  const canvas = document.createElement('canvas');
  const scale = 3;
  canvas.width = img.width * scale;
  canvas.height = img.height * scale;
  canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>(done => canvas.toBlob(done, 'image/png'));
  if (!blob) throw new Error('no image');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${props.board.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-board.png`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

// ---- The editor ----

interface TacticsBoardProps {
  boards: Board[];
  onChange: (boards: Board[]) => void;
  /** The line-up on the workbench right now, saved or not */
  positions: PitchPosition[];
  primaryColor: string;
  /** For the downloaded image, e.g. "Riverside FC vs Harbour United" */
  title: string;
  saveState: TacticsSaveState;
  onRetrySave: () => void;
  onNotify?: (text: string, type?: 'success' | 'info' | 'error') => void;
}

const TOOL_GROUPS: { tool: Tool; label: string }[][] = [
  [{ tool: 'move', label: 'Move' }],
  [{ tool: 'run', label: 'Run' }, { tool: 'pass', label: 'Pass' }, { tool: 'dribble', label: 'Dribble' }, { tool: 'pen', label: 'Pen' }, { tool: 'zone', label: 'Zone' }],
  [{ tool: 'ball', label: 'Ball' }, { tool: 'cone', label: 'Cone' }, { tool: 'opp', label: 'Opponent' }],
];

export default function TacticsBoard({ boards, onChange, positions, primaryColor, title, saveState, onRetrySave, onNotify }: TacticsBoardProps) {
  const [pick, setPick] = useState('');
  const [tool, setTool] = useState<Tool>('run');
  const [color, setColor] = useState(BOARD_COLORS[0]);
  // Names crowd a set piece on a phone, so they start off there
  const [names, setNames] = useState(() => typeof window === 'undefined' || window.innerWidth >= 700);
  const [preview, setPreview] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [history, setHistory] = useState<{ undo: Board[][]; redo: Board[][] }>({ undo: [], redo: [] });
  // What a drag in progress looks like; it becomes one step in the history when the finger lifts
  const [live, setLive] = useState<Board[] | null>(null);
  const [draft, setDraft] = useState<BoardItem | null>(null);
  const pitchRef = useRef<HTMLDivElement>(null);
  const stroke = useRef<{ raw: Pt[]; origin: Pt } | null>(null);
  const drag = useRef<{ start: Pt; pid?: string; i?: number; from: Pt | Pt[] } | null>(null);

  const shown = live || boards;
  const board = shown.find(b => b.id === pick) || shown[0];
  const discs = useMemo(() => discsFor(positions, board), [positions, board]);

  const commit = (next: Board[]) => {
    setHistory(h => ({ undo: [...h.undo.slice(-49), boards], redo: [] }));
    onChange(next);
  };
  const changeBoard = (fn: (b: Board) => Board, from: Board[] = boards) => from.map(b => (b.id === board.id ? fn(b) : b));
  const addItem = (item: BoardItem) => {
    if (board.items.length >= MAX_ITEMS) return onNotify?.(`A board holds ${MAX_ITEMS} drawings. Erase one to add another.`, 'info');
    commit(changeBoard(b => ({ ...b, items: [...b.items, item] })));
  };
  const step = (dir: 'undo' | 'redo') => {
    const other = dir === 'undo' ? 'redo' : 'undo';
    const target = history[dir][history[dir].length - 1];
    if (!target) return;
    setHistory(h => ({ ...h, [dir]: h[dir].slice(0, -1), [other]: [...h[other], boards] }));
    onChange(target);
  };

  const pct = (e: React.PointerEvent): Pt => {
    const r = pitchRef.current!.getBoundingClientRect();
    return [(e.clientX - r.left) / r.width * 100, (e.clientY - r.top) / r.height * 100];
  };

  // Drawing: the surface above the players takes the finger for every tool but Move
  const onDrawDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const at = pct(e);
    if (tool === 'erase') {
      const r = pitchRef.current!.getBoundingClientRect();
      const i = hitItem(board.items, at, r.width, r.height);
      if (i >= 0) commit(changeBoard(b => ({ ...b, items: b.items.filter((_, k) => k !== i) })));
      return;
    }
    if (tool === 'ball' || tool === 'cone') return addItem({ t: tool, x: at[0], y: at[1] });
    if (tool === 'opp') return addItem({ t: 'opp', x: at[0], y: at[1], n: board.items.filter(i => i.t === 'opp').length + 1 });
    if (tool === 'move') return;
    e.currentTarget.setPointerCapture(e.pointerId);
    stroke.current = { raw: [at], origin: at };
    setDraft(tool === 'zone' ? { t: 'zone', c: color, x: at[0], y: at[1], w: 0, h: 0 } : { t: tool, c: color, p: [at] });
  };
  const onDrawMove = (e: React.PointerEvent) => {
    const s = stroke.current;
    if (!s || !draft) return;
    const at = pct(e);
    if (draft.t === 'zone') {
      setDraft({ ...draft, x: Math.min(at[0], s.origin[0]), y: Math.min(at[1], s.origin[1]), w: Math.abs(at[0] - s.origin[0]), h: Math.abs(at[1] - s.origin[1]) });
    } else if ('p' in draft) {
      s.raw.push(at);
      // A run reads best as a clean curve; the pen keeps more of the hand
      setDraft({ ...draft, p: s.raw.length > 2 ? simplify(s.raw, draft.t === 'pen' ? 0.5 : 1.6) : [...s.raw] });
    }
  };
  const onDrawEnd = () => {
    const d = draft;
    stroke.current = null;
    setDraft(null);
    if (!d || !pitchRef.current) return;
    const { clientWidth: w, clientHeight: h } = pitchRef.current;
    // A tap or a tiny flick isn't a drawing
    const big = d.t === 'zone'
      ? d.w * w / 100 > 16 && d.h * h / 100 > 16
      : 'p' in d && d.p.length > 1 && Math.hypot((d.p[d.p.length - 1][0] - d.p[0][0]) * w / 100, (d.p[d.p.length - 1][1] - d.p[0][1]) * h / 100) > 18;
    if (big) addItem(d);
  };

  // Move: players and anything drawn
  const onMoveDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (tool !== 'move') return;
    const el = e.target as Element;
    const node = el.closest<HTMLElement>('[data-pid]');
    const piece = el.closest<SVGElement>('[data-i]');
    if (node) {
      const d = discs.find(x => x.id === node.dataset.pid);
      if (d) drag.current = { start: pct(e), pid: d.id, from: d.at };
    } else if (piece) {
      const i = Number(piece.dataset.i), it = board.items[i];
      if (it) drag.current = { start: pct(e), i, from: 'p' in it ? it.p : [it.x, it.y] };
    }
    if (drag.current) e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onMoveMove = (e: React.PointerEvent) => {
    const g = drag.current;
    if (!g) return;
    const at = pct(e), dx = at[0] - g.start[0], dy = at[1] - g.start[1];
    const clamp = (v: number) => Math.max(2, Math.min(98, v));
    setLive(changeBoard(b => {
      if (g.pid) return { ...b, players: { ...b.players, [g.pid]: [clamp((g.from as Pt)[0] + dx), clamp((g.from as Pt)[1] + dy)] } };
      return {
        ...b,
        items: b.items.map((it, k) => {
          if (k !== g.i) return it;
          if ('p' in it) return { ...it, p: (g.from as Pt[]).map((q): Pt => [q[0] + dx, q[1] + dy]) };
          return { ...it, x: (g.from as Pt)[0] + dx, y: (g.from as Pt)[1] + dy };
        }),
      };
    }));
  };
  const onMoveEnd = () => {
    if (drag.current && live) commit(live);
    drag.current = null;
    setLive(null);
  };

  const addBoard = () => {
    const name = (adding || '').trim().slice(0, 30);
    if (!name) return;
    const id = `b-${Date.now().toString(36)}`;
    commit([...boards, { id, name, show: false, note: '', players: {}, items: [] }]);
    setPick(id);
    setAdding(null);
  };

  const [busy, setBusy] = useState(false);
  const download = async () => {
    setBusy(true);
    try {
      await downloadBoardImage({ board, discs, names, title, primaryColor });
    } catch {
      onNotify?.('The image could not be made on this device. Take a screenshot of the board instead.', 'error');
    }
    setBusy(false);
  };

  if (preview) {
    const visible = boards.filter(b => b.show);
    return (
      <div className="tb-root tb-preview">
        <div className="tb-preview-bar" role="status">
          <span>This is what your players see in the club app once the line-up is published.</span>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setPreview(false)}>Back to editing</button>
        </div>
        <div className="admin-panel tb-panel">
          <TacticsBoardView boards={visible} positions={positions} primaryColor={primaryColor} />
        </div>
      </div>
    );
  }

  const lines = board.items.filter(i => 'p' in i).length;
  const pieces = board.items.length - lines;
  const drawing = tool !== 'move';
  return (
    <div className="tb-root lineup-workbench-layout">
      <div className="lineup-workbench-pitch">
        <div className="admin-panel tb-panel">
          <div className="tb-top">
            <span className={saveState === 'error' ? 'admin-pill is-danger' : 'admin-pill'} role="status">
              {saveState === 'error' ? <><AlertTriangle size={12} aria-hidden="true" /> Not saved</>
                : saveState === 'saving' ? 'Saving…'
                : saveState === 'saved' ? <><Check size={12} aria-hidden="true" /> Saved</>
                : 'Saves as you draw'}
            </span>
            {saveState === 'error' && <button type="button" className="btn btn-secondary btn-sm" onClick={onRetrySave}>Try again</button>}
            <div className="tb-history">
              <button type="button" className="admin-icon-btn" onClick={() => step('undo')} disabled={!history.undo.length} aria-label="Undo"><Undo2 size={18} aria-hidden="true" /></button>
              <button type="button" className="admin-icon-btn" onClick={() => step('redo')} disabled={!history.redo.length} aria-label="Redo"><Redo2 size={18} aria-hidden="true" /></button>
              <button type="button" className="admin-icon-btn is-danger" onClick={() => commit(changeBoard(b => ({ ...b, items: [] })))} disabled={!board.items.length} aria-label="Clear this board's drawings" title="Clear this board's drawings"><Trash2 size={18} aria-hidden="true" /></button>
            </div>
          </div>

          <BoardTabs boards={shown} activeId={board.id} onPick={setPick}>
            {adding === null ? (
              boards.length < MAX_BOARDS && (
                <button type="button" className="tb-tab" onClick={() => setAdding('')}><Plus size={16} aria-hidden="true" /> New</button>
              )
            ) : (
              <form className="tb-new" onSubmit={e => { e.preventDefault(); addBoard(); }}>
                <input autoFocus className="form-input" aria-label="Name of the new board" placeholder="e.g. High press" maxLength={30} value={adding}
                  onChange={e => setAdding(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') setAdding(null); }} />
                <button type="submit" className="btn btn-primary btn-sm" disabled={!adding.trim()}>Add</button>
                <button type="button" className="admin-icon-btn" onClick={() => setAdding(null)} aria-label="Cancel"><X size={16} aria-hidden="true" /></button>
              </form>
            )}
          </BoardTabs>

          <div className="tb-tools" role="toolbar" aria-label="Drawing tools">
            {TOOL_GROUPS.map((group, g) => (
              <React.Fragment key={g}>
                {g > 0 && <span className="tb-sep" />}
                <div className="tb-group">
                  {group.map(t => (
                    <button key={t.tool} type="button" className="tb-tool" aria-pressed={tool === t.tool} onClick={() => setTool(t.tool)}>
                      <ToolIcon tool={t.tool} />{t.label}
                    </button>
                  ))}
                </div>
              </React.Fragment>
            ))}
            <span className="tb-sep" />
            <div className="tb-swatches" role="group" aria-label="Line colour">
              {BOARD_COLORS.map((c, i) => (
                <button key={c} type="button" className="tb-swatch" style={{ background: c }} aria-pressed={color === c}
                  aria-label={['White', 'Yellow', 'Blue', 'Pink'][i]}
                  onClick={() => { setColor(c); if (!['run', 'pass', 'dribble', 'pen', 'zone'].includes(tool)) setTool('run'); }} />
              ))}
            </div>
            <span className="tb-sep" />
            <div className="tb-group">
              <button type="button" className="tb-tool" aria-pressed={tool === 'erase'} onClick={() => setTool('erase')}><ToolIcon tool="erase" />Erase</button>
              <button type="button" className="tb-tool" aria-pressed={names} onClick={() => setNames(v => !v)}><Type size={22} aria-hidden="true" />Names</button>
            </div>
          </div>

          <BoardPitch pitchRef={pitchRef} board={board} discs={discs} names={names} draft={draft} primaryColor={primaryColor}
            onPointerDown={onMoveDown} onPointerMove={onMoveMove} onPointerUp={onMoveEnd} onPointerCancel={onMoveEnd}>
            {drawing && (
              <div className={tool === 'erase' ? 'tb-capture is-erase' : 'tb-capture'}
                onPointerDown={onDrawDown} onPointerMove={onDrawMove} onPointerUp={onDrawEnd} onPointerCancel={onDrawEnd} />
            )}
            {!board.items.length && !draft && <div className="tb-hint">{HINT[tool]}</div>}
          </BoardPitch>
        </div>
      </div>

      <div className="lineup-workbench-bench admin-panel tb-side">
        <div>
          <label>
            <span className="form-label" style={{ display: 'block' }}>Board name</span>
            <input className="form-input" maxLength={30} value={board.name} style={{ width: '100%', fontSize: '16px' }}
              onChange={e => onChange(changeBoard(b => ({ ...b, name: e.target.value })))}
              onBlur={e => { if (!e.target.value.trim()) onChange(changeBoard(b => ({ ...b, name: 'Board' }))); }} />
          </label>
          <p className="tb-meta" style={{ marginTop: '6px' }}>
            {board.items.length
              ? `${lines} line${lines === 1 ? '' : 's'}, ${pieces} piece${pieces === 1 ? '' : 's'}`
              : 'Nothing drawn yet. Pick a tool and draw on the pitch.'}
          </p>
          {discs.length === 0 && <p className="tb-meta">No players on the pitch yet. Pick the line-up first and they appear here.</p>}
        </div>
        <label>
          <span className="form-label" style={{ display: 'block' }}>Note for this board</span>
          <textarea className="form-textarea" rows={3} maxLength={MAX_NOTE} placeholder="One or two lines the players will read"
            value={board.note} onChange={e => onChange(changeBoard(b => ({ ...b, note: e.target.value })))} style={{ width: '100%', resize: 'vertical' }} />
        </label>
        {LINE_KEY}
        <div>
          <div className="tb-row">
            <span><b>Show to players</b><small>With the line-up in the club app, once you publish. Only signed-in club members can open it.</small></span>
            <button type="button" className="tb-switch" role="switch" aria-checked={board.show} aria-label={`Show the ${board.name} board to players`}
              onClick={() => commit(changeBoard(b => ({ ...b, show: !b.show })))} />
          </div>
          <div className="tb-row">
            <span><b>Players move on this board</b><small>Each board keeps its own positions. The line-up is not changed.</small></span>
            {Object.keys(board.players).length > 0 && (
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => commit(changeBoard(b => ({ ...b, players: {} })))}>Reset</button>
            )}
          </div>
        </div>
        <div className="tb-actions">
          <button type="button" className="btn btn-secondary row" onClick={() => setPreview(true)}><Eye size={16} aria-hidden="true" /> Preview as player</button>
          <button type="button" className="btn btn-secondary row" onClick={download} disabled={busy}><Download size={16} aria-hidden="true" /> {busy ? 'Making image…' : 'Download image'}</button>
        </div>
        {/* The last board stays: there is always one to draw on. Undo brings a deleted board back. */}
        <button type="button" className="btn btn-secondary btn-sm tb-delete" disabled={boards.length < 2}
          onClick={() => { commit(boards.filter(b => b.id !== board.id)); setPick(''); onNotify?.(`${board.name || 'Board'} deleted. Undo brings it back.`, 'info'); }}>
          <Trash2 size={14} aria-hidden="true" /> Delete this board
        </button>
      </div>
    </div>
  );
}
