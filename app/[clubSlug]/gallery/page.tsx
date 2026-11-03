'use client';

import React, { use, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useClub } from '@/lib/club-context';
import { AlbumGrid, Lightbox, groupAlbums, photoCount } from '@/components/PhotoGallery';
import NewsVideo from '@/components/NewsVideo';
import LocalTime from '@/components/LocalTime';
import { videoEmbed } from '@/lib/video';
import { useUrlParam } from '@/lib/use-url-tab';
import ClubSubPage, { EmptyState, ListSkeleton } from '@/components/ClubSubPage';

export default function GalleryPage({ params }: { params: Promise<{ clubSlug: string }> }) {
  const { clubSlug } = use(params);
  const { clubs, selectClubBySlug, gallery, news, isHydrated } = useClub();
  const club = selectClubBySlug(clubSlug) || clubs[0];

  // The open album is in the URL (?album=Grand%20Final) so it can be shared and Back closes it
  const [openName, setAlbum] = useUrlParam('album');
  const setOpenName = (name: string | null) => { setAlbum(name || ''); setViewing(null); };
  const [viewing, setViewing] = useState<number | null>(null);

  const albums = groupAlbums(gallery.filter(g => g.club_id === club.id));
  const album = albums.find(a => a.name === openName);
  // Videos are the club's news articles with a playable video link
  const videos = news
    .filter(n => n.club_id === club.id && videoEmbed(n.video_embed_url))
    .sort((a, b) => (b.published_at || '').localeCompare(a.published_at || ''));

  return (
    <ClubSubPage
      club={club}
      title={album ? album.name : 'Gallery & videos'}
      trail={album ? [{ href: `/${club.slug}/gallery`, label: 'Gallery' }] : []}
      intro={album ? photoCount(album.photos.length) : `Photos and videos from ${club.name}: matchdays, training and club life.`}
      actions={album ? (
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setOpenName(null)} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
          <ArrowLeft size={15} aria-hidden="true" /> All albums
        </button>
      ) : undefined}
    >
        {!album ? (
          !isHydrated ? (
            <ListSkeleton rows={2} height={200} label="Loading the gallery" />
          ) : albums.length === 0 && videos.length === 0 ? (
            <EmptyState title="No photos or videos yet">Check back after the next matchday.</EmptyState>
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
    </ClubSubPage>
  );
}
