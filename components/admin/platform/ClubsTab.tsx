'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { PlatformClubItem, MembershipPaymentPolicy } from '@/lib/supabase/types';
import { formatMoney, toCsv } from '@/lib/finance';
import { softTint } from '@/lib/mission-control';
import { Crest } from '@/components/admin/platform/McArt';
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
  Clock,
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
  const [quickFilter, setQuickFilter] = useState<'all' | 'stripe' | 'domain' | 'backlog' | 'nostripe'>('all');
  const [sortBy, setSortBy] = useState<'visits' | 'members' | 'gmv' | 'newest'>('newest');

  // Filtered and sorted clubs
  const processedClubs = useMemo(() => {
    let list = clubs.filter(c => {
      if (statusFilter === 'active' && !c.is_active) return false;
      if (statusFilter === 'inactive' && c.is_active) return false;

      if (quickFilter === 'stripe' && !c.stripe_ready) return false;
      if (quickFilter === 'domain' && !c.custom_domain) return false;
      if (quickFilter === 'backlog' && c.pending_count < 5) return false;
      if (quickFilter === 'nostripe' && !(c.membership_payment_policy === 'require_payment' && !c.stripe_ready)) return false;

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

  const counts = {
    backlog: clubs.filter(c => c.pending_count >= 5).length,
    nostripe: clubs.filter(c => c.membership_payment_policy === 'require_payment' && !c.stripe_ready).length,
    domain: clubs.filter(c => c.custom_domain).length,
    stripe: clubs.filter(c => c.stripe_ready).length,
    suspended: clubs.filter(c => !c.is_active).length,
  };
  const attentionTotal = counts.backlog + counts.nostripe;
  const maxCount = Math.max(1, ...Object.values(counts));

  const policyFlag = (policy: MembershipPaymentPolicy) => {
    switch (policy) {
      case 'require_payment':
        return <span className="mc-flag bad">Must pay to join</span>;
      case 'allow_waiver':
        return <span className="mc-flag info">Fee can be waived</span>;
      case 'auto_approve':
      case 'auto_approve_with_waiver':
        return <span className="mc-flag ok">Auto-approve</span>;
      default:
        return <span className="mc-flag">Standard</span>;
    }
  };

  const sideRows: { key: typeof quickFilter; label: string; count: number; icon: React.ElementType; bg: string; color: string; bar: string }[] = [
    { key: 'backlog', label: 'Approval backlog (5+)', count: counts.backlog, icon: Clock, bg: 'var(--mc-amber-bg)', color: 'var(--mc-amber)', bar: '#F59E0B' },
    { key: 'nostripe', label: 'Must pay, no Stripe', count: counts.nostripe, icon: AlertTriangle, bg: 'var(--mc-red-bg)', color: 'var(--mc-red)', bar: '#EF4444' },
    { key: 'domain', label: 'Own web address', count: counts.domain, icon: Globe, bg: 'var(--mc-lilac)', color: 'var(--mc-indigo)', bar: '#818CF8' },
    { key: 'stripe', label: 'Stripe connected', count: counts.stripe, icon: CreditCard, bg: 'var(--mc-mint)', color: 'var(--mc-green-ink)', bar: '#10B981' },
  ];

  return (
    <div>
      <div className="mc-page-h">
        <div>
          <h1>Clubs</h1>
          <p>Every club on itsfootball.club. Click a club to open its details.</p>
        </div>
        <div className="right">
          <span className="mc-seg" role="group" aria-label="Status">
            {([['all', 'All'], ['active', 'Active'], ['inactive', 'Suspended']] as const).map(([k, label]) => (
              <button key={k} type="button" aria-pressed={statusFilter === k} onClick={() => setStatusFilter(k)}>{label}</button>
            ))}
          </span>
          <button type="button" className="mc-pill-btn" onClick={handleExportCsv} title="Download the clubs list as a spreadsheet">
            <Download size={14} /> Export CSV
          </button>
        </div>
      </div>

      <div className="mc-wrap">
        <div>
          <div className="mc-toolbar">
            <label className="mc-search">
              <Search size={15} aria-hidden="true" />
              <input
                type="text"
                placeholder="Search club, web address or owner"
                aria-label="Search clubs"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </label>
            <select className="mc-select" value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)} aria-label="Sort clubs">
              <option value="newest">Newest first</option>
              <option value="visits">Most visits (30 days)</option>
              <option value="members">Most members</option>
              <option value="gmv">Most money in</option>
            </select>
            <span className="mc-eyebrow num">{processedClubs.length} shown</span>
          </div>

          {loading ? (
            <div className="mc-card mc-empty">Loading clubs…</div>
          ) : processedClubs.length === 0 ? (
            <div className="mc-card mc-empty">No clubs match that search or filter.</div>
          ) : (
            <div className="mc-grid">
              {processedClubs.map(c => {
                const isStatusUpdating = statusUpdatingId === c.id;
                return (
                  <div key={c.id} className={`mc-card mc-gcard mc-lift${c.is_active ? '' : ' dim'}`}>
                    <button type="button" className="top" style={{ background: softTint(c.primary_color, 0.28) }} onClick={() => onSelectClub(c)} aria-label={`Open ${c.name}`}>
                      <span className={`st${c.is_active ? '' : ' off'}`}>{c.is_active ? 'Active' : 'Suspended'}</span>
                      <Crest logoUrl={c.logo_url} label={c.short_name} color={c.primary_color} />
                    </button>
                    <h3><button type="button" onClick={() => onSelectClub(c)}>{c.name}</button></h3>
                    <div className="meta num">
                      {c.member_count} members{c.pending_count > 0 && <span style={{ color: 'var(--mc-amber)' }}> · {c.pending_count} waiting</span>}
                      {' · '}{c.team_count} teams · {c.match_count} matches
                    </div>
                    <div className="meta">
                      {c.owner_name || 'Founder'}{c.owner_email ? ` · ${c.owner_email}` : ''}
                    </div>
                    <div className="meta num" style={{ marginTop: 4 }}>
                      <Eye size={11} style={{ verticalAlign: '-1px' }} /> {c.visits_30d.toLocaleString()} views · <span style={{ color: 'var(--mc-green-ink)' }}>{formatMoney(c.gmv_cents, 'AUD')}</span>
                    </div>
                    <div className="flags">
                      {policyFlag(c.membership_payment_policy)}
                      <span className={`mc-flag${c.stripe_ready ? ' ok' : ''}`}>{c.stripe_ready ? 'Stripe' : 'Bank transfer only'}</span>
                      {c.custom_domain && <span className="mc-flag info"><Globe size={10} />{c.custom_domain}</span>}
                    </div>
                    <div className="acts">
                      <button type="button" className="mc-icon-btn" onClick={() => onSelectClub(c)} aria-label={`${c.name} details`} title="See club details">
                        <Sliders size={13} />
                      </button>
                      <Link href={`/${c.slug}/admin`} target="_blank" className="mc-pill-btn" title="Open the club admin">
                        <Shield size={12} /> Admin
                      </Link>
                      <Link href={`/${c.slug}`} target="_blank" className="mc-icon-btn" aria-label={`Open ${c.name} website`} title="Open the club website">
                        <ExternalLink size={13} />
                      </Link>
                      <button
                        type="button"
                        disabled={isStatusUpdating}
                        onClick={() => onToggleStatus(c.id, c.is_active)}
                        className={`mc-icon-btn`}
                        style={{ color: c.is_active ? 'var(--mc-red)' : 'var(--mc-green-ink)' }}
                        aria-label={c.is_active ? `Suspend ${c.name}` : `Reactivate ${c.name}`}
                        title={c.is_active ? 'Suspend club' : 'Reactivate club'}
                      >
                        {isStatusUpdating ? '…' : c.is_active ? <XCircle size={14} /> : <CheckCircle2 size={14} />}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="mc-card">
          <div className="mc-card-h">
            <h3>Needs attention</h3>
            {quickFilter !== 'all' && (
              <button type="button" className="mc-pill-btn ghost" style={{ padding: '4px 10px', fontSize: 11 }} onClick={() => setQuickFilter('all')}>Show all</button>
            )}
          </div>
          <div className="mc-coll">
            {sideRows.map(r => {
              const Icon = r.icon;
              return (
                <button key={r.key} type="button" className="mc-coll-row" aria-pressed={quickFilter === r.key} onClick={() => setQuickFilter(quickFilter === r.key ? 'all' : r.key)}>
                  <span className="mc-sq" style={{ background: r.bg, color: r.color }}><Icon size={14} /></span>
                  <div>
                    <b>{r.label}</b>
                    <div className="mc-track"><span style={{ width: `${Math.round((r.count / maxCount) * 100)}%`, background: r.bar }} /></div>
                  </div>
                  <em className="num">{r.count} {r.count === 1 ? 'club' : 'clubs'}</em>
                </button>
              );
            })}
            <button type="button" className="mc-coll-row" aria-pressed={statusFilter === 'inactive'} onClick={() => setStatusFilter(statusFilter === 'inactive' ? 'all' : 'inactive')}>
              <span className="mc-sq" style={{ background: 'var(--mc-bar)', color: 'var(--mc-ink-2)' }}><Building size={14} /></span>
              <div>
                <b>Suspended</b>
                <div className="mc-track"><span style={{ width: `${Math.round((counts.suspended / maxCount) * 100)}%`, background: 'var(--mc-ink-3)' }} /></div>
              </div>
              <em className="num">{counts.suspended} {counts.suspended === 1 ? 'club' : 'clubs'}</em>
            </button>
          </div>
          <div className="mc-coll-total">
            <b className="num">{attentionTotal}</b>
            <small>{attentionTotal === 1 ? 'club needs' : 'clubs need'} a look right now</small>
          </div>
        </div>
      </div>
    </div>
  );
}
