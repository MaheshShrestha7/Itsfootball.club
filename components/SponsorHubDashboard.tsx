'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Club, Sponsor } from '@/lib/supabase/types';
import { useClub } from '@/lib/club-context';
import { toCsv } from '@/lib/finance';
import { isSponsorOnSite, sponsorPageUrl } from '@/lib/sponsors';
import {
  Eye, MousePointerClick, Globe2, Download, Search, Users2, Smartphone, Layers, Info, Trophy, Copy, Check, ChevronDown,
} from 'lucide-react';

// The admin Sponsor Report (SP-U5, 28 Oct 2026 sponsors review), in plain words for volunteers.
// The technical figures (viewability, click rate, time on screen, countries, devices) sit under More detail.

interface SponsorHubDashboardProps {
  club: Club;
  sponsors: Sponsor[];
}

type DateRange = '30d' | 'qtd' | 'custom';

function startOfQuarter(now: Date): Date {
  const q = Math.floor(now.getMonth() / 3) * 3;
  return new Date(now.getFullYear(), q, 1);
}

const statusColor = (status?: Sponsor['package_status']) =>
  status === 'paid' || status === 'confirmed' ? '#10B981' : status === 'prospect' ? '#F59E0B' : '#EF4444';

const statusLabel = (status?: Sponsor['package_status']) => {
  if (status === 'paid') return 'Paid';
  if (status === 'confirmed') return 'Active';
  if (status === 'prospect') return 'Not paid yet';
  if (status === 'expired') return 'Ended';
  if (status === 'cancelled') return 'Cancelled';
  return 'Active';
};

const panelTitle: React.CSSProperties = { fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.25rem' };
const cell: React.CSSProperties = { padding: '0.65rem 0.6rem', color: 'var(--text-secondary)' };
const num = (n: number) => n.toLocaleString('en-AU');

export default function SponsorHubDashboard({ club, sponsors }: SponsorHubDashboardProps) {
  const { loadSponsorAnalytics, getSponsorAnalytics } = useClub();
  const [range, setRange] = useState<DateRange>('30d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [search, setSearch] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Club sponsors on the site now, plus any that collected views in the range (e.g. since ended)
  const clubSponsors = useMemo(
    () => sponsors.filter(s => s.club_id === club.id && isSponsorOnSite(s)),
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

  // The last 90 days load by default; a custom range that starts earlier loads from its start
  const loadFrom = since?.toISOString().slice(0, 10);
  useEffect(() => {
    loadSponsorAnalytics(club.id, loadFrom ? new Date(loadFrom) : undefined);
  }, [club.id, loadFrom, loadSponsorAnalytics]);

  const data = getSponsorAnalytics(club.id, { since, until });

  const rows = useMemo(() => {
    const seen = new Set(clubSponsors.map(s => s.id));
    const ended = sponsors.filter(s => s.club_id === club.id && !seen.has(s.id) && data.bySponsor[s.id]);
    return [...clubSponsors, ...ended]
      .map(sponsor => ({ sponsor, stats: data.bySponsor[sponsor.id] }))
      .filter(r => {
        const q = search.trim().toLowerCase();
        return !q || r.sponsor.name.toLowerCase().includes(q);
      })
      .sort((a, b) => (b.stats?.impressions || 0) - (a.stats?.impressions || 0));
  }, [clubSponsors, sponsors, club.id, data.bySponsor, search]);

  const maxDayImpressions = Math.max(...data.byDay.map(d => d.impressions), 1);
  const maxPlacement = Math.max(1, ...data.byPlacement.map(p => p.seen));
  const bestPage = data.byPlacement[0];
  const perWeek = data.byDay.length > 0 && data.byDay[0].day.startsWith('w/c');

  const kpiCards = [
    { key: 'seen', label: 'Times sponsors were seen', icon: Eye, value: num(data.totals.impressions), color: 'var(--c-green)' },
    { key: 'people', label: 'People who saw a sponsor (estimate)', icon: Users2, value: num(data.totals.uniqueReach), color: 'var(--c-blue)' },
    { key: 'clicks', label: 'Clicks to sponsor websites', icon: MousePointerClick, value: num(data.totals.clicks), color: 'var(--c-amber)' },
    { key: 'best', label: 'Best page', icon: Trophy, value: bestPage?.label || '—', color: 'var(--c-purple)' },
  ];

  // Their own private page (SP-F1/F3/F4): their results, a new logo, invoices
  const copyTheirLink = async (sponsor: Sponsor) => {
    if (!sponsor.access_key) return;
    const link = sponsorPageUrl(club.custom_domain ? `https://${club.custom_domain}` : `${window.location.origin}/${club.slug}`, sponsor.access_key);
    try {
      await navigator.clipboard.writeText(link);
      setCopiedId(sponsor.id);
    } catch {
      window.prompt('Copy their link', link);
    }
  };

  const handleExportCsv = () => {
    const header = ['Sponsor', 'Seen most on', 'Times seen', 'Seen properly', 'Seen properly %', 'Clicks to website', 'Click rate %', 'Avg. seconds on screen', 'Status'];
    const lines = rows.map(({ sponsor, stats }) => [
      sponsor.name,
      stats?.topPlacement || 'Not seen yet',
      stats?.impressions || 0,
      stats?.viewableImpressions || 0,
      (stats?.viewabilityRate || 0).toFixed(2),
      stats?.clicks || 0,
      (stats?.ctr || 0).toFixed(2),
      ((stats?.avgDwellMs || 0) / 1000).toFixed(1),
      statusLabel(sponsor.package_status),
    ]);
    // Quoted and formula-safe: sponsor names can come from the public sign-up form
    const csv = '﻿' + toCsv([header, ...lines]);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${club.slug}-sponsor-report.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const avgDwell = (() => {
    const dwells = Object.values(data.bySponsor).map(s => s.avgDwellMs).filter(v => v > 0);
    return dwells.length ? dwells.reduce((a, b) => a + b, 0) / dwells.length : 0;
  })();

  return (
    // Display only: stays usable on view-only admin pages
    <div data-view-ok>
      {/* Header toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.75rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--text-primary)' }}>Sponsor Report</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            How often people saw and clicked your sponsors on {club.name}&apos;s site. Handy for renewal chats.
          </p>
        </div>
        <div className="row row-loose row-wrap">
          {range === 'custom' && (
            <div className="row">
              <input aria-label="From date" type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} style={{ padding: '0.4rem 0.5rem', borderRadius: '7px', border: '1px solid var(--border-subtle)', background: 'rgba(var(--tint-rgb), 0.03)', color: 'var(--text-primary)', fontSize: '0.75rem' }} />
              <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>to</span>
              <input aria-label="To date" type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} style={{ padding: '0.4rem 0.5rem', borderRadius: '7px', border: '1px solid var(--border-subtle)', background: 'rgba(var(--tint-rgb), 0.03)', color: 'var(--text-primary)', fontSize: '0.75rem' }} />
            </div>
          )}
          <div style={{ display: 'flex', gap: '0.5rem', background: 'rgba(var(--tint-rgb), 0.03)', border: '1px solid var(--border-subtle)', borderRadius: '10px', padding: '0.3rem' }}>
            {([['30d', 'Last 30 days'], ['qtd', 'This quarter'], ['custom', 'Pick dates']] as [DateRange, string][]).map(([key, label]) => (
              <button
                key={key}
                type="button"
                aria-pressed={range === key}
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
          No sponsors on your site yet. Add one on the Sponsors page and their views and clicks show here.
        </div>
      ) : !data.hasAnyData ? (
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: '0.6rem', padding: '1.25rem',
          borderRadius: '10px', border: '1px solid rgba(59, 130, 246, 0.35)', background: 'rgba(59, 130, 246, 0.08)',
          marginBottom: '2rem', fontSize: '0.82rem', color: 'var(--c-sky)',
        }}>
          <Info size={16} style={{ flexShrink: 0, marginTop: '0.1rem' }} />
          <span>
            Nothing recorded for these dates yet. Every time someone sees or clicks a sponsor logo on your home page,
            footer, match pages or event pages, it&apos;s counted here.
          </span>
        </div>
      ) : null}

      {clubSponsors.length > 0 && (
        <>
          {/* Headline numbers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 160px), 1fr))', gap: '1rem', marginBottom: '0.75rem' }}>
            {kpiCards.map(card => {
              const Icon = card.icon;
              return (
                <div key={card.key} className="glass-panel" style={{ padding: '1.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)' }}>{card.label}</span>
                    <Icon size={16} color={card.color} style={{ flexShrink: 0 }} />
                  </div>
                  <div style={{ fontFamily: 'var(--font-heading)', fontSize: card.key === 'best' ? '1.25rem' : '1.6rem', fontWeight: 900, color: 'var(--text-primary)' }}>{card.value}</div>
                </div>
              );
            })}
          </div>
          <p className="text-note" style={{ margin: '0 0 2rem' }}>
            People are counted by device: someone on their phone and their laptop counts twice.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
            <div className="glass-panel" style={{ padding: '1.5rem' }}>
              <h3 style={panelTitle}>Views {perWeek ? 'each week' : 'each day'}</h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
                Times any sponsor was seen. Point at a bar for the clicks too.
              </p>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: data.byDay.length > 14 ? '2px' : '0.75rem', height: '180px' }}>
                {data.byDay.map((d, i) => {
                  // Long ranges label every few bars so the dates stay readable
                  const labelEvery = Math.ceil(data.byDay.length / 7);
                  const heightPct = Math.max(4, Math.round((d.impressions / maxDayImpressions) * 100));
                  return (
                    <div
                      key={d.day}
                      title={`${d.day}: seen ${num(d.impressions)} times · ${num(d.clicks)} clicks`}
                      style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end', cursor: 'default' }}
                    >
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>{d.clicks > 0 && data.byDay.length <= 14 ? `${d.clicks} clicks` : ''}</span>
                      <div style={{
                        width: '100%', maxWidth: '34px', height: `${heightPct}%`,
                        background: 'linear-gradient(180deg, var(--club-primary), rgba(16,185,129,0.35))',
                        borderRadius: '5px 5px 0 0',
                      }} />
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.5rem', whiteSpace: 'nowrap', minHeight: '1em' }}>{i % labelEvery === 0 ? d.day : ''}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '1.5rem' }}>
              <h3 style={panelTitle}>Where sponsors were seen</h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>Every sponsor together, most seen first.</p>
              {data.byPlacement.length === 0 ? (
                <p className="text-meta">Nothing recorded for these dates yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  {data.byPlacement.map(p => (
                    <div key={p.placement}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', fontSize: '0.82rem', marginBottom: '0.3rem' }}>
                        <span className="text-primary">{p.label}</span>
                        <span style={{ color: 'var(--text-muted)', fontWeight: 700 }}>
                          {num(p.seen)}{p.clicks > 0 && ` · ${num(p.clicks)} ${p.clicks === 1 ? 'click' : 'clicks'}`}
                        </span>
                      </div>
                      <div style={{ height: '6px', background: 'rgba(var(--tint-rgb), 0.06)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ width: `${Math.max(3, Math.round((p.seen / maxPlacement) * 100))}%`, height: '100%', background: 'var(--club-primary)' }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Each sponsor */}
          <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.5rem' }}>
              <h3 style={{ ...panelTitle, marginBottom: 0 }}>
                <Layers size={16} style={{ marginRight: '0.4rem', verticalAlign: '-2px' }} />
                Each sponsor
              </h3>
              <div style={{ position: 'relative' }}>
                <Search size={13} style={{ position: 'absolute', left: '0.6rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input aria-label="Search sponsors"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search sponsor..."
                  style={{ padding: '0.4rem 0.7rem 0.4rem 1.8rem', borderRadius: '7px', border: '1px solid var(--border-subtle)', background: 'rgba(var(--tint-rgb), 0.03)', color: 'var(--text-primary)', fontSize: '0.78rem' }}
                />
              </div>
            </div>
            <p className="text-meta" style={{ margin: '0 0 0.75rem' }}>
              Copy their link to send a sponsor their own page: their results, a place to send a new logo, and their invoices.
            </p>

            {/* Rows that wrap rather than a wide table, so it reads on a phone */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {rows.map(({ sponsor, stats }) => (
                <div key={sponsor.id} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem 1rem', padding: '0.85rem 0', borderTop: '1px solid var(--border-subtle)' }}>
                  <div style={{ flex: '1 1 180px', minWidth: 0 }}>
                    <div style={{ fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {sponsor.name}
                      <span className="badge" style={{ background: `${statusColor(sponsor.package_status)}22`, color: statusColor(sponsor.package_status), border: `1px solid ${statusColor(sponsor.package_status)}55`, fontSize: '0.68rem' }}>
                        {statusLabel(sponsor.package_status)}
                      </span>
                    </div>
                    <div className="text-meta">{stats?.topPlacement ? `Seen most on: ${stats.topPlacement}` : 'Not seen yet'}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '1.25rem', fontSize: '0.82rem' }}>
                    <span><strong className="text-primary">{num(stats?.impressions || 0)}</strong> <span className="text-muted">seen</span></span>
                    <span><strong className="text-primary">{num(stats?.clicks || 0)}</strong> <span className="text-muted">{stats?.clicks === 1 ? 'click' : 'clicks'}</span></span>
                  </div>
                  {sponsor.access_key && (
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => copyTheirLink(sponsor)} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', minHeight: 36 }}>
                      {copiedId === sponsor.id ? <><Check size={13} /> Copied</> : <><Copy size={13} /> Copy their link</>}
                    </button>
                  )}
                </div>
              ))}
              {rows.length === 0 && (
                <p style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', borderTop: '1px solid var(--border-subtle)', margin: 0 }}>No sponsors match this search.</p>
              )}
            </div>
          </div>

          {/* The technical figures, for anyone who wants them */}
          <details className="glass-panel" style={{ padding: '1.25rem 1.5rem', marginBottom: '1.5rem' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.4rem' }}>
              <ChevronDown size={16} /> More detail
              <span className="text-meta" style={{ fontWeight: 500 }}>seen properly, click rate, time on screen, countries and devices</span>
            </summary>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 160px), 1fr))', gap: '1rem', margin: '1.25rem 0' }}>
              {[
                ['Seen properly', `${data.totals.viewabilityRate.toFixed(0)}%`, 'Logo at least half on screen for a second or more (viewability).'],
                ['Click rate', `${data.totals.ctr.toFixed(2)}%`, 'Clicks for every 100 times seen (CTR).'],
                ['Time on screen', avgDwell > 0 ? `${(avgDwell / 1000).toFixed(1)}s` : '—', 'Average time a logo stayed on screen.'],
                ['Saw one more than once', `${data.totals.repeatExposureRate.toFixed(0)}%`, 'Share of people who saw a sponsor again.'],
              ].map(([label, value, help]) => (
                <div key={label} style={{ padding: '0.9rem', borderRadius: 10, border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>{label}</div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 900, color: 'var(--text-primary)' }}>{value}</div>
                  <div className="text-meta">{help}</div>
                </div>
              ))}
            </div>

            <div style={{ overflowX: 'auto', marginBottom: '1.5rem' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', minWidth: '560px' }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                    <th style={{ padding: '0.5rem 0.6rem' }}>Sponsor</th>
                    <th style={{ padding: '0.5rem 0.6rem' }}>Seen properly</th>
                    <th style={{ padding: '0.5rem 0.6rem' }}>Click rate</th>
                    <th style={{ padding: '0.5rem 0.6rem' }}>Time on screen</th>
                    <th style={{ padding: '0.5rem 0.6rem' }}>People (estimate)</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ sponsor, stats }) => (
                    <tr key={sponsor.id} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                      <td style={{ ...cell, fontWeight: 700, color: 'var(--text-primary)' }}>{sponsor.name}</td>
                      <td style={cell}>{num(stats?.viewableImpressions || 0)} <span className="text-muted">({(stats?.viewabilityRate || 0).toFixed(0)}%)</span></td>
                      <td style={cell}>{(stats?.ctr || 0).toFixed(2)}%</td>
                      <td style={cell}>{stats?.avgDwellMs ? `${(stats.avgDwellMs / 1000).toFixed(1)}s` : '—'}</td>
                      <td style={cell}>{num(stats?.uniqueReach || 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: '1.5rem' }}>
              <div>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.9rem' }}>
                  <Globe2 size={15} style={{ marginRight: '0.4rem', verticalAlign: '-2px' }} />
                  Countries
                </h4>
                {data.byCountry.length === 0 ? (
                  <p className="text-meta">Nothing recorded for these dates yet.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
                    {data.byCountry.map(c => {
                      const pct = Math.round((c.count / (data.byCountry[0]?.count || 1)) * 100);
                      return (
                        <div key={c.country}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.3rem' }}>
                            <span className="text-primary">{c.country}</span>
                            <span style={{ color: 'var(--text-muted)', fontWeight: 700 }}>{num(c.count)}</span>
                          </div>
                          <div style={{ height: '6px', background: 'rgba(var(--tint-rgb), 0.06)', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ width: `${pct}%`, height: '100%', background: 'var(--club-primary)' }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <div>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.9rem' }}>
                  <Smartphone size={15} style={{ marginRight: '0.4rem', verticalAlign: '-2px' }} />
                  Devices
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
                  {data.byDevice.map(dev => (
                    <div key={dev.name}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '0.3rem' }}>
                        <span className="text-primary">{dev.name}</span>
                        <span style={{ color: dev.color, fontWeight: 700 }}>{dev.percentage}</span>
                      </div>
                      <div style={{ height: '6px', background: 'rgba(var(--tint-rgb), 0.06)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ width: dev.percentage, height: '100%', background: dev.color }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </details>

          <button type="button" onClick={handleExportCsv} className="btn btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem' }}>
            <Download size={14} /> Download the report (CSV)
          </button>
        </>
      )}
    </div>
  );
}
