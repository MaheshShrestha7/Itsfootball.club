'use client';

import React, { use } from 'react';
import { useClub } from '@/lib/club-context';
import { BarChart3, TrendingUp, Users, QrCode, Radio, Eye } from 'lucide-react';

export default function AdminAnalyticsPage({
  params,
}: {
  params: Promise<{ clubSlug: string }>;
}) {
  const resolvedParams = use(params);
  const { clubs, selectClubBySlug, members } = useClub();
  const club = selectClubBySlug(resolvedParams.clubSlug) || clubs[0];

  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat (Matchday)', 'Sun'];
  const trafficData = [640, 720, 890, 810, 1420, 2980, 1120];
  const maxTraffic = Math.max(...trafficData);

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <span className="badge badge-primary" style={{ marginBottom: '0.4rem' }}>METRICS • 3.8</span>
        <h1 style={{ fontSize: '2rem', fontWeight: 900, color: '#FFFFFF' }}>
          Club Public Page Analytics
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          Visitor metrics, live match-center attendance, member pass scans, and engagement trends.
        </p>
      </div>

      {/* KPI Overview */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1.25rem',
        marginBottom: '2.5rem',
      }}>
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>WEEKLY VISITS</span>
            <Eye size={18} color="var(--club-primary)" />
          </div>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: '2rem', fontWeight: 900, color: '#FFFFFF' }}>
            8,580
          </div>
          <div style={{ fontSize: '0.75rem', color: '#10B981', marginTop: '0.35rem' }}>+18.4% vs last week</div>
        </div>

        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>MATCH CENTER FANS</span>
            <Radio size={18} color="#EF4444" />
          </div>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: '2rem', fontWeight: 900, color: '#FFFFFF' }}>
            3,410
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>Live match peak</div>
        </div>

        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>PASS SCANS AT GATE</span>
            <QrCode size={18} color="#F59E0B" />
          </div>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: '2rem', fontWeight: 900, color: '#FFFFFF' }}>
            1,248
          </div>
          <div style={{ fontSize: '0.75rem', color: '#10B981', marginTop: '0.35rem' }}>Turnstile accreditations</div>
        </div>

        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>AVG. DURATION</span>
            <TrendingUp size={18} color="#3B82F6" />
          </div>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: '2rem', fontWeight: 900, color: '#FFFFFF' }}>
            4m 32s
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>High fan retention</div>
        </div>
      </div>

      {/* Weekly Traffic Bar Chart */}
      <div className="glass-panel" style={{ padding: '2rem', marginBottom: '2.5rem' }}>
        <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#FFFFFF', marginBottom: '1.5rem' }}>
          Weekly Visitor Activity (Surge on Matchday)
        </h3>

        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: '220px', gap: '1rem', paddingTop: '1rem' }}>
          {trafficData.map((val, idx) => {
            const heightPct = (val / maxTraffic) * 100;
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

      {/* Breakdown Grid: Top Sections & Devices */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem' }}>
        {/* Most Viewed Sections */}
        <div className="glass-panel" style={{ padding: '1.75rem' }}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#FFFFFF', marginBottom: '1.25rem' }}>
            Top Public Page Sections
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {[
              { name: 'Live Match-Day Center', views: '41.2%', color: '#EF4444' },
              { name: 'First Team Squad & Stats', views: '26.8%', color: 'var(--club-primary)' },
              { name: 'Fixtures & Results', views: '15.4%', color: '#3B82F6' },
              { name: 'Digital Member Pass Portal', views: '11.0%', color: '#F59E0B' },
              { name: 'Home Ground & Stadium Guide', views: '5.6%', color: '#A855F7' },
            ].map(sec => (
              <div key={sec.name}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.3rem' }}>
                  <span style={{ color: '#FFFFFF', fontWeight: 600 }}>{sec.name}</span>
                  <span style={{ color: 'var(--text-muted)' }}>{sec.views}</span>
                </div>
                <div style={{ height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ width: sec.views, height: '100%', background: sec.color }} />
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
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.4rem' }}>
                <span style={{ color: '#FFFFFF', fontWeight: 600 }}>Mobile Phones (Smartphones)</span>
                <span style={{ color: '#10B981', fontWeight: 700 }}>68.4%</span>
              </div>
              <div style={{ height: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: '68.4%', height: '100%', background: '#10B981' }} />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.4rem' }}>
                <span style={{ color: '#FFFFFF', fontWeight: 600 }}>Desktop & Laptops</span>
                <span style={{ color: '#3B82F6', fontWeight: 700 }}>24.2%</span>
              </div>
              <div style={{ height: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: '24.2%', height: '100%', background: '#3B82F6' }} />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.4rem' }}>
                <span style={{ color: '#FFFFFF', fontWeight: 600 }}>Tablets & Consoles</span>
                <span style={{ color: '#F59E0B', fontWeight: 700 }}>7.4%</span>
              </div>
              <div style={{ height: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: '7.4%', height: '100%', background: '#F59E0B' }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
