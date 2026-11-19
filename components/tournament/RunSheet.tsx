'use client';

import React, { useMemo, useState } from 'react';
import { Match } from '@/lib/supabase/types';
import { AlertCircle, ArrowDown, ArrowUp, GripVertical, Printer } from 'lucide-react';
import { DATE_LOCALE } from '@/lib/dates';
import { runSheetMove } from '@/lib/tournament-engine';

type Slot = Pick<Match, 'match_date' | 'match_time' | 'pitch_label'>;
export type SlotChange = Slot & { id: string };

const dayOf = (s: Slot) => s.match_date?.slice(0, 10) || '';
const keyOf = (s: Slot) => `${dayOf(s)} ${s.match_time || ''}`;
const bySlot = (a: Match, b: Match) =>
  keyOf(a).localeCompare(keyOf(b)) || (a.pitch_label || '').localeCompare(b.pitch_label || '', undefined, { numeric: true }) || (a.tournament_match_number ?? 0) - (b.tournament_match_number ?? 0);

function clock(time?: string | null, plus = 0) {
  if (!time) return '';
  const [h, m] = time.split(':').map(Number);
  if (isNaN(h)) return time;
  const d = new Date(2000, 0, 1, h, (m || 0) + plus);
  return d.toLocaleTimeString(DATE_LOCALE, { hour: 'numeric', minute: '2-digit' });
}
const dayLabel = (day: string) => (day ? new Date(`${day}T12:00`).toLocaleDateString(DATE_LOCALE, { weekday: 'long', day: 'numeric', month: 'long' }) : 'No date yet');

/** The Fixtures tab's spreadsheet view: times stay fixed down the left and upcoming games are
 *  dragged between them (the games in between shift by one slot). Played and live games stay put. */
export default function RunSheet({ matches, matchMinutes, onSave, onSelectMatch }: {
  matches: Match[];
  matchMinutes?: number | null;
  onSave: (changes: SlotChange[]) => void;
  onSelectMatch: (m: Match) => void;
}) {
  const base = useMemo(() => [...matches].sort(bySlot), [matches]);
  const movable = (m: Match) => m.status === 'upcoming';
  const baseIds = base.filter(movable).map(m => m.id);
  const [order, setOrder] = useState<string[] | null>(null);
  const [highlight, setHighlight] = useState('');
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

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

  // Same time = a team in two games in one slot; back to back = a team in the slot just before, same day
  const teams = (m: Match) => [m.home_team_name, m.away_team_name].filter(n => n && n !== 'TBD');
  const inSlot = new Map<string, string[]>();
  rows.forEach(({ m, slot }) => { if (slot.match_time) inSlot.set(keyOf(slot), [...(inSlot.get(keyOf(slot)) || []), ...teams(m)]); });
  const slotKeys = [...inSlot.keys()].sort();
  const restBefore = (m: Match, slot: Slot) => {
    const prev = slotKeys[slotKeys.indexOf(keyOf(slot)) - 1];
    return prev && prev.slice(0, 10) === dayOf(slot) ? teams(m).filter(t => inSlot.get(prev)!.includes(t)) : [];
  };
  const flags = rows.map(({ m, slot }) => {
    const here = inSlot.get(keyOf(slot)) || [];
    if (teams(m).some(t => here.filter(x => x === t).length > 1)) return 'clash';
    return restBefore(m, slot).length ? 'b2b' : '';
  });
  const b2bTeams = [...new Set(rows.flatMap(r => (movable(r.m) ? restBefore(r.m, r.slot) : [])))];
  const clashes = flags.includes('clash');
  const allTeams = [...new Set(base.flatMap(teams))].sort();

  const move = (id: string, toId: string) => {
    if (id === toId) return;
    setOrder(runSheetMove(pending, pending.indexOf(id), pending.indexOf(toId)));
  };
  const nudge = (id: string, step: number) => {
    const j = pending.indexOf(id) + step;
    if (j >= 0 && j < pending.length) setOrder(runSheetMove(pending, pending.indexOf(id), j));
  };

  return (
    <div className="ht-rs">
      <div className="ht-rs-bar">
        <p className="ht-hint">Drag a game onto another time to move it there. The times stay where they are and the games in between shift along. On a phone, use the arrows.</p>
        <div className="ht-rs-tools">
          <label className="sr-only" htmlFor="ht-rs-hi">Highlight a team</label>
          <select id="ht-rs-hi" className="ht-rs-select" value={highlight} onChange={e => setHighlight(e.target.value)}>
            <option value="">Highlight a team</option>
            {allTeams.map(t => <option key={t} value={t}>Highlight {t}</option>)}
          </select>
          <button type="button" className="btn btn-sm btn-secondary ht-rs-btn" onClick={() => window.print()}>
            <Printer size={14} aria-hidden /> Print run sheet
          </button>
        </div>
      </div>

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

      <div className="ht-rs-sheet" role="table" aria-label="Run sheet">
        <div className="ht-rs-row is-head" role="row">
          <span /><span>Start</span><span>End</span><span>Pitch</span><span className="ht-rs-home">Home team</span><span>Goals</span><span /><span>Goals</span><span>Away team</span><span /><span />
        </div>
        {rows.map(({ m, slot }, i) => {
          const day = dayOf(slot);
          const header = i === 0 || dayOf(rows[i - 1].slot) !== day ? <div key={`d-${day}`} className="ht-rs-row is-day" role="row">{dayLabel(day)}</div> : null;
          const canMove = movable(m);
          const played = m.status === 'completed';
          const end = matchMinutes ? clock(slot.match_time, matchMinutes) : '';
          const at = pending.indexOf(m.id);
          const cls = ['ht-rs-row', !canMove && 'is-locked', highlight && teams(m).includes(highlight) && 'is-hi', dragId === m.id && 'is-dragging', overId === m.id && dragId !== m.id && 'is-over'].filter(Boolean).join(' ');
          return (
            <React.Fragment key={m.id}>
              {header}
              <div
                className={cls}
                role="row"
                draggable={canMove}
                onDragStart={canMove ? e => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', m.id); setDragId(m.id); } : undefined}
                onDragOver={canMove ? e => { if (dragId) { e.preventDefault(); setOverId(m.id); } } : undefined}
                onDrop={canMove ? e => { e.preventDefault(); if (dragId) move(dragId, m.id); setDragId(null); setOverId(null); } : undefined}
                onDragEnd={() => { setDragId(null); setOverId(null); }}
              >
                <span className="ht-rs-handle" aria-hidden>{canMove && <GripVertical size={16} />}</span>
                <span className="ht-rs-time">
                  {clock(slot.match_time) || 'TBD'}
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
                <span className="ht-rs-flag-cell">
                  {played ? <span className="ht-state" data-tone="ok">Played</span>
                    : m.status === 'live' ? <span className="ht-state" data-tone="due">Live</span>
                    : flags[i] === 'clash' ? <span className="ht-state" data-tone="due">Same time</span>
                    : flags[i] === 'b2b' ? <span className="ht-state" data-tone="warn">Back to back</span> : null}
                </span>
                <span className="ht-rs-moves">
                  {canMove && <>
                    <button type="button" className="ht-icon-btn ht-rs-mv" aria-label={`Move ${m.home_team_name} v ${m.away_team_name} earlier`} disabled={at <= 0} onClick={() => nudge(m.id, -1)}><ArrowUp size={15} /></button>
                    <button type="button" className="ht-icon-btn ht-rs-mv" aria-label={`Move ${m.home_team_name} v ${m.away_team_name} later`} disabled={at >= pending.length - 1} onClick={() => nudge(m.id, 1)}><ArrowDown size={15} /></button>
                  </>}
                </span>
              </div>
            </React.Fragment>
          );
        })}
      </div>

      {changes.length > 0 && (
        <div className="ht-rs-save" role="status">
          <p><b>{changes.length} {changes.length === 1 ? 'game' : 'games'} moved.</b> Teams and spectators see the new times once you save.</p>
          <div className="ht-rs-tools">
            <button type="button" className="btn btn-sm btn-secondary ht-rs-btn" onClick={() => setOrder(null)}>Undo</button>
            <button type="button" className="btn btn-sm btn-primary ht-rs-btn" onClick={() => { onSave(changes); setOrder(null); }}>Save new times</button>
          </div>
        </div>
      )}

      <div className="ht-rs-legend">
        <span><span className="ht-state" data-tone="ok">Played</span> stays in its slot</span>
        <span><span className="ht-state" data-tone="warn">Back to back</span> no break between games</span>
        <span><span className="ht-state" data-tone="due">Same time</span> a team is in two games at once</span>
      </div>
    </div>
  );
}
