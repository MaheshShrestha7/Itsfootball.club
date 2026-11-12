'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { getSupabaseClient } from '@/lib/supabase/client';
import PlatformNavbar from '@/components/PlatformNavbar';
import Footer from '@/components/Footer';
import ThemeToggle from '@/components/ThemeToggle';
import { RailLogo } from '@/components/admin/platform/McArt';
import { readMissionUrl, missionUrl, type MissionTab } from '@/lib/mission-control';
import './mission-control.css';
import {
  PlatformMetrics,
  PlatformClubItem,
  PlatformAdmin,
} from '@/lib/supabase/types';

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
  MoreHorizontal,
} from 'lucide-react';
import { confirmAction, notify } from '@/components/ConfirmDialog';
import NewClubForm from '@/components/admin/platform/NewClubForm';
import TwoStepSignIn from '@/components/TwoStepSignIn';

const PERIOD_OPTIONS = [
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
];

type TabType = MissionTab;

export default function PlatformOwnerDashboard() {
  const { user, isAuthenticated, isLoading: authLoading, isPlatformAdmin } = useAuth();

  const [activeTab, setActiveTabState] = useState<TabType>('today');
  const [moreOpen, setMoreOpen] = useState(false);
  // The club panel
  const [selectedClub, setSelectedClub] = useState<PlatformClubItem | null>(null);
  // The club to open once the list has loaded (from the web address)
  const [pendingClubId, setPendingClubId] = useState<string | null>(null);
  const [emailDraft, setEmailDraft] = useState<EmailDraft | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [peopleQuery, setPeopleQuery] = useState('');
  const [supportOpen, setSupportOpen] = useState(0);
  const [supportId, setSupportId] = useState<string | null>(null);
  const [newClubOpen, setNewClubOpen] = useState(false);

  // The page, open club and support request live in the web address, so refresh, back and shared links work
  const setActiveTab = useCallback((tab: TabType) => {
    setActiveTabState(tab);
    setMoreOpen(false);
    setNewClubOpen(false);
    if (tab !== 'support') setSupportId(null);
    const next = missionUrl(window.location.search, { tab, request: tab === 'support' ? undefined : null });
    if (next !== window.location.search) window.history.pushState(null, '', `${window.location.pathname}${next}`);
  }, []);
  useEffect(() => {
    const apply = () => {
      const u = readMissionUrl(window.location.search);
      setActiveTabState(u.tab);
      setSupportId(u.request);
      setPendingClubId(u.club);
      if (!u.club) setSelectedClub(null);
    };
    apply();
    window.addEventListener('popstate', apply);
    return () => window.removeEventListener('popstate', apply);
  }, []);
  const searchPeople = useCallback((q: string) => { setPeopleQuery(q); setActiveTab('users'); }, [setActiveTab]);

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
      // Every club, 300 at a time, so Today and the counts never miss one
      const PAGE = 300;
      const all: PlatformClubItem[] = [];
      for (let offset = 0; offset < 20000; offset += PAGE) {
        const { data, error } = await client.rpc('get_platform_clubs', { p_search: query, p_limit: PAGE, p_offset: offset });
        if (error) { console.warn('Could not load platform clubs:', error.message); break; }
        const page = (data || []) as PlatformClubItem[];
        all.push(...page);
        if (page.length < PAGE) break;
      }
      setClubs(all);
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

  // Changing the period only reloads the numbers, never the club list
  useEffect(() => {
    if (isAuthenticated && isPlatformAdmin) fetchMetrics(periodDays);
  }, [isAuthenticated, isPlatformAdmin, periodDays, fetchMetrics]);
  useEffect(() => {
    if (isAuthenticated && isPlatformAdmin) fetchClubs('');
  }, [isAuthenticated, isPlatformAdmin, fetchClubs]);

  // Open the club named in the web address once the list is in
  useEffect(() => {
    if (!pendingClubId || !clubs.length) return;
    const c = clubs.find(x => x.id === pendingClubId || x.slug === pendingClubId);
    if (c) setSelectedClub(c);
    setPendingClubId(null);
  }, [pendingClubId, clubs]);

  // Does Mission Control have an owner yet? Only then is the first-run claim offered
  const [hasAdmins, setHasAdmins] = useState<boolean | null>(null);
  useEffect(() => {
    if (!isAuthenticated || isPlatformAdmin) return;
    const client = getSupabaseClient();
    if (!client) return;
    // Before migration 20261163 this function doesn't exist: keep the claim hidden
    client.rpc('platform_has_admins').then(({ data, error }) => setHasAdmins(error ? true : data !== false), () => setHasAdmins(true));
  }, [isAuthenticated, isPlatformAdmin]);

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
      <div className="mc mc-locked">
        <section className="mc-card mc-locked-card">
          <span className="mc-sq" style={{ background: 'var(--mc-amber-bg)', color: 'var(--mc-amber)', width: 44, height: 44 }}><Lock size={20} /></span>
          <h1>Mission Control is for the itsfootball.club team</h1>
          {isAuthenticated ? (
            <>
              <p>This account doesn&apos;t have access. If you think it should, ask the platform owner to add you.</p>
              <div className="mc-locked-me"><small>Signed in as</small>{user?.email}</div>
            </>
          ) : (
            <p>Sign in with the account the platform owner added.</p>
          )}
          <div className="mc-locked-acts">
            {isAuthenticated
              ? <Link href="/" className="mc-pill-btn">Back to the site</Link>
              : <Link href="/login?next=/admin/platform" className="mc-pill-btn">Sign in</Link>}
            {isAuthenticated && <Link href="/login?next=/admin/platform" className="mc-pill-btn ghost">Sign in with another account</Link>}
          </div>
          {isAuthenticated && hasAdmins === false && (
            <div className="mc-locked-first">
              <h2>No one runs Mission Control yet</h2>
              <p>Whoever claims it first becomes the platform owner and can add others.</p>
              <div>
                <button type="button" className="mc-pill-btn" onClick={handleClaimInitialAdmin} disabled={claiming}>
                  <ShieldCheck size={14} /> {claiming ? 'Checking…' : 'Make me the platform owner'}
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    );
  }

  const clubsNeedingAttention = clubs.filter(c => c.pending_count >= 5 || (c.membership_payment_policy === 'require_payment' && !c.stripe_ready)).length;

  type NavItem = { id: TabType; label: string; icon: React.ElementType; count?: number; warn?: boolean };
  const GROUPS: { label: string; items: NavItem[] }[] = [
    { label: 'Work', items: [
      { id: 'today', label: 'Today', icon: ListChecks },
      { id: 'support', label: 'Support', icon: Inbox, count: supportOpen || undefined, warn: supportOpen > 0 },
      { id: 'clubs', label: 'Clubs', icon: Building, count: clubs.length || undefined, warn: clubsNeedingAttention > 0 },
      { id: 'users', label: 'People', icon: Users },
    ] },
    { label: 'Look', items: [
      { id: 'overview', label: 'Overview', icon: Eye },
      { id: 'grounds', label: 'Grounds', icon: MapPin },
      { id: 'health', label: 'System health', icon: Activity },
    ] },
    { label: 'Tell and record', items: [
      { id: 'broadcasts', label: 'Broadcasts', icon: Radio },
      { id: 'log', label: 'Action log', icon: History },
    ] },
  ];
  const ALL_NAV = GROUPS.flatMap(g => g.items);
  // The phone bar: the four daily pages, everything else under More
  const BAR: TabType[] = ['today', 'support', 'clubs', 'users'];
  const inMore = !BAR.includes(activeTab);

  const go = (t: TabType) => { setActiveTab(t); window.scrollTo({ top: 0 }); };
  const openClub = (c: PlatformClubItem) => {
    setSelectedClub(c);
    window.history.replaceState(null, '', `${window.location.pathname}${missionUrl(window.location.search, { club: c.id })}`);
  };
  const closeClub = () => {
    setSelectedClub(null);
    window.history.replaceState(null, '', `${window.location.pathname}${missionUrl(window.location.search, { club: null })}`);
  };
  const openSupport = (id: string | null) => {
    setActiveTab('support');
    setSupportId(id);
    window.history.replaceState(null, '', `${window.location.pathname}${missionUrl(window.location.search, { tab: 'support', request: id })}`);
  };
  // The open club, refreshed whenever the list reloads (e.g. after an owner change)
  const drawerClub = selectedClub ? clubs.find(c => c.id === selectedClub.id) || selectedClub : null;

  const navButton = (item: NavItem, className: string) => {
    const Icon = item.icon;
    return (
      <button
        key={item.id}
        type="button"
        className={className}
        aria-current={activeTab === item.id ? 'page' : undefined}
        onClick={() => go(item.id)}
      >
        <Icon size={18} aria-hidden="true" />
        <span>{item.label}</span>
        {item.count !== undefined && <em className={`mc-count num${item.warn ? ' warn' : ''}`}>{item.count}</em>}
      </button>
    );
  };

  return (
    <div className={`mc${moreOpen ? ' mc-more-open' : ''}`}>
      {/* Floating Save Toast */}
      {toastMessage && (
        <div role="status" className="admin-save-toast mc-toast">{toastMessage}</div>
      )}

      {/* SIDEBAR (desktop) */}
      <nav className="mc-side" aria-label="Mission Control">
        <Link href="/" className="mc-brand" aria-label="itsfootball.club home">
          <RailLogo />
          <span><b>Mission Control</b><small>itsfootball.club</small></span>
        </Link>
        {GROUPS.map(g => (
          <div key={g.label} className="mc-side-group">
            <div className="mc-group-label">{g.label}</div>
            {g.items.map(item => navButton(item, 'mc-nav'))}
          </div>
        ))}
        <span className="mc-side-spacer" />
        <div className="mc-side-foot">
          <button type="button" className="mc-nav" onClick={() => { fetchAdmins(); setAdminsModalOpen(true); }}>
            <ShieldCheck size={18} aria-hidden="true" /><span>Manage admins</span>
          </button>
          <span className="mc-nav mc-theme-row"><span className="theme-toggle-slot"><ThemeToggle /></span><span>Light or dark</span></span>
          <Link href="/" className="mc-nav"><LogOut size={18} aria-hidden="true" /><span>Back to the site</span></Link>
        </div>
      </nav>

      {/* BOTTOM BAR + MORE (phones) */}
      <nav className="mc-tabbar" aria-label="Mission Control">
        {BAR.map(id => {
          const item = ALL_NAV.find(i => i.id === id)!;
          const Icon = item.icon;
          const badge = id === 'today' ? undefined : id === 'support' ? (supportOpen || undefined) : undefined;
          return (
            <button key={id} type="button" className="mc-tab" aria-current={activeTab === id && !moreOpen ? 'page' : undefined} onClick={() => go(id)}>
              <Icon size={19} aria-hidden="true" />
              {item.label}
              {badge !== undefined && <span className="mc-badge num">{badge}</span>}
            </button>
          );
        })}
        <button type="button" className="mc-tab" aria-expanded={moreOpen} aria-current={inMore || moreOpen ? 'page' : undefined} onClick={() => setMoreOpen(o => !o)}>
          <MoreHorizontal size={19} aria-hidden="true" />
          More
        </button>
      </nav>
      {moreOpen && (
        <div className="mc-sheet-scrim" onClick={() => setMoreOpen(false)}>
          <div className="mc-sheet" role="dialog" aria-label="More" onClick={e => e.stopPropagation()}>
            {GROUPS.slice(1).map(g => (
              <div key={g.label}>
                <div className="mc-group-label">{g.label}</div>
                {g.items.map(item => navButton(item, 'mc-nav'))}
              </div>
            ))}
            <div className="mc-group-label">You</div>
            <button type="button" className="mc-nav" onClick={() => { setMoreOpen(false); fetchAdmins(); setAdminsModalOpen(true); }}>
              <ShieldCheck size={18} aria-hidden="true" /><span>Manage admins</span>
            </button>
            <span className="mc-nav mc-theme-row"><span className="theme-toggle-slot"><ThemeToggle /></span><span>Light or dark</span></span>
            <Link href="/" className="mc-nav"><LogOut size={18} aria-hidden="true" /><span>Back to the site</span></Link>
          </div>
        </div>
      )}

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
            onOpenLog={() => go('log')}
            onOpenPalette={() => setPaletteOpen(true)}
            onOpenSupport={id => openSupport(id)}
            onOpenTab={go}
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
            onSelectRequest={(id: string | null) => window.history.replaceState(null, '', `${window.location.pathname}${missionUrl(window.location.search, { request: id })}`)}
          />
        )}

        {activeTab === 'log' && <LogTab clubs={clubs} admins={adminsList} />}

        {activeTab === 'overview' && (
          <OverviewTab
            clubs={clubs}
            metrics={metrics}
            periodDays={periodDays}
            periodOptions={PERIOD_OPTIONS}
            onPeriodChange={setPeriodDays}
            onSelectTab={go}
            onSelectClub={openClub}
            onRefreshClubs={() => { fetchClubs(''); fetchMetrics(periodDays); }}
          />
        )}

        {activeTab === 'clubs' && (newClubOpen ? (
          <NewClubForm
            onCancel={() => setNewClubOpen(false)}
            onMade={async (id, note) => {
              setNewClubOpen(false);
              window.scrollTo({ top: 0 });
              await fetchClubs('');
              setPendingClubId(id);
              notify('The club is live', note);
            }}
          />
        ) : (
          <ClubsTab
            clubs={clubs}
            loading={loadingClubs}
            onSelectClub={openClub}
            onNewClub={() => { closeClub(); setNewClubOpen(true); window.scrollTo({ top: 0 }); }}
          />
        ))}

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

      {/* CLUB PANEL */}
      <ClubDetailDrawer
        club={drawerClub}
        onClose={closeClub}
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
        tabs={ALL_NAV.map(r => ({ id: r.id, label: r.label }))}
        onSelectClub={openClub}
        onSelectTab={go}
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
