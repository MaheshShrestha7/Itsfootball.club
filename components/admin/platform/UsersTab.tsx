'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { getSupabaseClient } from '@/lib/supabase/client';
import { PlatformUserItem } from '@/lib/supabase/types';
import { formatDate } from '@/lib/dates';
import {
  Users,
  Search,
  RefreshCw,
  ShieldCheck,
  Building,
  CheckCircle2,
  Clock,
  XCircle,
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
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="glass-panel" style={{ padding: '1.75rem' }}>
      {/* Header & Search */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 900, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Users size={22} color="var(--c-blue)" />
            <span>Cross-Tenant User Directory ({users.length})</span>
          </h2>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Search accounts across all clubs, inspect memberships, roles, and resolve support requests
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {/* Search Bar */}
          <div style={{ position: 'relative', width: '300px' }}>
            <Search size={15} color="var(--text-muted)" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="Search user email or full name..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '0.45rem 0.75rem 0.45rem 2.2rem',
                background: 'rgba(var(--shade-rgb), 0.5)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '6px',
                color: 'var(--text-primary)',
                fontSize: '0.82rem',
              }}
            />
          </div>

          {/* Refresh */}
          <button
            type="button"
            onClick={() => fetchUsers(searchQuery)}
            disabled={loading}
            className="btn btn-secondary btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Users Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border-subtle)', color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              <th style={{ padding: '0.75rem 0.5rem' }}>User / Account</th>
              <th style={{ padding: '0.75rem 0.5rem' }}>Account Role</th>
              <th style={{ padding: '0.75rem 0.5rem' }}>Clubs Owned</th>
              <th style={{ padding: '0.75rem 0.5rem' }}>Memberships &amp; Passes</th>
              <th style={{ padding: '0.75rem 0.5rem' }}>Registered</th>
              <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} style={{ padding: '3rem 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                  Loading platform users...
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '3rem 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No users found matching your query.
                </td>
              </tr>
            ) : (
              users.map(u => (
                <tr key={u.id} style={{ borderBottom: '1px solid var(--border-subtle)', transition: 'background 0.15s ease' }}>
                  {/* User Account */}
                  <td style={{ padding: '0.85rem 0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                      {u.avatar_url ? (
                        <img width={28} height={28} src={u.avatar_url} alt="" style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(99, 102, 241, 0.2)', color: '#818CF8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.75rem' }}>
                          {u.full_name.slice(0, 1)}
                        </div>
                      )}
                      <div>
                        <div style={{ fontWeight: 800, color: 'var(--text-primary)' }}>{u.full_name}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <span>{u.email}</span>
                          <button
                            type="button"
                            onClick={() => copyText(u.email, `email-${u.id}`)}
                            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--text-muted)' }}
                            title="Copy email"
                          >
                            {copiedId === `email-${u.id}` ? <Check size={11} color="var(--c-green)" /> : <Copy size={11} />}
                          </button>
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Account Role */}
                  <td style={{ padding: '0.85rem 0.5rem' }}>
                    {u.is_super_admin ? (
                      <span className="badge" style={{ background: 'rgba(99, 102, 241, 0.2)', color: '#818CF8', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                        <ShieldCheck size={12} />
                        <span>Platform Admin</span>
                      </span>
                    ) : u.clubs_owned_count > 0 ? (
                      <span className="badge" style={{ background: 'rgba(245, 158, 11, 0.15)', color: 'var(--c-amber)', fontWeight: 700 }}>
                        Club Owner
                      </span>
                    ) : (
                      <span className="badge" style={{ background: 'rgba(var(--tint-rgb), 0.05)', color: 'var(--text-muted)' }}>
                        Member / Supporter
                      </span>
                    )}
                  </td>

                  {/* Clubs Owned */}
                  <td style={{ padding: '0.85rem 0.5rem' }}>
                    {u.clubs_owned_count > 0 ? (
                      <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                        {u.clubs_owned_count} club{u.clubs_owned_count > 1 ? 's' : ''}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>—</span>
                    )}
                  </td>

                  {/* Memberships Held */}
                  <td style={{ padding: '0.85rem 0.5rem' }}>
                    {u.memberships && u.memberships.length > 0 ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', maxWidth: '320px' }}>
                        {u.memberships.map((m, idx) => (
                          <Link
                            key={idx}
                            href={`/${m.club_slug}`}
                            target="_blank"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                              padding: '0.2rem 0.45rem',
                              borderRadius: '4px',
                              background: 'rgba(var(--tint-rgb), 0.04)',
                              border: '1px solid var(--border-subtle)',
                              fontSize: '0.72rem',
                              color: 'var(--text-primary)',
                              textDecoration: 'none',
                            }}
                          >
                            <span style={{ fontWeight: 700 }}>{m.club_name}</span>
                            <span style={{ color: m.membership_status === 'approved' ? 'var(--c-green)' : 'var(--c-amber)' }}>
                              ({m.role || 'Member'})
                            </span>
                          </Link>
                        ))}
                      </div>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>No club memberships</span>
                    )}
                  </td>

                  {/* Registered */}
                  <td style={{ padding: '0.85rem 0.5rem' }}>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                      {formatDate(u.created_at)}
                    </div>
                  </td>

                  {/* Actions */}
                  <td style={{ padding: '0.85rem 0.5rem', textAlign: 'right' }}>
                    <button
                      type="button"
                      onClick={() => copyText(u.id, `id-${u.id}`)}
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '0.25rem 0.55rem', fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                      title="Copy User UUID"
                    >
                      {copiedId === `id-${u.id}` ? <Check size={12} color="var(--c-green)" /> : <Copy size={12} />}
                      <span>{copiedId === `id-${u.id}` ? 'Copied ID' : 'Copy ID'}</span>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
