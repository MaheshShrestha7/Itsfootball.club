'use client';

import React, { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X, Users, CalendarDays, Radio } from 'lucide-react';
import { useClub } from '@/lib/club-context';
import { isPlayerMember } from '@/lib/supabase/types';

interface SearchResult {
  id: string;
  label: string;
  sublabel: string;
  href: string;
  icon: React.ComponentType<{ size?: number; color?: string }>;
}

export default function AdminSearch({ clubSlug, clubId }: { clubSlug: string; clubId: string }) {
  const { members, matches, events } = useClub();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const results = useMemo<SearchResult[]>(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];

    const playerResults: SearchResult[] = members
      .filter(m => m.club_id === clubId && isPlayerMember(m) && m.full_name.toLowerCase().includes(q))
      .slice(0, 5)
      .map(m => ({
        id: m.id,
        label: m.full_name,
        sublabel: `Player${m.jersey_number ? ` • #${m.jersey_number}` : ''}${m.player_position ? ` • ${m.player_position}` : ''}`,
        href: `/${clubSlug}/admin/squad`,
        icon: Users,
      }));

    const matchResults: SearchResult[] = matches
      .filter(m => m.club_id === clubId && (
        (m.opponent_name || '').toLowerCase().includes(q) ||
        (m.title || '').toLowerCase().includes(q) ||
        (m.venue || '').toLowerCase().includes(q)
      ))
      .slice(0, 5)
      .map(m => ({
        id: m.id,
        label: m.title || `vs ${m.opponent_name || m.away_team_name}`,
        sublabel: `Match • ${new Date(m.match_date).toLocaleDateString()}`,
        href: m.status === 'live' ? `/${clubSlug}/admin/match-center` : `/${clubSlug}/admin/matches`,
        icon: Radio,
      }));

    const eventResults: SearchResult[] = events
      .filter(e => e.club_id === clubId && e.title.toLowerCase().includes(q))
      .slice(0, 5)
      .map(e => ({
        id: e.id,
        label: e.title,
        sublabel: `Event • ${new Date(e.start_time).toLocaleDateString()}`,
        href: `/${clubSlug}/admin/events`,
        icon: CalendarDays,
      }));

    return [...playerResults, ...matchResults, ...eventResults];
  }, [query, members, matches, events, clubId, clubSlug]);

  const handleSelect = (href: string) => {
    setQuery('');
    setIsOpen(false);
    router.push(href);
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', marginBottom: '1.25rem' }}>
      <div style={{ position: 'relative' }}>
        <Search size={14} color="var(--text-muted)" style={{ position: 'absolute', left: '0.65rem', top: '50%', transform: 'translateY(-50%)' }} />
        <input aria-label="Search players, matches and events"
          type="text"
          placeholder="Search players, matches, events..."
          value={query}
          onChange={e => { setQuery(e.target.value); setIsOpen(true); }}
          onFocus={() => setIsOpen(true)}
          onBlur={() => setTimeout(() => setIsOpen(false), 150)}
          className="form-input"
          style={{ paddingLeft: '2rem', paddingRight: query ? '2rem' : undefined, fontSize: '0.82rem', height: '38px' }}
        />
        {query && (
          <button
            type="button"
            onMouseDown={e => e.preventDefault()}
            onClick={() => setQuery('')}
            style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}
          >
            <X size={14} />
          </button>
        )}
      </div>

      {isOpen && query.trim().length >= 2 && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 0.35rem)',
          left: 0,
          right: 0,
          background: 'rgba(15, 23, 42, 0.98)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          zIndex: 50,
          maxHeight: '320px',
          overflowY: 'auto',
        }}>
          {results.length === 0 ? (
            <div style={{ padding: '0.75rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>No matches found.</div>
          ) : (
            results.map(r => {
              const Icon = r.icon;
              return (
                <button
                  key={`${r.href}-${r.id}`}
                  type="button"
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => handleSelect(r.href)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.6rem',
                    width: '100%',
                    textAlign: 'left',
                    padding: '0.55rem 0.75rem',
                    background: 'transparent',
                    border: 'none',
                    borderBottom: '1px solid var(--border-subtle)',
                    cursor: 'pointer',
                    color: '#FFFFFF',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <Icon size={14} color="var(--club-primary)" />
                  <div style={{ overflow: 'hidden' }}>
                    <div style={{ fontSize: '0.82rem', fontWeight: 700, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{r.label}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{r.sublabel}</div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
