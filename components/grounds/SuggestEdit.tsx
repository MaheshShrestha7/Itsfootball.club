'use client';

// "Suggest an edit" at the foot of a ground guide. Goes to the club that looks after the ground
// (/api/grounds/suggest); nothing on the page changes until that club updates the ground.
import { useState } from 'react';
import { CheckCircle2, Pencil, Send } from 'lucide-react';
import { SUGGESTION_MAX, SUGGESTION_TOPICS } from '@/lib/grounds';

export default function SuggestEdit({ groundId, groundName, stewardName }: { groundId: string; groundName: string; stewardName?: string }) {
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState<string>('parking');
  const [message, setMessage] = useState('');
  const [contact, setContact] = useState('');
  const [website, setWebsite] = useState(''); // honeypot
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);
  const who = stewardName || 'The club that looks after this ground';

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (message.trim().length < 5) { setError('Tell us what needs changing.'); return; }
    setState('sending');
    const res = await fetch('/api/grounds/suggest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ groundId, topic, message, contact, website }),
    }).catch(() => null);
    const data = res ? await res.json().catch(() => ({})) : {};
    if (res?.ok) { setState('sent'); return; }
    setState('idle');
    setError(data.error || 'Your suggestion could not be sent. Check your connection and try again.');
  };

  if (state === 'sent') {
    return (
      <p role="status" className="glass-panel" style={{ padding: '0.9rem 1.1rem', display: 'flex', gap: '0.6rem', alignItems: 'center', margin: 0, color: 'var(--text-primary)', fontWeight: 600 }}>
        <CheckCircle2 size={18} color="var(--c-green)" aria-hidden="true" /> Thanks. {who} will check it and update the guide.
      </p>
    );
  }

  if (!open) {
    return (
      <button type="button" className="btn btn-outline" onClick={() => setOpen(true)} style={{ display: 'inline-flex', gap: '0.4rem', alignItems: 'center' }}>
        <Pencil size={15} aria-hidden="true" /> Suggest an edit
      </button>
    );
  }

  return (
    <form onSubmit={send} className="glass-panel" style={{ padding: '1.25rem', width: '100%', display: 'flex', flexDirection: 'column', gap: '0.85rem' }} aria-labelledby="suggest-title">
      <div>
        <h2 id="suggest-title" style={{ fontSize: '1.05rem', fontWeight: 900, margin: 0, color: 'var(--text-primary)' }}>Suggest an edit to {groundName}</h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0' }}>{who} reviews every suggestion before the guide changes.</p>
      </div>
      <div className="form-group" style={{ margin: 0 }}>
        <label className="form-label" htmlFor="suggest-topic">What&apos;s it about?</label>
        <select id="suggest-topic" className="form-input" value={topic} onChange={e => setTopic(e.target.value)}>
          {SUGGESTION_TOPICS.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
        </select>
      </div>
      <div className="form-group" style={{ margin: 0 }}>
        <label className="form-label" htmlFor="suggest-message">What needs changing?</label>
        <textarea id="suggest-message" className="form-input" rows={4} maxLength={SUGGESTION_MAX} value={message} onChange={e => setMessage(e.target.value)}
          placeholder="For example: the canteen is only open on Saturdays, or the car park gate is on Fifteenth Avenue" />
      </div>
      <div className="form-group" style={{ margin: 0 }}>
        <label className="form-label" htmlFor="suggest-contact">Your email (optional)</label>
        <input id="suggest-contact" className="form-input" type="email" maxLength={200} value={contact} onChange={e => setContact(e.target.value)} autoComplete="email" />
        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0.3rem 0 0' }}>Only so the club can ask you a question. It&apos;s never shown on the page.</p>
      </div>
      <input type="text" name="website" value={website} onChange={e => setWebsite(e.target.value)} tabIndex={-1} autoComplete="off" aria-hidden="true"
        style={{ position: 'absolute', left: '-10000px', width: 1, height: 1, opacity: 0 }} />
      {error && <p role="alert" style={{ color: 'var(--c-red)', fontSize: '0.85rem', fontWeight: 600, margin: 0 }}>{error}</p>}
      <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
        <button type="submit" className="btn btn-primary" disabled={state === 'sending'} style={{ display: 'inline-flex', gap: '0.4rem', alignItems: 'center' }}>
          <Send size={15} aria-hidden="true" /> {state === 'sending' ? 'Sending…' : 'Send suggestion'}
        </button>
        <button type="button" className="btn btn-outline" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </form>
  );
}
