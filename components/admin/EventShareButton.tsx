'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Copy, Download, Share2, X } from 'lucide-react';
import { drawEventFlyer } from '@/lib/event-flyer';
import { useGroundSponsors } from '@/components/GroundSponsors';
import type { Club, ClubEvent } from '@/lib/supabase/types';
import SocialPostButton, { type SocialPostProps } from './SocialPostButton';

/** The event's own flyer when it has one, else a Post-size flyer drawn from the event */
async function eventImage(event: ClubEvent, club: Pick<Club, 'name' | 'logo_url' | 'primary_color'>, sponsors: { src?: string; name: string }[]): Promise<Blob> {
  if (event.flyer_url) {
    try {
      const res = await fetch(event.flyer_url, { mode: 'cors' });
      if (res.ok) return await res.blob();
    } catch { /* storage without CORS: draw one instead */ }
  }
  return drawEventFlyer(event, club, { size: 'post', sponsors });
}

// "Share from my phone" for an event post in Admin > Social media: the flyer, the caption to edit and
// copy, and the phone's share sheet (downloads where the browser can't share files)
export default function EventShareButton({ event, club, caption, onCaption, onShared, trigger, post }: {
  event: ClubEvent;
  club: Pick<Club, 'id' | 'name' | 'logo_url' | 'primary_color'>;
  caption: string;
  onCaption: (caption: string) => void;
  onShared: () => void;
  trigger: (open: () => void) => React.ReactNode;
  post?: SocialPostProps;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [image, setImage] = useState<{ blob: Blob; url: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const sponsors = useGroundSponsors(open ? club.id : undefined, 'event_flyers', event.id);
  const sponsorKey = JSON.stringify((sponsors || []).map(s => [s.logo_url || '', s.name]));
  const fileName = `${event.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'event'}.${event.flyer_url ? 'jpg' : 'png'}`;

  useEffect(() => {
    if (!open || sponsors === null) return; // waits for the sponsor list
    let url = '';
    let stale = false;
    setError(null);
    setImage(null);
    const list = (JSON.parse(sponsorKey) as [string, string][]).map(([src, name]) => ({ src: src || undefined, name }));
    eventImage(event, club, list)
      .then(blob => { if (stale) return; url = URL.createObjectURL(blob); setImage({ blob, url }); })
      .catch(e => !stale && setError((e as Error).message));
    return () => { stale = true; if (url) URL.revokeObjectURL(url); };
  }, [open, event, club, sponsorKey, sponsors]);

  const copyCaption = async () => {
    try {
      await navigator.clipboard.writeText(caption);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch { /* no clipboard: the box can be copied by hand */ }
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
    const file = new File([image.blob], fileName, { type: image.blob.type || 'image/png' });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: event.title, text: caption });
        onShared();
      } catch { /* closed the share sheet */ }
      return;
    }
    download();
  };

  const show = () => { setOpen(true); ref.current?.showModal(); };

  return (
    <>
      {trigger(show)}
      <dialog ref={ref} className="confirm-dialog glass-panel" style={{ width: 'min(480px, calc(100vw - 32px))', overscrollBehavior: 'contain' }}
        aria-labelledby={`event-share-${event.id}`} onClose={() => setOpen(false)} onClick={e => { if (e.target === e.currentTarget) ref.current?.close(); }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
          <h2 id={`event-share-${event.id}`} className="confirm-dialog-title" style={{ margin: 0 }}>Share this event</h2>
          <button type="button" onClick={() => ref.current?.close()} className="btn btn-secondary btn-sm" aria-label="Close" style={{ minWidth: '44px', minHeight: '44px' }}>
            <X size={16} aria-hidden="true" />
          </button>
        </div>
        <div style={{ aspectRatio: '4 / 5', maxWidth: '100%', margin: '0 auto', borderRadius: 'var(--radius-md)', overflow: 'hidden', background: 'rgba(var(--shade-rgb), 0.4)', display: 'grid', placeItems: 'center' }}>
          {error ? <p role="alert" style={{ padding: '1rem', textAlign: 'center' }}>{error}</p>
            : image ? <img src={image.url} alt={`Flyer: ${event.title}`} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            : <p className="text-note" role="status">Getting the flyer ready…</p>}
        </div>
        <div style={{ marginTop: '0.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
            <label htmlFor={`event-caption-${event.id}`} style={{ fontSize: '0.85rem', fontWeight: 700 }}>Caption</label>
            <button type="button" className="btn btn-secondary btn-sm" onClick={copyCaption}><Copy size={14} aria-hidden="true" /> {copied ? 'Copied' : 'Copy caption'}</button>
          </div>
          <textarea id={`event-caption-${event.id}`} className="form-input" rows={5} maxLength={2200} value={caption}
            onChange={e => onCaption(e.target.value)} style={{ width: '100%', resize: 'vertical', fontSize: '0.88rem' }} />
          <p className="text-note" style={{ margin: '0.3rem 0 0', fontSize: '0.78rem' }}>Share copies the caption too. Paste it in when the app opens.</p>
        </div>
        {post && <SocialPostButton image={image?.blob ?? null} {...post} />}
        <div className="confirm-dialog-actions">
          <button type="button" className="btn btn-secondary" onClick={download} disabled={!image}><Download size={16} aria-hidden="true" /> Download</button>
          <button type="button" className="btn btn-primary" onClick={share} disabled={!image}><Share2 size={16} aria-hidden="true" /> Share</button>
        </div>
      </dialog>
    </>
  );
}
