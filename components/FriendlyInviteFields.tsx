'use client';

import { Plus, X } from 'lucide-react';
import type { ClubTeam, ClubTeamFormat } from '@/lib/supabase/types';
import { FORMAT_LABEL, FRIENDLY_FORMATS, MAX_FRIENDLY_DATES, type FriendlyDate, type FriendlyHost } from '@/lib/friendlies';
import { DEFAULT_HALF_MINUTES, MAX_HALF_MINUTES, MIN_HALF_MINUTES } from '@/lib/match-length';
import { todayIso } from '@/lib/finance';

/** What the visitor types; sent to /api/contact as `friendly` and checked there (lib/friendlies.ts) */
export interface FriendlyForm {
  team_id: string;
  their_club: string;
  their_team: string;
  format: ClubTeamFormat;
  /** '' = the format's usual length */
  half: string;
  dates: FriendlyDate[];
  host: FriendlyHost;
  their_ground: string;
}

export function emptyFriendlyForm(team?: ClubTeam): FriendlyForm {
  return {
    team_id: team?.id || '',
    their_club: '',
    their_team: '',
    format: team?.match_format || '11v11',
    half: team?.half_minutes ? String(team.half_minutes) : '',
    dates: [{ date: '', time: '' }],
    host: 'either',
    their_ground: '',
  };
}

export function friendlyPayload(f: FriendlyForm, teamName: string) {
  return {
    their_club: f.their_club,
    their_team: f.their_team,
    format: f.format,
    half_minutes: f.half.trim() === '' ? null : Number(f.half),
    dates: f.dates.filter(d => d.date),
    host: f.host,
    their_ground: f.host === 'us' ? '' : f.their_ground,
    team_name: teamName,
  };
}

const teamMeta = (t: ClubTeam) =>
  [t.age_group || 'Open age', FORMAT_LABEL[t.match_format], t.half_minutes ? `usually 2 × ${t.half_minutes} min` : null].filter(Boolean).join(' · ');

/**
 * The friendly-invitation part of the contact form: which of our teams, their team, the game, up
 * to three dates and who hosts. Name, email and phone stay in the contact form around it.
 */
export default function FriendlyInviteFields({ teams, value, onChange, crest }: {
  teams: ClubTeam[];
  value: FriendlyForm;
  onChange: (next: FriendlyForm) => void;
  crest?: string;
}) {
  const set = (patch: Partial<FriendlyForm>) => onChange({ ...value, ...patch });
  const team = teams.find(t => t.id === value.team_id);
  const setDate = (i: number, patch: Partial<FriendlyDate>) =>
    set({ dates: value.dates.map((d, j) => (j === i ? { ...d, ...patch } : d)) });
  const today = todayIso(new Date());
  const usualHalf = DEFAULT_HALF_MINUTES[value.format] ?? 45;

  return (
    <div className="fi">
      {teams.length > 1 ? (
        <div className="form-group">
          <label htmlFor="fi-team" className="form-label">Which of our teams? *</label>
          <select id="fi-team" className="form-select" value={value.team_id} required
            onChange={e => {
              const next = teams.find(t => t.id === e.target.value);
              set({ team_id: e.target.value, ...(next ? { format: next.match_format, half: next.half_minutes ? String(next.half_minutes) : '' } : {}) });
            }}>
            <option value="" disabled>Pick a team</option>
            {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          {team && <p className="text-note fi-help">{teamMeta(team)}</p>}
        </div>
      ) : team ? (
        <div className="fi-team">
          {crest ? <img src={crest} alt="" width={36} height={36} /> : null}
          <span><b>{team.name}</b><small>{teamMeta(team)}</small></span>
        </div>
      ) : null}

      <p className="fi-h">Your team</p>
      <div className="form-row-2" style={{ gap: '1rem' }}>
        <div className="form-group">
          <label htmlFor="fi-club" className="form-label">Your club *</label>
          <input id="fi-club" className="form-input" required maxLength={120} autoComplete="organization"
            placeholder="e.g. Hills Rovers FC" value={value.their_club} onChange={e => set({ their_club: e.target.value })} />
        </div>
        <div className="form-group">
          <label htmlFor="fi-their-team" className="form-label">Your team *</label>
          <input id="fi-their-team" className="form-input" required maxLength={80}
            placeholder="e.g. Reserves, U14 Girls" value={value.their_team} onChange={e => set({ their_team: e.target.value })} />
        </div>
      </div>
      <div className="form-row-2" style={{ gap: '1rem' }}>
        <div className="form-group">
          <label htmlFor="fi-format" className="form-label">Format</label>
          <select id="fi-format" className="form-select" value={value.format} onChange={e => set({ format: e.target.value as ClubTeamFormat })}>
            {FRIENDLY_FORMATS.map(f => <option key={f} value={f}>{FORMAT_LABEL[f]}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="fi-half" className="form-label">Each half (minutes)</label>
          <input id="fi-half" className="form-input" type="number" inputMode="numeric" min={MIN_HALF_MINUTES} max={MAX_HALF_MINUTES}
            placeholder={String(usualHalf)} value={value.half} onChange={e => set({ half: e.target.value })} />
        </div>
      </div>

      <p className="fi-h">When and where</p>
      <fieldset className="fi-dates">
        <legend className="form-label">Dates that suit you (up to {MAX_FRIENDLY_DATES}) *</legend>
        {value.dates.map((d, i) => (
          <div key={i} className="fi-date">
            <input className="form-input" type="date" min={today} required={i === 0} aria-label={`Date ${i + 1}`}
              value={d.date} onChange={e => setDate(i, { date: e.target.value })} />
            <input className="form-input" type="time" aria-label={`Kick-off ${i + 1} (optional)`}
              value={d.time} onChange={e => setDate(i, { time: e.target.value })} />
            {value.dates.length > 1 ? (
              <button type="button" className="fi-x" aria-label={`Remove date ${i + 1}`}
                onClick={() => set({ dates: value.dates.filter((_, j) => j !== i) })}><X size={15} aria-hidden="true" /></button>
            ) : <span aria-hidden="true" />}
          </div>
        ))}
        {value.dates.length < MAX_FRIENDLY_DATES && (
          <button type="button" className="fi-add" onClick={() => set({ dates: [...value.dates, { date: '', time: '' }] })}>
            <Plus size={15} aria-hidden="true" /> Add another date
          </button>
        )}
        <p className="text-note fi-help">Kick-off times are optional.</p>
      </fieldset>

      <div className="form-group">
        <span className="form-label" id="fi-where">Where?</span>
        <div className="tp-seg fi-seg" role="group" aria-labelledby="fi-where">
          {([['us', 'At your ground', 'you host'], ['them', 'At ours', 'we host'], ['either', 'Either', '']] as const).map(([key, label, sub]) => (
            <button key={key} type="button" aria-pressed={value.host === key} onClick={() => set({ host: key })}>
              {label}{sub && <small>{sub}</small>}
            </button>
          ))}
        </div>
      </div>
      {value.host !== 'us' && (
        <div className="form-group">
          <label htmlFor="fi-ground" className="form-label">Your ground {value.host === 'either' ? '(if you host)' : ''}</label>
          <input id="fi-ground" className="form-input" maxLength={200} autoComplete="street-address"
            placeholder="Ground name and suburb" value={value.their_ground} onChange={e => set({ their_ground: e.target.value })} />
        </div>
      )}
      <p className="fi-h">Your details</p>
    </div>
  );
}
