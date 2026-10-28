'use client';

import { useCallback, useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { getSupabaseClient } from '@/lib/supabase/client';
import { confirmAction, notify } from '@/components/ConfirmDialog';
import { openMfaChallenge } from '@/components/MfaChallenge';
import { cleanCode, friendlyMfaError, getMfaStatus, type MfaStatus } from '@/lib/mfa';

interface Props {
  /** Reload the page once it's on (Mission Control re-checks access) */
  reloadWhenOn?: boolean;
  intro?: string;
}

interface Setup { factorId: string; uri: string; secret: string }

/** Turn two-step sign-in (an authenticator app code) on or off for this account */
export default function TwoStepSignIn({ reloadWhenOn, intro }: Props) {
  const [status, setStatus] = useState<MfaStatus | null | undefined>(undefined);
  const [setup, setSetup] = useState<Setup | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => setStatus(await getMfaStatus()), []);
  useEffect(() => { void load(); }, [load]);

  const start = async () => {
    const client = getSupabaseClient();
    if (!client) return;
    setBusy(true);
    setError('');
    // A setup that was started and never finished blocks a new one with the same name
    const { data: factors } = await client.auth.mfa.listFactors();
    for (const f of factors?.all || []) {
      if (f.status !== 'verified') await client.auth.mfa.unenroll({ factorId: f.id });
    }
    const { data, error: err } = await client.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Authenticator app' });
    setBusy(false);
    if (err || !data) return notify('Could not start two-step sign-in', friendlyMfaError(err?.message));
    setSetup({ factorId: data.id, uri: data.totp.uri, secret: data.totp.secret });
    setCode('');
  };

  const cancel = async () => {
    if (setup) await getSupabaseClient()?.auth.mfa.unenroll({ factorId: setup.factorId });
    setSetup(null);
    setError('');
  };

  const finish = async (e: React.FormEvent) => {
    e.preventDefault();
    const client = getSupabaseClient();
    if (!client || !setup || code.length !== 6) return;
    setBusy(true);
    setError('');
    const { error: err } = await client.auth.mfa.challengeAndVerify({ factorId: setup.factorId, code });
    setBusy(false);
    if (err) return setError(friendlyMfaError(err.message));
    setSetup(null);
    if (reloadWhenOn) return window.location.reload();
    await load();
    notify('Two-step sign-in is on', 'From now on you will be asked for a code from your authenticator app after you sign in.');
  };

  const turnOff = async () => {
    if (!status?.factorId) return;
    const ok = await confirmAction({
      title: 'Turn off two-step sign-in?',
      message: 'Your account will be protected by your password or email link only.',
      confirmLabel: 'Turn off',
      danger: true,
    });
    if (!ok) return;
    const client = getSupabaseClient();
    if (!client) return;
    setBusy(true);
    const { error: err } = await client.auth.mfa.unenroll({ factorId: status.factorId });
    setBusy(false);
    if (err) return notify('Two-step sign-in is still on', friendlyMfaError(err.message));
    // Drop the verified level from this session too
    await client.auth.refreshSession();
    await load();
  };

  if (status === undefined || status === null) return null;
  const on = Boolean(status.factorId);

  return (
    <section style={{ marginTop: '3rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border-subtle)' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', justifyContent: 'space-between' }}>
        <div className="min-w-0">
          <h2 style={{ fontSize: '1rem', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <ShieldCheck size={16} aria-hidden="true" /> Two-step sign-in
            {on && <span className="badge badge-primary" style={{ fontSize: '0.65rem' }}>On</span>}
          </h2>
          <p className="text-note" style={{ maxWidth: '560px' }}>
            {intro || 'Ask for a code from an authenticator app (such as Google Authenticator or 1Password) after you sign in. Recommended for club owners and admins.'}
          </p>
        </div>
        {!setup && (
          on ? (
            status.needsCode ? (
              <button type="button" className="btn btn-primary btn-sm" onClick={openMfaChallenge}>Enter code</button>
            ) : (
              <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={turnOff}>Turn off</button>
            )
          ) : (
            <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={start}>
              {busy ? 'Starting…' : 'Turn on'}
            </button>
          )
        )}
      </div>

      {setup && (
        <form onSubmit={finish} className="glass-panel" style={{ marginTop: '1rem', padding: '1.25rem', display: 'flex', flexWrap: 'wrap', gap: '1.25rem', alignItems: 'flex-start' }}>
          {/* Drawn here from the otpauth:// link, like the member pass QR (no data: image for the CSP to block) */}
          <div role="img" aria-label="QR code to scan with your authenticator app"
            style={{ background: '#fff', borderRadius: 'var(--radius-md)', padding: '0.6rem', flexShrink: 0, lineHeight: 0 }}>
            <QRCodeSVG value={setup.uri} size={152} />
          </div>
          <div className="min-w-0" style={{ flex: '1 1 240px' }}>
            <ol className="text-note" style={{ paddingLeft: '1.1rem', lineHeight: 1.7, marginBottom: '0.75rem' }}>
              <li>Open your authenticator app and scan the QR code.</li>
              <li>Can&apos;t scan? Type this key instead: <code style={{ wordBreak: 'break-all', fontFamily: 'var(--font-mono)' }}>{setup.secret}</code></li>
              <li>Enter the 6-digit code the app shows.</li>
            </ol>
            <div className="form-group" style={{ marginBottom: '0.75rem' }}>
              <label htmlFor="two-step-code" className="form-label">6-digit code</label>
              <input id="two-step-code" className="form-input" inputMode="numeric" autoComplete="one-time-code"
                maxLength={7} placeholder="123456" value={code} onChange={e => setCode(cleanCode(e.target.value))}
                style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.3em', fontSize: '1.2rem', maxWidth: '220px' }} />
            </div>
            {error && <p role="alert" className="text-note" style={{ color: 'var(--c-red)', marginBottom: '0.75rem' }}>{error}</p>}
            <div className="row row-wrap">
              <button type="submit" className="btn btn-primary btn-sm" disabled={busy || code.length !== 6}>
                {busy ? 'Checking…' : 'Turn on'}
              </button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={cancel}>Cancel</button>
            </div>
          </div>
        </form>
      )}
    </section>
  );
}
