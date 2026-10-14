'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Share2, Download, X } from 'lucide-react';
import { CARD_SIZES, drawMatchCard, shareLink, type CardFormat, type CardKind, type CardOptions } from '@/lib/share-card';
import type { Club, Match, MatchEvent } from '@/lib/supabase/types';

// "Share" on a match page (and on each fixture in Admin > Matches): previews the matchday graphic as a
// story or a post, then hands it to the phone's share sheet (Instagram, Facebook, WhatsApp...) or
// downloads it where the browser can't share files.
// hideScore: the team hides its scores publicly (junior grassroots rules), so the card never shows one
// events: the match's events with public names (junior players shortened); goals list the scorers
// photos: player photos by member id for the lineup pitch, as the public site shows them
export default function MatchShareButton({ match, club, hideScore = false, events, photos, trigger }: {
  match: Match;
  club: Club;
  hideScore?: boolean;
  events?: CardOptions['events'];
  photos?: CardOptions['photos'];
  /** Draws the button that opens the dialog, for places with their own button style */
  trigger?: (open: () => void) => React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [kind, setKind] = useState<CardKind>('score');
  const [format, setFormat] = useState<CardFormat>('story');
  const [image, setImage] = useState<{ blob: Blob; url: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const hasLineup = ((match.is_club_home ?? true) ? match.home_lineup_coords : match.away_lineup_coords)?.length;
  const fileName = `${club.slug}-${kind === 'lineup' ? 'lineup' : match.status === 'completed' && !hideScore ? 'result' : 'fixture'}-${format}.png`;

  // Only the goals matter here, and the caller may pass a new array on every render (a live match
  // ticks), so the graphic redraws when a goal changes, not on every render
  const goalsKey = JSON.stringify((events || []).filter(e => e.event_type === 'goal' || e.event_type === 'penalty')
    .map(e => [e.team_side, e.player_name, e.minute, e.added_minute || 0, e.event_type]));
  const goals = useMemo(() => JSON.parse(goalsKey).map(([team_side, player_name, minute, added_minute, event_type]: [MatchEvent['team_side'], string, number, number, MatchEvent['event_type']]) =>
    ({ team_side, player_name, minute, added_minute, event_type })) as NonNullable<CardOptions['events']>, [goalsKey]);

  // Redrawn when opened, when the card type or size changes and when the score moves
  useEffect(() => {
    if (!open) return;
    let url = '';
    let stale = false;
    setError(null);
    setImage(null);
    drawMatchCard(match, club, kind, shareLink(club), { hideScore, format, events: hideScore ? undefined : goals, photos })
      .then(blob => {
        if (stale) return;
        url = URL.createObjectURL(blob);
        setImage({ blob, url });
      })
      .catch(e => !stale && setError((e as Error).message));
    return () => { stale = true; if (url) URL.revokeObjectURL(url); };
  }, [open, kind, format, match, club, hideScore, goals, photos]);

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
  const sizeTab = (value: CardFormat, label: string, hint: string) => (
    <button type="button" className={`btn btn-sm ${format === value ? 'btn-primary' : 'btn-secondary'}`} aria-pressed={format === value} onClick={() => setFormat(value)} title={hint}>
      {label}
    </button>
  );
  const size = CARD_SIZES[format];

  return (
    <>
      {trigger ? trigger(show) : (
        <button type="button" onClick={show} className="btn btn-secondary btn-sm scroll-pill-item touch-target"
          style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', minHeight: '44px' }}>
          <Share2 size={14} aria-hidden="true" />
          <span>Share</span>
        </button>
      )}

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

        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
          {hasLineup ? <div role="group" aria-label="Graphic" style={{ display: 'flex', gap: '0.5rem' }}>{tab('score', match.status === 'completed' && !hideScore ? 'Result' : 'Fixture')}{tab('lineup', 'Starting XI')}</div> : <span />}
          <div role="group" aria-label="Size" style={{ display: 'flex', gap: '0.5rem' }}>
            {sizeTab('story', 'Story', 'Instagram or Facebook story, WhatsApp status')}
            {sizeTab('post', 'Post', 'Instagram feed, Facebook group, WhatsApp chat')}
          </div>
        </div>

        <div style={{ aspectRatio: `${size.w} / ${size.h}`, height: format === 'story' ? 'min(56vh, 600px)' : undefined, maxWidth: '100%', margin: '0 auto', borderRadius: 'var(--radius-md)', overflow: 'hidden', background: 'rgba(var(--shade-rgb), 0.4)', display: 'grid', placeItems: 'center' }}>
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
