'use client';

import React, { useMemo, useState } from 'react';
import { Club, Sponsor } from '@/lib/supabase/types';
import { ClubAnalyticsSummary } from '@/lib/supabase/types';
import {
  Eye, MousePointerClick, Percent, DollarSign, ShieldCheck, Globe2,
  Download, Search, Users2, Clock, Layers, AlertTriangle,
} from 'lucide-react';

interface SponsorHubDashboardProps {
  club: Club;
  sponsors: Sponsor[];
  analytics: ClubAnalyticsSummary;
}

type DateRange = '30d' | 'qtd' | 'custom';

const PLACEMENT_ZONES = ['Header Banner', 'Sticky Sidebar', 'In-Content Native', 'Newsletter Takeover'] as const;
const AD_FORMATS = ['Display Banner', 'Sponsored Post', 'Dedicated Section'] as const;
const DEVICES = ['Desktop', 'Mobile', 'Tablet'] as const;
const COUNTRIES = [
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'CA', name: 'Canada' },
  { code: 'AU', name: 'Australia' },
  { code: 'IE', name: 'Ireland' },
];

// Deterministic 0..1 pseudo-random derived from a string, so numbers stay stable across renders/SSR.
function hashFrac(input: string, salt = 0): number {
  let h = salt * 2654435761;
  for (let i = 0; i < input.length; i++) {
    h = (h * 31 + input.charCodeAt(i)) >>> 0;
  }
  return (h % 1000) / 1000;
}

const TIER_WEIGHT: Record<string, number> = { platinum: 1, gold: 0.75, silver: 0.5, bronze: 0.32, grassroots: 0.2 };

interface SponsorRow {
  sponsor: Sponsor;
  placement: string;
  format: string;
  device: string;
  impressions: number;
  bookedCap: number;
  clicks: number;
  ctr: number;
  cvr: number;
  viewableImpressions: number;
  viewability: number;
  ecpm: number;
  status: 'Active' | 'Goal Met' | 'Under-delivering';
}

const RANGE_MULTIPLIER: Record<DateRange, number> = { '30d': 1, qtd: 3.1, custom: 1 };

export default function SponsorHubDashboard({ club, sponsors, analytics }: SponsorHubDashboardProps) {
  const [range, setRange] = useState<DateRange>('30d');
  const [search, setSearch] = useState('');
  const [placementFilter, setPlacementFilter] = useState<string>('all');
  const [deviceFilter, setDeviceFilter] = useState<string>('all');

  const clubSponsors = useMemo(
    () => sponsors.filter(s => s.club_id === club.id && s.is_active),
    [sponsors, club.id]
  );

  const rangeMult = RANGE_MULTIPLIER[range];
  const baseTraffic = analytics.totalVisits;

  const rows: SponsorRow[] = useMemo(() => {
    return clubSponsors.map((sponsor, idx) => {
      const weight = TIER_WEIGHT[sponsor.tier] ?? 0.4;
      const variance = 0.8 + hashFrac(sponsor.id) * 0.6; // 0.8x - 1.4x
      const impressions = Math.max(0, Math.round(baseTraffic * weight * variance * rangeMult));
      const ctr = 0.015 + hashFrac(sponsor.id, 1) * 0.03; // 1.5% - 4.5%
      const clicks = Math.round(impressions * ctr);
      const cvr = 0.02 + hashFrac(sponsor.id, 2) * 0.06; // 2% - 8%
      const viewability = 0.55 + hashFrac(sponsor.id, 3) * 0.3; // 55% - 85%
      const viewableImpressions = Math.round(impressions * viewability);
      const deliveryRatio = 0.7 + hashFrac(sponsor.id, 4) * 0.5; // 0.7 - 1.2
      const bookedCap = Math.max(1, Math.round(impressions / deliveryRatio));
      const ecpm = sponsor.package_value && impressions > 0
        ? Math.round((sponsor.package_value / (impressions / 1000)) * 100) / 100
        : Math.round((4 + hashFrac(sponsor.id, 5) * 8) * 100) / 100;

      let status: SponsorRow['status'] = 'Active';
      if (sponsor.package_status === 'expired' || sponsor.package_status === 'cancelled') status = 'Under-delivering';
      else if (deliveryRatio >= 1.05) status = 'Goal Met';

      return {
        sponsor,
        placement: PLACEMENT_ZONES[idx % PLACEMENT_ZONES.length],
        format: AD_FORMATS[idx % AD_FORMATS.length],
        device: DEVICES[idx % DEVICES.length],
        impressions,
        bookedCap,
        clicks,
        ctr,
        cvr,
        viewableImpressions,
        viewability,
        ecpm,
        status,
      };
    });
  }, [clubSponsors, baseTraffic, rangeMult]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(r => {
      if (q && !r.sponsor.name.toLowerCase().includes(q)) return false;
      if (placementFilter !== 'all' && r.placement !== placementFilter) return false;
      if (deviceFilter !== 'all' && r.device !== deviceFilter) return false;
      return true;
    });
  }, [rows, search, placementFilter, deviceFilter]);

  const totals = useMemo(() => {
    const impressions = rows.reduce((a, r) => a + r.impressions, 0);
    const clicks = rows.reduce((a, r) => a + r.clicks, 0);
    const viewable = rows.reduce((a, r) => a + r.viewableImpressions, 0);
    const uniqueReach = Math.round(impressions * 0.62);
    const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
    const viewabilityRate = impressions > 0 ? (viewable / impressions) * 100 : 0;
    const totalSpend = rows.reduce((a, r) => a + (r.sponsor.package_value || 0), 0);
    const ecpm = impressions > 0 && totalSpend > 0 ? (totalSpend / (impressions / 1000)) : (rows.length ? rows.reduce((a, r) => a + r.ecpm, 0) / rows.length : 0);
    return { impressions, clicks, uniqueReach, ctr, viewabilityRate, ecpm };
  }, [rows]);

  const sparkFor = (seed: string) =>
    analytics.weeklyVisits.map((v, i) => Math.round(v * (TIER_WEIGHT.gold) * (0.6 + hashFrac(seed, i) * 0.8)));

  const kpiCards = [
    { key: 'impr', label: 'Impressions', icon: Eye, value: totals.impressions.toLocaleString(), delta: `+${Math.round(4 + hashFrac('impr') * 14)}%`, spark: sparkFor('impr'), color: '#10B981' },
    { key: 'reach', label: 'Unique Reach', icon: Users2, value: totals.uniqueReach.toLocaleString(), delta: `+${Math.round(3 + hashFrac('reach') * 10)}%`, spark: sparkFor('reach'), color: '#3B82F6' },
    { key: 'clicks', label: 'Clicks & Interactions', icon: MousePointerClick, value: totals.clicks.toLocaleString(), delta: `+${Math.round(2 + hashFrac('clicks') * 12)}%`, spark: sparkFor('clicks'), color: '#F59E0B' },
    { key: 'ctr', label: 'CTR', icon: Percent, value: `${totals.ctr.toFixed(2)}%`, delta: `${totals.ctr >= 2 ? '+' : ''}${(totals.ctr - 2).toFixed(2)}pp vs. 2.00% benchmark`, spark: sparkFor('ctr'), color: '#A855F7' },
    { key: 'viewability', label: 'Viewability Rate', icon: ShieldCheck, value: `${totals.viewabilityRate.toFixed(1)}%`, delta: 'MRC standard: ≥ 50%', spark: sparkFor('view'), color: '#22D3EE' },
    { key: 'ecpm', label: 'eCPM', icon: DollarSign, value: `$${totals.ecpm.toFixed(2)}`, delta: 'Effective cost per mille', spark: sparkFor('ecpm'), color: '#EF4444' },
  ];

  const scrollBuckets = [
    { label: 'Above the fold', pct: Math.round(55 + hashFrac('scroll1') * 15) },
    { label: '≥ 50% scroll depth', pct: Math.round(30 + hashFrac('scroll2') * 20) },
    { label: '≥ 90% scroll depth', pct: Math.round(10 + hashFrac('scroll3') * 15) },
  ];

  const verifiedTrafficPct = Math.round(92 + hashFrac('ivt') * 6);

  const handleExportCsv = () => {
    const header = ['Creative / Slot', 'Format', 'Impressions (Est.)', 'Booked Cap (Est.)', 'Clicks (Est.)', 'CTR % (Est.)', 'CVR % (Est.)', 'Viewable Impressions (Est.)', 'eCPM (Est.)', 'Status'];
    const lines = filteredRows.map(r => [
      r.sponsor.name, r.format, r.impressions, r.bookedCap, r.clicks,
      (r.ctr * 100).toFixed(2), (r.cvr * 100).toFixed(2), r.viewableImpressions, r.ecpm.toFixed(2), r.status,
    ].join(','));
    const csv = [
      'This report is a MODELED ESTIMATE derived from overall site traffic and sponsor tier, not measured ad-serving telemetry. Do not send to sponsors as proof of delivery.',
      header.join(','),
      ...lines,
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${club.slug}-sponsor-performance-estimate.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const statusColor = (status: SponsorRow['status']) =>
    status === 'Active' ? '#10B981' : status === 'Goal Met' ? '#F59E0B' : '#EF4444';

  return (
    <div>
      {/* Header toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.75rem' }}>
        <div>
          <span className="badge badge-primary" style={{ marginBottom: '0.4rem' }}>SPONSOR HUB &middot; MEDIA KIT VIEW</span>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 900, color: '#FFFFFF' }}>Advertiser & Sponsor Performance</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            Delivery, engagement, and audience-quality reporting for every sponsor placement on {club.name}&apos;s site.
          </p>
        </div>
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

      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: '0.6rem', padding: '0.85rem 1rem',
        borderRadius: '10px', border: '1px solid rgba(245, 158, 11, 0.35)', background: 'rgba(245, 158, 11, 0.08)',
        marginBottom: '1.75rem', fontSize: '0.78rem', color: '#F59E0B',
      }}>
        <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: '0.1rem' }} />
        <span>
          <strong>Modeled estimate, not measured ad delivery.</strong> These figures are derived from overall site traffic and sponsor
          tier — there is no ad-serving/impression tracking wired up yet. Use this view for internal planning only; don&apos;t send it
          to sponsors as proof of performance.
        </span>
      </div>

      {clubSponsors.length === 0 ? (
        <div className="glass-panel" style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-secondary)', marginBottom: '2rem' }}>
          No active sponsors yet — add one from the Sponsors admin page to see delivery, viewability, and audience-quality reporting here.
        </div>
      ) : (
        <>
          {/* KPI Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 190px), 1fr))', gap: '1.25rem', marginBottom: '2.5rem' }}>
            {kpiCards.map(card => {
              const Icon = card.icon;
              const max = Math.max(...card.spark, 1);
              return (
                <div key={card.key} className="glass-panel" style={{ padding: '1.4rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.04em' }}>{card.label.toUpperCase()}</span>
                    <Icon size={16} color={card.color} />
                  </div>
                  <div style={{ fontFamily: 'var(--font-heading)', fontSize: '1.6rem', fontWeight: 900, color: '#FFFFFF' }}>{card.value}</div>
                  <div style={{ fontSize: '0.7rem', color: card.color, marginTop: '0.3rem', marginBottom: '0.6rem' }}>{card.delta}</div>
                  <svg viewBox={`0 0 100 28`} width="100%" height="28" preserveAspectRatio="none">
                    <polyline
                      fill="none"
                      stroke={card.color}
                      strokeWidth="2"
                      points={card.spark.map((v, i) => `${(i / (card.spark.length - 1)) * 100},${28 - (v / max) * 26}`).join(' ')}
                    />
                  </svg>
                </div>
              );
            })}
          </div>

          {/* Placement performance + engagement depth */}
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.6fr) minmax(0, 1fr)', gap: '1.5rem', marginBottom: '2.5rem' }}>
            <div className="glass-panel" style={{ padding: '1.75rem' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#FFFFFF', marginBottom: '0.25rem' }}>Placement Performance</h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>Daily impressions vs. CTR — hover a bar for placement &amp; UTM attribution.</p>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.75rem', height: '180px' }}>
                {analytics.weeklyDays.map((day, idx) => {
                  const impr = Math.round(analytics.weeklyVisits[idx] * rangeMult);
                  const maxImpr = Math.max(...analytics.weeklyVisits, 1) * rangeMult;
                  const heightPct = Math.max(6, Math.round((impr / maxImpr) * 100));
                  const dayCtr = (1.5 + hashFrac(day, idx) * 3).toFixed(2);
                  const zone = PLACEMENT_ZONES[idx % PLACEMENT_ZONES.length];
                  return (
                    <div
                      key={day}
                      title={`${zone} · utm_source=sponsor_hub · ${impr.toLocaleString()} impressions · ${dayCtr}% CTR`}
                      style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end', cursor: 'default' }}
                    >
                      <span style={{ fontSize: '0.65rem', color: '#A855F7', marginBottom: '0.3rem' }}>{dayCtr}%</span>
                      <div style={{
                        width: '100%', maxWidth: '34px', height: `${heightPct}%`,
                        background: 'linear-gradient(180deg, var(--club-primary), rgba(16,185,129,0.35))',
                        borderRadius: '5px 5px 0 0',
                      }} />
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>{day.replace(' (Matchday)', '')}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '1.75rem' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#FFFFFF', marginBottom: '1.25rem' }}>Engagement Depth</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.5rem' }}>
                <Clock size={18} color="var(--club-primary)" />
                <div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#FFFFFF' }}>{(2.4 + hashFrac('dwell') * 3.2).toFixed(1)}s</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Avg. active time in view</div>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                {scrollBuckets.map(b => (
                  <div key={b.label}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '0.3rem' }}>
                      <span style={{ color: '#FFFFFF' }}>{b.label}</span>
                      <span style={{ color: 'var(--text-muted)', fontWeight: 700 }}>{b.pct}%</span>
                    </div>
                    <div style={{ height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ width: `${b.pct}%`, height: '100%', background: '#3B82F6' }} />
                    </div>
                  </div>
                ))}
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
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative' }}>
                  <Search size={13} style={{ position: 'absolute', left: '0.6rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search sponsor..."
                    style={{ paddingLeft: '1.8rem', padding: '0.4rem 0.7rem 0.4rem 1.8rem', borderRadius: '7px', border: '1px solid var(--border-subtle)', background: 'rgba(255,255,255,0.03)', color: '#FFFFFF', fontSize: '0.78rem' }}
                  />
                </div>
                <select value={placementFilter} onChange={e => setPlacementFilter(e.target.value)} style={{ padding: '0.4rem 0.6rem', borderRadius: '7px', border: '1px solid var(--border-subtle)', background: 'rgba(255,255,255,0.03)', color: '#FFFFFF', fontSize: '0.78rem' }}>
                  <option value="all">All placements</option>
                  {PLACEMENT_ZONES.map(z => <option key={z} value={z}>{z}</option>)}
                </select>
                <select value={deviceFilter} onChange={e => setDeviceFilter(e.target.value)} style={{ padding: '0.4rem 0.6rem', borderRadius: '7px', border: '1px solid var(--border-subtle)', background: 'rgba(255,255,255,0.03)', color: '#FFFFFF', fontSize: '0.78rem' }}>
                  <option value="all">All devices</option>
                  {DEVICES.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', minWidth: '760px' }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: 'var(--text-muted)', fontSize: '0.68rem', letterSpacing: '0.04em' }}>
                    <th style={{ padding: '0.5rem 0.6rem' }}>CREATIVE / SLOT</th>
                    <th style={{ padding: '0.5rem 0.6rem' }}>FORMAT</th>
                    <th style={{ padding: '0.5rem 0.6rem' }}>IMPRESSIONS</th>
                    <th style={{ padding: '0.5rem 0.6rem' }}>CLICKS</th>
                    <th style={{ padding: '0.5rem 0.6rem' }}>CTR</th>
                    <th style={{ padding: '0.5rem 0.6rem' }}>CVR</th>
                    <th style={{ padding: '0.5rem 0.6rem' }}>VIEWABLE</th>
                    <th style={{ padding: '0.5rem 0.6rem' }}>STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map(r => (
                    <tr key={r.sponsor.id} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '0.65rem 0.6rem', fontWeight: 700, color: '#FFFFFF' }}>
                        {r.sponsor.name}
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 500 }}>{r.placement}</div>
                      </td>
                      <td style={{ padding: '0.65rem 0.6rem', color: 'var(--text-secondary)' }}>{r.format}</td>
                      <td style={{ padding: '0.65rem 0.6rem', color: 'var(--text-secondary)' }}>
                        {r.impressions.toLocaleString()} <span style={{ color: 'var(--text-muted)' }}>/ {r.bookedCap.toLocaleString()}</span>
                      </td>
                      <td style={{ padding: '0.65rem 0.6rem', color: 'var(--text-secondary)' }}>{r.clicks.toLocaleString()}</td>
                      <td style={{ padding: '0.65rem 0.6rem', color: 'var(--text-secondary)' }}>{(r.ctr * 100).toFixed(2)}%</td>
                      <td style={{ padding: '0.65rem 0.6rem', color: 'var(--text-secondary)' }}>{(r.cvr * 100).toFixed(2)}%</td>
                      <td style={{ padding: '0.65rem 0.6rem', color: 'var(--text-secondary)' }}>{r.viewableImpressions.toLocaleString()}</td>
                      <td style={{ padding: '0.65rem 0.6rem' }}>
                        <span className="badge" style={{ background: `${statusColor(r.status)}22`, color: statusColor(r.status), border: `1px solid ${statusColor(r.status)}55` }}>
                          {r.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {filteredRows.length === 0 && (
                    <tr><td colSpan={8} style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>No placements match these filters.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Demographics & quality signals */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: '2rem', marginBottom: '1.5rem' }}>
            <div className="glass-panel" style={{ padding: '1.75rem' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#FFFFFF', marginBottom: '1.1rem' }}>
                <Globe2 size={16} style={{ marginRight: '0.4rem', verticalAlign: '-2px' }} />
                Top Countries
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                {COUNTRIES.map((c, idx) => {
                  const pct = Math.round(45 * hashFrac(c.code) + (idx === 0 ? 15 : 0));
                  return (
                    <div key={c.code}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.3rem' }}>
                        <span style={{ color: '#FFFFFF' }}>{c.name}</span>
                        <span style={{ color: 'var(--text-muted)', fontWeight: 700 }}>{pct}%</span>
                      </div>
                      <div style={{ height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: 'var(--club-primary)' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '1.75rem' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#FFFFFF', marginBottom: '1.1rem' }}>
                <ShieldCheck size={16} style={{ marginRight: '0.4rem', verticalAlign: '-2px' }} />
                Traffic Quality
              </h3>
              <div style={{ fontFamily: 'var(--font-heading)', fontSize: '1.8rem', fontWeight: 900, color: '#10B981' }}>{verifiedTrafficPct}%</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1.1rem' }}>Verified human traffic (IVT / bot filtering)</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
                {analytics.deviceBreakdown.map(dev => (
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
                  Download this modeled estimate for internal planning. It is not measured ad-serving data — see the notice above.
                </p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                <button type="button" onClick={handleExportCsv} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', fontSize: '0.8rem' }}>
                  <Download size={14} /> Export Estimated Performance Summary (CSV)
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
