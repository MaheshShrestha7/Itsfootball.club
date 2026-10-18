'use client';

import React from 'react';
import Link from 'next/link';
import { PlatformMetrics, PlatformClubItem } from '@/lib/supabase/types';
import { formatMoney } from '@/lib/finance';
import { formatDate } from '@/lib/dates';
import {
  Building,
  Users,
  Eye,
  CreditCard,
  TrendingUp,
  Clock,
  CheckCircle2,
  XCircle,
  Gift,
  ShieldCheck,
  Trophy,
  Activity,
  ExternalLink,
  AlertCircle,
  Globe,
  ArrowRight,
} from 'lucide-react';

interface CockpitTabProps {
  metrics: PlatformMetrics | null;
  clubs: PlatformClubItem[];
  periodDays: number;
  onSelectTab: (tab: 'cockpit' | 'clubs' | 'users' | 'health' | 'broadcasts') => void;
  onSelectClub: (club: PlatformClubItem) => void;
}

export default function CockpitTab({
  metrics,
  clubs,
  periodDays,
  onSelectTab,
  onSelectClub,
}: CockpitTabProps) {
  // Compute Action Items / Triage for Founder
  const triageItems = React.useMemo(() => {
    const items: Array<{
      type: 'warning' | 'info' | 'danger';
      title: string;
      description: string;
      actionText: string;
      onClick: () => void;
    }> = [];

    const customDomainClubs = clubs.filter(c => c.custom_domain);
    if (customDomainClubs.length > 0) {
      items.push({
        type: 'info',
        title: `${customDomainClubs.length} Club${customDomainClubs.length > 1 ? 's' : ''} on Custom Domain`,
        description: `Verified CNAME routing configured: ${customDomainClubs.map(c => c.custom_domain).join(', ')}`,
        actionText: 'Inspect Clubs',
        onClick: () => onSelectTab('clubs'),
      });
    }

    const highPendingClubs = clubs.filter(c => c.pending_count >= 5);
    if (highPendingClubs.length > 0) {
      items.push({
        type: 'warning',
        title: `${highPendingClubs.length} Club${highPendingClubs.length > 1 ? 's' : ''} Have High Pending Backlog`,
        description: `Clubs like ${highPendingClubs[0].name} have ${highPendingClubs[0].pending_count} applicant(s) waiting for approval.`,
        actionText: 'Review Clubs',
        onClick: () => onSelectTab('clubs'),
      });
    }

    const inactiveClubs = clubs.filter(c => !c.is_active);
    if (inactiveClubs.length > 0) {
      items.push({
        type: 'danger',
        title: `${inactiveClubs.length} Club${inactiveClubs.length > 1 ? 's' : ''} Currently Suspended`,
        description: `Suspended portals: ${inactiveClubs.map(c => c.name).slice(0, 3).join(', ')}.`,
        actionText: 'Manage Status',
        onClick: () => onSelectTab('clubs'),
      });
    }

    const noStripeWithPolicy = clubs.filter(c => c.membership_payment_policy === 'require_payment' && !c.stripe_ready);
    if (noStripeWithPolicy.length > 0) {
      items.push({
        type: 'warning',
        title: `${noStripeWithPolicy.length} Club${noStripeWithPolicy.length > 1 ? 's' : ''} Missing Stripe Gateway`,
        description: `${noStripeWithPolicy[0].name} enforces strict payment policy but hasn't connected Stripe.`,
        actionText: 'View Details',
        onClick: () => onSelectClub(noStripeWithPolicy[0]),
      });
    }

    return items;
  }, [clubs, onSelectTab, onSelectClub]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* TRIAGE / ACTION REQUIRED CENTER */}
      {triageItems.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              OPERATIONAL TRIAGE QUEUE ({triageItems.length})
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Items requiring attention across the multi-tenant fleet
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: '0.75rem' }}>
            {triageItems.map((item, idx) => {
              const borderColors = {
                warning: 'rgba(245, 158, 11, 0.4)',
                danger: 'rgba(239, 68, 68, 0.4)',
                info: 'rgba(99, 102, 241, 0.4)',
              };
              const bgColors = {
                warning: 'rgba(245, 158, 11, 0.05)',
                danger: 'rgba(239, 68, 68, 0.05)',
                info: 'rgba(99, 102, 241, 0.05)',
              };
              const textColors = {
                warning: 'var(--c-amber)',
                danger: 'var(--c-red)',
                info: '#818CF8',
              };

              return (
                <div
                  key={idx}
                  className="glass-panel"
                  style={{
                    padding: '1rem',
                    borderRadius: '8px',
                    border: `1px solid ${borderColors[item.type]}`,
                    background: bgColors[item.type],
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '0.6rem',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 800, fontSize: '0.88rem', color: textColors[item.type] }}>
                      <AlertCircle size={15} />
                      <span>{item.title}</span>
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.25rem', lineHeight: 1.4 }}>
                      {item.description}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={item.onClick}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: textColors[item.type],
                      fontWeight: 800,
                      fontSize: '0.75rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                      cursor: 'pointer',
                      padding: 0,
                      alignSelf: 'flex-start',
                    }}
                  >
                    <span>{item.actionText}</span>
                    <ArrowRight size={13} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* EXECUTIVE KPI CARDS */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))',
          gap: '1rem',
        }}
      >
        {/* Card 1: Clubs */}
        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>CLUBS REGISTERED</span>
            <Building size={18} color="var(--c-amber)" />
          </div>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: '2rem', fontWeight: 900, color: 'var(--text-primary)' }}>
            {metrics ? metrics.total_clubs.toLocaleString() : '...'}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.4rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--c-green)', fontWeight: 700 }}>+{metrics?.new_clubs_period || 0} in {periodDays}d</span>
            <span>{metrics?.active_clubs || 0} active</span>
          </div>
        </div>

        {/* Card 2: Registered Accounts */}
        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>PLATFORM USERS</span>
            <Users size={18} color="var(--c-blue)" />
          </div>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: '2rem', fontWeight: 900, color: 'var(--text-primary)' }}>
            {metrics ? metrics.total_users.toLocaleString() : '...'}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.4rem' }}>
            <span style={{ color: 'var(--c-green)', fontWeight: 700 }}>+{metrics?.new_users_period || 0} new accounts</span>
          </div>
        </div>

        {/* Card 3: Total Club Members */}
        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>CLUB MEMBERS</span>
            <Trophy size={18} color="var(--c-green)" />
          </div>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: '2rem', fontWeight: 900, color: 'var(--text-primary)' }}>
            {metrics ? metrics.total_members.toLocaleString() : '...'}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.4rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--c-green)' }}>{metrics?.members_approved || 0} approved</span>
            <span style={{ color: 'var(--c-amber)' }}>{metrics?.members_pending || 0} pending</span>
          </div>
        </div>

        {/* Card 4: Global Traffic */}
        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>GLOBAL VISITS ({periodDays}D)</span>
            <Eye size={18} color="#818CF8" />
          </div>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: '2rem', fontWeight: 900, color: 'var(--text-primary)' }}>
            {metrics ? metrics.total_visits_period.toLocaleString() : '...'}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.4rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>{metrics?.club_visits_period?.toLocaleString() || 0} club views</span>
            <span>{metrics?.platform_visits_period?.toLocaleString() || 0} portal</span>
          </div>
        </div>

        {/* Card 5: Platform GMV */}
        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>PLATFORM GMV</span>
            <CreditCard size={18} color="var(--c-green)" />
          </div>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: '2rem', fontWeight: 900, color: 'var(--text-primary)' }}>
            {metrics ? formatMoney(metrics.total_gmv_cents, 'AUD') : '...'}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.4rem' }}>
            <span style={{ color: 'var(--c-green)', fontWeight: 700 }}>
              +{formatMoney(metrics?.period_gmv_cents || 0, 'AUD')} in {periodDays}d
            </span>
          </div>
        </div>

        {/* Card 6: Membership Signup Conversion */}
        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>PAID CONVERSION</span>
            <TrendingUp size={18} color="#EC4899" />
          </div>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: '2rem', fontWeight: 900, color: 'var(--text-primary)' }}>
            {(() => {
              if (!metrics || !metrics.total_members) return '0%';
              const paidTotal = (metrics.paid_signups_count || 0) + (metrics.members_waived || 0);
              const pct = Math.round((paidTotal / metrics.total_members) * 100);
              return `${pct}%`;
            })()}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.4rem' }}>
            <span>{metrics?.paid_signups_count || 0} paid · {metrics?.members_waived || 0} waived</span>
          </div>
        </div>
      </div>

      {/* CHARTS & FUNNEL ROW */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 480px), 1fr))', gap: '1.5rem' }}>
        {/* Daily Signup Growth Graph */}
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                Daily Signup Velocity
              </h3>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                New clubs, member applications, and accounts over the last {periodDays} days
              </span>
            </div>
            <div style={{ display: 'flex', gap: '0.8rem', fontSize: '0.75rem', fontWeight: 700 }}>
              <span style={{ color: '#818CF8', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#818CF8' }} /> Members
              </span>
              <span style={{ color: 'var(--c-amber)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--c-amber)' }} /> Clubs
              </span>
            </div>
          </div>

          {/* Bar Visualization */}
          <div style={{ flex: 1, minHeight: '160px', display: 'flex', alignItems: 'flex-end', gap: '4px', paddingTop: '1rem' }}>
            {(() => {
              const trends = metrics?.daily_trends || [];
              if (trends.length === 0) {
                return (
                  <div style={{ margin: 'auto', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    No activity recorded in this period yet.
                  </div>
                );
              }
              const maxVal = Math.max(...trends.map(t => Math.max(t.members, t.clubs, 1)));
              return trends.map(t => {
                const mHeight = Math.round((t.members / maxVal) * 120);
                const cHeight = Math.round((t.clubs / maxVal) * 120);
                return (
                  <div
                    key={t.date}
                    style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '140px', justifyContent: 'flex-end' }}
                    title={`${t.date}: ${t.members} members, ${t.clubs} clubs, ${t.visits} visits`}
                  >
                    <div style={{ width: '100%', maxWidth: '14px', display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'center' }}>
                      {t.clubs > 0 && (
                        <div style={{ width: '100%', height: `${Math.max(4, cHeight)}px`, background: 'var(--c-amber)', borderRadius: '2px' }} />
                      )}
                      <div style={{ width: '100%', height: `${Math.max(4, mHeight)}px`, background: '#818CF8', borderRadius: '2px' }} />
                    </div>
                    <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', marginTop: '0.35rem', transform: trends.length > 15 ? 'rotate(-60deg)' : 'none', whiteSpace: 'nowrap' }}>
                      {trends.length <= 14 ? t.date.slice(5) : (trends.indexOf(t) % 4 === 0 ? t.date.slice(5) : '')}
                    </span>
                  </div>
                );
              });
            })()}
          </div>
        </div>

        {/* Membership Signup & Payment Funnel */}
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
            Member Signup &amp; Payment Funnel
          </h3>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
            How member applications are converted, approved, and settled across clubs
          </span>

          {(() => {
            const funnel = metrics?.funnel;
            const total = (metrics?.total_members || 1);
            const paid = funnel?.paid || 0;
            const awaiting = funnel?.awaiting_review || 0;
            const waived = funnel?.fee_waived || 0;
            const unpaid = funnel?.unpaid_pending || 0;
            const approvedDirect = Math.max(0, (metrics?.members_approved || 0) - paid - waived);

            const items = [
              { label: 'Paid by Card / Stripe', count: paid, color: 'var(--c-green)', icon: CheckCircle2 },
              { label: 'Direct Free / Approved', count: approvedDirect, color: 'var(--c-blue)', icon: ShieldCheck },
              { label: 'Fee Waived (Audit Discretion)', count: waived, color: '#818CF8', icon: Gift },
              { label: 'Receipt in Finance Review', count: awaiting, color: 'var(--c-amber)', icon: Clock },
              { label: 'Unpaid Applications (Pending)', count: unpaid, color: 'var(--c-red)', icon: XCircle },
            ];

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem', flex: 1, justifyContent: 'center' }}>
                {items.map(item => {
                  const pct = Math.round((item.count / total) * 100);
                  const Icon = item.icon;
                  return (
                    <div key={item.label}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '0.25rem' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                          <Icon size={14} color={item.color} />
                          <span>{item.label}</span>
                        </span>
                        <span style={{ color: 'var(--text-muted)' }}>
                          <strong style={{ color: 'var(--text-primary)' }}>{item.count.toLocaleString()}</strong> ({pct}%)
                        </span>
                      </div>
                      <div style={{ width: '100%', height: '8px', background: 'rgba(var(--tint-rgb), 0.06)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: item.color, borderRadius: '4px', transition: 'width 0.4s ease' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      </div>

      {/* TOP CLUBS & LIVE ACTIVITY FEED */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))', gap: '1.5rem' }}>
        {/* Top Clubs Leaderboard */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Trophy size={18} color="var(--c-amber)" />
              <span>Top Network Clubs</span>
            </h3>
            <button
              type="button"
              onClick={() => onSelectTab('clubs')}
              style={{ background: 'none', border: 'none', color: '#818CF8', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}
            >
              View All Clubs →
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {(() => {
              const topClubs = metrics?.top_clubs || [];
              if (topClubs.length === 0) {
                return <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No club activity found.</div>;
              }
              return topClubs.map((c, i) => (
                <div
                  key={c.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.65rem 0.85rem',
                    background: 'rgba(var(--tint-rgb), 0.03)',
                    borderRadius: '8px',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 900, color: i === 0 ? 'var(--c-amber)' : 'var(--text-muted)', width: '16px' }}>
                      #{i + 1}
                    </span>
                    {c.logo_url ? (
                      <img width={24} height={24} src={c.logo_url} alt="" style={{ width: '24px', height: '24px', borderRadius: '4px', objectFit: 'contain' }} />
                    ) : (
                      <div style={{ width: '24px', height: '24px', borderRadius: '4px', background: c.primary_color || 'var(--club-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.7rem', fontWeight: 800 }}>
                        {c.short_name.slice(0, 2)}
                      </div>
                    )}
                    <div>
                      <Link href={`/${c.slug}`} target="_blank" style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <span>{c.name}</span>
                        <ExternalLink size={11} color="var(--text-muted)" />
                      </Link>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        {c.members} members · {c.teams} teams
                      </div>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#818CF8' }}>
                      {c.visits.toLocaleString()} views
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--c-green)' }}>
                      {formatMoney(c.gmv_cents, 'AUD')} GMV
                    </div>
                  </div>
                </div>
              ));
            })()}
          </div>
        </div>

        {/* Real-Time Platform Activity Feed */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Activity size={18} color="var(--c-green)" />
              <span>Live Event Stream</span>
            </h3>
            <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.15)', color: 'var(--c-green)', fontSize: '0.7rem' }}>
              REALTIME
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', maxHeight: '380px', overflowY: 'auto' }}>
            {(() => {
              const activities = metrics?.recent_activity || [];
              if (activities.length === 0) {
                return <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No recent events recorded.</div>;
              }
              return activities.map((act, idx) => {
                const getMeta = (type: string) => {
                  switch (type) {
                    case 'club_created':
                      return { label: 'New Club', color: 'var(--c-amber)', bg: 'rgba(245, 158, 11, 0.15)' };
                    case 'member_signup':
                      return { label: 'Member Signup', color: '#818CF8', bg: 'rgba(99, 102, 241, 0.15)' };
                    case 'payment_received':
                      return { label: 'Payment', color: 'var(--c-green)', bg: 'rgba(16, 185, 129, 0.15)' };
                    case 'gate_scan':
                      return { label: 'Gate Scan', color: 'var(--c-blue)', bg: 'rgba(59, 130, 246, 0.15)' };
                    default:
                      return { label: 'Event', color: 'var(--text-muted)', bg: 'rgba(255, 255, 255, 0.05)' };
                  }
                };
                const meta = getMeta(act.type);
                return (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.55rem 0.75rem',
                      background: 'rgba(var(--tint-rgb), 0.02)',
                      borderRadius: '6px',
                      borderLeft: `3px solid ${meta.color}`,
                      fontSize: '0.8rem',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span className="badge" style={{ background: meta.bg, color: meta.color, fontSize: '0.65rem', padding: '0.1rem 0.35rem' }}>
                          {meta.label}
                        </span>
                        <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{act.title}</span>
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                        {act.subtitle}
                      </div>
                    </div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {formatDate(act.created_at)}
                    </span>
                  </div>
                );
              });
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}
