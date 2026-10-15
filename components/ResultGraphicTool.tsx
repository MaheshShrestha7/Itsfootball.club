'use client';

// The free match result & Player of the Match graphic maker at /tools/match-result-graphic-maker: two
// badges, the final score, goalscorers, a Player of the Match and a photo, downloaded as a story,
// post or square image. No login and nothing is uploaded: photos stay on the device and the image is
// drawn in the browser by the same code as a club's matchday share cards (lib/share-card.ts).
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import Link from 'next/link';
import { Kaushan_Script } from 'next/font/google';
import { ArrowRight, Download, ImagePlus, Minus, Plus, Scissors, Share2, Star, Trash2, Undo2, X } from 'lucide-react';
import { CARD_SIZES, drawMatchCard, type CardFormat, type CardOptions } from '@/lib/share-card';
import { COVER_PRESETS } from '@/lib/cover-presets';
import type { Club, Match } from '@/lib/supabase/types';

// The Player of the Match's name is drawn in a brush script, so it stands apart from the bold headline
const nameFont = Kaushan_Script({ subsets: ['latin'], weight: '400', display: 'swap' });

type Side = 'home' | 'away';
type Graphic = 'result' | 'motm';
type GoalKind = 'goal' | 'pen' | 'og';

interface Team { name: string; colour: string; crest: string | null }
interface Goal { name: string; minute: string; kind: GoalKind }

interface State {
  graphic: Graphic;
  size: CardFormat;
  home: Team;
  away: Team;
  /** Whose graphic it is: their badge and colour lead the card */
  us: Side;
  score: [number, number];
  pens: boolean;
  pensScore: [string, string];
  goals: Record<Side, Goal[]>;
  motmName: string;
  motmLine: string;
  /** 'club': the club colour glow; a preset's url; or 'upload' for the user's own photo */
  background: string;
  dim: number;
  competition: string;
  date: string;
  venue: string;
}

const STORAGE_KEY = 'itsfootball-result-graphic';
const COLOURS = ['#DC2626', '#2563EB', '#10B981', '#F59E0B', '#7C3AED', '#0F172A', '#FFFFFF', '#EC4899'];
// The stock photos that suit a result (from the cover presets the site already offers)
const PHOTO_PRESETS = ['Stadium', 'Floodlit Pitch', 'Night Match', 'Pitch', 'Derby Night', 'Match Ball']
  .map(label => COVER_PRESETS.find(p => p.label === label))
  .filter((p): p is (typeof COVER_PRESETS)[number] => !!p);

const SIZES: [CardFormat, string][] = [['story', 'Story 9:16'], ['post', 'Post 4:5'], ['square', 'Square 1:1']];

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fresh(graphic: Graphic): State {
  return {
    graphic,
    size: 'story',
    home: { name: '', colour: '#DC2626', crest: null },
    away: { name: '', colour: '#2563EB', crest: null },
    us: 'home',
    score: [0, 0],
    pens: false,
    pensScore: ['', ''],
    goals: { home: [], away: [] },
    motmName: '',
    motmLine: '',
    background: PHOTO_PRESETS[0]?.url || 'club',
    dim: 0.55,
    competition: '',
    date: today(),
    venue: '',
  };
}

/** '#10B981' -> '16, 185, 129', for the glass tints in the team colour */
const hexRgb = (hex: string) => {
  const n = parseInt(/^#[0-9a-f]{6}$/i.test(hex) ? hex.slice(1) : '10B981', 16);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
};

function initials(name: string) {
  const words = name.trim().split(/\s+/).filter(w => /^[a-z0-9]/i.test(w));
  if (!words.length) return '';
  return (words.length === 1 ? words[0].slice(0, 3) : words.slice(0, 4).map(w => w[0]).join('')).toUpperCase();
}

/** A shield with the team's initials in its colour, for a team with no badge uploaded */
function shield(name: string, colour: string): string {
  const text = initials(name) || '?';
  const light = parseInt(colour.slice(1), 16) > 0xcccccc;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 112"><path d="M50 4 10 18v34c0 27 17 46 40 56 23-10 40-29 40-56V18L50 4Z" fill="${colour}" stroke="${light ? '#0F172A' : '#F8FAFC'}" stroke-width="6" stroke-opacity="0.85"/><text x="50" y="66" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="900" font-size="${text.length > 2 ? 24 : 32}" fill="${light ? '#0F172A' : '#FFFFFF'}">${text.replace(/[<&>]/g, '')}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/** "90+2" -> minute 90, added 2; empty -> no time shown */
function parseMinute(text: string): { minute: number; added_minute?: number } {
  const m = text.trim().match(/^(\d{1,3})(?:\s*\+\s*(\d{1,2}))?/);
  if (!m) return { minute: -1 };
  return { minute: parseInt(m[1], 10), added_minute: m[2] ? parseInt(m[2], 10) : undefined };
}

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

interface Props {
  /** The graphic it opens on (the Player of the Match page opens on that card) */
  defaultGraphic?: Graphic;
}

export default function ResultGraphicTool({ defaultGraphic = 'result' }: Props = {}) {
  const [state, setState] = useState<State>(() => fresh(defaultGraphic));
  // Photos aren't remembered (too big for browser storage); badges are
  const [bgPhoto, setBgPhoto] = useState<string | null>(null);
  const [motmPhoto, setMotmPhoto] = useState<string | null>(null);
  // "Remove background": the cut-out replaces the photo, and the original is kept to put it back
  const [motmOriginal, setMotmOriginal] = useState<string | null>(null);
  const [cutting, setCutting] = useState(false);
  const [cutError, setCutError] = useState('');
  const [focus, setFocus] = useState({ bg: 0.5, motm: 0.3 });
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [downloaded, setDownloaded] = useState(false);
  const [canShare, setCanShare] = useState(false);
  const loaded = useRef(false);
  const drag = useRef<{ y: number; start: number; key: 'bg' | 'motm' } | null>(null);
  const previewRef = useRef<HTMLImageElement>(null);

  // Remember the teams and match details in this browser (a convenience only: it works the same without it)
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') as Partial<State> | null;
      if (saved && typeof saved === 'object') {
        const base = fresh(defaultGraphic);
        setState({
          ...base,
          home: { ...base.home, ...saved.home },
          away: { ...base.away, ...saved.away },
          us: saved.us === 'away' ? 'away' : 'home',
          size: saved.size && saved.size in CARD_SIZES ? saved.size : base.size,
          competition: saved.competition || '',
          venue: saved.venue || '',
          background: saved.background && saved.background !== 'upload' ? saved.background : base.background,
          dim: typeof saved.dim === 'number' ? saved.dim : base.dim,
        });
      }
    } catch { /* storage blocked or corrupt */ }
    loaded.current = true;
    try {
      setCanShare(typeof navigator.canShare === 'function' && navigator.canShare({ files: [new File([''], 'x.png', { type: 'image/png' })] }));
    } catch { /* no file sharing */ }
    // Once on mount: the default is fixed for each page
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!loaded.current) return;
    const { home, away, us, size, competition, venue, background, dim } = state;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ home, away, us, size, competition, venue, background, dim }));
    } catch {
      // Badges too big for storage: keep the rest
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ home: { ...home, crest: null }, away: { ...away, crest: null }, us, size, competition, venue, background, dim })); } catch { /* storage blocked */ }
    }
  }, [state]);

  const update = (patch: Partial<State>) => { setState(s => ({ ...s, ...patch })); setDownloaded(false); };
  const setTeam = (side: Side, patch: Partial<Team>) => update({ [side]: { ...state[side], ...patch } } as Partial<State>);
  const setScore = (i: 0 | 1, n: number) => {
    const score: [number, number] = [...state.score];
    score[i] = Math.max(0, Math.min(99, n));
    update({ score });
  };
  const setGoal = (side: Side, i: number, patch: Partial<Goal>) =>
    update({ goals: { ...state.goals, [side]: state.goals[side].map((g, j) => (j === i ? { ...g, ...patch } : g)) } });
  const addGoal = (side: Side) => update({ goals: { ...state.goals, [side]: [...state.goals[side], { name: '', minute: '', kind: 'goal' }] } });
  const removeGoal = (side: Side, i: number) => update({ goals: { ...state.goals, [side]: state.goals[side].filter((_, j) => j !== i) } });

  const us = state[state.us];
  const homeName = state.home.name.trim() || 'Home Team';
  const awayName = state.away.name.trim() || 'Away Team';
  const background = state.background === 'upload' ? bgPhoto : state.background === 'club' ? null : state.background;

  const render = async (): Promise<Blob> => {
    const events: NonNullable<CardOptions['events']> = (['home', 'away'] as const).flatMap(side =>
      state.goals[side].filter(g => g.name.trim()).map(g => ({
        event_type: g.kind === 'pen' ? 'penalty' as const : 'goal' as const,
        team_side: side,
        player_name: `${g.name.trim()}${g.kind === 'og' ? ' (OG)' : ''}`,
        ...parseMinute(g.minute),
      } as NonNullable<CardOptions['events']>[number])));
    const pens = state.pens && state.pensScore.every(p => p.trim() !== '');
    const match = {
      status: 'completed',
      is_club_home: state.us === 'home',
      home_team_name: homeName,
      away_team_name: awayName,
      home_team_logo: state.home.crest || shield(homeName, state.home.colour),
      away_team_logo: state.away.crest || shield(awayName, state.away.colour),
      home_score: state.score[0],
      away_score: state.score[1],
      home_penalty_score: pens ? parseInt(state.pensScore[0], 10) || 0 : null,
      away_penalty_score: pens ? parseInt(state.pensScore[1], 10) || 0 : null,
      competition: state.competition.trim(),
      venue: state.venue.trim(),
      // Date only: kickoff() shows a date at midnight UTC with a time as that calendar day
      match_date: state.date ? `${state.date}T00:00:00Z` : '',
      match_time: '00:00',
    } as unknown as Match;
    const usName = state.us === 'home' ? homeName : awayName;
    const club = {
      name: usName,
      slug: '',
      primary_color: us.colour,
      secondary_color: us.colour,
      logo_url: us.crest || shield(usName, us.colour),
    } as unknown as Club;
    const motm = state.motmName.trim()
      ? { name: state.motmName.trim(), line: state.motmLine.trim() || undefined, photo: motmPhoto || undefined, focusY: focus.motm, cutout: !!motmOriginal, nameFont: nameFont.style.fontFamily }
      : undefined;
    return drawMatchCard(match, club, state.graphic === 'motm' ? 'motm' : 'score', 'Made at itsfootball.club', {
      format: state.size,
      events,
      motm,
      scorerBalls: true,
      background: background ? { src: background, dim: state.dim, focusY: focus.bg } : undefined,
    });
  };

  // Redraw the preview shortly after each change
  useEffect(() => {
    let cancelled = false;
    let url: string | null = null;
    const t = setTimeout(() => {
      render().then(blob => {
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setPreview(old => { if (old) URL.revokeObjectURL(old); return url; });
      }).catch(() => { /* the download shows any error */ });
    }, 200);
    return () => { cancelled = true; clearTimeout(t); };
    // render reads only state, the photos and the focus
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, bgPhoto, motmPhoto, focus]);

  // Drag the preview up and down to choose which part of the photo shows
  const dragKey: 'bg' | 'motm' | null = state.graphic === 'motm' && motmPhoto && !motmOriginal ? 'motm' : background ? 'bg' : null;
  const onDown = (e: ReactPointerEvent<HTMLImageElement>) => {
    if (!dragKey) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    drag.current = { y: e.clientY, start: focus[dragKey], key: dragKey };
  };
  const onMove = (e: ReactPointerEvent<HTMLImageElement>) => {
    const d = drag.current;
    const h = previewRef.current?.getBoundingClientRect().height;
    if (!d || !h) return;
    const next = Math.min(1, Math.max(0, d.start - ((e.clientY - d.y) / h) * 1.5));
    setFocus(f => ({ ...f, [d.key]: next }));
  };
  const onUp = () => { drag.current = null; };

  const goalsFor = (side: Side) => state.goals[side].filter(g => g.name.trim()).length;
  const mismatch = (['home', 'away'] as const)
    .filter((side, i) => goalsFor(side) > 0 && goalsFor(side) !== state.score[i])
    .map(side => `${side === 'home' ? homeName : awayName} scored ${state.score[side === 'home' ? 0 : 1]}, ${goalsFor(side)} listed`);

  const fileName = state.graphic === 'motm'
    ? `player-of-the-match-${slug(state.motmName) || 'award'}.png`
    : `${slug(homeName) || 'home'}-${state.score[0]}-${state.score[1]}-${slug(awayName) || 'away'}-full-time.png`;

  const run = async (share: boolean) => {
    setBusy(true);
    setError('');
    try {
      const blob = await render();
      const file = new File([blob], fileName, { type: 'image/png' });
      let shared = false;
      if (share && navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: state.graphic === 'motm' ? 'Player of the Match' : `${homeName} ${state.score[0]}–${state.score[1]} ${awayName}` });
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

  // Cut the player out of their photo, on the device (lib/remove-background.ts loads only now)
  const removeBg = async () => {
    if (!motmPhoto) return;
    setCutting(true);
    setCutError('');
    try {
      const { removeBackground } = await import('@/lib/remove-background');
      const cut = await removeBackground(motmPhoto);
      setMotmOriginal(motmPhoto);
      setMotmPhoto(cut);
      setDownloaded(false);
    } catch (e) {
      console.error('Remove background failed', e);
      const reason = e instanceof Error ? e.message : String(e);
      // Our own messages are written for people; anything else is kept short so it can be reported
      setCutError(reason.startsWith('Could not') ? reason : `Could not remove the background on this device. The photo still works as it is. (Details: ${reason.slice(0, 140)})`);
    } finally {
      setCutting(false);
    }
  };

  const pickCrest = async (side: Side, file: File | undefined) => {
    if (!file) return;
    const crest = await readImage(file, 400, 'image/png');
    if (crest) setTeam(side, { crest });
  };

  const teamCard = (side: Side) => {
    const team = state[side];
    const name = side === 'home' ? homeName : awayName;
    return (
      <div className={`rg-team ${state.us === side ? 'is-us' : ''}`}>
        <div className="rg-crest">
          <label title="Add badge">
            <img src={team.crest || shield(name, team.colour)} alt={`${name} badge`} />
            <input type="file" accept="image/*" hidden onChange={e => { pickCrest(side, e.target.files?.[0]); e.target.value = ''; }} />
            <span className="rg-crest-edit" aria-hidden="true"><ImagePlus size={12} /></span>
          </label>
          {team.crest && (
            <button type="button" className="rg-crest-remove" aria-label={`Remove ${name} badge`} onClick={() => setTeam(side, { crest: null })}><X size={11} /></button>
          )}
        </div>
        <input className="form-input" value={team.name} maxLength={36} placeholder={side === 'home' ? 'Home team' : 'Away team'}
          aria-label={side === 'home' ? 'Home team name' : 'Away team name'} autoComplete="off" onChange={e => setTeam(side, { name: e.target.value })} />
        <div className="rg-team-colours">
          {COLOURS.map(c => (
            <button key={c} type="button" aria-label={`${side === 'home' ? 'Home' : 'Away'} colour ${c}`} aria-pressed={team.colour === c}
              className={`rg-swatch ${team.colour === c ? 'is-active' : ''}`} style={{ background: c }} onClick={() => setTeam(side, { colour: c })} />
          ))}
          <label className="rg-swatch rg-swatch-custom" title="Pick any colour">
            <input type="color" value={team.colour} aria-label={`Pick any ${side} colour`} onChange={e => setTeam(side, { colour: e.target.value.toUpperCase() })} />
          </label>
        </div>
        <button type="button" className={`rg-us ${state.us === side ? 'is-active' : ''}`} aria-pressed={state.us === side} onClick={() => update({ us: side })}>
          {state.us === side ? 'Our team' : 'Make this our team'}
        </button>
      </div>
    );
  };

  return (
    <div className="lineup-tool rg-tool" style={{ '--lb-rgb': hexRgb(us.colour) } as CSSProperties}>
      <div className="lineup-tool-pitch-col lineup-tool-glass rg-preview">
        <div className={`rg-preview-wrap is-${state.size}`}>
          {preview
            ? <img ref={previewRef} src={preview} alt="Preview of your graphic" draggable={false}
              className={dragKey ? 'is-draggable' : ''} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} />
            : <div className="rg-preview-empty" />}
        </div>
        <p className="lineup-tool-hint">{dragKey ? 'Live preview. Drag it up or down to move the photo.' : 'Live preview of your graphic.'}</p>
      </div>

      <div className="lineup-tool-controls lineup-tool-glass">
        <h2 className="lineup-tool-section">Graphic</h2>
        <div className="lineup-tool-segment" role="radiogroup" aria-label="Graphic" style={{ marginBottom: '0.5rem' }}>
          {([['result', 'Full time'], ['motm', 'Player of the Match']] as const).map(([key, label]) => (
            <button key={key} type="button" role="radio" aria-checked={state.graphic === key}
              className={state.graphic === key ? 'is-active' : ''} onClick={() => update({ graphic: key })}>
              {key === 'motm' && <Star size={13} style={{ marginRight: 4, verticalAlign: '-2px' }} />}{label}
            </button>
          ))}
        </div>
        <div className="lineup-tool-segment" role="radiogroup" aria-label="Image size">
          {SIZES.map(([key, label]) => (
            <button key={key} type="button" role="radio" aria-checked={state.size === key}
              className={state.size === key ? 'is-active' : ''} onClick={() => update({ size: key })}>
              {label}
            </button>
          ))}
        </div>

        <h2 className="lineup-tool-section">Teams</h2>
        <div className="rg-teams">
          {teamCard('home')}
          {teamCard('away')}
        </div>

        <h2 className="lineup-tool-section">Final score</h2>
        <div className="rg-score">
          {([0, 1] as const).map(i => (
            <div key={i} className="rg-score-box">
              <span>{i === 0 ? homeName : awayName}</span>
              <div className="rg-stepper">
                <button type="button" aria-label={`${i === 0 ? 'Home' : 'Away'} score down`} onClick={() => setScore(i, state.score[i] - 1)}><Minus size={18} /></button>
                <input inputMode="numeric" aria-label={`${i === 0 ? 'Home' : 'Away'} score`} value={state.score[i]}
                  onChange={e => setScore(i, parseInt(e.target.value.replace(/\D/g, '') || '0', 10))} />
                <button type="button" aria-label={`${i === 0 ? 'Home' : 'Away'} score up`} onClick={() => setScore(i, state.score[i] + 1)}><Plus size={18} /></button>
              </div>
            </div>
          ))}
        </div>
        <label className="rg-check">
          <input type="checkbox" checked={state.pens} onChange={e => update({ pens: e.target.checked })} /> Decided on penalties
        </label>
        {state.pens && (
          <div className="rg-pens">
            <input className="form-input lineup-tool-num" inputMode="numeric" maxLength={2} aria-label="Home penalties" placeholder="4"
              value={state.pensScore[0]} onChange={e => update({ pensScore: [e.target.value.replace(/\D/g, ''), state.pensScore[1]] })} />
            <span>–</span>
            <input className="form-input lineup-tool-num" inputMode="numeric" maxLength={2} aria-label="Away penalties" placeholder="3"
              value={state.pensScore[1]} onChange={e => update({ pensScore: [state.pensScore[0], e.target.value.replace(/\D/g, '')] })} />
            <small>on pens</small>
          </div>
        )}

        <h2 className="lineup-tool-section">Goalscorers <span className="lineup-tool-optional">(optional)</span></h2>
        <div className="rg-goals">
          {(['home', 'away'] as const).map(side => (
            <div key={side}>
              <h3><span className="rg-dot" style={{ background: state[side].colour }} />{side === 'home' ? homeName : awayName}</h3>
              {state.goals[side].map((g, i) => (
                <div key={i} className="rg-goal">
                  <input className="form-input" value={g.name} maxLength={28} placeholder="Scorer" aria-label="Scorer" autoComplete="off"
                    autoFocus={!g.name && i === state.goals[side].length - 1} onChange={e => setGoal(side, i, { name: e.target.value })} />
                  <input className="form-input lineup-tool-num" value={g.minute} maxLength={6} placeholder="Min" aria-label="Minute" inputMode="text"
                    onChange={e => setGoal(side, i, { minute: e.target.value.replace(/[^\d+]/g, '') })} />
                  <button type="button" className={`rg-chip ${g.kind === 'pen' ? 'is-active' : ''}`} aria-pressed={g.kind === 'pen'} title="Penalty"
                    onClick={() => setGoal(side, i, { kind: g.kind === 'pen' ? 'goal' : 'pen' })}>P</button>
                  <button type="button" className={`rg-chip ${g.kind === 'og' ? 'is-active' : ''}`} aria-pressed={g.kind === 'og'} title="Own goal (type the opposition player's name)"
                    onClick={() => setGoal(side, i, { kind: g.kind === 'og' ? 'goal' : 'og' })}>OG</button>
                  <button type="button" className="rg-remove" aria-label="Remove goal" onClick={() => removeGoal(side, i)}><Trash2 size={14} /></button>
                </div>
              ))}
              <button type="button" className="rg-add" onClick={() => addGoal(side)}><Plus size={14} /> Add goal</button>
            </div>
          ))}
        </div>
        {mismatch.length > 0 && <p className="rg-warn">{mismatch.join(' · ')}. That&apos;s fine if you&apos;re leaving some out.</p>}

        <h2 className="lineup-tool-section">Player of the Match <span className="lineup-tool-optional">{state.graphic === 'motm' ? '' : '(optional)'}</span></h2>
        <div className="rg-motm">
          <label className="rg-photo" title="Add their photo" style={motmPhoto ? { backgroundImage: `url(${motmPhoto})` } : undefined}>
            {!motmPhoto && <ImagePlus size={20} />}
            <input type="file" accept="image/*" hidden onChange={async e => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (!f) return;
              setMotmPhoto(await readImage(f, 1600, 'image/jpeg'));
              setMotmOriginal(null);
              setCutError('');
              setDownloaded(false);
            }} />
          </label>
          <div>
            <input className="form-input" value={state.motmName} maxLength={30} placeholder="Player's name" aria-label="Player of the Match name" autoComplete="off"
              onChange={e => update({ motmName: e.target.value })} />
            <input className="form-input" value={state.motmLine} maxLength={40} placeholder="2 goals · 1 assist (optional)" aria-label="A short line about their game" autoComplete="off"
              onChange={e => update({ motmLine: e.target.value })} style={{ marginTop: '0.4rem' }} />
          </div>
        </div>
        {motmPhoto && (
          <div className="rg-photo-actions">
            {motmOriginal ? (
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setMotmPhoto(motmOriginal); setMotmOriginal(null); setDownloaded(false); }}>
                <Undo2 size={14} /> Put the background back
              </button>
            ) : (
              <button type="button" className="btn btn-secondary btn-sm" disabled={cutting} onClick={removeBg}>
                <Scissors size={14} /> {cutting ? 'Cutting out…' : 'Remove background'}
              </button>
            )}
            <button type="button" className="rg-link" onClick={() => { setMotmPhoto(null); setMotmOriginal(null); setCutError(''); setDownloaded(false); }}>Remove photo</button>
          </div>
        )}
        {cutting && <p className="rg-note">The first time, this downloads about 12 MB to your phone. The photo itself never leaves it.</p>}
        {cutError && <p role="alert" className="rg-warn">{cutError}</p>}
        <p className="rg-note">
          {state.graphic === 'motm'
            ? 'A photo of them in their kit, from the chest up, works best. Without one the card shows their initials.'
            : 'Shows as a row on the result. Choose Player of the Match above for a card of its own.'}
        </p>

        <h2 className="lineup-tool-section">Background</h2>
        <div className="rg-bgs" role="radiogroup" aria-label="Background">
          <button type="button" role="radio" aria-checked={state.background === 'club'} className={`rg-bg ${state.background === 'club' ? 'is-active' : ''}`}
            style={{ background: `radial-gradient(circle at 30% 0%, ${us.colour}, #070B12 75%)` }} onClick={() => update({ background: 'club' })}>
            <span>Team colour</span>
          </button>
          {PHOTO_PRESETS.map(p => (
            <button key={p.url} type="button" role="radio" aria-checked={state.background === p.url} className={`rg-bg ${state.background === p.url ? 'is-active' : ''}`}
              style={{ backgroundImage: `url(${p.thumb})` }} onClick={() => update({ background: p.url })}>
              <span>{p.label}</span>
            </button>
          ))}
          <label className={`rg-bg rg-bg-upload ${state.background === 'upload' ? 'is-active' : ''}`} style={bgPhoto ? { backgroundImage: `url(${bgPhoto})` } : undefined}>
            {!bgPhoto && <ImagePlus size={18} />}
            <span>Your photo</span>
            <input type="file" accept="image/*" hidden onChange={async e => {
              const f = e.target.files?.[0];
              e.target.value = '';
              const src = f ? await readImage(f, 1920, 'image/jpeg') : null;
              if (src) { setBgPhoto(src); update({ background: 'upload' }); }
            }} />
          </label>
        </div>
        {background && (
          <label className="rg-range">
            <span>Darkness</span>
            <input type="range" min={0.25} max={0.85} step={0.05} value={state.dim} onChange={e => update({ dim: parseFloat(e.target.value) })} />
          </label>
        )}
        {state.graphic === 'motm' && motmPhoto && (
          <p className="rg-note">{motmOriginal ? 'The cut-out player stands in front of this background.' : 'On this card the player’s photo is the background. Remove its background above to stand them in front of one of these.'}</p>
        )}

        <h2 className="lineup-tool-section">Match details <span className="lineup-tool-optional">(optional)</span></h2>
        <div className="lineup-tool-row">
          <div className="form-group">
            <label className="form-label" htmlFor="rg-comp">Competition</label>
            <input id="rg-comp" className="form-input" value={state.competition} maxLength={32} placeholder="Sunday League" autoComplete="off"
              onChange={e => update({ competition: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="rg-date">Date</label>
            <input id="rg-date" type="date" className="form-input" value={state.date} onChange={e => update({ date: e.target.value })} />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="rg-venue">Ground</label>
          <input id="rg-venue" className="form-input" value={state.venue} maxLength={48} placeholder="Craik Park, Austral" autoComplete="off"
            onChange={e => update({ venue: e.target.value })} />
        </div>

        {/* Stays in reach at the bottom of the screen on a phone, with a thumbnail of the graphic */}
        <div className="lineup-tool-actions">
          {preview && <img className="rg-thumb" src={preview} alt="" aria-hidden="true" />}
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
          <span>Want this made for you after every game? A free club site posts live scores and builds this graphic from them. </span>
          <Link href="/create-club" className="lineup-tool-prompt-link">
            Launch your free club site <ArrowRight size={15} />
          </Link>
        </div>
      </div>
    </div>
  );
}
