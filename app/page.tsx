'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import PlatformNavbar from '@/components/PlatformNavbar';
import Footer from '@/components/Footer';
import AuthModal from '@/components/AuthModal';
import { useClub } from '@/lib/club-context';
import { useAuth } from '@/lib/auth-context';
import {
  Shield,
  Radio,
  CreditCard,
  Settings,
  Trophy,
  Users,
  QrCode,
  Sparkles,
  ArrowRight,
  CheckCircle,
  ExternalLink,
  Zap,
  Globe,
  User
} from 'lucide-react';

export default function PlatformHomePage() {
  const { clubs, matches } = useClub();
  const { user, isAuthenticated } = useAuth();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');

  const featuredClub = clubs[0];
  const liveMatches = matches.filter(m => m.status === 'live');
  const liveMatchClub = liveMatches[0] ? (clubs.find(c => c.id === liveMatches[0].club_id) || featuredClub) : null;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <PlatformNavbar />

      {/* Live Platform Ticker */}
      {liveMatches.length > 0 && (
        <div style={{
          background: 'linear-gradient(90deg, rgba(239, 68, 68, 0.2), rgba(16, 185, 129, 0.2))',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          padding: '0.5rem 0',
          fontSize: '0.8rem',
        }}>
          <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span className="badge badge-live">
                <span className="pulse-dot" /> LIVE MATCH DAY
              </span>
              <span>
                <strong>{liveMatches[0].home_team_name}</strong> {liveMatches[0].home_score} - {liveMatches[0].away_score} <strong>{liveMatches[0].away_team_name}</strong> ({liveMatches[0].current_minute}&apos;)
              </span>
            </div>
            <Link
              href={`/${liveMatchClub?.slug || featuredClub?.slug || 'clubs'}/match/${liveMatches[0].id}`}
              style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#EF4444', fontWeight: 700 }}
            >
              <span>Watch Live Center</span>
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      )}

      {/* Hero Section */}
      <section style={{
        padding: '5.5rem 0 4rem 0',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div className="container" style={{ textAlign: 'center', maxWidth: '940px' }}>
          <div className="badge badge-primary" style={{ marginBottom: '1.25rem', padding: '0.35rem 0.9rem' }}>
            <Trophy size={14} /> The All-In-One Digital Platform for Football Clubs
          </div>

          <h1 style={{
            fontSize: 'clamp(2.5rem, 5.5vw, 4.2rem)',
            fontWeight: 900,
            lineHeight: 1.08,
            letterSpacing: '-0.03em',
            marginBottom: '1.5rem',
            background: 'linear-gradient(135deg, #FFFFFF 30%, #94A3B8 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            Every Football Club Deserves a <span style={{ color: '#10B981', WebkitTextFillColor: '#10B981' }}>Stadium-Grade</span> Digital Experience.
          </h1>

          <p style={{
            fontSize: 'clamp(1rem, 2vw, 1.25rem)',
            color: 'var(--text-secondary)',
            lineHeight: 1.6,
            marginBottom: '2.5rem',
            maxWidth: '780px',
            marginLeft: 'auto',
            marginRight: 'auto',
          }}>
            Launch your official club website in minutes. Empower your club with pitchside live match reporting, official digital member passes with turnstile QR entry, complete squad &amp; fixture management, and your own dedicated club web address.
          </p>

          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            marginBottom: '4rem',
          }}>
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '1rem',
            }}>
              {isAuthenticated && user ? (
                <>
                  <Link href="/my-clubs" className="btn btn-primary btn-lg" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <Shield size={20} />
                    <span>Go to My Clubs ({user.full_name.split(' ')[0]})</span>
                  </Link>

                  <Link href="/create-club" className="btn btn-secondary btn-lg" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <Zap size={18} />
                    <span>Launch Another Club</span>
                  </Link>

                  <Link
                    href={`/${featuredClub?.slug || 'clubs'}`}
                    className="btn btn-secondary btn-lg"
                    style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}
                  >
                    <span>Tour {featuredClub?.name || 'Featured Club'}</span>
                    <ArrowRight size={18} />
                  </Link>
                </>
              ) : (
                <>
                  <Link href="/create-club" className="btn btn-primary btn-lg" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <Zap size={20} />
                    <span>Create Your Club</span>
                  </Link>

                  <button
                    type="button"
                    onClick={() => { setAuthMode('login'); setAuthModalOpen(true); }}
                    className="btn btn-secondary btn-lg"
                    style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}
                  >
                    <User size={18} />
                    <span>Sign In to Your Club</span>
                  </button>

                  <Link
                    href={`/${featuredClub?.slug || 'clubs'}`}
                    className="btn btn-secondary btn-lg"
                    style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}
                  >
                    <span>Tour {featuredClub?.name || 'Featured Club'}</span>
                    <ArrowRight size={18} />
                  </Link>
                </>
              )}
            </div>

            {!isAuthenticated && (
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '1rem' }}>
                Already manage a club?{' '}
                <button
                  type="button"
                  onClick={() => { setAuthMode('login'); setAuthModalOpen(true); }}
                  style={{ background: 'none', border: 'none', color: '#10B981', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
                >
                  Sign in
                </button>
                {' '}or{' '}
                <button
                  type="button"
                  onClick={() => { setAuthMode('signup'); setAuthModalOpen(true); }}
                  style={{ background: 'none', border: 'none', color: '#10B981', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
                >
                  register an account
                </button>
                {' '}to open your club dashboard.
              </div>
            )}
          </div>

          {/* Quick Pillar Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1.25rem',
            textAlign: 'left',
          }}>
            <div className="glass-panel" style={{ padding: '1.25rem' }}>
              <div style={{ color: '#10B981', marginBottom: '0.6rem' }}><Radio size={24} /></div>
              <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.3rem' }}>Live Match Center</h4>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Whistle-to-whistle clock, live scores, goal scorers, cards, and tactical line-ups.</p>
            </div>

            <div className="glass-panel" style={{ padding: '1.25rem' }}>
              <div style={{ color: '#F59E0B', marginBottom: '0.6rem' }}><CreditCard size={24} /></div>
              <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.3rem' }}>Digital Member Pass</h4>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Official club digital pass card with matchday QR credentials for players, staff, and supporters.</p>
            </div>

            <div className="glass-panel" style={{ padding: '1.25rem' }}>
              <div style={{ color: '#3B82F6', marginBottom: '0.6rem' }}><QrCode size={24} /></div>
              <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.3rem' }}>Turnstile &amp; Gate Entry</h4>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Instant camera scan at the ground gates for squad arrivals, club events, and matchday turnstiles.</p>
            </div>

            <div className="glass-panel" style={{ padding: '1.25rem' }}>
              <div style={{ color: '#A855F7', marginBottom: '0.6rem' }}><Globe size={24} /></div>
              <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.3rem' }}>Dedicated Club Site</h4>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Your club&apos;s own official web address proudly flying your team colours, crest, and sponsors.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Football Clubs Showcase */}
      <section style={{ padding: '4rem 0', background: 'rgba(255, 255, 255, 0.015)' }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
            <span className="badge badge-gold" style={{ marginBottom: '0.75rem' }}>CLUBS IN THE LEAGUE</span>
            <h2 style={{ fontSize: '2.25rem', fontWeight: 900, marginBottom: '0.75rem' }}>
              Explore Featured Football Clubs
            </h2>
            <p style={{ color: 'var(--text-secondary)', maxWidth: '600px', margin: '0 auto' }}>
              Every club commands its own matchday hub with team kit colours, squad line-ups, live match center, and official member passes.
            </p>
          </div>

          <div className="grid-responsive-3" style={{ gap: '2rem' }}>
            {clubs.map(club => (
              <div
                key={club.id}
                className="glass-panel glass-panel-interactive"
                style={{
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  borderTop: `4px solid ${club.primary_color}`,
                }}
              >
                {/* Banner */}
                <div style={{ height: '140px', position: 'relative', overflow: 'hidden' }}>
                  <img
                    src={club.banner_url}
                    alt={club.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                  <div style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'linear-gradient(to top, rgba(14, 20, 30, 0.95), transparent)',
                  }} />
                  <div style={{
                    position: 'absolute',
                    bottom: '1rem',
                    left: '1.25rem',
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
                        background: '#000',
                      }}
                    />
                    <div>
                      <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#FFFFFF' }}>{club.name}</h3>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{club.short_name} • Est. {club.founded_year}</span>
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontStyle: 'italic', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                      &ldquo;{club.motto}&rdquo;
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
                      <div>Stadium: <strong style={{ color: '#FFFFFF' }}>{club.stadium_name}</strong></div>
                      <div>Capacity: <strong style={{ color: '#FFFFFF' }}>{club.stadium_capacity.toLocaleString()} seats</strong></div>
                      <div>Club Website: <code style={{ color: club.primary_color }}>{club.custom_domain || `${club.slug}.itsfootball.club`}</code></div>
                    </div>
                  </div>

                  {/* Actions Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
                    <Link href={`/${club.slug}`} className="btn btn-primary btn-sm">
                      Clubhouse
                    </Link>
                    <Link href={`/${club.slug}/match/match-live-01`} className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <Radio size={14} color="#EF4444" /> Match Center
                    </Link>
                    <Link href={`/${club.slug}/member`} className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <CreditCard size={14} color={club.primary_color} /> Member Pass
                    </Link>
                    <Link href={`/${club.slug}#squad`} className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <Users size={14} /> Squad Roster
                    </Link>
                  </div>
                </div>
              </div>
            ))}

            {/* "Create Your Own Club" CTA Card */}
            <div
              className="glass-panel"
              style={{
                border: '2px dashed var(--border-medium)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '2.5rem 1.5rem',
                textAlign: 'center',
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
                <Zap size={28} />
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '0.5rem' }}>Your Football Club</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.5rem', maxWidth: '280px' }}>
                Create your team crest, configure kit colours, register your squad roster, and broadcast matches live to supporters.
              </p>
              <Link href="/create-club" className="btn btn-primary">
                Register Your Club
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Matchday Operations & Standards Showcase */}
      <section style={{ padding: '5rem 0' }}>
        <div className="container">
          <div className="glass-panel" style={{ padding: '3rem 2.5rem', background: 'linear-gradient(135deg, rgba(14, 20, 30, 0.9), rgba(7, 10, 15, 0.95))' }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: '2.5rem',
              alignItems: 'center',
            }}>
              <div>
                <span className="badge badge-primary" style={{ marginBottom: '1rem' }}>MATCHDAY INTEGRITY &amp; CLUB OPERATIONS</span>
                <h2 style={{ fontSize: '2rem', fontWeight: 900, lineHeight: 1.2, marginBottom: '1rem' }}>
                  Built for Matchday Reliability &amp; Total Club Privacy
                </h2>
                <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '1.5rem', fontSize: '0.925rem' }}>
                  Whether you run a community grassroots squad or a championship-tier club, your squad data, matchday commentary, and member credentials are kept private, secure, and ready for action.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <CheckCircle size={18} color="#10B981" style={{ flexShrink: 0 }} />
                    <span style={{ fontSize: '0.9rem', color: '#FFFFFF' }}>Private Squad &amp; Committee Records — Your club data remains strictly in your hands</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <CheckCircle size={18} color="#10B981" style={{ flexShrink: 0 }} />
                    <span style={{ fontSize: '0.9rem', color: '#FFFFFF' }}>Matchday Photo &amp; Media Gallery — Crystal-clear team photos, match highlights &amp; sponsors</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <CheckCircle size={18} color="#10B981" style={{ flexShrink: 0 }} />
                    <span style={{ fontSize: '0.9rem', color: '#FFFFFF' }}>Turnstile QR Verification — Fast matchday entry for players, staff, and season ticket holders</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <CheckCircle size={18} color="#10B981" style={{ flexShrink: 0 }} />
                    <span style={{ fontSize: '0.9rem', color: '#FFFFFF' }}>Official Team Crest &amp; Kit Palette — Automatic club colour styling across your website</span>
                  </div>
                </div>
              </div>

              {/* Matchday Control Desk Card */}
              <div style={{
                background: '#040609',
                borderRadius: 'var(--radius-lg)',
                padding: '1.5rem',
                border: '1px solid var(--border-subtle)',
                boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.8), 0 20px 40px rgba(0,0,0,0.5)',
              }}>
                {/* Window Header */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '1.25rem',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                  paddingBottom: '0.75rem',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10B981', boxShadow: '0 0 8px #10B981' }} />
                    <span style={{ fontSize: '0.75rem', fontWeight: 800, letterSpacing: '0.05em', color: '#F8FAFC' }}>
                      MATCHDAY CONTROL DESK
                    </span>
                  </div>
                  <span className="badge badge-live" style={{ fontSize: '0.65rem', padding: '0.2rem 0.5rem' }}>
                    PITCHSIDE LIVE
                  </span>
                </div>

                {/* Fixture Banner */}
                <div style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  borderRadius: '8px',
                  padding: '0.75rem 1rem',
                  marginBottom: '1rem',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}>
                  <div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>League Match • Live Action</div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#FFFFFF', marginTop: '0.15rem' }}>Apex City FC <span style={{ color: '#10B981' }}>2 - 1</span> Metro Rovers</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span className="badge badge-gold" style={{ fontSize: '0.7rem' }}>71&apos; SECOND HALF</span>
                  </div>
                </div>

                {/* Matchday Protocol Items */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1.2rem' }}>
                  <div style={{
                    background: 'rgba(16, 185, 129, 0.05)',
                    border: '1px solid rgba(16, 185, 129, 0.2)',
                    borderRadius: '6px',
                    padding: '0.6rem 0.8rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Radio size={14} color="#10B981" />
                      <span style={{ fontSize: '0.8rem', color: '#E2E8F0', fontWeight: 600 }}>Pitchside Commentary</span>
                    </div>
                    <span style={{ fontSize: '0.7rem', color: '#10B981', fontWeight: 700 }}>Active Broadcast</span>
                  </div>

                  <div style={{
                    background: 'rgba(59, 130, 246, 0.05)',
                    border: '1px solid rgba(59, 130, 246, 0.2)',
                    borderRadius: '6px',
                    padding: '0.6rem 0.8rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <QrCode size={14} color="#3B82F6" />
                      <span style={{ fontSize: '0.8rem', color: '#E2E8F0', fontWeight: 600 }}>Turnstiles &amp; Gates</span>
                    </div>
                    <span style={{ fontSize: '0.7rem', color: '#3B82F6', fontWeight: 700 }}>Passes Verified</span>
                  </div>

                  <div style={{
                    background: 'rgba(245, 158, 11, 0.05)',
                    border: '1px solid rgba(245, 158, 11, 0.2)',
                    borderRadius: '6px',
                    padding: '0.6rem 0.8rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Shield size={14} color="#F59E0B" />
                      <span style={{ fontSize: '0.8rem', color: '#E2E8F0', fontWeight: 600 }}>Club Committee &amp; Squad Sheet</span>
                    </div>
                    <span style={{ fontSize: '0.7rem', color: '#F59E0B', fontWeight: 700 }}>Official Roster</span>
                  </div>
                </div>

                {/* Live Matchday Checks */}
                <div style={{
                  borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                  paddingTop: '0.75rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.35rem',
                  fontSize: '0.75rem',
                }}>
                  <div style={{ color: '#10B981', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span>✓</span> Pitchside match clock synced to stadium timer
                  </div>
                  <div style={{ color: '#10B981', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span>✓</span> Matchday event cards &amp; goals broadcast to supporters
                  </div>
                  <div style={{ color: '#10B981', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span>✓</span> Club registry and team line-up confirmed
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        defaultMode={authMode}
        redirectTo="/my-clubs"
      />

      <Footer />
    </div>
  );
}
