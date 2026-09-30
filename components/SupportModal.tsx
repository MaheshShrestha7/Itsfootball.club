'use client';

import React, { useState } from 'react';
import { LifeBuoy, X, Check } from 'lucide-react';
import { getAccessToken } from '@/lib/supabase/client';
import { useEscapeToClose } from '@/lib/use-escape-to-close';

const TOPICS = ['Question', 'Bug report', 'Feature request', 'Billing', 'Other'];

/** Lets a club admin message the itsfootball.club team (POST /api/support). */
export default function SupportModal({ clubId, open, setOpen }: { clubId: string; open: boolean; setOpen: (open: boolean) => void }) {
  useEscapeToClose(open, setOpen);
  const [topic, setTopic] = useState(TOPICS[0]);
  const [message, setMessage] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState('');

  if (!open) return null;

  const close = () => {
    setOpen(false);
    if (state === 'sent') {
      setMessage('');
      setState('idle');
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState('sending');
    setError('');
    const token = await getAccessToken();
    const res = await fetch('/api/support', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ clubId, topic, message }),
    }).catch(() => null);
    const data = res ? await res.json().catch(() => ({})) : {};
    if (res?.ok) {
      setState('sent');
    } else {
      setState('idle');
      setError(res ? data.error || 'Your message could not be sent.' : 'Network error. Check your connection.');
    }
  };

  return (
    <div
      onClick={close}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.8)', backdropFilter: 'blur(8px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="support-title"
        className="glass-panel"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: '480px', width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: '1.5rem' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '0.5rem' }}>
          <h3 id="support-title" style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <LifeBuoy size={18} color="var(--c-blue)" /> Contact itsfootball.club support
          </h3>
          <button type="button" onClick={close} className="btn btn-secondary btn-sm" style={{ minWidth: '40px', minHeight: '40px', padding: 0 }} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        {state === 'sent' ? (
          <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
            <Check size={32} color="var(--c-green)" />
            <p style={{ color: 'var(--text-primary)', fontWeight: 800, marginTop: '0.5rem' }}>Message sent</p>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
              We&apos;ll reply to your sign-in email address.
            </p>
            <button type="button" onClick={close} className="btn btn-primary btn-sm" style={{ marginTop: '1rem' }}>Done</button>
          </div>
        ) : (
          <form onSubmit={submit} className="stack stack-sm">
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
              Questions, problems or ideas for the platform. We reply to your sign-in email address.
            </p>
            <label className="stack" style={{ gap: '0.3rem', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
              Topic
              <select className="form-input" value={topic} onChange={e => setTopic(e.target.value)} style={{ fontSize: '16px' }}>
                {TOPICS.map(t => <option key={t}>{t}</option>)}
              </select>
            </label>
            <label className="stack" style={{ gap: '0.3rem', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
              Message
              <textarea
                className="form-input"
                required
                maxLength={4000}
                rows={6}
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="What do you need help with? For a bug, say which page and what you expected to happen."
                style={{ fontSize: '16px', resize: 'vertical' }}
              />
            </label>
            {error && <p role="alert" style={{ color: 'var(--c-red)', fontSize: '0.82rem' }}>{error}</p>}
            <button type="submit" className="btn btn-primary" disabled={state === 'sending' || !message.trim()}>
              {state === 'sending' ? 'Sending…' : 'Send message'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
