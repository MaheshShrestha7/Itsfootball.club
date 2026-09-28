'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import PlatformNavbar from '@/components/PlatformNavbar';
import Footer from '@/components/Footer';
import { MailX, MailCheck } from 'lucide-react';

type State =
  | { step: 'loading' }
  | { step: 'invalid'; error: string }
  | { step: 'ready' | 'done'; club: string; email: string; unsubscribed: boolean };

// Landing page for the "Unsubscribe" link in club emails. Nothing changes until the button is
// pressed (link scanners open email links on their own), and the change can be undone.
export default function UnsubscribePage() {
  const params = useSearchParams();
  const [state, setState] = useState<State>({ step: 'loading' });
  const [busy, setBusy] = useState(false);

  const call = async (action: 'check' | 'unsubscribe' | 'resubscribe') => {
    const res = await fetch('/api/email/unsubscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ c: params.get('c'), e: params.get('e'), t: params.get('t'), action }),
    }).catch(() => null);
    const data = res ? await res.json().catch(() => ({})) : {};
    if (!res?.ok) return setState({ step: 'invalid', error: data.error || 'Something went wrong. Please try again.' });
    setState({ step: action === 'check' ? 'ready' : 'done', club: data.club, email: data.email, unsubscribed: data.unsubscribed });
  };

  useEffect(() => {
    call('check');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const act = async (action: 'unsubscribe' | 'resubscribe') => {
    setBusy(true);
    await call(action);
    setBusy(false);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <PlatformNavbar />
      <main className="container" style={{ padding: '4rem 1.5rem', flex: 1, maxWidth: '560px' }}>
        <div className="glass-panel" style={{ padding: '2.25rem', textAlign: 'center' }}>
          {state.step === 'loading' && <p className="text-secondary">Checking your link...</p>}

          {state.step === 'invalid' && (
            <>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.5rem' }}>Link not valid</h1>
              <p className="text-secondary">{state.error} To stop emails, contact the club directly.</p>
            </>
          )}

          {(state.step === 'ready' || state.step === 'done') && (
            <>
              <div style={{ display: 'inline-flex', padding: '0.9rem', borderRadius: '50%', background: 'rgba(var(--tint-rgb), 0.06)', marginBottom: '1rem', color: 'var(--text-secondary)' }}>
                {state.unsubscribed ? <MailX size={28} /> : <MailCheck size={28} />}
              </div>
              {state.unsubscribed ? (
                <>
                  <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.5rem' }}>You&apos;re unsubscribed</h1>
                  <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                    <strong>{state.email}</strong> won&apos;t get reminders or notices from <strong>{state.club}</strong>.
                    Sign-in links you ask for will still arrive.
                  </p>
                  <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => act('resubscribe')}>
                    {busy ? 'Saving...' : 'Undo, keep sending me emails'}
                  </button>
                </>
              ) : (
                <>
                  <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.5rem' }}>
                    {state.step === 'done' ? 'You\'re subscribed again' : `Unsubscribe from ${state.club}?`}
                  </h1>
                  <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                    {state.step === 'done'
                      ? <><strong>{state.email}</strong> will get emails from <strong>{state.club}</strong> again.</>
                      : <>Stop match reminders, event reminders and club notices to <strong>{state.email}</strong>.</>}
                  </p>
                  {state.step === 'ready' && (
                    <button type="button" className="btn btn-primary" disabled={busy} onClick={() => act('unsubscribe')}>
                      {busy ? 'Saving...' : 'Unsubscribe'}
                    </button>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
