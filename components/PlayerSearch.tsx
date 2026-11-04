'use client';

// Find a player by name, shirt number or position; each result opens that player's public page.
// Callers pass only players who have a public page (approved adults), so juniors never show here.
import { useId, useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Search } from 'lucide-react';
import PlayerAvatar from '@/components/PlayerAvatar';

export type SearchablePlayer = {
  id: string;
  full_name: string;
  photo_url?: string | null;
  jersey_number?: number | null;
  player_position?: string | null;
  /** Team names shown under the name, e.g. "First Team, Reserves" */
  teams?: string[];
};

const MAX_RESULTS = 12;

export function matchesPlayer(p: SearchablePlayer, query: string): boolean {
  const q = query.trim().toLowerCase().replace(/^#/, '');
  if (!q) return true;
  if (/^\d+$/.test(q)) return p.jersey_number != null && String(p.jersey_number) === q;
  const hay = [p.full_name, p.player_position || '', ...(p.teams || [])].join(' ').toLowerCase();
  return q.split(/\s+/).every(word => hay.includes(word));
}

export default function PlayerSearch({ players, clubSlug, placeholder = 'Search a player by name or shirt number' }: {
  players: SearchablePlayer[];
  clubSlug: string;
  placeholder?: string;
}) {
  const [q, setQ] = useState('');
  const listId = useId();
  const results = useMemo(() => (q.trim() ? players.filter(p => matchesPlayer(p, q)) : []), [players, q]);

  if (players.length === 0) return null;

  return (
    <div style={{ marginBottom: '1.75rem' }}>
      <div className="glass-panel" style={{ padding: '0.5rem 0.9rem', display: 'flex', alignItems: 'center', gap: '0.6rem', maxWidth: 620 }}>
        <Search size={18} color="var(--text-muted)" aria-hidden="true" className="shrink-0" />
        <input
          type="search"
          className="form-input"
          aria-label="Search players"
          aria-controls={listId}
          placeholder={placeholder}
          value={q}
          onChange={e => setQ(e.target.value)}
          onKeyDown={e => { if (e.key === 'Escape') setQ(''); }}
          autoComplete="off"
          style={{ border: 'none', background: 'transparent', boxShadow: 'none' }}
        />
      </div>

      <div id={listId} aria-live="polite">
        {q.trim() && (
          results.length === 0 ? (
            <p className="text-note" style={{ margin: '0.75rem 0 0' }}>No player matches &ldquo;{q.trim()}&rdquo;.</p>
          ) : (
            <>
              <p className="sr-only">{results.length} {results.length === 1 ? 'player' : 'players'} found</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 260px), 1fr))', gap: '0.6rem', marginTop: '0.75rem' }}>
                {results.slice(0, MAX_RESULTS).map(p => (
                  <Link key={p.id} href={`/${clubSlug}/squad/${p.id}`} className="glass-panel glass-panel-interactive row" style={{ padding: '0.7rem 1rem', color: 'inherit', textDecoration: 'none' }}>
                    <PlayerAvatar name={p.full_name} photoUrl={p.photo_url ?? undefined} size={40} />
                    <div className="min-w-0" style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                        {p.jersey_number != null && <span style={{ color: 'var(--club-ink)', marginRight: 6 }}>#{p.jersey_number}</span>}
                        {p.full_name}
                      </div>
                      {(p.player_position || p.teams?.length) ? (
                        <div className="text-meta" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {[p.player_position, p.teams?.join(', ')].filter(Boolean).join(', ')}
                        </div>
                      ) : null}
                    </div>
                    <ChevronRight size={16} color="var(--text-muted)" className="shrink-0" aria-hidden="true" />
                  </Link>
                ))}
              </div>
              {results.length > MAX_RESULTS && (
                <p className="text-note" style={{ margin: '0.6rem 0 0' }}>Showing {MAX_RESULTS} of {results.length}. Type more of the name to narrow it down.</p>
              )}
            </>
          )
        )}
      </div>
    </div>
  );
}
