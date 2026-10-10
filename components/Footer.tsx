'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Club, Sponsor } from '@/lib/supabase/types';
import { useClub } from '@/lib/club-context';
import { useAuth } from '@/lib/auth-context';
import { Shield, MapPin, Mail, Phone, Heart } from 'lucide-react';
import SponsorTrackedLink from './SponsorTrackedLink';
import { BrandIcon, BrandWordmark } from './BrandLogo';
import { sponsorTierLabel } from '@/lib/sponsors';
import { SOCIAL_PROFILES } from '@/lib/seo';

interface FooterProps {
  club?: Club | null;
  sponsors?: Sponsor[];
}

// Official logos from Simple Icons (CC0), keyed by SOCIAL_PROFILES name. TikTok's brand colour is black/white,
// so it takes the theme's text colour on hover.
const SOCIAL_ICONS: Record<string, { path: string; color: string }> = {
  Facebook: {
    color: '#0866FF',
    path: 'M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z',
  },
  TikTok: {
    color: 'var(--text-primary)',
    path: 'M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z',
  },
};

/** "Community strength through sports" -> "Community strength through sports." */
const sentence = (text: string | null | undefined) => {
  const t = (text || '').trim();
  return t && !/[.!?…]$/.test(t) ? `${t}.` : t;
};

export default function Footer({ club, sponsors }: FooterProps) {
  const { clubs } = useClub();
  const [crestFailed, setCrestFailed] = useState(false);
  useEffect(() => setCrestFailed(false), [club?.logo_url]);
  const fallbackSlug = clubs[0]?.slug || 'clubs';
  // Admin links only for people who can actually open the admin area (same rule as AdminGuard)
  const { user, hasClubAdminAccess } = useAuth();
  const isClubAdmin = !!club && !!user && (hasClubAdminAccess(club.id) || (!!club.owner_id && club.owner_id === user.id));
  return (
    <footer style={{
      background: 'rgba(var(--dk-4-6-9), 0.95)',
      borderTop: '1px solid var(--border-subtle)',
      marginTop: '5rem',
      position: 'relative',
      zIndex: 10,
    }}>
      {/* Optional Sponsor Marquee Bar if Club sponsors exist */}
      {sponsors && sponsors.length > 0 && (
        <div style={{
          borderBottom: '1px solid var(--border-subtle)',
          padding: '1.5rem 0',
          background: 'rgba(var(--tint-rgb), 0.015)',
        }}>
          <div className="container">
            <div style={{
              fontSize: '0.75rem',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              color: 'var(--text-muted)',
              textAlign: 'center',
              marginBottom: '1rem',
              fontWeight: 700,
            }}>
              Official Club Partners & Sponsors
            </div>
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '2.5rem',
            }}>
              {sponsors.map(sponsor => {
                const isPlatinum = sponsor.tier === 'platinum' || sponsor.size_scale === 'xl';
                const isGold = sponsor.tier === 'gold' || sponsor.size_scale === 'lg';
                return (
                  <SponsorTrackedLink
                    key={sponsor.id}
                    clubId={sponsor.club_id}
                    sponsorId={sponsor.id}
                    placement="footer_marquee"
                    href={sponsor.website_url || '#'}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: isPlatinum ? '0.9rem' : '0.65rem',
                      opacity: isPlatinum ? 0.95 : 0.75,
                      padding: isPlatinum ? '0.6rem 1rem' : '0.4rem 0.6rem',
                      background: isPlatinum ? 'rgba(245, 158, 11, 0.08)' : 'transparent',
                      border: isPlatinum ? '1px solid rgba(245, 158, 11, 0.25)' : '1px solid transparent',
                      borderRadius: '10px',
                      maxWidth: '100%',
                      flexWrap: 'wrap',
                      justifyContent: 'center',
                      transition: 'opacity 0.2s, transform 0.2s, border-color 0.2s',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.opacity = '1';
                      e.currentTarget.style.transform = 'scale(1.05)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.opacity = isPlatinum ? '0.95' : '0.75';
                      e.currentTarget.style.transform = 'scale(1)';
                    }}
                  >
                    <img loading="lazy" decoding="async"
                      src={sponsor.logo_url}
                      alt={`${sponsor.name} logo`}
                      draggable={false}
                      style={{
                        height: isPlatinum ? '68px' : isGold ? '54px' : '42px',
                        maxWidth: isPlatinum ? 'min(240px, 70vw)' : isGold ? 'min(190px, 60vw)' : 'min(150px, 50vw)',
                        objectFit: 'contain',
                        borderRadius: '4px',
                      }}
                    />
                    <span style={{
                      fontSize: isPlatinum ? '1rem' : '0.9rem',
                      fontWeight: isPlatinum ? 800 : 600,
                      color: isPlatinum ? 'var(--text-primary)' : 'var(--text-secondary)'
                    }}>
                      {sponsor.name}
                    </span>
                    <span className="badge" style={{
                      fontSize: '0.7rem',
                      backgroundColor: isPlatinum ? 'rgba(245, 158, 11, 0.2)' : 'rgba(var(--tint-rgb), 0.05)',
                      color: isPlatinum ? 'var(--c-amber)' : 'var(--text-muted)'
                    }}>
                      {sponsorTierLabel(sponsor.tier)}
                    </span>
                  </SponsorTrackedLink>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Main Footer Content */}
      <div className="container" style={{ padding: '3.5rem 1.5rem 2.5rem 1.5rem' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))',
          gap: '2.5rem',
          marginBottom: '3rem',
        }}>
          {/* Col 1: Club Info / Platform Info */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem' }}>
              {club?.logo_url && !crestFailed ? (
                <img
                  src={club.logo_url}
                  alt={`${club.name} crest`}
                  width={48}
                  height={48}
                  loading="lazy"
                  decoding="async"
                  onError={() => setCrestFailed(true)}
                  style={{ width: '48px', height: '48px', objectFit: 'contain', flexShrink: 0 }}
                />
              ) : club ? (
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: club.primary_color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <Shield size={18} color="var(--text-primary)" />
                </div>
              ) : (
                <BrandWordmark height={44} />
              )}
              {club && (
                <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '1.2rem' }}>
                  {club.name}
                </span>
              )}
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', lineHeight: 1.6, marginBottom: '1.2rem' }}>
              {club
                ? `${sentence(club.motto) || 'Dedicated to the beautiful game.'} Home matches played at ${club.stadium_name}.`
                : 'The free platform for grassroots football clubs: club websites, live match centres, digital member passes and club shops.'}
            </p>
            {!club && (
              <div className="row" style={{ gap: '0.6rem' }}>
                {SOCIAL_PROFILES.map(p => (
                  <a
                    key={p.url}
                    href={p.url}
                    target="_blank"
                    rel="noopener noreferrer me"
                    aria-label={`itsfootball.club on ${p.name} (opens in a new tab)`}
                    title={p.name}
                    className="social-icon-link"
                    style={{ '--brand': SOCIAL_ICONS[p.name]?.color } as React.CSSProperties}
                  >
                    <svg viewBox="0 0 24 24" width={18} height={18} fill="currentColor" aria-hidden="true">
                      <path d={SOCIAL_ICONS[p.name]?.path} />
                    </svg>
                  </a>
                ))}
              </div>
            )}
            {club && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
                <span className="row">
                  <MapPin size={14} color="var(--club-primary)" /> {club.stadium_name}
                </span>
                {club.contact_email && (
                  <span className="row">
                    <Mail size={14} color="var(--club-primary)" /> {club.contact_email}
                  </span>
                )}
                {club.contact_phone && (
                  <span className="row">
                    <Phone size={14} color="var(--club-primary)" /> {club.contact_phone}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Col 2: Match-Day & Team */}
          <div>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--text-primary)' }}>
              Matchday &amp; Team
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.875rem' }}>
              {club ? (
                <>
                  <Link href={`/${club.slug}#fixtures`} style={{ color: 'var(--text-secondary)' }}>Live Match Center</Link>
                  <Link href={`/${club.slug}#fixtures`} style={{ color: 'var(--text-secondary)' }}>Fixtures &amp; Results</Link>
                  <Link href={`/${club.slug}#squad`} style={{ color: 'var(--text-secondary)' }}>First Team Squad</Link>
                  <Link href={`/${club.slug}#leaderboard`} style={{ color: 'var(--text-secondary)' }}>Player Leaderboards</Link>
                  <Link href={`/${club.slug}/member`} style={{ color: 'var(--text-secondary)' }}>Virtual Member Pass</Link>
                </>
              ) : (
                <>
                  <Link href="/clubs" style={{ color: 'var(--text-secondary)' }}>Explore Clubs</Link>
                  <Link href="/create-club" style={{ color: 'var(--text-secondary)' }}>Launch a New Club</Link>
                  <Link href={`/${fallbackSlug}#fixtures`} style={{ color: 'var(--text-secondary)' }}>Live Match Center</Link>
                  <Link href={`/${fallbackSlug}/member`} style={{ color: 'var(--text-secondary)' }}>Digital Pass Showcase</Link>
                </>
              )}
            </div>
          </div>

          {/* Col 3: Club Management */}
          <div>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--text-primary)' }}>
              Club Portal
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.875rem' }}>
              {club ? (
                <>
                  {isClubAdmin && (
                    <>
                      <Link href={`/${club.slug}/admin`} style={{ color: 'var(--text-secondary)' }}>Admin Dashboard</Link>
                      <Link href={`/${club.slug}/admin/branding`} style={{ color: 'var(--text-secondary)' }}>Branding &amp; Domain</Link>
                      <Link href={`/${club.slug}/admin/match-center`} style={{ color: 'var(--text-secondary)' }}>Match Controller</Link>
                      <Link href={`/${club.slug}/admin/scanner`} style={{ color: 'var(--text-secondary)' }}>QR Pass &amp; Event Scanner</Link>
                    </>
                  )}
                  <Link href={`/${club.slug}/member`} style={{ color: 'var(--text-secondary)' }}>Member Portal</Link>
                  <Link href={`/${club.slug}/verify`} style={{ color: 'var(--text-secondary)' }}>Pass Verification Portal</Link>
                  <Link href="/faq" style={{ color: 'var(--text-secondary)' }}>FAQ</Link>
                </>
              ) : (
                <>
                  <Link href="/clubs" style={{ color: 'var(--text-secondary)' }}>Clubs Directory</Link>
                  <Link href="/my-clubs" style={{ color: 'var(--text-secondary)' }}>My Clubs</Link>
                  <Link href="/create-club" style={{ color: 'var(--text-secondary)' }}>Register New Club</Link>
                  <Link href="/faq" style={{ color: 'var(--text-secondary)' }}>FAQ</Link>
                </>
              )}
            </div>
          </div>

          {/* Col 4: Matchday & Club Standards */}
          <div>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--text-primary)' }}>
              Matchday Standards &amp; Trust
            </h4>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.825rem', lineHeight: 1.6, marginBottom: '0.8rem' }}>
              Engineered to professional league standards with protected squad records, instant pitchside updates, and encrypted matchday passes.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
              <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--c-green)' }}>Protected Squad Data</span>
              <span className="badge" style={{ background: 'rgba(37, 99, 235, 0.1)', color: 'var(--c-blue)' }}>Match Media Hub</span>
              <span className="badge" style={{ background: 'rgba(245, 158, 11, 0.1)', color: 'var(--c-amber)' }}>Dedicated Club Sites</span>
              <span className="badge" style={{ background: 'rgba(168, 85, 247, 0.1)', color: 'var(--c-purple)' }}>Verified Turnstiles</span>
            </div>
          </div>
        </div>

        {/* Bottom copyright */}
        <div style={{
          borderTop: '1px solid var(--border-subtle)',
          paddingTop: '1.5rem',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          fontSize: '0.8rem',
          color: 'var(--text-muted)',
        }}>
          <div className="row" style={{ gap: '0.4rem 1rem', flexWrap: 'wrap' }}>
            <span>&copy; {new Date().getFullYear()} {club ? club.name : 'itsfootball.club'}. All rights reserved.</span>
            <Link href="/privacy" style={{ color: 'var(--text-muted)' }}>Privacy</Link>
            <Link href="/terms" style={{ color: 'var(--text-muted)' }}>Terms</Link>
          </div>
          <div className="row row-tight">
            <span>Powered by</span>
            <Link href="/" style={{ color: 'var(--text-secondary)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
              <BrandIcon height={12} decorative />
              itsfootball.club
            </Link>
            <Heart size={13} color="var(--c-red)" fill="#EF4444" />
          </div>
        </div>
      </div>
    </footer>
  );
}
