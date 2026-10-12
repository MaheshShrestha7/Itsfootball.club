'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { isPlatformHost } from '@/lib/slugs';

// Where the "reset your password" email lands (see sendPasswordReset in lib/auth-context.tsx). The
// link has already signed the person in, so all that's left is choosing the new password.
export default function ResetPasswordPage() {
  const { user, isLoading, updatePassword } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [home, setHome] = useState('/');

  // A club's own domain has no My Clubs page: go to its home page instead
  useEffect(() => setHome(isPlatformHost(window.location.host) ? '/my-clubs' : '/'), []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== confirm) return setError('The two passwords don\'t match.');
    setSaving(true);
    const res = await updatePassword(password);
    setSaving(false);
    if (res.success) setDone(true);
    else setError(res.error || 'Could not change your password. Please try again.');
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem 1rem', background: 'var(--bg-pitch)', color: 'var(--text-primary)' }}>
      <div className="glass-panel" style={{ maxWidth: '440px', width: '100%', padding: '2.25rem 2rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, textAlign: 'center', marginBottom: '0.5rem' }}>Choose a new password</h1>

        {isLoading ? (
          <p role="status" style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>Checking your link...</p>
        ) : done ? (
          <div role="status" style={{ textAlign: 'center' }}>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>Your password has been changed and you&apos;re signed in.</p>
            <Link href={home} className="btn btn-primary">Continue</Link>
          </div>
        ) : !user ? (
          <div role="alert" style={{ textAlign: 'center' }}>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
              This reset link has expired or was already used. Use &quot;Forgot password?&quot; on the sign-in box to get a new one.
            </p>
            <Link href="/" className="btn btn-primary">Back to the site</Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textAlign: 'center', margin: 0 }}>For {user.email}</p>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="reset-password" className="form-label">New password</label>
              <input id="reset-password" type="password" required minLength={8} autoComplete="new-password" className="form-input"
                placeholder="At least 8 characters" value={password} onChange={e => setPassword(e.target.value)} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="reset-password-confirm" className="form-label">Type it again</label>
              <input id="reset-password-confirm" type="password" required minLength={8} autoComplete="new-password" className="form-input"
                value={confirm} onChange={e => setConfirm(e.target.value)} />
            </div>
            {error && <div role="alert" style={{ color: 'var(--c-red)', fontSize: '0.85rem' }}>{error}</div>}
            <button type="submit" disabled={saving} className="btn btn-primary" style={{ width: '100%' }}>
              {saving ? 'Saving...' : 'Save new password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
