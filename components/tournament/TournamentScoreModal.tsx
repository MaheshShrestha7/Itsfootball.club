'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Match } from '@/lib/supabase/types';
import { X, Trophy, Radio, CheckCircle2 } from 'lucide-react';
import { DEFAULT_CREST } from '@/lib/crest';

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
    isCompleted?: boolean
  ) => void;
}

export default function TournamentScoreModal({
  match,
  clubSlug,
  isOpen,
  onClose,
  onSaveScore,
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

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const isCompleted = status === 'completed';
    onSaveScore(
      match.id,
      Number(homeScore),
      Number(awayScore),
      isPensEnabled ? Number(homePens) : undefined,
      isPensEnabled ? Number(awayPens) : undefined,
      isCompleted
    );
    onClose();
  };

  const isLevelScore = Number(homeScore) === Number(awayScore);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(5, 10, 20, 0.85)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'linear-gradient(135deg, #111827 0%, #0B1120 100%)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '520px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 30px rgba(16, 185, 129, 0.15)',
          overflow: 'hidden',
          color: '#FFFFFF',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(255, 255, 255, 0.02)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
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
                color: '#10B981',
              }}
            >
              <Trophy size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Update Match Score</h3>
              <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                {match.title || 'Tournament Fixture'} • {match.tournament_group || (match.tournament_stage ? match.tournament_stage.replace('_', ' ').toUpperCase() : 'Match')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: '0.25rem',
              borderRadius: '6px',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ padding: '1.5rem' }}>
          {/* Match Score Display & Inputs */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr auto 1fr',
              gap: '1rem',
              alignItems: 'center',
              background: 'rgba(0, 0, 0, 0.4)',
              padding: '1.25rem',
              borderRadius: '12px',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              marginBottom: '1.25rem',
            }}
          >
            {/* Home Team */}
            <div style={{ textAlign: 'center' }}>
              <img
                src={match.home_team_logo || DEFAULT_CREST}
                alt={match.home_team_name}
                style={{ width: '44px', height: '44px', objectFit: 'contain', margin: '0 auto 0.5rem auto' }}
              />
              <div style={{ fontSize: '0.85rem', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {match.home_team_name}
              </div>
              <input
                type="number"
                min="0"
                max="99"
                value={homeScore}
                onChange={e => setHomeScore(Math.max(0, parseInt(e.target.value, 10) || 0))}
                style={{
                  width: '64px',
                  height: '52px',
                  fontSize: '1.75rem',
                  fontWeight: 900,
                  textAlign: 'center',
                  background: 'rgba(15, 23, 42, 0.9)',
                  border: '2px solid rgba(16, 185, 129, 0.4)',
                  borderRadius: '10px',
                  color: '#FFFFFF',
                  marginTop: '0.5rem',
                }}
              />
            </div>

            {/* VS / Divider */}
            <div style={{ textAlign: 'center' }}>
              <span style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-secondary)' }}>VS</span>
            </div>

            {/* Away Team */}
            <div style={{ textAlign: 'center' }}>
              <img
                src={match.away_team_logo || DEFAULT_CREST}
                alt={match.away_team_name}
                style={{ width: '44px', height: '44px', objectFit: 'contain', margin: '0 auto 0.5rem auto' }}
              />
              <div style={{ fontSize: '0.85rem', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {match.away_team_name}
              </div>
              <input
                type="number"
                min="0"
                max="99"
                value={awayScore}
                onChange={e => setAwayScore(Math.max(0, parseInt(e.target.value, 10) || 0))}
                style={{
                  width: '64px',
                  height: '52px',
                  fontSize: '1.75rem',
                  fontWeight: 900,
                  textAlign: 'center',
                  background: 'rgba(15, 23, 42, 0.9)',
                  border: '2px solid rgba(16, 185, 129, 0.4)',
                  borderRadius: '10px',
                  color: '#FFFFFF',
                  marginTop: '0.5rem',
                }}
              />
            </div>
          </div>

          {/* Match Status Selection */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
              Match Status
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
              {(['upcoming', 'live', 'completed'] as const).map(st => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatus(st)}
                  style={{
                    padding: '0.65rem 0.5rem',
                    borderRadius: '8px',
                    border: status === st ? '2px solid #10B981' : '1px solid rgba(255, 255, 255, 0.1)',
                    background: status === st ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                    color: status === st ? '#10B981' : '#FFFFFF',
                    fontWeight: 700,
                    fontSize: '0.8rem',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                  }}
                >
                  {st === 'live' ? '🔴 LIVE' : st === 'completed' ? '✓ FULL TIME' : 'UPCOMING'}
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#F59E0B' }}>
                    Penalty Shootout (Ties)
                  </span>
                  {isLevelScore && (
                    <span style={{ fontSize: '0.7rem', background: '#F59E0B', color: '#000', padding: '1px 6px', borderRadius: '4px', fontWeight: 800 }}>
                      Scores Level
                    </span>
                  )}
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.75rem', color: '#D1D5DB' }}>
                  <input
                    type="checkbox"
                    checked={isPensEnabled}
                    onChange={e => setIsPensEnabled(e.target.checked)}
                  />
                  Enable Shootout
                </label>
              </div>

              {isPensEnabled && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '0.5rem' }}>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{match.home_team_name} Pens</span>
                    <input
                      type="number"
                      min="0"
                      value={homePens}
                      onChange={e => setHomePens(parseInt(e.target.value, 10) || 0)}
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        textAlign: 'center',
                        background: 'rgba(0, 0, 0, 0.5)',
                        border: '1px solid #F59E0B',
                        borderRadius: '6px',
                        color: '#FFFFFF',
                        fontWeight: 800,
                        fontSize: '1.1rem',
                        marginTop: '0.25rem',
                      }}
                    />
                  </div>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{match.away_team_name} Pens</span>
                    <input
                      type="number"
                      min="0"
                      value={awayPens}
                      onChange={e => setAwayPens(parseInt(e.target.value, 10) || 0)}
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        textAlign: 'center',
                        background: 'rgba(0, 0, 0, 0.5)',
                        border: '1px solid #F59E0B',
                        borderRadius: '6px',
                        color: '#FFFFFF',
                        fontWeight: 800,
                        fontSize: '1.1rem',
                        marginTop: '0.25rem',
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
            <Link
              href={`/${clubSlug}/admin/match-center`}
              className="btn btn-secondary"
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.4rem',
                fontSize: '0.85rem',
                padding: '0.75rem',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                color: '#FFFFFF',
                borderRadius: '8px',
                textDecoration: 'none',
              }}
            >
              <Radio size={15} color="#10B981" />
              <span>Match Center</span>
            </Link>

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
                background: '#10B981',
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
