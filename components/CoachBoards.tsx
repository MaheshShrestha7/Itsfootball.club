'use client';

// "Coach's boards" on a player's upcoming game in the club app: the tactics boards the coach chose
// to show, read-only. Nothing renders until there is at least one.
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import { ClipboardList, X } from 'lucide-react';
import type { Match } from '@/lib/supabase/types';
import type { TacticsBoard } from '@/lib/tactics-board';
import { loadSharedBoards } from '@/lib/use-match-tactics';
import { clubLineupSide } from '@/lib/tournament-engine';

const TacticsBoardView = dynamic(() => import('./TacticsBoard').then(m => m.TacticsBoardView), { ssr: false });

export default function CoachBoards({ match, primaryColor }: { match: Match; primaryColor: string }) {
  const positions = match[`${clubLineupSide(match)}_lineup_coords`] || [];
  const hasLineup = positions.length > 0;
  const [boards, setBoards] = useState<TacticsBoard[]>([]);
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  // Boards only go out with a published line-up, so a game without one isn't asked about
  useEffect(() => {
    if (!hasLineup) return;
    let live = true;
    void loadSharedBoards(match.id).then(b => { if (live) setBoards(b); });
    return () => { live = false; };
  }, [match.id, hasLineup]);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!hasLineup || boards.length === 0) return null;
  return (
    <>
      <button type="button" className="btn btn-secondary btn-sm row" style={{ marginTop: '0.6rem' }} onClick={() => setOpen(true)}>
        <ClipboardList size={15} aria-hidden="true" /> Coach&rsquo;s boards ({boards.length})
      </button>
      {/* On <body>, so no animated section can trap the fixed overlay */}
      {open && createPortal(
        <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(0, 0, 0, 0.85)', backdropFilter: 'blur(12px)', display: 'flex', justifyContent: 'center', overflowY: 'auto', padding: '1rem' }}>
          <div role="dialog" aria-modal="true" aria-labelledby="coach-boards-title" className="glass-panel" onClick={e => e.stopPropagation()}
            style={{ margin: 'auto', width: '100%', maxWidth: '560px', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-xl)', padding: 'clamp(0.9rem, 4vw, 1.5rem)', boxShadow: 'var(--shadow-lg)' }}>
            <div className="row" style={{ justifyContent: 'space-between', gap: '0.75rem', marginBottom: '0.5rem' }}>
              <div style={{ minWidth: 0 }}>
                <h3 id="coach-boards-title" style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)' }}>Coach&rsquo;s boards</h3>
                <p className="text-meta">{match.home_team_name} vs {match.away_team_name}</p>
              </div>
              <button ref={closeRef} type="button" className="btn btn-secondary btn-sm" onClick={() => setOpen(false)} aria-label="Close" style={{ minWidth: '40px', minHeight: '40px', padding: 0 }}>
                <X size={16} aria-hidden="true" />
              </button>
            </div>
            <TacticsBoardView boards={boards} positions={positions} primaryColor={primaryColor} />
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
