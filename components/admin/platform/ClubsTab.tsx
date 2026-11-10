'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { PlatformClubItem } from '@/lib/supabase/types';
import { toCsv } from '@/lib/finance';
import { timeAgo } from '@/lib/mission-control';
import { Crest } from '@/components/admin/platform/McArt';
import { Search, Download, ExternalLink, Shield } from 'lucide-react';

interface ClubsTabProps {
  clubs: PlatformClubItem[];
  loading: boolean;
  onSelectClub: (club: PlatformClubItem) => void;
}

/** How many rows the table draws at a time */
const PAGE = 100;

export default function ClubsTab({
  clubs,
  loading,
  onSelectClub,
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
  const sideRows: { key: typeof quickFilter; label: string; count: number }[] = [
    { key: 'backlog', label: 'Approval backlog (5+)', count: counts.backlog },
    { key: 'nostripe', label: 'Must pay, no Stripe', count: counts.nostripe },
    { key: 'stripe', label: 'Stripe connected', count: counts.stripe },
    { key: 'domain', label: 'Own web address', count: counts.domain },
  ];

  const [shownCount, setShownCount] = useState(PAGE);
  const visible = processedClubs.slice(0, shownCount);
  const chips: { key: typeof quickFilter | 'suspended'; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: clubs.length },
    ...sideRows.map(r => ({ key: r.key, label: r.label, count: r.count })),
    { key: 'suspended', label: 'Suspended', count: counts.suspended },
  ];
  const chipOn = (k: string) => (k === 'suspended' ? statusFilter === 'inactive' : statusFilter !== 'inactive' && quickFilter === k);
  const pickChip = (k: string) => {
    setShownCount(PAGE);
    if (k === 'suspended') { setQuickFilter('all'); setStatusFilter(statusFilter === 'inactive' ? 'all' : 'inactive'); return; }
    setStatusFilter('all');
    setQuickFilter(k as typeof quickFilter);
  };

  return (
    <div>
      <div className="mc-page-h">
        <div>
          <h1>Clubs</h1>
          <p>{loading ? 'Loading clubs…' : `${clubs.length.toLocaleString('en-AU')} ${clubs.length === 1 ? 'club' : 'clubs'}. ${attentionTotal ? `${attentionTotal} need a look. ` : ''}Open one to see everything about it.`}</p>
        </div>
        <div className="right">
          <button type="button" className="mc-pill-btn ghost" onClick={handleExportCsv} title="Download the clubs list as a spreadsheet">
            <Download size={14} /> Download CSV
          </button>
        </div>
      </div>

      <section className="mc-card">
        <div className="mc-toolbar">
          <label className="mc-search grow">
            <Search size={15} aria-hidden="true" />
            <input
              type="text"
              placeholder="Search club, web address or owner"
              aria-label="Search clubs"
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setShownCount(PAGE); }}
            />
          </label>
          <select className="mc-select" value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)} aria-label="Sort clubs">
            <option value="newest">Newest first</option>
            <option value="visits">Most visits (30 days)</option>
            <option value="members">Most members</option>
            <option value="gmv">Most money in</option>
          </select>
        </div>
        <div className="mc-chips" role="group" aria-label="Show">
          {chips.filter(c => c.key === 'all' || c.count > 0).map(c => (
            <button key={c.key} type="button" className="mc-chip" aria-pressed={chipOn(c.key)} onClick={() => pickChip(c.key)}>{c.label} <span className="num">{c.count}</span></button>
          ))}
        </div>

        {loading && clubs.length === 0 ? (
          <div className="mc-empty">Loading clubs…</div>
        ) : processedClubs.length === 0 ? (
          <div className="mc-empty">No clubs match that search or filter.</div>
        ) : (
          <div className="mc-table-wrap">
            <table className="mc-table mc-clubs">
              <thead>
                <tr>
                  <th>Club</th>
                  <th className="r">Members</th>
                  <th className="r hide-phone">Waiting</th>
                  <th className="hide-phone">Card payments</th>
                  <th className="r hide-phone">Visits, 30 days</th>
                  <th className="hide-phone">Admin last in</th>
                  <th className="hide-phone"><span className="sr-only">Links</span></th>
                </tr>
              </thead>
              <tbody>
                {visible.map(c => (
                  <tr key={c.id} className={c.is_active ? '' : 'dim'}>
                    <td>
                      <button type="button" className="mc-club-cell" onClick={() => onSelectClub(c)}>
                        <Crest logoUrl={c.logo_url} label={c.short_name} color={c.primary_color} />
                        <span><b>{c.name}</b><small>/{c.slug}{c.is_active ? '' : c.closed_at ? ', closing' : ', suspended'}</small></span>
                      </button>
                    </td>
                    <td className="r num">{c.member_count.toLocaleString('en-AU')}</td>
                    <td className="r num hide-phone">{c.pending_count > 0 ? <span className="mc-flag warn">{c.pending_count}</span> : 0}</td>
                    <td className="hide-phone">
                      {c.stripe_ready
                        ? <span className="mc-flag ok">Connected</span>
                        : c.membership_payment_policy === 'require_payment'
                          ? <span className="mc-flag bad">Must pay, no Stripe</span>
                          : <span className="mc-flag">Not connected</span>}
                    </td>
                    <td className="r num hide-phone">{c.visits_30d.toLocaleString('en-AU')}</td>
                    <td className="hide-phone">{c.admin_last_seen_at ? timeAgo(c.admin_last_seen_at) : 'Never'}</td>
                    <td className="hide-phone">
                      <span className="mc-row-links">
                        <Link href={`/${c.slug}/admin`} target="_blank" className="mc-icon-btn" aria-label={`Open ${c.name} club admin`} title="Club admin"><Shield size={13} /></Link>
                        <Link href={`/${c.slug}`} target="_blank" className="mc-icon-btn" aria-label={`Open ${c.name} website`} title="Club website"><ExternalLink size={13} /></Link>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {processedClubs.length > 0 && (
          <div className="mc-more">
            <span>Showing {visible.length.toLocaleString('en-AU')} of {processedClubs.length.toLocaleString('en-AU')} {processedClubs.length === 1 ? 'club' : 'clubs'}</span>
            {visible.length < processedClubs.length && (
              <button type="button" className="mc-pill-btn ghost" onClick={() => setShownCount(n => n + PAGE)}>
                Show {Math.min(PAGE, processedClubs.length - visible.length)} more
              </button>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
