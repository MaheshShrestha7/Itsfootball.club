'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { platformApi } from '@/components/admin/platform/api';
import { formatDate } from '@/lib/dates';
import { timeAgo } from '@/lib/mission-control';
import { EMAIL_KIND_GROUPS, emailKindLabel } from '@/lib/email/kinds';
import type { PlatformClubItem } from '@/lib/supabase/types';
import { RefreshCw, Search } from 'lucide-react';

interface Row { key: string; club_id: string | null; recipient: string; kind: string | null; subject: string | null; sent_at: string }

/** Every email the site sent (email_log), who it went to and when. Delivery and bounces live in Resend. */
export default function EmailLogTab({ clubs }: { clubs: PlatformClubItem[] }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [more, setMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [clubId, setClubId] = useState('');
  const [group, setGroup] = useState('');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const reqId = useRef(0);

  useEffect(() => {
    const t = setTimeout(() => setQuery(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async (offset: number) => {
    const id = ++reqId.current;
    setLoading(true);
    const params = new URLSearchParams({ clubId, group, q: query, offset: String(offset) });
    const res = await platformApi<{ rows: Row[]; more: boolean }>(`email-log?${params}`);
    if (id !== reqId.current) return;
    setLoading(false);
    setError(res.error || '');
    setRows(prev => (offset ? [...prev, ...(res.rows || [])] : res.rows || []));
    setMore(!!res.more);
  }, [clubId, group, query]);

  useEffect(() => { load(0); }, [load]);

  const clubName = new Map(clubs.map(c => [c.id, c.name]));
  const sortedClubs = [...clubs].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div>
      <div className="mc-page-h">
        <div>
          <h1>Email log</h1>
          <p>Every email the site sent, who it went to and when.</p>
        </div>
        <div className="right">
          <button type="button" className="mc-pill-btn ghost" onClick={() => load(0)} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      <section className="mc-card">
        <div className="mc-toolbar">
          <select className="mc-select" aria-label="Club" value={clubId} onChange={e => setClubId(e.target.value)}>
            <option value="">Every club</option>
            <option value="none">Platform (no club)</option>
            {sortedClubs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select className="mc-select" aria-label="Kind of email" value={group} onChange={e => setGroup(e.target.value)}>
            <option value="">Every kind</option>
            {EMAIL_KIND_GROUPS.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
          </select>
          <label className="mc-search grow">
            <Search size={14} aria-hidden="true" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search an email address or subject" aria-label="Search the email log" />
          </label>
        </div>

        {error && <p role="alert" style={{ color: 'var(--mc-red)' }}>{error}</p>}
        {!loading && !error && rows.length === 0 && <div className="mc-empty">{query || clubId || group ? 'Nothing matches. Try fewer filters.' : 'No emails logged yet.'}</div>}

        {rows.length > 0 && (
          <div className="mc-table-wrap">
            <table className="mc-table mc-log">
              <thead><tr><th>When</th><th>To</th><th>What</th><th>Club</th></tr></thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.key}>
                    <td><time dateTime={r.sent_at} title={formatDate(r.sent_at)}>{timeAgo(r.sent_at)}</time></td>
                    <td className="who">{r.recipient}</td>
                    <td><b style={{ fontWeight: 600 }}>{emailKindLabel(r.kind)}</b>{r.subject && <><br /><span className="mc-muted">{r.subject}</span></>}</td>
                    <td>{r.club_id ? clubName.get(r.club_id) || 'Unknown club' : 'Platform'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {rows.length > 0 && (
          <div className="mc-more">
            <span>Showing {rows.length.toLocaleString('en-AU')}</span>
            {more && (
              <button type="button" className="mc-pill-btn ghost" disabled={loading} onClick={() => load(rows.length)}>
                {loading ? 'Loading…' : 'Show 50 more'}
              </button>
            )}
          </div>
        )}
        <p className="mc-muted" style={{ fontSize: 11, margin: '10px 0 0' }}>
          Sent, not delivered: bounces and spam reports are in Resend. Sign-in, invite and support emails are logged from 20 Nov 2026.
        </p>
      </section>
    </div>
  );
}
