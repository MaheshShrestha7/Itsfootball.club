'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { getSupabaseClient } from '@/lib/supabase/client';
import PlatformNavbar from '@/components/PlatformNavbar';
import Footer from '@/components/Footer';
import {
  PlatformMetrics,
  PlatformClubItem,
  PlatformAdmin,
} from '@/lib/supabase/types';

import CockpitTab from '@/components/admin/platform/CockpitTab';
import ClubsTab from '@/components/admin/platform/ClubsTab';
import UsersTab from '@/components/admin/platform/UsersTab';
import HealthTab from '@/components/admin/platform/HealthTab';
import BroadcastsTab from '@/components/admin/platform/BroadcastsTab';
import ClubDetailDrawer from '@/components/admin/platform/ClubDetailDrawer';
import PlatformAdminsModal from '@/components/admin/platform/PlatformAdminsModal';

import {
  Gauge,
  Building,
  Users,
  Activity,
  Radio,
  RefreshCw,
  UserPlus,
  ShieldCheck,
  Lock,
} from 'lucide-react';

const PERIOD_OPTIONS = [
  { days: 7, label: 'Last 7 Days' },
  { days: 30, label: 'Last 30 Days' },
  { days: 90, label: 'Last 90 Days' },
];

type TabType = 'cockpit' | 'clubs' | 'users' | 'health' | 'broadcasts';

export default function PlatformOwnerDashboard() {
  const { user, isAuthenticated, isLoading: authLoading, isPlatformAdmin } = useAuth();

  const [activeTab, setActiveTab] = useState<TabType>('cockpit');
  const [periodDays, setPeriodDays] = useState<number>(30);
  const [metrics, setMetrics] = useState<PlatformMetrics | null>(null);
  const [clubs, setClubs] = useState<PlatformClubItem[]>([]);
  const [loadingMetrics, setLoadingMetrics] = useState(true);
  const [loadingClubs, setLoadingClubs] = useState(true);

  // Club Detail Drawer
  const [selectedClub, setSelectedClub] = useState<PlatformClubItem | null>(null);
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null);

  // Admins modal
  const [adminsModalOpen, setAdminsModalOpen] = useState(false);
  const [adminsList, setAdminsList] = useState<PlatformAdmin[]>([]);
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
        p_limit: 300,
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
  const handleAddAdmin = async (email: string, role: 'super_admin' | 'operator' | 'analyst') => {
    const client = getSupabaseClient();
    if (!client) return;
    try {
      const { error } = await client.rpc('add_platform_admin', {
        p_email: email,
        p_role: role,
      });
      if (error) {
        alert(error.message);
      } else {
        showToast(`✓ Added ${email} as platform ${role}`);
        fetchAdmins();
      }
    } catch (err: any) {
      alert(err.message);
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

  // Toggle club status (Active <-> Suspended)
  const handleToggleClubStatus = async (clubId: string, currentStatus: boolean) => {
    const newStatus = !currentStatus;
    const confirmMsg = newStatus
      ? 'Reactivate this club? Public page access and fixtures will be restored.'
      : 'Suspend this club? Public page will display maintenance mode and portal access will be paused.';
    if (!confirm(confirmMsg)) return;

    setStatusUpdatingId(clubId);
    const client = getSupabaseClient();
    if (!client) {
      setStatusUpdatingId(null);
      return;
    }

    try {
      // Try RPC first
      const { error } = await client.rpc('toggle_platform_club_status', {
        p_club_id: clubId,
        p_is_active: newStatus,
      });

      if (error) {
        // Fallback direct update
        const { error: directError } = await client
          .from('clubs')
          .update({ is_active: newStatus })
          .eq('id', clubId);
        if (directError) throw directError;
      }

      showToast(newStatus ? '✓ Club successfully reactivated' : '✓ Club suspended');

      // Update local state
      setClubs(prev =>
        prev.map(c => (c.id === clubId ? { ...c, is_active: newStatus } : c))
      );
      if (selectedClub && selectedClub.id === clubId) {
        setSelectedClub(prev => (prev ? { ...prev, is_active: newStatus } : null));
      }
    } catch (err: any) {
      alert(`Could not update club status: ${err.message}`);
    } finally {
      setStatusUpdatingId(null);
    }
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

      {/* Floating Save Toast */}
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
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1.25rem', marginBottom: '1.75rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.35rem' }}>
              <span className="badge" style={{ background: 'rgba(99, 102, 241, 0.2)', color: '#818CF8', fontWeight: 800, letterSpacing: '0.06em' }}>
                SUPER-ADMIN CONSOLE
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', color: 'var(--c-green)', fontWeight: 700 }}>
                <span className="pulse-dot" style={{ background: '#10B981', width: '7px', height: '7px' }} />
                <span>Live Telemetry Online</span>
              </div>
            </div>
            <h1 style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <Gauge size={28} color="#818CF8" />
              <span>Platform Mission Control</span>
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem', marginBottom: 0 }}>
              Live governance, multi-tenant fleet management, cross-tenant user lookup, and infrastructure vitals for <strong>itsfootball.club</strong>.
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
              onClick={() => { fetchMetrics(periodDays); fetchClubs(''); }}
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

        {/* MODERN TAB NAVIGATION BAR */}
        <div style={{
          display: 'flex',
          gap: '0.5rem',
          borderBottom: '1px solid var(--border-subtle)',
          marginBottom: '2rem',
          overflowX: 'auto',
          paddingBottom: '0.5rem',
        }}>
          {[
            { id: 'cockpit' as TabType, label: 'Cockpit Overview', icon: Gauge },
            { id: 'clubs' as TabType, label: `Clubs Fleet (${clubs.length})`, icon: Building },
            { id: 'users' as TabType, label: 'Platform Users', icon: Users },
            { id: 'health' as TabType, label: 'System Health & Vitals', icon: Activity },
            { id: 'broadcasts' as TabType, label: 'Broadcasts & Banners', icon: Radio },
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                style={{
                  border: 'none',
                  padding: '0.65rem 1.1rem',
                  borderRadius: '8px',
                  fontSize: '0.88rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  background: isActive ? 'rgba(99, 102, 241, 0.18)' : 'transparent',
                  color: isActive ? '#818CF8' : 'var(--text-secondary)',
                  borderBottom: isActive ? '2px solid #818CF8' : '2px solid transparent',
                  transition: 'all 0.15s ease',
                  whiteSpace: 'nowrap',
                }}
              >
                <Icon size={16} color={isActive ? '#818CF8' : 'var(--text-muted)'} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* ACTIVE TAB CONTENT */}
        {activeTab === 'cockpit' && (
          <CockpitTab
            metrics={metrics}
            clubs={clubs}
            periodDays={periodDays}
            onSelectTab={setActiveTab}
            onSelectClub={c => setSelectedClub(c)}
          />
        )}

        {activeTab === 'clubs' && (
          <ClubsTab
            clubs={clubs}
            loading={loadingClubs}
            onSelectClub={c => setSelectedClub(c)}
            onToggleStatus={handleToggleClubStatus}
            statusUpdatingId={statusUpdatingId}
          />
        )}

        {activeTab === 'users' && (
          <UsersTab />
        )}

        {activeTab === 'health' && (
          <HealthTab />
        )}

        {activeTab === 'broadcasts' && (
          <BroadcastsTab showToast={showToast} />
        )}
      </main>

      {/* CLUB INSPECT SLIDING DRAWER */}
      <ClubDetailDrawer
        club={selectedClub}
        onClose={() => setSelectedClub(null)}
        onToggleStatus={handleToggleClubStatus}
        statusUpdating={statusUpdatingId === selectedClub?.id}
      />

      {/* PLATFORM ADMINS MANAGEMENT MODAL */}
      <PlatformAdminsModal
        isOpen={adminsModalOpen}
        onClose={() => setAdminsModalOpen(false)}
        adminsList={adminsList}
        currentAdminEmail={user?.email}
        onAddAdmin={handleAddAdmin}
        onRemoveAdmin={handleRemoveAdmin}
      />

      <Footer />
    </div>
  );
}
