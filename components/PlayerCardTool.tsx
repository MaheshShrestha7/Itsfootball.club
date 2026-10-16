'use client';

// The free football player card maker at /tools/player-card-maker: a player's photo, rating, position and
// season stats on a collectible-style card, as a Standard card in one of six finishes or a special card type
// (Team of the Week, Player of the Month, Levelled Up and more), downloaded as the card alone (a
// see-through PNG) or on a story, post or square. No login and nothing is uploaded: the photo stays on the
// device, its background is removed there (lib/remove-background.ts) and the card is drawn in the browser
// (lib/player-card.ts).
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import Link from 'next/link';
import { ArrowRight, Download, ImagePlus, Lock, Scissors, Share2, Undo2, X } from 'lucide-react';
import {
  CARD_TYPES, KEEPER_STATS, MAX_SHOWN_STATS, OUTFIELD_STATS, PLAYER_CARD_SIZES, PLAYER_STATS, POSITIONS, autoRating, cardAccent, drawPlayerCard,
  type PlayerCardFinish, type PlayerCardSize, type PlayerCardType, type PlayerStatKey,
} from '@/lib/player-card';

type Foot = '' | 'R' | 'L' | 'LR';

interface State {
  size: PlayerCardSize;
  type: PlayerCardType;
  /** Each card type's detail (the round, the month...), kept while switching between types */
  details: Partial<Record<PlayerCardType, string>>;
  finish: PlayerCardFinish;
  name: string;
  position: string;
  alt1: string;
  alt2: string;
  foot: Foot;
  number: string;
  nation: string;
  ratingMode: 'auto' | 'own';
  ownRating: string;
  stats: Partial<Record<PlayerStatKey, string>>;
  shown: PlayerStatKey[];
  club: string;
  season: string;
  colour: string;
  crest: string | null;
}

const STORAGE_KEY = 'itsfootball-player-card';
const COLOURS = ['#DC2626', '#2563EB', '#10B981', '#F59E0B', '#7C3AED', '#0F172A', '#FFFFFF', '#EC4899'];

const SIZES: [PlayerCardSize, string][] = [['card', 'Card'], ['story', 'Story 9:16'], ['post', 'Post 4:5'], ['square', 'Square 1:1']];

const FINISHES: { key: PlayerCardFinish; label: string; swatch: string }[] = [
  { key: 'blackgold', label: 'Black gold', swatch: 'linear-gradient(160deg, #2A2A2C, #0B0B0C)' },
  { key: 'club', label: 'Club', swatch: '' },
  { key: 'gold', label: 'Gold', swatch: 'linear-gradient(160deg, #F7DC8E, #A97A1F)' },
  { key: 'silver', label: 'Silver', swatch: 'linear-gradient(160deg, #F2F5F8, #8995A6)' },
  { key: 'bronze', label: 'Bronze', swatch: 'linear-gradient(160deg, #E8AE7C, #6E3A1A)' },
  { key: 'inform', label: 'In form', swatch: 'linear-gradient(160deg, #1B2944, #05070C)' },
];

const FEET: [Foot, string][] = [['', 'Not shown'], ['R', 'Right'], ['L', 'Left'], ['LR', 'Both']];

const statDefaults = (position: string) => [...(position === 'GK' ? KEEPER_STATS : OUTFIELD_STATS)];

function fresh(position: string): State {
  return {
    size: 'card',
    type: 'standard',
    details: {},
    finish: 'blackgold',
    name: '',
    position,
    alt1: '',
    alt2: '',
    foot: '',
    number: '',
    nation: '',
    ratingMode: 'auto',
    ownRating: '',
    stats: {},
    shown: statDefaults(position),
    club: '',
    season: String(new Date().getFullYear()),
    colour: '#DC2626',
    crest: null,
  };
}

/** '#10B981' -> '16, 185, 129', for the glass tints in the card's colour */
const hexRgb = (hex: string) => {
  const n = parseInt(/^#[0-9a-f]{6}$/i.test(hex) ? hex.slice(1) : '10B981', 16);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
};

/** A picked image, shrunk to `max` px on its longest side so it stays light (and fits in browser storage for badges) */
function readImage(file: File, max: number, type: 'image/png' | 'image/jpeg'): Promise<string | null> {
  return new Promise(resolve => {
    if (!file.type.startsWith('image/')) return resolve(null);
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(img.naturalWidth * scale));
      c.height = Math.max(1, Math.round(img.naturalHeight * scale));
      c.getContext('2d')?.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL(type, 0.9));
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const num = (s: string | undefined) => (s && /^\d+$/.test(s) ? parseInt(s, 10) : undefined);

interface Props {
  /** The position it opens on (the goalkeeper card page opens on GK, with clean sheets and saves) */
  defaultPosition?: string;
  /** The finish it opens on */
  defaultFinish?: PlayerCardFinish;
  /** The card type it opens on (the Team of the Week page opens on Team of the Week) */
  defaultType?: PlayerCardType;
}

export default function PlayerCardTool({ defaultPosition = 'ST', defaultFinish, defaultType }: Props = {}) {
  const [state, setState] = useState<State>(() => ({
    ...fresh(defaultPosition), ...(defaultFinish ? { finish: defaultFinish } : {}), ...(defaultType ? { type: defaultType } : {}),
  }));
  // The photo isn't remembered (too big for browser storage, and it's theirs); the rest is
  const [photo, setPhoto] = useState<string | null>(null);
  // "Remove background": the cut-out replaces the photo, and the original is kept to put it back
  const [original, setOriginal] = useState<string | null>(null);
  const [cutting, setCutting] = useState(false);
  const [cutError, setCutError] = useState('');
  const [frame, setFrame] = useState({ x: 0, y: 0, zoom: 1 });
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [downloaded, setDownloaded] = useState(false);
  const [canShare, setCanShare] = useState(false);
  const loaded = useRef(false);
  const drag = useRef<{ x: number; y: number; fx: number; fy: number } | null>(null);
  const previewRef = useRef<HTMLImageElement>(null);

  // Remember the player and club in this browser (a convenience only: it works the same without it)
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') as Partial<State> | null;
      if (saved && typeof saved === 'object') {
        const base = fresh(defaultPosition);
        // A format page's own position wins over what was saved, so the goalkeeper page opens on a keeper
        const position = defaultPosition !== 'ST' ? defaultPosition : (POSITIONS as readonly string[]).includes(saved.position || '') ? saved.position! : base.position;
        const shown = Array.isArray(saved.shown) && position === saved.position
          ? saved.shown.filter(k => PLAYER_STATS.some(s => s.key === k)).slice(0, MAX_SHOWN_STATS)
          : statDefaults(position);
        setState({
          ...base,
          ...saved,
          position,
          shown,
          size: saved.size && saved.size in PLAYER_CARD_SIZES ? saved.size : base.size,
          finish: defaultFinish || (FINISHES.some(f => f.key === saved.finish) ? saved.finish! : base.finish),
          type: defaultType || (CARD_TYPES.some(t => t.key === saved.type) ? saved.type! : base.type),
          details: saved.details && typeof saved.details === 'object' ? saved.details : {},
          stats: saved.stats && typeof saved.stats === 'object' ? saved.stats : {},
        });
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
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Badge too big for storage: keep the rest
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, crest: null })); } catch { /* storage blocked */ }
    }
  }, [state]);

  const update = (patch: Partial<State>) => { setState(s => ({ ...s, ...patch })); setDownloaded(false); };

  const statNumbers = Object.fromEntries(PLAYER_STATS.map(s => [s.key, num(state.stats[s.key])])) as Partial<Record<PlayerStatKey, number>>;
  const auto = autoRating(statNumbers, state.position);
  const own = num(state.ownRating);
  const rating = state.ratingMode === 'own' && own !== undefined ? Math.min(99, Math.max(1, own)) : auto;

  const setPosition = (position: string) => {
    // Keepers and outfield players show different stats: switch to that set when crossing over
    const wasKeeper = state.position === 'GK';
    update({ position, ...(wasKeeper !== (position === 'GK') ? { shown: statDefaults(position) } : {}) });
  };

  const toggleStat = (key: PlayerStatKey) => {
    if (state.shown.includes(key)) update({ shown: state.shown.filter(k => k !== key) });
    else if (state.shown.length < MAX_SHOWN_STATS) update({ shown: [...state.shown, key] });
  };

  const cardType = CARD_TYPES.find(t => t.key === state.type) || CARD_TYPES[0];
  const detail = state.details[state.type] ?? '';

  const render = () => drawPlayerCard({
    type: state.type,
    detail,
    finish: state.finish,
    colour: state.colour,
    name: state.name,
    rating,
    position: state.position,
    altPositions: [state.alt1, state.alt2].filter(p => p && p !== state.position),
    foot: state.foot,
    number: state.number,
    nation: state.nation,
    club: state.club,
    season: state.season,
    crest: state.crest,
    stats: state.shown
      .filter(k => (state.stats[k] ?? '') !== '')
      .map(k => ({ short: PLAYER_STATS.find(s => s.key === k)!.short, value: state.stats[k]! })),
    photo: photo ? { src: photo, cutout: !!original, zoom: frame.zoom, x: frame.x, y: frame.y } : null,
  }, state.size);

  // Redraw the preview shortly after each change
  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(() => {
      render().then(blob => {
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        setPreview(old => { if (old) URL.revokeObjectURL(old); return url; });
      }).catch(() => { /* the download shows any error */ });
    }, 150);
    return () => { cancelled = true; clearTimeout(t); };
    // render reads only state, the photo and its frame
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, photo, original, frame]);

  // Drag the preview to move the photo: pixels on screen become design-box units on the card
  const onDown = (e: ReactPointerEvent<HTMLImageElement>) => {
    if (!photo) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, fx: frame.x, fy: frame.y };
  };
  const onMove = (e: ReactPointerEvent<HTMLImageElement>) => {
    const d = drag.current;
    const rect = previewRef.current?.getBoundingClientRect();
    if (!d || !rect?.width) return;
    const { w, k } = PLAYER_CARD_SIZES[state.size];
    const unit = w / k / rect.width;
    setFrame(f => ({
      ...f,
      x: Math.max(-200, Math.min(200, d.fx + (e.clientX - d.x) * unit)),
      y: Math.max(-200, Math.min(200, d.fy + (e.clientY - d.y) * unit)),
    }));
  };
  const onUp = () => { drag.current = null; };

  const fileName = `${state.type === 'standard' ? 'player-card' : slug(cardType.label)}-${slug(state.name) || 'football'}${state.size === 'card' ? '' : `-${state.size}`}.png`;

  const run = async (share: boolean) => {
    setBusy(true);
    setError('');
    try {
      const blob = await render();
      const file = new File([blob], fileName, { type: 'image/png' });
      let shared = false;
      if (share && navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: state.name.trim() ? `${state.name.trim()}'s player card` : 'My player card' });
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

  const resetFrame = () => setFrame({ x: 0, y: 0, zoom: 1 });

  // Cut the player out of their photo, on the device (lib/remove-background.ts loads only now)
  const removeBg = async () => {
    if (!photo) return;
    setCutting(true);
    setCutError('');
    try {
      const { removeBackground } = await import('@/lib/remove-background');
      const cut = await removeBackground(photo);
      setOriginal(photo);
      setPhoto(cut);
      resetFrame();
      setDownloaded(false);
    } catch (e) {
      console.error('Remove background failed', e);
      const reason = e instanceof Error ? e.message : String(e);
      setCutError(reason.startsWith('Could not') ? reason : `Could not remove the background on this device. The photo still works as it is. (Details: ${reason.slice(0, 140)})`);
    } finally {
      setCutting(false);
    }
  };

  const pickPhoto = async (file: File | undefined) => {
    if (!file) return;
    const src = await readImage(file, 1600, 'image/jpeg');
    if (!src) return;
    setPhoto(src);
    setOriginal(null);
    setCutError('');
    resetFrame();
    setDownloaded(false);
  };

  const pickCrest = async (file: File | undefined) => {
    if (!file) return;
    const crest = await readImage(file, 400, 'image/png');
    if (crest) update({ crest });
  };

  const accent = state.type === 'standard'
    ? (state.finish === 'club' ? state.colour : state.finish === 'inform' ? '#10B981' : '#D9AE4A')
    : cardAccent({ type: state.type, finish: state.finish, colour: state.colour });

  return (
    <div className="lineup-tool rg-tool pc-tool" style={{ '--lb-rgb': hexRgb(accent) } as CSSProperties}>
      <div className="lineup-tool-pitch-col lineup-tool-glass rg-preview">
        <div className={`rg-preview-wrap pc-preview-wrap is-${state.size}`}>
          {preview
            ? <img ref={previewRef} src={preview} alt="Preview of your player card" draggable={false}
              className={photo ? 'is-draggable' : ''} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} />
            : <div className="rg-preview-empty" />}
        </div>
        <p className="lineup-tool-hint">{photo ? 'Live preview. Drag it to move the photo.' : 'Live preview of your card.'}</p>
      </div>

      <div className="lineup-tool-controls lineup-tool-glass">
        {/* Up front, before anything is added: the photo and badge never leave the device */}
        <p className="lineup-tool-privacy">
          <Lock size={14} aria-hidden="true" />
          <span><strong>Private by design.</strong> All photos you upload stay on your device. They are processed in your browser and never uploaded to or stored on our server.</span>
        </p>

        <h2 className="lineup-tool-section">Image</h2>
        <div className="lineup-tool-segment" role="radiogroup" aria-label="Image size">
          {SIZES.map(([key, label]) => (
            <button key={key} type="button" role="radio" aria-checked={state.size === key}
              className={state.size === key ? 'is-active' : ''} onClick={() => update({ size: key })}>
              {label}
            </button>
          ))}
        </div>
        <p className="rg-note">{state.size === 'card' ? 'Card downloads just the card, with a see-through background, for stickers and chats.' : 'The card on a dark background, ready to post.'}</p>

        <h2 className="lineup-tool-section">Card type</h2>
        <div className="pc-types" role="radiogroup" aria-label="Card type">
          {CARD_TYPES.map(t => (
            <button key={t.key} type="button" role="radio" aria-checked={state.type === t.key}
              className={`pc-type ${state.type === t.key ? 'is-active' : ''}`} onClick={() => update({ type: t.key })}>
              <img src={`/images/tools/card-types/${t.key}.webp`} alt="" width={64} height={77} loading="lazy" />
              <span>{t.label}</span>
            </button>
          ))}
        </div>
        {cardType.key !== 'standard' && (
          <div className="form-group" style={{ marginTop: '0.7rem' }}>
            <label className="form-label" htmlFor="pc-detail">{cardType.detail} <span className="lineup-tool-optional">(optional)</span></label>
            <input id="pc-detail" className={`form-input ${cardType.key === 'upgrade' ? 'pc-nation' : ''}`} value={detail} placeholder={cardType.placeholder} autoComplete="off"
              inputMode={cardType.key === 'upgrade' ? 'numeric' : undefined} maxLength={cardType.key === 'upgrade' ? 2 : 24}
              onChange={e => update({ details: { ...state.details, [state.type]: cardType.key === 'upgrade' ? e.target.value.replace(/\D/g, '') : e.target.value } })} />
          </div>
        )}
        <p className="rg-note">
          {cardType.key === 'standard'
            ? 'The everyday card, in the finish you pick below.'
            : cardType.key === 'upgrade'
              ? 'Put the rating from before, and the card shows how far it went up.'
              : cardType.key === 'legend'
                ? 'Each type has its own colours and a label above the name. For a legend, put their years at the club, like 2009–2026, as the season.'
                : 'Each type has its own colours and a label above the name.'}
        </p>

        <h2 className="lineup-tool-section">Player</h2>
        <div className="rg-motm">
          <label className="rg-photo pc-photo" title="Add a photo" style={photo ? { backgroundImage: `url(${photo})` } : undefined}>
            {!photo && <ImagePlus size={20} />}
            <input type="file" accept="image/*" hidden onChange={e => { pickPhoto(e.target.files?.[0]); e.target.value = ''; }} />
          </label>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" htmlFor="pc-name">Name on the card</label>
            <input id="pc-name" className="form-input" value={state.name} maxLength={20} placeholder="Shrestha" autoComplete="off"
              onChange={e => update({ name: e.target.value })} />
          </div>
        </div>
        {photo && (
          <div className="rg-photo-actions">
            {original ? (
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setPhoto(original); setOriginal(null); resetFrame(); setDownloaded(false); }}>
                <Undo2 size={14} /> Put the background back
              </button>
            ) : (
              <button type="button" className="btn btn-secondary btn-sm" disabled={cutting} onClick={removeBg}>
                <Scissors size={14} /> {cutting ? 'Cutting out…' : 'Remove background'}
              </button>
            )}
            <button type="button" className="rg-link" onClick={() => { setPhoto(null); setOriginal(null); setCutError(''); resetFrame(); setDownloaded(false); }}>Remove photo</button>
          </div>
        )}
        {photo && (
          <label className="rg-range">
            <span>Zoom</span>
            <input type="range" min={0.6} max={2.5} step={0.05} value={frame.zoom} aria-label="Zoom the photo"
              onChange={e => setFrame(f => ({ ...f, zoom: parseFloat(e.target.value) }))} />
            <button type="button" className="rg-link" style={{ marginTop: 0 }} onClick={resetFrame}>Reset</button>
          </label>
        )}
        {cutting && <p className="rg-note">The first time, this downloads about 12 MB to your phone. The photo itself never leaves it.</p>}
        {cutError && <p role="alert" className="rg-warn">{cutError}</p>}
        <p className="rg-note">
          {photo && !original
            ? 'Tap Remove background so the player stands on the card.'
            : 'A photo from the waist or chest up, in your kit, works best.'}
        </p>

        <div className="lineup-tool-row">
          <div className="form-group">
            <label className="form-label" htmlFor="pc-pos">Position</label>
            <select id="pc-pos" className="form-select" value={state.position} onChange={e => setPosition(e.target.value)}>
              {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="pc-num">Shirt number</label>
            <input id="pc-num" className="form-input" inputMode="numeric" value={state.number} maxLength={2} placeholder="9" autoComplete="off"
              onChange={e => update({ number: e.target.value.replace(/\D/g, '') })} />
          </div>
        </div>
        <div className="lineup-tool-row">
          <div className="form-group">
            <label className="form-label" htmlFor="pc-alt1">Other positions <span className="lineup-tool-optional">(optional)</span></label>
            <div className="pc-pair">
              {(['alt1', 'alt2'] as const).map((key, i) => (
                <select key={key} id={i === 0 ? 'pc-alt1' : undefined} aria-label={`Other position ${i + 1}`} className="form-select" value={state[key]} onChange={e => update({ [key]: e.target.value })}>
                  <option value="">None</option>
                  {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              ))}
            </div>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="pc-foot">Preferred foot</label>
            <select id="pc-foot" className="form-select" value={state.foot} onChange={e => update({ foot: e.target.value as Foot })}>
              {FEET.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="pc-nation">Nation tag <span className="lineup-tool-optional">(3 letters, optional)</span></label>
          <input id="pc-nation" className="form-input pc-nation" value={state.nation} maxLength={3} placeholder="AUS" autoComplete="off"
            onChange={e => update({ nation: e.target.value.replace(/[^a-z]/gi, '').toUpperCase() })} />
        </div>

        <h2 className="lineup-tool-section">Season stats</h2>
        <div className="pc-stats">
          {PLAYER_STATS.map(s => {
            const on = state.shown.includes(s.key);
            const full = !on && state.shown.length >= MAX_SHOWN_STATS;
            return (
              <div key={s.key} className={`pc-stat ${on ? 'is-on' : ''}`}>
                <label htmlFor={`pc-stat-${s.key}`}>{s.label}<b>{s.short}</b></label>
                <input id={`pc-stat-${s.key}`} className="form-input" inputMode="numeric" placeholder="0" value={state.stats[s.key] ?? ''}
                  onChange={e => {
                    const v = e.target.value.replace(/\D/g, '').slice(0, String(s.max).length);
                    update({ stats: { ...state.stats, [s.key]: v === '' ? '' : String(Math.min(s.max, parseInt(v, 10))) } });
                  }} />
                <button type="button" className={`rg-chip ${on ? 'is-active' : ''}`} aria-pressed={on} disabled={full}
                  title={full ? `Up to ${MAX_SHOWN_STATS} stats fit on the card` : on ? 'Shown on the card' : 'Show on the card'}
                  onClick={() => toggleStat(s.key)}>{on ? 'On card' : 'Show'}</button>
              </div>
            );
          })}
        </div>
        <p className="rg-note">Up to {MAX_SHOWN_STATS} stats fit on the card ({state.shown.length} picked). Empty ones are left off. Attendance streak is games in a row turned up for.</p>

        <h2 className="lineup-tool-section">Rating</h2>
        <div className="lineup-tool-segment" role="radiogroup" aria-label="Rating">
          <button type="button" role="radio" aria-checked={state.ratingMode === 'auto'} className={state.ratingMode === 'auto' ? 'is-active' : ''} onClick={() => update({ ratingMode: 'auto' })}>
            Auto from stats: {auto}
          </button>
          <button type="button" role="radio" aria-checked={state.ratingMode === 'own'} className={state.ratingMode === 'own' ? 'is-active' : ''} onClick={() => update({ ratingMode: 'own', ownRating: state.ownRating || String(auto) })}>
            Set my own
          </button>
        </div>
        {state.ratingMode === 'own' && (
          <div className="form-group" style={{ marginTop: '0.6rem' }}>
            <label className="form-label" htmlFor="pc-rating">Rating (1 to 99)</label>
            <input id="pc-rating" className="form-input pc-nation" inputMode="numeric" maxLength={2} value={state.ownRating}
              onChange={e => update({ ownRating: e.target.value.replace(/\D/g, '') })} />
          </div>
        )}

        <h2 className="lineup-tool-section">Club</h2>
        <div className="lineup-tool-row">
          <div className="form-group">
            <label className="form-label" htmlFor="pc-club">Club name</label>
            <input id="pc-club" className="form-input" value={state.club} maxLength={32} placeholder="Riverside Rovers" autoComplete="off"
              onChange={e => update({ club: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="pc-season">Season</label>
            <input id="pc-season" className="form-input" value={state.season} maxLength={9} placeholder="2026" autoComplete="off"
              onChange={e => update({ season: e.target.value })} />
          </div>
        </div>
        <div className="pc-club-row">
          <div className="rg-crest">
            <label title="Add badge">
              {state.crest ? <img src={state.crest} alt="Club badge" /> : <ImagePlus size={20} />}
              <input type="file" accept="image/*" hidden onChange={e => { pickCrest(e.target.files?.[0]); e.target.value = ''; }} />
            </label>
            {state.crest && (
              <button type="button" className="rg-crest-remove" aria-label="Remove badge" onClick={() => update({ crest: null })}><X size={11} /></button>
            )}
          </div>
          <div>
            <span className="form-label" style={{ display: 'block', marginBottom: '0.35rem' }}>Club colour</span>
            <div className="rg-team-colours" style={{ justifyContent: 'flex-start' }}>
              {COLOURS.map(c => (
                <button key={c} type="button" aria-label={`Club colour ${c}`} aria-pressed={state.colour === c}
                  className={`rg-swatch ${state.colour === c ? 'is-active' : ''}`} style={{ background: c }} onClick={() => update({ colour: c })} />
              ))}
              <label className="rg-swatch rg-swatch-custom" title="Pick any colour">
                <input type="color" value={state.colour} aria-label="Pick any club colour" onChange={e => update({ colour: e.target.value.toUpperCase() })} />
              </label>
            </div>
          </div>
        </div>
        <p className="rg-note">The badge sits at the bottom of the card; without one it shows a shield with the club’s initials. The colour is used by the Club finish and the New Signing card.</p>

        {state.type === 'standard' && (
          <>
            <h2 className="lineup-tool-section">Finish</h2>
            <div className="pc-finishes" role="radiogroup" aria-label="Card finish">
              {FINISHES.map(f => (
                <button key={f.key} type="button" role="radio" aria-checked={state.finish === f.key}
                  className={`pc-finish ${state.finish === f.key ? 'is-active' : ''} is-${f.key}`}
                  style={{ background: f.swatch || `linear-gradient(160deg, ${state.colour}, #111)` }} onClick={() => update({ finish: f.key })}>
                  <span>{f.label}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {/* Stays in reach at the bottom of the screen on a phone, with a thumbnail of the card */}
        <div className="lineup-tool-actions">
          {preview && <img className="rg-thumb" src={preview} alt="" aria-hidden="true" />}
          <button type="button" className="btn btn-primary btn-lg" disabled={busy} onClick={() => run(false)}>
            <Download size={18} /> {busy ? 'Drawing…' : state.size === 'card' ? 'Download card' : 'Download image'}
          </button>
          {canShare && (
            <button type="button" className="btn btn-secondary btn-lg" disabled={busy} onClick={() => run(true)} aria-label="Share image">
              <Share2 size={18} /> <span className="lineup-tool-share-label">Share</span>
            </button>
          )}
        </div>
        {error && <p role="alert" style={{ color: 'var(--c-red)', marginTop: '0.6rem', fontSize: '0.85rem' }}>{error}</p>}

        <div className={`lineup-tool-prompt ${downloaded ? 'is-done' : ''}`} role="status">
          {downloaded && <strong className="lineup-tool-prompt-done">Card downloaded. </strong>}
          <span>Want your card to update itself every Saturday as you score? Clubs on itsfootball.club log goals, assists and attendance once, and every player&apos;s stats stay up to date. </span>
          <Link href="/create-club" className="lineup-tool-prompt-link">
            Get your club on itsfootball.club <ArrowRight size={15} />
          </Link>
        </div>
      </div>
    </div>
  );
}
