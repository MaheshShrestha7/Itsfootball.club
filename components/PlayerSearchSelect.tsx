'use client';

import React, { useEffect, useState } from 'react';
import { ClubMember } from '@/lib/supabase/types';

interface Option {
  value: string;
  label: string;
}

interface PlayerSearchSelectProps {
  /** Unique id for this field's <datalist>, so it doesn't clash with other player pickers on the page */
  id: string;
  players: ClubMember[];
  value: string;
  onChange: (value: string) => void;
  /** Non-player choices shown alongside the squad, e.g. "-- Custom Name --" or "-- None --" */
  extraOptions?: Option[];
  placeholder?: string;
}

function playerLabel(p: ClubMember): string {
  return `#${p.jersey_number ?? '-'} ${p.full_name} (${p.player_position || 'N/A'})`;
}

/** Type-to-search player picker: a text input backed by a native <datalist>, so typing a name or
 *  jersey number filters the squad without any extra dependency. Selecting/typing an exact match
 *  reports that player's id (or an extra option's value) to onChange. */
export default function PlayerSearchSelect({
  id,
  players,
  value,
  onChange,
  extraOptions = [],
  placeholder = 'Search by name or squad number...',
}: PlayerSearchSelectProps) {
  const options: Option[] = [...players.map(p => ({ value: p.id, label: playerLabel(p) })), ...extraOptions];
  const [text, setText] = useState(() => options.find(o => o.value === value)?.label || '');

  useEffect(() => {
    setText(options.find(o => o.value === value)?.label || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, players, extraOptions]);

  return (
    <>
      <input
        type="text"
        list={id}
        className="form-input"
        placeholder={placeholder}
        value={text}
        onChange={e => {
          const typed = e.target.value;
          setText(typed);
          const matched = options.find(o => o.label.toLowerCase() === typed.toLowerCase());
          if (matched) onChange(matched.value);
        }}
      />
      <datalist id={id}>
        {options.map(o => (
          <option key={o.value} value={o.label} />
        ))}
      </datalist>
    </>
  );
}
