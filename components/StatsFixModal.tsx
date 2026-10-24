'use client';

// Fix a match's saved player stats (Match Centre -> Fix Stats). Shows what each player got from the
// match (match_player_stats, migration 20261121); saving moves their season totals and ClubScore
// points by the difference. Matches saved before that migration have no per-match rows to fix.
import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Minus, Plus, ShieldCheck, Undo2, X } from 'lucide-react';
import { useDialog } from '@/lib/use-escape-to-close';
import { useClub } from '@/lib/club-context';
import { useAuth } from '@/lib/auth-context';
import { confirmAction } from '@/components/ConfirmDialog';
import { getDefaultClubScoreRules } from '@/lib/clubscore-defaults';
import { cleanLine, describeChange, emptyLine, lineDelta, pointChanges, type MatchStatLine } from '@/lib/match-stats';
import type { ClubMember, Match } from '@/lib/supabase/types';

interface Props {
  match: Match;
  players: ClubMember[];
  onClose: () => void;
  onFixed?: (message: string) => void;
}

const COUNTS: { key: 'minutes' | 'goals' | 'assists' | 'yellow_cards' | 'red_cards'; label: string; step: number; max: number }[] = [
  { key: 'minutes', label: 'Minutes', step: 5, max: 200 },
  { key: 'goals', label: 'Goals', step: 1, max: 50 },
  { key: 'assists', label: 'Assists', step: 1, max: 50 },
  { key: 'yellow_cards', label: 'Yellow', step: 1, max: 2 },
  { key: 'red_cards', label: 'Red', step: 1, max: 1 },
];

export default function StatsFixModal({ match, players, onClose, onFixed }: Props) {
  const { loadMatchStatLines, fixMatchStats, clubScoreRules } = useClub();
  const { user } = useAuth();
  const rules = clubScoreRules[match.club_id] || getDefaultClubScoreRules(match.club_id);
  const dialogRef = useDialog(true, onClose);

  const [saved, setSaved] = useState<MatchStatLine[] | null | undefined>(undefined); // undefined = loading
  const [edited, setEdited] = useState<Record<string, MatchStatLine>>({});
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stale = false;
    loadMatchStatLines(match.id).then(lines => { if (!stale) setSaved(lines); });
    return () => { stale = true; };
  }, [match.id, loadMatchStatLines]);

  const name = (id: string) => players.find(p => p.id === id)?.full_name || 'Former player';
  const position = (id: string) => players.find(p => p.id === id)?.player_position;
  const before = (id: string) => saved?.find(l => l.member_id === id) || emptyLine(id);
  const current = (id: string) => edited[id] || before(id);

  // Players with saved stats, then anyone added here, in that order
  const rowIds = useMemo(() => {
    const ids = (saved || []).map(l => l.member_id);
    Object.keys(edited).forEach(id => { if (!ids.includes(id)) ids.push(id); });
    return ids;
  }, [saved, edited]);

  const changes = rowIds
    .map(id => ({ id, from: before(id), to: current(id) }))
    .filter(c => Object.keys(lineDelta(c.from, c.to)).length > 0);
  const pointTotal = changes.reduce((n, c) => n + pointChanges(c.from, c.to, rules, position(c.id)).reduce((m, p) => m + p.points, 0), 0);

  const update = (id: string, patch: Partial<MatchStatLine>) => {
    setEdited(prev => {
      const next = cleanLine({ ...current(id), ...patch });
      // One Player of the Match: picking a new one takes it off the others
      if (patch.motm) {
        const out: Record<string, MatchStatLine> = {};
        rowIds.forEach(other => { if (other !== id && current(other).motm) out[other] = { ...current(other), motm: false }; });
        return { ...prev, ...out, [id]: next };
      }
      return { ...prev, [id]: next };
    });
  };

  const addPlayer = (id: string) => {
    if (!id) return;
    setEdited(prev => ({ ...prev, [id]: prev[id] || { ...emptyLine(id), played: true } }));
    setOpen(id);
    setAdding('');
  };

  const adminName = user?.full_name || 'Club Committee';
  const save = async () => {
    setBusy(true);
    setError(null);
    const res = await fixMatchStats(match.id, saved || [], rowIds.map(current), adminName);
    setBusy(false);
    if (!res.success) return setError(res.message);
    onFixed?.(res.message);
    onClose();
  };

  const undo = async () => {
    const ok = await confirmAction({
      title: 'Take the saved stats off this match?',
      message: 'Every player’s goals, assists, cards, appearances and minutes from this match come off their season totals, and the ClubScore points go with them. You can then save the match again.',
      confirmLabel: 'Take them off',
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    setError(null);
    const res = await fixMatchStats(match.id, saved || [], [], adminName, { undo: true });
    setBusy(false);
    if (!res.success) return setError(res.message);
    onFixed?.(res.message);
    onClose();
  };

  const addable = players.filter(p => !rowIds.includes(p.id));
  const score = `${match.home_team_name} ${match.home_score} – ${match.away_score} ${match.away_team_name}`;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.85)', backdropFilter: 'blur(10px)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'clamp(0px, 2vw, 1.25rem)' }}>
      <style>{`
        .sfx-row { border: 1px solid var(--border-subtle); border-radius: 12px; background: rgba(var(--tint-rgb), 0.03); }
        .sfx-row.is-changed { border-color: rgba(245, 158, 11, 0.45); background: rgba(245, 158, 11, 0.07); }
        .sfx-head { display: flex; align-items: center; gap: 0.75rem; width: 100%; padding: 0.7rem 0.9rem; background: none; border: none; color: inherit; text-align: left; cursor: pointer; min-height: 48px; font: inherit; }
        .sfx-fields { display: none; flex-wrap: wrap; gap: 0.6rem 0.9rem; align-items: flex-end; padding: 0 0.9rem 0.85rem; }
        .sfx-row.is-open .sfx-fields { display: flex; }
        .sfx-step { display: flex; align-items: center; gap: 0.3rem; }
        .sfx-step button { width: 44px; height: 44px; border-radius: 10px; border: 1px solid var(--border-medium); background: var(--bg-surface-elevated); color: var(--text-primary); display: inline-flex; align-items: center; justify-content: center; cursor: pointer; }
        .sfx-step input { width: 58px; height: 44px; box-sizing: border-box; text-align: center; font-weight: 800; padding: 0 !important; -moz-appearance: textfield; }
        .sfx-step input::-webkit-outer-spin-button, .sfx-step input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        .sfx-tick { display: flex; align-items: center; gap: 0.4rem; min-height: 44px; font-size: 0.85rem; cursor: pointer; }
        .sfx-tick input { width: 20px; height: 20px; accent-color: var(--club-primary); }
        @media (min-width: 900px) {
          .sfx-fields { display: flex; padding-top: 0; }
          .sfx-chev { display: none; }
          .sfx-step button { width: 34px; height: 34px; }
          .sfx-step input { width: 52px; height: 34px; }
          .sfx-tick { min-height: 34px; }
        }
      `}</style>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Fix player stats" className="glass-panel"
        style={{ width: '100%', maxWidth: '1100px', height: '100%', maxHeight: 'min(100%, 92vh)', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden', border: '1.5px solid var(--border-medium)' }}>
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.06em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{score}</div>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 900, color: 'var(--text-primary)', margin: '0.15rem 0' }}>Fix player stats</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', margin: 0 }}>
              Change anything below: each player&apos;s season totals and ClubScore points move to match.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="touch-target" style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <X size={22} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {saved === undefined && <p style={{ color: 'var(--text-muted)' }}>Loading the saved stats…</p>}
          {saved === null && (
            <div style={{ background: 'rgba(var(--tint-rgb), 0.04)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '1rem', color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: 1.5 }}>
              This match&apos;s stats were saved before they could be fixed here, so there&apos;s nothing to change on this screen.
              Matches saved from now on can be fixed any time.
            </div>
          )}
          {saved && rowIds.map(id => {
            const line = current(id);
            const changed = describeChange(before(id), line);
            const isOpen = open === id;
            const summary = line.played
              ? [`${line.minutes}'`, line.goals && `${line.goals} goal${line.goals > 1 ? 's' : ''}`, line.assists && `${line.assists} assist${line.assists > 1 ? 's' : ''}`,
                 line.yellow_cards && `${line.yellow_cards} yellow`, line.red_cards && 'red card', line.clean_sheet && 'clean sheet', line.motm && 'Player of the Match'].filter(Boolean).join(' · ')
              : 'Didn’t play';
            return (
              <div key={id} className={`sfx-row${changed.length ? ' is-changed' : ''}${isOpen ? ' is-open' : ''}`} data-stats-row={name(id)}>
                <button type="button" className="sfx-head" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : id)}>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <strong style={{ display: 'block', color: 'var(--text-primary)', fontSize: '0.92rem' }}>{name(id)}{position(id) ? <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}> · {position(id)}</span> : null}</strong>
                    <span style={{ fontSize: '0.78rem', color: changed.length ? 'var(--c-amber)' : 'var(--text-muted)' }}>
                      {changed.length ? `Changed: ${changed.join(', ')}` : summary}
                    </span>
                  </span>
                  <ChevronDown className="sfx-chev" size={18} style={{ transform: isOpen ? 'rotate(180deg)' : undefined, color: 'var(--text-muted)' }} aria-hidden="true" />
                </button>
                <div className="sfx-fields">
                  <label className="sfx-tick"><input type="checkbox" checked={line.played} onChange={e => update(id, { played: e.target.checked, ...(e.target.checked ? {} : { minutes: 0 }) })} />Played</label>
                  {COUNTS.map(f => (
                    <div key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700 }}>{f.label}</span>
                      <span className="sfx-step">
                        <button type="button" aria-label={`Fewer ${f.label.toLowerCase()} for ${name(id)}`} onClick={() => update(id, { [f.key]: line[f.key] - f.step })}><Minus size={16} /></button>
                        <input type="number" className="form-input" min={0} max={f.max} value={line[f.key]} aria-label={`${f.label} for ${name(id)}`}
                          onChange={e => update(id, { [f.key]: Number(e.target.value) })} />
                        <button type="button" aria-label={`More ${f.label.toLowerCase()} for ${name(id)}`} onClick={() => update(id, { [f.key]: line[f.key] + f.step })}><Plus size={16} /></button>
                      </span>
                    </div>
                  ))}
                  <label className="sfx-tick"><input type="checkbox" checked={line.clean_sheet} onChange={e => update(id, { clean_sheet: e.target.checked })} />Clean sheet</label>
                  <label className="sfx-tick"><input type="radio" name="sfx-motm" checked={line.motm} onChange={() => update(id, { motm: true })} />Player of the Match</label>
                </div>
              </div>
            );
          })}
          {saved && addable.length > 0 && (
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', marginTop: '0.4rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Someone missing?
              <select className="form-select" style={{ width: 'auto', minHeight: 44 }} value={adding} onChange={e => addPlayer(e.target.value)} aria-label="Add a player who played">
                <option value="">Add a player who played…</option>
                {addable.map(p => <option key={p.id} value={p.id}>{p.jersey_number ? `#${p.jersey_number} ` : ''}{p.full_name}</option>)}
              </select>
            </label>
          )}
        </div>

        {error && <div role="alert" style={{ padding: '0.6rem 1.25rem', color: 'var(--c-red)', fontSize: '0.85rem', fontWeight: 600 }}>{error}</div>}

        {saved && (
          <div style={{ padding: '0.9rem 1.25rem', borderTop: '1px solid var(--border-subtle)', display: 'flex', flexWrap: 'wrap', gap: '0.6rem', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(var(--dk-10-15-23), 0.95)' }}>
            <span style={{ fontSize: '0.82rem', color: changes.length ? 'var(--c-amber)' : 'var(--text-muted)', flex: '1 1 220px' }} data-stats-summary>
              {changes.length
                ? `${changes.length} player${changes.length > 1 ? 's' : ''} changed · ${pointTotal >= 0 ? '+' : ''}${pointTotal} ClubScore points`
                : 'No changes yet.'}
            </span>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', flex: '1 1 320px', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-secondary btn-sm touch-target" onClick={undo} disabled={busy} style={{ color: 'var(--c-red)', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                <Undo2 size={15} /> Undo saved stats
              </button>
              <button type="button" className="btn btn-secondary btn-sm touch-target" onClick={onClose} disabled={busy}>Cancel</button>
              <button type="button" className="btn btn-primary btn-sm touch-target" onClick={save} disabled={busy || changes.length === 0} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontWeight: 900 }}>
                <ShieldCheck size={15} /> {busy ? 'Saving…' : changes.length ? `Save ${changes.length} change${changes.length > 1 ? 's' : ''}` : 'Save changes'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
