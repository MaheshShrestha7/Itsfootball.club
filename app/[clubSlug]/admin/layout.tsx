'use client';

import React, { use } from 'react';
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
  Sparkles
} from 'lucide-react';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { isR2Configured } from '@/lib/storage/r2';

export default function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ clubSlug: string }>;
}) {
  const resolvedParams = use(params);
  const pathname = usePathname();
  const { clubs, selectClubBySlug, matches } = useClub();
  const { user, logout, getUserRoleForClub } = useAuth();
  const club = selectClubBySlug(resolvedParams.clubSlug) || clubs[0];

  const liveMatch = matches.find(m => m.club_id === club.id && m.status === 'live');
  const userRole = user ? getUserRoleForClub(club.id) : null;

  const navItems = [
    { label: '3.11 Admin Dashboard', href: `/${club.slug}/admin`, icon: LayoutDashboard },
    { label: '3.1 Interface & Branding', href: `/${club.slug}/admin/branding`, icon: Palette },
    { label: '⭐ Hero Slider Pins', href: `/${club.slug}/admin/hero-slider`, icon: Sparkles },
    { label: '3.2 Live Match Controller', href: `/${club.slug}/admin/match-center`, icon: Radio, badge: liveMatch ? 'LIVE' : undefined },
    { label: '📋 Draft Lineup Workbench', href: `/${club.slug}/admin/lineup/draft`, icon: Layers },
    { label: '⏱️ Pre-Match Availability', href: `/${club.slug}/availability`, icon: UserCheck },
    { label: '3.3 Club Events', href: `/${club.slug}/admin/events`, icon: Calendar },
    { label: '3.4 Squad & Members', href: `/${club.slug}/admin/squad`, icon: Users },
    { label: '🏆 ClubScore Gamification', href: `/${club.slug}/admin/gamification`, icon: Trophy },
    { label: '3.5 Executive Committee', href: `/${club.slug}/admin/committee`, icon: Award },
    { label: '3.6 Club Sponsors', href: `/${club.slug}/admin/sponsors`, icon: DollarSign },
    { label: '3.7 Content CMS', href: `/${club.slug}/admin/content`, icon: FileText },
    { label: '3.8 Public Analytics', href: `/${club.slug}/admin/analytics`, icon: BarChart3 },
    { label: '3.9 & 3.10 QR Scanner', href: `/${club.slug}/admin/scanner`, icon: QrCode },
  ];

  return (
    <AdminGuard club={club}>
      <div style={{ display: 'flex', minHeight: 'calc(100vh - 120px)', background: 'var(--bg-pitch)' }}>
        {/* Admin Sidebar */}
        <aside style={{
          width: '290px',
          borderRight: '1px solid var(--border-subtle)',
          background: 'var(--bg-surface)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '1.5rem 1rem',
          flexShrink: 0,
        }}>
          <div>
            {/* Club Header Badge */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.75rem',
              background: 'rgba(0,0,0,0.3)',
              borderRadius: 'var(--radius-md)',
              marginBottom: '1.5rem',
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

            {/* Nav Items */}
            <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              {navItems.map(item => {
                const isActive = pathname === item.href;
                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.65rem 0.85rem',
                      borderRadius: 'var(--radius-sm)',
                      color: isActive ? '#FFFFFF' : 'var(--text-secondary)',
                      background: isActive ? 'var(--club-primary)' : 'transparent',
                      fontWeight: isActive ? 700 : 500,
                      fontSize: '0.85rem',
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => {
                      if (!isActive) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                    }}
                    onMouseLeave={e => {
                      if (!isActive) e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                      <Icon size={16} color={isActive ? '#FFFFFF' : 'var(--text-muted)'} />
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
            </nav>
          </div>

          {/* Bottom Sidebar: Authenticated Administrator Profile & Links */}
          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
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
              className="btn btn-secondary btn-sm"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
            >
              <span>View Public Portal</span>
              <ExternalLink size={13} />
            </Link>
          </div>
        </aside>

        {/* Main Admin Content Canvas */}
        <main style={{ flex: 1, padding: '2.5rem', overflowY: 'auto' }}>
          <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
            {children}
          </div>
        </main>
      </div>
    </AdminGuard>
  );
}

