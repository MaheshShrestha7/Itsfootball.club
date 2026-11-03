'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { getSupabaseClient } from '@/lib/supabase/client';
import { formatDate } from '@/lib/dates';
import { timeAgo } from '@/lib/mission-control';
import type { PlatformAuditRow } from '@/lib/supabase/types';
import { RefreshCw } from 'lucide-react';

/** Every Mission Control action, plus everything platform admins changed inside clubs (admin_audit_log). */
export default function LogTab() {
  const [rows, setRows] = useState<PlatformAuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const client = getSupabaseClient();
    if (!client) return;
    setLoading(true);
    const { data, error } = await client.rpc('get_platform_audit', { p_club_id: null, p_limit: 300 });
    setError(error ? error.message : '');
    setRows((data || []) as PlatformAuditRow[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <div className="mc-page-h">
        <div>
          <h1>Action log</h1>
          <p>What platform admins changed, newest first. Written by the database, so nothing is missed or edited.</p>
        </div>
        <div className="right">
          <button type="button" className="mc-pill-btn ghost" onClick={load} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      <div className="mc-card">
        {error && <p role="alert" style={{ color: 'var(--mc-red)' }}>{error}</p>}
        {!loading && !error && rows.length === 0 && <div className="mc-empty">Nothing logged yet.</div>}
        <div className="mc-feed">
          {rows.map(r => (
            <div key={r.id} className="mc-feed-row">
              <div>
                <b>{r.summary}</b>
                {r.club_slug ? <> · <Link href={`/${r.club_slug}`} target="_blank">{r.club_name}</Link></> : <> · Mission Control</>}
                <time dateTime={r.created_at} title={formatDate(r.created_at)}>{r.actor_email || 'system'} · {timeAgo(r.created_at)}</time>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
