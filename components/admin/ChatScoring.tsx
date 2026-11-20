'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { MessageCircle, Link2, Copy } from 'lucide-react';
import { getAccessToken } from '@/lib/supabase/client';

// Score by chat for club admins (Match Centre at "full"): the club's switch in Match Centre and the
// Link chat card in People. Both stay hidden until the migration runs or for anyone without that access.

interface Status { ready: boolean; botReady: boolean; scoringEnabled: boolean; aiAllowed: boolean; links: { member_id: string; linked_at: string; last_used_at: string | null }[] }

async function api<T>(clubId: string, body?: Record<string, unknown>): Promise<T & { error?: string }> {
  try {
    const token = await getAccessToken();
    const res = await fetch(body ? '/api/admin/chat-scoring' : `/api/admin/chat-scoring?clubId=${clubId}`, {
      method: body ? 'POST' : 'GET',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body ? { body: JSON.stringify({ clubId, ...body }) } : {}),
    });
    const json = await res.json().catch(() => ({}));
    return res.ok ? json : { ...json, error: json.error || `Request failed (${res.status})` };
  } catch {
    return { error: 'Network error. Check your connection and try again.' } as T & { error?: string };
  }
}

function useChatStatus(clubId: string) {
  const [status, setStatus] = useState<Status | null>(null);
  const load = useCallback(async () => {
    const res = await api<Status>(clubId);
    setStatus(res.error ? null : res);
  }, [clubId]);
  useEffect(() => { load(); }, [load]);
  return { status, load };
}

const when = (iso: string) => new Date(iso).toLocaleString('en-AU', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

/** Match Centre: the club's Score by chat switch */
export function ChatScoringPanel({ clubId, peopleHref }: { clubId: string; peopleHref: string }) {
  const { status, load } = useChatStatus(clubId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!status?.ready) return null;

  const toggle = async () => {
    setBusy(true);
    const res = await api(clubId, { action: 'toggle', on: !status.scoringEnabled });
    setBusy(false);
    setError(res.error || '');
    load();
  };

  return (
    <section className="glass-panel" style={{ padding: 'var(--space-md)', marginTop: 'var(--space-lg)' }} aria-labelledby="chat-scoring-title">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-md)' }}>
        <div style={{ minWidth: 0 }}>
          <h3 id="chat-scoring-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 'var(--space-xs)', fontSize: 'var(--text-md)', fontWeight: 600 }}>
            <MessageCircle size={16} aria-hidden="true" /> Score by chat
          </h3>
          <p style={{ margin: 'var(--space-2xs) 0 0', fontSize: 'var(--text-sm)', color: 'var(--color-ink-2)' }}>
            Linked members can send goals, cards and the score from Itsfootball.club Bot on Telegram. Junior teams use the short format only.
          </p>
        </div>
        <input type="checkbox" className="mc-switch" role="switch" aria-label="Score by chat" checked={status.scoringEnabled} disabled={busy} onChange={toggle} />
      </div>
      <p style={{ margin: 'var(--space-sm) 0 0', fontSize: 'var(--text-sm)', color: 'var(--color-muted)' }}>
        {status.aiAllowed ? 'AI reading is on for your club.' : 'AI reading is off for your club, so scorers use the short format (g sam 23).'}
        {' '}{status.links.length === 1 ? '1 member linked.' : `${status.links.length} members linked.`}
        {' '}<a href={peopleHref} style={{ color: 'inherit', fontWeight: 600 }}>Link someone in People</a>
      </p>
      {!status.botReady && <p style={{ margin: 'var(--space-xs) 0 0', fontSize: 'var(--text-sm)', color: 'var(--color-muted)' }}>The bot is still being set up by itsfootball.club.</p>}
      {error && <p role="alert" style={{ margin: 'var(--space-xs) 0 0', fontSize: 'var(--text-sm)', color: 'var(--color-danger, #DC2626)' }}>{error}</p>}
    </section>
  );
}

/** People -> one person: link their chat, or unlink it */
export function ChatLinkCard({ clubId, memberId, name }: { clubId: string; memberId: string; name: string }) {
  const { status, load } = useChatStatus(clubId);
  const [link, setLink] = useState<{ url: string; expiresAt: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  useEffect(() => { setLink(null); setError(''); }, [memberId]);
  if (!status?.ready || !status.scoringEnabled) return null;

  const linked = status.links.find(l => l.member_id === memberId);
  const first = name.split(' ')[0] || name;
  const makeLink = async () => {
    setBusy(true);
    const res = await api<{ link: string; expiresAt: string }>(clubId, { action: 'link', memberId });
    setBusy(false);
    setError(res.error || '');
    if (!res.error) setLink({ url: res.link, expiresAt: res.expiresAt });
  };
  const unlink = async () => {
    setBusy(true);
    const res = await api(clubId, { action: 'unlink', memberId });
    setBusy(false);
    setError(res.error || '');
    load();
  };
  const copy = async () => {
    if (!link) return;
    try { await navigator.clipboard.writeText(link.url); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* the link is on screen to copy by hand */ }
  };

  return (
    <div className="ppl-card">
      <div className="ppl-card-label">Scoring by chat</div>
      <div className="row row-wrap" style={{ gap: '0.5rem', alignItems: 'center', justifyContent: 'space-between', marginTop: 'var(--space-3xs)' }}>
        <div className="ppl-card-value" style={{ marginTop: 0 }}>
          {linked ? <span className="admin-pill is-ok">Linked</span> : 'Not linked yet'}
        </div>
        {linked
          ? <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={unlink}>Unlink</button>
          : <button type="button" className="btn btn-primary btn-sm" disabled={busy || !status.botReady} onClick={makeLink}><Link2 size={14} aria-hidden="true" /> {link ? 'New link' : 'Link chat'}</button>}
      </div>
      {linked && <div className="ppl-card-note">Linked {when(linked.linked_at)}.{linked.last_used_at ? ` Last used ${when(linked.last_used_at)}.` : ''}</div>}
      {!linked && link && (
        <div style={{ marginTop: 'var(--space-sm)', padding: 'var(--space-sm)', border: '1px dashed var(--color-rule-strong)', borderRadius: 'var(--radius-control)', display: 'grid', gap: 'var(--space-xs)' }}>
          <div className="ppl-card-note" style={{ marginTop: 0 }}>Send {first} this link. They tap it on their phone, open Itsfootball.club Bot in Telegram, and they&apos;re set.</div>
          <code style={{ fontSize: 'var(--text-xs)', overflowWrap: 'anywhere', color: 'var(--color-ink)' }}>{link.url}</code>
          <div className="row row-wrap" style={{ gap: '0.5rem' }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={copy}><Copy size={14} aria-hidden="true" /> {copied ? 'Copied' : 'Copy link'}</button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={load}>Check if linked</button>
          </div>
          <div className="ppl-card-note" style={{ marginTop: 0 }}>Works once, until {when(link.expiresAt)}. Only for this club.</div>
        </div>
      )}
      {!status.botReady && !linked && <div className="ppl-card-note">The bot is still being set up by itsfootball.club.</div>}
      {error && <div role="alert" className="ppl-card-note" style={{ color: 'var(--color-danger, #DC2626)' }}>{error}</div>}
    </div>
  );
}
