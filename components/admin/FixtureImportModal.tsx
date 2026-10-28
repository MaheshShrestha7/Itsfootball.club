'use client';

import React, { useMemo, useState } from 'react';
import { Upload, X, CheckCircle2, AlertTriangle, MinusCircle, Copy, FileDown } from 'lucide-react';
import { useDialog } from '@/lib/use-escape-to-close';
import type { Club, ClubTeam, Match, MatchFormat } from '@/lib/supabase/types';
import { DRAW_TEMPLATE, guessOurName, judgeRow, readDraw, type RowVerdict } from '@/lib/fixture-import';
import { teamLabel } from '@/lib/teams';
import { DEFAULT_CREST } from '@/lib/crest';
import { DATE_LOCALE } from '@/lib/dates';

// Admin -> Fixtures -> Import a draw. Paste the season's draw from the league's site or a
// spreadsheet (or choose a CSV file), check every row, then add the new fixtures in one go.

interface Props {
  club: Club;
  teams: ClubTeam[];
  defaultTeamId: string;
  season: string;
  /** This club's fixtures, to spot ones already added */
  existing: Match[];
  onClose: () => void;
  onImport: (fixtures: Omit<Match, 'id' | 'created_at'>[]) => void;
}

const MAX_FILE = 512 * 1024;
const STATUS_STYLE: Record<RowVerdict['kind'], { label: string; color: string; Icon: React.ElementType }> = {
  new: { label: 'Add', color: 'var(--c-green)', Icon: CheckCircle2 },
  duplicate: { label: 'Already added', color: 'var(--text-muted)', Icon: Copy },
  skip: { label: 'Skip', color: 'var(--text-muted)', Icon: MinusCircle },
  problem: { label: 'Fix', color: 'var(--c-amber)', Icon: AlertTriangle },
};

const localDay = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const showDay = (ymd: string) =>
  new Date(`${ymd}T12:00:00`).toLocaleDateString(DATE_LOCALE, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

export default function FixtureImportModal({ club, teams, defaultTeamId, season, existing, onClose, onImport }: Props) {
  const dialogRef = useDialog(true, onClose);
  const [text, setText] = useState('');
  const [fileError, setFileError] = useState<string | null>(null);
  const [teamId, setTeamId] = useState(defaultTeamId);
  const [ourNameEdit, setOurNameEdit] = useState<string | null>(null);
  const [competition, setCompetition] = useState('League');
  const [defaultTime, setDefaultTime] = useState('09:00');

  const draw = useMemo(() => readDraw(text), [text]);
  const guessed = useMemo(() => guessOurName(draw.rows, [club.name, club.short_name || '']), [draw.rows, club.name, club.short_name]);
  const ourName = ourNameEdit ?? guessed;

  const existingKeys = useMemo(
    () => existing.map(m => ({ date: localDay(m.match_date), opponent: m.opponent_name || (m.is_club_home ? m.away_team_name : m.home_team_name) })),
    [existing]
  );
  const judged = useMemo(() => draw.rows.map(row => ({ row, verdict: judgeRow(row, ourName, existingKeys) })), [draw.rows, ourName, existingKeys]);
  const adding = judged.filter(j => j.verdict.kind === 'new');
  const problems = judged.filter(j => j.verdict.kind === 'problem').length;

  const readFile = async (file: File | undefined) => {
    setFileError(null);
    if (!file) return;
    if (file.size > MAX_FILE) return setFileError('That file is too big. A season draw is usually well under 100 KB.');
    if (!/\.(csv|txt|tsv)$/i.test(file.name)) return setFileError('Choose a .csv file. In Excel or Google Sheets, use File > Download / Save as > CSV.');
    setText(await file.text());
  };

  const team = teams.find(t => t.id === teamId);
  const format: MatchFormat | undefined = team?.match_format === '7v7' || team?.match_format === '9v9' ? team.match_format : undefined;

  const add = () => {
    const fixtures = adding.map(({ row, verdict }): Omit<Match, 'id' | 'created_at'> => {
      const v = verdict as Extract<RowVerdict, { kind: 'new' }>;
      const home = v.isHome ? club.name : v.opponent;
      const away = v.isHome ? v.opponent : club.name;
      const [y, mo, d] = row.date!.split('-').map(Number);
      const [h, mi] = (row.time || defaultTime).split(':').map(Number);
      const short = v.opponent.split(/\s+/).filter(Boolean).map(w => w[0]).join('').slice(0, 4).toUpperCase() || v.opponent.slice(0, 3).toUpperCase();
      return {
        club_id: club.id,
        title: `${home} vs ${away}`,
        match_type: 'friendly',
        opponent_name: v.opponent,
        opponent_short_name: short,
        competition: row.competition || competition.trim() || 'League',
        season,
        home_team_name: home,
        away_team_name: away,
        home_team_logo: v.isHome ? club.logo_url || '' : DEFAULT_CREST,
        away_team_logo: v.isHome ? DEFAULT_CREST : club.logo_url || '',
        is_club_home: v.isHome,
        match_date: new Date(y, mo - 1, d, h, mi).toISOString(),
        match_time: row.time || defaultTime,
        venue: row.venue || (v.isHome ? club.stadium_name || '' : ''),
        description: row.round ? `Round ${row.round.replace(/^(round|rd)\s*/i, '')}` : '',
        status: 'upcoming',
        home_score: 0,
        away_score: 0,
        current_minute: 0,
        added_time: 0,
        period: 'pre_match',
        door_qr_checkin_enabled: true,
        team_id: teamId || null,
        ...(format ? { match_format: format } : {}),
      };
    });
    onImport(fixtures);
  };

  const downloadTemplate = () => {
    const url = URL.createObjectURL(new Blob([DRAW_TEMPLATE], { type: 'text/csv' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: 'fixtures-template.csv' });
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.8)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="fixture-import-title" className="glass-panel"
        style={{ maxWidth: 'min(900px, calc(100vw - 2rem))', width: '100%', maxHeight: '92vh', overflowY: 'auto', padding: 'clamp(1rem, 3vw, 2rem)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border-medium)', background: 'var(--bg-surface-elevated)' }}>
        <div className="section-head">
          <h2 id="fixture-import-title" style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-primary)' }}>Import a season&apos;s fixtures</h2>
          <button type="button" onClick={onClose} aria-label="Close" style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>
        <p className="text-body" style={{ marginBottom: '1rem' }}>
          Copy the draw from your league&apos;s website or a spreadsheet and paste it below, or choose a CSV file. The first line needs
          column names: at least <strong>Date</strong>, <strong>Home</strong> and <strong>Away</strong>, plus <strong>Time</strong>,{' '}
          <strong>Venue</strong> and <strong>Round</strong> if you have them. Games between two other clubs and byes are skipped.
        </p>

        <div className="row row-wrap" style={{ marginBottom: '0.75rem' }}>
          <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
            <Upload size={14} /> Choose CSV file
            <input type="file" accept=".csv,.tsv,.txt,text/csv" hidden onChange={e => { void readFile(e.target.files?.[0]); e.target.value = ''; }} />
          </label>
          <button type="button" className="btn btn-secondary btn-sm" onClick={downloadTemplate}><FileDown size={14} /> Example file</button>
        </div>
        {fileError && <p role="alert" className="text-note" style={{ color: 'var(--c-red)', marginBottom: '0.75rem' }}>{fileError}</p>}

        <div className="form-group">
          <label htmlFor="fixture-import-text" className="form-label">Draw</label>
          <textarea id="fixture-import-text" className="form-textarea" rows={6} value={text} onChange={e => setText(e.target.value)}
            placeholder={'Round,Date,Time,Home,Away,Venue\n1,14/03/2027,9:00am,Riverside FC,Hills United,Riverside Oval'}
            style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }} />
        </div>

        {text.trim() && draw.missing.length > 0 && (
          <p role="alert" className="text-note" style={{ color: 'var(--c-amber)', marginBottom: '1rem' }}>
            The first line needs a column called {draw.missing.map(m => m[0].toUpperCase() + m.slice(1)).join(', ')}.
          </p>
        )}

        {draw.rows.length > 0 && (
          <>
            <div className="form-row-2" style={{ gap: '1rem' }}>
              <div className="form-group">
                <label htmlFor="fixture-import-ours" className="form-label">Our team&apos;s name in the draw</label>
                <input id="fixture-import-ours" className="form-input" value={ourName} onChange={e => setOurNameEdit(e.target.value)} />
                <span className="text-note">Rows with this name in Home or Away are added.</span>
              </div>
              {teams.length > 1 && (
                <div className="form-group">
                  <label htmlFor="fixture-import-team" className="form-label">Team</label>
                  <select id="fixture-import-team" className="form-select" value={teamId} onChange={e => setTeamId(e.target.value)}>
                    {teams.map(t => <option key={t.id} value={t.id}>{teamLabel(t)}</option>)}
                  </select>
                </div>
              )}
              <div className="form-group">
                <label htmlFor="fixture-import-comp" className="form-label">Competition</label>
                <input id="fixture-import-comp" className="form-input" value={competition} onChange={e => setCompetition(e.target.value)} />
                <span className="text-note">Used when the draw has no competition column. Season: {season}.</span>
              </div>
              <div className="form-group">
                <label htmlFor="fixture-import-time" className="form-label">Kick-off when the draw has none</label>
                <input id="fixture-import-time" type="time" className="form-input" value={defaultTime} onChange={e => setDefaultTime(e.target.value || '09:00')} />
              </div>
            </div>

            <p className="text-meta" style={{ marginBottom: '0.5rem' }}>
              {adding.length} to add · {judged.filter(j => j.verdict.kind === 'duplicate').length} already added · {judged.filter(j => j.verdict.kind === 'skip').length} skipped
              {problems > 0 && <> · <span style={{ color: 'var(--c-amber)' }}>{problems} to fix</span></>}
            </p>
            <div style={{ overflowX: 'auto', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', marginBottom: '1rem' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ background: 'rgba(var(--tint-rgb), 0.04)', textAlign: 'left' }}>
                    {['', 'Date', 'Fixture', 'Venue'].map(h => <th key={h} scope="col" style={{ padding: '0.5rem 0.7rem', fontWeight: 700 }}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {judged.map(({ row, verdict }) => {
                    const s = STATUS_STYLE[verdict.kind];
                    const note = 'reason' in verdict ? verdict.reason : verdict.kind === 'duplicate' ? 'Already on your fixture list' : null;
                    return (
                      <tr key={row.line} style={{ borderTop: '1px solid var(--border-subtle)', opacity: verdict.kind === 'skip' || verdict.kind === 'duplicate' ? 0.6 : 1 }}>
                        <td style={{ padding: '0.45rem 0.7rem', whiteSpace: 'nowrap', color: s.color, fontWeight: 700 }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}><s.Icon size={14} aria-hidden="true" /> {s.label}</span>
                        </td>
                        <td style={{ padding: '0.45rem 0.7rem', whiteSpace: 'nowrap' }}>
                          {row.date ? showDay(row.date) : row.dateText || '-'}
                          <div className="text-meta">{row.time || row.timeText || `${defaultTime} (default)`}{row.round ? ` · Round ${row.round.replace(/^(round|rd)\s*/i, '')}` : ''}</div>
                        </td>
                        <td style={{ padding: '0.45rem 0.7rem' }}>
                          {row.home} v {row.away}
                          {note && <div className="text-meta" style={{ color: verdict.kind === 'problem' ? 'var(--c-amber)' : undefined }}>Line {row.line}: {note}</div>}
                        </td>
                        <td style={{ padding: '0.45rem 0.7rem' }}>{row.venue || '-'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-primary" disabled={!adding.length} onClick={add}>
            {adding.length ? `Add ${adding.length} fixture${adding.length === 1 ? '' : 's'}` : 'Nothing to add yet'}
          </button>
        </div>
        {problems > 0 && adding.length > 0 && (
          <p className="text-note" style={{ textAlign: 'right', marginTop: '0.5rem' }}>Rows marked Fix are left out. Correct them in the draw to add them too.</p>
        )}
      </div>
    </div>
  );
}
