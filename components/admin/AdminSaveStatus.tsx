'use client';

import React, { useEffect, useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { useClub } from '@/lib/club-context';
import { friendlySyncError } from '@/lib/sync-messages';

const SAVED_SHOWN_MS = 2500;

/**
 * Admin edits save in the background a moment after each change. This shows that happening:
 * a small "Saving…" / "Saved" note in the corner, a plain-language banner when a save fails (the
 * database's own text is under "Details"), and the browser's "Leave site?" check while changes
 * are still on their way or have failed.
 */
export default function AdminSaveStatus() {
  const { syncStatus, retrySync } = useClub();
  const { phase, savedAt, message, pending } = syncStatus;
  const [now, setNow] = useState(() => Date.now());

  // Hide "Saved" again a moment after it appears
  useEffect(() => {
    if (!savedAt) return;
    setNow(Date.now());
    const timer = setTimeout(() => setNow(Date.now()), SAVED_SHOWN_MS);
    return () => clearTimeout(timer);
  }, [savedAt]);

  const unsaved = phase === 'saving' || phase === 'error';
  useEffect(() => {
    if (!unsaved) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [unsaved]);

  const showSaved = phase === 'idle' && !!savedAt && now - savedAt < SAVED_SHOWN_MS;
  const waiting = phase === 'readonly' && (pending || 0) > 0;

  return (
    <>
      {(phase === 'error' || waiting) && (
        <div role="alert" className={`admin-save-banner ${phase === 'error' ? 'is-error' : 'is-waiting'}`}>
          <div style={{ minWidth: 0 }}>
            <strong>{phase === 'error' ? 'Some changes are not saved yet.' : `${pending} change${pending === 1 ? ' is' : 's are'} only on this device.`}</strong>{' '}
            <span>{phase === 'error' ? friendlySyncError(message) : 'Sign in to save them to the club.'}</span>
            {phase === 'error' && message && (
              <details className="admin-save-details">
                <summary>Details</summary>
                <code>{message}</code>
              </details>
            )}
          </div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={retrySync}>Retry</button>
        </div>
      )}
      <div className="admin-save-pill" role="status" aria-live="polite" data-show={phase === 'saving' || showSaved ? 'true' : 'false'}>
        {phase === 'saving'
          ? <><Loader2 size={14} className="spin" aria-hidden="true" /> Saving…</>
          : showSaved ? <><Check size={14} aria-hidden="true" /> Saved</> : null}
      </div>
    </>
  );
}
