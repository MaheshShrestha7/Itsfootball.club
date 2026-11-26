'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { getSupabaseClient } from '@/lib/supabase/client';
import { platformApi, useCanChange } from '@/components/admin/platform/api';
import StorageCleanup from '@/components/admin/platform/StorageCleanup';
import StorageMove from '@/components/admin/platform/StorageMove';
import { timeAgo, type Light } from '@/lib/mission-control';
import type { HealthReport } from '@/lib/platform-health';
import type { PlatformHealthStats } from '@/lib/supabase/types';
import { emailKindLabel } from '@/lib/email/kinds';
import { RefreshCw, Play, Layers, Mail } from 'lucide-react';

// MCF-8: club emails the site sent (email_log), get_platform_email_stats(), migration 20261177
interface EmailStats { days: { day: string; n: number }[]; kinds: { kind: string; n: number }[]; clubs: { club_id: string; name: string; n: number }[] }
const dayLabel = (d: string) => new Date(`${d.slice(0, 10)}T00:00:00`).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });

function EmailsCard() {
  const [days, setDays] = useState(14);
  const [stats, setStats] = useState<EmailStats | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const client = getSupabaseClient();
    if (!client) return;
    client.rpc('get_platform_email_stats', { p_days: days }).then(({ data, error: e }) => {
      setError(e ? (/function|does not exist/i.test(e.message) ? 'Run migration 20261177_mission_control_features.sql to see this.' : e.message) : '');
      setStats(e ? null : (data as EmailStats));
    });
  }, [days]);
  const list = stats?.days || [];
  const total = list.reduce((t, d) => t + d.n, 0);
  const max = Math.max(1, ...list.map(d => d.n));
  const busiest = list.reduce<{ day: string; n: number } | null>((b, d) => (!b || d.n > b.n ? d : b), null);
  return (
    <div className="mc-card">
      <div className="mc-card-h" style={{ flexWrap: 'wrap', gap: 8 }}>
        <h3 style={{ display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}><Mail size={15} aria-hidden="true" /> Club emails sent</h3>
        <span className="mc-seg" role="group" aria-label="How far back">
          {[14, 30].map(n => <button key={n} type="button" aria-pressed={days === n} onClick={() => setDays(n)}>{n} days</button>)}
        </span>
      </div>
      {error ? <p className="mc-muted">{error}</p> : !stats ? <p className="mc-muted">Loading…</p> : (
        <>
          <div className="mc-ov-nums">
            <div><b className="num">{total.toLocaleString()}</b><small>sent in {days} days</small></div>
            <div><b className="num">{busiest && busiest.n ? busiest.n.toLocaleString() : 0}</b><small>{busiest && busiest.n ? `busiest day, ${dayLabel(busiest.day)}` : 'busiest day'}</small></div>
          </div>
          <div className="mc-bars" role="img" aria-label={`Emails per day for the last ${days} days`}>
            {list.map((d, i) => <span key={d.day} className={i === list.length - 1 ? 'today' : ''} style={{ height: `${Math.max(3, (d.n / max) * 100)}%` }} title={`${dayLabel(d.day)}: ${d.n}`} />)}
          </div>
          {list.length > 0 && <div className="mc-bars-axis"><span>{dayLabel(list[0].day)}</span><span>Today</span></div>}
          <h4 style={{ margin: '16px 0 8px' }}>What they were</h4>
          {stats.kinds.length === 0 ? <p className="mc-muted" style={{ margin: 0 }}>Nothing sent.</p> : (
            <dl className="mc-kv">
              {stats.kinds.slice(0, 8).map(k => <React.Fragment key={k.kind}><dt>{emailKindLabel(k.kind)}</dt><dd className="num">{k.n.toLocaleString()}</dd></React.Fragment>)}
            </dl>
          )}
          {stats.clubs.length > 0 && (
            <>
              <h4 style={{ margin: '16px 0 8px' }}>Clubs sending the most</h4>
              <dl className="mc-kv">
                {stats.clubs.map(c => <React.Fragment key={c.club_id}><dt>{c.name}</dt><dd className="num">{c.n.toLocaleString()}</dd></React.Fragment>)}
              </dl>
            </>
          )}
          <p className="mc-muted" style={{ fontSize: 11, marginTop: 10 }}>Every email the site sent, one per person. Who got each one is in the Email log.</p>
        </>
      )}
    </div>
  );
}

const LIGHT: Record<Light, { color: string; flag: string; word: string }> = {
  red: { color: 'var(--mc-red)', flag: 'bad', word: 'Problem' },
  amber: { color: 'var(--mc-amber)', flag: 'warn', word: 'Watch' },
  green: { color: 'var(--mc-green)', flag: 'ok', word: 'OK' },
  grey: { color: 'var(--mc-ink-3)', flag: '', word: 'No data' },
};

/** Real signals from platform_events and live checks (GET /api/platform/health). */
export default function HealthTab({ showToast }: { showToast: (msg: string) => void }) {
  const canChange = useCanChange();
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
                    <button type="button" className="mc-pill-btn ghost" disabled={!!running || !canChange} onClick={() => runJob(job)}>
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

          <EmailsCard />

          <StorageMove showToast={showToast} />

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
