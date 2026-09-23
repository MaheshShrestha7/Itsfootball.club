'use client';

import React, { use, useState, useEffect } from 'react';
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
  Flame
} from 'lucide-react';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { isR2Configured } from '@/lib/storage/r2';
import AdminSearch from '@/components/AdminSearch';

export default function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ clubSlug: string }>;
}) {
  const resolvedParams = use(params);
  const pathname = usePathname();
  const { clubs, selectClubBySlug, matches, getActiveSeason, members, syncStatus, retrySync, inquiries } = useClub();
  const { user, logout, getUserRoleForClub } = useAuth();
  const club = selectClubBySlug(resolvedParams.clubSlug) || clubs[0];

  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Close drawer on navigation
  useEffect(() => {
    setMobileDrawerOpen(false);
  }, [pathname]);

  const liveMatch = matches.find(m => m.club_id === club.id && m.status === 'live');
  const userRole = user ? getUserRoleForClub(club.id) : null;
  const activeSeason = getActiveSeason ? getActiveSeason(club.id) : null;
  const unreadInquiries = inquiries.filter(i => i.club_id === club.id && i.status === 'unread').length;
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
      title: 'Overview',
      items: [
        { label: 'Dashboard', href: `/${club.slug}/admin`, icon: LayoutDashboard },
      ],
    },
    {
      // Tools you reach for on the day itself, at the ground
      title: 'Matchday Live',
      items: [
        { label: 'Match Command Center', href: `/${club.slug}/admin/match-center`, icon: Radio, badge: liveMatch ? 'LIVE' : undefined },
        { label: 'Turnstile QR Scanner', href: `/${club.slug}/admin/scanner`, icon: QrCode },
        { label: 'Player Availability', href: `/${club.slug}/availability`, icon: ClipboardCheck },
      ],
    },
    {
      // Planning ahead of matchday: what's on, who's playing, when
      title: 'Fixtures & Events',
      items: [
        { label: 'Schedule & Matches', href: `/${club.slug}/admin/matches`, icon: CalendarDays },
        { label: 'Tournaments & Cups', href: `/${club.slug}/admin/tournaments`, icon: Trophy },
        { label: 'Events Management', href: `/${club.slug}/admin/events`, icon: Calendar },
        { label: 'Lineup Workbench', href: `/${club.slug}/admin/lineup/draft`, icon: Layers },
        { label: 'Season Management', href: `/${club.slug}/admin/seasons`, icon: Flag, badge: activeSeason?.name },
      ],
    },
    {
      // Squad, membership, and club communication
      title: 'People & Squad',
      items: [
        { label: 'Squad & Players', href: `/${club.slug}/admin/squad`, icon: Users },
        {
          label: 'Member Approvals',
          href: `/${club.slug}/admin/members`,
          icon: UserCheck,
          badge: pendingMembersCount > 0 ? `${pendingMembersCount} PENDING` : undefined
        },
        { label: 'Executive Committee', href: `/${club.slug}/admin/committee`, icon: Award },
        { label: 'ClubScore Gamification', href: `/${club.slug}/admin/gamification`, icon: Flame },
        {
          label: 'Inbox',
          href: `/${club.slug}/admin/inquiries`,
          icon: Mail,
          badge: unreadInquiries > 0 ? `${unreadInquiries} NEW` : undefined
        },
      ],
    },
    {
      // The public-facing site: look, content, and its numbers
      title: 'Website & Marketing',
      items: [
        { label: 'Club Configuration & Branding', href: `/${club.slug}/admin/branding`, icon: Palette },
        { label: 'Hero Slider Spotlight', href: `/${club.slug}/admin/hero-slider`, icon: Sparkles },
        { label: 'Content & News CMS', href: `/${club.slug}/admin/content`, icon: FileText },
        { label: 'Commercial Sponsors', href: `/${club.slug}/admin/sponsors`, icon: DollarSign },
        { label: 'Audience Analytics', href: `/${club.slug}/admin/analytics`, icon: BarChart3 },
      ],
    },
  ];

  const allNavItems = navSections.flatMap(s => s.items);
  const currentNavItem = allNavItems.find(item => item.href === pathname);

  const renderSidebarContent = (onItemClick?: () => void) => (
    <>
      <div>
        {/* Club Header Badge */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          padding: '0.75rem',
          background: 'rgba(0,0,0,0.35)',
          borderRadius: 'var(--radius-md)',
          marginBottom: '1.25rem',
          border: '1px solid var(--border-subtle)',
        }}>
          <img
            src={club.logo_url}
            alt={club.name}
            style={{ width: '40px', height: '40px', borderRadius: '10px', objectFit: 'cover', border: `2px solid ${club.primary_color}` }}
          />
          <div style={{ overflow: 'hidden' }}>
            <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#FFFFFF', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
              {club.name}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--club-primary)', fontWeight: 700 }}>
              Management Control Room
            </div>
          </div>
        </div>

        <AdminSearch clubSlug={club.slug} clubId={club.id} />

        {/* Categorized Nav Sections */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {navSections.map(section => (
            <div key={section.title}>
              {section.title !== 'Overview' && (
                <div style={{
                  fontSize: '0.68rem',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: 'var(--text-muted)',
                  padding: '0.2rem 0.65rem 0.4rem 0.65rem',
                }}>
                  {section.title}
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                {section.items.map(item => {
                  const isActive = pathname === item.href;
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onItemClick}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.6rem 0.85rem',
                        borderRadius: 'var(--radius-sm)',
                        color: isActive ? '#FFFFFF' : 'var(--text-secondary)',
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
                          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
                          e.currentTarget.style.color = '#FFFFFF';
                        }
                      }}
                      onMouseLeave={e => {
                        if (!isActive) {
                          e.currentTarget.style.background = 'transparent';
                          e.currentTarget.style.color = 'var(--text-secondary)';
                        }
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                        <Icon size={16} color={isActive ? 'var(--club-primary)' : 'var(--text-muted)'} />
                        <span>{item.label}</span>
                      </div>
                      {item.badge && (
                        <span className="badge badge-live" style={{ fontSize: '0.6rem', padding: '0.15rem 0.45rem' }}>
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>

      {/* Bottom Sidebar: Authenticated Administrator Profile & Links */}
      <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem', marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
        {user && (
          <div style={{
            background: 'rgba(0,0,0,0.35)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '8px',
            padding: '0.65rem 0.75rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', overflow: 'hidden' }}>
              {user.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt={user.full_name}
                  style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover', border: '1px solid #10B981' }}
                />
              ) : (
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--club-primary)', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.8rem' }}>
                  {user.full_name.substring(0, 2).toUpperCase()}
                </div>
              )}
              <div style={{ overflow: 'hidden' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#FFFFFF', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                  {user.full_name}
                </div>
                <div style={{ fontSize: '0.65rem', color: '#10B981', fontWeight: 700, textTransform: 'uppercase' }}>
                  {userRole === 'owner' ? 'Club Owner' : 'Club Admin'}
                </div>
              </div>
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

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.7rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: isSupabaseConfigured ? '#10B981' : '#F59E0B' }}>
            <Database size={12} />
            <span>Security: RBAC Strict Session Active</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: isR2Configured ? '#10B981' : 'var(--text-muted)' }}>
            <Cloud size={12} />
            <span>Storage: {isR2Configured ? 'Cloudflare R2 Encrypted' : 'Local Storage Engine'}</span>
          </div>
        </div>

        <Link
          href={`/${club.slug}`}
          onClick={onItemClick}
          className="btn btn-secondary btn-sm touch-target"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
        >
          <span>View Public Portal</span>
          <ExternalLink size={13} />
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
            style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}
          >
            <Menu size={18} />
            <span>Admin Menu</span>
          </button>
          <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#FFFFFF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '140px' }}>
            {currentNavItem?.label || 'Control Room'}
          </div>
          <Link
            href={`/${club.slug}`}
            className="btn btn-outline btn-sm touch-target"
            style={{ fontSize: '0.78rem', padding: '0.35rem 0.65rem' }}
          >
            Public &rarr;
          </Link>
        </div>

        {/* Desktop Admin Sidebar */}
        <aside className="admin-desktop-sidebar">
          {renderSidebarContent()}
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
                <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#FFFFFF' }}>Control Room</div>
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
                {renderSidebarContent(() => setMobileDrawerOpen(false))}
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
                  color: syncStatus.phase === 'error' ? '#FCA5A5' : '#FCD34D',
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

