'use client';

import { useEffect, useRef, useState } from 'react';
import { Download, Share2, X } from 'lucide-react';
import { useGroundSponsors } from '@/components/GroundSponsors';
import { drawFixturesPoster, posterColors, POSTER_MAX_GAMES, POSTER_STYLES, type PosterColors, type PosterFormat, type PosterStyle } from '@/lib/event-fixtures-poster';
import { CARD_SIZES, shareLink } from '@/lib/share-card';
import { publicScoreHidden } from '@/lib/teams';
import type { Club, ClubEvent, ClubTeam, Match } from '@/lib/supabase/types';

/**
 * Admin > Events > Fixtures > Make poster: the event's games on one story or post graphic, with the
 * sponsors whose package includes event flyers (the event's own sponsors first), to download or share.
 */
export default function EventFixturesPoster({ club, event, games, clubTeams, onClose }: {
  club: Club;
  event: ClubEvent;
  /** The club games linked to the event */
  games: Match[];
  clubTeams: ClubTeam[];
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const sponsors = useGroundSponsors(club.id, 'event_flyers', event.id);
  const [format, setFormat] = useState<PosterFormat>('story');
  const [showSponsors, setShowSponsors] = useState(true);
  // The last style picked on this device, so a club's posters keep one look
  const [style, setStyle] = useState<PosterStyle>(() => {
    try {
      const saved = localStorage.getItem('fixtures-poster-style');
      return saved && saved in POSTER_STYLES ? (saved as PosterStyle) : 'classic';
    } catch { return 'classic'; }
  });
  const pickStyle = (s: PosterStyle) => {
    setStyle(s);
    try { localStorage.setItem('fixtures-poster-style', s); } catch { /* private mode: not remembered */ }
  };
  // Colours the admin changed; the rest stay the club's own (so they follow the style)
  const [colors, setColors] = useState<Partial<PosterColors>>({});
  const shown = { ...posterColors(club, style), ...colors };
  const [image, setImage] = useState<{ url: string; blob: Blob } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { ref.current?.showModal(); }, []);

  const sponsorKey = JSON.stringify(showSponsors ? (sponsors || []).slice(0, 9)
    .map(s => [s.logo_url || '', s.name, s.tier === 'platinum' || s.tier === 'gold']) : []);
  useEffect(() => {
    if (sponsors === null) return;
    let stale = false;
    let url: string | null = null;
    const list = (JSON.parse(sponsorKey) as [string, string, boolean][]).map(([src, name, top]) => ({ src: src || undefined, name, top }));
    drawFixturesPoster(games.map(match => ({ match, hideScore: publicScoreHidden(match, clubTeams) })), event, club, shareLink(club), { format, sponsors: list, style, colors })
      .then(blob => {
        if (stale) return;
        url = URL.createObjectURL(blob);
        setImage({ url, blob });
        setError(null);
      })
      .catch(e => !stale && setError((e as Error).message));
    return () => { stale = true; if (url) URL.revokeObjectURL(url); };
  }, [games, clubTeams, event, club, format, style, colors, sponsorKey, sponsors]);

  const slug = event.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'event';
  const fileName = `${club.slug}-${slug}-fixtures-${format}.png`;
  const download = () => {
    if (!image) return;
    const a = document.createElement('a');
    a.href = image.url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };
  const share = async () => {
    if (!image) return;
    const file = new File([image.blob], fileName, { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: event.title });
        return;
      } catch (e) {
        if ((e as DOMException)?.name === 'AbortError') return;
      }
    }
    download();
  };

  const size = CARD_SIZES[format];
  const sizeTab = (f: PosterFormat, label: string, hint: string) => (
    <button type="button" aria-pressed={format === f} title={hint} onClick={() => setFormat(f)}
      className={`btn btn-sm ${format === f ? 'btn-primary' : 'btn-secondary'}`}>{label}</button>
  );

  return (
    <dialog ref={ref} className="confirm-dialog glass-panel" aria-labelledby="fixtures-poster-title"
      style={{ width: 'min(480px, calc(100vw - 32px))', overscrollBehavior: 'contain' }}
      onClose={onClose} onClick={e => { if (e.target === e.currentTarget) ref.current?.close(); }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
        <h2 id="fixtures-poster-title" className="confirm-dialog-title" style={{ margin: 0 }}>Fixtures poster</h2>
        <button type="button" onClick={() => ref.current?.close()} className="btn btn-secondary btn-sm" aria-label="Close" style={{ minWidth: '44px', minHeight: '44px' }}>
          <X size={16} aria-hidden="true" />
        </button>
      </div>

      <div role="group" aria-label="Size" style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
        {sizeTab('story', 'Story', 'Instagram or Facebook story, WhatsApp status')}
        {sizeTab('post', 'Post', 'Instagram feed, Facebook group, WhatsApp chat')}
      </div>
      <div role="radiogroup" aria-label="Style" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '1rem' }}>
        {(Object.keys(POSTER_STYLES) as PosterStyle[]).map(key => (
          <button key={key} type="button" role="radio" aria-checked={style === key} onClick={() => pickStyle(key)}
            className={`btn btn-sm ${style === key ? 'btn-primary' : 'btn-secondary'}`}>{POSTER_STYLES[key].label}</button>
        ))}
      </div>
      <div role="group" aria-label="Colours" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
        {([['primary', 'Main'], ['secondary', 'Second'], ['accent', 'Accent']] as const).map(([key, label]) => (
          <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', color: 'var(--text-secondary)', cursor: 'pointer', minHeight: 36 }}>
            <input type="color" value={shown[key]} onChange={e => setColors(c => ({ ...c, [key]: e.target.value.toUpperCase() }))}
              style={{ width: 36, height: 36, padding: 0, border: '1px solid var(--border-medium)', borderRadius: 8, background: 'none', cursor: 'pointer' }} />
            {label}
          </label>
        ))}
        {Object.keys(colors).length > 0 && (
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setColors({})}>Club colours</button>
        )}
      </div>

      <div style={{ aspectRatio: `${size.w} / ${size.h}`, height: format === 'story' ? 'min(56vh, 600px)' : undefined, maxWidth: '100%', margin: '0 auto', borderRadius: 'var(--radius-md)', overflow: 'hidden', background: 'rgba(var(--shade-rgb), 0.4)', display: 'grid', placeItems: 'center' }}>
        {error ? <p role="alert" style={{ padding: '1rem', textAlign: 'center' }}>{error}</p>
          : image ? <img src={image.url} alt={`Fixtures poster for ${event.title}`} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          : <p className="text-note" role="status">Drawing your poster…</p>}
      </div>

      {games.length > POSTER_MAX_GAMES && (
        <p className="text-note" style={{ margin: '0.5rem 0 0', fontSize: '0.82rem' }}>The poster fits the first {POSTER_MAX_GAMES} games.</p>
      )}
      {!!sponsors?.length && (
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.75rem', fontSize: '0.88rem', color: 'var(--text-secondary)', cursor: 'pointer', minHeight: 36 }}>
          <input type="checkbox" checked={showSponsors} onChange={e => setShowSponsors(e.target.checked)} style={{ width: 18, height: 18 }} />
          Show sponsors
        </label>
      )}

      <div className="confirm-dialog-actions">
        <button type="button" className="btn btn-secondary" onClick={download} disabled={!image}>
          <Download size={16} aria-hidden="true" /> Download
        </button>
        <button type="button" className="btn btn-primary" onClick={share} disabled={!image}>
          <Share2 size={16} aria-hidden="true" /> Share
        </button>
      </div>
    </dialog>
  );
}
