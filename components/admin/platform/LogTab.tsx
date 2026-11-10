'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { getSupabaseClient } from '@/lib/supabase/client';
import { formatDate } from '@/lib/dates';
import { timeAgo } from '@/lib/mission-control';
import type { PlatformAdmin, PlatformAuditRow, PlatformClubItem } from '@/lib/supabase/types';
import { RefreshCw, Search } from 'lucide-react';

const PAGE = 50;
const KINDS: { id: string; label: string }[] = [
  { id: '', label: 'All' },
  { id: 'clubs', label: 'Clubs' },
  { id: 'people', label: 'People' },
  { id: 'support', label: 'Support' },
  { id: 'broadcasts', label: 'Broadcasts' },
  { id: 'grounds', label: 'Grounds' },
  { id: 'jobs', label: 'Jobs' },
  { id: 'admins', label: 'Admins' },
];

interface Props { clubs: PlatformClubItem[]; admins: PlatformAdmin[] }

/** Every Mission Control action, plus everything platform admins changed inside clubs (admin_audit_log). */
export default function LogTab({ clubs, admins }: Props) {
  const [rows, setRows] = useState<PlatformAuditRow[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actor, setActor] = useState('');
  const [clubId, setClubId] = useState('');
  const [kind, setKind] = useState('');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  // Before migration 20261163 only the plain list works; the filters are then hidden
  const [filtersWork, setFiltersWork] = useState(true);
  const reqId = useRef(0);

  // Search once typing stops
  useEffect(() => {
    const t = setTimeout(() => setQuery(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async (before: string | null) => {
    const client = getSupabaseClient();
    if (!client) return;
    const id = ++reqId.current;
    setLoading(true);
    let res = await client.rpc('get_platform_audit', {
      p_club_id: clubId || null, p_limit: PAGE, p_actor: actor || null, p_kind: kind || null, p_search: query || null, p_before: before,
    });
    if (res.error && /function|parameter|p_actor/i.test(res.error.message)) {
      setFiltersWork(false);
      res = await client.rpc('get_platform_audit', { p_club_id: clubId || null, p_limit: 300 });
    }
    if (id !== reqId.current) return;
    setLoading(false);
    setError(res.error ? res.error.message : '');
    const page = (res.data || []) as PlatformAuditRow[];
    setRows(prev => (before ? [...prev, ...page] : page));
    setTotal(page[0]?.total_count != null ? Number(page[0].total_count) : before ? total : page.length);
  }, [actor, clubId, kind, query]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(null); }, [load]);

  const more = total != null && rows.length < total;
  const sortedClubs = [...clubs].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div>
      <div className="mc-page-h">
        <div>
          <h1>Action log</h1>
          <p>What platform admins changed, newest first. Written by the database, so nothing is missed or edited.</p>
        </div>
        <div className="right">
          <button type="button" className="mc-pill-btn ghost" onClick={() => load(null)} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      <section className="mc-card">
        {filtersWork && (
          <>
            <div className="mc-toolbar">
              <select className="mc-select" aria-label="Who" value={actor} onChange={e => setActor(e.target.value)}>
                <option value="">Everyone</option>
                <option value="me">Only me</option>
                {admins.filter(a => a.email).map(a => <option key={a.email} value={a.email}>{a.full_name || a.email}</option>)}
              </select>
              <select className="mc-select" aria-label="Club" value={clubId} onChange={e => setClubId(e.target.value)}>
                <option value="">Every club</option>
                {sortedClubs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <label className="mc-search grow">
                <Search size={14} aria-hidden="true" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search what changed" aria-label="Search the log" />
              </label>
            </div>
            <div className="mc-chips" role="group" aria-label="Kind of change">
              {KINDS.map(k => (
                <button key={k.id || 'all'} type="button" className="mc-chip" aria-pressed={kind === k.id} onClick={() => setKind(k.id)}>{k.label}</button>
              ))}
            </div>
          </>
        )}

        {error && <p role="alert" style={{ color: 'var(--mc-red)' }}>{error}</p>}
        {!loading && !error && rows.length === 0 && <div className="mc-empty">{query || actor || clubId || kind ? 'Nothing matches. Try fewer filters.' : 'Nothing logged yet.'}</div>}

        {rows.length > 0 && (
          <div className="mc-table-wrap">
            <table className="mc-table mc-log">
              <thead><tr><th>When</th><th>Who</th><th>What</th><th>Where</th></tr></thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id}>
                    <td><time dateTime={r.created_at} title={formatDate(r.created_at)}>{timeAgo(r.created_at)}</time></td>
                    <td className="who">{r.actor_email || 'System'}</td>
                    <td>{r.summary}</td>
                    <td>{r.club_slug ? <Link href={`/${r.club_slug}`} target="_blank">{r.club_name}</Link> : 'Mission Control'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {rows.length > 0 && (
          <div className="mc-more">
            <span>Showing {rows.length.toLocaleString('en-AU')}{total != null ? ` of ${total.toLocaleString('en-AU')}` : ''}</span>
            {filtersWork && more && (
              <button type="button" className="mc-pill-btn ghost" disabled={loading} onClick={() => load(rows[rows.length - 1].created_at)}>
                {loading ? 'Loading…' : `Show ${Math.min(PAGE, total! - rows.length)} more`}
              </button>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
