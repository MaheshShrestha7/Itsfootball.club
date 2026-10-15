'use client';

// Filters the directory's server-rendered ground cards by name, suburb, postcode or council as you type.
// Without JavaScript every ground stays listed, so crawlers and slow phones still see the full list.
import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';

export default function GroundsSearch({ targetId }: { targetId: string }) {
  const [q, setQ] = useState('');

  useEffect(() => {
    const root = document.getElementById(targetId);
    if (!root) return;
    const needle = q.trim().toLowerCase();
    root.querySelectorAll<HTMLElement>('[data-ground]').forEach(el => {
      el.hidden = !!needle && !(el.dataset.ground || '').includes(needle);
    });
    root.querySelectorAll<HTMLElement>('[data-ground-group]').forEach(group => {
      group.hidden = !!needle && !group.querySelector('[data-ground]:not([hidden])');
    });
  }, [q, targetId]);

  return (
    <div className="glass-panel" style={{ padding: '0.5rem 0.9rem', display: 'flex', alignItems: 'center', gap: '0.6rem', maxWidth: 620, margin: '0 auto 2.25rem' }}>
      <Search size={18} color="var(--text-muted)" aria-hidden="true" />
      <input
        type="search"
        className="form-input"
        aria-label="Search grounds"
        placeholder="Search a ground, suburb or postcode"
        value={q}
        onChange={e => setQ(e.target.value)}
        style={{ border: 'none', background: 'transparent', boxShadow: 'none' }}
      />
    </div>
  );
}
