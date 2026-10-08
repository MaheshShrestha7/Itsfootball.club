'use client';

import React, { use, useState } from 'react';
import Link from 'next/link';
import { Images, FolderPlus, ArrowLeft, UploadCloud, Trash2, Pencil, RefreshCw, Star } from 'lucide-react';
import { useClub } from '@/lib/club-context';
import type { MediaGalleryItem } from '@/lib/supabase/types';
import { deleteUploadedPhoto, uploadImage } from '@/components/ImageUploadZone';
import { confirmAction, notify } from '@/components/ConfirmDialog';
import { AlbumGrid, groupAlbums, photoCount } from '@/components/PhotoGallery';

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_ALBUM_NAME = 128; // media_gallery.album_name is VARCHAR(128)

export default function AdminGalleryPage({ params }: { params: Promise<{ clubSlug: string }> }) {
  const { clubSlug } = use(params);
  const { clubs, selectClubBySlug, gallery, addMediaItem, updateMediaItems, deleteMediaItems, saveNow } = useClub();
  const club = selectClubBySlug(clubSlug) || clubs[0];

  const [openName, setOpenName] = useState<string | null>(null);
  // An album only exists once it holds a photo; a new one lives here until its first upload
  const [draftName, setDraftName] = useState<string | null>(null);
  const [newName, setNewName] = useState<string | null>(null);
  const [renameTo, setRenameTo] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  const albums = groupAlbums(gallery.filter(g => g.club_id === club.id));
  if (draftName && !albums.some(a => a.name === draftName)) albums.unshift({ name: draftName, photos: [] });
  const album = albums.find(a => a.name === openName);
  const totalPhotos = albums.reduce((n, a) => n + a.photos.length, 0);

  const openAlbum = (name: string | null) => {
    setOpenName(name);
    setRenameTo(null);
  };

  const createAlbum = (e: React.FormEvent) => {
    e.preventDefault();
    const name = (newName || '').trim().slice(0, MAX_ALBUM_NAME);
    if (!name) return;
    if (!albums.some(a => a.name === name)) setDraftName(name);
    setNewName(null);
    openAlbum(name);
  };

  const upload = async (files: File[]) => {
    if (!album || progress) return;
    const images = files.filter(f => IMAGE_TYPES.includes(f.type));
    const failures = files.filter(f => !IMAGE_TYPES.includes(f.type)).map(f => `${f.name}: not a PNG, JPG, WebP or GIF`);
    setProgress({ done: 0, total: images.length });
    // One at a time: the upload API is rate limited per admin
    for (const [i, file] of images.entries()) {
      try {
        const url = await uploadImage(file, { folder: 'gallery', clubId: club.id, maxDimension: 1600 });
        addMediaItem({ club_id: club.id, title: '', media_type: 'image', media_url: url, album_name: album.name });
      } catch (err) {
        failures.push(`${file.name}: ${(err as Error).message}`);
      }
      setProgress({ done: i + 1, total: images.length });
    }
    setProgress(null);
    if (failures.length) {
      notify(`${failures.length} file${failures.length === 1 ? ' was' : 's were'} not uploaded`, failures.slice(0, 4).join('\n'));
    }
  };

  const removePhotos = async (photos: MediaGalleryItem[]) => {
    deleteMediaItems(photos.map(p => p.id));
    // The rows must be gone before the server agrees to delete their files
    await saveNow();
    await Promise.all(photos.map(p => deleteUploadedPhoto(club.id, p.media_url, 'gallery')));
  };

  const deletePhoto = async (photo: MediaGalleryItem) => {
    if (await confirmAction({ title: 'Delete this photo?', message: 'It is removed from the gallery for good.', confirmLabel: 'Delete photo', danger: true })) {
      removePhotos([photo]);
    }
  };

  const deleteAlbum = async () => {
    if (!album) return;
    if (album.photos.length && !(await confirmAction({
      title: `Delete the album "${album.name}"?`,
      message: `All ${photoCount(album.photos.length)} in it are deleted for good.`,
      confirmLabel: 'Delete album',
      danger: true,
    }))) return;
    if (draftName === album.name) setDraftName(null);
    openAlbum(null);
    removePhotos(album.photos);
  };

  const setCover = (photo: MediaGalleryItem) => {
    if (!album) return;
    const previous = album.photos.filter(p => p.is_album_cover && p.id !== photo.id).map(p => p.id);
    if (previous.length) updateMediaItems(previous, { is_album_cover: false });
    updateMediaItems([photo.id], { is_album_cover: true });
  };

  // A photo leaving its album stops being that album's cover, so the album it joins keeps its own.
  // A whole album merged in (keepCover) brings its cover along when the album it joins has none chosen.
  const moveToAlbum = (photos: MediaGalleryItem[], name: string, keepCover = false) => {
    const targetHasCover = albums.some(a => a.name === name && a.photos.some(p => p.is_album_cover));
    const covers = photos.filter(p => p.is_album_cover).map(p => p.id);
    if (covers.length && (!keepCover || targetHasCover)) updateMediaItems(covers, { is_album_cover: false });
    updateMediaItems(photos.map(p => p.id), { album_name: name });
  };

  const renameAlbum = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = (renameTo || '').trim().slice(0, MAX_ALBUM_NAME);
    if (!album || !name || name === album.name) return setRenameTo(null);
    const merging = albums.some(a => a.name === name);
    if (merging && !(await confirmAction({
      title: `Merge into "${name}"?`,
      message: `An album called "${name}" already exists. Its photos and these ones will be in one album.`,
      confirmLabel: 'Merge albums',
    }))) return;
    if (merging) moveToAlbum(album.photos, name, true);
    else updateMediaItems(album.photos.map(p => p.id), { album_name: name });
    if (draftName === album.name) setDraftName(name);
    openAlbum(name);
  };

  return (
    <div className="stack" style={{ gap: '1.5rem' }}>
      <div>
        <span className="badge badge-primary" style={{ marginBottom: '0.4rem', letterSpacing: '0.05em' }}>WEBSITE & MARKETING • GALLERY</span>
        <h1 style={{ fontSize: '2.2rem', fontWeight: 900, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <Images size={30} /> Photo Gallery
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', maxWidth: '680px', marginTop: '0.2rem' }}>
          Upload photos into albums for the club website. Public page:{' '}
          <Link href={`/${club.slug}/gallery`} style={{ color: 'var(--club-primary)' }}>/{club.slug}/gallery</Link>
        </p>
      </div>

      {!album ? (
        <div className="glass-panel" style={{ padding: 'clamp(1.2rem, 3vw, 1.75rem)' }}>
          <div className="section-head row-wrap" style={{ gap: '0.75rem' }}>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)' }}>Albums</h3>
              <p className="text-note">{albums.length} album{albums.length === 1 ? '' : 's'} • {photoCount(totalPhotos)}</p>
            </div>
            {newName === null ? (
              <button type="button" className="btn btn-primary" onClick={() => setNewName('')}>
                <FolderPlus size={16} /> New album
              </button>
            ) : (
              <form onSubmit={createAlbum} className="row row-wrap">
                <input aria-label="Album name" className="form-input" style={{ width: 'min(260px, 100%)' }} autoFocus
                  placeholder="e.g. Grand Final 2026" maxLength={MAX_ALBUM_NAME}
                  value={newName} onChange={e => setNewName(e.target.value)} />
                <button type="submit" className="btn btn-primary" disabled={!newName.trim()}>Create</button>
                <button type="button" className="btn btn-secondary" onClick={() => setNewName(null)}>Cancel</button>
              </form>
            )}
          </div>

          {albums.length === 0 ? (
            <p className="text-note">No albums yet. Create one, then upload photos into it.</p>
          ) : (
            <AlbumGrid albums={albums} onOpen={openAlbum} />
          )}
        </div>
      ) : (
        <div className="glass-panel" style={{ padding: 'clamp(1.2rem, 3vw, 1.75rem)' }}>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => openAlbum(null)} style={{ marginBottom: '1rem' }}>
            <ArrowLeft size={14} /> All albums
          </button>

          <div className="section-head row-wrap" style={{ gap: '0.75rem' }}>
            {renameTo === null ? (
              <div className="min-w-0">
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', overflowWrap: 'anywhere' }}>{album.name}</h3>
                <p className="text-note">
                  {photoCount(album.photos.length)}{album.photos.length > 1 && ' • Use Make cover to choose the album cover'}
                </p>
              </div>
            ) : (
              <form onSubmit={renameAlbum} className="row row-wrap">
                <input aria-label="New album name" className="form-input" style={{ width: 'min(260px, 100%)' }} autoFocus
                  maxLength={MAX_ALBUM_NAME} value={renameTo} onChange={e => setRenameTo(e.target.value)} />
                <button type="submit" className="btn btn-primary btn-sm">Save</button>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setRenameTo(null)}>Cancel</button>
              </form>
            )}
            {renameTo === null && (
              <div className="row">
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setRenameTo(album.name)}><Pencil size={14} /> Rename</button>
                <button type="button" className="btn btn-danger btn-sm" onClick={deleteAlbum}><Trash2 size={14} /> Delete album</button>
              </div>
            )}
          </div>

          <label
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={e => { e.preventDefault(); setDragging(false); upload(Array.from(e.dataTransfer.files)); }}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem',
              padding: '1.5rem', marginBottom: '1.5rem', textAlign: 'center',
              border: `2px dashed ${dragging ? 'var(--club-primary)' : 'var(--border-subtle)'}`,
              borderRadius: 'var(--radius-md)',
              background: dragging ? 'rgba(var(--club-primary-rgb), 0.08)' : 'rgba(var(--shade-rgb), 0.2)',
              cursor: progress ? 'wait' : 'pointer',
            }}
          >
            <input type="file" multiple accept={IMAGE_TYPES.join(',')} disabled={!!progress} style={{ display: 'none' }}
              onChange={e => { upload(Array.from(e.target.files || [])); e.target.value = ''; }} />
            {progress ? <RefreshCw size={22} className="animate-spin" color="var(--club-primary)" /> : <UploadCloud size={24} color="var(--club-primary)" />}
            <strong style={{ color: 'var(--text-primary)', fontSize: '0.9rem' }}>
              {progress ? `Uploading ${progress.done} of ${progress.total}...` : 'Choose photos or drag them here'}
            </strong>
            <span className="text-meta">PNG, JPG, WebP or GIF. Select as many as you like.</span>
          </label>

          {album.photos.length === 0 ? (
            <p className="text-note">This album is empty. Upload photos to save it.</p>
          ) : (
            <div className="gallery-grid">
              {album.photos.map(photo => (
                <div key={photo.id} style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', overflow: 'hidden', background: 'rgba(var(--shade-rgb), 0.2)' }}>
                  <div style={{ position: 'relative' }}>
                    <img src={photo.media_url} alt={photo.title || album.name} loading="lazy" decoding="async"
                      style={{ display: 'block', width: '100%', aspectRatio: '4 / 3', objectFit: 'cover' }} />
                    {album.cover?.id === photo.id && (
                      <span className="badge badge-primary" style={{ position: 'absolute', top: '0.5rem', left: '0.5rem', background: 'var(--club-primary)', color: 'var(--club-primary-contrast, #fff)' }}>
                        <Star size={11} fill="currentColor" /> Cover
                      </span>
                    )}
                  </div>
                  <div className="stack" style={{ gap: '0.5rem', padding: '0.6rem' }}>
                    <input aria-label="Caption" className="form-input" style={{ fontSize: '0.8rem', padding: '0.45rem 0.6rem' }}
                      placeholder="Caption (optional)" maxLength={255} defaultValue={photo.title}
                      onBlur={e => {
                        const title = e.target.value.trim();
                        if (title !== photo.title) updateMediaItems([photo.id], { title });
                      }} />
                    <select aria-label="Move to album" className="form-select" style={{ fontSize: '0.8rem', padding: '0.45rem 0.6rem' }}
                      value={photo.album_name} onChange={e => moveToAlbum([photo], e.target.value)}>
                      {albums.filter(a => a.photos.length > 0 || a.name === draftName).map(a => (
                        <option key={a.name} value={a.name}>{a.name === album.name ? a.name : `Move to ${a.name}`}</option>
                      ))}
                    </select>
                    <div className="row">
                      <button type="button" className="btn btn-secondary btn-sm" style={{ flex: 1, minWidth: 0 }}
                        aria-label={album.cover?.id === photo.id ? 'Album cover' : 'Use as album cover'}
                        aria-pressed={album.cover?.id === photo.id}
                        disabled={album.cover?.id === photo.id}
                        onClick={() => setCover(photo)}>
                        <Star size={14} fill={album.cover?.id === photo.id ? 'currentColor' : 'none'} />
                        {album.cover?.id === photo.id ? 'Cover' : 'Make cover'}
                      </button>
                      <button type="button" className="btn btn-danger btn-sm shrink-0" aria-label="Delete photo" title="Delete photo" onClick={() => deletePhoto(photo)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
