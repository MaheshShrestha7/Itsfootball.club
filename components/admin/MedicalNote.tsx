'use client';

import React, { useState } from 'react';
import { HeartPulse } from 'lucide-react';

/** A member's medical notes, hidden until tapped so they don't sit on screen for anyone passing by */
export default function MedicalNote({ text, className = 'ppl-card-note' }: { text?: string; className?: string }) {
  const [shown, setShown] = useState(false);
  if (!text) return null;
  return (
    <div className={className}>
      {shown ? (
        <span>Medical: {text}</span>
      ) : (
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShown(true)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', marginTop: 4 }}>
          <HeartPulse size={13} aria-hidden="true" /> Show medical info
        </button>
      )}
    </div>
  );
}
