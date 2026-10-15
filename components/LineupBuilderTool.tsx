'use client';

// The free lineup builder at /tools/lineup-builder: pick a format and shape, type the names, drag
// players around the pitch and download the graphic. No login and nothing is saved on the server;
// the image is drawn in the browser by the same code as a club's matchday share cards.
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import Link from 'next/link';
import { ArrowRight, Download, ImagePlus, RotateCcw, Share2, X } from 'lucide-react';
import { FORMAT_PRESETS } from '@/components/TacticalPitch';
import { drawMatchCard, type CardFormat } from '@/lib/share-card';
import type { Club, Match, PitchPosition } from '@/lib/supabase/types';
import { juniorPublicName } from '@/lib/teams';

type Format = '5v5' | '7v7' | '9v9' | '11v11';
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

const SHAPES: Record<Format, Record<string, { name: string; coords: Shape }>> = {
  '5v5': FIVE_A_SIDE,
  '7v7': FORMAT_PRESETS['7v7'],
  '9v9': FORMAT_PRESETS['9v9'],
  '11v11': FORMAT_PRESETS['11v11'],
};

const FORMATS: { key: Format; label: string; size: number; word: string }[] = [
  { key: '5v5', label: '5-a-side', size: 5, word: 'FIVE' },
  { key: '7v7', label: '7-a-side', size: 7, word: 'SEVEN' },
  { key: '9v9', label: '9-a-side', size: 9, word: 'NINE' },
  { key: '11v11', label: '11-a-side', size: 11, word: 'XI' },
];

const COLOURS = ['#10B981', '#DC2626', '#2563EB', '#0EA5E9', '#FACC15', '#F97316', '#7C3AED', '#E5E7EB'];

interface Player { name: string; number: string }
interface State {
  format: Format;
  shape: string;
  coords: Shape;
  players: Player[];
  captain: number;
  team: string;
  opponent: string;
  competition: string;
  colour: string;
  size: CardFormat;
}

const STORAGE_KEY = 'ifc-lineup-builder';

function fresh(format: Format, shape?: string, players: Player[] = []): State {
  const key = shape && SHAPES[format][shape] ? shape : Object.keys(SHAPES[format])[0];
  const coords = SHAPES[format][key].coords.map(c => ({ position: c.position, x: c.x, y: c.y }));
  return {
    format,
    shape: key,
    coords,
    players: coords.map((_, i) => players[i] || { name: '', number: String(i + 1) }),
    captain: -1,
    team: '',
    opponent: '',
    competition: '',
    colour: COLOURS[0],
    size: 'post',
  };
}

const clamp = (n: number) => Math.min(96, Math.max(4, n));

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '';
  return (parts[0].charAt(0) + (parts.length > 1 ? parts[parts.length - 1].charAt(0) : '')).toUpperCase();
}

export default function LineupBuilderTool() {
  const [state, setState] = useState<State>(() => fresh('11v11'));
  const [crest, setCrest] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [downloaded, setDownloaded] = useState(false);
  const [canShare, setCanShare] = useState(false);
  const [dragging, setDragging] = useState<number | null>(null);
  const pitchRef = useRef<HTMLDivElement>(null);
  const nameRefs = useRef<(HTMLInputElement | null)[]>([]);
  const loaded = useRef(false);

  // Remember the last lineup in this browser (a convenience only: it works the same without it)
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') as State | null;
      if (saved && SHAPES[saved.format]?.[saved.shape] && saved.coords?.length === saved.players?.length) setState({ ...fresh(saved.format), ...saved });
    } catch { /* storage blocked or corrupt */ }
    loaded.current = true;
    try {
      setCanShare(typeof navigator.canShare === 'function' && navigator.canShare({ files: [new File([''], 'x.png', { type: 'image/png' })] }));
    } catch { /* no file sharing */ }
  }, []);
  useEffect(() => {
    if (!loaded.current) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* storage blocked */ }
  }, [state]);

  const update = (patch: Partial<State>) => { setState(s => ({ ...s, ...patch })); setDownloaded(false); };
  const setFormat = (format: Format) => {
    if (format === state.format) return;
    const next = fresh(format, undefined, state.players);
    update({ format, shape: next.shape, coords: next.coords, players: next.players, captain: state.captain < next.players.length ? state.captain : -1 });
  };
  const setShape = (shape: string) => update({ shape, coords: fresh(state.format, shape).coords });
  const setPlayer = (i: number, patch: Partial<Player>) =>
    update({ players: state.players.map((p, j) => (j === i ? { ...p, ...patch } : p)) });

  // Dragging a player: the pitch is vertical, so left is across (y) and top runs from their goal down to ours (x)
  const move = (i: number, e: ReactPointerEvent) => {
    const rect = pitchRef.current?.getBoundingClientRect();
    if (!rect) return;
    const y = clamp(((e.clientX - rect.left) / rect.width) * 100);
    const x = clamp(100 - ((e.clientY - rect.top) / rect.height) * 100);
    setState(s => ({ ...s, coords: s.coords.map((c, j) => (j === i ? { ...c, x, y } : c)) }));
  };

  const pickCrest = (file: File | undefined) => {
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => { setCrest(typeof reader.result === 'string' ? reader.result : null); setDownloaded(false); };
    reader.readAsDataURL(file);
  };

  const size = FORMATS.find(f => f.key === state.format)!;
  const fileName = `${(state.team.trim() || 'lineup').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'lineup'}-starting-${size.word.toLowerCase()}.png`;

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
      home_formation: state.shape,
      home_lineup_coords: lineup,
      competition: state.competition.trim(),
      match_date: '',
    } as unknown as Match;
    return drawMatchCard(match, club, 'lineup', 'Made at itsfootball.club', { format: state.size, headline: ['STARTING', size.word] });
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
          await navigator.share({ files: [file], title: `${state.team.trim() || 'Our'} starting ${size.word === 'XI' ? 'XI' : size.word.toLowerCase()}` });
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
    <div className="lineup-tool">
      {/* The pitch */}
      <div className="lineup-tool-pitch-col">
        <div
          ref={pitchRef}
          className="tactical-pitch tactical-pitch-vertical lineup-tool-pitch"
          onPointerUp={() => setDragging(null)}
          onPointerCancel={() => setDragging(null)}
          aria-label="Lineup pitch. Drag a player to move them."
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
                className={`pitch-player-node ${dragging === i ? 'is-dragging' : ''}`}
                style={{ left: `${c.y}%`, top: `${100 - c.x}%` }}
                role="button"
                tabIndex={0}
                aria-label={`${p.name.trim() || `Empty ${c.position}`}${p.number ? `, number ${p.number}` : ''}. Drag to move, or press Enter to edit the name.`}
                onPointerDown={e => { e.currentTarget.setPointerCapture?.(e.pointerId); setDragging(i); }}
                onPointerMove={e => dragging === i && move(i, e)}
                onPointerUp={() => setDragging(null)}
                onDoubleClick={() => nameRefs.current[i]?.focus()}
                onKeyDown={e => {
                  if (e.key === 'Enter') nameRefs.current[i]?.focus();
                  const step = { ArrowUp: [3, 0], ArrowDown: [-3, 0], ArrowLeft: [0, -3], ArrowRight: [0, 3] }[e.key];
                  if (step) {
                    e.preventDefault();
                    setState(s => ({ ...s, coords: s.coords.map((d, j) => (j === i ? { ...d, x: clamp(d.x + step[0]), y: clamp(d.y + step[1]) } : d)) }));
                  }
                }}
              >
                <div
                  className="player-node-circle"
                  style={{
                    position: 'relative', width: 44, height: 44, borderRadius: '50%',
                    background: gk ? 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)' : `linear-gradient(135deg, ${state.colour} 0%, rgba(0,0,0,0.3) 100%), ${state.colour}`,
                    border: p.name.trim() ? '2px solid rgba(255,255,255,0.85)' : '2px dashed rgba(255,255,255,0.65)',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#FFFFFF', fontFamily: 'var(--font-heading)', fontWeight: 900, fontSize: '0.95rem',
                    textShadow: '0 1px 3px rgba(0,0,0,0.8)',
                  }}
                >
                  {initials(p.name) || '+'}
                  {p.number && (
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
                <div className="player-node-name" style={{
                  marginTop: 6, padding: '2px 7px', borderRadius: 5, maxWidth: 96,
                  background: 'rgba(8, 12, 18, 0.88)', border: '1px solid rgba(255,255,255,0.15)',
                  fontSize: '0.7rem', fontWeight: 700, color: p.name.trim() ? '#F8FAFC' : 'rgba(248,250,252,0.6)',
                  textAlign: 'center', lineHeight: 1.15, overflowWrap: 'anywhere',
                }}>
                  {label}
                </div>
              </div>
            );
          })}
        </div>
        <p className="lineup-tool-hint">Drag players to move them. Tap a name in the list to type it.</p>
      </div>

      {/* Controls */}
      <div className="lineup-tool-controls glass-panel">
        <div className="form-group">
          <span className="form-label">Format</span>
          <div className="lineup-tool-pills" role="radiogroup" aria-label="Format">
            {FORMATS.map(f => (
              <button key={f.key} type="button" role="radio" aria-checked={state.format === f.key}
                className={`lineup-tool-pill ${state.format === f.key ? 'is-active' : ''}`} onClick={() => setFormat(f.key)}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="form-row-2">
          <div className="form-group">
            <label className="form-label" htmlFor="lb-shape">Formation</label>
            <select id="lb-shape" className="form-select" value={state.shape} onChange={e => setShape(e.target.value)}>
              {Object.entries(SHAPES[state.format]).map(([key, s]) => <option key={key} value={key}>{s.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="lb-team">Team name</label>
            <input id="lb-team" className="form-input" value={state.team} maxLength={40} placeholder="My Team FC" onChange={e => update({ team: e.target.value })} />
          </div>
        </div>
        <div className="form-row-2">
          <div className="form-group">
            <label className="form-label" htmlFor="lb-opp">Opponent <span className="lineup-tool-optional">(optional)</span></label>
            <input id="lb-opp" className="form-input" value={state.opponent} maxLength={40} placeholder="Rivals United" onChange={e => update({ opponent: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="lb-comp">Competition <span className="lineup-tool-optional">(optional)</span></label>
            <input id="lb-comp" className="form-input" value={state.competition} maxLength={40} placeholder="Sunday League" onChange={e => update({ competition: e.target.value })} />
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="form-label">Players</span>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => update({ coords: fresh(state.format, state.shape).coords })}>
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
                  value={state.players[i].name} onChange={e => setPlayer(i, { name: e.target.value })} />
                <button type="button" className={`lineup-tool-captain ${state.captain === i ? 'is-active' : ''}`}
                  aria-pressed={state.captain === i} aria-label={`Make ${state.players[i].name || c.position} captain`} title="Captain"
                  onClick={() => update({ captain: state.captain === i ? -1 : i })}>C</button>
              </li>
            ))}
          </ol>
        </div>

        <div className="form-group">
          <span className="form-label">Image size</span>
          <div className="lineup-tool-pills" role="radiogroup" aria-label="Image size">
            {([['post', 'Post 4:5'], ['story', 'Story 9:16']] as const).map(([key, label]) => (
              <button key={key} type="button" role="radio" aria-checked={state.size === key}
                className={`lineup-tool-pill ${state.size === key ? 'is-active' : ''}`} onClick={() => update({ size: key })}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="lineup-tool-actions">
          <button type="button" className="btn btn-primary btn-lg" disabled={busy} onClick={() => run(false)}>
            <Download size={18} /> {busy ? 'Drawing…' : 'Download image'}
          </button>
          {canShare && (
            <button type="button" className="btn btn-secondary btn-lg" disabled={busy} onClick={() => run(true)}>
              <Share2 size={18} /> Share
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
