'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, ArrowRight, Users } from 'lucide-react';
import type { MissionTab } from '@/lib/mission-control';
import type { PlatformClubItem } from '@/lib/supabase/types';
import { Crest } from '@/components/admin/platform/McArt';

interface Props {
  open: boolean;
  onClose: () => void;
  clubs: PlatformClubItem[];
  tabs: { id: MissionTab; label: string }[];
  onSelectClub: (c: PlatformClubItem) => void;
  onSelectTab: (t: MissionTab) => void;
  onSearchPeople: (q: string) => void;
}

type Item = { id: string; label: string; hint?: string; club?: PlatformClubItem; run: () => void };

/** Ctrl+K: jump to a club, a page, or a people search. */
export default function CommandPalette({ open, onClose, clubs, tabs, onSelectClub, onSelectTab, onSearchPeople }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) { setQ(''); setActive(0); d.showModal(); }
    if (!open && d.open) d.close();
  }, [open]);

  const items = useMemo<Item[]>(() => {
    const s = q.trim().toLowerCase();
    const done = (fn: () => void) => () => { fn(); onClose(); };
    const clubHits = clubs
      .filter(c => !s || [c.name, c.slug, c.short_name, c.owner_email, c.owner_name, c.custom_domain].some(v => (v || '').toLowerCase().includes(s)))
      .slice(0, s ? 8 : 5)
      .map<Item>(c => ({ id: `c:${c.id}`, label: c.name, hint: `${c.member_count} members${c.owner_email ? ` · ${c.owner_email}` : ''}${c.is_active ? '' : ' · suspended'}`, club: c, run: done(() => onSelectClub(c)) }));
    const tabHits = tabs
      .filter(t => !s || t.label.toLowerCase().includes(s))
      .map<Item>(t => ({ id: `t:${t.id}`, label: `Go to ${t.label}`, run: done(() => onSelectTab(t.id)) }));
    const people: Item[] = s ? [{ id: 'people', label: `Search people for "${q.trim()}"`, run: done(() => onSearchPeople(q.trim())) }] : [];
    return [...clubHits, ...people, ...tabHits];
  }, [q, clubs, tabs, onClose, onSelectClub, onSelectTab, onSearchPeople]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(items.length - 1, a + 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(0, a - 1)); }
    if (e.key === 'Enter') { e.preventDefault(); items[active]?.run(); }
  };

  return (
    <dialog ref={ref} className="mc-dialog mc-palette" onClose={onClose} aria-label="Find a club, page or person"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
        <label className="mc-palette-in">
          <Search size={17} aria-hidden="true" />
          <input
            autoFocus
            value={q}
            onChange={e => { setQ(e.target.value); setActive(0); }}
            onKeyDown={onKey}
            placeholder="Club, owner email, page, or a name to look up"
            aria-label="Search"
            role="combobox"
            aria-expanded="true"
            aria-controls="mc-palette-list"
            aria-activedescendant={items[active] ? `mc-p-${active}` : undefined}
          />
          <kbd>Esc</kbd>
        </label>
        <div id="mc-palette-list" role="listbox" className="mc-palette-list">
          {items.length === 0 && <p className="mc-muted" style={{ padding: '12px 18px' }}>No matches.</p>}
          {items.map((it, i) => (
            <button
              key={it.id}
              id={`mc-p-${i}`}
              type="button"
              role="option"
              aria-selected={i === active}
              className="mc-palette-it"
              onMouseEnter={() => setActive(i)}
              onClick={it.run}
            >
              {it.club ? <Crest logoUrl={it.club.logo_url} label={it.club.short_name} color={it.club.primary_color} />
                : it.id === 'people' ? <span className="ic"><Users size={14} /></span>
                : <span className="ic"><ArrowRight size={14} /></span>}
              <span style={{ minWidth: 0 }}><b>{it.label}</b>{it.hint && <small>{it.hint}</small>}</span>
            </button>
          ))}
        </div>
      </div>
    </dialog>
  );
}
