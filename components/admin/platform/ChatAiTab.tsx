'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { platformApi, useCanChange } from '@/components/admin/platform/api';
import { timeAgo } from '@/lib/mission-control';
import type { PlatformClubItem } from '@/lib/supabase/types';
import { RefreshCw } from 'lucide-react';

interface Settings { ai_enabled: boolean; daily_limit: number; club_daily_limit: number; per_minute: number }
interface ClubRow { club_id: string; scoring_enabled: boolean; ai_allowed: boolean; ai_used: number; linked: number }
interface Data {
  settings: Settings | null;
  setup: { bot: boolean; ai: boolean; models: Record<string, string> };
  today: { messages: number; short: number; flash: number; gemma: number; none: number; errors: number; lastError: string | null };
  clubs: ClubRow[];
}

const LIMITS: { key: 'daily_limit' | 'club_daily_limit' | 'per_minute'; label: string; note: string }[] = [
  { key: 'daily_limit', label: 'All clubs, AI messages a day', note: "Google's reported free limit for Flash-Lite is about 500" },
  { key: 'club_daily_limit', label: 'Any one club, AI messages a day', note: "So one busy club can't use everyone's share" },
  { key: 'per_minute', label: 'One chat, messages a minute', note: 'Stops a stuck phone or a prank' },
];

function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  return <div className="mc-track"><span style={{ width: `${max ? Math.min(100, Math.round((value / max) * 100)) : 0}%`, background: color }} /></div>;
}

/** Score by chat: the AI master switch, daily limits, today's use and each club's AI switch */
export default function ChatAiTab({ clubs }: { clubs: PlatformClubItem[] }) {
  const canChange = useCanChange();
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [limits, setLimits] = useState<Settings | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState('');
  // The bot card's own result, shown under its buttons (the page note is out of sight on a phone)
  const [botNote, setBotNote] = useState('');
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await platformApi<Data>('chat');
    setLoading(false);
    setError(res.error || '');
    if (!res.error) {
      setData(res);
      setLimits(res.settings);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const save = async (next: Settings, what: string) => {
    setBusy(what);
    const res = await platformApi('chat', { action: 'settings', ...next });
    setBusy('');
    setNote(res.error || (what === 'switch' ? `AI is ${next.ai_enabled ? 'on' : 'off'}.` : 'Limits saved.'));
    if (!res.error) load();
  };
  const setClub = async (clubId: string, aiAllowed: boolean) => {
    setBusy(clubId);
    const res = await platformApi('chat', { action: 'club', clubId, aiAllowed });
    setBusy('');
    if (res.error) setNote(res.error); else load();
  };
  const run = async (action: 'webhook' | 'test', reader?: string) => {
    setBusy(action + (reader || ''));
    setBotNote('');
    const res = await platformApi<{ ok?: boolean; model?: string; answer?: string; error?: string }>('chat', { action, reader });
    setBusy('');
    if (action === 'webhook') setBotNote(res.error || 'The bot is connected. Telegram now sends messages to this site.');
    else setBotNote(res.ok ? `${res.model} works: it read the sample message.` : `${res.model || reader} didn't work: ${res.error || `it answered "${res.answer}"`}`);
  };

  const s = data?.settings;
  const t = data?.today;
  const byClub = new Map((data?.clubs || []).map(c => [c.club_id, c]));
  const rows = [...clubs].sort((a, b) => (byClub.get(b.id)?.ai_allowed ? 1 : 0) - (byClub.get(a.id)?.ai_allowed ? 1 : 0) || a.name.localeCompare(b.name));
  const shown = showAll ? rows : rows.slice(0, 8);
  const aiUsed = (t?.flash || 0) + (t?.gemma || 0);

  return (
    <div>
      <div className="mc-page-h">
        <div>
          <h1>AI and chat</h1>
          <p>Score updates by chat, and the AI that reads messages that aren&apos;t in the short format.</p>
        </div>
        <div className="right">
          <button type="button" className="mc-pill-btn ghost" onClick={load} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {error && <section className="mc-card"><p role="alert" style={{ color: 'var(--mc-red)', margin: 0 }}>{error}</p></section>}
      {note && <p role="status" className="mc-muted" style={{ margin: '0 0 12px' }}>{note}</p>}

      {s && t && limits && (
        <fieldset className="mc-fs" disabled={!canChange} style={{ display: 'grid', gap: 16 }}>
          <section className="mc-card mc-ai-top">
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>AI is {s.ai_enabled ? 'on' : 'off'}</h3>
              <p className="mc-muted" style={{ margin: '4px 0 0', fontSize: 13 }}>Turn it off and every club falls back to the short format (g sam 23). Nothing goes to Google.</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className={`mc-flag${s.ai_enabled ? ' ok' : ''}`}>{s.ai_enabled ? 'On' : 'Off'}</span>
              <button type="button" className="mc-switch" role="switch" aria-checked={s.ai_enabled} aria-label="AI for every club"
                disabled={busy === 'switch'} onClick={() => save({ ...s, ai_enabled: !s.ai_enabled }, 'switch')} />
            </div>
          </section>

          {(!data.setup.bot || !data.setup.ai) && (
            <section className="mc-card">
              <h3 style={{ fontSize: 15, fontWeight: 600, margin: '0 0 6px' }}>Set up</h3>
              <ul className="mc-muted" style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.6 }}>
                {!data.setup.ai && <li>Add <code>GEMINI_API_KEY</code> (free from Google AI Studio) to the site&apos;s Cloudflare secrets.</li>}
                {!data.setup.bot && <li>Add <code>TELEGRAM_BOT_TOKEN</code>, <code>TELEGRAM_BOT_USERNAME</code> and <code>TELEGRAM_WEBHOOK_SECRET</code>, then press Connect the bot.</li>}
              </ul>
            </section>
          )}

          <div className="mc-ai-grid">
            <section className="mc-card">
              <div className="mc-card-h"><h3>Today</h3><span className="mc-eyebrow">Resets at midnight Sydney time</span></div>
              <div className="mc-kpis" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', marginBottom: 16 }}>
                <div className="mc-kpi"><div className="mc-eyebrow">Chat messages</div><b className="num">{t.messages}</b></div>
                <div className="mc-kpi"><div className="mc-eyebrow">Read by AI</div><b className="num">{aiUsed}</b></div>
                <div className="mc-kpi"><div className="mc-eyebrow">Couldn&apos;t read</div><b className="num">{t.none}</b></div>
              </div>
              <div className="mc-ai-use">
                <div><span>Short format</span><Bar value={t.short} max={t.messages} color="var(--mc-green)" /><b className="num">{t.short}</b></div>
                <div><span>Flash-Lite</span><Bar value={t.flash} max={t.messages} color="var(--mc-indigo)" /><b className="num">{t.flash}</b></div>
                <div><span>Gemma 4</span><Bar value={t.gemma} max={t.messages} color="var(--mc-amber)" /><b className="num">{t.gemma}</b></div>
                <div><span>AI vs limit</span><Bar value={t.flash} max={s.daily_limit} color="var(--mc-indigo)" /><b className="num">{t.flash} / {s.daily_limit}</b></div>
              </div>
              <p className="mc-muted" style={{ fontSize: 12, margin: '12px 0 0' }}>
                {t.errors ? `${t.errors} AI ${t.errors === 1 ? 'error' : 'errors'} today, last ${timeAgo(t.lastError!)}. The next model took over each time.` : 'No AI errors today.'}
              </p>
            </section>

            <section className="mc-card">
              <div className="mc-card-h"><h3>Daily limits</h3></div>
              <div className="mc-ai-lim">
                {LIMITS.map(l => (
                  <label key={l.key}>
                    {l.label}<small>{l.note}</small>
                    <input className="mc-input num" inputMode="numeric" value={String(limits[l.key])} aria-label={l.label}
                      onChange={e => setLimits({ ...limits, [l.key]: Number(e.target.value.replace(/\D/g, '').slice(0, 6)) })} />
                  </label>
                ))}
              </div>
              <p className="mc-muted" style={{ fontSize: 12, margin: '12px 0 0' }}>At the daily limit the bot moves to Gemma 4, then to the short format only, and tells the scorer.</p>
              <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end' }}>
                <button type="button" className="mc-pill-btn" disabled={busy === 'limits'} onClick={() => save({ ...limits, ai_enabled: s.ai_enabled }, 'limits')}>
                  {busy === 'limits' ? 'Saving…' : 'Save limits'}
                </button>
              </div>
            </section>
          </div>

          <section className="mc-card">
            <div className="mc-card-h"><h3>Clubs</h3><span className="mc-eyebrow">New clubs start with AI off</span></div>
            <div className="mc-table-wrap">
              <table className="mc-table">
                <thead><tr><th>Club</th><th>AI used</th><th style={{ textAlign: 'right' }}>AI</th></tr></thead>
                <tbody>
                  {shown.map(c => {
                    const r = byClub.get(c.id);
                    const bits = [r?.scoring_enabled ? 'Score by chat on' : 'Score by chat off', r?.linked ? `${r.linked} linked` : ''].filter(Boolean).join(', ');
                    return (
                      <tr key={c.id}>
                        <td><b style={{ fontWeight: 600 }}>{c.name}</b><br /><span className="mc-muted">{bits}</span></td>
                        <td className="num">{r?.ai_used || 0} / {s.club_daily_limit} today</td>
                        <td style={{ textAlign: 'right' }}>
                          <button type="button" className="mc-switch" role="switch" aria-checked={!!r?.ai_allowed} aria-label={`AI for ${c.name}`}
                            disabled={busy === c.id} onClick={() => setClub(c.id, !r?.ai_allowed)} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {rows.length > 8 && (
              <div className="mc-more">
                <span>Showing {shown.length} of {rows.length} clubs</span>
                <button type="button" className="mc-pill-btn ghost" onClick={() => setShowAll(v => !v)}>{showAll ? 'Show fewer' : 'Show all'}</button>
              </div>
            )}
            <p className="mc-muted" style={{ fontSize: 11, margin: '10px 0 0' }}>Junior teams always use the short format: their names never go to the AI.</p>
          </section>

          <section className="mc-card">
            <div className="mc-card-h"><h3>Bot and models</h3></div>
            <dl className="mc-kv">
              <dt>Telegram bot</dt><dd>{data.setup.bot ? 'Set up' : 'Not set up'}</dd>
              <dt>Gemini key</dt><dd>{data.setup.ai ? 'Set up' : 'Not set up'}</dd>
              <dt>First model</dt><dd><code>{data.setup.models['flash-lite']}</code></dd>
              <dt>Backup model</dt><dd><code>{data.setup.models.gemma}</code></dd>
            </dl>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
              <button type="button" className="mc-pill-btn ghost" disabled={!data.setup.bot || busy === 'webhook'} onClick={() => run('webhook')}>{busy === 'webhook' ? 'Connecting…' : 'Connect the bot'}</button>
              <button type="button" className="mc-pill-btn ghost" disabled={!data.setup.ai || busy === 'testflash-lite'} onClick={() => run('test', 'flash-lite')}>{busy === 'testflash-lite' ? 'Testing…' : 'Test Flash-Lite'}</button>
              <button type="button" className="mc-pill-btn ghost" disabled={!data.setup.ai || busy === 'testgemma'} onClick={() => run('test', 'gemma')}>{busy === 'testgemma' ? 'Testing…' : 'Test Gemma 4'}</button>
            </div>
            {botNote && <p role="status" className="mc-muted" style={{ margin: '12px 0 0', overflowWrap: 'anywhere' }}>{botNote}</p>}
          </section>
        </fieldset>
      )}
    </div>
  );
}
