'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Send } from 'lucide-react';

// "Post to Facebook and Instagram" in the share popups of Admin > Social media, once the club's
// Page is connected. onPost posts the graphic shown and says how it went; onDone runs once the popup
// closes after a post went out (marking it then, so the popup isn't pulled away while it says so).
export interface SocialPostProps {
  onPost: (image: Blob) => Promise<{ note: string; ok: boolean }>;
  onDone?: () => void;
  /** "Facebook and Instagram", or just "Facebook" when no Instagram is linked */
  to: string;
}
export default function SocialPostButton({ image, onPost, onDone, to }: SocialPostProps & { image: Blob | null }) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const box = useRef<HTMLDivElement>(null);
  const posted = useRef(false);
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    const dialog = box.current?.closest('dialog');
    const closed = () => { if (posted.current) { posted.current = false; setNote(''); done.current?.(); } };
    dialog?.addEventListener('close', closed);
    // A popup taken off the page (not just closed) counts as closed too
    return () => { dialog?.removeEventListener('close', closed); closed(); };
  }, []);
  const post = async () => {
    if (!image || busy) return;
    setBusy(true);
    setNote('');
    const r = await onPost(image);
    if (r.ok) posted.current = true;
    setNote(r.note);
    setBusy(false);
  };
  return (
    <div ref={box} style={{ marginTop: '0.75rem' }}>
      <button type="button" className="btn btn-primary" style={{ width: '100%' }} onClick={post} disabled={!image || busy}>
        <Send size={16} aria-hidden="true" /> {busy ? 'Posting…' : `Post to ${to}`}
      </button>
      <p className="text-note" role="status" style={{ margin: '0.3rem 0 0', fontSize: '0.78rem' }}>
        {note || 'Posts this graphic and caption now. A Story-size graphic goes to your Instagram Story, which shows no caption.'}
      </p>
    </div>
  );
}
