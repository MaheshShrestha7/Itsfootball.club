'use client';

import React, { use, useState, useEffect } from 'react';
import { useEscapeToClose } from '@/lib/use-escape-to-close';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
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
  Database,
  Cloud,
  LogOut,
  UserCheck,
  Trophy,
  Layers,
  Sparkles,
  CalendarDays,
  Menu,
  X,
  Mail,
  ClipboardCheck,
  Flag,
  Flame,
  Wallet, BellRing, LifeBuoy, ShoppingBag,
  ChevronDown,
  ChevronsDownUp,
  ChevronsUpDown,
  PanelLeftClose,
  PanelLeftOpen } from 'lucide-react';
import { isSupabaseConfigured, getSupabaseClient } from '@/lib/supabase/client';
import { DEFAULT_CREST } from '@/lib/crest';
import { isR2Configured } from '@/lib/storage/r2';
import AdminSearch from '@/components/AdminSearch';
import SupportModal from '@/components/SupportModal';

// Menu layout preferences, remembered per browser
const SIDEBAR_COLLAPSED_KEY = 'itsfootball_admin_sidebar_collapsed';
const CLOSED_SECTIONS_KEY = 'itsfootball_admin_closed_sections';

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
  const { clubs, selectClubBySlug, matches, getActiveSeason, members, syncStatus, retrySync, inquiries, memberMessages } = useClub();
  const { user, logout, getUserRoleForClub } = useAuth();
  const club = selectClubBySlug(resolvedParams.clubSlug) || clubs[0];

  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  useEscapeToClose(mobileDrawerOpen, setMobileDrawerOpen);
  const [isMounted, setIsMounted] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);

  // Desktop sidebar shrunk to an icon rail, and the menu groups the admin has folded away
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [closedSections, setClosedSections] = useState<string[]>([]);

  useEffect(() => {
    setIsMounted(true);
    try {
      setSidebarCollapsed(localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true');
      const closed = JSON.parse(localStorage.getItem(CLOSED_SECTIONS_KEY) || '[]');
      if (Array.isArray(closed)) setClosedSections(closed.filter((t): t is string => typeof t === 'string'));
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

  const liveMatch = matches.find(m => m.club_id === club.id && m.status === 'live');
  const userRole = user ? getUserRoleForClub(club.id) : null;
  const activeSeason = getActiveSeason ? getActiveSeason(club.id) : null;
  // The Inbox covers both the public contact form and signed-in members' messages
  const unreadInquiries =
    inquiries.filter(i => i.club_id === club.id && i.status === 'unread').length +
    memberMessages.filter(m => m.club_id === club.id && m.sender_type === 'member' && !m.is_read).length;
  const pendingMembersCount = members.filter(m => m.club_id === club.id && m.membership_status === 'pending').length;

  interface NavItem {
    label: string;
    href: string;
    icon: React.ComponentType<{ size?: number; color?: string; className?: string }>;
    badge?: string;
  }

  interface NavSection {
    title: string;
    items: NavItem[];
  }

  const navSections: NavSection[] = [
    {
      // Always-visible entry points (this section has no heading)
      title: 'Overview',
      items: [
        { label: 'Dashboard', href: `/${club.slug}/admin`, icon: LayoutDashboard },
        {
          label: 'Inbox',
          href: `/${club.slug}/admin/inquiries`,
          icon: Mail,
          badge: unreadInquiries > 0 ? `${unreadInquiries} NEW` : undefined
        },
      ],
    },
    {
      // The day itself: picking the team, running the game, the gate
      title: 'Matchday',
      items: [
        { label: 'Match Command Center', href: `/${club.slug}/admin/match-center`, icon: Radio, badge: liveMatch ? 'LIVE' : undefined },
        { label: 'Player Availability', href: `/${club.slug}/admin/availability`, icon: ClipboardCheck },
        { label: 'Lineup Workbench', href: `/${club.slug}/admin/lineup/draft`, icon: Layers },
        { label: 'Turnstile QR Scanner', href: `/${club.slug}/admin/scanner`, icon: QrCode },
      ],
    },
    {
      // Planning the season: what's on and when
      title: 'Fixtures & Competitions',
      items: [
        { label: 'Schedule & Matches', href: `/${club.slug}/admin/matches`, icon: CalendarDays },
        { label: 'Tournaments & Cups', href: `/${club.slug}/admin/tournaments`, icon: Trophy },
        { label: 'Events Management', href: `/${club.slug}/admin/events`, icon: Calendar },
        { label: 'Season Management', href: `/${club.slug}/admin/seasons`, icon: Flag, badge: activeSeason?.name },
      ],
    },
    {
      // Squad, members and the committee
      title: 'People & Membership',
      items: [
        { label: 'Squad & Players', href: `/${club.slug}/admin/squad`, icon: Users },
        { label: 'Internal Teams', href: `/${club.slug}/admin/teams`, icon: Shield },
        {
          label: 'Member Approvals',
          href: `/${club.slug}/admin/members`,
          icon: UserCheck,
          badge: pendingMembersCount > 0 ? `${pendingMembersCount} PENDING` : undefined
        },
        { label: 'Executive Committee', href: `/${club.slug}/admin/committee`, icon: Award },
        { label: 'Email Notifications', href: `/${club.slug}/admin/emails`, icon: BellRing },
        { label: 'ClubScore Gamification', href: `/${club.slug}/admin/gamification`, icon: Flame },
      ],
    },
    {
      // Money in and out
      title: 'Finance & Sponsors',
      items: [
        {
          label: 'Finance',
          href: `/${club.slug}/admin/finance`,
          icon: Wallet,
          badge: receiptsToReview > 0 ? `${receiptsToReview} TO CHECK` : undefined
        },
        { label: 'Club Shop', href: `/${club.slug}/admin/shop`, icon: ShoppingBag, badge: ordersToHandOut > 0 ? `${ordersToHandOut} TO HAND OUT` : undefined },
        { label: 'Commercial Sponsors', href: `/${club.slug}/admin/sponsors`, icon: DollarSign },
      ],
    },
    {
      // The public-facing site: look, content, and its numbers
      title: 'Website & Marketing',
      items: [
        { label: 'Club Configuration & Branding', href: `/${club.slug}/admin/branding`, icon: Palette },
        { label: 'Hero Slider Spotlight', href: `/${club.slug}/admin/hero-slider`, icon: Sparkles },
        { label: 'Content & News CMS', href: `/${club.slug}/admin/content`, icon: FileText },
        { label: 'Audience Analytics', href: `/${club.slug}/admin/analytics`, icon: BarChart3 },
      ],
    },
  ];

  const allNavItems = navSections.flatMap(s => s.items);
  const currentNavItem = allNavItems.find(item => item.href === pathname);
  // Overview has no heading, so it is never folded away
  const collapsibleTitles = navSections.filter(s => s.title !== 'Overview').map(s => s.title);
  const allSectionsClosed = collapsibleTitles.every(t => closedSections.includes(t));

  // Landing on a page whose group is folded away opens that group, so the current page is always visible
  const activeSectionTitle = navSections.find(s => s.items.some(i => i.href === pathname))?.title;
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
              <div style={{ fontSize: '0.7rem', color: 'var(--club-primary)', fontWeight: 700 }}>
                Management Control Room
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
                  const isActive = pathname === item.href;
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onItemClick}
                      title={rail ? (item.badge ? `${item.label} (${item.badge})` : item.label) : undefined}
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
                        </>
                      )}
                    </Link>
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
            <div title={rail ? user.full_name : undefined} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', overflow: 'hidden' }}>
              {user.avatar_url ? (
                <img loading="eager" decoding="async" width={32} height={32}
                  src={user.avatar_url}
                  alt={`${user.full_name} photo`}
                  style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover', border: '1px solid #10B981' }}
                />
              ) : (
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--club-primary)', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.8rem' }}>
                  {user.full_name.substring(0, 2).toUpperCase()}
                </div>
              )}
              {!rail && <div style={{ overflow: 'hidden' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-primary)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                  {user.full_name}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--c-green)', fontWeight: 700, textTransform: 'uppercase' }}>
                  {userRole === 'owner' ? 'Club Owner' : 'Club Admin'}
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

        {!rail && <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.7rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: isSupabaseConfigured ? 'var(--c-green)' : 'var(--c-amber)' }}>
            <Database size={12} />
            <span>Security: RBAC Strict Session Active</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: isR2Configured ? 'var(--c-green)' : 'var(--text-muted)' }}>
            <Cloud size={12} />
            <span>Storage: {isR2Configured ? 'Cloudflare R2 Encrypted' : 'Local Storage Engine'}</span>
          </div>
        </div>}

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
            aria-label="Open admin menu"
            style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexShrink: 0 }}
          >
            <Menu size={18} />
            <span className="admin-subbar-menu-label">Admin Menu</span>
          </button>
          <div style={{ flex: 1, minWidth: 0, textAlign: 'center', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {currentNavItem?.label || 'Control Room'}
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
                <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-primary)' }}>Control Room</div>
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
            {children}
          </div>
        </main>
      </div>
    </AdminGuard>
  );
}

