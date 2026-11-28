'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Match } from '@/lib/supabase/types';
import { AlertCircle, ArrowDown, ArrowUp, GripVertical, Printer } from 'lucide-react';
import { DATE_LOCALE } from '@/lib/dates';
import { runSheetMove, slotTime, pitchDelays, pushBackPitch, teamBreaks } from '@/lib/tournament-engine';
import { getLiveMinuteLabel } from '@/lib/live-minute';
import { fullMinutes } from '@/lib/match-length';

type Slot = Pick<Match, 'match_date' | 'match_time' | 'pitch_label'>;
export type SlotChange = Slot & { id: string };
type PrintMode = 'all' | 'pitch' | 'team';

const dayOf = (s: Slot) => s.match_date?.slice(0, 10) || '';
const keyOf = (s: Slot) => `${dayOf(s)} ${s.match_time || ''}`;
const byPitch = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });
const bySlot = (a: Match, b: Match) =>
  keyOf(a).localeCompare(keyOf(b)) || byPitch(a.pitch_label || '', b.pitch_label || '') || (a.tournament_match_number ?? 0) - (b.tournament_match_number ?? 0);

function clock(time?: string | null, plus = 0) {
  if (!time) return '';
  const [h, m] = time.split(':').map(Number);
  if (isNaN(h)) return time;
  const d = new Date(2000, 0, 1, h, (m || 0) + plus);
  return d.toLocaleTimeString(DATE_LOCALE, { hour: 'numeric', minute: '2-digit' });
}
const clockAt = (ms: number) => new Date(ms).toLocaleTimeString(DATE_LOCALE, { hour: 'numeric', minute: '2-digit' });
const dayLabel = (day: string) => (day ? new Date(`${day}T12:00`).toLocaleDateString(DATE_LOCALE, { weekday: 'long', day: 'numeric', month: 'long' }) : 'No date yet');
const localDay = (ms: number) => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const pitchName = (p: string) => p || 'Games';
const teams = (m: Match) => [m.home_team_name, m.away_team_name].filter(n => n && n !== 'TBD');
const vs = (m: Match) => `${m.home_team_name} v ${m.away_team_name}`;
const stageName = (m: Match) => m.tournament_stage && m.tournament_stage !== 'group'
  ? m.tournament_stage.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase()) : '';

/** The Fixtures tab's run sheet. By time: times stay fixed down the left and upcoming games are
 *  dragged between them (the games in between shift by one slot). By pitch: a column per pitch,
 *  where a dragged game swaps places with another. On the day it also shows what's on each pitch
 *  now, which pitches are running late, and each team's rest. Played and live games stay put. */
export default function RunSheet({ title, matches, matchMinutes, onSave, onSelectMatch }: {
  title: string;
  matches: Match[];
  /** One slot: a game plus changeover */
  matchMinutes?: number | null;
  onSave: (changes: SlotChange[]) => void;
  onSelectMatch: (m: Match) => void;
}) {
  const base = useMemo(() => [...matches].sort(bySlot), [matches]);
  const movable = (m: Match) => m.status === 'upcoming';
  const baseIds = base.filter(movable).map(m => m.id);
  const [order, setOrder] = useState<string[] | null>(null);
  const [highlight, setHighlight] = useState('');
  const [layout, setLayout] = useState<'time' | 'pitch'>('time');
  const [phonePitch, setPhonePitch] = useState(0);
  const [showPlayed, setShowPlayed] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [printMode, setPrintMode] = useState<PrintMode | null>(null);
  const [printChoice, setPrintChoice] = useState<PrintMode>('all');
  const [skipPlayed, setSkipPlayed] = useState(true);
  const printRef = useRef<HTMLDetailsElement>(null);
  // The clock the board, now line and late warnings read; ticks every 30 seconds
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);
  // Print what was picked once it's on the page, then take it away again
  useEffect(() => {
    if (!printMode) return;
    const done = () => setPrintMode(null);
    window.addEventListener('afterprint', done, { once: true });
    const raf = requestAnimationFrame(() => window.print());
    return () => { cancelAnimationFrame(raf); window.removeEventListener('afterprint', done); };
  }, [printMode]);

  // A pending order only holds games that still exist and can still move
  const pending = order ? [...order.filter(id => baseIds.includes(id)), ...baseIds.filter(id => !order.includes(id))] : baseIds;
  const byId = new Map(base.map(m => [m.id, m]));
  const slots: Slot[] = baseIds.map(id => byId.get(id)!);
  let k = 0;
  const rows = base.map(m => {
    if (!movable(m)) return { m, slot: m as Slot };
    const slot = slots[k];
    return { m: byId.get(pending[k++])!, slot };
  });
  const changes: SlotChange[] = rows
    .filter(r => movable(r.m) && keyOf(r.m) + (r.m.pitch_label || '') !== keyOf(r.slot) + (r.slot.pitch_label || ''))
    .map(r => ({ id: r.m.id, match_date: r.slot.match_date, match_time: r.slot.match_time, pitch_label: r.slot.pitch_label ?? null }));
  // Every game where it would be once saved
  const placed = rows.map(({ m, slot }) => ({ ...m, match_date: slot.match_date, match_time: slot.match_time, pitch_label: slot.pitch_label }) as Match);

  // Same time = a team in two games in one slot; back to back = a team in the slot just before, same day
  const inSlot = new Map<string, string[]>();
  rows.forEach(({ m, slot }) => { if (slot.match_time) inSlot.set(keyOf(slot), [...(inSlot.get(keyOf(slot)) || []), ...teams(m)]); });
  const slotKeys = [...inSlot.keys()].sort();
  const restBefore = (m: Match, slot: Slot) => {
    const prev = slotKeys[slotKeys.indexOf(keyOf(slot)) - 1];
    return prev && prev.slice(0, 10) === dayOf(slot) ? teams(m).filter(t => inSlot.get(prev)!.includes(t)) : [];
  };
  const flagOf = new Map(rows.map(({ m, slot }) => {
    const here = inSlot.get(keyOf(slot)) || [];
    if (teams(m).some(t => here.filter(x => x === t).length > 1)) return [m.id, 'clash'];
    return [m.id, restBefore(m, slot).length ? 'b2b' : ''];
  }));
  const b2bTeams = [...new Set(rows.flatMap(r => (movable(r.m) ? restBefore(r.m, r.slot) : [])))];
  const clashes = [...flagOf.values()].includes('clash');
  const allTeams = [...new Set(base.flatMap(teams))].sort();
  const breaks = teamBreaks(placed);
  const pitches = [...new Set(base.map(m => m.pitch_label || ''))].sort(byPitch);

  // On the day: what's on each pitch, and the pitches running late
  const today = localDay(now);
  const onTheDay = base.some(m => m.status === 'live') || base.some(m => m.status === 'upcoming' && dayOf(m) === today);
  const late = onTheDay ? pitchDelays(base, now) : [];
  const lateOn = new Map(late.map(l => [l.pitch, l]));
  const nextOn = (pitch: string) => base.find(m => m.status === 'upcoming' && (m.pitch_label || '') === pitch);
  // The next game on a late pitch: when it will likely start
  const likely = (m: Match) => {
    const l = lateOn.get(m.pitch_label || '');
    if (!l || !m.match_time || m.status !== 'upcoming') return '';
    const next = l.started ? nextOn(l.pitch) : l.game;
    return next?.id === m.id ? clock(m.match_time, l.minutes) : '';
  };
  const pushBack = (l: (typeof late)[number]) => {
    const moved = pushBackPitch(base, l.game, l.minutes).map(c => {
      const m = byId.get(c.id)!;
      return { id: c.id, match_date: m.match_date, match_time: c.match_time, pitch_label: m.pitch_label ?? null };
    });
    if (moved.length) { onSave(moved); setOrder(null); }
  };

  const move = (id: string, toId: string) => {
    if (id === toId) return;
    setOrder(runSheetMove(pending, pending.indexOf(id), pending.indexOf(toId)));
  };
  const swap = (id: string, toId: string) => {
    const [a, b] = [pending.indexOf(id), pending.indexOf(toId)];
    if (a < 0 || b < 0 || a === b) return;
    const next = [...pending];
    [next[a], next[b]] = [next[b], next[a]];
    setOrder(next);
  };
  const nudge = (id: string, step: number) => {
    const j = pending.indexOf(id) + step;
    if (j >= 0 && j < pending.length) setOrder(runSheetMove(pending, pending.indexOf(id), j));
  };
  const dragProps = (m: Match, drop: (id: string, toId: string) => void) => movable(m) ? {
    draggable: true,
    onDragStart: (e: React.DragEvent) => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', m.id); setDragId(m.id); },
    onDragOver: (e: React.DragEvent) => { if (dragId) { e.preventDefault(); setOverId(m.id); } },
    onDrop: (e: React.DragEvent) => { e.preventDefault(); if (dragId) drop(dragId, m.id); setDragId(null); setOverId(null); },
    onDragEnd: () => { setDragId(null); setOverId(null); },
  } : {};
  const isHi = (m: Match) => !!highlight && teams(m).includes(highlight);
  const state = (m: Match, flag?: string) => m.status === 'completed' ? <span className="ht-state" data-tone="ok">Played</span>
    : m.status === 'live' ? <span className="ht-state" data-tone={lateOn.get(m.pitch_label || '')?.game.id === m.id ? 'warn' : 'due'}>Live {getLiveMinuteLabel(m, now)}&apos;</span>
    : likely(m) ? <span className="ht-state" data-tone="warn">Late</span>
    : flag === 'clash' ? <span className="ht-state" data-tone="due">Same time</span>
    : flag === 'b2b' ? <span className="ht-state" data-tone="warn">Back to back</span>
    : stageName(m) ? <span className="ht-state">{stageName(m)}</span> : null;

  // By time: played games fold into one line while there are games still to come
  const played = rows.filter(r => r.m.status === 'completed');
  const fold = !showPlayed && played.length > 0 && played.length < rows.length;
  const listed = fold ? rows.filter(r => r.m.status !== 'completed') : rows;
  // By pitch: a time row stays while any of its games is still to finish
  const shown = fold ? placed.filter(m => placed.some(o => keyOf(o) === keyOf(m) && o.status !== 'completed')) : placed;
  const firstUp = onTheDay ? listed.findIndex(r => r.m.status === 'upcoming') : -1;

  const printGames = (skipPlayed ? placed.filter(m => m.status !== 'completed') : placed).filter(m => m.status !== 'cancelled');

  return (
    <div className="ht-rs">
      <div className="ht-rs-bar">
        {pitches.length > 1 ? (
          <div className="ht-fx-seg ht-rs-layout" role="group" aria-label="Lay out by">
            <button type="button" aria-pressed={layout === 'time'} onClick={() => setLayout('time')}>By time</button>
            <button type="button" aria-pressed={layout === 'pitch'} onClick={() => setLayout('pitch')}>By pitch</button>
          </div>
        ) : <span />}
        <div className="ht-rs-tools">
          <label className="sr-only" htmlFor="ht-rs-hi">Highlight a team</label>
          <select id="ht-rs-hi" className="ht-rs-select" value={highlight} onChange={e => setHighlight(e.target.value)}>
            <option value="">Highlight a team</option>
            {allTeams.map(t => <option key={t} value={t}>Highlight {t}</option>)}
          </select>
          <details className="ht-redo ht-rs-printmenu" ref={printRef}>
            <summary className="btn btn-sm btn-secondary ht-rs-btn"><Printer size={14} aria-hidden /> Print</summary>
            <div className="ht-redo-menu" role="group" aria-label="Print">
              {([
                ['all', 'Whole run sheet', 'Every game by time, for the organisers’ desk'],
                ['pitch', 'A sheet per pitch, for referees', 'Score boxes and lines for scorers and cards'],
                ['team', 'A sheet per team', 'Their games, pitches and rest, for team managers'],
              ] as const).map(([v, label, sub]) => (
                <label key={v} className="ht-rs-popt">
                  <input type="radio" name="ht-rs-print" checked={printChoice === v} onChange={() => setPrintChoice(v)} />
                  <span>{label}<small>{sub}</small></span>
                </label>
              ))}
              {played.length > 0 && (
                <label className="ht-rs-popt">
                  <input type="checkbox" checked={skipPlayed} onChange={e => setSkipPlayed(e.target.checked)} />
                  <span>Leave out games already played</span>
                </label>
              )}
              <button type="button" className="btn btn-sm btn-primary ht-rs-btn" onClick={() => { if (printRef.current) printRef.current.open = false; setPrintMode(printChoice); }}>
                <Printer size={14} aria-hidden /> Print
              </button>
            </div>
          </details>
        </div>
      </div>

      {onTheDay && (
        <div className="ht-rs-board" style={{ '--pitches': pitches.length } as React.CSSProperties}>
          <div className="ht-rs-now"><small>Now</small><b>{clockAt(now)}</b></div>
          {pitches.map(p => {
            const live = base.find(m => m.status === 'live' && (m.pitch_label || '') === p);
            const next = nextOn(p);
            const l = lateOn.get(p);
            return (
              <div key={p} className="ht-rs-pitch-now" data-late={l ? 'true' : undefined}>
                <header>
                  <span>{pitchName(p)}</span>
                  {l ? <span className="ht-state" data-tone="warn">{l.minutes} min late</span> : live && <span className="ht-rs-min">{getLiveMinuteLabel(live, now)}&apos;</span>}
                </header>
                {live ? (
                  <button type="button" className="ht-rs-now-game" onClick={() => onSelectMatch(live)} title="Open this game">
                    <span>{live.home_team_name}</span><em>{live.home_score}</em>
                    <span>{live.away_team_name}</span><em>{live.away_score}</em>
                  </button>
                ) : <p className="ht-rs-idle">{l && !l.started ? `${vs(l.game)} hasn’t kicked off` : 'Nothing on'}</p>}
                {next && <p className="ht-rs-next">Next <b>{likely(next) || clock(next.match_time) || 'TBD'}</b> {vs(next)}</p>}
              </div>
            );
          })}
        </div>
      )}

      {late.map(l => {
        const next = l.started ? nextOn(l.pitch) : l.game;
        const moving = pushBackPitch(base, l.game, l.minutes).length;
        return (
          <div key={l.pitch} className="ht-warn" role="status">
            <AlertCircle size={16} aria-hidden style={{ flex: 'none', marginTop: 2, color: 'var(--c-amber)' }} />
            <div>
              <b>{pitchName(l.pitch)} is running {l.minutes} minutes late.</b>{' '}
              {l.started ? `${vs(l.game)} kicked off at ${clock(l.game.match_time, l.minutes)}` : `${vs(l.game)} was due at ${clock(l.game.match_time)} and hasn’t kicked off`}
              {next?.match_time ? `, so ${l.started ? vs(next) : 'it'} will likely start at ${clock(next.match_time, l.minutes)}.` : '.'}
              {moving > 0 && (
                <> <button type="button" className="ht-link-btn ht-rs-push" onClick={() => pushBack(l)}>
                  Push {pitchName(l.pitch)} back {l.minutes} minutes ({moving} {moving === 1 ? 'game' : 'games'})
                </button></>
              )}
            </div>
          </div>
        );
      })}

      {(b2bTeams.length > 0 || clashes) && (
        <div className="ht-warn" role="status">
          <AlertCircle size={16} aria-hidden style={{ flex: 'none', marginTop: 2 }} />
          <div>
            {clashes && <b>A team is in two games at the same time. </b>}
            {b2bTeams.length > 0 && <><b>{b2bTeams.join(', ')}</b> {b2bTeams.length === 1 ? 'plays' : 'play'} back to back. </>}
            Drag one of their games to give them a break.
          </div>
        </div>
      )}

      {layout === 'time' || pitches.length < 2 ? (
        <>
          <p className="ht-hint">Drag a game onto another time to move it there. The times stay where they are and the games in between shift along. On a phone, use the arrows.</p>
          <div className="ht-rs-sheet" role="table" aria-label="Run sheet">
            <div className="ht-rs-row is-head" role="row">
              <span /><span>Start</span><span>End</span><span>Pitch</span><span className="ht-rs-home">Home team</span><span>Goals</span><span /><span>Goals</span><span>Away team</span><span /><span />
            </div>
            {fold && (
              <div className="ht-rs-fold" role="row">
                <span>{played.length} {played.length === 1 ? 'game' : 'games'} played</span>
                <button type="button" onClick={() => setShowPlayed(true)}>Show</button>
              </div>
            )}
            {listed.map(({ m, slot }, i) => {
              const day = dayOf(slot);
              const header = i === 0 || dayOf(listed[i - 1].slot) !== day ? <div className="ht-rs-row is-day" role="row">{dayLabel(day)}</div> : null;
              const canMove = movable(m);
              const end = matchMinutes ? clock(slot.match_time, matchMinutes) : '';
              const at = pending.indexOf(m.id);
              const soon = likely(m);
              // Rest since the highlighted team's last game, the same day
              const prevHi = isHi(m) ? listed.slice(0, i).reverse().find(r => isHi(r.m)) : undefined;
              const rest = prevHi && dayOf(prevHi.slot) === day ? Math.round((slotTime(slot) - slotTime(prevHi.slot)) / 60000) - fullMinutes(prevHi.m) : NaN;
              const cls = ['ht-rs-row', !canMove && 'is-locked', m.status === 'live' && 'is-live', isHi(m) && 'is-hi', dragId === m.id && 'is-dragging', overId === m.id && dragId !== m.id && 'is-over'].filter(Boolean).join(' ');
              return (
                <React.Fragment key={m.id}>
                  {header}
                  {i === firstUp && <div className="ht-rs-nowline" role="presentation"><span>Now {clockAt(now)}</span></div>}
                  {rest >= 0 && <div className="ht-rs-gap" role="row" data-tone={rest <= 5 ? 'warn' : undefined}>{highlight} rests {rest} minutes</div>}
                  <div className={cls} role="row" {...dragProps(m, move)}>
                    <span className="ht-rs-handle" aria-hidden>{canMove && <GripVertical size={16} />}</span>
                    <span className="ht-rs-time">
                      {clock(slot.match_time) || 'TBD'}
                      {soon && <span className="ht-rs-likely">likely {soon}</span>}
                      {end && <span className="ht-rs-sub">to {end}</span>}
                      {slot.pitch_label && <span className="ht-rs-sub">{slot.pitch_label}</span>}
                    </span>
                    <span className="ht-rs-end">{end}</span>
                    <span className="ht-rs-pitch">{slot.pitch_label || ''}</span>
                    <button type="button" className="ht-rs-match" onClick={() => onSelectMatch(m)} title="Open this game">
                      <span className="ht-rs-team ht-rs-home">{m.home_team_name}</span>
                      <span className="ht-rs-goal">{m.status === 'upcoming' ? '' : m.home_score}</span>
                      <span className="ht-rs-v">v</span>
                      <span className="ht-rs-goal">{m.status === 'upcoming' ? '' : m.away_score}</span>
                      <span className="ht-rs-team">{m.away_team_name}</span>
                    </button>
                    <span className="ht-rs-flag-cell">{state(m, flagOf.get(m.id))}</span>
                    <span className="ht-rs-moves">
                      {canMove && <>
                        <button type="button" className="ht-icon-btn ht-rs-mv" aria-label={`Move ${vs(m)} earlier`} disabled={at <= 0} onClick={() => nudge(m.id, -1)}><ArrowUp size={15} /></button>
                        <button type="button" className="ht-icon-btn ht-rs-mv" aria-label={`Move ${vs(m)} later`} disabled={at >= pending.length - 1} onClick={() => nudge(m.id, 1)}><ArrowDown size={15} /></button>
                      </>}
                    </span>
                  </div>
                </React.Fragment>
              );
            })}
            {showPlayed && played.length > 0 && played.length < rows.length && (
              <div className="ht-rs-fold" role="row"><span>Showing played games</span><button type="button" onClick={() => setShowPlayed(false)}>Hide</button></div>
            )}
          </div>
        </>
      ) : (
        <>
          <p className="ht-hint">Drag a game onto another to swap their times and pitches. Played and live games stay put.</p>
          <div className="ht-rs-chips admin-chips" role="group" aria-label="Pitch">
            {pitches.map((p, i) => (
              <button key={p} type="button" className="admin-chip" aria-pressed={phonePitch === i} onClick={() => setPhonePitch(i)}>
                {pitchName(p)}{lateOn.get(p) ? `, ${lateOn.get(p)!.minutes} min late` : ''}
              </button>
            ))}
          </div>
          <div className="ht-rs-grid" role="table" aria-label="Run sheet by pitch" style={{ '--pitches': pitches.length } as React.CSSProperties}>
            <div className="ht-rs-gh" role="columnheader">Time</div>
            {pitches.map((p, i) => (
              <div key={p} className={`ht-rs-gh${phonePitch === i ? '' : ' is-off'}`} role="columnheader">
                {pitchName(p)}
                {lateOn.get(p) && <span className="ht-state" data-tone="warn">{lateOn.get(p)!.minutes} min late</span>}
              </div>
            ))}
            {fold && (
              <div className="ht-rs-fold" role="row">
                <span>{played.length} {played.length === 1 ? 'game' : 'games'} played</span>
                <button type="button" onClick={() => setShowPlayed(true)}>Show</button>
              </div>
            )}
            {[...new Set(shown.map(keyOf))].sort().map((key, ki, keys) => {
              const games = shown.filter(m => keyOf(m) === key);
              const [day, time] = [key.slice(0, 10), games[0].match_time];
              const firstLater = onTheDay && slotTime(games[0]) > now && (ki === 0 || slotTime(shown.find(m => keyOf(m) === keys[ki - 1])!) <= now);
              return (
                <React.Fragment key={key}>
                  {(ki === 0 || keys[ki - 1].slice(0, 10) !== day) && <div className="ht-rs-gday" role="row">{dayLabel(day)}</div>}
                  {firstLater && <div className="ht-rs-nowline" role="presentation"><span>Now {clockAt(now)}</span></div>}
                  <div className="ht-rs-gt" role="rowheader">{clock(time) || 'TBD'}{matchMinutes && time ? <small>to {clock(time, matchMinutes)}</small> : null}</div>
                  {pitches.map((p, i) => (
                    <div key={p} className={`ht-rs-cell${phonePitch === i ? '' : ' is-off'}`} role="cell">
                      {games.filter(m => (m.pitch_label || '') === p).map(m => {
                        const soon = likely(m);
                        const cls = ['ht-rs-card', m.status === 'completed' && 'is-done', m.status === 'live' && 'is-live', soon && 'is-late', isHi(m) && 'is-hi', dragId === m.id && 'is-dragging', overId === m.id && dragId !== m.id && 'is-over'].filter(Boolean).join(' ');
                        return (
                          <div key={m.id} className={cls} {...dragProps(m, swap)}>
                            <button type="button" onClick={() => onSelectMatch(m)} title="Open this game">
                              <span>{m.home_team_name}</span><em>{m.status === 'upcoming' ? '' : m.home_score}</em>
                              <span>{m.away_team_name}</span><em>{m.status === 'upcoming' ? '' : m.away_score}</em>
                            </button>
                            <div className="ht-rs-card-state">{soon ? <span className="ht-state" data-tone="warn">likely {soon}</span> : state(m, flagOf.get(m.id))}</div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </React.Fragment>
              );
            })}
          </div>
        </>
      )}

      {changes.length > 0 && (
        <div className="ht-rs-save" role="status">
          <p><b>{changes.length} {changes.length === 1 ? 'game' : 'games'} moved.</b> Teams and spectators see the new times once you save.</p>
          <div className="ht-rs-tools">
            <button type="button" className="btn btn-sm btn-secondary ht-rs-btn" onClick={() => setOrder(null)}>Undo</button>
            <button type="button" className="btn btn-sm btn-primary ht-rs-btn" onClick={() => { onSave(changes); setOrder(null); }}>Save new times</button>
          </div>
        </div>
      )}

      {breaks.length > 0 && (
        <section className="ht-rs-breaks" aria-labelledby="ht-rs-breaks-h">
          <h3 id="ht-rs-breaks-h">Rest between games</h3>
          <p>Each team&apos;s shortest rest between two games on the same day, shortest first. Tap a team to highlight its games.</p>
          <ul>
            {breaks.map(b => (
              <li key={b.team}>
                <button type="button" aria-pressed={highlight === b.team} onClick={() => setHighlight(highlight === b.team ? '' : b.team)}>
                  <span>{b.team}</span><b data-tone={b.minutes <= 5 ? 'warn' : undefined}>{b.minutes} min</b>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="ht-rs-legend">
        <span><span className="ht-state" data-tone="ok">Played</span> stays in its slot</span>
        <span><span className="ht-state" data-tone="warn">Late</span> its pitch is running behind</span>
        <span><span className="ht-state" data-tone="warn">Back to back</span> no break between games</span>
        <span><span className="ht-state" data-tone="due">Same time</span> a team is in two games at once</span>
      </div>

      {printMode && (
        <div className="ht-rs-printout">
          {printMode === 'all' && (
            <section className="ht-rs-page">
              <h2>{title}, run sheet</h2>
              <table>
                <thead><tr><th>Time</th><th>Pitch</th><th>Home team</th><th>Score</th><th>Away team</th><th>Round</th></tr></thead>
                <tbody>
                  {printGames.map((m, i) => (
                    <React.Fragment key={m.id}>
                      {(i === 0 || dayOf(printGames[i - 1]) !== dayOf(m)) && <tr><th colSpan={6} className="ht-rs-pday">{dayLabel(dayOf(m))}</th></tr>}
                      <tr>
                        <td>{clock(m.match_time) || 'TBD'}</td><td>{m.pitch_label || ''}</td><td>{m.home_team_name}</td>
                        <td>{m.status === 'completed' ? `${m.home_score} - ${m.away_score}` : ''}</td><td>{m.away_team_name}</td><td>{stageName(m) || 'Group game'}</td>
                      </tr>
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </section>
          )}
          {printMode === 'pitch' && pitches.map(p => {
            const games = printGames.filter(m => (m.pitch_label || '') === p);
            return games.length > 0 && (
              <section key={p} className="ht-rs-page">
                <header className="ht-rs-phead"><div><h2>{title}, referee sheet</h2><p>Send this back to the desk after each game.</p></div><b>{pitchName(p)}</b></header>
                {games.map(m => (
                  <div key={m.id} className="ht-rs-pgame">
                    <div className="ht-rs-pgh"><span>{dayLabel(dayOf(m))}, {clock(m.match_time) || 'TBD'}</span><span>{stageName(m) || 'Group game'}</span></div>
                    <div className="ht-rs-pgt"><span>{m.home_team_name}</span><i /><span>v</span><i /><span>{m.away_team_name}</span></div>
                    <div className="ht-rs-pgl"><div>Scorers</div><div>Scorers</div><div>Cards</div><div>Cards</div><div>Referee</div><div>Signed</div></div>
                  </div>
                ))}
              </section>
            );
          })}
          {printMode === 'team' && allTeams.map(t => {
            const games = printGames.filter(m => teams(m).includes(t));
            return games.length > 0 && (
              <section key={t} className="ht-rs-page">
                <header className="ht-rs-phead"><div><h2>{title}</h2><p>Your games, where and when.</p></div><b>{t}</b></header>
                <table>
                  <thead><tr><th>Day</th><th>Time</th><th>Pitch</th><th>Against</th><th>Rest before</th></tr></thead>
                  <tbody>
                    {games.map((m, i) => {
                      const prev = games[i - 1];
                      const rest = prev && dayOf(prev) === dayOf(m) ? Math.round((slotTime(m) - slotTime(prev)) / 60000) - fullMinutes(prev) : NaN;
                      return (
                        <tr key={m.id}>
                          <td>{dayLabel(dayOf(m))}</td><td>{clock(m.match_time) || 'TBD'}</td><td>{m.pitch_label || ''}</td>
                          <td>{m.home_team_name === t ? m.away_team_name : m.home_team_name}</td><td>{isNaN(rest) ? '' : `${rest} min`}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
