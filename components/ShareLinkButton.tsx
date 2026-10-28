'use client';

import React, { useState } from 'react';
import { Check, Share2 } from 'lucide-react';

/**
 * "Share": the phone's share sheet where there is one, otherwise copies the link. If the browser
 * blocks copying too, the link shows in a box under the button, selected, ready to copy by hand.
 * `url` may be a path ('/club/news/x'): it's shared on the domain the visitor is on (a club's own
 * domain included).
 */
export default function ShareLinkButton({ url, title, text, className = 'btn btn-secondary btn-sm', label = 'Share' }: {
  url: string;
  title: string;
  text?: string;
  className?: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [showLink, setShowLink] = useState(false);

  const [shown, setShown] = useState(url);

  const share = async () => {
    const link = url.startsWith('/') ? `${window.location.origin}${url}` : url;
    setShown(link);
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url: link });
        return;
      } catch (e) {
        if ((e as Error)?.name === 'AbortError') return; // closed the share sheet
      }
    }
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setShowLink(true);
    }
  };

  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', gap: '0.4rem', maxWidth: '100%' }}>
      <button type="button" className={className} onClick={share} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
        {copied ? <Check size={14} aria-hidden="true" /> : <Share2 size={14} aria-hidden="true" />} {copied ? 'Link copied' : label}
      </button>
      {showLink && (
        <input className="form-input" readOnly value={shown} aria-label="Link to copy" autoFocus
          onFocus={e => e.currentTarget.select()} style={{ fontSize: '0.8rem', minWidth: 0 }} />
      )}
    </span>
  );
}
