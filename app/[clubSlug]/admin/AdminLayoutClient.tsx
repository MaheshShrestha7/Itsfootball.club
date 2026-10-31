'use client';

import React, { use, useState, useEffect, useRef } from 'react';
import { useEscapeToClose } from '@/lib/use-escape-to-close';
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
  Search,
  ShieldCheck, Wallet, BellRing, LifeBuoy, ShoppingBag, KeyRound, Lock, Eye, History,
  ChevronDown,
  ChevronsDownUp,
  ChevronsUpDown,
  PanelLeftClose,
  PanelLeftOpen } from 'lucide-react';
import { getSupabaseClient } from '@/lib/supabase/client';
import { DEFAULT_CREST } from '@/lib/crest';
import AdminSearch from '@/components/AdminSearch';
import AdminSaveStatus from '@/components/admin/AdminSaveStatus';
import SupportModal from '@/components/SupportModal';
import { areaFromLocation, ADMIN_HASH_EVENT } from '@/lib/permissions';
import { CALENDAR_AREAS } from '@/lib/admin-calendar';
import { useClubAppIcons } from '@/lib/app-icons';
import { clubTeamsOf } from '@/lib/teams';
import { sponsorSignupStage } from '@/lib/sponsors';

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

/** A red count on a menu item: the number shows, the words are for screen readers ("3 new") */
interface Badge {
  value: string;
  label?: string;
}

const badgeOf = (n: number, label: string): Badge | undefined => (n > 0 ? { value: String(n), label } : undefined);

function BadgePill({ badge, note }: { badge: Badge; note?: boolean }) {
  return (
    <span className={note ? 'admin-count is-note' : 'admin-count'}>
      <span className="sr-only">, </span>{badge.value}
      {badge.label && <span className="sr-only"> {badge.label}</span>}
    </span>
  );
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
  const { clubs, selectClubBySlug, matches, getActiveSeason, members, clubTeams, inquiries, memberMessages, updateClubBranding, sponsors } = useClub();
  const { user, logout, getUserRoleForClub, can, isClubSuperUser, getClubAccess } = useAuth();
  const club = selectClubBySlug(resolvedParams.clubSlug) || clubs[0];

  // The club app's home-screen icons follow the crest (drawn here by whoever may edit the branding)
  useClubAppIcons(club, can(club.id, 'branding', 'edit'), icons => updateClubBranding(club.id, { app_icons: icons }));

  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  useEscapeToClose(mobileDrawerOpen, setMobileDrawerOpen);
  const [supportOpen, setSupportOpen] = useState(false);

  // Desktop sidebar shrunk to an icon rail, and the menu groups the admin has folded away
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [closedSections, setClosedSections] = useState<string[]>([]);
  // Items whose sub-items the admin opened or closed by hand (by label); the rest open on their own page
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({});
  // The icon rail's label, shown beside the link that is hovered or focused
  const [tip, setTip] = useState<{ text: string; top: number; left: number } | null>(null);

  useEffect(() => {
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
    setTip(null);
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

  // While the phone drawer is open the page behind it neither scrolls nor takes focus (inert, below);
  // focus goes to the close button (or the search box), and back to what opened the drawer after
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const drawerFocus = useRef<'close' | 'search'>('close');
  const drawerOpener = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!mobileDrawerOpen) return;
    document.body.classList.add('admin-drawer-open');
    const drawer = drawerRef.current;
    const target = drawerFocus.current === 'search'
      ? drawer?.querySelector<HTMLElement>('input')
      : drawer?.querySelector<HTMLElement>('[data-drawer-close]');
    target?.focus();
    const returnTo = drawerOpener.current || menuButtonRef.current;
    return () => {
      document.body.classList.remove('admin-drawer-open');
      returnTo?.focus();
    };
  }, [mobileDrawerOpen]);
  const openDrawer = (focus: 'close' | 'search', opener: HTMLElement) => {
    drawerFocus.current = focus;
    drawerOpener.current = opener;
    setMobileDrawerOpen(true);
  };

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
  // Website sponsor sign-ups still waiting on the club (paid and waiting to go on the site, or new)
  const sponsorSignups = sponsors.filter(s => s.club_id === club.id && sponsorSignupStage(s) !== null).length;
  // The phone menu is closed behind one button: it carries the total of the red counts inside
  const menuAttentionCount = unreadInquiries + receiptsToReview + ordersToHandOut
    + (can(club.id, 'members') ? pendingMembersCount : 0) + (can(club.id, 'sponsors') ? sponsorSignups : 0);

  interface NavItem {
    label: string;
    href: string;
    icon: React.ComponentType<{ size?: number; color?: string; className?: string; 'aria-hidden'?: boolean }>;
    /** Something needs attention: red count, and a dot on the icon rail */
    badge?: Badge;
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
    badge?: Badge;
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
          badge: badgeOf(unreadInquiries, 'new'),
          children: [
            { label: 'Member messages', href: `/${club.slug}/admin/inquiries`, badge: badgeOf(unreadMemberMessages, 'unread') },
            { label: 'Contact form', href: `/${club.slug}/admin/inquiries?tab=contact`, badge: badgeOf(unreadEnquiries, 'unread') },
          ],
        },
      ],
    },
    {
      // The day itself, in the order it happens: who's free, pick the team, run the game, the gate
      title: 'Matchday',
      items: [
        { area: 'availability', label: 'Player availability', href: `/${club.slug}/admin/availability`, icon: ClipboardCheck },
        { area: 'lineup', label: 'Lineup workbench', href: `/${club.slug}/admin/lineup/draft`, icon: Layers },
        { area: 'match-center', label: 'Match Centre', href: `/${club.slug}/admin/match-center`, icon: Radio, badge: liveMatch ? { value: 'Live' } : undefined },
        { area: 'scanner', label: 'Gate scanner', href: `/${club.slug}/admin/scanner`, icon: QrCode },
      ],
    },
    {
      // What's on and when
      title: 'Fixtures and events',
      items: [
        // Everything dated, by month or week; shown to anyone who sees fixtures, tournaments or events
        ...(canSeeCalendar ? [{ label: 'Calendar', href: `/${club.slug}/admin/calendar`, icon: CalendarRange }] : []),
        { area: 'matches', label: 'Fixtures and results', href: `/${club.slug}/admin/matches`, icon: CalendarDays },
        {
          area: 'tournaments', label: 'Tournaments and cups', href: `/${club.slug}/admin/tournaments`, icon: Trophy,
          // The club's own sides for tournaments, a tab of the Tournaments screen (kept apart from club teams)
          children: [{ area: 'tournaments', label: 'Tournament sides', href: `/${club.slug}/admin/tournaments#tournament-sides` }],
        },
        // The club calendar: training sessions, socials and match-day events, with tickets and check-in
        { area: 'events', label: 'Events and training', href: `/${club.slug}/admin/events`, icon: Calendar },
      ],
    },
    {
      // The squad, the club's teams, its members and the committee
      title: 'Players and teams',
      items: [
        // Everyone at the club (the squad), with applications and passes on their own tabs (Members area)
        ...(can(club.id, 'squad') || can(club.id, 'members') ? [{
          label: 'People',
          href: can(club.id, 'squad') ? `/${club.slug}/admin/people` : `/${club.slug}/admin/people?tab=applications`,
          icon: Users,
          badge: can(club.id, 'members') ? badgeOf(pendingMembersCount, 'pending') : undefined,
          children: [
            { area: 'squad', label: 'Everyone', href: `/${club.slug}/admin/people` },
            { area: 'members', label: 'Applications', href: `/${club.slug}/admin/people?tab=applications`, badge: badgeOf(pendingMembersCount, 'pending') },
            { area: 'members', label: 'Member passes', href: `/${club.slug}/admin/people?tab=passes` },
            { area: 'members', label: 'Rejected', href: `/${club.slug}/admin/people?tab=rejected` },
          ],
        }] : []),
        { area: 'teams', label: 'Club teams', href: `/${club.slug}/admin/teams`, icon: Shield },
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
          badge: badgeOf(receiptsToReview, 'to check'),
          children: [
            { label: 'Overview', href: `/${club.slug}/admin/finance` },
            { label: 'Income', href: `/${club.slug}/admin/finance?tab=income` },
            { label: 'Expenses', href: `/${club.slug}/admin/finance?tab=expenses` },
            { label: 'Payment settings', href: `/${club.slug}/admin/finance?tab=settings` },
          ],
        },
        {
          area: 'shop', label: 'Club shop', href: `/${club.slug}/admin/shop`, icon: ShoppingBag,
          badge: badgeOf(ordersToHandOut, 'to hand out'),
          children: [
            { label: 'Orders', href: `/${club.slug}/admin/shop#orders`, badge: badgeOf(ordersToHandOut, 'to hand out') },
            { label: 'Products', href: `/${club.slug}/admin/shop#products` },
          ],
        },
        {
          area: 'sponsors', label: 'Sponsors', href: `/${club.slug}/admin/sponsors`, icon: DollarSign,
          badge: badgeOf(sponsorSignups, 'new'),
          children: [
            { label: 'Sponsor list', href: `/${club.slug}/admin/sponsors`, badge: badgeOf(sponsorSignups, 'new') },
            { label: 'Packages', href: `/${club.slug}/admin/sponsors?tab=packages` },
            // The sponsor exposure report lives on the Analytics page and keeps its access area
            { area: 'analytics', label: 'Sponsor report', href: `/${club.slug}/admin/analytics?tab=sponsors` },
          ],
        },
      ],
    },
    {
      // What the club publishes: stories, photos and the homepage banners that feature them
      title: 'Club content',
      items: [
        { area: 'content', label: 'News', href: `/${club.slug}/admin/content`, icon: FileText },
        { area: 'gallery', label: 'Photo gallery', href: `/${club.slug}/admin/gallery`, icon: Images },
        { area: 'hero-slider', label: 'Homepage slider', href: `/${club.slug}/admin/hero-slider`, icon: Sparkles },
      ],
    },
    {
      // Reaching members and fans, and seeing who's listening
      title: 'Fans and engagement',
      items: [
        { area: 'emails', label: 'Email notifications', href: `/${club.slug}/admin/emails`, icon: BellRing },
        { area: 'gamification', label: 'ClubScore', href: `/${club.slug}/admin/gamification`, icon: Flame },
        { area: 'analytics', label: 'Website analytics', href: `/${club.slug}/admin/analytics`, icon: BarChart3 },
      ],
    },
    {
      // Set up once, changed rarely
      title: 'Club settings',
      items: [
        { area: 'branding', label: 'Club profile and branding', href: `/${club.slug}/admin/branding`, icon: Palette },
        { area: 'seasons', label: 'Seasons', href: `/${club.slug}/admin/seasons`, icon: Flag, note: activeSeason?.name },
        // Opens the junior settings (U18 rule, welfare officer) on Club Teams; only once the club has a junior team
        ...(hasJuniorTeam ? [{ area: 'teams', label: 'Junior and safeguarding', href: `/${club.slug}/admin/teams#junior-settings`, icon: ShieldCheck }] : []),
        { area: 'roles', label: 'Roles and permissions', href: `/${club.slug}/admin/roles`, icon: KeyRound },
        { area: 'activity', label: 'Activity log', href: `/${club.slug}/admin/activity`, icon: History },
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
    ? 'Club owner'
    : isClubSuperUser(club.id)
      ? 'Club admin'
      : getClubAccess(club.id)?.roleNames.join(', ') || 'Club staff';

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

  // Icon rail tooltips: the sidebar scrolls, so the tip is drawn outside it, beside the link
  const tipProps = (rail: boolean, text: string) => rail ? {
    onMouseEnter: (e: React.MouseEvent<HTMLElement>) => showTip(e.currentTarget, text),
    onFocus: (e: React.FocusEvent<HTMLElement>) => showTip(e.currentTarget, text),
    onMouseLeave: () => setTip(null),
    onBlur: () => setTip(null),
  } : {};
  const showTip = (el: HTMLElement, text: string) => {
    const r = el.getBoundingClientRect();
    setTip({ text, top: r.top + r.height / 2, left: r.right + 8 });
  };

  // rail: the collapsed desktop sidebar, icons only. inDrawer: the phone's slide-over copy of the menu.
  const renderSidebarContent = ({ onItemClick, rail = false, inDrawer = false }: { onItemClick?: () => void; rail?: boolean; inDrawer?: boolean } = {}) => (
    <>
      <div className="admin-club">
        <img loading="eager" decoding="async" width={36} height={36}
          src={club.logo_url || DEFAULT_CREST}
          alt={`${club.name} crest`}
          className="admin-crest"
        />
        {!rail && (
          <div className="admin-club-name">
            <span>{club.name}</span>
            <small>Club admin</small>
          </div>
        )}
        {inDrawer ? (
          <button type="button" className="admin-icon-btn" data-drawer-close onClick={() => setMobileDrawerOpen(false)} aria-label="Close menu">
            <X size={18} aria-hidden="true" />
          </button>
        ) : (
          <button
            type="button"
            onClick={toggleSidebarCollapsed}
            className="admin-icon-btn"
            aria-label={rail ? 'Expand menu' : 'Collapse menu'}
            aria-expanded={!rail}
            {...tipProps(rail, 'Expand menu')}
          >
            {rail ? <PanelLeftOpen size={16} aria-hidden="true" /> : <PanelLeftClose size={16} aria-hidden="true" />}
          </button>
        )}
      </div>

      {!rail && (
        <>
          <div className="admin-search">
            <AdminSearch clubSlug={club.slug} clubId={club.id} />
          </div>
          <button
            type="button"
            className="admin-fold-all"
            onClick={() => updateClosedSections(allSectionsClosed ? [] : collapsibleTitles)}
          >
            {allSectionsClosed ? <ChevronsUpDown size={12} aria-hidden="true" /> : <ChevronsDownUp size={12} aria-hidden="true" />}
            <span>{allSectionsClosed ? 'Expand all' : 'Collapse all'}</span>
          </button>
        </>
      )}

      <nav className="admin-nav" aria-label="Admin menu">
        {navSections.map((section, sectionIndex) => {
          const collapsible = !rail && section.title !== 'Overview';
          const open = !collapsible || !closedSections.includes(section.title);
          const groupId = `admin-nav-${inDrawer ? 'drawer' : 'side'}-${sectionIndex}`;
          const alerts = section.items.filter(i => i.badge).length;

          return (
            <div key={section.title} className="admin-nav-group">
              {collapsible && (
                <button
                  type="button"
                  className="admin-nav-group-toggle"
                  onClick={() => toggleSection(section.title)}
                  aria-expanded={open}
                  aria-controls={groupId}
                >
                  <span>{section.title}</span>
                  {!open && alerts > 0 && <BadgePill badge={{ value: String(alerts), label: alerts === 1 ? 'item needs you' : 'items need you' }} />}
                  <ChevronDown size={14} className="admin-chevron" aria-hidden="true" />
                </button>
              )}
              {open && (
                <div id={groupId} className="admin-nav-list">
                  {section.items.map(item => {
                    const isActive = isItemActive(item);
                    const Icon = item.icon;
                    const tipText = item.badge ? `${item.label} (${item.badge.value}${item.badge.label ? ` ${item.badge.label}` : ''})` : item.note ? `${item.label} (${item.note})` : item.label;

                    // Sub-items open under the page you're on, or wherever the admin opened them with the arrow
                    // (not on the icon rail)
                    const hasChildren = !rail && !!item.children?.length;
                    const showChildren = hasChildren && (openItems[item.label] ?? isActive);
                    const childrenId = `${groupId}-${item.label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

                    const link = (
                      <Link
                        href={item.href}
                        onClick={() => { onItemClick?.(); announceHash(item.href); }}
                        aria-current={isActive && !currentChild ? 'page' : undefined}
                        className={item.badge ? 'admin-nav-link has-count' : 'admin-nav-link'}
                        {...tipProps(rail, tipText)}
                      >
                        <Icon size={rail ? 18 : 16} aria-hidden={true} />
                        <span className="admin-nav-label">{item.label}</span>
                        {item.badge && <BadgePill badge={item.badge} />}
                        {!item.badge && item.note && <BadgePill badge={{ value: item.note }} note />}
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
                              <ChevronDown size={14} className="admin-chevron" aria-hidden="true" />
                            </button>
                          </div>
                        ) : link}
                        {showChildren && (
                          <div id={childrenId} className="admin-nav-children">
                            {item.children!.map(child => (
                              <Link
                                key={child.href}
                                href={child.href}
                                onClick={() => { onItemClick?.(); announceHash(child.href); }}
                                aria-current={currentChild === child ? 'page' : undefined}
                                className="admin-nav-child"
                              >
                                <span>{child.label}</span>
                                {child.badge && <BadgePill badge={child.badge} />}
                              </Link>
                            ))}
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

      {/* The signed-in admin, support, and the way out to the public site */}
      <div className="admin-sidebar-foot">
        {user && (
          <div className="admin-me">
            {user.avatar_url ? (
              <img loading="eager" decoding="async" width={32} height={32} src={user.avatar_url} alt="" className="admin-avatar" />
            ) : (
              <span className="admin-avatar" aria-hidden="true">{displayName.substring(0, 2).toUpperCase()}</span>
            )}
            {!rail && (
              <div className="admin-me-name">
                <span>{displayName}</span>
                <small>{roleLabel}</small>
              </div>
            )}
            <button type="button" onClick={() => logout()} className="admin-icon-btn is-danger" aria-label="Sign out" {...tipProps(rail, 'Sign out')}>
              <LogOut size={16} aria-hidden="true" />
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={() => { onItemClick?.(); setSupportOpen(true); }}
          className="admin-quiet-btn"
          aria-label={rail ? 'Contact support' : undefined}
          {...tipProps(rail, 'Contact support')}
        >
          <LifeBuoy size={16} aria-hidden="true" />
          {!rail && <span>Contact support</span>}
        </button>

        <Link
          href={`/${club.slug}`}
          onClick={onItemClick}
          className="admin-quiet-btn"
          aria-label={rail ? 'View public portal' : undefined}
          {...tipProps(rail, 'View public portal')}
        >
          <ExternalLink size={16} aria-hidden="true" />
          {!rail && <span>View public portal</span>}
        </Link>
      </div>
    </>
  );

  // The phone bar names the page: the club on the dashboard, the page (and its section above) elsewhere
  const onDashboard = pathname === dashboardHref;
  const topbarTitle = onDashboard || !currentNavItem ? club.name : currentChild ? currentChild.label : currentNavItem.label;

  return (
    <AdminGuard club={club}>
      <div className={sidebarCollapsed ? 'admin-shell is-rail' : 'admin-shell'}>
        {/* Phones and tablets: the admin's one bar on top */}
        <header className="admin-topbar" inert={mobileDrawerOpen}>
          <button
            type="button"
            ref={menuButtonRef}
            onClick={e => openDrawer('close', e.currentTarget)}
            className="admin-topbar-menu"
            aria-expanded={mobileDrawerOpen}
            aria-label={menuAttentionCount > 0 ? `Admin menu, ${menuAttentionCount} ${menuAttentionCount === 1 ? 'item needs' : 'items need'} you` : 'Admin menu'}
          >
            <Menu size={18} aria-hidden="true" />
            {menuAttentionCount > 0 && <span className="admin-count" aria-hidden="true">{menuAttentionCount}</span>}
            {menuAttentionCount === 0 && liveMatch && <span className="admin-count" aria-hidden="true">Live</span>}
          </button>
          <div className="admin-topbar-title">
            <img loading="eager" decoding="async" width={28} height={28} src={club.logo_url || DEFAULT_CREST} alt="" className="admin-crest is-small" />
            <span>
              {!onDashboard && currentNavItem && currentChild && <small>{currentNavItem.label}</small>}
              <span>{topbarTitle}</span>
            </span>
          </div>
          <button type="button" className="admin-icon-btn" onClick={e => openDrawer('search', e.currentTarget)} aria-label="Search players, matches and events">
            <Search size={18} aria-hidden="true" />
          </button>
          <Link href={`/${club.slug}`} className="admin-icon-btn" aria-label="Public site">
            <ExternalLink size={18} aria-hidden="true" />
          </Link>
        </header>

        <SupportModal clubId={club.id} open={supportOpen} setOpen={setSupportOpen} />

        <aside className="admin-sidebar" aria-label="Admin" onScroll={() => setTip(null)}>
          {renderSidebarContent({ rail: sidebarCollapsed })}
        </aside>
        {tip && <div className="admin-tip" role="tooltip" style={{ top: tip.top, left: tip.left }}>{tip.text}</div>}

        {/* Phones: the menu slides over; the page behind is inert while it is open */}
        <div className={mobileDrawerOpen ? 'admin-scrim is-open' : 'admin-scrim'} onClick={() => setMobileDrawerOpen(false)} aria-hidden="true" />
        <div
          ref={drawerRef}
          className={mobileDrawerOpen ? 'admin-drawer is-open' : 'admin-drawer'}
          role="dialog"
          aria-modal="true"
          aria-label="Admin menu"
          inert={!mobileDrawerOpen}
        >
          <div className="admin-sidebar">
            {renderSidebarContent({ onItemClick: () => setMobileDrawerOpen(false), inDrawer: true })}
          </div>
        </div>

        <main className="admin-main" inert={mobileDrawerOpen}>
          <div className="admin-page">
            <AdminSaveStatus />
            {viewOnly && (
              <div className="admin-notice">
                <Eye size={14} aria-hidden="true" />
                <span>View only: anything your role can&apos;t change on this page is locked.</span>
              </div>
            )}
            {canViewPage ? <div ref={pageRef} className={viewOnly ? 'admin-view-only' : noDelete ? 'admin-no-delete' : undefined}>{children}</div> : (
              <div className="admin-locked">
                <Lock size={28} color="var(--color-muted)" aria-hidden="true" />
                <h2>Not part of your role</h2>
                <p>
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
