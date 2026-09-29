'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import type { EmailOtpType } from '@supabase/supabase-js';
import { getSupabaseClient } from '@/lib/supabase/client';
import { safeNextPath } from '@/lib/slugs';

// Where sign-in links for a club's own domain land (see authReturnUrl in lib/slugs.ts): verifying the
// token here signs the member in on this domain, then sends them on to the page they asked from.
export default function ConfirmPage() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const next = safeNextPath(query.get('next'));
    const tokenHash = query.get('token_hash');
    const type = query.get('type') as EmailOtpType | null;
    const client = getSupabaseClient();
    if (!tokenHash || !type || !client) return void window.location.replace(next);

    client.auth.verifyOtp({ token_hash: tokenHash, type }).then(({ error }) => {
      if (error) setError('This sign-in link has expired or was already used. Please ask for a new one.');
      else window.location.replace(next);
    });
  }, []);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem 1rem', background: 'var(--bg-pitch)', color: 'var(--text-primary)' }}>
      <div className="glass-panel" role="status" style={{ maxWidth: '440px', width: '100%', padding: '2.5rem 2rem', textAlign: 'center' }}>
        {error ? (
          <>
            <p style={{ marginBottom: '1.25rem' }}>{error}</p>
            <Link href="/" className="btn btn-primary">Back to the club</Link>
          </>
        ) : (
          <p>Signing you in...</p>
        )}
      </div>
    </div>
  );
}
