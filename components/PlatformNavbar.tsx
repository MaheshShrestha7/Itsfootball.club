'use client';

import React, { useState } from 'react';
import { useEscapeToClose } from '@/lib/use-escape-to-close';
import Link from 'next/link';
import { useClub } from '@/lib/club-context';
import { useAuth } from '@/lib/auth-context';
import AuthModal from '@/components/AuthModal';
import { createPortal } from 'react-dom';
import { Shield, Trophy, PlusCircle, ChevronDown, User, LogOut, Menu, X } from 'lucide-react';

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
      background: 'rgba(7, 10, 15, 0.9)',
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
        <Link href="/" aria-label="itsfootball.club home" style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', flexShrink: 0 }}>
          <img
            src="/logo-96.png"
            alt="itsfootball.club logo"
            width={46}
            height={46}
            loading="eager"
            decoding="async"
            style={{ width: '46px', height: '46px', flexShrink: 0, filter: 'drop-shadow(0 4px 10px rgba(0, 0, 0, 0.45))' }}
          />
          <div>
            <span style={{
              fontFamily: 'var(--font-heading)',
              fontSize: '1.2rem',
              fontWeight: 800,
              letterSpacing: '-0.02em',
              background: 'linear-gradient(to right, #FFFFFF, #CBD5E1)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>
              itsfootball<span style={{ color: '#C9A467', WebkitTextFillColor: '#C9A467' }}>.club</span>
            </span>
            <div style={{ fontSize: '0.7rem', color: '#C9A467', opacity: 0.85, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: '-3px' }}>
              Home of Football Clubs
            </div>
          </div>
        </Link>

        {/* Desktop Navigation Links */}
        {/* nowrap: items briefly wrapped to two lines under the (slightly wider) fallback font, then
            snapped back when the webfont loaded - a visible layout shift on every platform page */}
        <nav className="desktop-platform-nav" style={{ alignItems: 'center', gap: '1.5rem', whiteSpace: 'nowrap' }}>
          <Link href="/clubs" style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Trophy size={16} />
            Clubs Directory
          </Link>

          {/* Quick Demo Club Jump Dropdown */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
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
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: club.primary_color }} />
                      <span>{club.name}</span>
                    </div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{club.short_name}</span>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <Link
                href="/my-clubs"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  color: '#10B981',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  padding: '0.4rem 0.8rem',
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(16, 185, 129, 0.1)',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                  transition: 'all 0.15s ease',
                }}
              >
                <Shield size={15} color="#10B981" />
                <span>My Clubs</span>
              </Link>

              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.35rem 0.65rem',
                borderRadius: 'var(--radius-full)',
                background: 'rgba(255, 255, 255, 0.05)',
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
                <span style={{ fontSize: '0.8rem', color: '#FFFFFF', fontWeight: 600 }}>
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
              className="btn btn-secondary btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <User size={14} />
              <span>Sign In</span>
            </button>
          )}
        </nav>

        {/* Mobile Menu Trigger Button */}
        <button
          type="button"
          onClick={() => setMobileDrawerOpen(true)}
          className="mobile-platform-trigger touch-target"
          style={{
            background: 'transparent',
            border: 'none',
            color: '#FFFFFF',
            cursor: 'pointer',
            padding: '0.5rem',
            borderRadius: '8px',
          }}
          aria-label="Open Navigation Menu"
        >
          <Menu size={24} />
        </button>
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <img src="/logo-96.png" alt="itsfootball.club logo" width={34} height={34} loading="lazy" decoding="async" style={{ width: '34px', height: '34px' }} />
                  <span style={{ fontWeight: 800, fontSize: '1.1rem', color: '#FFFFFF' }}>itsfootball<span style={{ color: '#C9A467' }}>.club</span></span>
                </div>
                <button
                  onClick={() => setMobileDrawerOpen(false)}
                  style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: '#FFFFFF', padding: '0.45rem', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
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
                      color: '#FFFFFF',
                      fontWeight: 700,
                      fontSize: '0.95rem',
                      background: 'rgba(16, 185, 129, 0.15)',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                    }}
                  >
                    <Shield size={18} color="#10B981" />
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
                    background: 'rgba(255, 255, 255, 0.03)',
                  }}
                >
                  <Trophy size={18} color="#F59E0B" />
                  <span>Clubs Directory</span>
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
                        background: 'rgba(255, 255, 255, 0.03)',
                        color: '#FFFFFF',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: c.primary_color, flexShrink: 0 }} />
                        <span>{c.name}</span>
                      </div>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{c.short_name}</span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>

            {/* Bottom Auth Section */}
            <div style={{ paddingTop: '1rem', borderTop: '1px solid var(--border-subtle)' }}>
              {isAuthenticated && user ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    {user.avatar_url ? (
                      <img loading="lazy" decoding="async" width={32} height={32} src={user.avatar_url} alt="" style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--club-primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>
                        {user.full_name.substring(0, 1)}
                      </div>
                    )}
                    <div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#FFFFFF' }}>{user.full_name}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{user.email}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => { logout(); setMobileDrawerOpen(false); }}
                    style={{ background: 'transparent', border: '1px solid var(--border-subtle)', color: '#EF4444', padding: '0.45rem 0.75rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
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


