'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { getSupabaseClient } from '@/lib/supabase/client';
import PlatformNavbar from '@/components/PlatformNavbar';
import Footer from '@/components/Footer';
import ThemeToggle from '@/components/ThemeToggle';
import { RailLogo } from '@/components/admin/platform/McArt';
import type { MissionTab } from '@/lib/mission-control';
import './mission-control.css';
import {
  PlatformMetrics,
  PlatformClubItem,
  PlatformAdmin,
} from '@/lib/supabase/types';

import CockpitTab from '@/components/admin/platform/CockpitTab';
import OverviewTab from '@/components/admin/platform/OverviewTab';
import ClubsTab from '@/components/admin/platform/ClubsTab';
import UsersTab from '@/components/admin/platform/UsersTab';
import HealthTab from '@/components/admin/platform/HealthTab';
import BroadcastsTab from '@/components/admin/platform/BroadcastsTab';
import GroundsTab from '@/components/admin/platform/GroundsTab';
import ClubDetailDrawer from '@/components/admin/platform/ClubDetailDrawer';
import PlatformAdminsModal from '@/components/admin/platform/PlatformAdminsModal';
import TodayTab from '@/components/admin/platform/TodayTab';
import LogTab from '@/components/admin/platform/LogTab';
import SupportTab from '@/components/admin/platform/SupportTab';
import CommandPalette from '@/components/admin/platform/CommandPalette';
import EmailComposer, { type EmailDraft } from '@/components/admin/platform/EmailComposer';

import {
  ListChecks,
  History,
  Inbox,
  Eye,
  Building,
  Users,
  Activity,
  Radio,
  MapPin,
  RefreshCw,
  ShieldCheck,
  Lock,
  LogOut,
} from 'lucide-react';
import { confirmAction, notify } from '@/components/ConfirmDialog';
import TwoStepSignIn from '@/components/TwoStepSignIn';

const PERIOD_OPTIONS = [
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
];

type TabType = MissionTab;

export default function PlatformOwnerDashboard() {
  const { user, isAuthenticated, isLoading: authLoading, isPlatformAdmin } = useAuth();

  const [activeTab, setActiveTab] = useState<TabType>('today');
  const [emailDraft, setEmailDraft] = useState<EmailDraft | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [peopleQuery, setPeopleQuery] = useState('');
  const [supportOpen, setSupportOpen] = useState(0);
  const [supportId, setSupportId] = useState<string | null>(null);
  const searchPeople = useCallback((q: string) => { setPeopleQuery(q); setActiveTab('users'); }, []);

  // Ctrl+K / Cmd+K opens the palette anywhere in Mission Control
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPaletteOpen(o => !o); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
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
  // Listed as a platform admin, but this session hasn't passed two-step sign-in (required here)
  const [listedRole, setListedRole] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated || isPlatformAdmin) { setListedRole(null); return; }
    const client = getSupabaseClient();
    if (!client) return;
    // Before migration 20261129 this function doesn't exist, and the old gate applies
    client.rpc('platform_admin_listed').then(({ data }) => setListedRole(typeof data === 'string' ? data : null), () => setListedRole(null));
  }, [isAuthenticated, isPlatformAdmin]);

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

  // The platform team card on the Cockpit shows who has access
  useEffect(() => {
    if (isAuthenticated && isPlatformAdmin) fetchAdmins();
  }, [isAuthenticated, isPlatformAdmin, fetchAdmins]);

  // Open support requests, for the rail badge (the Support tab keeps it current)
  useEffect(() => {
    const client = getSupabaseClient();
    if (!client || !isAuthenticated || !isPlatformAdmin) return;
    client.from('support_requests').select('id', { count: 'exact', head: true }).eq('status', 'open')
      .then(({ count }) => setSupportOpen(count || 0));
  }, [isAuthenticated, isPlatformAdmin]);

  // Initial setup claim handler if no platform admins exist yet
  const handleClaimInitialAdmin = async () => {
    const client = getSupabaseClient();
    if (!client) return;
    setClaiming(true);
    try {
      const { error } = await client.rpc('claim_first_platform_admin');
      if (error) {
        notify(error.message);
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
        notify(error.message);
      } else {
        showToast(`✓ Added ${email} as platform ${role}`);
        fetchAdmins();
      }
    } catch (err: any) {
      notify(err.message);
    }
  };

  // Remove platform admin
  const handleRemoveAdmin = async (email: string) => {
    if (!(await confirmAction({ title: 'Remove platform admin?', message: `${email} will lose access to Mission Control.`, confirmLabel: 'Remove', danger: true }))) return;
    const client = getSupabaseClient();
    if (!client) return;
    try {
      const { error } = await client.rpc('remove_platform_admin', { p_email: email });
      if (error) {
        notify(error.message);
      } else {
        showToast(`✓ Revoked platform access for ${email}`);
        fetchAdmins();
      }
    } catch (err: unknown) {
      notify((err as Error).message);
    }
  };

  // Toggle club status (Active <-> Suspended)
  const handleToggleClubStatus = async (clubId: string, currentStatus: boolean) => {
    const newStatus = !currentStatus;
    const confirmMsg = newStatus
      ? 'Reactivate this club? Public page access and fixtures will be restored.'
      : 'Suspend this club? Public page will display maintenance mode and portal access will be paused.';
    if (!(await confirmAction({ title: newStatus ? 'Reactivate this club?' : 'Suspend this club?', message: confirmMsg, confirmLabel: newStatus ? 'Reactivate' : 'Suspend', danger: !newStatus }))) return;

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

      // Tell the club why (the email is kept in the club's notes)
      const club = clubs.find(c => c.id === clubId);
      if (!newStatus && club && await confirmAction({ title: 'Email the owner why?', message: `Let ${club.owner_name || 'the owner'} know ${club.name} is paused and why.`, confirmLabel: 'Write email' })) {
        setEmailDraft({ club, to: 'owner', template: 'suspended' });
      }
    } catch (err: any) {
      notify(`Could not update club status: ${err.message}`);
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

  // 2. A platform admin who still needs the second sign-in step
  if (isAuthenticated && !isPlatformAdmin && listedRole) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-main)' }}>
        <PlatformNavbar />
        <main className="container" style={{ flex: 1, padding: '4rem 1rem', maxWidth: '680px', margin: 'auto' }}>
          <div className="glass-panel" style={{ padding: '2.25rem' }}>
            <div className="row" style={{ gap: '0.75rem', marginBottom: '0.75rem' }}>
              <ShieldCheck size={26} style={{ color: 'var(--c-green)' }} aria-hidden="true" />
              <h1 style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--text-primary)' }}>Two-step sign-in needed</h1>
            </div>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              Mission Control now needs a code from an authenticator app as well as your password, so a stolen password alone can&apos;t open it.
              Signed in as <strong>{user?.email}</strong>.
            </p>
            <TwoStepSignIn reloadWhenOn intro="Set it up once with an app such as Google Authenticator or 1Password. If it's already on, enter today's code." />
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // 3. Unauthorized or not signed in
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

  const clubsNeedingAttention = clubs.filter(c => c.pending_count >= 5 || (c.membership_payment_policy === 'require_payment' && !c.stripe_ready)).length;

  const RAIL: { id: TabType; label: string; icon: React.ElementType; dot?: boolean }[] = [
    { id: 'today', label: 'Today', icon: ListChecks },
    { id: 'support', label: supportOpen ? `Support (${supportOpen} open)` : 'Support', icon: Inbox, dot: supportOpen > 0 },
    { id: 'overview', label: 'Overview', icon: Eye },
    { id: 'clubs', label: `Clubs (${clubs.length})`, icon: Building, dot: clubsNeedingAttention > 0 },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'grounds', label: 'Grounds', icon: MapPin },
    { id: 'health', label: 'System health', icon: Activity },
    { id: 'broadcasts', label: 'Broadcasts', icon: Radio },
    { id: 'log', label: 'Action log', icon: History },
  ];
  const openClub = (c: PlatformClubItem) => setSelectedClub(c);
  // The open club, refreshed whenever the list reloads (e.g. after an owner change)
  const drawerClub = selectedClub ? clubs.find(c => c.id === selectedClub.id) || selectedClub : null;

  return (
    <div className="mc">
      {/* Floating Save Toast */}
      {toastMessage && (
        <div role="status" className="admin-save-toast" style={{
          position: 'fixed',
          bottom: '2rem',
          right: '2rem',
          background: 'var(--c-green)',
          color: '#FFFFFF',
          padding: '0.75rem 1.25rem',
          borderRadius: '999px',
          fontWeight: 700,
          boxShadow: 'var(--shadow-lg)',
          zIndex: 99999,
        }}>
          {toastMessage}
        </div>
      )}

      {/* ICON RAIL (a bottom bar on phones) */}
      <nav className="mc-rail" aria-label="Mission Control">
        <Link href="/" className="mc-rail-logo" aria-label="itsfootball.club home">
          <RailLogo />
        </Link>
        {RAIL.map(item => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              className="mc-nav"
              aria-label={item.label}
              aria-current={activeTab === item.id || (item.id === 'overview' && activeTab === 'cockpit') ? 'page' : undefined}
              onClick={() => { setActiveTab(item.id); window.scrollTo({ top: 0 }); }}
            >
              <Icon size={18} />
              {item.dot && <span className="mc-dot" aria-hidden="true" />}
              <span className="mc-tip" aria-hidden="true">{item.label}</span>
            </button>
          );
        })}
        <span className="mc-rail-spacer" />
        <button
          type="button"
          className="mc-nav desk-only"
          aria-label="Manage admins"
          onClick={() => { fetchAdmins(); setAdminsModalOpen(true); }}
        >
          <ShieldCheck size={18} />
          <span className="mc-tip" aria-hidden="true">Manage admins</span>
        </button>
        <span className="theme-toggle-slot">
          <ThemeToggle />
        </span>
        <Link href="/" className="mc-nav desk-only" aria-label="Back to the site">
          <LogOut size={18} />
          <span className="mc-tip" aria-hidden="true">Back to the site</span>
        </Link>
      </nav>

      <main className="mc-main">
        {/* ACTIVE TAB CONTENT */}
        {activeTab === 'today' && (
          <TodayTab
            clubs={clubs}
            loading={loadingClubs}
            userName={user?.full_name}
            userEmail={user?.email}
            onSelectClub={openClub}
            onEmail={setEmailDraft}
            onOpenLog={() => setActiveTab('log')}
            onOpenPalette={() => setPaletteOpen(true)}
            onOpenSupport={id => { setSupportId(id); setActiveTab('support'); }}
            onOpenHealth={() => setActiveTab('health')}
            showToast={showToast}
          />
        )}

        {activeTab === 'support' && (
          <SupportTab
            key={supportId || 'inbox'}
            clubs={clubs}
            initialId={supportId}
            onSelectClub={openClub}
            onSearchPeople={searchPeople}
            showToast={showToast}
            onOpenCount={setSupportOpen}
          />
        )}

        {activeTab === 'log' && <LogTab />}

        {activeTab === 'overview' && (
          <OverviewTab
            clubs={clubs}
            periodDays={periodDays}
            periodOptions={PERIOD_OPTIONS}
            onPeriodChange={setPeriodDays}
            onSelectTab={t => { setActiveTab(t); window.scrollTo({ top: 0 }); }}
            onSelectClub={openClub}
            onRefreshClubs={() => fetchClubs('')}
          />
        )}

        {activeTab === 'cockpit' && (
          <CockpitTab
            metrics={metrics}
            clubs={clubs}
            admins={adminsList}
            userName={user?.full_name}
            userEmail={user?.email}
            periodDays={periodDays}
            periodOptions={PERIOD_OPTIONS}
            onPeriodChange={setPeriodDays}
            refreshing={loadingMetrics || loadingClubs}
            onRefresh={() => { fetchMetrics(periodDays); fetchClubs(''); fetchAdmins(); }}
            onManageAdmins={() => { fetchAdmins(); setAdminsModalOpen(true); }}
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
          <UsersTab key={peopleQuery} initialQuery={peopleQuery} showToast={showToast} />
        )}

        {activeTab === 'grounds' && (
          <GroundsTab showToast={showToast} />
        )}

        {activeTab === 'health' && (
          <HealthTab showToast={showToast} />
        )}

        {activeTab === 'broadcasts' && (
          <BroadcastsTab showToast={showToast} />
        )}
      </main>

      {/* CLUB INSPECT SLIDING DRAWER */}
      <ClubDetailDrawer
        club={drawerClub}
        onClose={() => setSelectedClub(null)}
        onToggleStatus={handleToggleClubStatus}
        statusUpdating={statusUpdatingId === selectedClub?.id}
        onEmail={setEmailDraft}
        showToast={showToast}
        onChanged={() => fetchClubs('')}
      />

      <EmailComposer draft={emailDraft} onClose={() => setEmailDraft(null)} onSent={showToast} />

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        clubs={clubs}
        tabs={[...RAIL.map(r => ({ id: r.id, label: r.label.replace(/ \(.*\)$/, '') })), { id: 'cockpit' as TabType, label: 'More stats' }]}
        onSelectClub={openClub}
        onSelectTab={t => { setActiveTab(t); window.scrollTo({ top: 0 }); }}
        onSearchPeople={searchPeople}
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
    </div>
  );
}
