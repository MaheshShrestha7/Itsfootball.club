'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { getSupabaseClient } from '@/lib/supabase/client';
import { platformApi } from '@/components/admin/platform/api';
import { Crest, Avatar } from '@/components/admin/platform/McArt';
import { formatMoney } from '@/lib/finance';
import type { HealthReport } from '@/lib/platform-health';
import type { PlatformClubItem, PlatformClubMember, PlatformMetrics, PlatformOverview, OverviewClubRef } from '@/lib/supabase/types';
import OverviewPulse from '@/components/admin/platform/OverviewPulse';
import {
  FEATURES, GROUP_LABEL, KIND_LABEL, METHOD_LABEL, SOURCE_LABEL,
  changeLabel, pageLabel, quietClubs, ranked, setupFunnel, sparkBars, timeAgo,
  type Light, type MissionTab,
} from '@/lib/mission-control';
import {
  Wallet, TrendingUp, LayoutGrid, Globe, AlertTriangle, ChevronRight, ChevronLeft, RefreshCw, Lock, Search, ExternalLink,
} from 'lucide-react';

type Screen =
  | { kind: 'home' }
  | { kind: 'money' | 'growth' | 'usage' | 'traffic' | 'problems' }
  | { kind: 'clubs'; title: string; sub: string; ids: string[] }
  | { kind: 'members'; clubId: string; from: Screen };

interface OverviewTabProps {
  clubs: PlatformClubItem[];
  /** get_platform_metrics, for the week strip and the live feed */
  metrics: PlatformMetrics | null;
  periodDays: number;
  periodOptions: { days: number; label: string }[];
  onPeriodChange: (days: number) => void;
  onSelectTab: (tab: MissionTab) => void;
  onSelectClub: (club: PlatformClubItem) => void;
  onRefreshClubs: () => void;
}

const LIGHT_COLOR: Record<Light, string> = { red: 'var(--mc-red)', amber: 'var(--mc-amber)', green: 'var(--mc-green)', grey: 'var(--mc-ink-3)' };
const MIX_COLORS = ['var(--mc-green)', 'var(--mc-indigo)', 'var(--mc-amber)', 'var(--mc-pink-ink)', 'var(--mc-sky-ink)', 'var(--mc-ink-3)'];
const n = (v: number | null | undefined) => (Number(v) || 0).toLocaleString('en-AU');
const money = (cents: number | null | undefined) => formatMoney(Number(cents) || 0, 'AUD');
const shortMoney = (cents: number | null | undefined) => {
  const d = (Number(cents) || 0) / 100;
  return d >= 10000 ? `$${(d / 1000).toFixed(d >= 100000 ? 0 : 1)}k` : formatMoney(Math.round(d) * 100, 'AUD').replace(/\.00$/, '');
};
const dayLabel = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }) : '');

/** Mission Control -> Overview: money, club growth, feature usage, site traffic and problems, with drill-down. */
export default function OverviewTab({ clubs, metrics, periodDays, periodOptions, onPeriodChange, onSelectTab, onSelectClub, onRefreshClubs }: OverviewTabProps) {
  const [data, setData] = useState<PlatformOverview | null>(null);
  const [health, setHealth] = useState<HealthReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [screen, setScreen] = useState<Screen>({ kind: 'home' });

  const load = useCallback(async () => {
    const client = getSupabaseClient();
    if (!client) return;
    setLoading(true);
    const [res, h] = await Promise.all([
      client.rpc('get_platform_overview', { p_days: periodDays }),
      platformApi<HealthReport>('health?quick=1'),
    ]);
    setLoading(false);
    if (res.error) {
      setError(/get_platform_overview|function/i.test(res.error.message)
        ? 'The Overview needs migration 20261149_mission_control_overview.sql. Run it in Supabase, then refresh.'
        : res.error.message);
    } else {
      setError('');
      setData(res.data as PlatformOverview);
    }
    setHealth(h.error ? null : h);
  }, [periodDays]);

  useEffect(() => { load(); }, [load]);

  const go = (s: Screen) => { setScreen(s); window.scrollTo({ top: 0 }); };
  const byId = useMemo(() => new Map(clubs.map(c => [c.id, c])), [clubs]);
  const openMembers = (clubId: string) => go({ kind: 'members', clubId, from: screen });

  const header = (title: string, sub: string, withPeriod = true) => (
    <>
      {screen.kind !== 'home' && (
        <button type="button" className="mc-back" onClick={() => go(screen.kind === 'members' ? screen.from : { kind: 'home' })}>
          <ChevronLeft size={14} />{screen.kind === 'members' && screen.from.kind !== 'home' ? 'Back' : 'Overview'}
        </button>
      )}
      <div className="mc-page-h">
        <div>
          <h1>{title}</h1>
          <p>{sub}</p>
        </div>
        {withPeriod && (
          <div className="right">
            <div className="mc-seg" role="group" aria-label="Time range">
              {periodOptions.map(o => (
                <button key={o.days} type="button" aria-pressed={periodDays === o.days} onClick={() => onPeriodChange(o.days)}>{o.label}</button>
              ))}
            </div>
            <button type="button" className="mc-icon-btn" aria-label="Refresh" title="Refresh" disabled={loading} onClick={() => { load(); onRefreshClubs(); }}>
              <RefreshCw size={14} className={loading ? 'spin' : undefined} />
            </button>
          </div>
        )}
      </div>
      {error && <div className="mc-ov-warn" role="alert">{error}</div>}
    </>
  );

  if (screen.kind === 'members') {
    const club = byId.get(screen.clubId);
    return (
      <div>
        {header('Members', club ? club.name : 'Club', false)}
        <MembersList clubId={screen.clubId} club={club} onOpenConsole={club ? () => onSelectClub(club) : undefined} />
      </div>
    );
  }

  if (!data) {
    return (
      <div>
        {header('Overview', 'The whole platform at a glance. Tap a card to dig in.')}
        {!error && <div className="mc-card mc-empty">Loading the numbers…</div>}
      </div>
    );
  }

  const { money: m, growth: g, usage: u, traffic: t, problems: p } = data;
  const funnel = setupFunnel(clubs);
  const quiet = quietClubs(clubs);
  const healthBad = (health?.signals || []).filter(s => s.light === 'red' || s.light === 'amber');
  const lights: { key: string; label: string; light: Light; value: string; to: () => void }[] = [
    { key: 'crash', label: 'Pages that crashed for a visitor', light: p.crashes_24h > 0 ? 'amber' : 'green', value: p.crashes_24h ? `${n(p.crashes_24h)} today` : 'None today', to: () => go({ kind: 'problems' }) },
    { key: 'transfer', label: 'Bank transfers waiting over 7 days', light: p.transfers_waiting_7d.count > 0 ? 'amber' : 'green', value: p.transfers_waiting_7d.count ? `${n(p.transfers_waiting_7d.clubs)} ${p.transfers_waiting_7d.clubs === 1 ? 'club' : 'clubs'}` : 'None', to: () => go({ kind: 'problems' }) },
    { key: 'support', label: 'Support open over 2 days', light: p.support_open_2d > 0 ? 'amber' : 'green', value: p.support_open_2d ? n(p.support_open_2d) : 'None', to: () => onSelectTab('support') },
    { key: 'enquiry', label: 'Club enquiries unread over 3 days', light: p.enquiries_unread_3d.count > 0 ? 'amber' : 'green', value: p.enquiries_unread_3d.count ? `${n(p.enquiries_unread_3d.clubs)} ${p.enquiries_unread_3d.clubs === 1 ? 'club' : 'clubs'}` : 'None', to: () => go({ kind: 'problems' }) },
    {
      key: 'health', label: 'Emails, jobs, Stripe, domains',
      light: !health ? 'grey' : healthBad.some(s => s.light === 'red') ? 'red' : healthBad.length ? 'amber' : 'green',
      value: !health ? 'Not checked' : healthBad.length ? `${healthBad.length} to look at` : 'All fine', to: () => onSelectTab('health'),
    },
  ];
  const toLook = lights.filter(l => l.light === 'red' || l.light === 'amber').length;
  const featureCount = (key: string) => Number(u.features[key]) || 0;
  const clubsUsing = (key: string) => Object.entries(u.by_club).filter(([, fs]) => fs.includes(key)).map(([id]) => id);
  const feesSince = m.fees_since ? `Counted from ${dayLabel(m.fees_since)}` : 'Counted from the next card payment';
  const trafficSince = t.since ? `Counted from ${dayLabel(t.since)}` : 'Counted from the next visit';

  // ------------------------------------------------------------------ Home: the five cards
  if (screen.kind === 'home') {
    return (
      <div>
        {header('Overview', 'The whole platform at a glance. Tap a card to dig in.')}
        <div className="mc-ov">
          <button type="button" className="mc-card mc-ov-card wide" onClick={() => go({ kind: 'money' })}>
            <div className="mc-card-h">
              <span className="rk"><span className="mc-sq" style={{ background: 'var(--mc-mint)', color: 'var(--mc-green-ink)' }}><Wallet size={14} /></span><h3>Money</h3></span>
              <span className="mc-ov-since">{feesSince}</span>
            </div>
            <div className="mc-stat-pair">
              <div><span className="mc-eyebrow">Platform earned</span><div className="mc-big num">{shortMoney(m.earned_cents)}<small>booking fees</small></div></div>
            </div>
            <div className="mc-ov-nums">
              <div><b className="num">{shortMoney(m.through_cents)}</b><small>through clubs</small><Change now={m.through_cents} prev={m.through_prev_cents} /></div>
              <div><b className="num">{shortMoney(m.awaiting_review.cents)}</b><small>waiting on clubs</small></div>
              <div><b className="num">{n(m.failed + m.refunded)}</b><small>failed or refunded</small></div>
            </div>
            <Spark values={m.daily.map(d => d.through_cents)} />
            <div className="mc-ov-foot"><span>Card, bank transfer and cash split inside</span><span className="go">Open <ChevronRight size={13} /></span></div>
          </button>

          <button type="button" className="mc-card mc-ov-card" onClick={() => go({ kind: 'growth' })}>
            <div className="mc-card-h">
              <span className="rk"><span className="mc-sq" style={{ background: 'var(--mc-lilac)', color: 'var(--mc-indigo)' }}><TrendingUp size={14} /></span><h3>Club growth</h3></span>
            </div>
            <div className="mc-ov-nums">
              <div><b className="num">{n(g.new_clubs)}</b><small>new clubs</small><Change now={g.new_clubs} prev={g.new_clubs_prev} /></div>
              <div><b className="num">{n(g.new_members)}</b><small>new members</small><Change now={g.new_members} prev={g.new_members_prev} /></div>
              <div><b className="num">{n(quiet.length)}</b><small>quiet clubs (no admin in 14 days)</small></div>
            </div>
            <FunnelRows steps={[funnel[0], funnel[3], funnel[4]]} />
            <div className="mc-ov-foot"><span>{n(g.renew_30d)} memberships renew in 30 days</span><span className="go">Open <ChevronRight size={13} /></span></div>
          </button>

          <button type="button" className="mc-card mc-ov-card" onClick={() => go({ kind: 'usage' })}>
            <div className="mc-card-h">
              <span className="rk"><span className="mc-sq" style={{ background: 'var(--mc-pink)', color: 'var(--mc-pink-ink)' }}><LayoutGrid size={14} /></span><h3>Feature usage</h3></span>
              <span className="mc-ov-since">clubs that used it</span>
            </div>
            <div className="mc-ov-feat">
              {[...FEATURES].sort((a, b) => featureCount(b.key) - featureCount(a.key)).slice(0, 5).map(f => (
                <FeatureRow key={f.key} label={f.label} used={featureCount(f.key)} of={u.clubs} />
              ))}
            </div>
            <div className="mc-ov-foot"><span>{FEATURES.length} features in total</span><span className="go">Open <ChevronRight size={13} /></span></div>
          </button>

          <button type="button" className="mc-card mc-ov-card" onClick={() => go({ kind: 'traffic' })}>
            <div className="mc-card-h">
              <span className="rk"><span className="mc-sq" style={{ background: 'var(--mc-sky)', color: 'var(--mc-sky-ink)' }}><Globe size={14} /></span><h3>Public site traffic</h3></span>
              <span className="mc-ov-since">{trafficSince}</span>
            </div>
            <div className="mc-ov-nums">
              <div><b className="num">{n(t.visits)}</b><small>visits</small></div>
              <div><b className="num">{n(t.visitors)}</b><small>visitors</small></div>
              <div><b className="num">{n(t.tool_uses)}</b><small>tool uses</small></div>
            </div>
            <Spark values={t.daily.map(d => d.visits)} pink />
            <div className="mc-ov-foot">
              <span>{t.top_pages[0] ? `Top: ${pageLabel(t.top_pages[0].path)}, ${n(t.top_pages[0].visits)} visits` : 'No visits counted yet'}</span>
              <span className="go">Open <ChevronRight size={13} /></span>
            </div>
          </button>

          <button type="button" className="mc-card mc-ov-card" onClick={() => go({ kind: 'problems' })}>
            <div className="mc-card-h">
              <span className="rk"><span className="mc-sq" style={{ background: 'var(--mc-amber-bg)', color: 'var(--mc-amber)' }}><AlertTriangle size={14} /></span><h3>Technical problems</h3></span>
              <span className={`mc-flag ${toLook ? 'warn' : 'ok'}`}>{toLook ? `${toLook} to look at` : 'All fine'}</span>
            </div>
            <div>
              {lights.map(l => (
                <div key={l.key} className="mc-ov-light"><i className="lt" style={{ background: LIGHT_COLOR[l.light] }} /><span>{l.label}</span><small>{l.value}</small></div>
              ))}
            </div>
            <div className="mc-ov-foot"><span>Same lights as System health</span><span className="go">Open <ChevronRight size={13} /></span></div>
          </button>
          <OverviewPulse metrics={metrics} periodDays={periodDays} />
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------------ Money
  if (screen.kind === 'money') {
    const methods = ranked(m.by_method);
    const kinds = ranked(m.by_kind);
    const totalPaid = methods.reduce((a, [, v]) => a + v, 0);
    const kindMax = kinds[0]?.[1] || 1;
    return (
      <div>
        {header('Money', `Last ${data.period_days} days. Booking fees ${feesSince.toLowerCase()}.`)}
        <div className="mc-ov">
          <div className="mc-card wide">
            <div className="mc-kpis" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
              <div className="mc-kpi"><span className="mc-eyebrow">Platform earned</span><b className="num">{money(m.earned_cents)}</b><small>{m.fee_refunded_cents ? `${money(m.fee_refunded_cents)} handed back on refunds` : 'booking fees on card payments'}</small></div>
              <div className="mc-kpi"><span className="mc-eyebrow">Earned all time</span><b className="num">{money(m.earned_all_cents)}</b><small>{feesSince.toLowerCase()}</small></div>
              <div className="mc-kpi"><span className="mc-eyebrow">Through clubs</span><b className="num">{money(m.through_cents)}</b><small>{changeLabel(m.through_cents, m.through_prev_cents) ? `${changeLabel(m.through_cents, m.through_prev_cents)} on the ${data.period_days} days before` : 'paid to clubs'}</small></div>
            </div>
            <Spark values={m.daily.map(d => d.through_cents)} tall />
          </div>

          <div className="mc-card">
            <div className="mc-card-h"><h3>How it was paid</h3></div>
            {totalPaid ? (
              <>
                <div className="mc-ov-mix" role="img" aria-label={methods.map(([k, v]) => `${METHOD_LABEL[k] || k} ${money(v)}`).join(', ')}>
                  {methods.map(([k, v], i) => <span key={k} style={{ flex: v, background: MIX_COLORS[i % MIX_COLORS.length] }} />)}
                </div>
                <div className="mc-ov-legend">
                  {methods.map(([k, v], i) => <span key={k}><i style={{ background: MIX_COLORS[i % MIX_COLORS.length] }} />{METHOD_LABEL[k] || k}<b className="num">{money(v)}</b></span>)}
                </div>
              </>
            ) : <p className="mc-muted">No payments in this period.</p>}
            <div className="mc-card-h" style={{ marginTop: 18 }}><h3>What it was for</h3></div>
            <div className="mc-funnel">
              {kinds.length ? kinds.map(([k, v]) => (
                <div key={k} className="mc-funnel-row">
                  <div className="top"><span>{KIND_LABEL[k] || k}</span><span className="num">{money(v)}</span></div>
                  <div className="mc-track"><span style={{ width: `${Math.max(3, (v / kindMax) * 100)}%`, background: 'var(--mc-green)' }} /></div>
                </div>
              )) : <p className="mc-muted">Nothing yet.</p>}
            </div>
          </div>

          <div className="mc-card">
            <div className="mc-card-h"><h3>Waiting on clubs</h3><span className="mc-flag warn">{money(m.awaiting_review.cents + m.pending.cents)}</span></div>
            <div className="mc-ov-light"><i className="lt" style={{ background: 'var(--mc-amber)' }} /><span>Bank transfers to confirm</span><small>{n(m.awaiting_review.count)} · {money(m.awaiting_review.cents)}</small></div>
            <div className="mc-ov-light"><i className="lt" style={{ background: 'var(--mc-ink-3)' }} /><span>Started or invoiced, not paid yet</span><small>{n(m.pending.count)} · {money(m.pending.cents)}</small></div>
            <div className="mc-ov-light"><i className="lt" style={{ background: 'var(--mc-red)' }} /><span>Failed</span><small>{n(m.failed)}</small></div>
            <div className="mc-ov-light"><i className="lt" style={{ background: 'var(--mc-red)' }} /><span>Refunded</span><small>{n(m.refunded)}</small></div>
          </div>

          <div className="mc-card wide">
            <div className="mc-card-h"><h3>Clubs by booking fees</h3><span className="mc-eyebrow">tap a club</span></div>
            <ClubList
              rows={m.top_fee_clubs.map(c => ({ ref: c, sub: `${money(c.through_cents)} by card through the club`, right: money(c.fee_cents) }))}
              empty="No booking fees counted yet."
              onOpen={openMembers}
            />
          </div>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------------ Growth
  if (screen.kind === 'growth') {
    return (
      <div>
        {header('Club growth', `Last ${data.period_days} days. Setup steps are for open clubs today.`)}
        <div className="mc-ov">
          <div className="mc-card wide">
            <div className="mc-ov-nums" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))' }}>
              <div><b className="num">{n(g.new_clubs)}</b><small>new clubs</small><Change now={g.new_clubs} prev={g.new_clubs_prev} /></div>
              <div><b className="num">{n(g.new_members)}</b><small>new members</small><Change now={g.new_members} prev={g.new_members_prev} /></div>
              <div><b className="num">{n(g.renew_30d)}</b><small>renew in the next 30 days</small></div>
              <div><b className="num">{n(g.lapsed_30d)}</b><small>lapsed in the last 30 days</small></div>
              <div><b className="num">{n(g.closing)}</b><small>clubs closing</small></div>
            </div>
          </div>

          <div className="mc-card">
            <div className="mc-card-h"><h3>Setup funnel</h3><span className="mc-eyebrow">tap a step</span></div>
            <FunnelRows
              steps={funnel}
              onPick={i => {
                const step = funnel[i];
                const missing = funnel[0].clubs.filter(c => !step.clubs.includes(c));
                go(i === 0
                  ? { kind: 'clubs', title: 'Open clubs', sub: `${n(step.clubs.length)} clubs`, ids: step.clubs.map(c => c.id) }
                  : { kind: 'clubs', title: `Not yet: ${step.label.toLowerCase()}`, sub: `${n(missing.length)} of ${n(funnel[0].clubs.length)} open clubs`, ids: missing.map(c => c.id) });
              }}
            />
          </div>

          <div className="mc-card">
            <div className="mc-card-h"><h3>Fastest growing</h3><span className="mc-eyebrow">new members</span></div>
            <ClubList rows={g.top_growing.map(c => ({ ref: c, sub: `${n(c.joined)} joined in ${data.period_days} days`, right: `+${n(c.joined)}` }))} empty="Nobody joined in this period." onOpen={openMembers} />
          </div>

          <div className="mc-card wide">
            <div className="mc-card-h"><h3>Quiet clubs</h3><span className="mc-eyebrow">no admin signed in for 14 days</span></div>
            <ClubList
              rows={quiet.slice(0, 30).map(c => ({ ref: c, sub: c.admin_last_seen_at ? `Admin last seen ${timeAgo(c.admin_last_seen_at)}` : 'No admin sign-in recorded', right: `${n(c.member_count)} members` }))}
              empty="Every open club had an admin in within 14 days."
              onOpen={openMembers}
            />
          </div>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------------ Feature usage
  if (screen.kind === 'usage') {
    return <UsageScreen header={header(`Feature usage`, `Clubs that used each feature in the last ${data.period_days} days.`)} usage={u} clubs={clubs} featureCount={featureCount}
      onFeature={(key, label) => { const ids = clubsUsing(key); go({ kind: 'clubs', title: label, sub: `${n(ids.length)} of ${n(u.clubs)} open clubs used it`, ids }); }}
      onOpen={openMembers} />;
  }

  // ------------------------------------------------------------------ Traffic
  if (screen.kind === 'traffic') {
    const groups = ranked(t.groups);
    const sources = ranked(t.sources).filter(([k]) => k !== 'internal');
    const devices = ranked(t.devices);
    const sourceTotal = sources.reduce((a, [, v]) => a + v, 0);
    const deviceTotal = devices.reduce((a, [, v]) => a + v, 0);
    const pageMax = t.top_pages[0]?.visits || 1;
    return (
      <div>
        {header('Public site traffic', `Last ${data.period_days} days on itsfootball.club. ${trafficSince}.`)}
        <div className="mc-ov">
          <div className="mc-card wide">
            <div className="mc-ov-nums" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))' }}>
              <div><b className="num">{n(t.visits)}</b><small>visits</small></div>
              <div><b className="num">{n(t.visitors)}</b><small>visitors</small></div>
              <div><b className="num">{n(t.tool_uses)}</b><small>tool uses (downloads, shares, tournaments made)</small></div>
              <div><b className="num">{n(t.create_club_visits)}</b><small>visits to Create a club</small></div>
            </div>
            <Spark values={t.daily.map(d => d.visits)} pink tall />
          </div>

          <div className="mc-card">
            <div className="mc-card-h"><h3>Top pages</h3></div>
            <div className="mc-funnel">
              {t.top_pages.length ? t.top_pages.map(pg => (
                <div key={pg.path} className="mc-funnel-row">
                  <div className="top"><span title={pg.path}>{pageLabel(pg.path)}</span><span className="num">{n(pg.visits)}</span></div>
                  <div className="mc-track"><span style={{ width: `${Math.max(3, (pg.visits / pageMax) * 100)}%`, background: 'var(--mc-sky-ink)' }} /></div>
                </div>
              )) : <p className="mc-muted">No visits counted yet.</p>}
            </div>
          </div>

          <div className="mc-card">
            <div className="mc-card-h"><h3>Where visitors came from</h3></div>
            {sourceTotal ? (
              <>
                <div className="mc-ov-mix">{sources.map(([k, v], i) => <span key={k} style={{ flex: v, background: MIX_COLORS[i % MIX_COLORS.length] }} />)}</div>
                <div className="mc-ov-legend">{sources.map(([k, v], i) => <span key={k}><i style={{ background: MIX_COLORS[i % MIX_COLORS.length] }} />{SOURCE_LABEL[k] || k}<b className="num">{Math.round((v / sourceTotal) * 100)}%</b></span>)}</div>
              </>
            ) : <p className="mc-muted">Nothing yet.</p>}
            <div className="mc-card-h" style={{ marginTop: 18 }}><h3>Phone or desktop</h3></div>
            {deviceTotal ? (
              <div className="mc-ov-legend">{devices.map(([k, v], i) => <span key={k}><i style={{ background: MIX_COLORS[i % MIX_COLORS.length] }} />{k}<b className="num">{Math.round((v / deviceTotal) * 100)}%</b></span>)}</div>
            ) : <p className="mc-muted">Nothing yet.</p>}
          </div>

          <div className="mc-card">
            <div className="mc-card-h"><h3>By section</h3></div>
            <div className="mc-ov-legend" style={{ gridTemplateColumns: '1fr' }}>
              {groups.length ? groups.map(([k, v]) => <span key={k}>{GROUP_LABEL[k] || k}<b className="num">{n(v)}</b></span>) : <p className="mc-muted">Nothing yet.</p>}
            </div>
          </div>

          <div className="mc-card">
            <div className="mc-card-h"><h3>Most used tools</h3></div>
            <div className="mc-ov-legend" style={{ gridTemplateColumns: '1fr' }}>
              {t.top_tools.length ? t.top_tools.map(tl => <span key={tl.path}>{pageLabel(tl.path)}<b className="num">{n(tl.uses)}</b></span>) : <p className="mc-muted">No tool uses counted yet.</p>}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------------ Problems
  if (screen.kind === 'problems') {
    return (
      <div>
        {header('Technical problems', 'Things to look at now. Nothing here sends you an email.')}
        <div className="mc-ov">
          <div className="mc-card wide">
            {lights.map(l => (
              <button key={l.key} type="button" className="mc-ov-light" onClick={l.to} style={{ width: '100%', border: 0, borderTop: '1px solid var(--mc-line)', background: 'none', font: 'inherit', textAlign: 'left', cursor: 'pointer' }}>
                <i className="lt" style={{ background: LIGHT_COLOR[l.light] }} /><span>{l.label}</span><small>{l.value}</small><ChevronRight size={13} style={{ color: 'var(--mc-ink-3)' }} />
              </button>
            ))}
            <div className="mc-ov-light"><i className="lt" style={{ background: 'var(--mc-ink-3)' }} /><span>Email opt-outs, last {data.period_days} days</span><small>{n(p.opt_outs_period)}</small></div>
            <div className="mc-ov-light"><i className="lt" style={{ background: p.failed_payments ? 'var(--mc-amber)' : 'var(--mc-green)' }} /><span>Failed payments, last {data.period_days} days</span><small>{n(p.failed_payments)}</small></div>
          </div>

          {healthBad.length > 0 && (
            <div className="mc-card wide">
              <div className="mc-card-h"><h3>From System health</h3></div>
              {healthBad.map(s => (
                <div key={s.key} className="mc-ov-light"><i className="lt" style={{ background: LIGHT_COLOR[s.light] }} /><span><b style={{ fontWeight: 600 }}>{s.label}</b><br /><small style={{ whiteSpace: 'normal' }}>{s.summary}</small></span></div>
              ))}
            </div>
          )}

          <div className="mc-card wide">
            <div className="mc-card-h"><h3>Recent page crashes</h3><span className="mc-eyebrow">{n(p.crashes_period)} in {data.period_days} days</span></div>
            {p.recent_crashes.length ? p.recent_crashes.map((c, i) => (
              <div key={i} className="mc-ov-light">
                <i className="lt" style={{ background: 'var(--mc-amber)' }} />
                <span style={{ minWidth: 0 }}><b style={{ fontWeight: 600, overflowWrap: 'anywhere' }}>{c.path || 'Unknown page'}</b><br /><small style={{ whiteSpace: 'normal', overflowWrap: 'anywhere' }}>{c.message || 'No message'}</small></span>
                <small>{timeAgo(c.at)}</small>
              </div>
            )) : <p className="mc-muted">No crashes recorded.</p>}
          </div>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------------ A list of clubs (from a funnel step or feature)
  if (screen.kind !== 'clubs') return null;
  const list = screen.ids.map(id => byId.get(id)).filter((c): c is PlatformClubItem => !!c);
  return (
    <div>
      {header(screen.title, screen.sub, false)}
      <div className="mc-card">
        <ClubList
          rows={list.map(c => ({
            ref: c,
            sub: `${n(c.member_count)} members · ${(u.by_club[c.id] || []).length} of ${FEATURES.length} features`,
            right: <ChevronRight size={14} />,
          }))}
          empty="No clubs here."
          onOpen={openMembers}
        />
      </div>
    </div>
  );
}

function Change({ now, prev }: { now: number; prev: number }) {
  const label = changeLabel(now, prev);
  if (!label) return null;
  return <span className={label.startsWith('-') ? 'down' : 'up'}>{label}</span>;
}

function Spark({ values, pink, tall }: { values: number[]; pink?: boolean; tall?: boolean }) {
  const bars = sparkBars(values, tall ? 18 : 12);
  return (
    <div className={`mc-ov-spark${pink ? ' pink' : ''}${tall ? ' tall' : ''}`} aria-hidden="true">
      {bars.map((h, i) => <span key={i} style={{ height: `${Math.max(8, h)}%` }} />)}
    </div>
  );
}

function FeatureRow({ label, used, of }: { label: string; used: number; of: number }) {
  return (
    <div className="row">
      <span>{label}</span><em>{n(used)} of {n(of)}</em>
      <div className="mc-track"><span style={{ width: `${of ? Math.max(used ? 3 : 0, (used / of) * 100) : 0}%`, background: 'var(--mc-pink-ink)' }} /></div>
    </div>
  );
}

function FunnelRows({ steps, onPick }: { steps: { key: string; label: string; clubs: PlatformClubItem[] }[]; onPick?: (i: number) => void }) {
  const top = steps[0]?.clubs.length || 0;
  return (
    <div className="mc-funnel" style={{ marginTop: 14 }}>
      {steps.map((s, i) => {
        const body = (
          <>
            <div className="top"><span>{s.label}</span><span className="num">{n(s.clubs.length)}{i === 0 ? ' clubs' : ''}</span></div>
            <div className="mc-track"><span style={{ width: `${top ? (s.clubs.length / top) * 100 : 0}%`, background: 'var(--mc-indigo)' }} /></div>
          </>
        );
        return onPick
          ? <button key={s.key} type="button" className="mc-funnel-row" onClick={() => onPick(i)} style={{ border: 0, background: 'none', padding: 0, font: 'inherit', textAlign: 'left', cursor: 'pointer', width: '100%' }}>{body}</button>
          : <div key={s.key} className="mc-funnel-row">{body}</div>;
      })}
    </div>
  );
}

function ClubList({ rows, empty, onOpen }: { rows: { ref: OverviewClubRef | PlatformClubItem; sub: string; right: React.ReactNode }[]; empty: string; onOpen: (clubId: string) => void }) {
  if (!rows.length) return <p className="mc-muted">{empty}</p>;
  return (
    <div className="mc-leader">
      {rows.map(({ ref: c, sub, right }) => (
        <button key={c.id} type="button" className="mc-leader-row mc-ov-club" onClick={() => onOpen(c.id)}>
          <Crest logoUrl={c.logo_url} label={'short_name' in c ? c.short_name : c.name.slice(0, 2)} color={c.primary_color} />
          <div style={{ minWidth: 0 }}><b>{c.name}</b><small>{sub}</small></div>
          <span className="right num">{right}</span>
        </button>
      ))}
    </div>
  );
}

function UsageScreen({ header, usage, clubs, featureCount, onFeature, onOpen }: {
  header: React.ReactNode;
  usage: PlatformOverview['usage'];
  clubs: PlatformClubItem[];
  featureCount: (key: string) => number;
  onFeature: (key: string, label: string) => void;
  onOpen: (clubId: string) => void;
}) {
  const [view, setView] = useState<'feature' | 'club'>('feature');
  const open = clubs.filter(c => c.is_active && !c.closed_at);
  const byClub = open
    .map(c => ({ c, used: new Set(usage.by_club[c.id] || []) }))
    .sort((a, b) => a.used.size - b.used.size || a.c.name.localeCompare(b.c.name));
  return (
    <div>
      {header}
      <div className="mc-card">
        <div className="mc-tabs" role="group" aria-label="View">
          <button type="button" aria-pressed={view === 'feature'} onClick={() => setView('feature')}>By feature</button>
          <button type="button" aria-pressed={view === 'club'} onClick={() => setView('club')}>By club</button>
        </div>
        {view === 'feature' ? (
          <div className="mc-ov-feat" style={{ marginTop: 8 }}>
            {[...FEATURES].sort((a, b) => featureCount(b.key) - featureCount(a.key)).map(f => (
              <button key={f.key} type="button" className="row" onClick={() => onFeature(f.key, f.label)}>
                <span>{f.label}</span><em>{n(featureCount(f.key))} of {n(usage.clubs)}</em>
                <div className="mc-track"><span style={{ width: `${usage.clubs ? Math.max(featureCount(f.key) ? 3 : 0, (featureCount(f.key) / usage.clubs) * 100) : 0}%`, background: 'var(--mc-pink-ink)' }} /></div>
              </button>
            ))}
          </div>
        ) : (
          <div className="mc-leader" style={{ marginTop: 8 }}>
            <p className="mc-muted">Fewest features first. Green = used in this period.</p>
            {byClub.map(({ c, used }) => (
              <button key={c.id} type="button" className="mc-leader-row mc-ov-club" onClick={() => onOpen(c.id)}>
                <Crest logoUrl={c.logo_url} label={c.short_name} color={c.primary_color} />
                <div style={{ minWidth: 0 }}>
                  <b>{c.name}</b>
                  <div className="mc-ov-ticks">
                    {FEATURES.map(f => <span key={f.key} className={`mc-flag${used.has(f.key) ? ' ok' : ''}`}>{f.label}</span>)}
                  </div>
                </div>
                <span className="right num">{used.size} of {FEATURES.length}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const STATUS_FLAG: Record<string, string> = { approved: 'ok', pending: 'warn', rejected: 'bad', lapsed: 'bad', waived: 'info' };

/** One club's members. Sensitive details are never fetched (see get_platform_club_members); opening is logged. */
function MembersList({ clubId, club, onOpenConsole }: { clubId: string; club?: PlatformClubItem; onOpenConsole?: () => void }) {
  const [rows, setRows] = useState<PlatformClubMember[] | null>(null);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'all' | 'pending' | 'renew' | 'lapsed'>('all');

  useEffect(() => {
    const client = getSupabaseClient();
    if (!client) return;
    let live = true;
    client.rpc('get_platform_club_members', { p_club_id: clubId }).then(({ data, error: e }) => {
      if (!live) return;
      if (e) setError(/function/i.test(e.message) ? 'The member list needs migration 20261149_mission_control_overview.sql.' : e.message);
      else setRows((data || []) as PlatformClubMember[]);
    });
    return () => { live = false; };
  }, [clubId]);

  // Fixed when the list opens, so the filters don't shift while it's on screen
  const [{ today, in30 }] = useState(() => {
    const now = Date.now();
    return { today: new Date(now).toISOString().slice(0, 10), in30: new Date(now + 30 * 86400000).toISOString().slice(0, 10) };
  });
  const lapsed = (r: PlatformClubMember) => r.membership_status === 'approved' && !!r.expires_at && r.expires_at < today;
  const renew = (r: PlatformClubMember) => r.membership_status === 'approved' && !!r.expires_at && r.expires_at >= today && r.expires_at <= in30;
  const shown = (rows || []).filter(r => {
    if (filter === 'pending' && r.membership_status !== 'pending') return false;
    if (filter === 'renew' && !renew(r)) return false;
    if (filter === 'lapsed' && !lapsed(r)) return false;
    const s = q.trim().toLowerCase();
    return !s || r.full_name.toLowerCase().includes(s) || (r.email || '').toLowerCase().includes(s);
  });
  const pending = (rows || []).filter(r => r.membership_status === 'pending').length;

  const detail = (r: PlatformClubMember) => {
    const bits = [r.membership_tier || r.role || 'Member'];
    if (r.fee_waived) bits.push('fee waived');
    else if (r.awaiting_review) bits.push('bank transfer to confirm');
    else if (r.paid_cents) bits.push(`paid ${formatMoney(r.paid_cents, 'AUD')}${r.last_method ? ` by ${(METHOD_LABEL[r.last_method] || r.last_method).toLowerCase()}` : ''}`);
    if (lapsed(r)) bits.push(`lapsed ${dayLabel(r.expires_at)}`);
    else if (r.expires_at && r.membership_status === 'approved') bits.push(`renews ${dayLabel(r.expires_at)}`);
    if (!r.has_account) bits.push('no account');
    return bits.join(' · ');
  };

  return (
    <div className="mc-ov">
      {club && (
        <div className="mc-card wide" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Crest logoUrl={club.logo_url} label={club.short_name} color={club.primary_color} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <b style={{ display: 'block', color: 'var(--mc-ink)' }}>{club.name}</b>
            <small className="mc-muted">{rows ? `${n(rows.length)} members · ${n(pending)} pending` : 'Loading…'}</small>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {onOpenConsole && <button type="button" className="mc-pill-btn soft" onClick={onOpenConsole}>Club console</button>}
            <a className="mc-pill-btn ghost" href={`/${club.slug}`} target="_blank" rel="noreferrer">Site <ExternalLink size={12} /></a>
          </div>
        </div>
      )}
      <div className="mc-card wide">
        <div className="mc-toolbar" style={{ marginBottom: 8 }}>
          <label className="mc-search"><Search size={14} /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Search members" aria-label="Search members" /></label>
        </div>
        <div className="mc-seg" role="group" aria-label="Show" style={{ marginBottom: 8 }}>
          {([['all', 'All'], ['pending', 'Pending'], ['renew', 'Renew soon'], ['lapsed', 'Lapsed']] as const).map(([k, label]) => (
            <button key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)}>{label}</button>
          ))}
        </div>
        {error ? <div className="mc-ov-warn" role="alert">{error}</div>
          : !rows ? <div className="mc-empty">Loading members…</div>
          : !shown.length ? <div className="mc-empty">No members here.</div>
          : shown.slice(0, 300).map(r => {
            const status = lapsed(r) ? 'lapsed' : r.membership_status;
            return (
              <div key={r.id} className="mc-ov-mrow">
                <Avatar name={r.full_name} />
                <div style={{ minWidth: 0 }}><b>{r.full_name}</b><small>{r.email ? `${r.email} · ` : ''}{detail(r)}</small></div>
                <span className={`mc-flag ${STATUS_FLAG[status] || ''}`}>{status.charAt(0).toUpperCase() + status.slice(1)}</span>
              </div>
            );
          })}
        {rows && shown.length > 300 && <p className="mc-muted" style={{ marginTop: 8 }}>Showing the first 300. Search to narrow it down.</p>}
      </div>
      <div className="mc-ov-note wide">
        <Lock size={14} style={{ marginTop: 1, color: 'var(--mc-indigo)', flexShrink: 0 }} />
        <span>Medical notes, emergency contacts, guardian phone numbers, safeguarding checks and dates of birth are not shown here. Opening this list is recorded in the Action log.</span>
      </div>
    </div>
  );
}
