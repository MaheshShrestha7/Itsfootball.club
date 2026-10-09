'use client';

import React, { useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, ImageIcon, X } from 'lucide-react';
import type { MediaGalleryItem } from '@/lib/supabase/types';

export interface Album {
  name: string;
  photos: MediaGalleryItem[];
  /** The chosen cover photo, else the newest */
  cover?: MediaGalleryItem;
}

/** The database's default album_name */
const DEFAULT_ALBUM = 'Matchday Moments';

/** A club's photos grouped by album: newest photo first, and albums ordered by their newest photo */
export function groupAlbums(items: MediaGalleryItem[]): Album[] {
  const albums = new Map<string, MediaGalleryItem[]>();
  items
    .filter(i => i.media_type === 'image')
    .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
    .forEach(p => {
      const name = p.album_name || DEFAULT_ALBUM;
      albums.set(name, [...(albums.get(name) || []), p]);
    });
  return Array.from(albums, ([name, photos]) => ({ name, photos, cover: photos.find(p => p.is_album_cover) || photos[0] }));
}

export function photoCount(n: number) {
  return `${n} photo${n === 1 ? '' : 's'}`;
}

/** Album covers; clicking one opens it */
export function AlbumGrid({ albums, onOpen }: { albums: Album[]; onOpen: (name: string) => void }) {
  return (
    <div className="gallery-grid">
      {albums.map(a => (
        <button data-view-ok key={a.name} type="button" className="gallery-tile" onClick={() => onOpen(a.name)}>
          {a.cover ? (
            <img src={a.cover.media_url} alt="" loading="lazy" decoding="async" />
          ) : (
            <span style={{ display: 'grid', placeItems: 'center', height: '100%', color: 'var(--text-muted)' }}>
              <ImageIcon size={32} />
            </span>
          )}
          <span className="gallery-tile-caption">
            <strong style={{ display: 'block', fontSize: '0.95rem' }}>{a.name}</strong>
            <span style={{ fontSize: '0.75rem', opacity: 0.85 }}>{photoCount(a.photos.length)}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

/** Full-screen photo viewer: arrow keys or swipe to move, Esc or the backdrop to close */
export function Lightbox({ photos, index, onIndex, onClose }: {
  photos: MediaGalleryItem[];
  index: number | null;
  onIndex: (index: number) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const touchX = useRef<number | null>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (index !== null && !dialog.open) dialog.showModal();
    if (index === null && dialog.open) dialog.close();
  }, [index]);

  const photo = index === null ? undefined : photos[index];
  const step = (by: number) => {
    if (index !== null && photos.length > 1) onIndex((index + by + photos.length) % photos.length);
  };

  return (
    <dialog
      ref={ref}
      className="lightbox"
      aria-label="Photo viewer"
      onClose={onClose}
      onKeyDown={e => {
        if (e.key === 'ArrowLeft') step(-1);
        if (e.key === 'ArrowRight') step(1);
      }}
      onClick={e => {
        if (e.target === e.currentTarget || (e.target as HTMLElement).classList.contains('lightbox-inner')) onClose();
      }}
      onTouchStart={e => { touchX.current = e.touches[0].clientX; }}
      onTouchEnd={e => {
        const dx = e.changedTouches[0].clientX - (touchX.current ?? e.changedTouches[0].clientX);
        if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
        touchX.current = null;
      }}
    >
      {photo && (
        <div className="lightbox-inner">
          <img src={photo.media_url} alt={photo.title || photo.album_name} />
          <button type="button" className="lightbox-btn lightbox-close" aria-label="Close" onClick={onClose}><X size={20} /></button>
          {photos.length > 1 && (
            <>
              <button type="button" className="lightbox-btn lightbox-prev" aria-label="Previous photo" onClick={() => step(-1)}><ChevronLeft size={22} /></button>
              <button type="button" className="lightbox-btn lightbox-next" aria-label="Next photo" onClick={() => step(1)}><ChevronRight size={22} /></button>
            </>
          )}
          <div className="lightbox-caption">
            {photo.title && <div style={{ fontWeight: 700 }}>{photo.title}</div>}
            <div style={{ opacity: 0.7, fontSize: '0.8rem' }}>{index! + 1} / {photos.length}</div>
          </div>
        </div>
      )}
    </dialog>
  );
}
