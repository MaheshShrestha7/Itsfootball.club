'use client';

import React, { useState } from 'react';
import { ArrowDown, ArrowUp, GripVertical, X } from 'lucide-react';
import type { Match, TieBreaker, TournamentParticipant } from '@/lib/supabase/types';
import { STANDARD_TIE_BREAKERS, TIE_BREAKERS, computeStandings, runSheetMove, tieBreakerLine } from '@/lib/tournament-engine';

// The worked example: three teams on 6 points (they beat each other in a circle and all beat
// Fewa FC), so the table re-sorts as the rules change
const EX_TEAMS = ['Austral Nepalese CC', 'Macarthur Nepalese FC', 'Sg Friends FC', 'Fewa FC'];
const EX_PARTS = EX_TEAMS.map((name, i) => ({ id: `ex${i}`, tournament_id: 'ex', team_type: 'external', name, short_name: name.slice(0, 4) })) as TournamentParticipant[];
const EX_MATCHES = ([[0, 1, 1, 0], [1, 2, 2, 1], [2, 0, 1, 0], [0, 3, 4, 0], [1, 3, 5, 1], [2, 3, 3, 2]] as const).map(([h, a, hs, as], i) => ({
  id: `exm${i}`, tournament_id: 'ex', tournament_stage: 'group', status: 'completed', match_date: '2026-12-05',
  home_team_name: EX_TEAMS[h], away_team_name: EX_TEAMS[a], home_score: hs, away_score: as,
})) as Match[];
const EX_CARDS = new Map([[EX_TEAMS[0], 1], [EX_TEAMS[1], 4], [EX_TEAMS[2], 0], [EX_TEAMS[3], 2]]);

/** The Tie-breakers section of the tournament form: points first, then the rules in order.
 *  Drag or use the arrows to reorder, ✕ to remove, Add rule to bring one back. */
export default function TieBreakersEditor({ value, onChange }: { value: TieBreaker[]; onChange: (next: TieBreaker[]) => void }) {
  const left = (Object.keys(TIE_BREAKERS) as TieBreaker[]).filter(r => !value.includes(r));
  const [pick, setPick] = useState<TieBreaker | ''>('');
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const chosen = pick && left.includes(pick) ? pick : left[0];
  const move = (from: number, to: number) => onChange(runSheetMove(value, from, to));

  return (
    <fieldset className="ht-fieldset ht-tb">
      <legend>Tie-breakers</legend>
      <p className="ht-lede">When teams finish on the same points, these rules decide who goes higher, top first. Drag them into order (or use the arrows), remove any you don’t use and add others.</p>
      <ol className="ht-tb-list">
        <li className="ht-tb-rule is-fixed">
          <span className="ht-tb-grip" />
          <span className="ht-tb-num">1</span>
          <span className="ht-tb-name">Points<small>Always first</small></span>
        </li>
        {value.map((r, i) => (
          <li
            key={r}
            className={`ht-tb-rule${dragFrom === i ? ' is-dragging' : ''}${over === i && dragFrom !== i ? ' is-over' : ''}`}
            draggable
            onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', r); setDragFrom(i); }}
            onDragOver={e => { if (dragFrom !== null) { e.preventDefault(); setOver(i); } }}
            onDrop={e => { e.preventDefault(); if (dragFrom !== null) move(dragFrom, i); setDragFrom(null); setOver(null); }}
            onDragEnd={() => { setDragFrom(null); setOver(null); }}
          >
            <span className="ht-tb-grip" aria-hidden><GripVertical size={16} /></span>
            <span className="ht-tb-num">{i + 2}</span>
            <span className="ht-tb-name">{TIE_BREAKERS[r].name}<small>{TIE_BREAKERS[r].note}</small></span>
            <span className="ht-tb-acts">
              <button type="button" className="ht-icon-btn" aria-label={`Move ${TIE_BREAKERS[r].name} up`} disabled={i === 0} onClick={() => move(i, i - 1)}><ArrowUp size={15} /></button>
              <button type="button" className="ht-icon-btn" aria-label={`Move ${TIE_BREAKERS[r].name} down`} disabled={i === value.length - 1} onClick={() => move(i, i + 1)}><ArrowDown size={15} /></button>
              <button type="button" className="ht-icon-btn is-danger" aria-label={`Remove ${TIE_BREAKERS[r].name}`} onClick={() => onChange(value.filter(x => x !== r))}><X size={15} /></button>
            </span>
          </li>
        ))}
      </ol>
      <div className="ht-tb-add">
        {left.length > 0 && <>
          <label className="sr-only" htmlFor="ht-tb-pick">Add a rule</label>
          <select id="ht-tb-pick" className="form-select ht-tb-select" value={chosen} onChange={e => setPick(e.target.value as TieBreaker)}>
            {left.map(r => <option key={r} value={r}>{TIE_BREAKERS[r].name}</option>)}
          </select>
          <button type="button" className="btn btn-sm btn-secondary" onClick={() => onChange([...value, chosen])}>Add rule</button>
        </>}
        <button type="button" className="ht-link-btn" onClick={() => onChange(STANDARD_TIE_BREAKERS)}>Use the standard order</button>
      </div>
      <p className="ht-hint">If teams are still level after every rule, they share the place.</p>
      <div className="ht-tb-example" aria-live="polite">
        <h3>How it works</h3>
        <p>Three teams finish on 6 points. Change the rules and this table re-sorts.</p>
        <div className="ht-table-wrap">
          <table className="ht-table">
            <caption className="sr-only">Example standings with these tie-breakers</caption>
            <thead><tr><th scope="col">#</th><th scope="col">Team</th><th scope="col">Pts</th><th scope="col">GD</th><th scope="col">GF</th><th scope="col">W</th><th scope="col">Cards</th></tr></thead>
            <tbody>
              {computeStandings(EX_MATCHES, EX_PARTS, { tieBreakers: value, cardPoints: EX_CARDS, lotSeed: 'example' }).map((t, i) => (
                <tr key={t.name}>
                  <td>{i + 1}</td><th scope="row">{t.name}</th><td>{t.points}</td><td>{t.goal_difference > 0 ? `+${t.goal_difference}` : t.goal_difference}</td><td>{t.goals_for}</td><td>{t.won}</td><td>{EX_CARDS.get(t.name)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="ht-tb-public">On the public standings: <b>{tieBreakerLine(value)}</b></p>
      </div>
    </fieldset>
  );
}
