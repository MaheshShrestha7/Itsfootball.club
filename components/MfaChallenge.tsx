'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { getSupabaseClient } from '@/lib/supabase/client';
import { cleanCode, friendlyMfaError, getMfaStatus } from '@/lib/mfa';

// Asks for the authenticator code when an account with two-step sign-in has only
// passed the password or email-link step. Admin areas stay locked until it's entered.
// Mounted once in app/layout.tsx; openMfaChallenge() opens it from anywhere.

const SKIP_KEY = 'itsfootball_mfa_skip';
let open: (() => void) | null = null;

export function openMfaChallenge() {
  open?.();
}

export default function MfaChallenge() {
  const ref = useRef<HTMLDialogElement>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const check = useCallback(async (force: boolean) => {
    const status = await getMfaStatus();
    if (!status?.needsCode || !status.factorId) return;
    try {
      if (!force && sessionStorage.getItem(SKIP_KEY)) return;
    } catch { /* private mode */ }
    setFactorId(status.factorId);
    setCode('');
    setError('');
    if (ref.current && !ref.current.open) ref.current.showModal();
  }, []);

  useEffect(() => {
    open = () => { void check(true); };
    const client = getSupabaseClient();
    if (!client) return () => { open = null; };
    void check(false);
    const { data } = client.auth.onAuthStateChange(event => {
      if (event === 'SIGNED_IN') setTimeout(() => { void check(false); }, 0);
    });
    return () => { open = null; data.subscription.unsubscribe(); };
  }, [check]);

  const close = () => ref.current?.close();

  const later = () => {
    try { sessionStorage.setItem(SKIP_KEY, '1'); } catch { /* private mode */ }
    close();
  };

  const signOut = async () => {
    close();
    await getSupabaseClient()?.auth.signOut();
    window.location.reload();
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    const client = getSupabaseClient();
    if (!client || !factorId || code.length !== 6) return;
    setBusy(true);
    setError('');
    const { error: err } = await client.auth.mfa.challengeAndVerify({ factorId, code });
    if (err) {
      setBusy(false);
      setError(friendlyMfaError(err.message));
      return;
    }
    try { sessionStorage.removeItem(SKIP_KEY); } catch { /* private mode */ }
    // Reload so every admin check reads the new, verified session
    window.location.reload();
  };

  return (
    <dialog ref={ref} className="confirm-dialog glass-panel" aria-labelledby="mfa-challenge-title"
      onCancel={e => { e.preventDefault(); later(); }}>
      <form onSubmit={verify}>
        <div className="row row-loose" style={{ alignItems: 'flex-start' }}>
          <span className="confirm-dialog-icon" aria-hidden="true"><ShieldCheck size={20} /></span>
          <div className="min-w-0">
            <h2 id="mfa-challenge-title" className="confirm-dialog-title">Enter your sign-in code</h2>
            <p className="confirm-dialog-message">
              Two-step sign-in is on for this account. Open your authenticator app and enter the 6-digit code for itsfootball.club.
            </p>
            <div className="form-group" style={{ marginTop: '1rem', marginBottom: 0 }}>
              <label htmlFor="mfa-challenge-code" className="form-label">6-digit code</label>
              <input id="mfa-challenge-code" className="form-input" inputMode="numeric" autoComplete="one-time-code"
                autoFocus maxLength={7} placeholder="123456" value={code}
                onChange={e => setCode(cleanCode(e.target.value))}
                style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.3em', fontSize: '1.2rem' }} />
            </div>
            {error && <p role="alert" className="text-note" style={{ color: 'var(--c-red)', marginTop: '0.5rem' }}>{error}</p>}
            <p className="text-note" style={{ marginTop: '0.75rem' }}>
              Until you enter it, club admin pages and Mission Control stay locked.
            </p>
          </div>
        </div>
        <div className="confirm-dialog-actions">
          <button type="button" className="btn btn-secondary" onClick={signOut}>Sign out</button>
          <button type="button" className="btn btn-secondary" onClick={later}>Not now</button>
          <button type="submit" className="btn btn-primary" disabled={busy || code.length !== 6}>
            {busy ? 'Checking…' : 'Continue'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
