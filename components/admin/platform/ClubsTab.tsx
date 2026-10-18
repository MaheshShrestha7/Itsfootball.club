'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { PlatformClubItem, MembershipPaymentPolicy } from '@/lib/supabase/types';
import { formatMoney, toCsv } from '@/lib/finance';
import {
  Search,
  Download,
  ExternalLink,
  Shield,
  Eye,
  Sliders,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Globe,
  CreditCard,
  Building,
} from 'lucide-react';

interface ClubsTabProps {
  clubs: PlatformClubItem[];
  loading: boolean;
  onSelectClub: (club: PlatformClubItem) => void;
  onToggleStatus: (clubId: string, currentStatus: boolean) => Promise<void>;
  statusUpdatingId: string | null;
}

export default function ClubsTab({
  clubs,
  loading,
  onSelectClub,
  onToggleStatus,
  statusUpdatingId,
}: ClubsTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [quickFilter, setQuickFilter] = useState<'all' | 'stripe' | 'domain' | 'backlog'>('all');
  const [sortBy, setSortBy] = useState<'visits' | 'members' | 'gmv' | 'newest'>('newest');

  // Filtered and sorted clubs
  const processedClubs = useMemo(() => {
    let list = clubs.filter(c => {
      if (statusFilter === 'active' && !c.is_active) return false;
      if (statusFilter === 'inactive' && c.is_active) return false;

      if (quickFilter === 'stripe' && !c.stripe_ready) return false;
      if (quickFilter === 'domain' && !c.custom_domain) return false;
      if (quickFilter === 'backlog' && c.pending_count < 5) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        c.name.toLowerCase().includes(q) ||
        c.slug.toLowerCase().includes(q) ||
        (c.owner_email && c.owner_email.toLowerCase().includes(q)) ||
        (c.owner_name && c.owner_name.toLowerCase().includes(q)) ||
        (c.custom_domain && c.custom_domain.toLowerCase().includes(q))
      );
    });

    list = [...list].sort((a, b) => {
      if (sortBy === 'visits') return Number(b.visits_30d) - Number(a.visits_30d);
      if (sortBy === 'members') return Number(b.member_count) - Number(a.member_count);
      if (sortBy === 'gmv') return Number(b.gmv_cents) - Number(a.gmv_cents);
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    return list;
  }, [clubs, searchQuery, statusFilter, quickFilter, sortBy]);

  // Export CSV
  const handleExportCsv = () => {
    const rows = [
      [
        'Club Name',
        'Slug',
        'Custom Domain',
        'Owner Name',
        'Owner Email',
        'Status',
        'Members',
        'Pending Approvals',
        'Teams',
        'Matches',
        '30d Visits',
        'GMV ($)',
        'Payment Policy',
        'Stripe Connected',
        'Created At',
      ],
      ...processedClubs.map(c => [
        c.name,
        c.slug,
        c.custom_domain || '',
        c.owner_name || '',
        c.owner_email || '',
        c.is_active ? 'Active' : 'Suspended',
        c.member_count,
        c.pending_count,
        c.team_count,
        c.match_count,
        c.visits_30d,
        (c.gmv_cents / 100).toFixed(2),
        c.membership_payment_policy,
        c.stripe_ready ? 'Yes' : 'No',
        c.created_at,
      ]),
    ];
    const csvData = toCsv(rows);
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `itsfootball-clubs-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="glass-panel" style={{ padding: '1.75rem' }}>
      {/* Top Header & Search Controls */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.25rem' }}>
        <div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 900, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Building size={22} color="var(--c-amber)" />
            <span>Master Club Fleet ({processedClubs.length})</span>
          </h2>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Deep operational control, status toggling, and multi-tenant telemetry
          </span>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.75rem' }}>
          {/* Search Bar */}
          <div style={{ position: 'relative', width: '280px' }}>
            <Search size={15} color="var(--text-muted)" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="Search club, slug, domain, owner..."
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

          {/* Sort Filter */}
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as any)}
            style={{
              padding: '0.45rem 0.75rem',
              background: 'rgba(var(--shade-rgb), 0.5)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '6px',
              color: 'var(--text-primary)',
              fontSize: '0.82rem',
            }}
          >
            <option value="newest">Sort: Newest First</option>
            <option value="visits">Sort: Most Traffic (30d)</option>
            <option value="members">Sort: Most Members</option>
            <option value="gmv">Sort: Highest GMV</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
            style={{
              padding: '0.45rem 0.75rem',
              background: 'rgba(var(--shade-rgb), 0.5)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '6px',
              color: 'var(--text-primary)',
              fontSize: '0.82rem',
            }}
          >
            <option value="all">All Statuses</option>
            <option value="active">Active Only</option>
            <option value="inactive">Suspended Only</option>
          </select>

          {/* CSV Export */}
          <button
            type="button"
            onClick={handleExportCsv}
            className="btn btn-secondary btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
            title="Download Master Directory CSV"
          >
            <Download size={14} />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Preset Filter Chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1.25rem' }}>
        {[
          { key: 'all', label: 'All Fleet' },
          { key: 'stripe', label: 'Stripe Connected' },
          { key: 'domain', label: 'Custom Domain Routing' },
          { key: 'backlog', label: 'High Pending Backlog (≥5)' },
        ].map(chip => (
          <button
            key={chip.key}
            type="button"
            onClick={() => setQuickFilter(chip.key as any)}
            style={{
              border: 'none',
              padding: '0.3rem 0.75rem',
              borderRadius: '20px',
              fontSize: '0.75rem',
              fontWeight: 700,
              cursor: 'pointer',
              background: quickFilter === chip.key ? 'rgba(99, 102, 241, 0.25)' : 'rgba(var(--tint-rgb), 0.04)',
              color: quickFilter === chip.key ? '#818CF8' : 'var(--text-secondary)',
              borderWidth: '1px',
              borderStyle: 'solid',
              borderColor: quickFilter === chip.key ? 'rgba(99, 102, 241, 0.4)' : 'var(--border-subtle)',
              transition: 'all 0.15s ease',
            }}
          >
            {chip.label}
          </button>
        ))}
      </div>

      {/* Clubs Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border-subtle)', color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              <th style={{ padding: '0.75rem 0.5rem' }}>Club</th>
              <th style={{ padding: '0.75rem 0.5rem' }}>Owner</th>
              <th style={{ padding: '0.75rem 0.5rem' }}>Footprint</th>
              <th style={{ padding: '0.75rem 0.5rem' }}>Payment Gateway</th>
              <th style={{ padding: '0.75rem 0.5rem' }}>30d Traffic</th>
              <th style={{ padding: '0.75rem 0.5rem' }}>GMV</th>
              <th style={{ padding: '0.75rem 0.5rem' }}>Status</th>
              <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} style={{ padding: '3rem 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                  Loading clubs...
                </td>
              </tr>
            ) : processedClubs.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: '3rem 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No clubs found matching your search and filter criteria.
                </td>
              </tr>
            ) : (
              processedClubs.map(c => {
                const getPolicyBadge = (policy: MembershipPaymentPolicy) => {
                  switch (policy) {
                    case 'require_payment':
                      return <span className="badge" style={{ background: 'rgba(239, 68, 68, 0.15)', color: 'var(--c-red)' }}>Strict Payment</span>;
                    case 'allow_waiver':
                      return <span className="badge" style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#818CF8' }}>Waiver Allowed</span>;
                    case 'auto_approve':
                    case 'auto_approve_with_waiver':
                      return <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.15)', color: 'var(--c-green)' }}>Auto-Approve</span>;
                    default:
                      return <span className="badge">Standard</span>;
                  }
                };

                const isStatusUpdating = statusUpdatingId === c.id;

                return (
                  <tr
                    key={c.id}
                    style={{
                      borderBottom: '1px solid var(--border-subtle)',
                      transition: 'background 0.15s ease',
                      opacity: c.is_active ? 1 : 0.65,
                    }}
                  >
                    {/* Club Info */}
                    <td style={{ padding: '0.85rem 0.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                        {c.logo_url ? (
                          <img
                            width={28}
                            height={28}
                            src={c.logo_url}
                            alt=""
                            style={{ width: '28px', height: '28px', borderRadius: '4px', objectFit: 'contain' }}
                          />
                        ) : (
                          <div
                            style={{
                              width: '28px',
                              height: '28px',
                              borderRadius: '4px',
                              background: c.primary_color || 'var(--club-primary)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#fff',
                              fontSize: '0.75rem',
                              fontWeight: 800,
                            }}
                          >
                            {c.short_name.slice(0, 2)}
                          </div>
                        )}
                        <div>
                          <div
                            style={{ fontWeight: 800, color: 'var(--text-primary)', cursor: 'pointer' }}
                            onClick={() => onSelectClub(c)}
                            title="Click to inspect club details"
                          >
                            {c.name}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <span>/{c.slug}</span>
                            {c.custom_domain && (
                              <span style={{ color: '#818CF8', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                                <Globe size={10} />
                                <span>{c.custom_domain}</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Owner */}
                    <td style={{ padding: '0.85rem 0.5rem' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{c.owner_name || 'Founder'}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{c.owner_email || '—'}</div>
                    </td>

                    {/* Footprint */}
                    <td style={{ padding: '0.85rem 0.5rem' }}>
                      <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                        {c.member_count} members {c.pending_count > 0 && <span style={{ color: 'var(--c-amber)', fontSize: '0.7rem' }}>({c.pending_count} pending)</span>}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        {c.team_count} teams · {c.match_count} matches
                      </div>
                    </td>

                    {/* Payment Gateway */}
                    <td style={{ padding: '0.85rem 0.5rem' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', alignItems: 'flex-start' }}>
                        {getPolicyBadge(c.membership_payment_policy)}
                        <span style={{ fontSize: '0.68rem', color: c.stripe_ready ? 'var(--c-green)' : 'var(--text-muted)' }}>
                          {c.stripe_ready ? '✓ Stripe Connected' : 'Manual Bank Only'}
                        </span>
                      </div>
                    </td>

                    {/* 30d Traffic */}
                    <td style={{ padding: '0.85rem 0.5rem' }}>
                      <div style={{ fontWeight: 800, color: '#818CF8' }}>{c.visits_30d.toLocaleString()}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>views</div>
                    </td>

                    {/* GMV */}
                    <td style={{ padding: '0.85rem 0.5rem' }}>
                      <div style={{ fontWeight: 800, color: 'var(--c-green)' }}>{formatMoney(c.gmv_cents, 'AUD')}</div>
                    </td>

                    {/* Status */}
                    <td style={{ padding: '0.85rem 0.5rem' }}>
                      {c.is_active ? (
                        <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.15)', color: 'var(--c-green)' }}>Active</span>
                      ) : (
                        <span className="badge" style={{ background: 'rgba(239, 68, 68, 0.15)', color: 'var(--c-red)' }}>Suspended</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '0.85rem 0.5rem', textAlign: 'right' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.35rem' }}>
                        {/* Inspect Drawer button */}
                        <button
                          type="button"
                          onClick={() => onSelectClub(c)}
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}
                          title="Inspect Club Diagnostics"
                        >
                          <Eye size={12} />
                          <span>Inspect</span>
                        </button>

                        {/* Public Site link */}
                        <Link
                          href={`/${c.slug}`}
                          target="_blank"
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}
                          title="Open public website"
                        >
                          <ExternalLink size={12} />
                        </Link>

                        {/* Admin Link */}
                        <Link
                          href={`/${c.slug}/admin`}
                          target="_blank"
                          className="btn btn-primary btn-sm"
                          style={{ padding: '0.25rem 0.55rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}
                          title="Enter Club Admin"
                        >
                          <Shield size={12} />
                          <span>Admin</span>
                        </Link>

                        {/* Quick Toggle Status */}
                        <button
                          type="button"
                          disabled={isStatusUpdating}
                          onClick={() => onToggleStatus(c.id, c.is_active)}
                          className="btn btn-sm"
                          style={{
                            padding: '0.25rem 0.45rem',
                            fontSize: '0.72rem',
                            background: c.is_active ? 'rgba(239, 68, 68, 0.12)' : 'rgba(16, 185, 129, 0.12)',
                            color: c.is_active ? 'var(--c-red)' : 'var(--c-green)',
                            border: '1px solid var(--border-subtle)',
                          }}
                          title={c.is_active ? 'Suspend Club' : 'Reactivate Club'}
                        >
                          {isStatusUpdating ? '...' : c.is_active ? 'Suspend' : 'Reactivate'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
