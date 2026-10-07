'use client';

import React, { useEffect, useState } from 'react';
import { Award, Pencil, X } from 'lucide-react';
import { ClubMember, Tournament } from '@/lib/supabase/types';
import { getSupabaseClient } from '@/lib/supabase/client';
import PlayerAvatar from '@/components/PlayerAvatar';

interface PlayerOfTournamentProps {
  tournament: Tournament;
  /** Club members to pick from (and to show the winner's photo) */
  members: ClubMember[];
  isAdmin?: boolean;
  /** Mirrors a saved award into local state (e.g. the club context's updateTournament) */
  onSaved?: (updates: Partial<Tournament>) => void;
}

/**
 * Player of the Tournament: a highlight card for everyone, plus a small editor for admins.
 * Saved straight to the tournaments row (not through the background sync).
 */
export default function PlayerOfTournament({ tournament, members, isAdmin = false, onSaved }: PlayerOfTournamentProps) {
  const [editing, setEditing] = useState(false);
  const [memberId, setMemberId] = useState('');
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMemberId(tournament.player_of_tournament_member_id || '');
    setName(tournament.player_of_tournament_name || '');
    setNote(tournament.player_of_tournament_note || '');
  }, [tournament.player_of_tournament_member_id, tournament.player_of_tournament_name, tournament.player_of_tournament_note]);

  const winnerName = tournament.player_of_tournament_name;
  const winner = members.find(m => m.id === tournament.player_of_tournament_member_id);
  if (!winnerName && !isAdmin) return null;

  const save = async (clear = false) => {
    const chosen = members.find(m => m.id === memberId);
    const updates: Partial<Tournament> = clear
      ? { player_of_tournament_member_id: null, player_of_tournament_name: null, player_of_tournament_note: null }
      : {
          player_of_tournament_member_id: chosen?.id ?? null,
          player_of_tournament_name: (chosen?.full_name || name).trim() || null,
          player_of_tournament_note: note.trim() || null,
        };
    if (!clear && !updates.player_of_tournament_name) return setError('Choose a member or type the player’s name.');

    const client = getSupabaseClient();
    if (!client) return setError('Saving is not available right now.');
    setSaving(true);
    setError(null);
    const { error: dbError } = await client.from('tournaments').update(updates).eq('id', tournament.id);
    setSaving(false);
    if (dbError) return setError(`Could not save the award: ${dbError.message}`);
    onSaved?.(updates);
    setEditing(false);
  };

  const sortedMembers = [...members].sort((a, b) => a.full_name.localeCompare(b.full_name));

  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '1rem',
      padding: '1rem 1.25rem', marginBottom: '1.5rem', borderRadius: '14px',
      background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.14), rgba(var(--dk-15-23-42), 0.75))',
      border: '1px solid rgba(245, 158, 11, 0.35)',
    }}>
      {editing ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: '0.75rem', width: '100%' }}>
          <div className="form-group m-0">
            <label className="form-label" htmlFor="potm-member">Club member</label>
            <select id="potm-member" className="form-select" value={memberId} onChange={e => setMemberId(e.target.value)}>
              <option value="">Not a club member (type name)</option>
              {sortedMembers.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
            </select>
          </div>
          {!memberId && (
            <div className="form-group m-0">
              <label className="form-label" htmlFor="potm-name">Player name</label>
              <input id="potm-name" className="form-input" value={name} maxLength={255} onChange={e => setName(e.target.value)} placeholder="e.g. guest team player" />
            </div>
          )}
          <div className="form-group m-0">
            <label className="form-label" htmlFor="potm-note">Citation (optional)</label>
            <input id="potm-note" className="form-input" value={note} maxLength={280} onChange={e => setNote(e.target.value)} placeholder="e.g. 7 goals, 3 assists" />
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'end', flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-primary btn-sm" disabled={saving} onClick={() => save()}>{saving ? 'Saving…' : 'Save award'}</button>
            {winnerName && <button type="button" className="btn btn-danger btn-sm" disabled={saving} onClick={() => save(true)}>Remove</button>}
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setEditing(false); setError(null); }} aria-label="Cancel"><X size={14} /></button>
          </div>
          {error && <p role="alert" style={{ color: 'var(--c-red)', fontSize: '0.8rem', margin: 0, gridColumn: '1 / -1' }}>{error}</p>}
        </div>
      ) : (
        <>
          {winnerName ? (
            <PlayerAvatar photoUrl={winner?.photo_url} name={winnerName} size={56} style={{ borderRadius: '14px', border: '2px solid #F59E0B' }} />
          ) : (
            <Award size={40} color="var(--c-amber)" />
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.08em', color: 'var(--c-amber)', textTransform: 'uppercase' }}>
              Player of the Tournament
            </div>
            <div style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--text-primary)' }}>{winnerName || 'Not awarded yet'}</div>
            {tournament.player_of_tournament_note && (
              <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{tournament.player_of_tournament_note}</div>
            )}
          </div>
          {isAdmin && (
            <button type="button" className="btn btn-secondary btn-sm row row-tight" onClick={() => setEditing(true)}>
              <Pencil size={14} /> {winnerName ? 'Change' : 'Award player'}
            </button>
          )}
        </>
      )}
    </div>
  );
}
