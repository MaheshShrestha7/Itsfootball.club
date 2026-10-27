'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { getSupabaseClient } from '@/lib/supabase/client';
import { PlatformUserItem } from '@/lib/supabase/types';
import { formatDate } from '@/lib/dates';
import { Avatar, Crest, LogoArt } from '@/components/admin/platform/McArt';
import { initials } from '@/lib/mission-control';
import {
  Search,
  RefreshCw,
  ShieldCheck,
  Building,
  CheckCircle2,
  Clock,
  Copy,
  Check,
  UserCheck,
  ExternalLink,
} from 'lucide-react';

export default function UsersTab() {
  const [users, setUsers] = useState<PlatformUserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const fetchUsers = useCallback(async (query: string = '') => {
    const client = getSupabaseClient();
    if (!client) return;
    setLoading(true);
    try {
      const { data, error } = await client.rpc('get_platform_users', {
        p_search: query,
        p_limit: 100,
        p_offset: 0,
      });

      if (!error && data) {
        setUsers(data as PlatformUserItem[]);
      } else if (error) {
        console.warn('Could not load platform users via RPC:', error.message);
      }
    } catch (err) {
      console.error('Error fetching platform users:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers(searchQuery);
  }, [fetchUsers, searchQuery]);

  const copyText = (text: string, id: string) => {
    navigator.clipboard?.writeText(text).catch(() => null);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const selected = users.find(u => u.id === selectedId) || users[0] || null;

  const roleFlag = (u: PlatformUserItem) =>
    u.is_super_admin
      ? <span className="mc-flag info"><ShieldCheck size={11} />Platform admin</span>
      : u.clubs_owned_count > 0
        ? <span className="mc-flag warn">Club owner</span>
        : <span className="mc-flag">Member or supporter</span>;

  return (
    <div>
      <div className="mc-page-h">
        <div>
          <h1>Users</h1>
          <p>Look up anyone with an account, across every club.</p>
        </div>
        <div className="right">
          <span className="mc-eyebrow num">{users.length} shown</span>
          <button type="button" className="mc-pill-btn ghost" onClick={() => fetchUsers(searchQuery)} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      <div className="mc-users">
        <div className="mc-card">
          <label className="mc-search">
            <Search size={15} aria-hidden="true" />
            <input
              type="text"
              placeholder="Search email or full name"
              aria-label="Search users"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </label>
          <div className="mc-ulist">
            {loading && users.length === 0 && <p className="mc-muted" style={{ padding: 8 }}>Loading users…</p>}
            {!loading && users.length === 0 && <p className="mc-muted" style={{ padding: 8 }}>No users match that search.</p>}
            {users.map(u => (
              <button key={u.id} type="button" className="mc-urow" aria-pressed={selected?.id === u.id} onClick={() => setSelectedId(u.id)}>
                <Avatar name={u.full_name || u.email} url={u.avatar_url} />
                <div>
                  <b>{u.full_name || u.email}</b>
                  <small>{u.email}</small>
                </div>
              </button>
            ))}
          </div>
        </div>

        {selected ? (
          <div className="mc-col">
            <div className="mc-card mc-profile">
              <div className="ban"><LogoArt id="user" /></div>
              <div className="who">
                <div style={{ display: 'flex', gap: 14, alignItems: 'flex-end', minWidth: 0 }}>
                  <Avatar name={selected.full_name || selected.email} url={selected.avatar_url} />
                  <div style={{ minWidth: 0 }}>
                    <h2>{selected.full_name || selected.email}</h2>
                    <small>
                      <span>{selected.email}</span>
                      <button
                        type="button"
                        onClick={() => copyText(selected.email, `email-${selected.id}`)}
                        className="mc-icon-btn"
                        style={{ width: 22, height: 22 }}
                        aria-label="Copy email"
                        title="Copy email"
                      >
                        {copiedId === `email-${selected.id}` ? <Check size={11} color="var(--mc-green)" /> : <Copy size={11} />}
                      </button>
                    </small>
                  </div>
                </div>
                <div className="acts">
                  {roleFlag(selected)}
                  <button type="button" className="mc-pill-btn" onClick={() => copyText(selected.id, `id-${selected.id}`)} title="Copy the account ID">
                    {copiedId === `id-${selected.id}` ? <Check size={13} /> : <Copy size={13} />}
                    {copiedId === `id-${selected.id}` ? 'Copied ID' : 'Copy ID'}
                  </button>
                </div>
              </div>
            </div>

            <div className="mc-kpis">
              <div className="mc-card mc-kpi">
                <span className="mc-eyebrow"><span style={{ background: 'var(--mc-lilac)', color: 'var(--mc-indigo)' }}><UserCheck size={11} /></span>Memberships</span>
                <b className="num">{selected.memberships_count ?? selected.memberships.length}</b>
                <small>Clubs joined</small>
              </div>
              <div className="mc-card mc-kpi">
                <span className="mc-eyebrow"><span style={{ background: 'var(--mc-amber-bg)', color: 'var(--mc-amber)' }}><Building size={11} /></span>Clubs owned</span>
                <b className="num">{selected.clubs_owned_count}</b>
                <small>As the club owner</small>
              </div>
              <div className="mc-card mc-kpi">
                <span className="mc-eyebrow"><span style={{ background: 'var(--mc-mint)', color: 'var(--mc-green-ink)' }}><CheckCircle2 size={11} /></span>Joined</span>
                <b style={{ fontSize: 18 }}>{formatDate(selected.created_at)}</b>
                <small>Account created</small>
              </div>
              <div className="mc-card mc-kpi">
                <span className="mc-eyebrow"><span style={{ background: 'var(--mc-sky)', color: 'var(--mc-sky-ink)' }}><Clock size={11} /></span>Last sign-in</span>
                <b style={{ fontSize: 18 }}>{selected.last_sign_in_at ? formatDate(selected.last_sign_in_at) : 'Never'}</b>
                <small>{selected.last_sign_in_at ? 'Most recent' : 'Has not signed in'}</small>
              </div>
            </div>

            <div className="mc-card">
              <div className="mc-card-h"><h3>Club memberships</h3></div>
              {selected.memberships && selected.memberships.length > 0 ? (
                <div className="mc-mships">
                  {selected.memberships.map((m, idx) => (
                    <Link key={idx} href={`/${m.club_slug}`} target="_blank" className="mc-mship">
                      <Crest label={initials(m.club_name)} />
                      <div style={{ minWidth: 0 }}>
                        <b>{m.club_name} <ExternalLink size={10} style={{ verticalAlign: '-1px' }} /></b>
                        <small>{m.role || 'Member'}</small>
                      </div>
                      <span className={`mc-flag ${m.membership_status === 'approved' ? 'ok' : m.membership_status === 'rejected' ? 'bad' : 'warn'}`}>
                        {m.membership_status === 'approved' ? 'Approved' : m.membership_status === 'rejected' ? 'Rejected' : m.membership_status === 'pending' ? 'Waiting' : m.membership_status}
                      </span>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="mc-muted">No club memberships.</p>
              )}
            </div>
          </div>
        ) : (
          <div className="mc-card mc-empty">{loading ? 'Loading users…' : 'Pick someone on the left to see their account.'}</div>
        )}
      </div>
    </div>
  );
}
