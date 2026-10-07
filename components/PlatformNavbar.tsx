'use client';

import React, { useState } from 'react';
import { useEscapeToClose } from '@/lib/use-escape-to-close';
import Link from 'next/link';
import { useClub } from '@/lib/club-context';
import { useAuth } from '@/lib/auth-context';
import AuthModal from '@/components/AuthModal';
import { createPortal } from 'react-dom';
import ThemeToggle from '@/components/ThemeToggle';
import { BrandWordmark } from '@/components/BrandLogo';
import { Shield, Trophy, PlusCircle, ChevronDown, User, LogOut, Menu, X, HelpCircle } from 'lucide-react';

export default function PlatformNavbar() {
  const { clubs } = useClub();
  const { user, isAuthenticated, logout } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  useEscapeToClose(mobileDrawerOpen, setMobileDrawerOpen);
  const [isMounted, setIsMounted] = useState(false);

  React.useEffect(() => {
    setIsMounted(true);
  }, []);


  return (
    <header style={{
      position: 'sticky',
      top: 0,
      zIndex: 50,
      background: 'rgba(var(--dk-7-10-15), 0.9)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      borderBottom: '1px solid var(--border-subtle)',
    }}>
      <div className="container" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: '70px',
      }}>
        {/* Brand Logo */}
        <Link href="/" aria-label="itsfootball.club home" style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
          <BrandWordmark height={40} decorative />
        </Link>

        {/* Desktop Navigation Links */}
        {/* nowrap: items briefly wrapped to two lines under the (slightly wider) fallback font, then
            snapped back when the webfont loaded - a visible layout shift on every platform page */}
        <nav className="desktop-platform-nav" style={{ alignItems: 'center', gap: '1.5rem', whiteSpace: 'nowrap', marginLeft: 'auto' }}>
          <Link href="/clubs" style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Trophy size={16} />
            Clubs Directory
          </Link>
          <Link href="/faq" style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <HelpCircle size={16} />
            FAQ
          </Link>

          {/* Quick Demo Club Jump Dropdown */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              style={{
                background: 'rgba(var(--tint-rgb), 0.05)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)',
                padding: '0.45rem 0.85rem',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.85rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                cursor: 'pointer',
              }}
            >
              <span>Featured Clubs</span>
              <ChevronDown size={14} style={{ transform: dropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
            </button>

            {dropdownOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: '115%',
                  right: 0,
                  width: '260px',
                  background: 'var(--bg-surface-elevated)',
                  border: '1px solid var(--border-medium)',
                  borderRadius: 'var(--radius-md)',
                  boxShadow: 'var(--shadow-lg)',
                  padding: '0.5rem',
                  zIndex: 100,
                }}
              >
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', padding: '0.35rem 0.5rem', textTransform: 'uppercase', fontWeight: 700 }}>
                  Clubs In The League
                </div>
                {clubs.map(club => (
                  <Link
                    key={club.id}
                    href={`/${club.slug}`}
                    onClick={() => setDropdownOpen(false)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.55rem 0.65rem',
                      borderRadius: 'var(--radius-sm)',
                      color: 'var(--text-primary)',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(var(--tint-rgb), 0.06)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <div className="row">
                      <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: club.primary_color }} />
                      <span>{club.name}</span>
                    </div>
                    <span className="text-meta">{club.short_name}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Create Club CTA */}
          <Link href="/create-club" className="btn btn-primary btn-sm">
            <PlusCircle size={16} />
            <span>Launch Your Club</span>
          </Link>

          {/* Auth Status / Sign In Trigger */}
          {isAuthenticated && user ? (
            <div className="row row-loose">
              <Link
                href="/my-clubs"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  color: 'var(--c-green)',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  padding: '0.4rem 0.8rem',
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(16, 185, 129, 0.1)',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                  transition: 'all 0.15s ease',
                }}
              >
                <Shield size={15} color="var(--c-green)" />
                <span>My Clubs</span>
              </Link>

              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.35rem 0.65rem',
                borderRadius: 'var(--radius-full)',
                background: 'rgba(var(--tint-rgb), 0.05)',
                border: '1px solid var(--border-subtle)',
              }}>
                {user.avatar_url ? (
                  <img loading="eager" decoding="async" width={24} height={24}
                    src={user.avatar_url}
                    alt={`${user.full_name} photo`}
                    style={{ width: '24px', height: '24px', borderRadius: '50%', objectFit: 'cover' }}
                  />
                ) : (
                  <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--club-primary)', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 800 }}>
                    {user.full_name.substring(0, 1)}
                  </div>
                )}
                <span style={{ fontSize: '0.8rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                  {user.full_name.split(' ')[0]}
                </span>
              </div>

              <button
                type="button"
                onClick={() => logout()}
                title="Sign Out"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '0.4rem',
                  borderRadius: '6px',
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
          ) : (
            <button
              type="button"
              onClick={() => setAuthModalOpen(true)}
              className="btn btn-secondary btn-sm row"
            >
              <User size={14} />
              <span>Sign In</span>
            </button>
          )}
        </nav>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: '0.75rem' }}>
        <ThemeToggle />
        {/* Mobile Menu Trigger Button */}
        <button
          type="button"
          onClick={() => setMobileDrawerOpen(true)}
          className="mobile-platform-trigger touch-target"
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-primary)',
            cursor: 'pointer',
            padding: '0.5rem',
            borderRadius: '8px',
          }}
          aria-label="Open Navigation Menu"
        >
          <Menu size={24} />
        </button>
        </div>
      </div>

      {/* Mobile Slide-Over Drawer */}
      {isMounted && mobileDrawerOpen && createPortal(
        <div className="mobile-drawer-overlay" onClick={() => setMobileDrawerOpen(false)}>
          <div
            className="mobile-drawer-content"
            onClick={e => e.stopPropagation()}
            style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%' }}
          >
            <div>
              {/* Drawer Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '1.25rem', borderBottom: '1px solid var(--border-subtle)', marginBottom: '1.25rem' }}>
                <BrandWordmark height={34} />
                <button
                  onClick={() => setMobileDrawerOpen(false)}
                  style={{ background: 'rgba(var(--tint-rgb), 0.06)', border: 'none', color: 'var(--text-primary)', padding: '0.45rem', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  aria-label="Close Menu"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Drawer Action CTA */}
              <Link
                href="/create-club"
                onClick={() => setMobileDrawerOpen(false)}
                className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1rem' }}
              >
                <PlusCircle size={18} />
                <span>Launch Your Club</span>
              </Link>

              {/* Navigation Links */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '1.75rem' }}>
                {isAuthenticated && user && (
                  <Link
                    href="/my-clubs"
                    onClick={() => setMobileDrawerOpen(false)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '0.75rem 0.85rem',
                      borderRadius: '8px',
                      color: 'var(--text-primary)',
                      fontWeight: 700,
                      fontSize: '0.95rem',
                      background: 'rgba(16, 185, 129, 0.15)',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                    }}
                  >
                    <Shield size={18} color="var(--c-green)" />
                    <span>My Clubs</span>
                  </Link>
                )}

                <Link
                  href="/clubs"
                  onClick={() => setMobileDrawerOpen(false)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.75rem 0.85rem',
                    borderRadius: '8px',
                    color: 'var(--text-primary)',
                    fontWeight: 600,
                    fontSize: '0.95rem',
                    background: 'rgba(var(--tint-rgb), 0.03)',
                  }}
                >
                  <Trophy size={18} color="var(--c-amber)" />
                  <span>Clubs Directory</span>
                </Link>
                <Link
                  href="/faq"
                  onClick={() => setMobileDrawerOpen(false)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.75rem 0.85rem',
                    borderRadius: '8px',
                    color: 'var(--text-primary)',
                    fontWeight: 600,
                    fontSize: '0.95rem',
                    background: 'rgba(var(--tint-rgb), 0.03)',
                  }}
                >
                  <HelpCircle size={18} color="var(--c-blue)" />
                  <span>FAQ</span>
                </Link>
              </div>

              {/* League Featured Clubs */}
              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.06em', marginBottom: '0.6rem' }}>
                  Explore League Clubs
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  {clubs.map(c => (
                    <Link
                      key={c.id}
                      href={`/${c.slug}`}
                      onClick={() => setMobileDrawerOpen(false)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.6rem 0.75rem',
                        borderRadius: '8px',
                        background: 'rgba(var(--tint-rgb), 0.03)',
                        color: 'var(--text-primary)',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                      }}
                    >
                      <div className="row">
                        <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: c.primary_color, flexShrink: 0 }} />
                        <span>{c.name}</span>
                      </div>
                      <span className="text-meta">{c.short_name}</span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>

            {/* Bottom Auth Section */}
            <div style={{ paddingTop: '1rem', borderTop: '1px solid var(--border-subtle)' }}>
              {isAuthenticated && user ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div className="row">
                    {user.avatar_url ? (
                      <img loading="lazy" decoding="async" width={32} height={32} src={user.avatar_url} alt="" style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--club-primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>
                        {user.full_name.substring(0, 1)}
                      </div>
                    )}
                    <div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>{user.full_name}</div>
                      <div className="text-meta">{user.email}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => { logout(); setMobileDrawerOpen(false); }}
                    style={{ background: 'transparent', border: '1px solid var(--border-subtle)', color: 'var(--c-red)', padding: '0.45rem 0.75rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
                  >
                    Sign Out
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => { setMobileDrawerOpen(false); setAuthModalOpen(true); }}
                  className="btn btn-secondary"
                  style={{ width: '100%', justifyContent: 'center', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                >
                  <User size={16} />
                  <span>Sign In</span>
                </button>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />

      <style jsx>{`
        .desktop-platform-nav {
          display: none;
        }
        .mobile-platform-trigger {
          display: flex;
        }
        @media (min-width: 860px) {
          .desktop-platform-nav {
            display: flex !important;
          }
          .mobile-platform-trigger {
            display: none !important;
          }
        }
      `}</style>
    </header>
  );
}


