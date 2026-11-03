'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Clock, ExternalLink, Globe, RefreshCw } from 'lucide-react';
import { useClub } from '@/lib/club-context';
import { getAccessToken } from '@/lib/supabase/client';
import { SITE_URL } from '@/lib/slugs';
import type { Club } from '@/lib/supabase/types';

// The club's own domain, saved on its own (not with the branding form): connecting registers it with
// Cloudflare (app/api/custom-domain), and it goes live by itself once the club's DNS points at us.

type Status = 'none' | 'pending' | 'live';
const CNAME_TARGET = `cname.${new URL(SITE_URL).host}`;
const RECHECK_MS = 30_000;

const box: React.CSSProperties = {
  background: 'var(--color-paper)',
  border: '1px solid var(--color-rule)',
  borderRadius: 'var(--radius-card)',
  padding: 'var(--space-sm) var(--space-md)',
  marginTop: 'var(--space-sm)',
  fontSize: 'var(--text-sm)',
  lineHeight: 1.55,
  color: 'var(--text-secondary)',
};

export default function CustomDomainPanel({ club }: { club: Club }) {
  const { updateClubBranding } = useClub();
  const [value, setValue] = useState(club.custom_domain || '');
  const [domain, setDomain] = useState(club.custom_domain || '');
  const [status, setStatus] = useState<Status>(club.custom_domain ? 'pending' : 'none');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const call = useCallback(async (init?: RequestInit) => {
    const res = await fetch(init ? '/api/custom-domain' : `/api/custom-domain?clubId=${club.id}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await getAccessToken()}` },
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || 'Something went wrong. Please try again.');
    setDomain(json.domain);
    setStatus(json.status);
    return json as { domain: string; status: Status };
  }, [club.id]);

  const check = useCallback(() => call().catch(err => setMessage(err.message)), [call]);

  // Current status on load, then keep checking while it waits for the DNS record
  useEffect(() => { if (club.custom_domain) check(); }, [club.custom_domain, check]);
  useEffect(() => {
    if (status !== 'pending') return;
    const timer = setInterval(check, RECHECK_MS);
    return () => clearInterval(timer);
  }, [status, check]);

  const connect = async (next: string) => {
    setBusy(true);
    setMessage(null);
    try {
      const json = await call({ method: 'POST', body: JSON.stringify({ clubId: club.id, domain: next }) });
      setValue(json.domain);
      // Keep local state in step, so a later branding save doesn't write the old domain back
      updateClubBranding(club.id, { custom_domain: json.domain });
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const changed = value.trim().toLowerCase() !== domain;

  return (
    <div className="glass-panel" style={{ padding: 'clamp(var(--space-md), 4vw, var(--space-xl))' }}>
      <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <Globe size={20} aria-hidden="true" /> Custom domain
      </h2>
      <p className="text-note" style={{ marginBottom: '1.25rem', overflowWrap: 'anywhere' }}>
        Put your club site on your own domain (e.g. <code>www.yourclub.com</code>). Your <code>itsfootball.club/{club.slug}</code> address keeps working too.
      </p>

      <div className="form-group">
        <label className="form-label" htmlFor="custom-domain">Your domain</label>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <input
            id="custom-domain"
            type="text"
            className="form-input"
            style={{ flex: '1 1 220px' }}
            placeholder="www.yourclub.com"
            autoComplete="off"
            spellCheck={false}
            value={value}
            onChange={e => setValue(e.target.value)}
            // Inside the branding <form>: Enter connects the domain instead of saving everything
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (changed) connect(value); } }}
          />
          <button type="button" className="btn btn-primary" disabled={busy || !changed || !value.trim()} onClick={() => connect(value)}>
            {busy ? 'Connecting...' : 'Connect domain'}
          </button>
          {domain && (
            <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => connect('')}>
              Disconnect
            </button>
          )}
        </div>
        {message && <div role="alert" className="admin-flash is-error" style={{ margin: 'var(--space-xs) 0 0' }}>{message}</div>}

        {status === 'live' && (
          <div style={{ ...box, display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <CheckCircle2 size={16} aria-hidden="true" style={{ color: 'var(--color-ok)' }} />
            <strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Live.</strong> Your site is at
            <a href={`https://${domain}`} target="_blank" rel="noopener noreferrer" className="row" style={{ gap: '0.25rem', color: 'var(--club-ink)', overflowWrap: 'anywhere' }}>
              {domain} <ExternalLink size={12} />
            </a>
          </div>
        )}

        {status === 'pending' && (
          <div style={box} aria-live="polite">
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem', marginBottom: '0.6rem' }}>
              <Clock size={16} aria-hidden="true" style={{ color: 'var(--color-warn)' }} /> <strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Waiting for your DNS record.</strong>
              <button type="button" className="btn btn-secondary btn-sm row" style={{ marginLeft: 'auto', gap: '0.3rem' }} onClick={check}>
                <RefreshCw size={12} aria-hidden="true" /> Check now
              </button>
            </div>
            At your domain registrar (GoDaddy, Namecheap, Cloudflare…), add this record:
            {/* Label and value rows rather than a table, so long names don't squeeze into narrow columns on a phone */}
            <dl style={{ display: 'grid', gridTemplateColumns: 'max-content minmax(0, 1fr)', gap: 'var(--space-2xs) var(--space-md)', margin: 'var(--space-xs) 0', padding: 'var(--space-sm) var(--space-md)', border: '1px solid var(--color-rule)', borderRadius: 'var(--radius-control)', background: 'var(--color-paper-2)' }}>
              {([['Type', 'CNAME'], ['Name', domain], ['Points to', CNAME_TARGET]] as const).map(([k, v]) => (
                <React.Fragment key={k}>
                  <dt style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)', lineHeight: '1.6rem' }}>{k}</dt>
                  <dd style={{ margin: 0, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', overflowWrap: 'anywhere', lineHeight: '1.6rem' }}>{v}</dd>
                </React.Fragment>
              ))}
            </dl>
            Some registrars want only the first part as the name (<code>{domain.split('.')[0]}</code>). It usually goes live within minutes, and this page updates by itself.
            Want the bare domain without <code>www</code> too? Set up forwarding from it to <code>{domain}</code> at your registrar.
          </div>
        )}
      </div>
    </div>
  );
}
