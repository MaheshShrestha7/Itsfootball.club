'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check, X } from 'lucide-react';
import PopupPanel from '@/components/PopupPanel';
import { cupWriteupsFor } from '@/lib/cup-writeup';
import { clubResult } from '@/lib/fixtures';
import { guessFinish } from '@/lib/cup-progress';
import { clubTeamsOf, teamLabel, teamOfMatch } from '@/lib/teams';
import type { Club, ClubEvent, ClubTeam, CupFinish, Match, MatchEvent } from '@/lib/supabase/types';

const STAGES: [CupFinish['stage'], string][] = [
  ['won', 'Won the cup'], ['final', 'Runners-up'], ['semi', 'Semi-final'], ['quarter', 'Quarter-final'], ['group', 'Group stage'],
];
const WINNER_MAX = 120;
const NOTE_MAX = 1000;

/** Mark as completed for an event with linked games: asks the three things the write-up can't know */
export default function CompleteEventModal({ club, event, matches, matchEvents, clubTeams, askFinish, onConfirm, onClose }: {
  club: Pick<Club, 'id' | 'slug' | 'name' | 'short_name' | 'config'>;
  event: ClubEvent;
  matches: Match[];
  matchEvents: MatchEvent[];
  clubTeams: ClubTeam[];
  /** Migration 20261176 has run */
  askFinish: boolean;
  onConfirm: (updates: Partial<ClubEvent>) => void;
  onClose: () => void;
}) {
  const linked = matches.filter(m => m.club_id === club.id && m.event_id === event.id && clubResult(m).outcome !== null);
  const manyTeams = clubTeamsOf(clubTeams, club.id).length > 1;
  // One question per team that played, in the order their games were added
  const teams = [...new Map(linked.map(m => {
    const t = teamOfMatch(m, clubTeams);
    return [t?.id || 'club', manyTeams && t ? `the ${teamLabel(t)}` : club.short_name || club.name] as const;
  })).entries()];
  // A cup with a format set: each team's finish is guessed from its last game ("No, we're out" after the groups)
  const [finish, setFinish] = useState<Record<string, CupFinish>>(() => {
    const saved = { ...(event.cup_finish || {}) };
    if (!event.cup_format) return saved;
    for (const [key] of teams) {
      const last = linked.filter(m => (teamOfMatch(m, clubTeams)?.id || 'club') === key)
        .sort((a, b) => new Date(b.match_date).getTime() - new Date(a.match_date).getTime())[0];
      const guess = !saved[key] && last ? guessFinish(last) : null;
      if (guess) saved[key] = guess;
    }
    return saved;
  });
  const [winner, setWinner] = useState(event.cup_winner || '');
  const [note, setNote] = useState(event.writeup_note || '');

  const fields = askFinish ? { cup_finish: Object.keys(finish).length ? finish : null, cup_winner: winner.trim() || null, writeup_note: note.trim() || null } : {};
  const writeups = cupWriteupsFor({ club, event: { ...event, completed_at: event.completed_at || new Date().toISOString(), ...fields }, matches, matchEvents, clubTeams });
  const scored = linked.filter(m => m.status === 'completed' && m.home_score != null && m.away_score != null).length;
  const setStage = (key: string, stage?: CupFinish['stage']) =>
    setFinish(f => { const next = { ...f }; if (stage) next[key] = { stage, ...(stage === 'group' ? { place: f[key]?.place, through: f[key]?.through } : {}) }; else delete next[key]; return next; });
  const setGroup = (key: string, field: 'place' | 'through', value: string) =>
    setFinish(f => ({ ...f, [key]: { ...f[key], stage: 'group', [field]: Number(value) || undefined } }));

  return (
    <div style={{ position: 'fixed', inset: 0, overflowY: 'auto', overscrollBehavior: 'contain', zIndex: 999, background: 'var(--color-scrim)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <PopupPanel onClose={onClose} label={`Mark ${event.title} as completed`} className="glass-panel" style={{ margin: 'auto', width: '100%', maxWidth: '560px', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-xl)', padding: '1.5rem' }}>
        <div className="section-head">
          <h3 style={{ fontSize: 'var(--text-xl)', fontWeight: 600, color: 'var(--text-primary)' }}>Mark as completed</h3>
          <button type="button" onClick={onClose} className="admin-icon-btn" aria-label="Close"><X size={20} aria-hidden="true" /></button>
        </div>
        <p className="text-meta" style={{ margin: 0, overflowWrap: 'anywhere' }}>
          {event.title} · {linked.length} game{linked.length === 1 ? '' : 's'}{scored === linked.length ? (linked.length > 1 ? ', all with scores' : ', with a score') : `, ${scored} with a score`}
        </p>

        {askFinish && (
          <>
            {teams.map(([key, name]) => (
              <fieldset key={key} style={{ border: 0, margin: '1.1rem 0 0', padding: 0, minWidth: 0 }}>
                <legend style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.55rem', padding: 0 }}>How did {name} finish?</legend>
                <div className="admin-chips" style={{ flexWrap: 'wrap', overflow: 'visible' }}>
                  {STAGES.map(([stage, label]) => (
                    <button key={stage} type="button" className="admin-chip" aria-pressed={finish[key]?.stage === stage} onClick={() => setStage(key, stage)}>{label}</button>
                  ))}
                  <button type="button" className="admin-chip" aria-pressed={!finish[key]} onClick={() => setStage(key)}>Skip</button>
                </div>
                {finish[key]?.stage === 'group' && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', marginTop: '0.85rem' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" htmlFor={`place-${key}`}>Place in the group</label>
                      <select id={`place-${key}`} className="form-select" value={finish[key].place || ''} onChange={e => setGroup(key, 'place', e.target.value)}>
                        <option value="">Not sure</option>
                        {[1, 2, 3, 4, 5, 6, 7, 8].map(n => <option key={n} value={n}>{['1st', '2nd', '3rd'][n - 1] || `${n}th`}</option>)}
                      </select>
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" htmlFor={`through-${key}`}>Teams that went through</label>
                      <select id={`through-${key}`} className="form-select" value={finish[key].through || ''} onChange={e => setGroup(key, 'through', e.target.value)}>
                        <option value="">Not sure</option>
                        {[1, 2, 3, 4].map(n => <option key={n} value={n}>Top {n}</option>)}
                      </select>
                    </div>
                  </div>
                )}
              </fieldset>
            ))}

            <div className="form-group" style={{ marginTop: '0.85rem' }}>
              <label className="form-label" htmlFor="cup-winner">Who won the cup? <span className="text-meta">(optional)</span></label>
              <input id="cup-winner" className="form-input" maxLength={WINNER_MAX} value={winner} onChange={e => setWinner(e.target.value)} />
            </div>
            <div className="form-group" style={{ marginTop: '0.85rem' }}>
              <label className="form-label" htmlFor="writeup-note">A few words for the write-up <span className="text-meta">(optional, shown on the site)</span></label>
              <textarea id="writeup-note" className="form-input" rows={3} maxLength={NOTE_MAX} value={note} onChange={e => setNote(e.target.value)} placeholder="Thanks to everyone who came out on the day." />
              <div className="text-meta" style={{ marginTop: '0.35rem' }}>Your private notes for the committee stay in the Summary report.</div>
            </div>
          </>
        )}

        {writeups.length > 0 ? (
          <>
            {writeups.map(w => (
              <div key={w.key} style={{ marginTop: '1.1rem', padding: '0.85rem 1rem', borderRadius: 'var(--radius-lg)', background: 'rgba(var(--tint-rgb), 0.05)', border: '1px solid var(--border-subtle)', fontSize: '0.88rem', lineHeight: 1.55 }}>
                <strong style={{ color: 'var(--text-primary)' }}>The write-up will open:</strong> &ldquo;{w.writeup.lead}&rdquo;
              </div>
            ))}
            <p style={{ margin: '1rem 0 0', fontSize: '0.88rem' }}>
              <span className="admin-pill is-ok">Write-up ready</span> It goes on the event page and in News when you press Mark as completed.
            </p>
          </>
        ) : (
          <p style={{ margin: '1rem 0 0', fontSize: '0.88rem' }}>
            <span className="admin-pill is-warn">No write-up yet</span> None of the linked games has a score. Add the results and the write-up appears by itself.
          </p>
        )}

        <div className="row row-wrap" style={{ justifyContent: 'flex-end', marginTop: '1.25rem', gap: '0.5rem' }}>
          {!writeups.length && <Link href={`/${club.slug}/admin/match-center`} className="btn btn-secondary btn-sm">Add results</Link>}
          <button type="button" className="btn btn-primary btn-sm row" onClick={() => onConfirm(fields)}>
            <Check size={14} aria-hidden="true" /> <span>Mark as completed</span>
          </button>
        </div>
      </PopupPanel>
    </div>
  );
}
