'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import PlatformNavbar from '@/components/PlatformNavbar';
import Footer from '@/components/Footer';
import AuthModal from '@/components/AuthModal';
import { useClub } from '@/lib/club-context';
import { useAuth } from '@/lib/auth-context';
import {
  Shield,
  PlusCircle,
  Settings,
  ExternalLink,
  Radio,
  CreditCard,
  Users,
  MapPin,
  Trophy,
  ArrowRight,
  User,
  Lock,
} from 'lucide-react';

export default function MyClubsPage() {
  const { clubs, matches } = useClub();
  const { user, isAuthenticated, isLoading } = useAuth();
  const [authModalOpen, setAuthModalOpen] = useState(false);

  // Determine clubs owned by the active user
  const ownedClubs = useMemo(() => {
    if (!user) return [];
    return clubs.filter(c => {
      // 1. Direct owner_id assignment
      if (c.owner_id && c.owner_id === user.id) return true;
      // 2. Explicit role in user's club_roles
      if (user.club_roles?.[c.id] === 'owner') return true;
      return false;
    });
  }, [clubs, user]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <PlatformNavbar />

      <main className="container" style={{ padding: '3rem 1.5rem', flex: 1, maxWidth: '1200px' }}>
        {/* Loading state */}
        {isLoading ? (
          <div style={{ minHeight: '50vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', border: '3px solid rgba(16, 185, 129, 0.2)', borderTopColor: '#10B981', animation: 'spin 0.8s linear infinite' }} />
            <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Loading club portfolio...</div>
            <style jsx>{`
              @keyframes spin {
                to { transform: rotate(360deg); }
              }
            `}</style>
          </div>
        ) : !isAuthenticated || !user ? (
          /* Unauthenticated State */
          <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem 1rem' }}>
            <div
              className="glass-panel"
              style={{
                maxWidth: '520px',
                width: '100%',
                padding: '2.5rem',
                textAlign: 'center',
                border: '1px solid var(--border-medium)',
                borderRadius: 'var(--radius-xl)',
                background: 'var(--bg-surface-elevated)',
              }}
            >
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '20px',
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(37, 99, 235, 0.2))',
                border: '1px solid rgba(16, 185, 129, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1.5rem auto',
                color: '#10B981',
              }}>
                <Lock size={28} />
              </div>

              <h2 style={{ fontSize: '1.75rem', fontWeight: 900, marginBottom: '0.5rem', color: '#FFFFFF' }}>
                Sign In to View Your Clubs
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '2rem', lineHeight: 1.5 }}>
                Access the clubs you own, update matchday scoreboards, manage player registrations, and issue digital season passes.
              </p>

              <button
                type="button"
                onClick={() => setAuthModalOpen(true)}
                className="btn btn-primary btn-lg"
                style={{ width: '100%', justifyContent: 'center', display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0' }}
              >
                <User size={18} />
                <span>Sign In to Your Account</span>
              </button>

            </div>
          </div>
        ) : (
          /* Authenticated My Clubs Dashboard */
          <>
            {/* Header */}
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: '1.5rem',
              marginBottom: '2.5rem',
              borderBottom: '1px solid var(--border-subtle)',
              paddingBottom: '2rem',
            }}>
              <div>
                <div className="badge badge-primary" style={{ marginBottom: '0.5rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Shield size={14} /> CLUB MANAGEMENT CONSOLE
                </div>
                <h1 style={{ fontSize: 'clamp(2rem, 4vw, 2.5rem)', fontWeight: 900, color: '#FFFFFF', letterSpacing: '-0.02em', marginBottom: '0.4rem' }}>
                  Your Registered Clubs
                </h1>
                <p style={{ color: 'var(--text-secondary)', maxWidth: '650px', fontSize: '0.925rem' }}>
                  Welcome back, <strong>{user.full_name}</strong>. Command matchday reporting, manage member turnstile passes, and customize your official club websites.
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <Link href="/clubs" className="btn btn-secondary touch-target" style={{ minHeight: '44px' }}>
                  <Trophy size={16} /> <span>Browse Directory</span>
                </Link>
                <Link href="/create-club" className="btn btn-primary touch-target" style={{ minHeight: '44px' }}>
                  <PlusCircle size={16} /> <span>Launch New Club</span>
                </Link>
              </div>
            </div>

            {/* Tiled Grid of Owned Clubs */}
            {ownedClubs.length > 0 ? (
              <div className="grid-responsive-3" style={{ gap: '1.75rem' }}>
                {ownedClubs.map(club => {
                  const liveMatch = matches.find(m => m.club_id === club.id && m.status === 'live');

                  return (
                    <div
                      key={club.id}
                      className="glass-panel glass-panel-interactive"
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden',
                        borderTop: `4px solid ${club.primary_color}`,
                        borderRadius: 'var(--radius-lg)',
                        background: 'var(--bg-surface-elevated)',
                        position: 'relative',
                      }}
                    >
                      {/* Banner Header */}
                      <div style={{ height: '140px', position: 'relative', overflow: 'hidden' }}>
                        <img
                          src={club.banner_url}
                          alt={club.name}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                        <div style={{
                          position: 'absolute',
                          inset: 0,
                          background: 'linear-gradient(to top, rgba(14, 20, 30, 0.95), rgba(7, 10, 15, 0.2))',
                        }} />

                        {/* Owner Badge */}
                        <div style={{ position: 'absolute', top: '12px', left: '12px' }}>
                          <span className="badge badge-gold" style={{ fontSize: '0.7rem', padding: '0.2rem 0.6rem', fontWeight: 800 }}>
                            👑 OWNER
                          </span>
                        </div>

                        {/* Live Match Badge */}
                        {liveMatch && (
                          <div style={{ position: 'absolute', top: '12px', right: '12px' }}>
                            <span className="badge badge-live" style={{ fontSize: '0.7rem' }}>
                              <span className="pulse-dot" /> LIVE MATCH
                            </span>
                          </div>
                        )}

                        {/* Crest & Identity */}
                        <div style={{
                          position: 'absolute',
                          bottom: '12px',
                          left: '16px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.75rem',
                        }}>
                          <img
                            src={club.logo_url}
                            alt={club.name}
                            style={{
                              width: '48px',
                              height: '48px',
                              borderRadius: '12px',
                              border: `2px solid ${club.primary_color}`,
                              objectFit: 'cover',
                              background: '#070A0F',
                              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
                            }}
                          />
                          <div>
                            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#FFFFFF', lineHeight: 1.2 }}>
                              {club.name}
                            </h3>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              {club.short_name} • Founded {club.founded_year}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Card Body */}
                      <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'space-between' }}>
                        <div>
                          <div style={{ fontStyle: 'italic', fontSize: '0.825rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                            &ldquo;{club.motto}&rdquo;
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                              <MapPin size={14} color={club.primary_color} style={{ flexShrink: 0 }} />
                              <span style={{ color: '#E2E8F0' }}>{club.stadium_name}</span>
                              <span>({club.stadium_capacity.toLocaleString()} seats)</span>
                            </div>
                            <div>
                              Web Portal: <code style={{ color: club.primary_color }}>/{club.slug}</code>
                            </div>
                          </div>
                        </div>

                        {/* Primary Admin Control Room CTA */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                          <Link
                            href={`/${club.slug}/admin`}
                            className="btn btn-primary touch-target"
                            style={{
                              width: '100%',
                              justifyContent: 'center',
                              minHeight: '44px',
                              fontWeight: 800,
                              fontSize: '0.9rem',
                            }}
                          >
                            <Settings size={16} />
                            <span>Admin Control Room</span>
                          </Link>

                          {/* Secondary Fast Action Tiles */}
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                            <Link
                              href={`/${club.slug}`}
                              className="btn btn-secondary touch-target"
                              style={{ padding: '0.4rem 0.5rem', fontSize: '0.75rem', justifyContent: 'center', textAlign: 'center' }}
                              title="Public Clubhouse View"
                            >
                              <ExternalLink size={13} />
                              <span>Public</span>
                            </Link>
                            <Link
                              href={liveMatch ? `/${club.slug}/match/${liveMatch.id}` : `/${club.slug}/admin/match-center`}
                              className="btn btn-secondary touch-target"
                              style={{ padding: '0.4rem 0.5rem', fontSize: '0.75rem', justifyContent: 'center', textAlign: 'center' }}
                              title="Live Match Center"
                            >
                              <Radio size={13} color="#EF4444" />
                              <span>Match</span>
                            </Link>
                            <Link
                              href={`/${club.slug}/member`}
                              className="btn btn-secondary touch-target"
                              style={{ padding: '0.4rem 0.5rem', fontSize: '0.75rem', justifyContent: 'center', textAlign: 'center' }}
                              title="Member Passes"
                            >
                              <CreditCard size={13} color={club.primary_color} />
                              <span>Passes</span>
                            </Link>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* "+ Launch Another Club" Interactive Tile */}
                <div
                  className="glass-panel"
                  style={{
                    border: '2px dashed var(--border-medium)',
                    borderRadius: 'var(--radius-lg)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '2.5rem 1.5rem',
                    textAlign: 'center',
                    minHeight: '340px',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <div style={{
                    width: '60px',
                    height: '60px',
                    borderRadius: '50%',
                    background: 'rgba(16, 185, 129, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '1rem',
                    color: '#10B981',
                  }}>
                    <PlusCircle size={28} />
                  </div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#FFFFFF', marginBottom: '0.5rem' }}>
                    Launch Another Club
                  </h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.5rem', maxWidth: '260px' }}>
                    Configure a brand new club brand, team kit colours, squad roster, and match center.
                  </p>
                  <Link href="/create-club" className="btn btn-primary touch-target" style={{ minHeight: '44px' }}>
                    <PlusCircle size={16} /> <span>Create New Club</span>
                  </Link>
                </div>
              </div>
            ) : (
              /* Empty State When No Clubs Owned */
              <div
                className="glass-panel"
                style={{
                  padding: 'clamp(2rem, 5vw, 3.5rem)',
                  borderRadius: 'var(--radius-xl)',
                  textAlign: 'center',
                  maxWidth: '720px',
                  margin: '0 auto',
                  border: '1px solid var(--border-medium)',
                  background: 'var(--bg-surface-elevated)',
                }}
              >
                <div style={{
                  width: '72px',
                  height: '72px',
                  borderRadius: '24px',
                  background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(37, 99, 235, 0.2))',
                  border: '1px solid rgba(16, 185, 129, 0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 1.5rem auto',
                  color: '#10B981',
                  boxShadow: '0 0 24px rgba(16, 185, 129, 0.25)',
                }}>
                  <Shield size={32} />
                </div>

                <h2 style={{ fontSize: '1.85rem', fontWeight: 900, marginBottom: '0.75rem', color: '#FFFFFF' }}>
                  No Football Clubs Registered Yet
                </h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.6, maxWidth: '540px', margin: '0 auto 2rem auto' }}>
                  You haven&apos;t launched or claimed ownership of any football clubs on this account. Launch your official club website in minutes with our 4-step wizard.
                </p>

                <div style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '1rem',
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginBottom: '2.5rem',
                }}>
                  <Link href="/create-club" className="btn btn-primary btn-lg touch-target" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <PlusCircle size={20} />
                    <span>Launch Your First Club</span>
                  </Link>

                </div>

                {/* Highlight Features */}
                <div style={{
                  borderTop: '1px solid var(--border-subtle)',
                  paddingTop: '2rem',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: '1.25rem',
                  textAlign: 'left',
                }}>
                  <div>
                    <div style={{ fontWeight: 800, color: '#10B981', fontSize: '0.9rem', marginBottom: '0.25rem' }}>
                      ⚡ 60-Second Setup
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      Identity, crest, stadium, and team colours ready out of the box.
                    </div>
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, color: '#F59E0B', fontSize: '0.9rem', marginBottom: '0.25rem' }}>
                      📻 Pitchside Live Desk
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      Broadcast commentary, cards, and goal events live to supporters.
                    </div>
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, color: '#3B82F6', fontSize: '0.9rem', marginBottom: '0.25rem' }}>
                      🎟️ Digital Turnstiles
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      Issue matchday passes with real-time QR code turnstile check-in.
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        redirectTo="/my-clubs"
      />

      <Footer />
    </div>
  );
}
