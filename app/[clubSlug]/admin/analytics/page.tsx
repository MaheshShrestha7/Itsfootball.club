'use client';

import React, { use, useEffect } from 'react';
import { useClub } from '@/lib/club-context';
import { useUrlTab } from '@/lib/use-url-tab';
import { BarChart3, Megaphone } from 'lucide-react';
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
      <div className="admin-head">
        <div>
          <h1>Analytics</h1>
          <p>Who visits your site, how many fans follow live matches, gate scans, and how sponsors are seen.</p>
        </div>
      </div>

      <div className="admin-tabs" role="tablist" aria-label="Analytics">
        <button data-view-ok type="button" role="tab" className="admin-tab" aria-selected={view === 'overview'} onClick={() => setView('overview')}>
          <BarChart3 size={15} aria-hidden="true" /> Club site
        </button>
        <button data-view-ok type="button" role="tab" className="admin-tab" aria-selected={view === 'sponsors'} onClick={() => setView('sponsors')}>
          <Megaphone size={15} aria-hidden="true" /> Sponsor report
        </button>
      </div>

      {view === 'sponsors' ? (
        <SponsorHubDashboard club={club} sponsors={sponsors} />
      ) : (
      <>
      {analytics.totalVisits === 0 && (
        <p className="admin-notice">
          No visits recorded yet. These numbers fill in once people start visiting your club&apos;s public pages.
        </p>
      )}

      <div className="admin-panel admin-dash-figures-wrap" style={{ marginBottom: 'var(--space-lg)' }}>
        <dl className="admin-dash-figures">
          <div><dt>Public page views</dt><dd>{analytics.totalVisits.toLocaleString()}</dd><span className="admin-note">Last 90 days</span></div>
          <div>
            <dt>Fans in the Match Centre</dt><dd className={analytics.matchCenterFans > 0 ? 'is-live' : undefined}>{analytics.matchCenterFans.toLocaleString()}</dd>
            <span className="admin-note">{analytics.matchCenterFans > 0 ? 'A match is live now' : 'Counted during a live match'}</span>
          </div>
          <div><dt>Passes scanned at the gate</dt><dd>{analytics.gateScansCount.toLocaleString()}</dd></div>
        </dl>
      </div>

      {/* Weekly Traffic Bar Chart */}
      <div className="glass-panel" style={{ padding: '2rem', marginBottom: '2.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 600, color: 'var(--text-primary)' }}>
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
                    background: 'var(--color-accent)',
                    borderRadius: '6px 6px 0 0',
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
          <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '1.25rem' }}>
            Most viewed sections
          </h3>

          <div className="stack">
            {analytics.topSections.map(sec => (
              <div key={sec.name}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.3rem' }}>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{sec.name}</span>
                  <span style={{ color: 'var(--text-muted)', fontWeight: 700 }}>{sec.views}</span>
                </div>
                <div style={{ height: '6px', background: 'color-mix(in oklab, var(--color-ink) 6%, transparent)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ width: sec.views, height: '100%', background: 'var(--color-accent)' }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Device Breakdown */}
        <div className="glass-panel" style={{ padding: '1.75rem' }}>
          <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '1.25rem' }}>
            Phones, tablets and computers
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {analytics.deviceBreakdown.map(dev => (
              <div key={dev.name}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.4rem' }}>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{dev.name}</span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{dev.percentage}</span>
                </div>
                <div style={{ height: '8px', background: 'color-mix(in oklab, var(--color-ink) 6%, transparent)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: dev.percentage, height: '100%', background: 'var(--color-accent)' }} />
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
