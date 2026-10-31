'use client';

import React, { use, useEffect } from 'react';
import { useClub } from '@/lib/club-context';
import { useUrlTab } from '@/lib/use-url-tab';
import { BarChart3, QrCode, Radio, Eye, Megaphone } from 'lucide-react';
import SponsorHubDashboard from '@/components/SponsorHubDashboard';

const ANALYTICS_VIEWS = ['overview', 'sponsors'] as const;

export default function AdminAnalyticsPage({
  params,
}: {
  params: Promise<{ clubSlug: string }>;
}) {
  const resolvedParams = use(params);
  const { clubs, selectClubBySlug, getClubAnalytics, loadClubAnalytics, sponsors } = useClub();
  const club = selectClubBySlug(resolvedParams.clubSlug) || clubs[0];
  // ?tab=sponsors opens the sponsor report (linked from Sponsors in the admin menu)
  const [view, setView] = useUrlTab(ANALYTICS_VIEWS);

  useEffect(() => {
    loadClubAnalytics(club.id);
  }, [club.id, loadClubAnalytics]);

  const analytics = getClubAnalytics(club.id);
  const days = analytics.weeklyDays;
  const trafficData = analytics.weeklyVisits;
  const maxTraffic = Math.max(...trafficData, 1);

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 className="stat-value">
          Club Public Page Analytics
        </h1>
        <p className="text-body">
          Who is visiting your site, how many fans follow live matches, gate scans, and how this changes over time.
        </p>
      </div>

      {/* View toggle */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem', borderBottom: '1px solid var(--border-subtle)' }}>
        <button data-view-ok
          type="button"
          onClick={() => setView('overview')}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.7rem 1rem', border: 'none', background: 'transparent', cursor: 'pointer',
            fontSize: '0.85rem', fontWeight: 700,
            color: view === 'overview' ? 'var(--text-primary)' : 'var(--text-muted)',
            borderBottom: view === 'overview' ? '2px solid var(--club-primary)' : '2px solid transparent',
          }}
        >
          <BarChart3 size={15} /> Club Overview
        </button>
        <button data-view-ok
          type="button"
          onClick={() => setView('sponsors')}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.7rem 1rem', border: 'none', background: 'transparent', cursor: 'pointer',
            fontSize: '0.85rem', fontWeight: 700,
            color: view === 'sponsors' ? 'var(--text-primary)' : 'var(--text-muted)',
            borderBottom: view === 'sponsors' ? '2px solid var(--club-primary)' : '2px solid transparent',
          }}
        >
          <Megaphone size={15} /> Sponsor Report
        </button>
      </div>

      {view === 'sponsors' ? (
        <SponsorHubDashboard club={club} sponsors={sponsors} />
      ) : (
      <>
      {analytics.totalVisits === 0 && (
        <p className="glass-panel" style={{ padding: '1rem 1.25rem', marginBottom: '1.25rem', fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
          No visits recorded yet. These numbers fill in once people start visiting your club&apos;s public pages.
        </p>
      )}

      {/* KPI Overview */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))',
        gap: '1.25rem',
        marginBottom: '2.5rem',
      }}>
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>PUBLIC VISITS</span>
            <Eye size={18} color="var(--club-primary)" />
          </div>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: '2rem', fontWeight: 900, color: 'var(--text-primary)' }}>
            {analytics.totalVisits.toLocaleString()}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>Public page views, last 90 days</div>
        </div>

        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>MATCH CENTER FANS</span>
            <Radio size={18} color="var(--c-red)" />
          </div>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: '2rem', fontWeight: 900, color: 'var(--text-primary)' }}>
            {analytics.matchCenterFans.toLocaleString()}
          </div>
          <div style={{ fontSize: '0.75rem', color: analytics.matchCenterFans > 0 ? 'var(--c-red)' : 'var(--text-secondary)', marginTop: '0.35rem' }}>
            {analytics.matchCenterFans > 0 ? 'Live match in progress' : 'Counts during a live match'}
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>PASS SCANS AT GATE</span>
            <QrCode size={18} color="var(--c-amber)" />
          </div>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: '2rem', fontWeight: 900, color: 'var(--text-primary)' }}>
            {analytics.gateScansCount.toLocaleString()}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--c-green)', marginTop: '0.35rem' }}>Member passes scanned</div>
        </div>

      </div>

      {/* Weekly Traffic Bar Chart */}
      <div className="glass-panel" style={{ padding: '2rem', marginBottom: '2.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            Visits by day of the week
          </h3>
        </div>

        <div style={{ overflowX: 'auto', paddingBottom: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: '220px', minWidth: '460px', gap: '1rem', paddingTop: '1rem' }}>
            {trafficData.map((val, idx) => {
              const heightPct = val ? Math.max(12, Math.round((val / maxTraffic) * 100)) : 3;

              return (
                <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                    {val.toLocaleString()}
                  </span>
                  <div style={{
                    width: '100%',
                    maxWidth: '48px',
                    height: `${heightPct}%`,
                    background: 'linear-gradient(180deg, var(--club-primary), rgba(16, 185, 129, 0.4))',
                    borderRadius: '6px 6px 0 0',
                    transition: 'height 0.4s ease',
                  }} />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.6rem', textAlign: 'center' }}>
                    {days[idx]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Breakdown Grid: Top Sections & Devices */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: '2rem' }}>
        {/* Most Viewed Sections */}
        <div className="glass-panel" style={{ padding: '1.75rem' }}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '1.25rem' }}>
            Top Public Page Sections
          </h3>

          <div className="stack">
            {analytics.topSections.map(sec => (
              <div key={sec.name}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.3rem' }}>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{sec.name}</span>
                  <span style={{ color: 'var(--text-muted)', fontWeight: 700 }}>{sec.views}</span>
                </div>
                <div style={{ height: '6px', background: 'rgba(var(--tint-rgb), 0.06)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ width: sec.views, height: '100%', background: sec.color, transition: 'width 0.5s ease' }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Device Breakdown */}
        <div className="glass-panel" style={{ padding: '1.75rem' }}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '1.25rem' }}>
            Fan Device Breakdown
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {analytics.deviceBreakdown.map(dev => (
              <div key={dev.name}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.4rem' }}>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{dev.name}</span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{dev.percentage}</span>
                </div>
                <div style={{ height: '8px', background: 'rgba(var(--tint-rgb), 0.06)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: dev.percentage, height: '100%', background: dev.color, transition: 'width 0.5s ease' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      </>
      )}
    </div>
  );
}
