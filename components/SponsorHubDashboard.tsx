'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Club, Sponsor } from '@/lib/supabase/types';
import { useClub } from '@/lib/club-context';
import {
  Eye, MousePointerClick, Percent, DollarSign, ShieldCheck, Globe2,
  Download, Search, Users2, Clock, Layers, Info,
} from 'lucide-react';

interface SponsorHubDashboardProps {
  club: Club;
  sponsors: Sponsor[];
}

type DateRange = '30d' | 'qtd' | 'custom';

function startOfQuarter(now: Date): Date {
  const q = Math.floor(now.getMonth() / 3) * 3;
  return new Date(now.getFullYear(), q, 1);
}

const PLACEMENT_NAMES: Record<string, string> = {
  footer_marquee: 'Footer Sponsor Bar',
  match_center_marquee: 'Match Center Scroll',
};

const placementLabel = (placements?: string[]) =>
  placements?.length ? placements.map(p => PLACEMENT_NAMES[p] || p).join(' · ') : 'Not seen yet';

const statusColor = (status?: Sponsor['package_status']) =>
  status === 'paid' || status === 'confirmed' ? '#10B981' : status === 'prospect' ? '#F59E0B' : '#EF4444';

const statusLabel = (status?: Sponsor['package_status']) => {
  if (status === 'paid') return 'Paid';
  if (status === 'confirmed') return 'Active';
  if (status === 'prospect') return 'Prospect';
  if (status === 'expired') return 'Expired';
  if (status === 'cancelled') return 'Cancelled';
  return 'Active';
};

export default function SponsorHubDashboard({ club, sponsors }: SponsorHubDashboardProps) {
  const { loadSponsorAnalytics, getSponsorAnalytics } = useClub();
  const [range, setRange] = useState<DateRange>('30d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadSponsorAnalytics(club.id);
  }, [club.id, loadSponsorAnalytics]);

  const clubSponsors = useMemo(
    () => sponsors.filter(s => s.club_id === club.id && s.is_active),
    [sponsors, club.id]
  );

  const { since, until } = useMemo(() => {
    const now = new Date();
    if (range === '30d') return { since: new Date(now.getTime() - 30 * 24 * 3600 * 1000), until: undefined };
    if (range === 'qtd') return { since: startOfQuarter(now), until: undefined };
    return {
      since: customFrom ? new Date(customFrom) : undefined,
      until: customTo ? new Date(new Date(customTo).getTime() + 24 * 3600 * 1000 - 1) : undefined,
    };
  }, [range, customFrom, customTo]);

  const data = getSponsorAnalytics(club.id, { since, until });

  const rows = useMemo(() => {
    return clubSponsors
      .map(sponsor => ({ sponsor, stats: data.bySponsor[sponsor.id] }))
      .filter(r => {
        const q = search.trim().toLowerCase();
        if (q && !r.sponsor.name.toLowerCase().includes(q)) return false;
        return true;
      });
  }, [clubSponsors, data.bySponsor, search]);

  const totalSpend = clubSponsors.reduce((a, s) => a + (s.package_value || 0), 0);
  const ecpm = data.totals.impressions > 0 && totalSpend > 0
    ? totalSpend / (data.totals.impressions / 1000)
    : 0;

  const maxDayImpressions = Math.max(...data.byDay.map(d => d.impressions), 1);

  const kpiCards = [
    { key: 'impr', label: 'Impressions', icon: Eye, value: data.totals.impressions.toLocaleString(), color: '#10B981' },
    { key: 'reach', label: 'Unique Reach', icon: Users2, value: data.totals.uniqueReach.toLocaleString(), color: '#3B82F6' },
    { key: 'clicks', label: 'Clicks & Interactions', icon: MousePointerClick, value: data.totals.clicks.toLocaleString(), color: '#F59E0B' },
    { key: 'ctr', label: 'CTR', icon: Percent, value: `${data.totals.ctr.toFixed(2)}%`, color: '#A855F7' },
    { key: 'viewability', label: 'Viewability Rate', icon: ShieldCheck, value: `${data.totals.viewabilityRate.toFixed(1)}%`, color: '#22D3EE' },
    { key: 'ecpm', label: 'eCPM', icon: DollarSign, value: ecpm > 0 ? `$${ecpm.toFixed(2)}` : '—', color: '#EF4444' },
  ];

  const handleExportCsv = () => {
    const header = ['Creative / Slot', 'Placement', 'Impressions', 'Viewable Impressions', 'Viewability %', 'Clicks', 'CTR %', 'Avg. Time in View (s)', 'Status'];
    const lines = rows.map(({ sponsor, stats }) => [
      sponsor.name,
      `"${placementLabel(stats?.placements)}"`,
      stats?.impressions || 0,
      stats?.viewableImpressions || 0,
      (stats?.viewabilityRate || 0).toFixed(2),
      stats?.clicks || 0,
      (stats?.ctr || 0).toFixed(2),
      ((stats?.avgDwellMs || 0) / 1000).toFixed(1),
      statusLabel(sponsor.package_status),
    ].join(','));
    const csv = [header.join(','), ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${club.slug}-sponsor-performance.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      {/* Header toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.75rem' }}>
        <div>
          <span className="badge badge-primary" style={{ marginBottom: '0.4rem' }}>SPONSOR HUB &middot; MEDIA KIT VIEW</span>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 900, color: '#FFFFFF' }}>Advertiser & Sponsor Performance</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            Delivery, engagement, and audience reporting for every sponsor placement on {club.name}&apos;s site.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          {range === 'custom' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} style={{ padding: '0.4rem 0.5rem', borderRadius: '7px', border: '1px solid var(--border-subtle)', background: 'rgba(255,255,255,0.03)', color: '#FFFFFF', fontSize: '0.75rem' }} />
              <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>to</span>
              <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} style={{ padding: '0.4rem 0.5rem', borderRadius: '7px', border: '1px solid var(--border-subtle)', background: 'rgba(255,255,255,0.03)', color: '#FFFFFF', fontSize: '0.75rem' }} />
            </div>
          )}
          <div style={{ display: 'flex', gap: '0.5rem', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-subtle)', borderRadius: '10px', padding: '0.3rem' }}>
            {([['30d', 'Last 30 Days'], ['qtd', 'Quarter-to-date'], ['custom', 'Custom Campaign']] as [DateRange, string][]).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setRange(key)}
                style={{
                  padding: '0.45rem 0.8rem', borderRadius: '7px', border: 'none', cursor: 'pointer',
                  fontSize: '0.78rem', fontWeight: 700,
                  background: range === key ? 'var(--club-primary)' : 'transparent',
                  color: range === key ? '#04120b' : 'var(--text-secondary)',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {clubSponsors.length === 0 ? (
        <div className="glass-panel" style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-secondary)', marginBottom: '2rem' }}>
          No active sponsors yet — add one from the Sponsors admin page to see delivery, viewability, and audience reporting here.
        </div>
      ) : !data.hasAnyData ? (
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: '0.6rem', padding: '1.25rem',
          borderRadius: '10px', border: '1px solid rgba(59, 130, 246, 0.35)', background: 'rgba(59, 130, 246, 0.08)',
          marginBottom: '2rem', fontSize: '0.82rem', color: '#93C5FD',
        }}>
          <Info size={16} style={{ flexShrink: 0, marginTop: '0.1rem' }} />
          <span>
            No sponsor placement data recorded yet for this range. Impressions and clicks are tracked automatically
            whenever a visitor sees or clicks a sponsor logo in the site footer — figures will populate as real traffic comes in.
          </span>
        </div>
      ) : null}

      {clubSponsors.length > 0 && (
        <>
          {/* KPI Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 190px), 1fr))', gap: '1.25rem', marginBottom: '2.5rem' }}>
            {kpiCards.map(card => {
              const Icon = card.icon;
              return (
                <div key={card.key} className="glass-panel" style={{ padding: '1.4rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.04em' }}>{card.label.toUpperCase()}</span>
                    <Icon size={16} color={card.color} />
                  </div>
                  <div style={{ fontFamily: 'var(--font-heading)', fontSize: '1.6rem', fontWeight: 900, color: '#FFFFFF' }}>{card.value}</div>
                </div>
              );
            })}
          </div>

          {/* Placement performance + engagement depth */}
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.6fr) minmax(0, 1fr)', gap: '1.5rem', marginBottom: '2.5rem' }}>
            <div className="glass-panel" style={{ padding: '1.75rem' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#FFFFFF', marginBottom: '0.25rem' }}>Placement Performance</h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>Impressions and clicks over the last 7 days, recorded live from every sponsor placement on the site.</p>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.75rem', height: '180px' }}>
                {data.byDay.map(d => {
                  const heightPct = Math.max(4, Math.round((d.impressions / maxDayImpressions) * 100));
                  return (
                    <div
                      key={d.day}
                      title={`${d.impressions.toLocaleString()} impressions · ${d.clicks.toLocaleString()} clicks`}
                      style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end', cursor: 'default' }}
                    >
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>{d.clicks > 0 ? `${d.clicks} clicks` : ''}</span>
                      <div style={{
                        width: '100%', maxWidth: '34px', height: `${heightPct}%`,
                        background: 'linear-gradient(180deg, var(--club-primary), rgba(16,185,129,0.35))',
                        borderRadius: '5px 5px 0 0',
                      }} />
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>{d.day}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '1.75rem' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#FFFFFF', marginBottom: '1.25rem' }}>Engagement</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.5rem' }}>
                <Clock size={18} color="var(--club-primary)" />
                <div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#FFFFFF' }}>
                    {(() => {
                      const dwells = Object.values(data.bySponsor).map(s => s.avgDwellMs).filter(v => v > 0);
                      const avg = dwells.length ? dwells.reduce((a, b) => a + b, 0) / dwells.length : 0;
                      return avg > 0 ? `${(avg / 1000).toFixed(1)}s` : '—';
                    })()}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Avg. active time in view</div>
                </div>
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '0.3rem' }}>
                  <span style={{ color: '#FFFFFF' }}>Repeat exposure rate</span>
                  <span style={{ color: 'var(--text-muted)', fontWeight: 700 }}>{data.totals.repeatExposureRate.toFixed(0)}%</span>
                </div>
                <div style={{ height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden', marginBottom: '0.4rem' }}>
                  <div style={{ width: `${data.totals.repeatExposureRate}%`, height: '100%', background: '#3B82F6' }} />
                </div>
                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Share of unique visitors who saw a placement more than once.</p>
              </div>
            </div>
          </div>

          {/* Sponsor data table */}
          <div className="glass-panel" style={{ padding: '1.75rem', marginBottom: '2.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#FFFFFF' }}>
                <Layers size={16} style={{ marginRight: '0.4rem', verticalAlign: '-2px' }} />
                Sponsor Asset Delivery
              </h3>
              <div style={{ position: 'relative' }}>
                <Search size={13} style={{ position: 'absolute', left: '0.6rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search sponsor..."
                  style={{ padding: '0.4rem 0.7rem 0.4rem 1.8rem', borderRadius: '7px', border: '1px solid var(--border-subtle)', background: 'rgba(255,255,255,0.03)', color: '#FFFFFF', fontSize: '0.78rem' }}
                />
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', minWidth: '700px' }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: 'var(--text-muted)', fontSize: '0.68rem', letterSpacing: '0.04em' }}>
                    <th style={{ padding: '0.5rem 0.6rem' }}>CREATIVE / SLOT</th>
                    <th style={{ padding: '0.5rem 0.6rem' }}>IMPRESSIONS</th>
                    <th style={{ padding: '0.5rem 0.6rem' }}>VIEWABLE</th>
                    <th style={{ padding: '0.5rem 0.6rem' }}>CLICKS</th>
                    <th style={{ padding: '0.5rem 0.6rem' }}>CTR</th>
                    <th style={{ padding: '0.5rem 0.6rem' }}>AVG. TIME IN VIEW</th>
                    <th style={{ padding: '0.5rem 0.6rem' }}>STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ sponsor, stats }) => (
                    <tr key={sponsor.id} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '0.65rem 0.6rem', fontWeight: 700, color: '#FFFFFF' }}>
                        {sponsor.name}
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 500 }}>{placementLabel(stats?.placements)}</div>
                      </td>
                      <td style={{ padding: '0.65rem 0.6rem', color: 'var(--text-secondary)' }}>{(stats?.impressions || 0).toLocaleString()}</td>
                      <td style={{ padding: '0.65rem 0.6rem', color: 'var(--text-secondary)' }}>
                        {(stats?.viewableImpressions || 0).toLocaleString()} <span style={{ color: 'var(--text-muted)' }}>({(stats?.viewabilityRate || 0).toFixed(0)}%)</span>
                      </td>
                      <td style={{ padding: '0.65rem 0.6rem', color: 'var(--text-secondary)' }}>{(stats?.clicks || 0).toLocaleString()}</td>
                      <td style={{ padding: '0.65rem 0.6rem', color: 'var(--text-secondary)' }}>{(stats?.ctr || 0).toFixed(2)}%</td>
                      <td style={{ padding: '0.65rem 0.6rem', color: 'var(--text-secondary)' }}>{stats?.avgDwellMs ? `${(stats.avgDwellMs / 1000).toFixed(1)}s` : '—'}</td>
                      <td style={{ padding: '0.65rem 0.6rem' }}>
                        <span className="badge" style={{ background: `${statusColor(sponsor.package_status)}22`, color: statusColor(sponsor.package_status), border: `1px solid ${statusColor(sponsor.package_status)}55` }}>
                          {statusLabel(sponsor.package_status)}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr><td colSpan={7} style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>No sponsors match this search.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Demographics & export */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: '2rem', marginBottom: '1.5rem' }}>
            <div className="glass-panel" style={{ padding: '1.75rem' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#FFFFFF', marginBottom: '1.1rem' }}>
                <Globe2 size={16} style={{ marginRight: '0.4rem', verticalAlign: '-2px' }} />
                Top Countries
              </h3>
              {data.byCountry.length === 0 ? (
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>No geo data recorded yet for this range.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                  {data.byCountry.map(c => {
                    const max = data.byCountry[0]?.count || 1;
                    const pct = Math.round((c.count / max) * 100);
                    return (
                      <div key={c.country}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.3rem' }}>
                          <span style={{ color: '#FFFFFF' }}>{c.country}</span>
                          <span style={{ color: 'var(--text-muted)', fontWeight: 700 }}>{c.count.toLocaleString()}</span>
                        </div>
                        <div style={{ height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: 'var(--club-primary)' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="glass-panel" style={{ padding: '1.75rem' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#FFFFFF', marginBottom: '1.1rem' }}>Device Breakdown</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
                {data.byDevice.map(dev => (
                  <div key={dev.name}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '0.3rem' }}>
                      <span style={{ color: '#FFFFFF' }}>{dev.name}</span>
                      <span style={{ color: dev.color, fontWeight: 700 }}>{dev.percentage}</span>
                    </div>
                    <div style={{ height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ width: dev.percentage, height: '100%', background: dev.color }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#FFFFFF', marginBottom: '0.6rem' }}>Export</h3>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
                  Download real, measured delivery numbers for this range.
                </p>
              </div>
              <button type="button" onClick={handleExportCsv} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', fontSize: '0.8rem' }}>
                <Download size={14} /> Export Sponsor Performance Report (CSV)
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
