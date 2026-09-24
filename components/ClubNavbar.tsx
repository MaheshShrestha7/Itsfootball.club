'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { Club } from '@/lib/supabase/types';
import { useClub } from '@/lib/club-context';
import { useAuth } from '@/lib/auth-context';
import AuthModal from '@/components/AuthModal';
import { Shield, Radio, CreditCard, Users, Calendar, Trophy, Settings, Menu, X, User, LogOut } from 'lucide-react';

interface ClubNavbarProps {
  club: Club;
}

export default function ClubNavbar({ club }: ClubNavbarProps) {
  const { matches } = useClub();
  const { user, isAuthenticated, logout, hasClubAdminAccess, getUserRoleForClub } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const isAdmin = hasClubAdminAccess(club.id);
  const userRole = user ? getUserRoleForClub(club.id) : null;

  const [logoError, setLogoError] = useState(false);

  // Reset error latch whenever club branding updates
  useEffect(() => {
    setLogoError(false);
  }, [club.logo_url]);


  // Check if any match for this club is currently LIVE
  const liveMatch = matches.find(m => m.club_id === club.id && m.status === 'live');

  return (
    <header style={{
      position: 'sticky',
      top: 0,
      zIndex: 50,
      background: 'rgba(10, 15, 23, 0.94)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      borderBottom: '1px solid var(--border-subtle)',
    }}>
      {/* Main Club Navigation */}
      <div className="container" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: '74px',
        gap: '0.5rem',
      }}>
        {/* Club Crest & Title */}
        <Link
          href={`/${club.slug}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            textDecoration: 'none',
            minWidth: 0,
            flex: 1,
          }}
        >
          {/* Shield / Crest Container */}
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: '13px',
            border: `2px solid ${club.primary_color}`,
            background: 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(15,23,42,0.95) 100%)',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: `0 4px 14px rgba(0, 0, 0, 0.5), 0 0 16px ${club.primary_color}35`,
            flexShrink: 0,
            padding: '3px',
            position: 'relative',
          }}>
            {club.logo_url && !logoError ? (
              <img
                src={club.logo_url}
                alt={club.name}
                onError={() => setLogoError(true)}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))',
                }}
              />
            ) : (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: club.primary_color,
                lineHeight: 1,
              }}>
                <Shield size={22} color={club.primary_color} />
                <span style={{ fontSize: '0.55rem', fontWeight: 900, marginTop: '2px', color: '#FFFFFF' }}>
                  {club.short_name || 'FC'}
                </span>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: 0 }}>
              <span style={{
                fontFamily: 'var(--font-heading)',
                fontSize: 'clamp(1rem, 3.8vw, 1.25rem)',
                fontWeight: 800,
                letterSpacing: '-0.02em',
                color: '#FFFFFF',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
                {club.name}
              </span>
              <span className="badge" style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: 'var(--text-secondary)', fontSize: '0.62rem', flexShrink: 0 }}>
                {club.short_name}
              </span>
            </div>
            {club.motto && (
              <div style={{
                fontSize: '0.7rem',
                color: 'var(--text-muted)',
                fontStyle: 'italic',
                marginTop: '1px',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: '220px',
              }}>
                &ldquo;{club.motto}&rdquo;
              </div>
            )}
          </div>
        </Link>

        {/* Desktop Links */}
        <nav style={{ display: 'none', alignItems: 'center', gap: '1.5rem' }} className="desktop-nav">
          <Link href={`/${club.slug}`} style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.9rem' }}>
            Club
          </Link>

          {/* Live Match-Day Center Link */}
          <Link
            href={liveMatch ? `/${club.slug}/match/${liveMatch.id}` : `/${club.slug}#fixtures`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              fontWeight: 600,
              fontSize: '0.9rem',
              color: liveMatch ? '#EF4444' : 'var(--text-secondary)',
            }}
          >
            {liveMatch ? (
              <span className="badge badge-live" style={{ padding: '0.2rem 0.5rem' }}>
                <span className="pulse-dot" /> LIVE MATCH
              </span>
            ) : (
              <>
                <Radio size={16} />
                <span>Match Center</span>
              </>
            )}
          </Link>

          {/* Virtual Member Pass */}
          <Link
            href={`/${club.slug}/member`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              color: 'var(--text-secondary)',
              fontWeight: 600,
              fontSize: '0.9rem',
            }}
          >
            <CreditCard size={16} color="var(--club-primary)" />
            <span>Member Pass</span>
          </Link>

          <Link href={`/${club.slug}#fixtures`} style={{ color: 'var(--text-secondary)', fontWeight: 500, fontSize: '0.9rem' }}>
            Fixtures
          </Link>
          <Link
            href={`/${club.slug}/tournaments`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              color: 'var(--text-secondary)',
              fontWeight: 600,
              fontSize: '0.9rem',
            }}
          >
            <Trophy size={15} color="#F59E0B" />
            <span>Tournaments</span>
          </Link>
          <Link href={`/${club.slug}#squad`} style={{ color: 'var(--text-secondary)', fontWeight: 500, fontSize: '0.9rem' }}>
            Squad
          </Link>
          <Link href={`/${club.slug}#events`} style={{ color: 'var(--text-secondary)', fontWeight: 500, fontSize: '0.9rem' }}>
            Events
          </Link>
          <Link href={`/${club.slug}#news`} style={{ color: 'var(--text-secondary)', fontWeight: 500, fontSize: '0.9rem' }}>
            News
          </Link>

          {/* Admin Portal Gateway */}
          {isAdmin && (
            <Link
              href={`/${club.slug}/admin`}
              className="btn btn-sm"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                color: '#10B981',
                border: '1px solid rgba(16, 185, 129, 0.4)',
                fontWeight: 700,
              }}
            >
              <Settings size={14} />
              <span>Admin Room</span>
            </Link>
          )}

          {/* Auth Identity Controls */}
          {isAuthenticated && user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: '0.5rem' }}>
              <Link
                href={`/${club.slug}/member`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.35rem 0.65rem',
                  borderRadius: 'var(--radius-full)',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid var(--border-subtle)',
                  textDecoration: 'none',
                }}
              >
                {user.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt={user.full_name}
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
                {userRole && (
                  <span style={{ fontSize: '0.65rem', padding: '0.1rem 0.4rem', borderRadius: '4px', background: isAdmin ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.08)', color: isAdmin ? '#10B981' : 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                    {userRole}
                  </span>
                )}
              </Link>

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
                <LogOut size={15} />
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setAuthModalOpen(true)}
                className="btn btn-secondary btn-sm"
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
              >
                <User size={14} />
                <span>Sign In</span>
              </button>
            </div>
          )}
        </nav>

        {/* Mobile menu trigger */}
        <button
          onClick={() => setMobileMenuOpen(true)}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#FFFFFF',
            cursor: 'pointer',
            padding: '0.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            borderRadius: '8px',
          }}
          aria-label="Toggle Menu"
          className="mobile-trigger touch-target"
        >
          <Menu size={24} />
        </button>
      </div>

      {/* Mobile Menu Drawer via Portal */}
      {isMounted && mobileMenuOpen && createPortal(
        <div className="mobile-drawer-overlay" onClick={() => setMobileMenuOpen(false)}>
          <div
            className="mobile-drawer-content"
            onClick={e => e.stopPropagation()}
            style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%' }}
          >
            <div>
              {/* Drawer Club Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '1.25rem', borderBottom: '1px solid var(--border-subtle)', marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <img
                    src={club.logo_url}
                    alt={club.name}
                    style={{ width: '32px', height: '32px', borderRadius: '8px', border: `1.5px solid ${club.primary_color}`, objectFit: 'contain' }}
                  />
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#FFFFFF' }}>{club.name}</div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Official Matchday Portal</div>
                  </div>
                </div>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: '#FFFFFF', padding: '0.45rem', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  aria-label="Close Menu"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Action Buttons: Match Center & Member Pass */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1.5rem' }}>
                <Link
                  href={liveMatch ? `/${club.slug}/match/${liveMatch.id}` : `/${club.slug}#fixtures`}
                  onClick={() => setMobileMenuOpen(false)}
                  className="btn btn-sm"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    background: liveMatch ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 255, 255, 0.06)',
                    color: liveMatch ? '#EF4444' : '#FFFFFF',
                    border: `1px solid ${liveMatch ? 'rgba(239, 68, 68, 0.5)' : 'var(--border-subtle)'}`,
                    padding: '0.65rem 1rem',
                    fontWeight: 700,
                  }}
                >
                  <Radio size={16} color={liveMatch ? '#EF4444' : 'currentColor'} />
                  <span>{liveMatch ? 'Watch Match Center (LIVE)' : 'Match-Day Center'}</span>
                </Link>

                <Link
                  href={`/${club.slug}/member`}
                  onClick={() => setMobileMenuOpen(false)}
                  className="btn btn-primary btn-sm"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.65rem 1rem' }}
                >
                  <CreditCard size={16} />
                  <span>Digital Member Pass</span>
                </Link>
              </div>

              {/* Clubhouse Section Navigation Links */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <Link
                  href={`/${club.slug}`}
                  onClick={() => setMobileMenuOpen(false)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '8px',
                    color: '#FFFFFF',
                    fontWeight: 700,
                    background: 'rgba(255, 255, 255, 0.04)',
                  }}
                >
                  <Shield size={16} color={club.primary_color} />
                  <span>Clubhouse Overview</span>
                </Link>

                <Link
                  href={`/${club.slug}#fixtures`}
                  onClick={() => setMobileMenuOpen(false)}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.65rem 0.85rem', borderRadius: '8px', color: 'var(--text-secondary)', fontWeight: 600 }}
                >
                  <Calendar size={16} />
                  <span>Fixtures & Results</span>
                </Link>

                <Link
                  href={`/${club.slug}/tournaments`}
                  onClick={() => setMobileMenuOpen(false)}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.65rem 0.85rem', borderRadius: '8px', color: 'var(--text-secondary)', fontWeight: 600 }}
                >
                  <Trophy size={16} color="#F59E0B" />
                  <span>Tournaments & Cups</span>
                </Link>

                <Link
                  href={`/${club.slug}#squad`}
                  onClick={() => setMobileMenuOpen(false)}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.65rem 0.85rem', borderRadius: '8px', color: 'var(--text-secondary)', fontWeight: 600 }}
                >
                  <Users size={16} />
                  <span>First Team Squad & Stats</span>
                </Link>

                <Link
                  href={`/${club.slug}#events`}
                  onClick={() => setMobileMenuOpen(false)}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.65rem 0.85rem', borderRadius: '8px', color: 'var(--text-secondary)', fontWeight: 600 }}
                >
                  <Trophy size={16} />
                  <span>Events & Trainings</span>
                </Link>

                <Link
                  href={`/${club.slug}#news`}
                  onClick={() => setMobileMenuOpen(false)}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.65rem 0.85rem', borderRadius: '8px', color: 'var(--text-secondary)', fontWeight: 600 }}
                >
                  <Radio size={16} />
                  <span>Latest News & Video</span>
                </Link>

                {isAdmin && (
                  <Link
                    href={`/${club.slug}/admin`}
                    onClick={() => setMobileMenuOpen(false)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '0.65rem 0.85rem',
                      borderRadius: '8px',
                      color: '#10B981',
                      background: 'rgba(16, 185, 129, 0.1)',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                      fontWeight: 700,
                      marginTop: '0.5rem',
                    }}
                  >
                    <Settings size={16} />
                    <span>Club Admin Control Room</span>
                  </Link>
                )}
              </div>
            </div>

            {/* Mobile Auth Button */}
            <div style={{ paddingTop: '1rem', borderTop: '1px solid var(--border-subtle)' }}>
              {isAuthenticated && user ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    {user.avatar_url ? (
                      <img src={user.avatar_url} alt="" style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--club-primary)', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 800 }}>
                        {user.full_name.substring(0, 1)}
                      </div>
                    )}
                    <div>
                      <div style={{ fontSize: '0.85rem', color: '#FFFFFF', fontWeight: 700 }}>
                        {user.full_name}
                      </div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                        {userRole || 'Member'}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => { logout(); setMobileMenuOpen(false); }}
                    style={{ background: 'transparent', border: '1px solid var(--border-subtle)', color: '#EF4444', padding: '0.45rem 0.75rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
                  >
                    Sign Out
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => { setMobileMenuOpen(false); setAuthModalOpen(true); }}
                  className="btn btn-secondary"
                  style={{ width: '100%', justifyContent: 'center', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                >
                  <User size={16} />
                  <span>Sign In to itsfootball.club</span>
                </button>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />

      <style jsx>{`
        @media (min-width: 900px) {
          .desktop-nav {
            display: flex !important;
          }
          .mobile-trigger {
            display: none !important;
          }
        }
        @media (max-width: 480px) {
          .hide-on-mobile-xs {
            display: none !important;
          }
        }
      `}</style>
    </header>
  );
}

