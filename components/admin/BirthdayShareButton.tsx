'use client';

import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Copy, Download, ImagePlus, Scissors, Share2, X } from 'lucide-react';
import { drawBirthdayCard, type BirthdayCardInput } from '@/lib/birthday-card';
import {
  BIRTHDAY_PALETTES,
  BIRTHDAY_STYLES,
  birthdayFileName,
  effectiveBirthdayStyle,
  type BirthdayPaletteMode,
  type BirthdayStyle,
} from '@/lib/birthday-card-meta';
import { removeBackground } from '@/lib/remove-background';
import { useClub } from '@/lib/club-context';
import { isSponsorOnSite, sortSponsorsByTier } from '@/lib/sponsors';
import type { CardFormat } from '@/lib/share-card';
import type { Club } from '@/lib/supabase/types';

// "Share from my phone" for a player birthday card in Admin > Social media:
// 7 pro-level club-branded variations, 4:5 / 9:16 / 1:1 formats, club colour palette switcher,
// optional photo swap + MediaPipe background removal + framing sliders, caption copy, and share sheet.
export default function BirthdayShareButton({
  player,
  club,
  caption,
  onCaption,
  onShared,
  trigger,
}: {
  player: BirthdayCardInput;
  club: Pick<Club, 'id' | 'slug' | 'name' | 'logo_url' | 'primary_color' | 'secondary_color'>;
  caption: string;
  onCaption: (caption: string) => void;
  onShared?: () => void;
  trigger: (open: () => void) => React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const captionId = useId();
  const [open, setOpen] = useState(false);

  const [style, setStyle] = useState<BirthdayStyle>(player.photoUrl ? 'ucl' : 'kit');
  const [format, setFormat] = useState<CardFormat>('post');
  const [paletteMode, setPaletteMode] = useState<BirthdayPaletteMode>('club');
  const [customColor, setCustomColor] = useState<string>(club.primary_color || '#C8102E');
  const [showAge, setShowAge] = useState(false);
  const [showSponsors, setShowSponsors] = useState(true);

  const [overridePhoto, setOverridePhoto] = useState<string | null>(null);
  const [cutoutUrl, setCutoutUrl] = useState<string | null>(null);
  const [cutting, setCutting] = useState(false);
  const [cutError, setCutError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [focusX, setFocusX] = useState(0.5);
  const [focusY, setFocusY] = useState(0.22);

  const [image, setImage] = useState<{ blob: Blob; url: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { sponsors } = useClub();
  const sponsorKey = JSON.stringify(
    sortSponsorsByTier(sponsors.filter(s => s.club_id === club.id && !s.event_id && isSponsorOnSite(s)))
      .slice(0, 6)
      .map(s => [s.logo_url || '', s.name, s.tier === 'platinum' || s.tier === 'gold']),
  );
  const cardSponsors = useMemo(
    () => (JSON.parse(sponsorKey) as [string, string, boolean][]).map(([src, name, top]) => ({ src: src || undefined, name, top })),
    [sponsorKey],
  );

  // Sync native <dialog> open state without accessing ref inside render/callbacks
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  // Revoke object URL when overridden photo changes or unmounts
  useEffect(() => {
    return () => {
      if (overridePhoto && overridePhoto.startsWith('blob:')) URL.revokeObjectURL(overridePhoto);
    };
  }, [overridePhoto]);

  const activePhoto = cutoutUrl || overridePhoto || player.photoUrl;
  const effectiveStyle = effectiveBirthdayStyle(style, !!activePhoto);
  const activeMeta = BIRTHDAY_STYLES.find(s => s.id === effectiveStyle) || BIRTHDAY_STYLES[0];
  const fileName = birthdayFileName(club.slug, player.displayName, effectiveStyle, format);

  useEffect(() => {
    if (!open) return;
    let url = '';
    let stale = false;
    drawBirthdayCard(
      { ...player, photoUrl: activePhoto },
      club,
      {
        style,
        format,
        paletteMode,
        customColor,
        showAge: !player.isJunior && showAge,
        zoom,
        focusX,
        focusY,
        cutout: !!cutoutUrl,
        sponsors: showSponsors ? cardSponsors : [],
      },
    )
      .then(blob => {
        if (stale) return;
        url = URL.createObjectURL(blob);
        setError(null);
        setImage({ blob, url });
      })
      .catch(e => !stale && setError((e as Error).message));
    return () => {
      stale = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [
    open,
    player,
    activePhoto,
    club,
    style,
    format,
    paletteMode,
    customColor,
    showAge,
    showSponsors,
    cardSponsors,
    zoom,
    focusX,
    focusY,
    cutoutUrl,
  ]);

  const stepStyle = (delta: number) => {
    const idx = BIRTHDAY_STYLES.findIndex(s => s.id === style);
    setStyle(BIRTHDAY_STYLES[(idx + delta + BIRTHDAY_STYLES.length) % BIRTHDAY_STYLES.length].id);
  };

  const handlePhotoPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (overridePhoto && overridePhoto.startsWith('blob:')) URL.revokeObjectURL(overridePhoto);
    setOverridePhoto(URL.createObjectURL(file));
    setCutoutUrl(null);
    setCutError(null);
    if (style === 'kit') setStyle('ucl');
    e.target.value = '';
  };

  const handleRemoveBg = async () => {
    const src = overridePhoto || player.photoUrl;
    if (!src) return;
    if (cutoutUrl) {
      setCutoutUrl(null);
      return;
    }
    setCutting(true);
    setCutError(null);
    try {
      const png = await removeBackground(src);
      setCutoutUrl(png);
    } catch (e) {
      setCutError((e as Error).message || 'Could not remove background.');
    } finally {
      setCutting(false);
    }
  };

  const copyCaption = async () => {
    try {
      await navigator.clipboard.writeText(caption);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch { /* clipboard unavailable */ }
  };

  const download = () => {
    if (!image) return;
    const a = document.createElement('a');
    a.href = image.url;
    a.download = fileName;
    a.click();
  };

  const share = async () => {
    if (!image) return;
    await copyCaption();
    const file = new File([image.blob], fileName, { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: `Happy Birthday ${player.displayName}`, text: caption });
        onShared?.();
      } catch { /* closed share sheet */ }
      return;
    }
    download();
  };

  const show = () => setOpen(true);

  const previewAspect = format === 'story' ? '9 / 16' : format === 'square' ? '1 / 1' : '4 / 5';

  return (
    <>
      {trigger(show)}
      <dialog
        ref={ref}
        className="confirm-dialog glass-panel bday-dialog"
        style={{ width: 'min(920px, calc(100vw - 24px))', maxHeight: 'calc(100dvh - 24px)', overscrollBehavior: 'contain' }}
        aria-labelledby={titleId}
        onClose={() => setOpen(false)}
        onClick={e => { if (e.target === e.currentTarget) setOpen(false); }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '0.85rem' }}>
          <div>
            <h2 id={titleId} className="confirm-dialog-title" style={{ margin: 0 }}>
              Birthday card — {player.displayName}
            </h2>
            <p className="text-note" style={{ margin: '0.15rem 0 0', fontSize: '0.8rem' }}>
              {activeMeta.num} {'//'} {activeMeta.label} — {activeMeta.hint}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="btn btn-secondary btn-sm"
            aria-label="Close"
            style={{ minWidth: '44px', minHeight: '44px' }}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <div className="bday-grid">
          {/* Left: Live 1080px Canvas Preview */}
          <div className="bday-preview-col">
            <div
              className="bday-preview-stage"
              style={{ aspectRatio: previewAspect }}
            >
              {error ? (
                <p role="alert" style={{ padding: '1rem', textAlign: 'center' }}>{error}</p>
              ) : image ? (
                <img src={image.url} alt={`Birthday card for ${player.displayName}`} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              ) : (
                <p className="text-note" role="status">Rendering card…</p>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '0.6rem' }}>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => stepStyle(-1)}>
                <ChevronLeft size={14} aria-hidden="true" /> Prev style
              </button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => stepStyle(1)}>
                Next style <ChevronRight size={14} aria-hidden="true" />
              </button>
            </div>
            {!activePhoto && style !== 'kit' && (
              <p className="text-note" style={{ textAlign: 'center', fontSize: '0.78rem', margin: '0.45rem 0 0' }}>
                No public photo available — automatically showing <strong>07 {'//'} Architectural Kit</strong>.
              </p>
            )}
          </div>

          {/* Right: 7 Variations, Palette, Photo, Caption */}
          <div className="bday-controls-col">
            {/* 7 Styles */}
            <div className="bday-section">
              <span className="bday-label">Style (7 variations)</span>
              <div className="bday-pills">
                {BIRTHDAY_STYLES.map(s => (
                  <button
                    key={s.id}
                    type="button"
                    className={`btn btn-sm ${style === s.id ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setStyle(s.id)}
                  >
                    {s.num} {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Format + Palette */}
            <div className="bday-row-2">
              <div className="bday-section">
                <span className="bday-label">Size</span>
                <div className="bday-pills">
                  {(['post', 'story', 'square'] as CardFormat[]).map(f => (
                    <button
                      key={f}
                      type="button"
                      className={`btn btn-sm ${format === f ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => setFormat(f)}
                    >
                      {f === 'post' ? '4:5' : f === 'story' ? '9:16' : '1:1'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bday-section">
                <span className="bday-label">Colours (club default)</span>
                <div className="bday-pills">
                  {BIRTHDAY_PALETTES.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      className={`btn btn-sm ${paletteMode === p.id ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => setPaletteMode(p.id)}
                    >
                      {p.label}
                    </button>
                  ))}
                  {paletteMode === 'custom' && (
                    <input
                      type="color"
                      aria-label="Custom card colour"
                      value={customColor}
                      onChange={e => setCustomColor(e.target.value)}
                      style={{ width: '34px', height: '32px', border: 'none', background: 'transparent', cursor: 'pointer' }}
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Photo tools */}
            <div className="bday-section">
              <span className="bday-label">Player photo &amp; framing</span>
              <div className="bday-pills">
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoPick} hidden />
                {!player.isJunior && (
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => fileInputRef.current?.click()}>
                    <ImagePlus size={14} aria-hidden="true" /> {activePhoto ? 'Swap photo' : 'Add photo'}
                  </button>
                )}
                {activePhoto && effectiveStyle !== 'kit' && (
                  <button
                    type="button"
                    className={`btn btn-sm ${cutoutUrl ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={handleRemoveBg}
                    disabled={cutting}
                  >
                    <Scissors size={14} aria-hidden="true" /> {cutting ? 'Cutting out…' : cutoutUrl ? 'Cutout on' : 'Remove background'}
                  </button>
                )}
              </div>
              {cutError && <p className="text-note" role="alert" style={{ color: 'var(--color-danger)', fontSize: '0.78rem', margin: '0.3rem 0 0' }}>{cutError}</p>}
              {activePhoto && effectiveStyle !== 'kit' && (
                <div className="bday-sliders">
                  <label>
                    <span>Zoom</span>
                    <input type="range" min={1} max={1.8} step={0.05} value={zoom} onChange={e => setZoom(Number(e.target.value))} />
                  </label>
                  <label>
                    <span>Left / Right</span>
                    <input type="range" min={0} max={1} step={0.02} value={focusX} onChange={e => setFocusX(Number(e.target.value))} />
                  </label>
                  <label>
                    <span>Up / Down</span>
                    <input type="range" min={0} max={0.8} step={0.02} value={focusY} onChange={e => setFocusY(Number(e.target.value))} />
                  </label>
                </div>
              )}
            </div>

            {/* Toggles */}
            <div className="bday-toggles">
              {!player.isJunior && typeof player.turningAge === 'number' && (
                <label className="bday-check">
                  <input type="checkbox" checked={showAge} onChange={e => setShowAge(e.target.checked)} />
                  <span>Show age ({player.turningAge})</span>
                </label>
              )}
              {cardSponsors.length > 0 && (
                <label className="bday-check">
                  <input type="checkbox" checked={showSponsors} onChange={e => setShowSponsors(e.target.checked)} />
                  <span>Show club sponsors</span>
                </label>
              )}
            </div>

            {/* Caption */}
            <div className="bday-section">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' }}>
                <label htmlFor={captionId} className="bday-label" style={{ margin: 0 }}>Caption</label>
                <button type="button" className="btn btn-secondary btn-sm" onClick={copyCaption}>
                  <Copy size={14} aria-hidden="true" /> {copied ? 'Copied' : 'Copy caption'}
                </button>
              </div>
              <textarea
                id={captionId}
                className="form-input"
                rows={3}
                maxLength={2200}
                value={caption}
                onChange={e => onCaption(e.target.value)}
                style={{ width: '100%', resize: 'vertical', fontSize: '0.85rem' }}
              />
            </div>

            <div className="confirm-dialog-actions" style={{ marginTop: '0.5rem' }}>
              <button type="button" className="btn btn-secondary" onClick={download} disabled={!image}>
                <Download size={16} aria-hidden="true" /> Download PNG
              </button>
              <button type="button" className="btn btn-primary" onClick={share} disabled={!image}>
                <Share2 size={16} aria-hidden="true" /> Share
              </button>
            </div>
          </div>
        </div>
      </dialog>
    </>
  );
}
