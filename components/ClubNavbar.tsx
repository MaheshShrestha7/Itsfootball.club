'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Club } from '@/lib/supabase/types';
import { useClub } from '@/lib/club-context';
import { useAuth } from '@/lib/auth-context';
import AuthModal from '@/components/AuthModal';
import { Shield, Radio, CreditCard, Users, Calendar, Trophy, Settings, Menu, X, ArrowLeft, User, LogOut } from 'lucide-react';

interface ClubNavbarProps {
  club: Club;
}

export default function ClubNavbar({ club }: ClubNavbarProps) {
  const { matches } = useClub();
  const { user, isAuthenticated, logout, hasClubAdminAccess, getUserRoleForClub } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  const isAdmin = hasClubAdminAccess(club.id);
  const userRole = user ? getUserRoleForClub(club.id) : null;

  const [logoError, setLogoError] = useState(false);

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
      {/* Top micro-bar: Return to Platform */}
      <div style={{
        background: 'rgba(0, 0, 0, 0.45)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
        padding: '0.28rem 0',
        fontSize: '0.75rem',
      }}>
        <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Link href="/" style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.35rem', textDecoration: 'none' }}>
            <ArrowLeft size={12} />
            <span>itsfootball.club network</span>
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', color: 'var(--text-muted)' }}>
            {club.custom_domain && (
              <span style={{ color: 'var(--text-secondary)' }}>Domain: {club.custom_domain}</span>
            )}
            <span>Est. {club.founded_year}</span>
          </div>
        </div>
      </div>

      {/* Main Club Navigation */}
      <div className="container" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: '74px',
      }}>
        {/* Club Crest & Title */}
        <Link
          href={`/${club.slug}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.9rem',
            textDecoration: 'none',
            flexShrink: 0,
            maxWidth: '380px',
          }}
        >
          {/* Shield / Crest Container */}
          <div style={{
            width: '46px',
            height: '46px',
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', whiteSpace: 'nowrap' }}>
              <span style={{
                fontFamily: 'var(--font-heading)',
                fontSize: '1.2rem',
                fontWeight: 800,
                letterSpacing: '-0.02em',
                color: '#FFFFFF',
                whiteSpace: 'nowrap',
              }}>
                {club.name}
              </span>
              <span className="badge" style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: 'var(--text-secondary)', fontSize: '0.65rem', flexShrink: 0 }}>
                {club.short_name}
              </span>
            </div>
            {club.motto && (
              <div style={{
                fontSize: '0.725rem',
                color: 'var(--text-muted)',
                fontStyle: 'italic',
                marginTop: '1px',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: '260px',
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
            href={`/${club.slug}/match/${liveMatch ? liveMatch.id : 'match-live-01'}`}
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
          <Link href={`/${club.slug}#squad`} style={{ color: 'var(--text-secondary)', fontWeight: 500, fontSize: '0.9rem' }}>
            Squad
          </Link>
          <Link href={`/${club.slug}#events`} style={{ color: 'var(--text-secondary)', fontWeight: 500, fontSize: '0.9rem' }}>
            Events
          </Link>
          <Link href={`/${club.slug}#news`} style={{ color: 'var(--text-secondary)', fontWeight: 500, fontSize: '0.9rem' }}>
            News
          </Link>

          {/* Admin Portal Gateway - Only shown if authorized or with security badge */}
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
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#FFFFFF',
            cursor: 'pointer',
            padding: '0.5rem',
            display: 'block',
          }}
          aria-label="Toggle Menu"
          className="mobile-trigger"
        >
          {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div style={{
          background: 'var(--bg-surface-elevated)',
          borderBottom: '1px solid var(--border-medium)',
          padding: '1.25rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
        }}>
          <Link href={`/${club.slug}`} onClick={() => setMobileMenuOpen(false)} style={{ color: '#FFFFFF', fontWeight: 600 }}>
            Club Home
          </Link>
          <Link
            href={`/${club.slug}/match/${liveMatch ? liveMatch.id : 'match-live-01'}`}
            onClick={() => setMobileMenuOpen(false)}
            style={{ color: '#EF4444', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <Radio size={16} /> Live Match-Day Center
          </Link>
          <Link
            href={`/${club.slug}/member`}
            onClick={() => setMobileMenuOpen(false)}
            style={{ color: 'var(--club-primary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <CreditCard size={16} /> Digital Member Pass
          </Link>
          <Link href={`/${club.slug}#fixtures`} onClick={() => setMobileMenuOpen(false)} style={{ color: 'var(--text-secondary)' }}>
            Fixtures & Results
          </Link>
          <Link href={`/${club.slug}#squad`} onClick={() => setMobileMenuOpen(false)} style={{ color: 'var(--text-secondary)' }}>
            First Team Squad & Stats
          </Link>
          <Link href={`/${club.slug}#events`} onClick={() => setMobileMenuOpen(false)} style={{ color: 'var(--text-secondary)' }}>
            Club Events & Trainings
          </Link>
          <Link href={`/${club.slug}#news`} onClick={() => setMobileMenuOpen(false)} style={{ color: 'var(--text-secondary)' }}>
            Latest News & Media
          </Link>
          {isAdmin && (
            <Link
              href={`/${club.slug}/admin`}
              onClick={() => setMobileMenuOpen(false)}
              className="btn btn-primary btn-sm"
              style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <Settings size={15} /> Club Admin Portal
            </Link>
          )}

          {/* Mobile Auth Button */}
          {isAuthenticated && user ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '0.75rem', borderTop: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '0.85rem', color: '#FFFFFF', fontWeight: 600 }}>
                {user.full_name} ({userRole || 'Member'})
              </div>
              <button
                type="button"
                onClick={() => { logout(); setMobileMenuOpen(false); }}
                className="btn btn-secondary btn-sm"
                style={{ fontSize: '0.75rem' }}
              >
                Sign Out
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => { setMobileMenuOpen(false); setAuthModalOpen(true); }}
              className="btn btn-secondary btn-sm"
              style={{ marginTop: '0.5rem' }}
            >
              Sign In to itsfootball.club
            </button>
          )}
        </div>
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
      `}</style>
    </header>
  );
}
