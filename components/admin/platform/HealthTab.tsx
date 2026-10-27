'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { getSupabaseClient } from '@/lib/supabase/client';
import { PlatformHealthStats } from '@/lib/supabase/types';
import {
  Database,
  Cloud,
  CreditCard,
  Radio,
  RefreshCw,
  Layers,
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

  // Database response time on a 0-1000 ms dial
  const ms = pingLatency ?? 0;
  const tone = pingLatency == null ? 'var(--mc-ink-3)' : ms < 300 ? 'var(--mc-green)' : ms < 800 ? '#F59E0B' : '#EF4444';
  const speed = pingLatency == null ? 'Checking…' : ms < 300 ? 'Quick' : ms < 800 ? 'A bit slow' : 'Slow';
  const CIRC = 2 * Math.PI * 50;
  const filled = Math.min(1, ms / 1000) * CIRC;

  const records = [
    { label: 'Clubs', count: stats?.counts?.clubs || 0, bg: 'var(--mc-amber-bg)', color: 'var(--mc-amber)' },
    { label: 'Club members', count: stats?.counts?.members || 0, bg: 'var(--mc-sky)', color: 'var(--mc-sky-ink)' },
    { label: 'Payments', count: stats?.counts?.payments || 0, bg: 'var(--mc-mint)', color: 'var(--mc-green-ink)' },
    { label: 'Matches', count: stats?.counts?.matches || 0, bg: 'var(--mc-lilac)', color: 'var(--mc-indigo)' },
    { label: 'Events', count: stats?.counts?.events || 0, bg: 'var(--mc-pink)', color: 'var(--mc-pink-ink)' },
    { label: 'Gate QR scans', count: stats?.counts?.gate_scans || 0, bg: 'var(--mc-sky)', color: 'var(--mc-sky-ink)' },
    { label: 'Page visits logged', count: stats?.counts?.analytics || 0, bg: 'var(--mc-bar)', color: 'var(--mc-ink-2)' },
  ];

  return (
    <div>
      <div className="mc-page-h">
        <div>
          <h1>System health</h1>
          <p>Last checked at {lastCheck.toLocaleTimeString()}.</p>
        </div>
        <div className="right">
          <button type="button" className="mc-pill-btn" onClick={runHealthCheck} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'spin' : ''} /> Check again
          </button>
        </div>
      </div>

      <div className="mc-health">
        <div className="mc-card">
          <div className="mc-card-h"><h3>Database response</h3><Database size={16} color="var(--mc-ink-3)" /></div>
          <div className="mc-gauge-wrap">
            <div className="mc-gauge">
              <svg viewBox="0 0 120 120" aria-hidden="true">
                <circle cx="60" cy="60" r="50" fill="none" stroke="var(--mc-bar)" strokeWidth="12" />
                <circle cx="60" cy="60" r="50" fill="none" stroke={tone} strokeWidth="12" strokeLinecap="round" strokeDasharray={`${filled} ${CIRC}`} />
              </svg>
              <div className="c"><div><b className="num">{pingLatency ?? '…'}</b><small>ms</small></div></div>
            </div>
            <div className="mc-legend">
              <div><span><i style={{ background: tone }} />Speed</span><b>{speed}</b></div>
              <div><span><i style={{ background: 'var(--mc-lilac-2)' }} />Status</span><b>{stats?.status || '…'}</b></div>
              <div><span><i style={{ background: 'var(--mc-bar)' }} />Server time</span><b>{stats?.server_timestamp ? new Date(stats.server_timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '…'}</b></div>
            </div>
          </div>
          <p className="mc-muted" style={{ marginTop: 14, fontSize: 11 }}>Time for this browser to get an answer from the database. Under 300 ms is quick.</p>
        </div>

        <div className="mc-col">
          <div className="mc-svc-grid">
            <div className="mc-card mc-svc">
              <span className="mc-sq" style={{ background: 'var(--mc-lilac)', color: 'var(--mc-indigo)' }}><Database size={16} /></span>
              <div><b>Supabase database</b><small className="num">{pingLatency ? `${pingLatency} ms just now` : 'Testing…'}</small></div>
              <span className="ok-dot" style={{ background: tone }} aria-hidden="true" />
            </div>
            <div className="mc-card mc-svc">
              <span className="mc-sq" style={{ background: 'var(--mc-pink)', color: 'var(--mc-pink-ink)' }}><Cloud size={16} /></span>
              <div><b>Cloudflare R2 storage</b><small>Photo and file uploads</small></div>
            </div>
            <div className="mc-card mc-svc">
              <span className="mc-sq" style={{ background: 'var(--mc-mint)', color: 'var(--mc-green-ink)' }}><CreditCard size={16} /></span>
              <div><b>Stripe payments</b><small>Membership charges and payouts</small></div>
            </div>
            <div className="mc-card mc-svc">
              <span className="mc-sq" style={{ background: 'var(--mc-sky)', color: 'var(--mc-sky-ink)' }}><Radio size={16} /></span>
              <div><b>Live updates</b><small>Live scores and gate scans</small></div>
            </div>
          </div>

          <div className="mc-card">
            <div className="mc-card-h"><h3>Records in the database</h3><Layers size={16} color="var(--mc-ink-3)" /></div>
            <div className="mc-records">
              {records.map(r => (
                <div key={r.label} className="mc-tile" style={{ textAlign: 'left', padding: 14 }}>
                  <span className="mc-sq" style={{ width: 26, height: 26, borderRadius: 8, background: r.bg, color: r.color, marginBottom: 8 }}><Layers size={13} /></span>
                  <b className="num">{r.count.toLocaleString()}</b>
                  <small>{r.label}</small>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
