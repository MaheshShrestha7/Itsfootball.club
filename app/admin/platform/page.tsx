'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { getSupabaseClient } from '@/lib/supabase/client';
import PlatformNavbar from '@/components/PlatformNavbar';
import Footer from '@/components/Footer';
import { formatMoney, toCsv } from '@/lib/finance';
import { formatDate } from '@/lib/dates';
import {
  PlatformMetrics,
  PlatformClubItem,
  PlatformAdmin,
  MembershipPaymentPolicy,
} from '@/lib/supabase/types';
import {
  Shield,
  ShieldCheck,
  Building,
  Users,
  Eye,
  CreditCard,
  TrendingUp,
  Clock,
  CheckCircle2,
  XCircle,
  Lock,
  Gift,
  Search,
  Download,
  ExternalLink,
  RefreshCw,
  AlertTriangle,
  UserPlus,
  Activity,
  X,
  Gauge,
  Sliders,
  Sparkles,
  Trophy,
  Filter,
} from 'lucide-react';

const PERIOD_OPTIONS = [
  { days: 7, label: 'Last 7 Days' },
  { days: 30, label: 'Last 30 Days' },
  { days: 90, label: 'Last 90 Days' },
];

export default function PlatformOwnerDashboard() {
  const { user, isAuthenticated, isLoading: authLoading, isPlatformAdmin } = useAuth();

  const [periodDays, setPeriodDays] = useState<number>(30);
  const [metrics, setMetrics] = useState<PlatformMetrics | null>(null);
  const [clubs, setClubs] = useState<PlatformClubItem[]>([]);
  const [loadingMetrics, setLoadingMetrics] = useState(true);
  const [loadingClubs, setLoadingClubs] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [adminsModalOpen, setAdminsModalOpen] = useState(false);
  const [adminsList, setAdminsList] = useState<PlatformAdmin[]>([]);
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminRole, setNewAdminRole] = useState<'super_admin' | 'operator' | 'analyst'>('super_admin');
  const [adminSaving, setAdminSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [claiming, setClaiming] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Load metrics from get_platform_metrics RPC
  const fetchMetrics = useCallback(async (days: number) => {
    const client = getSupabaseClient();
    if (!client) return;
    setLoadingMetrics(true);
    try {
      const { data, error } = await client.rpc('get_platform_metrics', { p_days: days });
      if (!error && data) {
        setMetrics(data as PlatformMetrics);
      } else if (error) {
        console.warn('Could not load platform metrics:', error.message);
      }
    } finally {
      setLoadingMetrics(false);
    }
  }, []);

  // Load clubs from get_platform_clubs RPC
  const fetchClubs = useCallback(async (query: string = '') => {
    const client = getSupabaseClient();
    if (!client) return;
    setLoadingClubs(true);
    try {
      const { data, error } = await client.rpc('get_platform_clubs', {
        p_search: query,
        p_limit: 200,
        p_offset: 0,
      });
      if (!error && data) {
        setClubs((data || []) as PlatformClubItem[]);
      } else if (error) {
        console.warn('Could not load platform clubs:', error.message);
      }
    } finally {
      setLoadingClubs(false);
    }
  }, []);

  // Load admins list for the modal
  const fetchAdmins = useCallback(async () => {
    const client = getSupabaseClient();
    if (!client) return;
    const { data } = await client.from('platform_admins').select('*').order('created_at', { ascending: true });
    setAdminsList((data || []) as PlatformAdmin[]);
  }, []);

  useEffect(() => {
    if (isAuthenticated && isPlatformAdmin) {
      fetchMetrics(periodDays);
      fetchClubs('');
    }
  }, [isAuthenticated, isPlatformAdmin, periodDays, fetchMetrics, fetchClubs]);

  // Initial setup claim handler if no platform admins exist yet
  const handleClaimInitialAdmin = async () => {
    const client = getSupabaseClient();
    if (!client) return;
    setClaiming(true);
    try {
      const { error } = await client.rpc('claim_first_platform_admin');
      if (error) {
        alert(error.message);
      } else {
        showToast('✓ Platform super-admin claimed! Reloading permissions...');
        window.location.reload();
      }
    } finally {
      setClaiming(false);
    }
  };

  // Add new platform admin
  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdminEmail.trim()) return;
    const client = getSupabaseClient();
    if (!client) return;
    setAdminSaving(true);
    try {
      const { error } = await client.rpc('add_platform_admin', {
        p_email: newAdminEmail.trim().toLowerCase(),
        p_role: newAdminRole,
      });
      if (error) {
        alert(error.message);
      } else {
        showToast(`✓ Added ${newAdminEmail} as platform ${newAdminRole}`);
        setNewAdminEmail('');
        fetchAdmins();
      }
    } finally {
      setAdminSaving(false);
    }
  };

  // Remove platform admin
  const handleRemoveAdmin = async (email: string) => {
    if (!confirm(`Are you sure you want to revoke platform admin access for ${email}?`)) return;
    const client = getSupabaseClient();
    if (!client) return;
    try {
      const { error } = await client.rpc('remove_platform_admin', { p_email: email });
      if (error) {
        alert(error.message);
      } else {
        showToast(`✓ Revoked platform access for ${email}`);
        fetchAdmins();
      }
    } catch (err: unknown) {
      alert((err as Error).message);
    }
  };

  // Filtered clubs table list
  const filteredClubs = useMemo(() => {
    return clubs.filter(c => {
      if (statusFilter === 'active' && !c.is_active) return false;
      if (statusFilter === 'inactive' && c.is_active) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        c.name.toLowerCase().includes(q) ||
        c.slug.toLowerCase().includes(q) ||
        (c.owner_email && c.owner_email.toLowerCase().includes(q)) ||
        (c.owner_name && c.owner_name.toLowerCase().includes(q))
      );
    });
  }, [clubs, searchQuery, statusFilter]);

  // CSV Export for Club Directory
  const handleExportClubsCsv = () => {
    const rows = [
      ['Club Name', 'Slug', 'Owner Name', 'Owner Email', 'Status', 'Members', 'Pending Approvals', 'Teams', '30d Visits', 'GMV ($)', 'Payment Policy', 'Stripe Connected', 'Created At'],
      ...filteredClubs.map(c => [
        c.name,
        c.slug,
        c.owner_name || '',
        c.owner_email || '',
        c.is_active ? 'Active' : 'Inactive',
        c.member_count,
        c.pending_count,
        c.team_count,
        c.visits_30d,
        (c.gmv_cents / 100).toFixed(2),
        c.membership_payment_policy,
        c.stripe_ready ? 'Yes' : 'No',
        c.created_at,
      ]),
    ];
    const csvData = toCsv(rows);
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `itsfootball-clubs-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 1. Loading state
  if (authLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-main)' }}>
        <PlatformNavbar />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
          <RefreshCw size={24} className="spin" style={{ marginRight: '0.75rem' }} />
          <span>Verifying platform credentials...</span>
        </div>
        <Footer />
      </div>
    );
  }

  // 2. Unauthorized or not signed in
  if (!isAuthenticated || !isPlatformAdmin) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-main)' }}>
        <PlatformNavbar />
        <main className="container" style={{ flex: 1, padding: '4rem 1rem', maxWidth: '640px', margin: 'auto' }}>
          <div className="glass-panel" style={{ padding: '2.5rem', textAlign: 'center' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--c-red)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem auto' }}>
              <Lock size={32} />
            </div>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 900, marginBottom: '0.75rem', color: 'var(--text-primary)' }}>
              Platform Control Room
            </h1>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '1.75rem' }}>
              This operational console is reserved exclusively for the <strong>itsfootball.club</strong> platform founder and authorized operations staff.
            </p>

            {isAuthenticated ? (
              <div style={{ background: 'rgba(var(--tint-rgb), 0.04)', padding: '1.25rem', borderRadius: '8px', marginBottom: '1.5rem', border: '1px solid var(--border-subtle)', textAlign: 'left' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 800, marginBottom: '0.25rem' }}>
                  Current Account
                </div>
                <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>{user?.email}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--c-red)', marginTop: '0.5rem' }}>
                  This account is not registered in the <code>platform_admins</code> table.
                </div>
                <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.75rem' }}>
                  <button
                    type="button"
                    onClick={handleClaimInitialAdmin}
                    disabled={claiming}
                    className="btn btn-secondary btn-sm"
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', color: '#818CF8' }}
                  >
                    <ShieldCheck size={16} />
                    <span>{claiming ? 'Verifying...' : 'Claim Initial Platform Super-Admin (Founder Bootstrap)'}</span>
                  </button>
                  <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.35rem', textAlign: 'center' }}>
                    Available only if no platform admins are registered yet.
                  </span>
                </div>
              </div>
            ) : (
              <div style={{ marginBottom: '1.5rem' }}>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Please sign in with your platform owner credentials.
                </p>
              </div>
            )}

            <Link href="/" className="btn btn-primary btn-sm">
              Return to Homepage
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-main)' }}>
      <PlatformNavbar />

      {/* Toast */}
      {toastMessage && (
        <div role="status" className="admin-save-toast" style={{
          position: 'fixed',
          bottom: '2rem',
          right: '2rem',
          background: 'var(--c-green)',
          color: '#FFFFFF',
          padding: '0.75rem 1.25rem',
          borderRadius: '8px',
          fontWeight: 700,
          boxShadow: 'var(--shadow-lg)',
          zIndex: 99999,
        }}>
          {toastMessage}
        </div>
      )}

      <main className="container" style={{ flex: 1, padding: '2rem 1rem 4rem 1rem', maxWidth: '1440px' }}>
        {/* Top Header & Range Toolbar */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1.25rem', marginBottom: '2rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.35rem' }}>
              <span className="badge" style={{ background: 'rgba(99, 102, 241, 0.2)', color: '#818CF8', fontWeight: 800, letterSpacing: '0.06em' }}>
                SUPER-ADMIN CONSOLE
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', color: 'var(--c-green)', fontWeight: 700 }}>
                <span className="pulse-dot" style={{ background: '#10B981', width: '7px', height: '7px' }} />
                <span>Live System Monitoring</span>
              </div>
            </div>
            <h1 style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <Gauge size={28} color="#818CF8" />
              <span>Platform Control Room</span>
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem', marginBottom: 0 }}>
              Live intelligence for user signups, club activations, financial GMV, and network traffic across <strong>itsfootball.club</strong>.
            </p>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.75rem' }}>
            {/* Period Pills */}
            <div style={{ display: 'flex', background: 'rgba(var(--tint-rgb), 0.05)', padding: '0.25rem', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
              {PERIOD_OPTIONS.map(opt => (
                <button
                  key={opt.days}
                  type="button"
                  onClick={() => setPeriodDays(opt.days)}
                  style={{
                    border: 'none',
                    padding: '0.45rem 0.85rem',
                    borderRadius: '6px',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: periodDays === opt.days ? '#6366F1' : 'transparent',
                    color: periodDays === opt.days ? '#FFFFFF' : 'var(--text-muted)',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Refresh button */}
            <button
              type="button"
              onClick={() => { fetchMetrics(periodDays); fetchClubs(searchQuery); }}
              disabled={loadingMetrics || loadingClubs}
              className="btn btn-secondary btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
              title="Refresh all metrics"
            >
              <RefreshCw size={14} className={loadingMetrics || loadingClubs ? 'spin' : ''} />
              <span>Refresh</span>
            </button>

            {/* Manage Admins button */}
            <button
              type="button"
              onClick={() => { fetchAdmins(); setAdminsModalOpen(true); }}
              className="btn btn-secondary btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#818CF8' }}
            >
              <UserPlus size={14} />
              <span>Manage Admins</span>
            </button>
          </div>
        </div>

        {/* SECTION 1: EXECUTIVE KPI CARDS */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))',
          gap: '1rem',
          marginBottom: '2rem',
        }}>
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
              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>SIGNUP PAID RATE</span>
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

        {/* SECTION 2: CHARTS & FUNNEL ROW */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 480px), 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
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

            {/* Custom Bar Visualization */}
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

        {/* SECTION 3: TOP CLUBS & LIVE ACTIVITY FEED */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
          {/* Top Clubs Leaderboard */}
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Trophy size={18} color="var(--c-amber)" />
                <span>Top Network Clubs</span>
              </h3>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Sorted by activity</span>
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
                        <img loading="lazy" decoding="async" width={24} height={24} src={c.logo_url} alt="" style={{ width: '24px', height: '24px', borderRadius: '4px', objectFit: 'contain' }} />
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
                RECENT
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

        {/* SECTION 4: MASTER CLUB DIRECTORY & HEALTH AUDIT */}
        <div className="glass-panel" style={{ padding: '1.75rem' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.5rem' }}>
            <div>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>
                Master Club Directory ({filteredClubs.length})
              </h2>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Inspect and monitor every club footprint, member count, payment status, and web traffic
              </span>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.75rem' }}>
              {/* Search Bar */}
              <div style={{ position: 'relative', width: '260px' }}>
                <Search size={15} color="var(--text-muted)" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="text"
                  placeholder="Search club, slug or owner..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.45rem 0.75rem 0.45rem 2.2rem',
                    background: 'rgba(var(--shade-rgb), 0.5)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '6px',
                    color: 'var(--text-primary)',
                    fontSize: '0.82rem',
                  }}
                />
              </div>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
                style={{
                  padding: '0.45rem 0.75rem',
                  background: 'rgba(var(--shade-rgb), 0.5)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '6px',
                  color: 'var(--text-primary)',
                  fontSize: '0.82rem',
                }}
              >
                <option value="all">All Statuses</option>
                <option value="active">Active Only</option>
                <option value="inactive">Inactive / Draft</option>
              </select>

              {/* CSV Export */}
              <button
                type="button"
                onClick={handleExportClubsCsv}
                className="btn btn-secondary btn-sm"
                style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                title="Download Club Directory as CSV"
              >
                <Download size={14} />
                <span>Export CSV</span>
              </button>
            </div>
          </div>

          {/* Clubs Table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border-subtle)', color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <th style={{ padding: '0.75rem 0.5rem' }}>Club</th>
                  <th style={{ padding: '0.75rem 0.5rem' }}>Owner</th>
                  <th style={{ padding: '0.75rem 0.5rem' }}>Footprint</th>
                  <th style={{ padding: '0.75rem 0.5rem' }}>Payment Policy</th>
                  <th style={{ padding: '0.75rem 0.5rem' }}>30d Traffic</th>
                  <th style={{ padding: '0.75rem 0.5rem' }}>GMV</th>
                  <th style={{ padding: '0.75rem 0.5rem' }}>Status</th>
                  <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredClubs.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: '2rem 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No clubs found matching your query.
                    </td>
                  </tr>
                ) : (
                  filteredClubs.map(c => {
                    const getPolicyBadge = (policy: MembershipPaymentPolicy) => {
                      switch (policy) {
                        case 'require_payment':
                          return <span className="badge" style={{ background: 'rgba(239, 68, 68, 0.15)', color: 'var(--c-red)' }}>Strict Payment</span>;
                        case 'allow_waiver':
                          return <span className="badge" style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#818CF8' }}>Waiver Allowed</span>;
                        case 'auto_approve':
                        case 'auto_approve_with_waiver':
                          return <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.15)', color: 'var(--c-green)' }}>Auto-Approve</span>;
                        default:
                          return <span className="badge">Payment Required</span>;
                      }
                    };

                    return (
                      <tr key={c.id} style={{ borderBottom: '1px solid var(--border-subtle)', transition: 'background 0.15s ease' }}>
                        {/* Club */}
                        <td style={{ padding: '0.85rem 0.5rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                            {c.logo_url ? (
                              <img loading="lazy" decoding="async" width={28} height={28} src={c.logo_url} alt="" style={{ width: '28px', height: '28px', borderRadius: '4px', objectFit: 'contain' }} />
                            ) : (
                              <div style={{ width: '28px', height: '28px', borderRadius: '4px', background: c.primary_color || 'var(--club-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.75rem', fontWeight: 800 }}>
                                {c.short_name.slice(0, 2)}
                              </div>
                            )}
                            <div>
                              <div style={{ fontWeight: 800, color: 'var(--text-primary)' }}>{c.name}</div>
                              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                /{c.slug} {c.custom_domain && <span style={{ color: '#818CF8' }}>({c.custom_domain})</span>}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Owner */}
                        <td style={{ padding: '0.85rem 0.5rem' }}>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{c.owner_name || 'Founder'}</div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{c.owner_email || '—'}</div>
                        </td>

                        {/* Footprint */}
                        <td style={{ padding: '0.85rem 0.5rem' }}>
                          <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                            {c.member_count} members {c.pending_count > 0 && <span style={{ color: 'var(--c-amber)', fontSize: '0.7rem' }}>({c.pending_count} pending)</span>}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            {c.team_count} teams · {c.match_count} matches
                          </div>
                        </td>

                        {/* Payment Policy */}
                        <td style={{ padding: '0.85rem 0.5rem' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', alignItems: 'flex-start' }}>
                            {getPolicyBadge(c.membership_payment_policy)}
                            <span style={{ fontSize: '0.68rem', color: c.stripe_ready ? 'var(--c-green)' : 'var(--text-muted)' }}>
                              {c.stripe_ready ? '✓ Stripe Connected' : 'Manual Bank Only'}
                            </span>
                          </div>
                        </td>

                        {/* 30d Traffic */}
                        <td style={{ padding: '0.85rem 0.5rem' }}>
                          <div style={{ fontWeight: 800, color: '#818CF8' }}>{c.visits_30d.toLocaleString()}</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>views</div>
                        </td>

                        {/* GMV */}
                        <td style={{ padding: '0.85rem 0.5rem' }}>
                          <div style={{ fontWeight: 800, color: 'var(--c-green)' }}>{formatMoney(c.gmv_cents, 'AUD')}</div>
                        </td>

                        {/* Status */}
                        <td style={{ padding: '0.85rem 0.5rem' }}>
                          {c.is_active ? (
                            <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.15)', color: 'var(--c-green)' }}>Active</span>
                          ) : (
                            <span className="badge" style={{ background: 'rgba(239, 68, 68, 0.15)', color: 'var(--c-red)' }}>Inactive</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td style={{ padding: '0.85rem 0.5rem', textAlign: 'right' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.5rem' }}>
                            <Link
                              href={`/${c.slug}`}
                              target="_blank"
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '0.25rem 0.55rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                              title="Open public website"
                            >
                              <ExternalLink size={12} />
                              <span>Site</span>
                            </Link>
                            <Link
                              href={`/${c.slug}/admin`}
                              target="_blank"
                              className="btn btn-primary btn-sm"
                              style={{ padding: '0.25rem 0.55rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                              title="Inspect Club Admin Panel"
                            >
                              <Shield size={12} />
                              <span>Admin</span>
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* PLATFORM ADMINS MANAGEMENT MODAL */}
      {adminsModalOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.85)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1rem',
        }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '580px', padding: '1.75rem', background: 'rgb(var(--dk-9-13-22))' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ShieldCheck size={22} color="#818CF8" />
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  Platform Super-Admins
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setAdminsModalOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem', lineHeight: 1.5 }}>
              Platform admins have global authority to access this control room, review metrics, and inspect all clubs.
            </p>

            {/* Existing Admins List */}
            <div style={{ marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Active Admins ({adminsList.length})
              </div>
              {adminsList.map(adm => (
                <div
                  key={adm.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.65rem 0.85rem',
                    background: 'rgba(var(--tint-rgb), 0.04)',
                    borderRadius: '6px',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.85rem' }}>
                      {adm.email} {adm.email === user?.email && <span style={{ color: 'var(--c-green)', fontSize: '0.72rem' }}>(You)</span>}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      Role: <strong style={{ color: '#818CF8' }}>{adm.role}</strong> · Added {formatDate(adm.created_at)}
                    </div>
                  </div>

                  {adm.email !== user?.email && (
                    <button
                      type="button"
                      onClick={() => handleRemoveAdmin(adm.email)}
                      style={{ background: 'none', border: 'none', color: 'var(--c-red)', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700 }}
                    >
                      Revoke
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Add New Admin Form */}
            <form onSubmit={handleAddAdmin} style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1.25rem' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.6rem' }}>
                Invite New Platform Admin
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <input
                  type="email"
                  required
                  placeholder="Enter email (e.g. founder@domain.com)"
                  value={newAdminEmail}
                  onChange={e => setNewAdminEmail(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '0.55rem 0.75rem',
                    background: 'rgba(var(--shade-rgb), 0.5)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '6px',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                  }}
                />
                <select
                  value={newAdminRole}
                  onChange={e => setNewAdminRole(e.target.value as 'super_admin' | 'operator' | 'analyst')}
                  style={{
                    padding: '0.55rem 0.75rem',
                    background: 'rgba(var(--shade-rgb), 0.5)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '6px',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                  }}
                >
                  <option value="super_admin">Super Admin</option>
                  <option value="operator">Operator</option>
                  <option value="analyst">Analyst</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setAdminsModalOpen(false)}
                  className="btn btn-secondary btn-sm"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={adminSaving || !newAdminEmail.trim()}
                  className="btn btn-sm"
                  style={{ background: '#6366F1', color: '#FFFFFF', border: 'none' }}
                >
                  {adminSaving ? 'Granting...' : 'Grant Access'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
