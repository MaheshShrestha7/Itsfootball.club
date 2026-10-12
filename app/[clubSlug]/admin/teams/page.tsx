'use client';

import { use, useEffect, useState } from 'react';
import InternalTeamsManager from '@/components/tournament/InternalTeamsManager';
import ClubTeamsManager from '@/components/teams/ClubTeamsManager';

// Club teams (first team, reserves, academy, youth) and the sides used for tournaments and
// internal matches, which are kept separate
export default function AdminTeamsPage({ params }: { params: Promise<{ clubSlug: string }> }) {
  const { clubSlug } = use(params);
  const [tab, setTab] = useState<'club' | 'tournament'>('club');
  // The tournaments screen links straight to the tournament sides (#tournament-sides)
  useEffect(() => {
    if (window.location.hash === '#tournament-sides') setTab('tournament');
  }, []);
  const tabs = [
    { key: 'club' as const, label: 'Club Teams' },
    { key: 'tournament' as const, label: 'Tournament Sides' },
  ];
  return (
    <div>
      <div data-view-ok role="tablist" className="row" style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--border-subtle)' }}>
        {tabs.map(t => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            style={{
              background: 'transparent',
              border: 'none',
              borderBottom: tab === t.key ? '2px solid var(--club-primary)' : '2px solid transparent',
              color: tab === t.key ? 'var(--text-primary)' : 'var(--text-secondary)',
              padding: '0.6rem 0.9rem',
              fontWeight: 700,
              fontSize: '0.88rem',
              cursor: 'pointer',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'club' ? <ClubTeamsManager clubSlug={clubSlug} /> : <InternalTeamsManager clubSlug={clubSlug} />}
    </div>
  );
}
