'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Match, TournamentParticipant } from '@/lib/supabase/types';
import { X, Trophy, Radio, CheckCircle2, AlertTriangle, ArrowLeftRight } from 'lucide-react';
import { DEFAULT_CREST } from '@/lib/crest';
import { useDialog } from '@/lib/use-escape-to-close';

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
}: TournamentScoreModalProps) {
  const isKnockout = Boolean(match.tournament_stage && match.tournament_stage !== 'group');

  const [homeScore, setHomeScore] = useState<number>(match.home_score || 0);
  const [awayScore, setAwayScore] = useState<number>(match.away_score || 0);
  const initialStatus: 'upcoming' | 'live' | 'completed' =
    match.status === 'live' || match.status === 'completed' ? match.status : 'upcoming';
  const [status, setStatus] = useState<'upcoming' | 'live' | 'completed'>(initialStatus);
  const [isPensEnabled, setIsPensEnabled] = useState<boolean>(
    Boolean(
      match.home_penalty_score !== undefined ||
        (isKnockout && match.home_score === match.away_score && match.status === 'completed')
    )
  );
  const [homePens, setHomePens] = useState<number>(match.home_penalty_score || 0);
  const [awayPens, setAwayPens] = useState<number>(match.away_penalty_score || 0);
  const [matchDate, setMatchDate] = useState(match.match_date?.slice(0, 10) || '');
  const [matchTime, setMatchTime] = useState(match.match_time || '');
  const [venue, setVenue] = useState(match.venue || '');
  const [pitch, setPitch] = useState(match.pitch_label || '');
  const [homeName, setHomeName] = useState(match.home_team_name);
  const [awayName, setAwayName] = useState(match.away_team_name);
  // Knockout slots fill themselves from results, so only group and league games swap teams
  const teamChoices = onSaveSchedule && teams && !isKnockout && match.status === 'upcoming'
    ? teams.filter(t => !match.tournament_group || `Group ${t.group}` === match.tournament_group)
    : null;
  const logoOf = (name: string) => teams?.find(t => t.name === name)?.logo_url || (name === match.home_team_name ? match.home_team_logo : name === match.away_team_name ? match.away_team_logo : undefined) || DEFAULT_CREST;
  const [error, setError] = useState<string | null>(null);

  const dialogRef = useDialog(isOpen, onClose);

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
    if (onSaveSchedule && (matchDate !== (match.match_date?.slice(0, 10) || '') || matchTime !== (match.match_time || '') || venue !== (match.venue || '')
      || pitch !== (match.pitch_label || '') || homeName !== match.home_team_name || awayName !== match.away_team_name)) {
      onSaveSchedule(match.id, {
        match_date: matchDate, match_time: matchTime, venue, pitch_label: pitch || undefined,
        home_team_name: homeName, away_team_name: awayName, home_team_logo: logoOf(homeName), away_team_logo: logoOf(awayName),
      });
    }
    // Leave the result untouched when only the schedule changed
    if (status !== 'upcoming' || initialStatus !== 'upcoming') {
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
  const scoreTyped = (set: (n: number) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    set(Math.max(0, parseInt(e.target.value, 10) || 0));
    if (status === 'upcoming') setStatus('completed');
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        overflowY: 'auto',
        overscrollBehavior: 'contain',
        backgroundColor: 'rgba(var(--dk-4-6-9), 0.85)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Match score"
        style={{
          margin: 'auto',
          background: 'linear-gradient(135deg, rgb(var(--dk-17-24-39)) 0%, rgb(var(--dk-15-23-42)) 100%)',
          border: '1px solid rgba(var(--tint-rgb), 0.12)',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '520px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 30px rgba(16, 185, 129, 0.15)',
          overflow: 'hidden',
          color: 'var(--text-primary)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid rgba(var(--tint-rgb), 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(var(--tint-rgb), 0.02)',
          }}
        >
          <div className="row row-loose">
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                background: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--c-green)',
              }}
            >
              <Trophy size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>{onSaveSchedule ? 'Edit Fixture' : 'Update Match Score'}</h3>
              <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                {match.title || 'Tournament Fixture'} • {match.tournament_group || (match.tournament_stage ? match.tournament_stage.replace('_', ' ').toUpperCase() : 'Match')}
              </p>
            </div>
          </div>
          <button type="button" aria-label="Close" className="icon-close" onClick={onClose}>
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ padding: '1.5rem' }}>
          {onSaveSchedule && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 130px), 1fr))', gap: '0.65rem', marginBottom: '1.25rem' }}>
              {[
                { label: 'Date', type: 'date', value: matchDate, set: setMatchDate },
                { label: 'Kick-off', type: 'time', value: matchTime, set: setMatchTime },
                { label: 'Venue', type: 'text', value: venue, set: setVenue },
                { label: 'Pitch', type: 'text', value: pitch, set: setPitch },
              ].map(f => (
                <div key={f.label} className="form-group" style={{ margin: 0 }}>
                  <label htmlFor={`score-${f.label}`} className="form-label">{f.label}{f.type === 'date' ? ' *' : ''}</label>
                  <input id={`score-${f.label}`} className="form-input" style={{ height: 45 }} type={f.type} value={f.value} required={f.type === 'date'} onChange={e => f.set(e.target.value)} />
                </div>
              ))}
            </div>
          )}

          {teamChoices && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '0.5rem', alignItems: 'end', marginBottom: '1.25rem' }}>
              {(['home', 'away'] as const).map(side => {
                const value = side === 'home' ? homeName : awayName;
                const select = (
                  <div key={side} className="form-group" style={{ margin: 0, minWidth: 0 }}>
                    <label htmlFor={`fixture-${side}`} className="form-label">{side === 'home' ? 'Home team' : 'Away team'}</label>
                    <select id={`fixture-${side}`} className="form-input" style={{ height: 45 }} value={value}
                      onChange={e => { (side === 'home' ? setHomeName : setAwayName)(e.target.value); setError(null); }}>
                      {!teamChoices.some(t => t.name === value) && <option value={value}>{value}</option>}
                      {teamChoices.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                    </select>
                  </div>
                );
                return side === 'home' ? [select, (
                  <button key="swap" type="button" className="btn btn-secondary" style={{ height: 45, width: 45, padding: 0, display: 'grid', placeItems: 'center' }}
                    aria-label="Swap home and away" title="Swap home and away"
                    onClick={() => { setHomeName(awayName); setAwayName(homeName); }}>
                    <ArrowLeftRight size={16} aria-hidden="true" />
                  </button>
                )] : select;
              })}
            </div>
          )}

          {/* Match Score Display & Inputs */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr auto 1fr',
              gap: '1rem',
              alignItems: 'center',
              background: 'rgba(var(--shade-rgb), 0.4)',
              padding: '1.25rem',
              borderRadius: '12px',
              border: '1px solid rgba(var(--tint-rgb), 0.06)',
              marginBottom: '1.25rem',
            }}
          >
            {/* Home Team */}
            <div className="text-center">
              <img loading="lazy" decoding="async" width={44} height={44}
                src={logoOf(homeName)}
                alt={`${homeName} crest`}
                style={{ width: '44px', height: '44px', objectFit: 'contain', margin: '0 auto 0.5rem auto' }}
              />
              <div style={{ fontSize: '0.85rem', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {homeName}
              </div>
              <input aria-label={`${homeName} score`}
                type="number"
                min="0"
                max="99"
                value={homeScore}
                onChange={scoreTyped(setHomeScore)}
                className="form-input"
                style={{ width: '64px', height: '52px', padding: 0, fontSize: '1.75rem', fontWeight: 900, textAlign: 'center', marginTop: '0.5rem' }}
              />
            </div>

            {/* VS / Divider */}
            <div className="text-center">
              <span style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-secondary)' }}>VS</span>
            </div>

            {/* Away Team */}
            <div className="text-center">
              <img loading="lazy" decoding="async" width={44} height={44}
                src={logoOf(awayName)}
                alt={`${awayName} crest`}
                style={{ width: '44px', height: '44px', objectFit: 'contain', margin: '0 auto 0.5rem auto' }}
              />
              <div style={{ fontSize: '0.85rem', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {awayName}
              </div>
              <input aria-label={`${awayName} score`}
                type="number"
                min="0"
                max="99"
                value={awayScore}
                onChange={scoreTyped(setAwayScore)}
                className="form-input"
                style={{ width: '64px', height: '52px', padding: 0, fontSize: '1.75rem', fontWeight: 900, textAlign: 'center', marginTop: '0.5rem' }}
              />
            </div>
          </div>

          {/* Match Status Selection */}
          <div style={{ marginBottom: '1.25rem' }}>
            <div className="form-label" style={{ marginBottom: '0.5rem' }}>Match Status</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
              {(['upcoming', 'live', 'completed'] as const).map(st => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatus(st)}
                  style={{
                    padding: '0.65rem 0.5rem',
                    borderRadius: '8px',
                    border: status === st ? '2px solid var(--c-green)' : '1px solid rgba(var(--tint-rgb), 0.1)',
                    background: status === st ? 'rgba(16, 185, 129, 0.15)' : 'rgba(var(--tint-rgb), 0.04)',
                    color: status === st ? 'var(--c-green)' : 'var(--text-primary)',
                    fontWeight: 700,
                    fontSize: '0.8rem',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                  }}
                >
                  {st === 'live' ? 'Live' : st === 'completed' ? 'Full time' : 'Upcoming'}
                </button>
              ))}
            </div>
          </div>

          {/* Knockout Penalty Shootout Section */}
          {isKnockout && (
            <div
              style={{
                background: 'rgba(245, 158, 11, 0.08)',
                border: '1px solid rgba(245, 158, 11, 0.25)',
                borderRadius: '10px',
                padding: '0.9rem',
                marginBottom: '1.25rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: isPensEnabled ? '0.75rem' : '0' }}>
                <div className="row">
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--c-amber)' }}>
                    Penalty Shootout (Ties)
                  </span>
                  {isLevelScore && (
                    <span style={{ fontSize: '0.7rem', background: 'var(--c-amber)', color: '#000', padding: '1px 6px', borderRadius: '4px', fontWeight: 800 }}>
                      Scores Level
                    </span>
                  )}
                </div>
                <label className="form-check">
                  <input
                    type="checkbox"
                    checked={isPensEnabled}
                    onChange={e => setIsPensEnabled(e.target.checked)}
                  />
                  Enable Shootout
                </label>
              </div>

              {isPensEnabled && (
                <div className="form-row-2" style={{ gap: '1rem', marginTop: '0.5rem' }}>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{match.home_team_name} Pens</span>
                    <input aria-label={`${match.home_team_name} penalties`}
                      type="number"
                      min="0"
                      value={homePens}
                      onChange={e => setHomePens(parseInt(e.target.value, 10) || 0)}
                      className="form-input"
                      style={{ padding: '0.5rem', textAlign: 'center', fontWeight: 800, fontSize: '1.1rem', marginTop: '0.25rem' }}
                    />
                  </div>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{match.away_team_name} Pens</span>
                    <input aria-label={`${match.away_team_name} penalties`}
                      type="number"
                      min="0"
                      value={awayPens}
                      onChange={e => setAwayPens(parseInt(e.target.value, 10) || 0)}
                      className="form-input"
                      style={{ padding: '0.5rem', textAlign: 'center', fontWeight: 800, fontSize: '1.1rem', marginTop: '0.25rem' }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {error && (
            <div role="alert" style={{ display: 'flex', gap: '0.4rem', color: 'var(--c-red)', fontSize: '0.8rem', fontWeight: 700 }}>
              <AlertTriangle size={14} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} /><span>{error}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
            {linkToMatch && <Link
              href={`/${clubSlug}/admin/match-center?match=${encodeURIComponent(match.id)}`}
              className="btn btn-secondary"
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.4rem',
                fontSize: '0.85rem',
                padding: '0.75rem',
                background: 'rgba(var(--tint-rgb), 0.05)',
                border: '1px solid rgba(var(--tint-rgb), 0.12)',
                color: 'var(--text-primary)',
                borderRadius: '8px',
                textDecoration: 'none',
              }}
            >
              <Radio size={15} color="var(--c-green)" />
              <span>Match Centre</span>
            </Link>}

            <button
              type="submit"
              className="btn btn-primary"
              style={{
                flex: 1.5,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.4rem',
                fontSize: '0.85rem',
                padding: '0.75rem',
                background: 'var(--c-green)',
                color: '#000000',
                fontWeight: 800,
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
              }}
            >
              <CheckCircle2 size={16} />
              <span>Save & Update Bracket</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
