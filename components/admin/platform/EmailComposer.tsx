'use client';

import React, { useEffect, useRef, useState } from 'react';
import { X, Send } from 'lucide-react';
import { getAccessToken } from '@/lib/supabase/client';
import { emailTemplate, firstName, TEMPLATE_LABELS, type EmailAudience, type TemplateKey } from '@/lib/mission-control';
import type { PlatformClubItem } from '@/lib/supabase/types';

export interface EmailDraft {
  club: PlatformClubItem;
  to: EmailAudience;
  template: TemplateKey;
}

interface Props {
  draft: EmailDraft | null;
  onClose: () => void;
  /** Called after a successful send */
  onSent: (msg: string) => void;
}

/** Write to a club's Owner or admins from a template, edit, send (POST /api/platform/email). */
export default function EmailComposer({ draft, onClose, onSent }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [to, setTo] = useState<EmailAudience>('owner');
  const [template, setTemplate] = useState<TemplateKey>('blank');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const fill = (club: PlatformClubItem, key: TemplateKey) => {
    const t = emailTemplate(key, club, firstName(club.owner_name), window.location.origin);
    setTemplate(key);
    setSubject(t.subject);
    setMessage(t.message);
  };

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (draft) {
      setTo(draft.to);
      setError('');
      fill(draft.club, draft.template);
      if (!d.open) d.showModal();
    } else if (d.open) d.close();
  }, [draft]);

  if (!draft) return <dialog ref={ref} className="mc-dialog" onClose={onClose} />;

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setError('');
    try {
      const token = await getAccessToken();
      const res = await fetch('/api/platform/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ clubId: draft.club.id, to, subject, message }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setError(json.error || 'Could not send.'); return; }
      onSent(`✓ Sent to ${json.sent} ${json.sent === 1 ? 'person' : 'people'} at ${draft.club.name}`);
      onClose();
    } finally {
      setSending(false);
    }
  };

  return (
    <dialog ref={ref} className="mc-dialog" onClose={onClose} aria-labelledby="mc-email-title">
      <form onSubmit={send} className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <h3 id="mc-email-title" style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>Email {draft.club.name}</h3>
          <button type="button" className="mc-icon-btn" onClick={onClose} aria-label="Close"><X size={16} /></button>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          <span className="mc-seg" role="group" aria-label="Send to">
            <button type="button" aria-pressed={to === 'owner'} onClick={() => setTo('owner')}>Owner</button>
            <button type="button" aria-pressed={to === 'admins'} onClick={() => setTo('admins')}>All admins</button>
          </span>
          <select className="mc-select" aria-label="Start from a template" value={template} onChange={e => fill(draft.club, e.target.value as TemplateKey)}>
            {(Object.keys(TEMPLATE_LABELS) as TemplateKey[]).map(k => <option key={k} value={k}>{TEMPLATE_LABELS[k]}</option>)}
          </select>
        </div>

        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label" htmlFor="mc-email-subject">Subject</label>
          <input id="mc-email-subject" className="form-input" value={subject} onChange={e => setSubject(e.target.value)} maxLength={200} required />
        </div>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label" htmlFor="mc-email-body">Message</label>
          <textarea id="mc-email-body" className="form-input" rows={11} value={message} onChange={e => setMessage(e.target.value)} maxLength={4000} required style={{ resize: 'vertical', lineHeight: 1.5 }} />
          <small className="mc-muted">Replies come to your own email. A copy is kept in the club&apos;s notes.</small>
        </div>

        {error && <p role="alert" style={{ margin: 0, color: 'var(--c-red)', fontSize: '0.85rem' }}>{error}</p>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" className="mc-pill-btn ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="mc-pill-btn" disabled={sending}><Send size={14} /> {sending ? 'Sending…' : 'Send'}</button>
        </div>
      </form>
    </dialog>
  );
}
