'use client';

import React, { use, useCallback, useEffect, useState } from 'react';
import { History } from 'lucide-react';
import { useClub } from '@/lib/club-context';
import { useAuth } from '@/lib/auth-context';
import { getSupabaseClient } from '@/lib/supabase/client';

// Read-only record of sensitive admin actions. The database writes it with triggers
// (admin_audit_log, 20261129_security_3.sql), so it can't be skipped or edited from here.

interface AuditRow {
  id: string;
  actor_email: string | null;
  action: string;
  target_table: string;
  summary: string;
  details: Record<string, unknown>;
  created_at: string;
}

const PAGE = 50;
const FILTERS = [
  { key: 'all', label: 'Everything', tables: null },
  { key: 'members', label: 'Members', tables: ['club_members'] },
  { key: 'payments', label: 'Payments', tables: ['payments'] },
  { key: 'club', label: 'Club & access', tables: ['clubs', 'club_access_roles'] },
] as const;
type FilterKey = typeof FILTERS[number]['key'];

const when = (iso: string) =>
  new Date(iso).toLocaleString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });

/** The reason typed with a rejection or fee waiver, when there was one */
const reasonOf = (row: AuditRow) => typeof row.details?.reason === 'string' && row.details.reason.trim() ? row.details.reason : null;

export default function AdminActivityPage({ params }: { params: Promise<{ clubSlug: string }> }) {
  const { clubSlug } = use(params);
  const { clubs, selectClubBySlug } = useClub();
  const { isClubSuperUser } = useAuth();
  const club = selectClubBySlug(clubSlug) || clubs[0];

  const [filter, setFilter] = useState<FilterKey>('all');
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [more, setMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);

  const load = useCallback(async (before?: string) => {
    const db = getSupabaseClient();
    if (!db) return setLoading(false);
    setLoading(true);
    let q = db.from('admin_audit_log')
      .select('id, actor_email, action, target_table, summary, details, created_at')
      .eq('club_id', club.id)
      .order('created_at', { ascending: false })
      .limit(PAGE + 1);
    const tables = FILTERS.find(f => f.key === filter)?.tables;
    if (tables) q = q.in('target_table', [...tables]);
    if (before) q = q.lt('created_at', before);
    const { data, error } = await q;
    setLoading(false);
    if (error) {
      // Before the migration runs the table doesn't exist yet
      setMissing(true);
      return;
    }
    const page = (data || []) as AuditRow[];
    setMore(page.length > PAGE);
    setRows(prev => (before ? [...prev, ...page.slice(0, PAGE)] : page.slice(0, PAGE)));
  }, [club.id, filter]);

  useEffect(() => { void load(); }, [load]);

  if (!isClubSuperUser(club.id)) {
    return <p style={{ color: 'var(--text-secondary)' }}>Only the club Owner or a Club Admin can see the activity log.</p>;
  }

  return (
    <div className="stack">
      <div>
        <h1 style={{ fontSize: '2.2rem', fontWeight: 900, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <History size={30} /> Activity Log
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', maxWidth: '720px', marginTop: '0.2rem' }}>
          Who approved, rejected or removed members, waived fees, verified payments, or changed access and club settings, and when.
          It is filled in automatically and nobody can edit it.
        </p>
      </div>

      <div role="group" aria-label="Show" className="fixtures-team-chips" data-view-ok>
        {FILTERS.map(f => (
          <button key={f.key} type="button" aria-pressed={filter === f.key} onClick={() => setFilter(f.key)}
            className={`btn btn-sm ${filter === f.key ? 'btn-primary' : 'btn-secondary'}`}>
            {f.label}
          </button>
        ))}
      </div>

      {missing ? (
        <p className="glass-panel text-note" style={{ padding: '1.25rem' }}>
          The activity log starts once the latest database update (20261129_security_3) has been run.
        </p>
      ) : rows.length === 0 ? (
        <p className="glass-panel text-note" style={{ padding: '1.25rem' }}>{loading ? 'Loading…' : 'Nothing recorded yet.'}</p>
      ) : (
        <ol className="glass-panel" style={{ listStyle: 'none', padding: 0, margin: 0, overflow: 'hidden' }}>
          {rows.map(r => (
            <li key={r.id} style={{ padding: '0.8rem 1.1rem', borderBottom: '1px solid var(--border-subtle)', display: 'flex', flexWrap: 'wrap', gap: '0.25rem 1rem', justifyContent: 'space-between' }}>
              <div className="min-w-0">
                <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.9rem' }}>{r.summary}</div>
                {reasonOf(r) && <div className="text-note">Reason: {reasonOf(r)}</div>}
                <div className="text-note">by {r.actor_email || 'an account that has since been deleted'}</div>
              </div>
              <time dateTime={r.created_at} className="text-meta" style={{ whiteSpace: 'nowrap' }}>{when(r.created_at)}</time>
            </li>
          ))}
        </ol>
      )}

      {more && !missing && (
        <div data-view-ok>
          <button type="button" className="btn btn-secondary" disabled={loading} onClick={() => load(rows[rows.length - 1]?.created_at)}>
            {loading ? 'Loading…' : 'Show older'}
          </button>
        </div>
      )}
    </div>
  );
}
