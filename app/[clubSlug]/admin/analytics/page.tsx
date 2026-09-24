'use client';

import React, { use, useEffect, useState } from 'react';
import { useClub } from '@/lib/club-context';
import { BarChart3, TrendingUp, Users, QrCode, Radio, Eye, Megaphone } from 'lucide-react';
import SponsorHubDashboard from '@/components/SponsorHubDashboard';

export default function AdminAnalyticsPage({
  params,
}: {
  params: Promise<{ clubSlug: string }>;
}) {
  const resolvedParams = use(params);
  const { clubs, selectClubBySlug, getClubAnalytics, loadClubAnalytics, sponsors } = useClub();
  const club = selectClubBySlug(resolvedParams.clubSlug) || clubs[0];
  const [view, setView] = useState<'overview' | 'sponsors'>('overview');

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
        <span className="badge badge-primary" style={{ marginBottom: '0.4rem' }}>AUDIENCE & CLUB ANALYTICS</span>
        <h1 style={{ fontSize: '2rem', fontWeight: 900, color: '#FFFFFF' }}>
          Club Public Page Analytics
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          Real-time visitor metrics, live match-center attendance, turnstile scans, and audience engagement trends.
        </p>
      </div>

      {/* View toggle */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem', borderBottom: '1px solid var(--border-subtle)' }}>
        <button
          type="button"
          onClick={() => setView('overview')}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.7rem 1rem', border: 'none', background: 'transparent', cursor: 'pointer',
            fontSize: '0.85rem', fontWeight: 700,
            color: view === 'overview' ? '#FFFFFF' : 'var(--text-muted)',
            borderBottom: view === 'overview' ? '2px solid var(--club-primary)' : '2px solid transparent',
          }}
        >
          <BarChart3 size={15} /> Club Overview
        </button>
        <button
          type="button"
          onClick={() => setView('sponsors')}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.7rem 1rem', border: 'none', background: 'transparent', cursor: 'pointer',
            fontSize: '0.85rem', fontWeight: 700,
            color: view === 'sponsors' ? '#FFFFFF' : 'var(--text-muted)',
            borderBottom: view === 'sponsors' ? '2px solid var(--club-primary)' : '2px solid transparent',
          }}
        >
          <Megaphone size={15} /> Sponsor Hub / Media Kit
        </button>
      </div>

      {view === 'sponsors' ? (
        <SponsorHubDashboard club={club} sponsors={sponsors} />
      ) : (
      <>
      {/* KPI Overview */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))',
        gap: '1.25rem',
        marginBottom: '2.5rem',
      }}>
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>LIVE PUBLIC VISITS</span>
            <Eye size={18} color="var(--club-primary)" />
          </div>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: '2rem', fontWeight: 900, color: '#FFFFFF' }}>
            {analytics.totalVisits.toLocaleString()}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#10B981', marginTop: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <span className="pulse-dot" style={{ background: '#10B981', width: '6px', height: '6px' }} />
            <span>Active live stream</span>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>MATCH CENTER FANS</span>
            <Radio size={18} color="#EF4444" />
          </div>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: '2rem', fontWeight: 900, color: '#FFFFFF' }}>
            {analytics.matchCenterFans.toLocaleString()}
          </div>
          <div style={{ fontSize: '0.75rem', color: analytics.matchCenterFans > 0 ? '#EF4444' : 'var(--text-secondary)', marginTop: '0.35rem' }}>
            {analytics.matchCenterFans > 0 ? 'Live match in progress' : 'Fixture standby'}
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>PASS SCANS AT GATE</span>
            <QrCode size={18} color="#F59E0B" />
          </div>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: '2rem', fontWeight: 900, color: '#FFFFFF' }}>
            {analytics.gateScansCount.toLocaleString()}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#10B981', marginTop: '0.35rem' }}>Turnstile accreditations</div>
        </div>

        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>AVG. DURATION</span>
            <TrendingUp size={18} color="#3B82F6" />
          </div>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: '2rem', fontWeight: 900, color: '#FFFFFF' }}>
            {analytics.avgDuration}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>High fan retention</div>
        </div>
      </div>

      {/* Weekly Traffic Bar Chart */}
      <div className="glass-panel" style={{ padding: '2rem', marginBottom: '2.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#FFFFFF' }}>
            Weekly Visitor Activity (Surge on Matchday)
          </h3>
          <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10B981', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
            Real-Time Aggregation
          </span>
        </div>

        <div style={{ overflowX: 'auto', paddingBottom: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: '220px', minWidth: '460px', gap: '1rem', paddingTop: '1rem' }}>
            {trafficData.map((val, idx) => {
              const heightPct = Math.max(12, Math.round((val / maxTraffic) * 100));
              const isMatchday = idx === 5;

              return (
                <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: isMatchday ? '#EF4444' : 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                    {val.toLocaleString()}
                  </span>
                  <div style={{
                    width: '100%',
                    maxWidth: '48px',
                    height: `${heightPct}%`,
                    background: isMatchday ? 'linear-gradient(180deg, #EF4444, #991B1B)' : 'linear-gradient(180deg, var(--club-primary), rgba(16, 185, 129, 0.4))',
                    borderRadius: '6px 6px 0 0',
                    boxShadow: isMatchday ? '0 0 15px rgba(239, 68, 68, 0.4)' : 'none',
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
          <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#FFFFFF', marginBottom: '1.25rem' }}>
            Top Public Page Sections
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {analytics.topSections.map(sec => (
              <div key={sec.name}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.3rem' }}>
                  <span style={{ color: '#FFFFFF', fontWeight: 600 }}>{sec.name}</span>
                  <span style={{ color: 'var(--text-muted)', fontWeight: 700 }}>{sec.views}</span>
                </div>
                <div style={{ height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ width: sec.views, height: '100%', background: sec.color, transition: 'width 0.5s ease' }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Device Breakdown */}
        <div className="glass-panel" style={{ padding: '1.75rem' }}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#FFFFFF', marginBottom: '1.25rem' }}>
            Fan Device Breakdown
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {analytics.deviceBreakdown.map(dev => (
              <div key={dev.name}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.4rem' }}>
                  <span style={{ color: '#FFFFFF', fontWeight: 600 }}>{dev.name}</span>
                  <span style={{ color: dev.color, fontWeight: 700 }}>{dev.percentage}</span>
                </div>
                <div style={{ height: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
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
