'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { getSupabaseClient } from '@/lib/supabase/client';
import { platformApi } from '@/components/admin/platform/api';
import StorageCleanup from '@/components/admin/platform/StorageCleanup';
import { timeAgo, type Light } from '@/lib/mission-control';
import type { HealthReport } from '@/lib/platform-health';
import type { PlatformHealthStats } from '@/lib/supabase/types';
import { RefreshCw, Play, Layers } from 'lucide-react';

const LIGHT: Record<Light, { color: string; flag: string; word: string }> = {
  red: { color: '#DC2626', flag: 'bad', word: 'Problem' },
  amber: { color: '#F59E0B', flag: 'warn', word: 'Watch' },
  green: { color: '#10B981', flag: 'ok', word: 'OK' },
  grey: { color: '#94A3B8', flag: '', word: 'No data' },
};

/** Real signals from platform_events and live checks (GET /api/platform/health). */
export default function HealthTab({ showToast }: { showToast: (msg: string) => void }) {
  const [report, setReport] = useState<HealthReport | null>(null);
  const [stats, setStats] = useState<PlatformHealthStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [running, setRunning] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const client = getSupabaseClient();
    const [res, counts] = await Promise.all([
      platformApi<HealthReport>('health'),
      client ? client.rpc('get_platform_health_stats') : Promise.resolve({ data: null }),
    ]);
    setLoading(false);
    if (res.error) { setError(res.error); return; }
    setError('');
    setReport(res);
    setStats((counts.data as PlatformHealthStats) || null);
  }, []);

  useEffect(() => { load(); }, [load]);

  const runJob = async (job: string) => {
    setRunning(job);
    const res = await platformApi<{ ok: boolean; result: unknown }>('health', { job });
    setRunning(null);
    if (res.error) { showToast(`Job failed: ${res.error}`); } else showToast(`✓ Ran ${job}`);
    load();
  };

  const problems = report?.signals.filter(s => s.light === 'red').length || 0;
  const records = [
    ['Clubs', stats?.counts?.clubs], ['Club members', stats?.counts?.members], ['Payments', stats?.counts?.payments],
    ['Matches', stats?.counts?.matches], ['Events', stats?.counts?.events], ['Gate QR scans', stats?.counts?.gate_scans],
  ] as const;

  return (
    <div>
      <div className="mc-page-h">
        <div>
          <h1>System health</h1>
          <p>
            {report ? `${problems ? `${problems} ${problems === 1 ? 'problem' : 'problems'}` : 'All good'}. Checked ${timeAgo(report.checkedAt)}.` : loading ? 'Checking…' : ''}
            {' '}Red lights are emailed to platform admins once every 12 hours.
          </p>
        </div>
        <div className="right">
          <button type="button" className="mc-pill-btn" onClick={load} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'spin' : ''} /> Check again
          </button>
        </div>
      </div>

      {error && <div className="mc-card mc-empty" role="alert">{error}</div>}

      {report && (
        <div className="mc-col">
          <div className="mc-card">
            {report.signals.map(s => {
              const l = LIGHT[s.light];
              const job = s.key.startsWith('job:') ? s.key.slice(4) : null;
              return (
                <div key={s.key} className="mc-sig">
                  <span className="lt" style={{ background: l.color }} aria-hidden="true" />
                  <div className="body">
                    <b>{s.label}</b> <span className={`mc-flag ${l.flag}`}>{l.word}</span>
                    <p>{s.summary}</p>
                  </div>
                  {job && (
                    <button type="button" className="mc-pill-btn ghost" disabled={!!running} onClick={() => runJob(job)}>
                      <Play size={13} /> {running === job ? 'Running…' : 'Run now'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mc-card">
            <div className="mc-card-h"><h3>Failed emails, last 24 hours</h3></div>
            {report.failures.length === 0 ? <p className="mc-muted">None.</p> : (
              <div style={{ overflowX: 'auto' }}>
                <table className="mc-table">
                  <thead><tr><th>When</th><th>To</th><th>Subject</th><th>Why</th></tr></thead>
                  <tbody>
                    {report.failures.map((f, i) => (
                      <tr key={i}>
                        <td>{timeAgo(f.at)}</td>
                        <td>{f.to.slice(0, 2).join(', ')}{f.count > 2 ? ` +${f.count - 2}` : ''}</td>
                        <td>{f.subject}</td>
                        <td><span className="mc-flag bad">{f.error.slice(0, 80)}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="mc-muted" style={{ fontSize: 11, marginTop: 10 }}>
              Reminder emails that fail are sent again on the next daily run. Bounces (sent but not delivered) show in Resend, not here.
            </p>
          </div>

          <StorageCleanup showToast={showToast} />

          <div className="mc-card">
            <div className="mc-card-h"><h3>Records in the database</h3><Layers size={16} color="var(--mc-ink-3)" /></div>
            <div className="mc-records">
              {records.map(([label, count]) => (
                <div key={label} className="mc-tile" style={{ textAlign: 'left', padding: 14 }}>
                  <b className="num">{(count || 0).toLocaleString()}</b>
                  <small>{label}</small>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
