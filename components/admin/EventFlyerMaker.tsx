'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { QRCodeCanvas } from 'qrcode.react';
import { Download, ImagePlus, Printer, X } from 'lucide-react';
import { useGroundSponsors } from '@/components/GroundSponsors';
import { uploadImage } from '@/components/ImageUploadZone';
import { drawEventFlyer, type FlyerSize } from '@/lib/event-flyer';
import { savePassImage } from '@/lib/pass-image';
import { SITE_URL } from '@/lib/seo';
import type { Club, ClubEvent } from '@/lib/supabase/types';

type Choice = 'A5' | 'A4' | 'A3' | 'story' | 'post';
const PAPER: Choice[] = ['A5', 'A4', 'A3'];
const sizeOf = (c: Choice): FlyerSize => (c === 'story' || c === 'post' ? c : 'paper');

/**
 * "Make a flyer" in Admin > Events: a flyer drawn from the event (title, date, place, price) in club
 * colours, with a QR to the event page and the sponsors whose package includes event flyers (the
 * event's own sponsors first). Paper sizes print (or save as PDF) to fit the page; Story and Post
 * download as images. "Use as the event's flyer" saves it to the event like an uploaded flyer.
 */
export default function EventFlyerMaker({ club, event, price, canSaveFlyer, onSaveFlyer, onClose }: {
  club: Pick<Club, 'id' | 'name' | 'slug' | 'logo_url' | 'primary_color' | 'custom_domain'>;
  event: ClubEvent;
  /** The ticket price as money ("$25.00"), when the event sells tickets */
  price?: string;
  /** The event flyer column exists (migration 20261115_event_flyers.sql) */
  canSaveFlyer: boolean;
  onSaveFlyer: (url: string) => void;
  onClose: () => void;
}) {
  const sponsors = useGroundSponsors(club.id, 'event_flyers', event.id);
  const [choice, setChoice] = useState<Choice>('A4');
  const [showPrice, setShowPrice] = useState(!!price);
  const [showQr, setShowQr] = useState(true);
  const [showSponsors, setShowSponsors] = useState(true);
  const [photo, setPhoto] = useState<string | null>(null);
  const [image, setImage] = useState<{ url: string; blob: Blob } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<'idle' | 'saving' | 'saved'>('idle');
  const qrRef = useRef<HTMLCanvasElement>(null);

  const eventUrl = club.custom_domain ? `https://${club.custom_domain}/events/${event.id}` : `${SITE_URL}/${club.slug}/events/${event.id}`;
  const shortLink = eventUrl.replace(/^https?:\/\//, '').replace(/\/events\/.*$/, '/events');
  const size = sizeOf(choice);
  const sponsorKey = JSON.stringify(showSponsors ? (sponsors || []).map(s => [s.logo_url || '', s.name]) : []);

  useEffect(() => {
    if (sponsors === null) return;
    let stale = false;
    let url: string | null = null;
    const list = (JSON.parse(sponsorKey) as [string, string][]).map(([src, name]) => ({ src: src || undefined, name }));
    drawEventFlyer(event, club, {
      size,
      price: showPrice && price ? price : undefined,
      qr: showQr && qrRef.current ? { canvas: qrRef.current, link: shortLink, ticketed: !!price } : undefined,
      sponsors: list,
      photo: photo || undefined,
    })
      .then(blob => {
        if (stale) return;
        url = URL.createObjectURL(blob);
        setImage({ url, blob });
        setError(null);
      })
      .catch(e => !stale && setError((e as Error).message));
    return () => { stale = true; if (url) URL.revokeObjectURL(url); };
  }, [event, club, size, showPrice, price, showQr, shortLink, sponsorKey, sponsors, photo]);

  useEffect(() => () => { if (photo) URL.revokeObjectURL(photo); }, [photo]);

  const fileName = `${club.slug}-${event.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'event'}-flyer${size === 'paper' ? '' : `-${size}`}.png`;

  const saveAsFlyer = async () => {
    if (!image) return;
    setSaving('saving');
    setError(null);
    try {
      const url = await uploadImage(new File([image.blob], fileName, { type: 'image/png' }), { folder: 'event-flyers', clubId: club.id, maxDimension: 1600 });
      onSaveFlyer(url);
      setSaving('saved');
    } catch (e) {
      setError((e as Error).message);
      setSaving('idle');
    }
  };

  const tab = (c: Choice, label: string, hint?: string) => (
    <button key={c} type="button" aria-pressed={choice === c} onClick={() => setChoice(c)}
      className={`btn btn-sm ${choice === c ? 'btn-primary' : 'btn-secondary'}`}
      style={{ flex: 1, flexDirection: 'column', gap: 0, minHeight: 44 }}>
      <span style={{ fontWeight: 800 }}>{label}</span>
      {hint && <span style={{ fontSize: '0.7rem', opacity: 0.75 }}>{hint}</span>}
    </button>
  );
  const tick = (checked: boolean, set: (v: boolean) => void, label: React.ReactNode, disabled = false) => (
    <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minHeight: 36, fontSize: '0.92rem', color: disabled ? 'var(--text-muted)' : 'var(--text-primary)', cursor: disabled ? 'default' : 'pointer' }}>
      <input type="checkbox" checked={checked && !disabled} disabled={disabled} onChange={e => set(e.target.checked)} style={{ width: 18, height: 18 }} />
      <span>{label}</span>
    </label>
  );

  return createPortal(
    <div className="flyer-maker-overlay" role="dialog" aria-modal="true" aria-label={`Make a flyer for ${event.title}`}
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0, 0, 0, 0.88)', overflowY: 'auto', overscrollBehavior: 'contain', padding: '1.25rem' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <style>{`
        @media print {
          @page { size: ${size === 'paper' ? choice : 'A4'} portrait; margin: 8mm; }
          :root { color-scheme: light !important; }
          html, body { background: #fff !important; }
          body::before, body::after { display: none !important; }
          body > :not(.flyer-maker-overlay) { display: none !important; }
          .flyer-maker-overlay { position: static !important; background: none !important; padding: 0 !important; overflow: visible !important; }
          .flyer-maker-overlay .no-print { display: none !important; }
          .flyer-maker-layout { display: block !important; }
          .flyer-print { width: 100% !important; height: calc(100vh - 1px) !important; object-fit: contain; border-radius: 0 !important; box-shadow: none !important; max-height: none !important; }
        }
      `}</style>
      {/* Hidden QR, drawn into the flyer */}
      <QRCodeCanvas ref={qrRef} value={eventUrl} size={640} level="M" marginSize={0} style={{ display: 'none' }} aria-hidden="true" />

      <div className="flyer-maker-layout" style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', justifyContent: 'center', alignItems: 'flex-start', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ flex: '1 1 340px', maxWidth: 560, display: 'flex', justifyContent: 'center' }}>
          {image
            ? <img className="flyer-print" src={image.url} alt={`Flyer for ${event.title}`} style={{ width: '100%', maxHeight: '86vh', objectFit: 'contain', borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }} />
            : <p className="text-note no-print" role="status" style={{ padding: '3rem 0' }}>{error || 'Drawing your flyer…'}</p>}
        </div>

        <div className="glass-panel no-print" style={{ flex: '1 1 320px', maxWidth: 440, padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 900, margin: 0 }}>Make a flyer</h2>
              <p className="text-meta" style={{ margin: '0.25rem 0 0' }}>{event.title}. Filled in from the event.</p>
            </div>
            <button type="button" onClick={onClose} aria-label="Close" className="btn btn-secondary btn-sm" style={{ minWidth: 40, minHeight: 40 }}><X size={16} /></button>
          </div>

          <div className="form-label" style={{ marginTop: '1.25rem' }}>Size</div>
          <div role="group" aria-label="Paper size" style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.4rem' }}>
            {PAPER.map(p => tab(p, p))}
          </div>
          <div role="group" aria-label="Social size" style={{ display: 'flex', gap: '0.4rem' }}>
            {tab('story', 'Story', '9:16')}
            {tab('post', 'Post', '4:5')}
          </div>
          <p className="text-note" style={{ margin: '0.5rem 0 0' }}>Paper sizes print, or save as a PDF from the print window. Story and Post download as images for socials.</p>

          <div className="form-label" style={{ marginTop: '1.25rem' }}>On the flyer</div>
          {tick(showPrice, setShowPrice, price ? `Ticket price (${price})` : 'Ticket price (this event is free)', !price)}
          {tick(showQr, setShowQr, price ? 'QR to buy tickets' : 'QR to the event page')}
          {tick(showSponsors, setShowSponsors, sponsors === null ? 'Sponsors (loading…)' : `Sponsors (${sponsors.length} with "Event flyers" ticked)`, !sponsors?.length)}
          {sponsors !== null && !sponsors.length && (
            <p className="text-note" style={{ margin: '0 0 0.25rem' }}>Tick &quot;Event flyers&quot; on a package in Sponsors, Packages to put sponsors here.</p>
          )}

          <div className="form-label" style={{ marginTop: '1rem' }}>Photo behind the title (optional)</div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <label className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', minHeight: 40 }}>
              <ImagePlus size={14} />
              <span>{photo ? 'Change photo' : 'Choose a photo'}</span>
              <input type="file" accept="image/*" style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) setPhoto(URL.createObjectURL(f)); e.target.value = ''; }} />
            </label>
            {photo && <button type="button" className="btn btn-secondary btn-sm" style={{ minHeight: 40 }} onClick={() => setPhoto(null)}>Remove</button>}
          </div>

          <div style={{ display: 'grid', gap: '0.6rem', marginTop: '1.5rem' }}>
            {size === 'paper' ? (
              <button type="button" className="btn btn-primary" disabled={!image} onClick={() => window.print()}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontWeight: 800 }}>
                <Printer size={16} /> Print or save {choice} PDF
              </button>
            ) : (
              <button type="button" className="btn btn-primary" disabled={!image} onClick={() => image && savePassImage(image.blob, fileName)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontWeight: 800 }}>
                <Download size={16} /> Download {choice === 'story' ? 'Story' : 'Post'} image
              </button>
            )}
            {canSaveFlyer && (
              <>
                <button type="button" className="btn btn-secondary" disabled={!image || saving === 'saving'} onClick={saveAsFlyer}>
                  {saving === 'saving' ? 'Saving…' : saving === 'saved' ? 'Saved as the event\'s flyer' : 'Use as the event\'s flyer'}
                </button>
                <p className="text-note" style={{ margin: 0, textAlign: 'center' }}>
                  Saves this flyer to the event, so it shows on the event page like an uploaded flyer.{event.flyer_url && saving !== 'saved' ? ' It replaces the flyer the event has now.' : ''}
                </p>
              </>
            )}
            {error && image && <p role="alert" style={{ color: 'var(--c-red)', fontSize: '0.85rem', margin: 0 }}>{error}</p>}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
