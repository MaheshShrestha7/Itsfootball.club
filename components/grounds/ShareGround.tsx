'use client';

// "Posting a fixture here?" on a ground page: copy the guide's link, or save a QR code that opens it
// (for a clubhouse noticeboard or a fixture flyer).
import { useRef, useState } from 'react';
import { Copy, Check, QrCode } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';

export default function ShareGround({ url, fileName }: { url: string; fileName: string }) {
  const [copied, setCopied] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);
  const linkRef = useRef<HTMLInputElement>(null);
  const shown = url.replace(/^https?:\/\//, '');

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Copying blocked: select the link in the box so it can be copied by hand
      linkRef.current?.focus();
      linkRef.current?.select();
    }
  };

  const saveQr = () => {
    const canvas = qrRef.current?.querySelector('canvas');
    if (!canvas) return;
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `${fileName}-qr.png`;
    a.click();
  };

  return (
    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.8rem', flexWrap: 'wrap' }}>
      <input ref={linkRef} className="form-input" readOnly value={shown} aria-label="Link to this ground guide" onFocus={e => e.currentTarget.select()} style={{ flex: '1 1 240px', fontSize: '0.85rem' }} />
      <button type="button" className="btn btn-primary" onClick={copy} style={{ display: 'inline-flex', gap: '0.4rem', alignItems: 'center' }}>
        {copied ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />} {copied ? 'Copied' : 'Copy link'}
      </button>
      <button type="button" className="btn btn-outline" onClick={saveQr} style={{ display: 'inline-flex', gap: '0.4rem', alignItems: 'center' }}>
        <QrCode size={15} aria-hidden="true" /> Save QR code
      </button>
      <div ref={qrRef} style={{ display: 'none' }} aria-hidden="true">
        <QRCodeCanvas value={url} size={1024} marginSize={4} level="M" />
      </div>
    </div>
  );
}
