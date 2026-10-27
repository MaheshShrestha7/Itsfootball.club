'use client';

import React from 'react';
import Link from 'next/link';
import { PlatformMetrics, PlatformClubItem, PlatformAdmin, PlatformRecentActivity } from '@/lib/supabase/types';
import { formatMoney } from '@/lib/finance';
import {
  bucketTotals,
  firstName,
  greeting,
  shortAge,
  softTint,
  timeAgo,
  weekHeading,
  weekStrip,
  type MissionTab,
} from '@/lib/mission-control';
import { LogoArt, Crest, Avatar } from '@/components/admin/platform/McArt';
import {
  Building,
  Users,
  CreditCard,
  TrendingUp,
  Clock,
  CheckCircle2,
  XCircle,
  Gift,
  ShieldCheck,
  Trophy,
  ExternalLink,
  AlertCircle,
  Globe,
  ArrowRight,
  Plus,
  PauseCircle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Bell,
  Radio,
  UserPlus,
  QrCode,
} from 'lucide-react';

interface CockpitTabProps {
  metrics: PlatformMetrics | null;
  clubs: PlatformClubItem[];
  admins: PlatformAdmin[];
  userName?: string | null;
  userEmail?: string | null;
  periodDays: number;
  periodOptions: { days: number; label: string }[];
  onPeriodChange: (days: number) => void;
  refreshing: boolean;
  onRefresh: () => void;
  onManageAdmins: () => void;
  onSelectTab: (tab: MissionTab) => void;
  onSelectClub: (club: PlatformClubItem) => void;
}

type TriageItem = {
  type: 'warning' | 'info' | 'danger';
  title: string;
  description: string;
  onClick: () => void;
};

const ROLE_LABEL: Record<PlatformAdmin['role'], string> = { super_admin: 'Super admin', operator: 'Operator', analyst: 'Analyst' };

const ACTIVITY: Record<PlatformRecentActivity['type'], { label: string; icon: React.ElementType; bg: string; color: string }> = {
  club_created: { label: 'New club', icon: Building, bg: 'var(--mc-amber-bg)', color: 'var(--mc-amber)' },
  member_signup: { label: 'Sign-up', icon: UserPlus, bg: 'var(--mc-lilac)', color: 'var(--mc-indigo)' },
  payment_received: { label: 'Payment', icon: CreditCard, bg: 'var(--mc-mint)', color: 'var(--mc-green-ink)' },
  gate_scan: { label: 'Gate scan', icon: QrCode, bg: 'var(--mc-sky)', color: 'var(--mc-sky-ink)' },
};

const FEED_TABS: { id: 'all' | PlatformRecentActivity['type']; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'member_signup', label: 'Sign-ups' },
  { id: 'payment_received', label: 'Payments' },
  { id: 'club_created', label: 'New clubs' },
  { id: 'gate_scan', label: 'Gate' },
];

const n = (v: number | null | undefined) => (v || 0).toLocaleString();

export default function CockpitTab({
  metrics,
  clubs,
  admins,
  userName,
  userEmail,
  periodDays,
  periodOptions,
  onPeriodChange,
  refreshing,
  onRefresh,
  onManageAdmins,
  onSelectTab,
  onSelectClub,
}: CockpitTabProps) {
  const [weekOffset, setWeekOffset] = React.useState(0);
  const [feedTab, setFeedTab] = React.useState<(typeof FEED_TABS)[number]['id']>('all');
  const needsRef = React.useRef<HTMLDivElement>(null);

  // Things that need the founder, across all clubs
  const triageItems = React.useMemo(() => {
    const items: TriageItem[] = [];

    const highPendingClubs = clubs.filter(c => c.pending_count >= 5);
    for (const c of highPendingClubs.slice(0, 3)) {
      items.push({
        type: 'warning',
        title: c.name,
        description: `${c.pending_count} ${c.pending_count === 1 ? 'person' : 'people'} waiting for approval`,
        onClick: () => onSelectClub(c),
      });
    }

    const noStripeWithPolicy = clubs.filter(c => c.membership_payment_policy === 'require_payment' && !c.stripe_ready);
    for (const c of noStripeWithPolicy.slice(0, 3)) {
      items.push({
        type: 'danger',
        title: c.name,
        description: 'Payment required to join, but Stripe is not connected',
        onClick: () => onSelectClub(c),
      });
    }

    const inactiveClubs = clubs.filter(c => !c.is_active);
    if (inactiveClubs.length > 0) {
      items.push({
        type: 'info',
        title: `${inactiveClubs.length} ${inactiveClubs.length === 1 ? 'club is' : 'clubs are'} suspended`,
        description: inactiveClubs.map(c => c.name).slice(0, 3).join(', '),
        onClick: () => onSelectTab('clubs'),
      });
    }

    return items;
  }, [clubs, onSelectTab, onSelectClub]);

  const trends = metrics?.daily_trends || [];
  const revenueBars = bucketTotals(trends, 4, t => t.revenue_cents);
  const revenueMax = Math.max(1, ...revenueBars);
  const membersInPeriod = trends.reduce((sum, t) => sum + (Number(t.members) || 0), 0);
  const memberMax = Math.max(1, ...trends.map(t => Number(t.members) || 0));
  const labelEvery = Math.max(1, Math.ceil(trends.length / 10));
  const suspended = clubs.filter(c => !c.is_active).length;

  const today = new Date();
  const week = weekStrip(trends, today, weekOffset);
  const newestClubs = [...clubs].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 6);
  const activities = (metrics?.recent_activity || []).filter(a => feedTab === 'all' || a.type === feedTab);

  const clubVisits = metrics?.club_visits_period || 0;
  const portalVisits = metrics?.platform_visits_period || 0;
  const visitTotal = Math.max(1, clubVisits + portalVisits);

  const paidConversion = (() => {
    if (!metrics || !metrics.total_members) return '0%';
    const paidTotal = (metrics.paid_signups_count || 0) + (metrics.members_waived || 0);
    return `${Math.round((paidTotal / metrics.total_members) * 100)}%`;
  })();

  const name = firstName(userName, userEmail);
  const heading = triageItems.length === 0
    ? 'Nothing needs you right now.'
    : `${triageItems.length} ${triageItems.length === 1 ? 'thing needs' : 'things need'} you.`;

  return (
    <div className="mc-cockpit">
      <div className="mc-col">
        {/* BANNER */}
        <div className="mc-hero">
          <div className="mc-hero-top">
            <span className="mc-live"><span className="mc-pulse" />Live data · last {periodDays} days</span>
            <span className="mc-seg" role="group" aria-label="Time range">
              {periodOptions.map(opt => (
                <button key={opt.days} type="button" aria-pressed={periodDays === opt.days} onClick={() => onPeriodChange(opt.days)}>
                  {opt.label}
                </button>
              ))}
            </span>
            <button type="button" className="mc-icon-btn" onClick={onRefresh} disabled={refreshing} aria-label="Refresh all numbers" title="Refresh all numbers">
              <RefreshCw size={14} className={refreshing ? 'spin' : ''} />
            </button>
          </div>
          <h1>{greeting(today.getHours())}{name ? `, ${name}` : ''}. {heading}</h1>
          <p>
            {metrics
              ? `${n(metrics.total_clubs)} clubs on the platform, ${n(metrics.active_clubs)} active. ${n(metrics.new_users_period)} new accounts and ${n(membersInPeriod)} new members in the last ${periodDays} days.`
              : 'Loading the latest numbers…'}
          </p>
          <div className="mc-hero-acts">
            {triageItems.length > 0 && (
              <button type="button" className="mc-pill-btn" onClick={() => needsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>
                <AlertCircle size={14} /> See what needs you
              </button>
            )}
            <button type="button" className="mc-pill-btn ghost" onClick={() => onSelectTab('clubs')}>
              <Building size={14} /> All clubs
            </button>
          </div>
          <LogoArt id="cockpit" />
        </div>

        {/* HEADLINE NUMBERS */}
        <div className="mc-kpis">
          <div className="mc-card mc-kpi">
            <span className="mc-eyebrow"><span style={{ background: 'var(--mc-sky)', color: 'var(--mc-sky-ink)' }}><Users size={11} /></span>Platform users</span>
            <b className="num">{metrics ? n(metrics.total_users) : '…'}</b>
            <small>+{n(metrics?.new_users_period)} new accounts</small>
          </div>
          <div className="mc-card mc-kpi">
            <span className="mc-eyebrow"><span style={{ background: 'var(--mc-mint)', color: 'var(--mc-green-ink)' }}><Trophy size={11} /></span>Club members</span>
            <b className="num">{metrics ? n(metrics.total_members) : '…'}</b>
            <small>{n(metrics?.members_approved)} approved · {n(metrics?.members_pending)} waiting</small>
          </div>
          <div className="mc-card mc-kpi">
            <span className="mc-eyebrow"><span style={{ background: 'var(--mc-lilac)', color: 'var(--mc-indigo)' }}><CreditCard size={11} /></span>Money in, all time</span>
            <b className="num">{metrics ? formatMoney(metrics.total_gmv_cents, 'AUD') : '…'}</b>
            <small>+{formatMoney(metrics?.period_gmv_cents || 0, 'AUD')} in {periodDays} days</small>
          </div>
          <div className="mc-card mc-kpi">
            <span className="mc-eyebrow"><span style={{ background: 'var(--mc-pink)', color: 'var(--mc-pink-ink)' }}><TrendingUp size={11} /></span>Paid or waived</span>
            <b className="num">{paidConversion}</b>
            <small>{n(metrics?.paid_signups_count)} paid · {n(metrics?.members_waived)} waived</small>
          </div>
        </div>

        <div className="mc-row3">
          {/* Platform team */}
          <div className="mc-card mc-lift">
            <div className="mc-card-h">
              <h3>Platform team</h3>
              <button type="button" className="mc-icon-btn" onClick={onManageAdmins} aria-label="Manage admins" title="Manage admins">
                <Plus size={14} />
              </button>
            </div>
            {admins.length === 0 ? (
              <p className="mc-muted">No platform admins loaded yet.</p>
            ) : (
              <div className="mc-team">
                {admins.slice(0, 3).map(a => {
                  const label = a.full_name || a.email.split('@')[0];
                  return (
                    <div key={a.id} title={a.email}>
                      <Avatar name={label} />
                      <small>{label}<br /><i>{ROLE_LABEL[a.role] || a.role}{a.is_active ? '' : ' · paused'}</i></small>
                    </div>
                  );
                })}
              </div>
            )}
            {admins.length > 3 && (
              <button type="button" className="mc-pill-btn ghost" style={{ marginTop: 12 }} onClick={onManageAdmins}>
                +{admins.length - 3} more
              </button>
            )}
          </div>

          {/* Visits */}
          <div className="mc-card mc-lift">
            <div className="mc-card-h">
              <span className="mc-eyebrow">Visits · {periodDays} days</span>
            </div>
            <div className="mc-big num">{metrics ? n(metrics.total_visits_period) : '…'}</div>
            <div className="mc-split" aria-hidden="true">
              <span style={{ flex: clubVisits / visitTotal, background: 'var(--mc-ink)' }} />
              <span style={{ flex: portalVisits / visitTotal, background: 'var(--mc-lilac-2)' }} />
            </div>
            <div className="mc-split-legend">
              <span><b className="num">{n(clubVisits)}</b> club pages</span>
              <span><b className="num">{n(portalVisits)}</b> main site</span>
            </div>
          </div>

          {/* Money in */}
          <div className="mc-card mc-lift">
            <div className="mc-card-h">
              <span className="mc-eyebrow">Money in</span>
            </div>
            <div className="mc-pillbars" role="img" aria-label={`Money in, ${periodDays} days split into 4 parts: ${revenueBars.map(c => formatMoney(c, 'AUD')).join(', ')}`}>
              {revenueBars.map((c, i) => (
                <span key={i} className={i === revenueBars.length - 1 ? 'hi' : ''} style={{ height: `${Math.round((c / revenueMax) * 100)}%` }} title={formatMoney(c, 'AUD')} />
              ))}
            </div>
            <p className="mc-muted num" style={{ textAlign: 'center', marginTop: 8 }}>{formatMoney(metrics?.period_gmv_cents || 0, 'AUD')}</p>
          </div>
        </div>

        <div className="mc-row2">
          {/* Clubs */}
          <div className="mc-card">
            <div className="mc-card-h">
              <h3>Clubs</h3>
              <button type="button" className="mc-icon-btn" onClick={() => onSelectTab('clubs')} aria-label="Open clubs">
                <ArrowRight size={14} />
              </button>
            </div>
            <div className="mc-stat-pair">
              <span className="mc-big num">{metrics ? n(metrics.active_clubs) : '…'}</span>
              <span className="sep" />
              <span className="mc-big num">{metrics ? n(metrics.total_clubs) : '…'}<small>active of total</small></span>
            </div>
            <div className="mc-tiles">
              <div className="mc-tile">
                <div className="ti"><Plus size={16} /></div>
                <b className="num">{n(metrics?.new_clubs_period)}</b>
                <small>New in {periodDays} days</small>
              </div>
              <div className="mc-tile">
                <div className="ti"><PauseCircle size={16} /></div>
                <b className="num">{suspended}</b>
                <small>Suspended</small>
              </div>
            </div>
          </div>

          <div className="mc-stack">
            {/* Needs you */}
            <div className="mc-needs" ref={needsRef}>
              <div className="mc-needs-h"><span>Needs you</span><span>{triageItems.length}</span></div>
              {triageItems.length === 0 && <p className="mc-needs-empty">All clear. No backlogs, payment gaps or suspended clubs.</p>}
              {triageItems.map((item, idx) => {
                const tone = {
                  warning: { bg: '#FEF3C7', color: '#B45309', icon: Clock },
                  danger: { bg: '#FEE2E2', color: '#DC2626', icon: CreditCard },
                  info: { bg: '#E4E1FB', color: '#4F46E5', icon: PauseCircle },
                }[item.type];
                const Icon = tone.icon;
                return (
                  <button key={idx} type="button" className="mc-needs-item" onClick={item.onClick}>
                    <span className="mc-sq" style={{ width: 26, height: 26, borderRadius: 8, background: tone.bg, color: tone.color }}><Icon size={14} /></span>
                    <div><b>{item.title}</b><small>{item.description}</small></div>
                    <span className="go"><ArrowRight size={12} /></span>
                  </button>
                );
              })}
            </div>

            {/* Broadcast shortcut */}
            <div className="mc-card mc-promo">
              <div className="art" aria-hidden="true" />
              <div>
                <h3>Tell every club at once</h3>
                <p>Show a banner to club admins, members or visitors.</p>
                <button type="button" className="mc-pill-btn soft" onClick={() => onSelectTab('broadcasts')}>
                  <Radio size={14} /> New broadcast
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* New members chart */}
        <div className="mc-card">
          <div className="mc-card-h">
            <h3>New members, last {periodDays} days</h3>
            <span className="mc-eyebrow num">{n(membersInPeriod)} total</span>
          </div>
          {trends.length === 0 ? (
            <div className="mc-empty">No activity recorded in this period yet.</div>
          ) : (
            <>
              <div className="mc-chart" role="img" aria-label={`New members per day for the last ${periodDays} days, ${n(membersInPeriod)} in total`}>
                {trends.map((t, i) => (
                  <div
                    key={t.date}
                    className={`b${i === trends.length - 1 ? ' last' : ''}`}
                    data-v={t.members}
                    title={`${t.date}: ${t.members} members, ${t.clubs} clubs, ${t.visits} visits`}
                  >
                    <span style={{ height: `${Math.round(((Number(t.members) || 0) / memberMax) * 100)}%` }} />
                  </div>
                ))}
              </div>
              <div className="mc-chart-x" aria-hidden="true">
                {trends.map((t, i) => (
                  <span key={t.date}>{(trends.length - 1 - i) % labelEvery === 0 ? t.date.slice(8, 10) : ''}</span>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="mc-row2">
          {/* Membership funnel */}
          <div className="mc-card">
            <div className="mc-card-h"><h3>How members joined</h3></div>
            {(() => {
              const funnel = metrics?.funnel;
              const total = metrics?.total_members || 1;
              const paid = funnel?.paid || 0;
              const awaiting = funnel?.awaiting_review || 0;
              const waived = funnel?.fee_waived || 0;
              const unpaid = funnel?.unpaid_pending || 0;
              const approvedDirect = Math.max(0, (metrics?.members_approved || 0) - paid - waived);
              const items = [
                { label: 'Paid by card', count: paid, color: 'var(--mc-green)', icon: CheckCircle2 },
                { label: 'Approved, no fee', count: approvedDirect, color: 'var(--mc-sky-ink)', icon: ShieldCheck },
                { label: 'Fee waived', count: waived, color: 'var(--mc-indigo)', icon: Gift },
                { label: 'Receipt being checked', count: awaiting, color: 'var(--mc-amber)', icon: Clock },
                { label: 'Not paid yet', count: unpaid, color: 'var(--mc-red)', icon: XCircle },
              ];
              return (
                <div className="mc-funnel">
                  {items.map(item => {
                    const pct = Math.round((item.count / total) * 100);
                    const Icon = item.icon;
                    return (
                      <div key={item.label} className="mc-funnel-row">
                        <div className="top">
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Icon size={13} color={item.color} />{item.label}</span>
                          <span className="num"><b style={{ color: 'var(--mc-ink)' }}>{n(item.count)}</b> ({pct}%)</span>
                        </div>
                        <div className="mc-track"><span style={{ width: `${pct}%`, background: item.color }} /></div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>

          {/* Top clubs */}
          <div className="mc-card">
            <div className="mc-card-h">
              <h3>Top clubs</h3>
              <button type="button" className="mc-icon-btn" onClick={() => onSelectTab('clubs')} aria-label="All clubs"><ArrowRight size={14} /></button>
            </div>
            {(metrics?.top_clubs || []).length === 0 ? (
              <p className="mc-muted">No club activity found.</p>
            ) : (
              <div className="mc-leader">
                {(metrics?.top_clubs || []).map((c, i) => (
                  <div key={c.id} className="mc-leader-row">
                    <span className="rank">{i + 1}</span>
                    <Crest logoUrl={c.logo_url} label={c.short_name} color={c.primary_color} />
                    <div style={{ minWidth: 0 }}>
                      <Link href={`/${c.slug}`} target="_blank">{c.name} <ExternalLink size={10} style={{ verticalAlign: '-1px' }} /></Link>
                      <small>{n(c.members)} members · {n(c.teams)} teams</small>
                    </div>
                    <div className="right num">{n(c.visits)} views<br /><span style={{ color: 'var(--mc-green-ink)' }}>{formatMoney(c.gmv_cents, 'AUD')}</span></div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN */}
      <div className="mc-col">
        <div className="mc-card">
          <div className="mc-cal-h">
            <h2>{weekHeading(week)}</h2>
            <div>
              <button type="button" className="mc-icon-btn" onClick={() => setWeekOffset(w => w - 1)} aria-label="Previous week"><ChevronLeft size={14} /></button>
              <button type="button" className="mc-icon-btn" onClick={() => setWeekOffset(w => Math.min(0, w + 1))} disabled={weekOffset >= 0} aria-label="Next week"><ChevronRight size={14} /></button>
            </div>
          </div>
          <div className="mc-week">
            {week.map(d => (
              <div key={d.date} className={`mc-day${d.isToday ? ' today' : ''}`} title={d.future ? undefined : `${d.members} new ${d.members === 1 ? 'member' : 'members'}`}>
                {d.label}<b>{d.day}</b><i className={d.members > 0 ? '' : 'none'} />
              </div>
            ))}
          </div>
          <p className="mc-muted" style={{ marginTop: 10, fontSize: 11 }}>
            A green dot means new members joined that day.{weekOffset < -Math.floor(periodDays / 7) ? ' Pick a longer time range to see dots this far back.' : ''}
          </p>
        </div>

        <div className="mc-card">
          <div className="mc-card-h">
            <h3>Newest clubs</h3>
            <button type="button" className="mc-icon-btn" onClick={() => onSelectTab('clubs')} aria-label="All clubs"><ArrowRight size={14} /></button>
          </div>
          {newestClubs.length === 0 ? (
            <p className="mc-muted">No clubs yet.</p>
          ) : (
            <div className="mc-club-cards">
              {newestClubs.map(c => (
                <button key={c.id} type="button" className="mc-club-card" onClick={() => onSelectClub(c)}>
                  <div className="top" style={{ background: softTint(c.primary_color) }}>
                    <Crest logoUrl={c.logo_url} label={c.short_name} color={c.primary_color} />
                    <span className="tag">{shortAge(c.created_at)}</span>
                  </div>
                  <b>{c.name}</b>
                  <small className="num">{n(c.member_count)} members</small>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="mc-card">
          <div className="mc-card-h">
            <h3>Live activity</h3>
            <span className="mc-icon-btn" aria-hidden="true"><Bell size={14} /></span>
          </div>
          <div className="mc-tabs" role="group" aria-label="Filter activity">
            {FEED_TABS.map(t => (
              <button key={t.id} type="button" aria-pressed={feedTab === t.id} onClick={() => setFeedTab(t.id)}>{t.label}</button>
            ))}
          </div>
          <div className="mc-feed">
            {activities.length === 0 && <p className="mc-muted" style={{ padding: '10px 0' }}>Nothing here yet.</p>}
            {activities.map((act, idx) => {
              const meta = ACTIVITY[act.type] || { label: 'Event', icon: Globe, bg: 'var(--mc-bar)', color: 'var(--mc-ink-2)' };
              const Icon = meta.icon;
              return (
                <div key={idx} className="mc-feed-row">
                  <span className="mc-sq" style={{ background: meta.bg, color: meta.color }}><Icon size={14} /></span>
                  <div>
                    <b>{act.title}</b>{act.subtitle ? <> · {act.subtitle}</> : null}
                    <time dateTime={act.created_at}>{meta.label} · {timeAgo(act.created_at)}</time>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
