'use client';

import React, { use, useState, useEffect, useRef } from 'react';
import { useEscapeToClose } from '@/lib/use-escape-to-close';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useClub } from '@/lib/club-context';
import { useAuth } from '@/lib/auth-context';
import AdminGuard from '@/components/AdminGuard';
import {
  LayoutDashboard,
  Palette,
  Radio,
  Calendar,
  Users,
  Award,
  DollarSign,
  FileText,
  BarChart3,
  QrCode,
  ExternalLink,
  Shield,
  ArrowLeft,
  LogOut,
  Trophy,
  Layers,
  Sparkles,
  CalendarDays,
  CalendarRange,
  Menu,
  X,
  Mail,
  ClipboardCheck,
  Flag,
  Flame,
  Images,
  ShieldCheck, Wallet, BellRing, LifeBuoy, ShoppingBag, KeyRound, Lock, Eye,
  ChevronDown,
  ChevronsDownUp,
  ChevronsUpDown,
  PanelLeftClose,
  PanelLeftOpen } from 'lucide-react';
import { getSupabaseClient } from '@/lib/supabase/client';
import { DEFAULT_CREST } from '@/lib/crest';
import AdminSearch from '@/components/AdminSearch';
import SupportModal from '@/components/SupportModal';
import { areaFromLocation, ADMIN_HASH_EVENT } from '@/lib/permissions';
import { CALENDAR_AREAS } from '@/lib/admin-calendar';
import { useClubAppIcons } from '@/lib/app-icons';
import { clubTeamsOf } from '@/lib/teams';

// Menu layout preferences, remembered per browser
const SIDEBAR_COLLAPSED_KEY = 'itsfootball_admin_sidebar_collapsed';
const CLOSED_SECTIONS_KEY = 'itsfootball_admin_closed_sections';
const OPEN_ITEMS_KEY = 'itsfootball_admin_open_items';

function savePref(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage unavailable: the choice just isn't remembered
  }
}

export default function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ clubSlug: string }>;
}) {
  const resolvedParams = use(params);
  const pathname = usePathname();
  const { clubs, selectClubBySlug, matches, getActiveSeason, members, clubTeams, syncStatus, retrySync, inquiries, memberMessages, updateClubBranding } = useClub();
  const { user, logout, getUserRoleForClub, can, isClubSuperUser, getClubAccess } = useAuth();
  const club = selectClubBySlug(resolvedParams.clubSlug) || clubs[0];

  // The club app's home-screen icons follow the crest (drawn here by whoever may edit the branding)
  useClubAppIcons(club, can(club.id, 'branding', 'edit'), icons => updateClubBranding(club.id, { app_icons: icons }));

  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  useEscapeToClose(mobileDrawerOpen, setMobileDrawerOpen);
  const [isMounted, setIsMounted] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);

  // Desktop sidebar shrunk to an icon rail, and the menu groups the admin has folded away
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [closedSections, setClosedSections] = useState<string[]>([]);
  // Items whose sub-items the admin opened or closed by hand (by label); the rest open on their own page
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setIsMounted(true);
    try {
      setSidebarCollapsed(localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true');
      const closed = JSON.parse(localStorage.getItem(CLOSED_SECTIONS_KEY) || '[]');
      if (Array.isArray(closed)) setClosedSections(closed.filter((t): t is string => typeof t === 'string'));
      const opened = JSON.parse(localStorage.getItem(OPEN_ITEMS_KEY) || '{}');
      if (opened && typeof opened === 'object' && !Array.isArray(opened)) {
        setOpenItems(Object.fromEntries(Object.entries(opened).filter((e): e is [string, boolean] => typeof e[1] === 'boolean')));
      }
    } catch {
      // storage unavailable or unreadable: start with everything open
    }
  }, []);

  const toggleSidebarCollapsed = () => {
    setSidebarCollapsed(prev => {
      savePref(SIDEBAR_COLLAPSED_KEY, !prev);
      return !prev;
    });
  };

  const updateClosedSections = (next: string[]) => {
    setClosedSections(next);
    savePref(CLOSED_SECTIONS_KEY, next);
  };

  const toggleSection = (title: string) => {
    updateClosedSections(closedSections.includes(title) ? closedSections.filter(t => t !== title) : [...closedSections, title]);
  };

  const toggleItem = (label: string, open: boolean) => {
    setOpenItems(prev => {
      const next = { ...prev, [label]: !open };
      savePref(OPEN_ITEMS_KEY, next);
      return next;
    });
  };

  // Close drawer on navigation
  useEffect(() => {
    setMobileDrawerOpen(false);
  }, [pathname]);

  // Bank transfer receipts waiting for the treasurer, and paid shop orders to hand over (refreshed on navigation)
  const [receiptsToReview, setReceiptsToReview] = useState(0);
  const [ordersToHandOut, setOrdersToHandOut] = useState(0);
  useEffect(() => {
    getSupabaseClient()?.from('payments').select('id', { count: 'exact', head: true })
      .eq('club_id', club.id).eq('status', 'awaiting_review')
      .then(({ count }) => setReceiptsToReview(count || 0));
    getSupabaseClient()?.from('payments').select('id', { count: 'exact', head: true })
      .eq('club_id', club.id).eq('kind', 'shop_order').eq('status', 'paid').is('fulfilled_at', null)
      .then(({ count }) => setOrdersToHandOut(count || 0));
  }, [club.id, pathname]);

  const liveMatch = matches.find(m => m.club_id === club.id && (m.status === 'live' || m.status === 'halftime'));
  const userRole = user ? getUserRoleForClub(club.id) : null;
  // An account made from a magic link has no name of its own (it falls back to the start of the
  // email): the club's member record usually has the real one
  const memberName = user ? members.find(m => m.club_id === club.id
    && (m.user_id === user.id || (!!m.email && m.email.toLowerCase() === user.email?.toLowerCase())))?.full_name : undefined;
  const accountEmailName = user?.email?.split('@')[0];
  const displayName = (user && user.full_name && user.full_name !== accountEmailName ? user.full_name : memberName || user?.full_name) || '';
  const activeSeason = getActiveSeason ? getActiveSeason(club.id) : null;
  // The Inbox covers both the public contact form and signed-in members' messages
  const unreadEnquiries = inquiries.filter(i => i.club_id === club.id && i.status === 'unread').length;
  const unreadMemberMessages = memberMessages.filter(m => m.club_id === club.id && m.sender_type === 'member' && !m.is_read).length;
  const unreadInquiries = unreadEnquiries + unreadMemberMessages;
  const pendingMembersCount = members.filter(m => m.club_id === club.id && m.membership_status === 'pending').length;
  const hasJuniorTeam = clubTeamsOf(clubTeams, club.id).some(t => t.is_junior);
  // The phone menu is closed behind one button: a dot on it when any red badge inside is set
  const menuNeedsAttention = unreadInquiries > 0 || !!liveMatch || receiptsToReview > 0 || ordersToHandOut > 0
    || (pendingMembersCount > 0 && can(club.id, 'members'));

  interface NavItem {
    label: string;
    href: string;
    icon: React.ComponentType<{ size?: number; color?: string; className?: string }>;
    /** Something needs attention: red pill, and a dot on the collapsed section / icon rail */
    badge?: string;
    /** Plain information (e.g. the current season): grey pill, no dot */
    note?: string;
    /** Access area (lib/permissions.ts); the item only shows to people who can view it */
    area?: string;
    /** Sub-items: a tab (?tab=) or section (#id) of the page, shown under the item while you're on it */
    children?: NavChild[];
  }

  interface NavChild {
    label: string;
    href: string;
    badge?: string;
    /** Defaults to the parent's area; set when the sub-item opens another page (Sponsor Report) */
    area?: string;
  }

  interface NavSection {
    title: string;
    items: NavItem[];
  }

  const canSeeCalendar = CALENDAR_AREAS.some(a => can(club.id, a));

  const navSections: NavSection[] = ([
    {
      // Always-visible entry points (this section has no heading)
      title: 'Overview',
      items: [
        { label: 'Dashboard', href: `/${club.slug}/admin`, icon: LayoutDashboard },
        {
          label: 'Inbox',
          area: 'inquiries',
          href: `/${club.slug}/admin/inquiries`,
          icon: Mail,
          badge: unreadInquiries > 0 ? `${unreadInquiries} NEW` : undefined,
          children: [
            { label: 'Member Messages', href: `/${club.slug}/admin/inquiries`, badge: unreadMemberMessages > 0 ? `${unreadMemberMessages}` : undefined },
            { label: 'Contact Form', href: `/${club.slug}/admin/inquiries?tab=contact`, badge: unreadEnquiries > 0 ? `${unreadEnquiries}` : undefined },
          ],
        },
      ],
    },
    {
      // The day itself, in the order it happens: who's free, pick the team, run the game, the gate
      title: 'Matchday',
      items: [
        { area: 'availability', label: 'Player Availability', href: `/${club.slug}/admin/availability`, icon: ClipboardCheck },
        { area: 'lineup', label: 'Lineup Workbench', href: `/${club.slug}/admin/lineup/draft`, icon: Layers },
        { area: 'match-center', label: 'Match Centre', href: `/${club.slug}/admin/match-center`, icon: Radio, badge: liveMatch ? 'LIVE' : undefined },
        { area: 'scanner', label: 'Gate Scanner', href: `/${club.slug}/admin/scanner`, icon: QrCode },
      ],
    },
    {
      // What's on and when
      title: 'Fixtures & Events',
      items: [
        // Everything dated, by month or week; shown to anyone who sees fixtures, tournaments or events
        ...(canSeeCalendar ? [{ label: 'Calendar', href: `/${club.slug}/admin/calendar`, icon: CalendarRange }] : []),
        { area: 'matches', label: 'Fixtures & Results', href: `/${club.slug}/admin/matches`, icon: CalendarDays },
        {
          area: 'tournaments', label: 'Tournaments & Cups', href: `/${club.slug}/admin/tournaments`, icon: Trophy,
          // The club's own sides for tournaments, a tab of the Tournaments screen (kept apart from club teams)
          children: [{ area: 'tournaments', label: 'Tournament Sides', href: `/${club.slug}/admin/tournaments#tournament-sides` }],
        },
        // The club calendar: training sessions, socials and match-day events, with tickets and check-in
        { area: 'events', label: 'Events & Training', href: `/${club.slug}/admin/events`, icon: Calendar },
      ],
    },
    {
      // The squad, the club's teams, its members and the committee
      title: 'Players & Teams',
      items: [
        // Everyone at the club (the squad), with applications and passes on their own tabs (Members area)
        ...(can(club.id, 'squad') || can(club.id, 'members') ? [{
          label: 'People',
          href: can(club.id, 'squad') ? `/${club.slug}/admin/people` : `/${club.slug}/admin/people?tab=applications`,
          icon: Users,
          badge: pendingMembersCount > 0 && can(club.id, 'members') ? `${pendingMembersCount} PENDING` : undefined,
          children: [
            { area: 'squad', label: 'Everyone', href: `/${club.slug}/admin/people` },
            { area: 'members', label: 'Applications', href: `/${club.slug}/admin/people?tab=applications`, badge: pendingMembersCount > 0 ? `${pendingMembersCount}` : undefined },
            { area: 'members', label: 'Member Passes', href: `/${club.slug}/admin/people?tab=passes` },
            { area: 'members', label: 'Rejected', href: `/${club.slug}/admin/people?tab=rejected` },
          ],
        }] : []),
        { area: 'teams', label: 'Club Teams', href: `/${club.slug}/admin/teams`, icon: Shield },
        { area: 'committee', label: 'Committee', href: `/${club.slug}/admin/committee`, icon: Award },
      ],
    },
    {
      // Money in and out
      title: 'Money',
      items: [
        {
          label: 'Finance',
          area: 'finance',
          href: `/${club.slug}/admin/finance`,
          icon: Wallet,
          badge: receiptsToReview > 0 ? `${receiptsToReview} TO CHECK` : undefined,
          children: [
            { label: 'Overview', href: `/${club.slug}/admin/finance` },
            { label: 'Income', href: `/${club.slug}/admin/finance?tab=income` },
            { label: 'Expenses', href: `/${club.slug}/admin/finance?tab=expenses` },
            { label: 'Payment Settings', href: `/${club.slug}/admin/finance?tab=settings` },
          ],
        },
        {
          area: 'shop', label: 'Club Shop', href: `/${club.slug}/admin/shop`, icon: ShoppingBag,
          badge: ordersToHandOut > 0 ? `${ordersToHandOut} TO HAND OUT` : undefined,
          children: [
            { label: 'Orders', href: `/${club.slug}/admin/shop#orders`, badge: ordersToHandOut > 0 ? `${ordersToHandOut}` : undefined },
            { label: 'Products', href: `/${club.slug}/admin/shop#products` },
          ],
        },
        {
          area: 'sponsors', label: 'Sponsors', href: `/${club.slug}/admin/sponsors`, icon: DollarSign,
          children: [
            { label: 'Sponsor List', href: `/${club.slug}/admin/sponsors` },
            // The sponsor exposure report lives on the Analytics page and keeps its access area
            { area: 'analytics', label: 'Sponsor Report', href: `/${club.slug}/admin/analytics?tab=sponsors` },
          ],
        },
      ],
    },
    {
      // What the club publishes: stories, photos and the homepage banners that feature them
      title: 'Club Content',
      items: [
        { area: 'content', label: 'News', href: `/${club.slug}/admin/content`, icon: FileText },
        { area: 'gallery', label: 'Photo Gallery', href: `/${club.slug}/admin/gallery`, icon: Images },
        { area: 'hero-slider', label: 'Homepage Slider', href: `/${club.slug}/admin/hero-slider`, icon: Sparkles },
      ],
    },
    {
      // Reaching members and fans, and seeing who's listening
      title: 'Fans & Engagement',
      items: [
        { area: 'emails', label: 'Email Notifications', href: `/${club.slug}/admin/emails`, icon: BellRing },
        { area: 'gamification', label: 'ClubScore', href: `/${club.slug}/admin/gamification`, icon: Flame },
        { area: 'analytics', label: 'Website Analytics', href: `/${club.slug}/admin/analytics`, icon: BarChart3 },
      ],
    },
    {
      // Set up once, changed rarely
      title: 'Club Settings',
      items: [
        { area: 'branding', label: 'Club Profile & Branding', href: `/${club.slug}/admin/branding`, icon: Palette },
        { area: 'seasons', label: 'Seasons', href: `/${club.slug}/admin/seasons`, icon: Flag, note: activeSeason?.name },
        // Opens the junior settings (U18 rule, welfare officer) on Club Teams; only once the club has a junior team
        ...(hasJuniorTeam ? [{ area: 'teams', label: 'Junior & Safeguarding', href: `/${club.slug}/admin/teams#junior-settings`, icon: ShieldCheck }] : []),
        { area: 'roles', label: 'Roles & Permissions', href: `/${club.slug}/admin/roles`, icon: KeyRound },
      ],
    },
  ] as NavSection[])
    .map(section => ({
      ...section,
      items: section.items
        .filter(i => !i.area || can(club.id, i.area))
        .map(i => ({ ...i, children: i.children?.filter(c => can(club.id, c.area || i.area || '')) })),
    }))
    .filter(section => section.items.length > 0);

  // The page's tab (?tab=income), kept in the URL by lib/use-url-tab
  const currentTab = useSearchParams().get('tab');
  // The page's area: someone whose roles don't cover it gets a notice instead of the page
  const currentArea = areaFromLocation(pathname, currentTab);
  // Shop orders have their own area, so a role may hand them out without editing the shop
  const canViewPage = !currentArea || can(club.id, currentArea) || (currentArea === 'shop' && can(club.id, 'shop-orders'))
    // The calendar isn't an area of its own: it shows the fixtures, tournaments and events a role already sees
    || (currentArea === 'calendar' && canSeeCalendar);
  const viewOnly = canViewPage && !!currentArea && currentArea !== 'calendar' && !can(club.id, currentArea, 'edit');
  // Edit without Full: delete buttons (marked data-needs-full) are hidden (globals.css)
  const noDelete = !viewOnly && !!currentArea && !can(club.id, currentArea, 'full');
  const roleLabel = userRole === 'owner'
    ? 'Club Owner'
    : isClubSuperUser(club.id)
      ? 'Club Admin'
      : getClubAccess(club.id)?.roleNames.join(', ') || 'Club Staff';

  // View-only pages: every control not marked data-view-ok (tabs, filters, search) is disabled and
  // its buttons hidden (globals.css). Unmarked controls fail safe, so new pages and components are
  // read-only too; the database refuses the writes either way.
  const pageRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = pageRef.current;
    if (!viewOnly || !root) return;
    const lock = () =>
      root.querySelectorAll<HTMLButtonElement | HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('button, input, select, textarea')
        .forEach(el => {
          if (!el.disabled && !el.closest('[data-view-ok]')) el.disabled = true;
        });
    lock();
    // Re-applied as the page renders more (modals, tabs) or React re-enables a control
    const observer = new MutationObserver(lock);
    observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled'] });
    return () => observer.disconnect();
  }, [viewOnly]);

  const allNavItems = navSections.flatMap(s => s.items);

  // The URL hash picks a tab or section on some pages (Tournaments: #tournament-sides), and a menu item may
  // point at it. Next's links don't fire hashchange, so a menu click announces its hash to the open page
  // itself (ADMIN_HASH_EVENT); the page's own tab switches update the URL and fire hashchange.
  const [locationHash, setLocationHash] = useState('');
  useEffect(() => {
    const read = () => setLocationHash(window.location.hash);
    read();
    window.addEventListener('hashchange', read);
    return () => window.removeEventListener('hashchange', read);
  }, [pathname]);
  const announceHash = (href: string) => {
    const hash = href.includes('#') ? `#${href.split('#')[1]}` : '';
    setLocationHash(hash);
    window.dispatchEvent(new CustomEvent(ADMIN_HASH_EVENT, { detail: hash }));
  };

  // How well a menu link matches the current page: 3 its tab or section is showing, 2 its page,
  // 1 a page inside it (a single tournament), 0 not at all
  const dashboardHref = `/${club.slug}/admin`;
  const matchScore = (href: string, isChild: boolean) => {
    const [pathAndQuery, hash] = href.split('#');
    const [path, query] = pathAndQuery.split('?');
    const tab = query ? new URLSearchParams(query).get('tab') : null;
    if (pathname === path) {
      if (tab || hash) return (!tab || tab === currentTab) && (!hash || `#${hash}` === locationHash) ? 3 : 0;
      // A plain sub-item is the page's default tab, so it only matches while no other tab is open
      return isChild && currentTab ? 0 : 2;
    }
    return path !== dashboardHref && pathname.startsWith(`${path}/`) ? 1 : 0;
  };
  // The one highlighted link: the best match, a sub-item winning a tie with its parent
  const activeLink = (() => {
    let best: { item: NavItem; child?: NavChild; score: number } | null = null;
    for (const item of allNavItems) {
      for (const child of item.children || []) {
        const score = matchScore(child.href, true);
        if (score > 0 && (!best || score > best.score)) best = { item, child, score };
      }
      const score = matchScore(item.href, false);
      if (score > 0 && (!best || score > best.score)) best = { item, score };
    }
    return best;
  })();
  const isItemActive = (item: NavItem) => activeLink?.item === item;
  const currentNavItem = activeLink?.item;
  const currentChild = activeLink?.child;
  // Overview has no heading, so it is never folded away
  const collapsibleTitles = navSections.filter(s => s.title !== 'Overview').map(s => s.title);
  const allSectionsClosed = collapsibleTitles.every(t => closedSections.includes(t));

  // Landing on a page whose group is folded away opens that group, so the current page is always visible
  const activeSectionTitle = navSections.find(s => s.items.some(isItemActive))?.title;
  useEffect(() => {
    if (activeSectionTitle) setClosedSections(prev => prev.includes(activeSectionTitle) ? prev.filter(t => t !== activeSectionTitle) : prev);
  }, [activeSectionTitle]);

  // rail: the collapsed desktop sidebar, icons only. inDrawer: the mobile slide-over copy of the menu.
  const renderSidebarContent = ({ onItemClick, rail = false, inDrawer = false }: { onItemClick?: () => void; rail?: boolean; inDrawer?: boolean } = {}) => (
    <>
      <div>
        {/* Club Header Badge */}
        <div style={{
          display: 'flex',
          flexDirection: rail ? 'column' : 'row',
          alignItems: 'center',
          gap: rail ? '0.6rem' : '0.75rem',
          padding: rail ? '0.5rem 0' : '0.75rem',
          background: 'rgba(var(--shade-rgb), 0.35)',
          borderRadius: 'var(--radius-md)',
          marginBottom: '1.25rem',
          border: '1px solid var(--border-subtle)',
        }}>
          <img loading="eager" decoding="async" width={40} height={40}
            src={club.logo_url || DEFAULT_CREST}
            alt={`${club.name} crest`}
            title={rail ? club.name : undefined}
            style={{ width: '40px', height: '40px', borderRadius: '10px', objectFit: 'cover', border: `2px solid ${club.primary_color}`, flexShrink: 0 }}
          />
          {!rail && (
            <div style={{ overflow: 'hidden', flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                {club.name}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--club-ink)', fontWeight: 700 }}>
                Club Admin
              </div>
            </div>
          )}
          {!inDrawer && (
            <button
              type="button"
              onClick={toggleSidebarCollapsed}
              className="admin-sidebar-toggle"
              title={rail ? 'Expand menu' : 'Collapse menu'}
              aria-label={rail ? 'Expand menu' : 'Collapse menu'}
              aria-expanded={!rail}
            >
              {rail ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
            </button>
          )}
        </div>

        {!rail && (
          <>
            <AdminSearch clubSlug={club.slug} clubId={club.id} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', margin: '-0.25rem 0 0.35rem' }}>
              <button
                type="button"
                className="admin-nav-fold-all"
                onClick={() => updateClosedSections(allSectionsClosed ? [] : collapsibleTitles)}
              >
                {allSectionsClosed ? <ChevronsUpDown size={12} /> : <ChevronsDownUp size={12} />}
                <span>{allSectionsClosed ? 'Expand all' : 'Collapse all'}</span>
              </button>
            </div>
          </>
        )}

        {/* Categorized Nav Sections */}
        <nav className={rail ? undefined : 'stack'} aria-label="Admin menu">
          {navSections.map((section, sectionIndex) => {
            const collapsible = !rail && section.title !== 'Overview';
            const open = !collapsible || !closedSections.includes(section.title);
            const groupId = `admin-nav-${inDrawer ? 'drawer' : 'side'}-${sectionIndex}`;
            const hasAlert = section.items.some(i => i.badge);

            return (
            <div key={section.title}>
              {rail && sectionIndex > 0 && (
                <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '0.5rem 0.4rem' }} />
              )}
              {collapsible && (
                <button
                  type="button"
                  className="admin-nav-section-toggle"
                  onClick={() => toggleSection(section.title)}
                  aria-expanded={open}
                  aria-controls={groupId}
                >
                  <span>{section.title}</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                    {!open && hasAlert && <span className="admin-nav-dot" aria-label="Has updates" />}
                    <ChevronDown size={14} className={open ? 'admin-nav-chevron' : 'admin-nav-chevron is-closed'} />
                  </span>
                </button>
              )}
              {open && (
              <div id={groupId} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                {section.items.map(item => {
                  const isActive = isItemActive(item);
                  const Icon = item.icon;

                  // Sub-items open under the page you're on, or wherever the admin opened them with the arrow
                  // (not on the icon rail)
                  const hasChildren = !rail && !!item.children?.length;
                  const showChildren = hasChildren && (openItems[item.label] ?? isActive);
                  const childrenId = `${groupId}-${item.label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

                  const link = (
                    <Link
                      href={item.href}
                      onClick={() => { onItemClick?.(); announceHash(item.href); }}
                      title={rail ? (item.badge || item.note ? `${item.label} (${item.badge || item.note})` : item.label) : undefined}
                      aria-label={rail ? item.label : undefined}
                      style={{
                        position: 'relative',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: rail ? 'center' : 'space-between',
                        padding: rail ? '0.6rem' : '0.6rem 0.85rem',
                        borderRadius: 'var(--radius-sm)',
                        color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                        background: isActive ? 'rgba(16, 185, 129, 0.12)' : 'transparent',
                        border: isActive ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid transparent',
                        boxShadow: isActive ? 'inset 3px 0 0 var(--club-primary)' : 'none',
                        fontWeight: isActive ? 700 : 500,
                        fontSize: '0.85rem',
                        transition: 'all 0.15s ease',
                        minHeight: '42px',
                        flex: hasChildren ? 1 : undefined,
                        minWidth: 0,
                      }}
                      onMouseEnter={e => {
                        if (!isActive) {
                          e.currentTarget.style.background = 'rgba(var(--tint-rgb), 0.04)';
                          e.currentTarget.style.color = 'var(--text-primary)';
                        }
                      }}
                      onMouseLeave={e => {
                        if (!isActive) {
                          e.currentTarget.style.background = 'transparent';
                          e.currentTarget.style.color = 'var(--text-secondary)';
                        }
                      }}
                    >
                      {rail ? (
                        <>
                          <Icon size={18} color={isActive ? 'var(--club-primary)' : 'var(--text-muted)'} />
                          {item.badge && <span className="admin-nav-dot" style={{ position: 'absolute', top: '6px', right: '6px' }} />}
                        </>
                      ) : (
                        <>
                          <div className="row row-loose" style={{ minWidth: 0 }}>
                            <Icon size={16} color={isActive ? 'var(--club-primary)' : 'var(--text-muted)'} />
                            <span>{item.label}</span>
                          </div>
                          {item.badge && (
                            <span className="badge badge-live" style={{ fontSize: '0.7rem', padding: '0.15rem 0.45rem' }}>
                              {item.badge}
                            </span>
                          )}
                          {!item.badge && item.note && (
                            <span className="badge" style={{ fontSize: '0.7rem', padding: '0.15rem 0.45rem', backgroundColor: 'rgba(var(--tint-rgb), 0.08)', color: 'var(--text-secondary)', textAlign: 'right' }}>
                              {item.note}
                            </span>
                          )}
                        </>
                      )}
                    </Link>
                  );

                  return (
                    <React.Fragment key={item.href}>
                    {hasChildren ? (
                      <div className="admin-nav-parent">
                        {link}
                        <button
                          type="button"
                          className="admin-nav-expand"
                          onClick={() => toggleItem(item.label, showChildren)}
                          aria-expanded={showChildren}
                          aria-controls={childrenId}
                          aria-label={`${showChildren ? 'Hide' : 'Show'} ${item.label} sub-menu`}
                          title={`${showChildren ? 'Hide' : 'Show'} ${item.children!.map(c => c.label).join(', ')}`}
                        >
                          <ChevronDown size={14} className={showChildren ? 'admin-nav-chevron' : 'admin-nav-chevron is-closed'} />
                        </button>
                      </div>
                    ) : link}
                    {showChildren && (
                      <div id={childrenId} className="admin-nav-children">
                        {item.children!.map(child => {
                          const childActive = currentChild === child;
                          return (
                            <Link
                              key={child.href}
                              href={child.href}
                              onClick={() => { onItemClick?.(); announceHash(child.href); }}
                              aria-current={childActive ? 'page' : undefined}
                              className={childActive ? 'admin-nav-child is-active' : 'admin-nav-child'}
                            >
                              <span>{child.label}</span>
                              {child.badge && (
                                <span className="badge badge-live" style={{ fontSize: '0.65rem', padding: '0.1rem 0.4rem' }}>{child.badge}</span>
                              )}
                            </Link>
                          );
                        })}
                      </div>
                    )}
                    </React.Fragment>
                  );
                })}
              </div>
              )}
            </div>
            );
          })}
        </nav>
      </div>

      {/* Bottom Sidebar: Authenticated Administrator Profile & Links */}
      <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem', marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.85rem', alignItems: rail ? 'center' : 'stretch' }}>
        {user && (
          <div style={{
            background: 'rgba(var(--shade-rgb), 0.35)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '8px',
            padding: rail ? '0.5rem 0.35rem' : '0.65rem 0.75rem',
            display: 'flex',
            flexDirection: rail ? 'column' : 'row',
            gap: rail ? '0.35rem' : 0,
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <div title={rail ? displayName : undefined} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', overflow: 'hidden' }}>
              {user.avatar_url ? (
                <img loading="eager" decoding="async" width={32} height={32}
                  src={user.avatar_url}
                  alt={`${displayName} photo`}
                  style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover', border: '1px solid #10B981' }}
                />
              ) : (
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--club-primary)', color: 'var(--club-primary-contrast, #090D16)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.8rem' }}>
                  {displayName.substring(0, 2).toUpperCase()}
                </div>
              )}
              {!rail && <div style={{ overflow: 'hidden' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-primary)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                  {displayName}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--c-green)', fontWeight: 700, textTransform: 'uppercase' }}>
                  {roleLabel}
                </div>
              </div>}
            </div>

            <button
              type="button"
              onClick={() => logout()}
              title="Sign Out of Administration"
              className="touch-target"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '0.35rem',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              onMouseEnter={e => e.currentTarget.style.color = '#EF4444'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
            >
              <LogOut size={16} />
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={() => { onItemClick?.(); setSupportOpen(true); }}
          className="btn btn-secondary btn-sm touch-target"
          title={rail ? 'Contact itsfootball.club Support' : undefined}
          aria-label={rail ? 'Contact itsfootball.club Support' : undefined}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', padding: rail ? '0.4rem' : undefined }}
        >
          <LifeBuoy size={rail ? 16 : 13} />
          {!rail && <span>Contact itsfootball.club Support</span>}
        </button>

        <Link
          href={`/${club.slug}`}
          onClick={onItemClick}
          className="btn btn-secondary btn-sm touch-target"
          title={rail ? 'View Public Portal' : undefined}
          aria-label={rail ? 'View Public Portal' : undefined}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', padding: rail ? '0.4rem' : undefined }}
        >
          {!rail && <span>View Public Portal</span>}
          <ExternalLink size={rail ? 16 : 13} />
        </Link>
      </div>
    </>
  );

  return (
    <AdminGuard club={club}>
      <div className="admin-layout-container">
        {/* Mobile Sticky Sub-bar */}
        <div className="admin-mobile-subbar">
          <button
            type="button"
            onClick={() => setMobileDrawerOpen(true)}
            className="btn btn-secondary btn-sm touch-target"
            aria-label={menuNeedsAttention ? 'Open admin menu (items need attention)' : 'Open admin menu'}
            style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexShrink: 0, position: 'relative' }}
          >
            {menuNeedsAttention && <span className="admin-menu-dot" aria-hidden="true" />}
            <Menu size={18} />
            <span className="admin-subbar-menu-label">Admin Menu</span>
          </button>
          {/* A sub-page shows its section on a small line above, so neither name gets cut off */}
          <div style={{ flex: 1, minWidth: 0, textAlign: 'center', lineHeight: 1.2 }}>
            {currentNavItem && currentChild && (
              <div style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {currentNavItem.label}
              </div>
            )}
            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {currentNavItem ? (currentChild ? currentChild.label : currentNavItem.label) : 'Club Admin'}
            </div>
          </div>
          <Link
            href={`/${club.slug}`}
            className="btn btn-outline btn-sm touch-target"
            style={{ fontSize: '0.78rem', padding: '0.35rem 0.65rem', flexShrink: 0 }}
          >
            Public &rarr;
          </Link>
        </div>

        {/* Desktop Admin Sidebar */}
        <SupportModal clubId={club.id} open={supportOpen} setOpen={setSupportOpen} />

        <aside className={sidebarCollapsed ? 'admin-desktop-sidebar is-collapsed' : 'admin-desktop-sidebar'}>
          {renderSidebarContent({ rail: sidebarCollapsed })}
        </aside>

        {/* Mobile Slide-Over Drawer Portal */}
        {isMounted && mobileDrawerOpen && createPortal(
          <div className="mobile-drawer-overlay" onClick={() => setMobileDrawerOpen(false)}>
            <div
              className="mobile-drawer-content mobile-drawer-left"
              onClick={e => e.stopPropagation()}
              style={{ padding: '1.25rem 1rem' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border-subtle)' }}>
                <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-primary)' }}>Club Admin</div>
                <button
                  type="button"
                  onClick={() => setMobileDrawerOpen(false)}
                  className="touch-target"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <X size={20} />
                </button>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                {renderSidebarContent({ onItemClick: () => setMobileDrawerOpen(false), inDrawer: true })}
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* Main Admin Content Canvas */}
        <main className="admin-main-canvas">
          <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
            {(syncStatus.phase === 'error' || (syncStatus.phase === 'readonly' && (syncStatus.pending || 0) > 0)) && (
              <div
                role="alert"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '1rem',
                  flexWrap: 'wrap',
                  marginBottom: '1.25rem',
                  padding: '0.75rem 1rem',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.825rem',
                  background: syncStatus.phase === 'error' ? 'rgba(239, 68, 68, 0.12)' : 'rgba(245, 158, 11, 0.12)',
                  border: `1px solid ${syncStatus.phase === 'error' ? '#EF4444' : '#F59E0B'}`,
                  color: syncStatus.phase === 'error' ? 'var(--c-red)' : '#FCD34D',
                }}
              >
                <span>
                  {syncStatus.phase === 'error'
                    ? `Some changes are not saved to the database. ${syncStatus.message || ''}`
                    : `${syncStatus.pending} change(s) are only saved in this browser. ${syncStatus.message || ''}`}
                </span>
                <button type="button" className="btn btn-secondary btn-sm" onClick={retrySync}>
                  Retry
                </button>
              </div>
            )}
            {viewOnly && (
              <div className="row" style={{ gap: '0.5rem', marginBottom: '1rem', padding: '0.6rem 0.9rem', borderRadius: 'var(--radius-md)', fontSize: '0.8rem', background: 'rgba(var(--tint-rgb), 0.04)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
                <Eye size={14} />
                <span>View only: anything your role can&apos;t change on this page is locked.</span>
              </div>
            )}
            {canViewPage ? <div ref={pageRef} className={viewOnly ? 'admin-view-only' : noDelete ? 'admin-no-delete' : undefined}>{children}</div> : (
              <div className="glass-panel" style={{ padding: '2.5rem', textAlign: 'center', maxWidth: '520px', margin: '3rem auto' }}>
                <Lock size={28} color="var(--text-muted)" />
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0.75rem 0 0.5rem' }}>Not part of your role</h2>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  Your role at {club.name} doesn&apos;t include this page. Ask the club Owner or a Club Admin if you need it.
                </p>
              </div>
            )}
          </div>
        </main>
      </div>
    </AdminGuard>
  );
}

