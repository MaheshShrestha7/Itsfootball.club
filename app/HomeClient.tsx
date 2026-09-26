'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import PlatformNavbar from '@/components/PlatformNavbar';
import Footer from '@/components/Footer';
import AuthModal from '@/components/AuthModal';
import { useClub } from '@/lib/club-context';
import { useAuth } from '@/lib/auth-context';
import { sponsorHref } from '@/lib/sponsors';
import {
  Shield,
  Radio,
  CreditCard,
  Settings,
  Trophy,
  Users,
  QrCode,
  Sparkles,
  ExternalLink,
  Zap,
  Globe,
  User
} from 'lucide-react';

const SPONSOR_TIER_WEIGHT: Record<string, number> = { platinum: 0, gold: 1, silver: 2, bronze: 3, grassroots: 4 };

export default function PlatformHomePage() {
  const { clubs, sponsors } = useClub();
  const { user, isAuthenticated } = useAuth();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');

  // Every active sponsor across every club, paired with the club that carries them,
  // sorted so higher tiers surface first within the scrollable strip.
  const allSponsors = useMemo(() => {
    const clubById = new Map(clubs.map(c => [c.id, c]));
    return sponsors
      // Club-wide only - event-scoped sponsors show on their own event's page instead.
      .filter(s => s.is_active && !s.event_id)
      .map(s => ({ sponsor: s, club: clubById.get(s.club_id) }))
      .filter((entry): entry is { sponsor: typeof entry.sponsor; club: NonNullable<typeof entry.club> } => !!entry.club)
      .sort((a, b) => {
        const tierDiff = (SPONSOR_TIER_WEIGHT[a.sponsor.tier] ?? 99) - (SPONSOR_TIER_WEIGHT[b.sponsor.tier] ?? 99);
        if (tierDiff !== 0) return tierDiff;
        return a.sponsor.display_order - b.sponsor.display_order;
      });
  }, [clubs, sponsors]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <PlatformNavbar />

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
          <div className="hero-pillars" style={{
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
                  <img loading="lazy" decoding="async"
                    src={club.banner_url}
                    alt={`${club.name} banner`}
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
                    <img loading="lazy" decoding="async" width={48} height={48}
                      src={club.logo_url}
                      alt={`${club.name} crest`}
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
                      <div>Home Ground: <strong style={{ color: '#FFFFFF' }}>{club.stadium_name}</strong></div>
                      <div>Club Website: <code style={{ color: club.primary_color }}>{club.custom_domain || `itsfootball.club/${club.slug}`}</code></div>
                    </div>
                  </div>

                  {/* Actions Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
                    <Link href={`/${club.slug}`} className="btn btn-primary btn-sm">
                      Clubhouse
                    </Link>
                    <Link href={`/${club.slug}#fixtures`} className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
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

      {/* Club Sponsors Showcase (scrollable strip, aggregated across every club) */}
      {allSponsors.length > 0 && (
        <section style={{ padding: '4rem 0', background: 'rgba(255, 255, 255, 0.015)' }}>
          <div className="container">
            <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
              <span className="badge badge-gold" style={{ marginBottom: '0.75rem' }}>CLUB PARTNERS</span>
              <h2 style={{ fontSize: '2.25rem', fontWeight: 900, marginBottom: '0.75rem' }}>
                Trusted by Sponsors Across the Network
              </h2>
              <p style={{ color: 'var(--text-secondary)', maxWidth: '600px', margin: '0 auto' }}>
                Official partners backing the clubs on itsfootball.club, from kit sponsors to home ground naming rights.
              </p>
            </div>

            <div className="sponsor-scroll-strip">
              {allSponsors.map(({ sponsor, club }) => {
                const isPlatinum = sponsor.tier === 'platinum' || sponsor.size_scale === 'xl';
                const isGold = sponsor.tier === 'gold' || sponsor.size_scale === 'lg';
                return (
                  <a
                    key={sponsor.id}
                    href={sponsorHref(sponsor.website_url) || `/${club.slug}`}
                    target={sponsorHref(sponsor.website_url) ? '_blank' : undefined}
                    rel={sponsorHref(sponsor.website_url) ? 'noopener noreferrer' : undefined}
                    className="glass-panel glass-panel-interactive sponsor-scroll-card"
                    style={{
                      width: '220px',
                      padding: '1.5rem 1.25rem',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      textAlign: 'center',
                      gap: '0.75rem',
                      borderTop: isPlatinum ? '3px solid #F59E0B' : `3px solid ${club.primary_color}`,
                    }}
                  >
                    <img loading="lazy" decoding="async"
                      src={sponsor.logo_url}
                      alt={`${sponsor.name} logo`}
                      style={{
                        height: isPlatinum ? '56px' : isGold ? '46px' : '38px',
                        maxWidth: '100%',
                        objectFit: 'contain',
                      }}
                    />
                    <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#FFFFFF' }}>
                      {sponsor.name}
                    </div>
                    <span className="badge" style={{
                      fontSize: '0.7rem',
                      backgroundColor: isPlatinum ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255, 255, 255, 0.06)',
                      color: isPlatinum ? '#F59E0B' : 'var(--text-muted)',
                      textTransform: 'capitalize',
                    }}>
                      {sponsor.tier}
                    </span>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      marginTop: '0.25rem',
                      paddingTop: '0.6rem',
                      borderTop: '1px solid var(--border-subtle)',
                      width: '100%',
                      justifyContent: 'center',
                    }}>
                      <img loading="lazy" decoding="async" width={18} height={18}
                        src={club.logo_url}
                        alt={`${club.name} crest`}
                        style={{ width: '18px', height: '18px', borderRadius: '4px', objectFit: 'cover' }}
                      />
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{club.short_name}</span>
                    </div>
                  </a>
                );
              })}
            </div>
          </div>
        </section>
      )}

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
