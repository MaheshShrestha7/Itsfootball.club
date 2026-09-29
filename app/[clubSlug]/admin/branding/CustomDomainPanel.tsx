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
  background: 'rgba(var(--shade-rgb), 0.3)',
  border: '1px solid var(--border-subtle)',
  borderRadius: '8px',
  padding: '0.85rem 1rem',
  marginTop: '0.75rem',
  fontSize: '0.8rem',
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
    <div className="glass-panel" style={{ padding: '2rem' }}>
      <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <Globe size={20} color="var(--club-primary)" /> Custom Domain
      </h3>
      <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
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
        {message && <div role="alert" style={{ color: 'var(--danger, #ef4444)', fontSize: '0.8rem', marginTop: '0.5rem' }}>{message}</div>}

        {status === 'live' && (
          <div style={{ ...box, display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <CheckCircle2 size={16} color="var(--success, #10b981)" />
            <strong>Live.</strong> Your site is at
            <a href={`https://${domain}`} target="_blank" rel="noopener noreferrer" className="row" style={{ gap: '0.25rem' }}>
              {domain} <ExternalLink size={12} />
            </a>
          </div>
        )}

        {status === 'pending' && (
          <div style={box} aria-live="polite">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.6rem' }}>
              <Clock size={16} /> <strong>Waiting for your DNS record.</strong>
              <button type="button" className="btn btn-secondary btn-sm row" style={{ marginLeft: 'auto', gap: '0.3rem' }} onClick={check}>
                <RefreshCw size={12} /> Check now
              </button>
            </div>
            At your domain registrar (GoDaddy, Namecheap, Cloudflare...), add this record:
            <table style={{ width: '100%', margin: '0.6rem 0', borderCollapse: 'collapse', fontFamily: 'var(--font-jetbrains), monospace' }}>
              <thead><tr style={{ textAlign: 'left', color: 'var(--text-muted)' }}><th>Type</th><th>Name</th><th>Points to</th></tr></thead>
              <tbody><tr><td>CNAME</td><td style={{ wordBreak: 'break-all' }}>{domain}</td><td style={{ wordBreak: 'break-all' }}>{CNAME_TARGET}</td></tr></tbody>
            </table>
            Some registrars want only the first part as the name (<code>{domain.split('.')[0]}</code>). It usually goes live within minutes, and this page updates by itself.
            Want the bare domain without <code>www</code> too? Set up forwarding from it to <code>{domain}</code> at your registrar.
          </div>
        )}
      </div>
    </div>
  );
}
