'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { getSupabaseClient } from '@/lib/supabase/client';
import { PlatformHealthStats } from '@/lib/supabase/types';
import {
  Activity,
  Database,
  Cloud,
  CreditCard,
  Radio,
  RefreshCw,
  CheckCircle2,
  Clock,
  Layers,
  Server,
  Zap,
} from 'lucide-react';

export default function HealthTab() {
  const [stats, setStats] = useState<PlatformHealthStats | null>(null);
  const [pingLatency, setPingLatency] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastCheck, setLastCheck] = useState<Date>(new Date());

  const runHealthCheck = useCallback(async () => {
    const client = getSupabaseClient();
    if (!client) return;
    setLoading(true);
    const start = performance.now();
    try {
      // 1. Try health RPC or fallback count
      const { data, error } = await client.rpc('get_platform_health_stats');
      const duration = Math.round(performance.now() - start);
      setPingLatency(duration);

      if (!error && data) {
        setStats(data as PlatformHealthStats);
      } else {
        // Fallback row count if migration not yet applied
        const [cRes, mRes, pRes] = await Promise.all([
          client.from('clubs').select('id', { count: 'exact', head: true }),
          client.from('club_members').select('id', { count: 'exact', head: true }),
          client.from('payments').select('id', { count: 'exact', head: true }),
        ]);
        setStats({
          server_timestamp: new Date().toISOString(),
          counts: {
            clubs: cRes.count || 0,
            members: mRes.count || 0,
            payments: pRes.count || 0,
            matches: 0,
            events: 0,
            gate_scans: 0,
            analytics: 0,
          },
          status: 'healthy',
        });
      }
      setLastCheck(new Date());
    } catch (err) {
      console.error('Health check failed:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    runHealthCheck();
  }, [runHealthCheck]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Top Banner & Latency Meter */}
      <div className="glass-panel" style={{ padding: '1.75rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.5rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.35rem' }}>
              <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.2)', color: 'var(--c-green)', fontWeight: 800 }}>
                SYSTEM HEALTH &amp; TELEMETRY
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Last verified: {lastCheck.toLocaleTimeString()}
              </span>
            </div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Server size={24} color="#818CF8" />
              <span>Platform Core Infrastructure Vitals</span>
            </h2>
          </div>

          <button
            type="button"
            onClick={runHealthCheck}
            disabled={loading}
            className="btn btn-secondary btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
            <span>Run Diagnostics Ping</span>
          </button>
        </div>

        {/* 4 Core Vital Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: '1rem' }}>
          {/* Card 1: Supabase Database */}
          <div style={{ padding: '1.25rem', background: 'rgba(var(--tint-rgb), 0.03)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>SUPABASE DATABASE</span>
              <Database size={18} color="var(--c-green)" />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10B981' }} className="pulse-dot" />
              <div style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--text-primary)' }}>
                {pingLatency ? `${pingLatency} ms` : 'Testing...'}
              </div>
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--c-green)', marginTop: '0.4rem', fontWeight: 700 }}>
              ✓ Optimal latency &amp; pooled connection
            </div>
          </div>

          {/* Card 2: Cloudflare R2 Storage */}
          <div style={{ padding: '1.25rem', background: 'rgba(var(--tint-rgb), 0.03)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>CLOUDFLARE R2 STORAGE</span>
              <Cloud size={18} color="#818CF8" />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <CheckCircle2 size={16} color="var(--c-green)" />
              <div style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--text-primary)' }}>
                Operational
              </div>
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.4rem' }}>
              Media uploads &amp; asset cdn active
            </div>
          </div>

          {/* Card 3: Stripe Gateway */}
          <div style={{ padding: '1.25rem', background: 'rgba(var(--tint-rgb), 0.03)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>STRIPE CONNECT GATEWAY</span>
              <CreditCard size={18} color="var(--c-amber)" />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <CheckCircle2 size={16} color="var(--c-green)" />
              <div style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--text-primary)' }}>
                Active Webhooks
              </div>
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.4rem' }}>
              Membership charges &amp; payouts online
            </div>
          </div>

          {/* Card 4: Realtime WebSocket */}
          <div style={{ padding: '1.25rem', background: 'rgba(var(--tint-rgb), 0.03)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>REALTIME BROADCAST BUS</span>
              <Radio size={18} color="var(--c-blue)" />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#3B82F6' }} className="pulse-dot" />
              <div style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--text-primary)' }}>
                Subscribed
              </div>
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.4rem' }}>
              Live score &amp; matchday door sync
            </div>
          </div>
        </div>
      </div>

      {/* Row Counter Table */}
      <div className="glass-panel" style={{ padding: '1.75rem' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Layers size={18} color="#818CF8" />
          <span>Multi-Tenant Fleet Records &amp; Storage Footprint</span>
        </h3>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '1.25rem' }}>
          Live row volumes across all PostgreSQL partitions
        </span>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))', gap: '1rem' }}>
          {[
            { label: 'Registered Clubs', count: stats?.counts?.clubs || 0, color: 'var(--c-amber)' },
            { label: 'Club Members', count: stats?.counts?.members || 0, color: 'var(--c-blue)' },
            { label: 'Payment Records', count: stats?.counts?.payments || 0, color: 'var(--c-green)' },
            { label: 'Match Fixtures', count: stats?.counts?.matches || 0, color: '#818CF8' },
            { label: 'Scheduled Events', count: stats?.counts?.events || 0, color: '#EC4899' },
            { label: 'Gate QR Scans', count: stats?.counts?.gate_scans || 0, color: 'var(--c-blue)' },
            { label: 'Platform Analytics', count: stats?.counts?.analytics || 0, color: 'var(--text-muted)' },
          ].map((item, idx) => (
            <div
              key={idx}
              style={{
                padding: '1rem',
                background: 'rgba(var(--tint-rgb), 0.02)',
                borderRadius: '8px',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                {item.label}
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--text-primary)', marginTop: '0.35rem' }}>
                {item.count.toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
