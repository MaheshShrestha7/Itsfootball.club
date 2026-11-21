'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { MessageCircle, Link2, Copy, QrCode, RefreshCw } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { getAccessToken } from '@/lib/supabase/client';

// Score by chat for club admins (Match Centre at "full"): the club's switch, scoring link, asks waiting
// for a yes and who can score, in Match Centre; and the per-person Link chat card in People. Both stay hidden until the migration runs or for anyone without that access;
// with the club switch off, the People card says where to turn it on.

interface Status {
  ready: boolean; botReady: boolean; scoringEnabled: boolean; aiAllowed: boolean;
  links: { member_id: string; linked_at: string; last_used_at: string | null; name?: string; role?: string | null }[];
  // The club link (migration 20261186); joinReady false until it runs
  joinReady?: boolean; joinLink?: string | null; joinMadeAt?: string | null; joinMadeBy?: string | null;
  waiting?: { id: string; name: string; role: string | null; sender: string | null; askedAt: string }[];
}

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

/** Match Centre: the club's Score by chat switch, its scoring link, asks waiting for a yes, and who can score */
export function ChatScoringPanel({ clubId, peopleHref }: { clubId: string; peopleHref: string }) {
  const { status, load } = useChatStatus(clubId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  if (!status?.ready) return null;

  const run = async (body: Record<string, unknown>) => {
    setBusy(true);
    const res = await api(clubId, body);
    setBusy(false);
    setError(res.error || '');
    load();
  };
  const copy = async () => {
    if (!status.joinLink) return;
    try { await navigator.clipboard.writeText(status.joinLink); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* the link is on screen to copy by hand */ }
  };
  const note = { margin: 'var(--space-2xs) 0 0', fontSize: 'var(--text-sm)', color: 'var(--color-muted)' } as const;
  const sec = { borderTop: '1px solid var(--color-rule)', marginTop: 'var(--space-md)', paddingTop: 'var(--space-md)' } as const;
  const h4 = { margin: 0, fontSize: 'var(--text-sm)', fontWeight: 700 } as const;
  const row = { display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', flexWrap: 'wrap', padding: 'var(--space-xs) var(--space-sm)', border: '1px solid var(--color-rule)', borderRadius: 'var(--radius-control)' } as const;
  const waiting = status.waiting || [];

  return (
    <section className="glass-panel" style={{ padding: 'var(--space-md)', marginTop: 'var(--space-lg)' }} aria-labelledby="chat-scoring-title">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-md)' }}>
        <div style={{ minWidth: 0 }}>
          <h3 id="chat-scoring-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 'var(--space-xs)', fontSize: 'var(--text-md)', fontWeight: 600 }}>
            <MessageCircle size={16} aria-hidden="true" /> Score by chat
          </h3>
          <p style={{ margin: 'var(--space-2xs) 0 0', fontSize: 'var(--text-sm)', color: 'var(--color-ink-2)' }}>
            People you allow can send goals, cards and the score from Itsfootball.club Bot on Telegram. Junior teams use the short format only.
          </p>
        </div>
        <input type="checkbox" className="mc-switch" role="switch" aria-label="Score by chat" checked={status.scoringEnabled} disabled={busy} onChange={() => run({ action: 'toggle', on: !status.scoringEnabled })} />
      </div>
      <p style={note}>
        {status.aiAllowed ? 'AI reading is on for your club.' : 'AI reading is off for your club, so scorers use the short format (g sam 23).'}
      </p>
      {!status.botReady && <p style={note}>The bot is still being set up by itsfootball.club.</p>}

      {status.scoringEnabled && status.joinReady && (
        <div style={sec}>
          <h4 style={h4}>Your club&apos;s scoring link</h4>
          <p style={note}>Share it in your committee or coaches&apos; group. Anyone who taps it asks to score, and an admin says yes or no.</p>
          <div style={{ marginTop: 'var(--space-sm)', padding: 'var(--space-sm)', border: '1px dashed var(--color-rule-strong)', borderRadius: 'var(--radius-control)', display: 'grid', gap: 'var(--space-xs)' }}>
            {status.joinLink ? <>
              <code style={{ fontSize: 'var(--text-sm)', overflowWrap: 'anywhere', color: 'var(--color-ink)', fontWeight: 600 }}>{status.joinLink.replace(/^https:\/\//, '')}</code>
              <div className="row row-wrap" style={{ gap: '0.5rem' }}>
                <button type="button" className="btn btn-primary btn-sm" onClick={copy}><Copy size={14} aria-hidden="true" /> {copied ? 'Copied' : 'Copy link'}</button>
                <button type="button" className="btn btn-secondary btn-sm" aria-expanded={showQr} onClick={() => setShowQr(v => !v)}><QrCode size={14} aria-hidden="true" /> QR code</button>
                <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => run({ action: 'join-link' })}><RefreshCw size={14} aria-hidden="true" /> Make a new link</button>
              </div>
              {showQr && <div style={{ background: '#fff', padding: 12, borderRadius: 12, justifySelf: 'start' }}><QRCodeSVG value={status.joinLink} size={180} level="M" /></div>}
              <p style={{ ...note, margin: 0 }}>
                {status.joinMadeAt ? `Made ${when(status.joinMadeAt)}${status.joinMadeBy ? ` by ${status.joinMadeBy}` : ''}. ` : ''}A new link stops this one working. People already allowed keep scoring.
              </p>
            </> : <>
              <p style={{ ...note, margin: 0 }}>No link yet.</p>
              <div><button type="button" className="btn btn-primary btn-sm" disabled={busy || !status.botReady} onClick={() => run({ action: 'join-link' })}><Link2 size={14} aria-hidden="true" /> Make the club link</button></div>
            </>}
          </div>
        </div>
      )}

      {waiting.length > 0 && (
        <div style={sec}>
          <h4 style={h4}>Waiting for a yes <span style={{ color: 'var(--color-muted)', fontWeight: 600 }}>{waiting.length}</span></h4>
          <ul style={{ listStyle: 'none', margin: 'var(--space-xs) 0 0', padding: 0, display: 'grid', gap: 'var(--space-xs)' }}>
            {waiting.map(w => (
              <li key={w.id} style={row}>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <b style={{ fontSize: 'var(--text-sm)' }}>{w.name}</b> <span className="admin-pill is-warn">Asked {when(w.askedAt)}</span>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)' }}>{[w.role, w.sender && `Telegram: ${w.sender}`].filter(Boolean).join(' · ')}</div>
                </div>
                <div className="row row-wrap" style={{ gap: '0.5rem' }}>
                  <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => run({ action: 'answer', requestId: w.id, allow: true })}>Allow</button>
                  <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => run({ action: 'answer', requestId: w.id, allow: false })}>No</button>
                </div>
              </li>
            ))}
          </ul>
          <p style={note}>Admins scoring by chat get the same ask in Telegram. Whoever answers first, it&apos;s done.</p>
        </div>
      )}

      <div style={sec}>
        <h4 style={h4}>Can score by chat <span style={{ color: 'var(--color-muted)', fontWeight: 600 }}>{status.links.length}</span></h4>
        {status.links.length ? (
          <ul style={{ listStyle: 'none', margin: 'var(--space-xs) 0 0', padding: 0, display: 'grid', gap: 'var(--space-xs)' }}>
            {status.links.map(l => (
              <li key={`${l.member_id}-${l.linked_at}`} style={row}>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <b style={{ fontSize: 'var(--text-sm)' }}>{l.name || 'Member'}</b>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)' }}>
                    {[l.role, `Allowed ${when(l.linked_at)}`, l.last_used_at ? `Last used ${when(l.last_used_at)}` : 'Not used yet'].filter(Boolean).join(' · ')}
                  </div>
                </div>
                <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => run({ action: 'unlink', memberId: l.member_id })}>Remove</button>
              </li>
            ))}
          </ul>
        ) : <p style={note}>Nobody yet. Share the club link, or link someone in <a href={peopleHref} style={{ color: 'inherit', fontWeight: 600 }}>People</a>.</p>}
        <p style={note}>Removing someone, or changing their role so they can&apos;t edit Match Centre, stops their chat at once.</p>
      </div>
      {error && <p role="alert" style={{ margin: 'var(--space-xs) 0 0', fontSize: 'var(--text-sm)', color: 'var(--color-danger, #DC2626)' }}>{error}</p>}
    </section>
  );
}

/** People -> one person: link their chat, or unlink it */
export function ChatLinkCard({ clubId, memberId, name, matchCentreHref }: { clubId: string; memberId: string; name: string; matchCentreHref: string }) {
  const { status, load } = useChatStatus(clubId);
  const [link, setLink] = useState<{ url: string; expiresAt: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  useEffect(() => { setLink(null); setError(''); }, [memberId]);
  if (!status?.ready) return null;
  if (!status.scoringEnabled) {
    return (
      <div className="ppl-card">
        <div className="ppl-card-label">Scoring by chat</div>
        <div className="ppl-card-note">Off for the club. Turn on Score by chat in <a href={matchCentreHref} style={{ color: 'inherit', fontWeight: 600 }}>Match Centre</a> (Score and events tab), then link people here.</div>
      </div>
    );
  }

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
