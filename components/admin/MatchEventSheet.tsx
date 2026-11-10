'use client';

import React, { useState } from 'react';
import type { ClubMember, MatchEvent, MatchEventType } from '@/lib/supabase/types';
import PlayerAvatar from '@/components/PlayerAvatar';
import PlayerSearchSelect from '@/components/PlayerSearchSelect';
import PopupPanel from '@/components/PopupPanel';

type Side = 'home' | 'away';
export type SheetMode = 'goal' | 'card' | 'sub' | 'note';

/** What the Match Centre saves once the popup's Save is pressed */
export interface SheetResult {
  eventType: MatchEventType;
  /** The side the event is logged on (an own goal sits on the scorer's side and counts for the other) */
  side: Side;
  playerName: string;
  assistName?: string;
  detail?: string;
  /** The clock minute, before it's split into minute + stoppage */
  minute: number;
}

interface Props {
  mode: SheetMode;
  /** The event the button stood for: goal / penalty / own_goal, yellow_card / red_card, sub, commentary / whistle */
  initialType: MatchEventType;
  /** Goals: the team the goal counts for. Everything else: the player's team */
  side: Side;
  names: Record<Side, string>;
  /** Each side's own club players; null = an outside team, typed by name */
  squads: Record<Side, ClubMember[] | null>;
  /** Each side's saved line-up (member ids), shown first */
  lineupIds: Record<Side, string[]>;
  /** This match's events, to work out who is on the pitch for a substitution */
  events: MatchEvent[];
  score: Record<Side, number>;
  clockMinute: number;
  maxMinute: number;
  minuteLabel: (minute: number) => string;
  onSave: (result: SheetResult) => void;
  /** Goals only: add to the score without logging a scorer (the old + button) */
  onScoreOnly?: () => void;
  onClose: () => void;
}

interface Pick { id: string; name: string }
const NONE: Pick = { id: '', name: '' };
const other = (s: Side): Side => (s === 'home' ? 'away' : 'home');
const byShirt = (a: ClubMember, b: ClubMember) =>
  (a.jersey_number || 999) - (b.jersey_number || 999) || a.full_name.localeCompare(b.full_name);
const shortName = (full: string) => {
  const parts = full.trim().split(/\s+/);
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : parts[0];
};
// "Substitution: Ruby Day ON, Noah Tran OFF. ..." as the Match Centre has always written it
const SUB_RE = /^Substitution: (.+?) ON, (.+?) OFF\./;

/** The players worth showing as photo tiles: the line-up if there is one, else a squad small enough to scan */
function tilePlayers(squad: ClubMember[], lineup: string[]): ClubMember[] {
  if (lineup.length) return lineup.map(id => squad.find(p => p.id === id)).filter((p): p is ClubMember => !!p);
  return squad.length <= 24 ? [...squad].sort(byShirt) : [];
}

/** Photo tiles (or rows) of players, with a search for anyone else and a typed name as the last resort */
function PlayerPicker({ id, squad, lineup, value, onChange, layout = 'tiles', allowNone, noneLabel = 'None', placeholder }: {
  id: string;
  squad: ClubMember[] | null;
  lineup: string[];
  value: Pick;
  onChange: (p: Pick) => void;
  layout?: 'tiles' | 'rows';
  allowNone?: boolean;
  noneLabel?: string;
  placeholder?: string;
}) {
  const [typing, setTyping] = useState(false);
  // The squad search stays folded while there are tiles to tap, so the popup opens on the photos, not a list
  const [searching, setSearching] = useState(false);
  // An outside team: their players aren't on the club's list, so a name (or shirt number) is typed
  if (!squad) {
    return (
      <input id={id} type="text" className="form-input mc-sheet-input" placeholder={placeholder || 'Name or shirt number, e.g. No. 8'}
        value={value.name} onChange={e => onChange({ id: '', name: e.target.value })} autoComplete="off" />
    );
  }
  const tiles = tilePlayers(squad, lineup);
  const inTiles = !value.id || tiles.some(p => p.id === value.id);
  const searchValue = typing ? 'custom' : value.id && !inTiles ? value.id : '';
  return (
    <>
      {(tiles.length > 0 || allowNone) && (
        <div className={layout === 'rows' ? 'mc-pick-rows' : 'mc-picks'} role="group" aria-label="Tap a player">
          {allowNone && (
            <button type="button" className={layout === 'rows' ? 'mc-pick-row' : 'mc-pick'} aria-pressed={!value.id && !value.name}
              onClick={() => { setTyping(false); onChange(NONE); }}>
              <span className="mc-pick-av is-none" aria-hidden="true">&ndash;</span>
              <span className="mc-pick-name">{noneLabel}</span>
            </button>
          )}
          {tiles.map(p => (
            <button key={p.id} type="button" className={layout === 'rows' ? 'mc-pick-row' : 'mc-pick'} aria-pressed={value.id === p.id}
              onClick={() => { setTyping(false); onChange({ id: p.id, name: p.full_name }); }}>
              <span className="mc-pick-av"><PlayerAvatar photoUrl={p.photo_url} name={p.full_name} size={layout === 'rows' ? 36 : 52} /></span>
              {p.jersey_number != null && <span className="mc-pick-num">{p.jersey_number}</span>}
              <span className="mc-pick-name">{shortName(p.full_name)}</span>
            </button>
          ))}
        </div>
      )}
      {tiles.length > 0 && !searching && !(value.id && !inTiles) && !typing ? (
        <div className="mc-pick-more">
          <button type="button" className="mc-sheet-link" onClick={() => setSearching(true)}>Someone else? Search the squad</button>
        </div>
      ) : (
      <div className="mc-pick-more">
        <PlayerSearchSelect
          id={id}
          players={squad}
          value={searchValue}
          placeholder="Search the squad by name or number"
          onChange={v => {
            if (v === 'custom') { setTyping(true); onChange({ id: '', name: '' }); return; }
            setTyping(false);
            const p = squad.find(m => m.id === v);
            onChange(p ? { id: p.id, name: p.full_name } : NONE);
          }}
          extraOptions={[{ value: 'custom', label: 'Someone else (type a name)' }]}
        />
        {typing && (
          <input aria-label="Player name" type="text" className="form-input mc-sheet-input" placeholder="Player name" autoFocus
            value={value.name} onChange={e => onChange({ id: '', name: e.target.value })} />
        )}
      </div>
      )}
    </>
  );
}

/**
 * One popup per event button: tap the player (photos, shirt numbers), save. Replaces the long
 * "Log an event" form, so a goal is three taps on a phone: Goal, the scorer, Save.
 */
export default function MatchEventSheet(props: Props) {
  const { mode, initialType, side, names, squads, lineupIds, events, score, clockMinute, maxMinute, minuteLabel, onSave, onScoreOnly, onClose } = props;

  const [goalKind, setGoalKind] = useState<'goal' | 'penalty' | 'own_goal'>(
    initialType === 'penalty' || initialType === 'own_goal' ? initialType : 'goal');
  const [cardKind, setCardKind] = useState<'yellow' | 'second' | 'red'>(initialType === 'red_card' ? 'red' : 'yellow');
  const [noteKind, setNoteKind] = useState<'commentary' | 'whistle'>(initialType === 'whistle' ? 'whistle' : 'commentary');
  const [player, setPlayer] = useState<Pick>(NONE);
  const [assist, setAssist] = useState<Pick>(NONE);
  const [offPlayer, setOffPlayer] = useState<Pick>(NONE);
  const [text, setText] = useState('');
  const [minute, setMinute] = useState(clockMinute);
  const [editMinute, setEditMinute] = useState(false);
  const [error, setError] = useState('');

  // An own goal is scored by the other team's player and counts for this side
  const playerSide: Side = mode === 'goal' && goalKind === 'own_goal' ? other(side) : side;
  const squad = squads[playerSide];
  const lineup = lineupIds[playerSide];

  // Substitutions: who's on the pitch now = the line-up, plus players brought on, minus players taken off
  const sideSquad = squads[side];
  let onPitch: ClubMember[] = [];
  let bench: ClubMember[] = [];
  if (mode === 'sub' && sideSquad) {
    const sorted = [...sideSquad].sort(byShirt);
    if (lineupIds[side].length) {
      const on = new Set(lineupIds[side]);
      for (const e of [...events].filter(ev => ev.event_type === 'sub' && ev.team_side === side).reverse()) {
        const m = SUB_RE.exec(e.detail_text || '');
        if (!m) continue;
        const onP = sideSquad.find(p => p.full_name === m[1]);
        const offP = sideSquad.find(p => p.full_name === m[2]);
        if (offP) on.delete(offP.id);
        if (onP) on.add(onP.id);
      }
      onPitch = sorted.filter(p => on.has(p.id));
      bench = sorted.filter(p => !on.has(p.id));
    } else {
      // No line-up saved: anyone can come off or on
      onPitch = sorted;
      bench = sorted;
    }
  }

  const goalsAfter = (s: Side) => score[s] + (mode === 'goal' && s === side ? 1 : 0);
  const scoreAfter = `${goalsAfter('home')}–${goalsAfter('away')}`;

  const title = mode === 'goal' ? `Goal for ${names[side]}`
    : mode === 'card' ? (cardKind === 'yellow' ? 'Yellow card' : cardKind === 'second' ? 'Second yellow' : 'Red card')
    : mode === 'sub' ? `Substitution, ${names[side]}`
    : noteKind === 'whistle' ? 'Period whistle' : 'Commentary';

  const save = () => {
    setError('');
    const fallback = `${names[playerSide]} Player`;
    if (mode === 'goal') {
      if (squad && !player.name.trim()) return setError(goalKind === 'own_goal' ? 'Tap who scored the own goal.' : 'Tap who scored.');
      return onSave({
        eventType: goalKind, side: playerSide, minute,
        playerName: player.name.trim() || fallback,
        assistName: goalKind === 'own_goal' ? undefined : assist.name.trim() || undefined,
      });
    }
    if (mode === 'card') {
      if (squad && !player.name.trim()) return setError('Tap who was booked.');
      const detail = [cardKind === 'second' ? 'Second yellow' : '', text.trim()].filter(Boolean).join('. ');
      return onSave({ eventType: cardKind === 'yellow' ? 'yellow_card' : 'red_card', side, minute, playerName: player.name.trim() || fallback, detail: detail || undefined });
    }
    if (mode === 'sub') {
      if (sideSquad && (!offPlayer.name || !player.name)) return setError('Tap who comes off and who goes on.');
      const onName = player.name.trim() || fallback;
      const offName = offPlayer.name.trim() || 'Player';
      return onSave({ eventType: 'sub', side, minute, playerName: onName, detail: `Substitution: ${onName} ON, ${offName} OFF.` });
    }
    if (!text.trim()) return setError(noteKind === 'whistle' ? 'Say what the whistle was for.' : 'Type the commentary line.');
    return onSave({ eventType: noteKind, side, minute, playerName: names[side], detail: text.trim() });
  };

  const saveLabel = mode === 'goal' ? `Save goal, ${scoreAfter}`
    : mode === 'card' ? `Save ${cardKind === 'yellow' ? 'yellow card' : 'red card'}`
    : mode === 'sub' ? (player.name && offPlayer.name ? `${shortName(player.name)} on, ${shortName(offPlayer.name)} off` : 'Save substitution')
    : 'Save';

  return (
    <div className="mc-sheet-wrap" onClick={onClose}>
      <PopupPanel onClose={onClose} label={title} className="mc-sheet" onClick={e => e.stopPropagation()}>
        <div className="mc-sheet-grab" aria-hidden="true" />
        <div className="mc-sheet-head">
          <h2>
            {mode === 'card' && <span className={cardKind === 'yellow' ? 'mc-card-tag' : 'mc-card-tag is-red'} aria-hidden="true" />}
            {title}
          </h2>
          {editMinute ? (
            <label className="mc-sheet-min is-edit">
              <span className="sr-only">Minute</span>
              <input type="number" inputMode="numeric" min={0} max={maxMinute} value={minute} autoFocus
                onChange={e => setMinute(Math.max(0, Math.min(maxMinute, Number(e.target.value) || 0)))} />
              <span aria-hidden="true">&prime;</span>
            </label>
          ) : (
            <button type="button" className="mc-sheet-min" onClick={() => setEditMinute(true)} aria-label={`Minute ${minuteLabel(minute)}, change it`}>
              <b>{minuteLabel(minute)}&prime;</b>Change
            </button>
          )}
        </div>

        {mode === 'goal' && (
          <>
            <div className="mc-sheet-seg" role="group" aria-label="Kind of goal">
              <button type="button" className="mc-period" aria-pressed={goalKind === 'goal'} onClick={() => { setGoalKind('goal'); setPlayer(NONE); }}>Goal</button>
              <button type="button" className="mc-period" aria-pressed={goalKind === 'penalty'} onClick={() => { setGoalKind('penalty'); setPlayer(NONE); }}>Penalty</button>
              <button type="button" className="mc-period" aria-pressed={goalKind === 'own_goal'} onClick={() => { setGoalKind('own_goal'); setPlayer(NONE); setAssist(NONE); }}>Own goal</button>
            </div>
            <div className="mc-sheet-label">
              <span>{goalKind === 'own_goal' ? `Own goal by (${names[playerSide]})` : 'Scorer'}</span>
              <small>{squad ? (lineup.length ? "Today's line-up" : 'Squad') : 'Optional'}</small>
            </div>
            <PlayerPicker id="mc-sheet-scorer" squad={squad} lineup={lineup} value={player} onChange={setPlayer} />
            {goalKind !== 'own_goal' && (
              <>
                <div className="mc-sheet-label"><span>Assist</span><small>Optional</small></div>
                <PlayerPicker id="mc-sheet-assist" squad={squad ? squad.filter(p => p.id !== player.id) : null}
                  lineup={lineup.filter(id => id !== player.id)} value={assist} onChange={setAssist} allowNone placeholder="Name (optional)" />
              </>
            )}
          </>
        )}

        {mode === 'card' && (
          <>
            <div className="mc-sheet-seg" role="group" aria-label="Card">
              <button type="button" className="mc-period" aria-pressed={cardKind === 'yellow'} onClick={() => setCardKind('yellow')}>Yellow</button>
              <button type="button" className="mc-period" aria-pressed={cardKind === 'second'} onClick={() => setCardKind('second')}>Second yellow</button>
              <button type="button" className="mc-period" aria-pressed={cardKind === 'red'} onClick={() => setCardKind('red')}>Red</button>
            </div>
            <div className="mc-sheet-label"><span>Player, {names[side]}</span><small>{squad ? (lineup.length ? "Today's line-up" : 'Squad') : 'Optional'}</small></div>
            <PlayerPicker id="mc-sheet-booked" squad={squad} lineup={lineup} value={player} onChange={setPlayer} />
            <div className="mc-sheet-label"><label htmlFor="mc-sheet-reason">Reason</label><small>Optional</small></div>
            <input id="mc-sheet-reason" type="text" className="form-input mc-sheet-input" placeholder="e.g. Late tackle" value={text} onChange={e => setText(e.target.value)} />
          </>
        )}

        {mode === 'sub' && (
          sideSquad ? (
            <div className="mc-sheet-sub">
              <div>
                <div className="mc-sheet-label"><span className="mc-sub-off">Off</span><small>{lineupIds[side].length ? 'On the pitch' : 'Squad'}</small></div>
                <div className="mc-pick-rows" role="group" aria-label="Player coming off">
                  {onPitch.map(p => (
                    <button key={p.id} type="button" className="mc-pick-row" aria-pressed={offPlayer.id === p.id} onClick={() => setOffPlayer({ id: p.id, name: p.full_name })}>
                      <span className="mc-pick-av"><PlayerAvatar photoUrl={p.photo_url} name={p.full_name} size={36} /></span>
                      <span className="mc-pick-name">{shortName(p.full_name)}</span>
                      {p.jersey_number != null && <span className="mc-pick-num">{p.jersey_number}</span>}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="mc-sheet-label"><span className="mc-sub-on">On</span><small>{lineupIds[side].length ? 'Bench' : 'Squad'}</small></div>
                <div className="mc-pick-rows" role="group" aria-label="Player coming on">
                  {bench.filter(p => p.id !== offPlayer.id).map(p => (
                    <button key={p.id} type="button" className="mc-pick-row" aria-pressed={player.id === p.id} onClick={() => setPlayer({ id: p.id, name: p.full_name })}>
                      <span className="mc-pick-av"><PlayerAvatar photoUrl={p.photo_url} name={p.full_name} size={36} /></span>
                      <span className="mc-pick-name">{shortName(p.full_name)}</span>
                      {p.jersey_number != null && <span className="mc-pick-num">{p.jersey_number}</span>}
                    </button>
                  ))}
                  {bench.length === 0 && <p className="mc-sheet-empty">Nobody on the bench.</p>}
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="mc-sheet-label"><label htmlFor="mc-sheet-off">Coming off</label><small>Optional</small></div>
              <input id="mc-sheet-off" type="text" className="form-input mc-sheet-input" placeholder="Name or shirt number" value={offPlayer.name} onChange={e => setOffPlayer({ id: '', name: e.target.value })} />
              <div className="mc-sheet-label"><label htmlFor="mc-sheet-on">Coming on</label><small>Optional</small></div>
              <input id="mc-sheet-on" type="text" className="form-input mc-sheet-input" placeholder="Name or shirt number" value={player.name} onChange={e => setPlayer({ id: '', name: e.target.value })} />
            </>
          )
        )}

        {mode === 'note' && (
          <>
            <div className="mc-sheet-seg is-two" role="group" aria-label="Kind of note">
              <button type="button" className="mc-period" aria-pressed={noteKind === 'commentary'} onClick={() => setNoteKind('commentary')}>Commentary</button>
              <button type="button" className="mc-period" aria-pressed={noteKind === 'whistle'} onClick={() => setNoteKind('whistle')}>Period whistle</button>
            </div>
            <label htmlFor="mc-sheet-note" className="sr-only">Text</label>
            <input id="mc-sheet-note" type="text" className="form-input mc-sheet-input" autoFocus
              placeholder={noteKind === 'whistle' ? 'e.g. Drinks break' : 'e.g. Great save from the keeper'} value={text} onChange={e => setText(e.target.value)} />
          </>
        )}

        {error && <p className="mc-sheet-error" role="alert">{error}</p>}

        <div className="mc-sheet-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={save}>{saveLabel}</button>
        </div>
        {mode === 'goal' && onScoreOnly && (
          <div className="mc-sheet-skip">
            <button type="button" className="mc-sheet-link" onClick={onScoreOnly}>Don&apos;t know who, just add the goal</button>
          </div>
        )}
      </PopupPanel>
    </div>
  );
}
