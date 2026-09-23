'use client';

import React, { useEffect, useState } from 'react';
import { ClubMember } from '@/lib/supabase/types';
import PlayerAvatar from './PlayerAvatar';

interface Option {
  value: string;
  label: string;
  photoUrl?: string;
  isPlayer: boolean;
}

interface PlayerSearchSelectProps {
  /** Kept for API compatibility with earlier callers; unused now that this isn't a native <datalist>. */
  id: string;
  players: ClubMember[];
  value: string;
  onChange: (value: string) => void;
  /** Non-player choices shown alongside the squad, e.g. "-- Custom Name --" or "-- None --" */
  extraOptions?: { value: string; label: string }[];
  placeholder?: string;
}

function playerLabel(p: ClubMember): string {
  return `#${p.jersey_number ?? '-'} ${p.full_name} (${p.player_position || 'N/A'})`;
}

/** Type-to-search player picker with a photo next to each name, since a native <datalist> can't
 *  render images. Selecting/typing an exact match reports that player's id (or an extra option's
 *  value) to onChange. */
export default function PlayerSearchSelect({
  players,
  value,
  onChange,
  extraOptions = [],
  placeholder = 'Search by name or squad number...',
}: PlayerSearchSelectProps) {
  const options: Option[] = [
    ...extraOptions.map(o => ({ ...o, isPlayer: false })),
    ...players.map(p => ({ value: p.id, label: playerLabel(p), photoUrl: p.photo_url, isPlayer: true })),
  ];
  const [query, setQuery] = useState(() => options.find(o => o.value === value)?.label || '');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setQuery(options.find(o => o.value === value)?.label || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, players, extraOptions]);

  const filtered = query.trim()
    ? options.filter(o => o.label.toLowerCase().includes(query.trim().toLowerCase()))
    : options;

  const select = (opt: Option) => {
    onChange(opt.value);
    setQuery(opt.label);
    setOpen(false);
  };

  return (
    <div style={{ position: 'relative' }}>
      <input
        type="text"
        className="form-input"
        placeholder={placeholder}
        value={query}
        onFocus={() => setOpen(true)}
        onChange={e => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onBlur={() => {
          // Let a pending option click register (onMouseDown fires first) before closing.
          setTimeout(() => setOpen(false), 120);
        }}
      />
      {open && filtered.length > 0 && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            zIndex: 40,
            maxHeight: '260px',
            overflowY: 'auto',
            background: 'var(--bg-surface-elevated, #12181f)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            boxShadow: '0 12px 30px rgba(0,0,0,0.5)',
          }}
        >
          {filtered.map(opt => (
            <button
              key={opt.value || '__blank'}
              type="button"
              onMouseDown={e => {
                e.preventDefault();
                select(opt);
              }}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
                padding: '0.5rem 0.75rem',
                background: opt.value === value ? 'rgba(255, 255, 255, 0.06)' : 'transparent',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              {opt.isPlayer && <PlayerAvatar photoUrl={opt.photoUrl} name={opt.label} size={26} />}
              <span style={{ fontSize: '0.85rem', color: '#FFFFFF' }}>{opt.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
