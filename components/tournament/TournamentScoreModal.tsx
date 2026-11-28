'use client';

import React, { useState } from 'react';
import HalfLengthField, { HALF_LENGTH_ERROR, parseHalfMinutes, useHalfLengthReady } from '@/components/HalfLengthField';
import { halfMinutes } from '@/lib/match-length';
import Link from 'next/link';
import { Match, TournamentParticipant } from '@/lib/supabase/types';
import { X, Radio, CheckCircle2, AlertTriangle, ArrowLeftRight, Lock } from 'lucide-react';
import { DEFAULT_CREST } from '@/lib/crest';
import PopupPanel from '@/components/PopupPanel';
import { tournamentMatchLabel } from '@/lib/tournament-engine';
import '@/components/tournament/hosted.css';

/** Digits only, no leading zeros, at most 2 digits; '' stays empty */
const cleanScore = (raw: string) => {
  const d = raw.replace(/\D/g, '').slice(0, 3);
  return d === '' ? '' : String(Math.min(99, parseInt(d, 10)));
};

interface TournamentScoreModalProps {
  match: Match;
  clubSlug: string;
  isOpen: boolean;
  onClose: () => void;
  onSaveScore: (
    matchId: string,
    homeScore: number,
    awayScore: number,
    homePens?: number,
    awayPens?: number,
    status?: 'upcoming' | 'live' | 'completed'
  ) => void;
  onSaveSchedule?: (matchId: string, changes: Partial<Match>) => void;
  /** The tournament's teams: lets the host change who plays in a group or league game not yet played */
  teams?: TournamentParticipant[];
  /** False on public tournaments, whose tournament-only club has no match centre */
  linkToMatch?: boolean;
  /** Set while this knockout game can't be played yet (knockoutLockReason): the score stays shut, the schedule can still change */
  lockReason?: string | null;
}

export default function TournamentScoreModal({
  match,
  clubSlug,
  isOpen,
  onClose,
  onSaveScore,
  onSaveSchedule,
  teams,
  linkToMatch = true,
  lockReason,
}: TournamentScoreModalProps) {
  const isKnockout = Boolean(match.tournament_stage && match.tournament_stage !== 'group');

  const initialStatus: 'upcoming' | 'live' | 'completed' =
    match.status === 'live' || match.status === 'completed' ? match.status : 'upcoming';
  const [status, setStatus] = useState<'upcoming' | 'live' | 'completed'>(initialStatus);
  // Scores are kept as typed text: a game not yet played starts empty (placeholder 0), so typing never leaves a leading 0
  const startScore = (n?: number | null) => (initialStatus === 'upcoming' && !n ? '' : String(n ?? 0));
  const [homeScore, setHomeScore] = useState(startScore(match.home_score));
  const [awayScore, setAwayScore] = useState(startScore(match.away_score));
  const [isPensEnabled, setIsPensEnabled] = useState<boolean>(
    Boolean(
      match.home_penalty_score !== undefined ||
        (isKnockout && match.home_score === match.away_score && match.status === 'completed')
    )
  );
  const [homePens, setHomePens] = useState(match.home_penalty_score == null ? '' : String(match.home_penalty_score));
  const [awayPens, setAwayPens] = useState(match.away_penalty_score == null ? '' : String(match.away_penalty_score));
  const [matchDate, setMatchDate] = useState(match.match_date?.slice(0, 10) || '');
  const [matchTime, setMatchTime] = useState(match.match_time || '');
  const [venue, setVenue] = useState(match.venue || '');
  const [pitch, setPitch] = useState(match.pitch_label || '');
  // This game's half length: a game already kicked off keeps its clock
  const halfReady = useHalfLengthReady() && match.status === 'upcoming';
  const [half, setHalf] = useState(String(halfMinutes(match)));
  const [homeName, setHomeName] = useState(match.home_team_name);
  const [awayName, setAwayName] = useState(match.away_team_name);
  // Knockout slots fill themselves from results, so only group and league games swap teams
  const teamChoices = onSaveSchedule && teams && !isKnockout && match.status === 'upcoming'
    ? teams.filter(t => !match.tournament_group || `Group ${t.group}` === match.tournament_group)
    : null;
  const logoOf = (name: string) => teams?.find(t => t.name === name)?.logo_url || (name === match.home_team_name ? match.home_team_logo : name === match.away_team_name ? match.away_team_logo : undefined) || DEFAULT_CREST;
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const pens = isPensEnabled && Number(homeScore) === Number(awayScore);
    if (isKnockout && status === 'completed' && Number(homeScore) === Number(awayScore) && (!pens || Number(homePens) === Number(awayPens))) {
      setError('A knockout match needs a winner: enter a penalty shootout result.');
      return;
    }
    if (homeName === awayName) {
      setError('A team can\'t play itself: pick two different teams.');
      return;
    }
    const halfParsed = parseHalfMinutes(half);
    if (halfReady && !halfParsed.empty && halfParsed.minutes === null) {
      setError(HALF_LENGTH_ERROR);
      return;
    }
    const newHalf = halfReady && !halfParsed.empty && halfParsed.minutes !== halfMinutes(match) ? halfParsed.minutes : null;
    if (onSaveSchedule && (matchDate !== (match.match_date?.slice(0, 10) || '') || matchTime !== (match.match_time || '') || venue !== (match.venue || '')
      || pitch !== (match.pitch_label || '') || homeName !== match.home_team_name || awayName !== match.away_team_name || newHalf)) {
      onSaveSchedule(match.id, {
        ...(newHalf ? { half_minutes: newHalf } : {}),
        match_date: matchDate, match_time: matchTime, venue, pitch_label: pitch || undefined,
        home_team_name: homeName, away_team_name: awayName, home_team_logo: logoOf(homeName), away_team_logo: logoOf(awayName),
      });
    }
    // Leave the result untouched when only the schedule changed (or the game is still locked)
    if (!lockReason && (status !== 'upcoming' || initialStatus !== 'upcoming')) {
      onSaveScore(
        match.id,
        Number(homeScore),
        Number(awayScore),
        pens ? Number(homePens) : undefined,
        pens ? Number(awayPens) : undefined,
        status
      );
    }
    onClose();
  };

  const isLevelScore = Number(homeScore) === Number(awayScore);
  // Typing a score on a match still marked Upcoming means it's been played: without this the score
  // was quietly not saved (the match stayed upcoming and showed "-")
  const scoreTyped = (set: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = cleanScore(e.target.value);
    set(v);
    if (v !== '' && status === 'upcoming') setStatus('completed');
  };
  // Tapping a score box selects what's there, so the first digit typed replaces it
  const selectAll = (e: React.FocusEvent<HTMLInputElement>) => e.target.select();

  const STATUS_LABEL = { upcoming: 'Upcoming', live: 'Live', completed: 'Full time' } as const;
  const kit = (name: string) => {
    const t = teams?.find(x => x.name === name);
    return { '--ht-c1': t?.color || undefined, '--ht-c2': t?.secondary_color || t?.color || undefined } as React.CSSProperties;
  };
  const stageLine = [match.tournament_group, tournamentMatchLabel(match)].filter(Boolean).join(', ');

  const side = (which: 'home' | 'away') => {
    const name = which === 'home' ? homeName : awayName;
    const score = which === 'home' ? homeScore : awayScore;
    return (
      <div className="ht-fx-side">
        <span className="ht-crest ht-fx-crest" style={kit(name)}>
          <img decoding="async" width={52} height={52} src={logoOf(name)} alt={`${name} crest`} />
        </span>
        {teamChoices ? (
          <>
            <label htmlFor={`fixture-${which}`} className="sr-only">{which === 'home' ? 'Home team' : 'Away team'}</label>
            <select id={`fixture-${which}`} className="form-input ht-fx-team" value={name}
              onChange={e => { (which === 'home' ? setHomeName : setAwayName)(e.target.value); setError(null); }}>
              {!teamChoices.some(t => t.name === name) && <option value={name}>{name}</option>}
              {teamChoices.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
            </select>
          </>
        ) : <span className="ht-fx-name">{name}</span>}
        <span className="ht-sub">{which === 'home' ? 'Home' : 'Away'}</span>
        <input aria-label={`${name} score`} type="text" inputMode="numeric" pattern="[0-9]*" autoComplete="off" placeholder="0"
          value={score} onFocus={selectAll} disabled={!!lockReason} onChange={scoreTyped(which === 'home' ? setHomeScore : setAwayScore)} className="form-input ht-fx-score" />
      </div>
    );
  };

  return (
    <div className="ht-scrim" onClick={onClose}>
      <PopupPanel onClose={onClose} label={onSaveSchedule ? 'Edit fixture' : 'Match score'} className="ht-dialog ht-fx" onClick={e => e.stopPropagation()}>
        <div className="ht-dialog-head">
          <div className="min-w-0">
            <h3>{homeName} v {awayName}</h3>
            {stageLine && <p className="ht-sub">{stageLine}</p>}
          </div>
          <button type="button" aria-label="Close" className="ht-x" onClick={onClose}><X size={18} aria-hidden="true" /></button>
        </div>

        <form onSubmit={handleSubmit} className="ht-fx-form">
          {/* The board is the editor: pick each side's team, swap them, type the score */}
          <div className="ht-fx-board">
            {side('home')}
            {teamChoices ? (
              <button type="button" className="ht-icon-btn ht-fx-swap" aria-label="Swap home and away" title="Swap home and away"
                onClick={() => { setHomeName(awayName); setAwayName(homeName); }}>
                <ArrowLeftRight size={16} aria-hidden="true" />
              </button>
            ) : <span className="ht-fx-v" aria-hidden="true">v</span>}
            {side('away')}
          </div>

          {lockReason && (
            <p role="status" className="ht-lock">
              <Lock size={15} aria-hidden="true" /><span>{lockReason}</span>
            </p>
          )}

          <fieldset className="ht-fx-status" disabled={!!lockReason}>
            <legend className="form-label">Match status</legend>
            <div className="ht-fx-seg">
              {(['upcoming', 'live', 'completed'] as const).map(st => (
                <button key={st} type="button" aria-pressed={status === st} onClick={() => setStatus(st)}>{STATUS_LABEL[st]}</button>
              ))}
            </div>
          </fieldset>

          {isKnockout && !lockReason && (
            <fieldset className="ht-fieldset">
              <legend>Penalty shootout</legend>
              <div className="ht-fx-pens-head">
                <label className="form-check">
                  <input type="checkbox" checked={isPensEnabled} onChange={e => setIsPensEnabled(e.target.checked)} />
                  Went to penalties
                </label>
                {isLevelScore && <span className="ht-state" data-tone="warn">Scores level</span>}
              </div>
              {isPensEnabled && (
                <div className="ht-two">
                  {(['home', 'away'] as const).map(w => (
                    <div key={w} className="form-group" style={{ margin: 0 }}>
                      <label htmlFor={`pens-${w}`} className="form-label">{w === 'home' ? homeName : awayName} penalties</label>
                      <input id={`pens-${w}`} aria-label={`${w === 'home' ? homeName : awayName} penalties`} type="text" inputMode="numeric" pattern="[0-9]*" autoComplete="off" placeholder="0" className="form-input"
                        value={w === 'home' ? homePens : awayPens} onFocus={selectAll}
                        onChange={e => (w === 'home' ? setHomePens : setAwayPens)(cleanScore(e.target.value))} />
                    </div>
                  ))}
                </div>
              )}
            </fieldset>
          )}

          {onSaveSchedule && (
            <fieldset className="ht-fieldset">
              <legend>When and where</legend>
              <div className="ht-two">
                {[
                  { label: 'Date', type: 'date', value: matchDate, set: setMatchDate },
                  { label: 'Kick-off', type: 'time', value: matchTime, set: setMatchTime },
                  { label: 'Venue', type: 'text', value: venue, set: setVenue },
                  { label: 'Pitch', type: 'text', value: pitch, set: setPitch },
                ].map(f => (
                  <div key={f.label} className="form-group" style={{ margin: 0 }}>
                    <label htmlFor={`score-${f.label}`} className="form-label">{f.label}{f.type === 'date' ? ' *' : ''}</label>
                    <input id={`score-${f.label}`} className="form-input" type={f.type} value={f.value} required={f.type === 'date'} onChange={e => f.set(e.target.value)} />
                  </div>
                ))}
              </div>
              {halfReady && (
                <HalfLengthField id="score-half" value={half} onChange={setHalf} helper={`This game only: 2 x ${parseHalfMinutes(half).empty ? halfMinutes(match) : half} minutes.`} />
              )}
            </fieldset>
          )}

          {error && (
            <p role="alert" className="ht-error ht-fx-error">
              <AlertTriangle size={14} aria-hidden="true" /><span>{error}</span>
            </p>
          )}

          <div className="ht-fx-actions">
            {linkToMatch && !lockReason && (
              <Link href={`/${clubSlug}/admin/match-center?match=${encodeURIComponent(match.id)}`} className="btn btn-secondary">
                <Radio size={15} aria-hidden="true" /><span>Match Centre</span>
              </Link>
            )}
            <button type="submit" className="btn btn-primary">
              <CheckCircle2 size={16} aria-hidden="true" /><span>{lockReason ? 'Save' : 'Save and update bracket'}</span>
            </button>
          </div>
        </form>
      </PopupPanel>
    </div>
  );
}
