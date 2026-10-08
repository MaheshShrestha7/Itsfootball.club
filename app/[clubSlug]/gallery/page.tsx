'use client';

import React, { use, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Images } from 'lucide-react';
import { useClub } from '@/lib/club-context';
import { AlbumGrid, Lightbox, groupAlbums, photoCount } from '@/components/PhotoGallery';
import NewsVideo from '@/components/NewsVideo';
import LocalTime from '@/components/LocalTime';
import { videoEmbed } from '@/lib/video';

export default function GalleryPage({ params }: { params: Promise<{ clubSlug: string }> }) {
  const { clubSlug } = use(params);
  const { clubs, selectClubBySlug, gallery, news, isHydrated } = useClub();
  const club = selectClubBySlug(clubSlug) || clubs[0];

  const [openName, setOpenName] = useState<string | null>(null);
  const [viewing, setViewing] = useState<number | null>(null);
  // ponytail: the open album isn't in the URL, so albums can't be linked to directly; add ?album= if clubs ask

  const albums = groupAlbums(gallery.filter(g => g.club_id === club.id));
  const album = albums.find(a => a.name === openName);
  // Videos are the club's news articles with a playable video link
  const videos = news
    .filter(n => n.club_id === club.id && videoEmbed(n.video_embed_url))
    .sort((a, b) => (b.published_at || '').localeCompare(a.published_at || ''));

  return (
    <div style={{ minHeight: '85vh', padding: '3rem 0 5rem 0' }}>
      <div className="container" style={{ maxWidth: '1080px' }}>
        {album ? (
          <button type="button" onClick={() => setOpenName(null)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem', background: 'none', border: 0, padding: 0, cursor: 'pointer' }}>
            <ArrowLeft size={16} /> All albums
          </button>
        ) : (
          <Link href={`/${club.slug}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
            <ArrowLeft size={16} /> Back to {club.name}
          </Link>
        )}

        <h1 style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--text-primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.6rem', overflowWrap: 'anywhere' }}>
          <Images size={30} color="var(--club-primary)" className="shrink-0" /> {album ? album.name : 'Gallery & Videos'}
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
          {album ? photoCount(album.photos.length) : `Photos and videos from ${club.name}: matchdays, training and club life.`}
        </p>

        {!album ? (
          albums.length === 0 && videos.length === 0 ? (
            <div className="glass-panel" style={{ padding: '1.5rem' }}>
              {isHydrated ? 'No photos or videos yet. Check back after the next matchday.' : 'Loading…'}
            </div>
          ) : (
            <div className="stack" style={{ gap: '3rem' }}>
              {albums.length > 0 && (
                <section aria-labelledby="gallery-albums">
                  <h2 id="gallery-albums" style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '1rem' }}>Photo albums</h2>
                  <AlbumGrid albums={albums} onOpen={name => setOpenName(name)} />
                </section>
              )}
              {videos.length > 0 && (
                <section aria-labelledby="gallery-videos">
                  <h2 id="gallery-videos" style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '1rem' }}>Videos</h2>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 320px), 1fr))', gap: '1.25rem' }}>
                    {videos.map(v => (
                      <article key={v.id} className="glass-panel" style={{ padding: '0.75rem', minWidth: 0 }}>
                        <NewsVideo url={v.video_embed_url} title={v.title} style={{ marginBottom: '0.75rem' }} />
                        <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', overflowWrap: 'anywhere' }}>{v.title}</h3>
                        {v.published_at && <div className="text-meta"><LocalTime value={v.published_at} format="date" /></div>}
                      </article>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )
        ) : (
          <>
            <div className="gallery-grid">
              {album.photos.map((photo, i) => (
                <button key={photo.id} type="button" className="gallery-tile" onClick={() => setViewing(i)}
                  aria-label={photo.title ? `View photo: ${photo.title}` : `View photo ${i + 1} of ${album.photos.length}`}>
                  <img src={photo.media_url} alt={photo.title || ''} loading="lazy" decoding="async" />
                  {photo.title && (
                    <span className="gallery-tile-caption" style={{ fontSize: '0.85rem', fontWeight: 600 }}>{photo.title}</span>
                  )}
                </button>
              ))}
            </div>
            <Lightbox photos={album.photos} index={viewing} onIndex={setViewing} onClose={() => setViewing(null)} />
          </>
        )}
      </div>
    </div>
  );
}
