'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Share2, Download, X } from 'lucide-react';
import { drawMatchCard, type CardKind } from '@/lib/share-card';
import { SITE_URL } from '@/lib/slugs';
import type { Club, Match } from '@/lib/supabase/types';

// "Share" on a match page: previews the matchday graphic, then hands it to the phone's share sheet
// (Instagram, WhatsApp...) or downloads it where the browser can't share files.
export default function MatchShareButton({ match, club }: { match: Match; club: Club }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [kind, setKind] = useState<CardKind>('score');
  const [image, setImage] = useState<{ blob: Blob; url: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const hasLineup = ((match.is_club_home ?? true) ? match.home_lineup_coords : match.away_lineup_coords)?.length;
  const fileName = `${club.slug}-${kind === 'lineup' ? 'lineup' : match.status === 'completed' ? 'result' : 'fixture'}.png`;

  // Redrawn when opened, when the card type changes and when the score moves
  useEffect(() => {
    if (!open) return;
    let url = '';
    let stale = false;
    setError(null);
    setImage(null);
    drawMatchCard(match, club, kind, new URL(SITE_URL).host)
      .then(blob => {
        if (stale) return;
        url = URL.createObjectURL(blob);
        setImage({ blob, url });
      })
      .catch(e => !stale && setError((e as Error).message));
    return () => { stale = true; if (url) URL.revokeObjectURL(url); };
  }, [open, kind, match, club]);

  const show = () => { setOpen(true); ref.current?.showModal(); };
  const hide = () => { ref.current?.close(); };

  const share = async () => {
    if (!image) return;
    const file = new File([image.blob], fileName, { type: 'image/png' });
    const link = `${window.location.origin}/${club.slug}/match/${match.id}`;
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: `${match.home_team_name} vs ${match.away_team_name}`, text: link });
      } catch { /* the user closed the share sheet */ }
      return;
    }
    download();
  };

  const download = () => {
    if (!image) return;
    const a = document.createElement('a');
    a.href = image.url;
    a.download = fileName;
    a.click();
  };

  const tab = (value: CardKind, label: string) => (
    <button type="button" className={`btn btn-sm ${kind === value ? 'btn-primary' : 'btn-secondary'}`} aria-pressed={kind === value} onClick={() => setKind(value)}>
      {label}
    </button>
  );

  return (
    <>
      <button type="button" onClick={show} className="btn btn-secondary btn-sm scroll-pill-item touch-target"
        style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', minHeight: '38px' }}>
        <Share2 size={14} aria-hidden="true" />
        <span>Share</span>
      </button>

      <dialog
        ref={ref}
        className="confirm-dialog glass-panel"
        style={{ width: 'min(480px, calc(100vw - 32px))', overscrollBehavior: 'contain' }}
        aria-labelledby="share-card-title"
        onClose={() => setOpen(false)}
        onClick={e => { if (e.target === e.currentTarget) hide(); }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
          <h2 id="share-card-title" className="confirm-dialog-title" style={{ margin: 0 }}>Share this match</h2>
          <button type="button" onClick={hide} className="btn btn-secondary btn-sm" aria-label="Close" style={{ minWidth: '44px', minHeight: '44px' }}>
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        {hasLineup ? <div role="group" aria-label="Graphic" style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>{tab('score', match.status === 'completed' ? 'Result' : 'Fixture')}{tab('lineup', 'Starting XI')}</div> : null}

        <div style={{ aspectRatio: '4 / 5', borderRadius: 'var(--radius-md)', overflow: 'hidden', background: 'rgba(var(--shade-rgb), 0.4)', display: 'grid', placeItems: 'center' }}>
          {error ? <p role="alert" style={{ padding: '1rem', textAlign: 'center' }}>{error}</p>
            : image ? <img src={image.url} alt={`Matchday graphic: ${match.home_team_name} vs ${match.away_team_name}`} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            : <p className="text-note" role="status">Drawing your graphic…</p>}
        </div>

        <div className="confirm-dialog-actions">
          <button type="button" className="btn btn-secondary" onClick={download} disabled={!image}>
            <Download size={16} aria-hidden="true" /> Download
          </button>
          <button type="button" className="btn btn-primary" onClick={share} disabled={!image}>
            <Share2 size={16} aria-hidden="true" /> Share
          </button>
        </div>
      </dialog>
    </>
  );
}
