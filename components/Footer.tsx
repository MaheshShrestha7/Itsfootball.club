'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Club, Sponsor } from '@/lib/supabase/types';
import { useClub } from '@/lib/club-context';
import { useAuth } from '@/lib/auth-context';
import { Shield, MapPin, Mail, Phone, Heart } from 'lucide-react';
import SponsorTrackedLink from './SponsorTrackedLink';
import SponsorLogo from './SponsorLogo';
import { BrandIcon, BrandWordmark } from './BrandLogo';
import { sponsorTierLabel } from '@/lib/sponsors';
import { SITE_URL, SOCIAL_PROFILES } from '@/lib/seo';

interface FooterProps {
  club?: Club | null;
  sponsors?: Sponsor[];
  /** Admin pages: just the copyright and legal links, without the public sponsors block and site links */
  compact?: boolean;
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
  Instagram: {
    color: '#E4405F',
    path: 'M7.0301.084c-1.2768.0602-2.1487.264-2.911.5634-.7888.3075-1.4575.72-2.1228 1.3877-.6652.6677-1.075 1.3368-1.3802 2.127-.2954.7638-.4956 1.6365-.552 2.914-.0564 1.2775-.0689 1.6882-.0626 4.947.0062 3.2586.0206 3.6671.0825 4.9473.061 1.2765.264 2.1482.5635 2.9107.308.7889.72 1.4573 1.388 2.1228.6679.6655 1.3365 1.0743 2.1285 1.38.7632.295 1.6361.4961 2.9134.552 1.2773.056 1.6884.069 4.9462.0627 3.2578-.0062 3.668-.0207 4.9478-.0814 1.28-.0607 2.147-.2652 2.9098-.5633.7889-.3086 1.4578-.72 2.1228-1.3881.665-.6682 1.0745-1.3378 1.3795-2.1284.2957-.7632.4966-1.636.552-2.9124.056-1.2809.0692-1.6898.063-4.948-.0063-3.2583-.021-3.6668-.0817-4.9465-.0607-1.2797-.264-2.1487-.5633-2.9117-.3084-.7889-.72-1.4568-1.3876-2.1228C21.2982 1.33 20.628.9208 19.8378.6165 19.074.321 18.2017.1197 16.9244.0645 15.6471.0093 15.236-.005 11.977.0014 8.718.0076 8.31.0215 7.0301.0839m.1402 21.6932c-1.17-.0509-1.8053-.2453-2.2287-.408-.5606-.216-.96-.4771-1.3819-.895-.422-.4178-.6811-.8186-.9-1.378-.1644-.4234-.3624-1.058-.4171-2.228-.0595-1.2645-.072-1.6442-.079-4.848-.007-3.2037.0053-3.583.0607-4.848.05-1.169.2456-1.805.408-2.2282.216-.5613.4762-.96.895-1.3816.4188-.4217.8184-.6814 1.3783-.9003.423-.1651 1.0575-.3614 2.227-.4171 1.2655-.06 1.6447-.072 4.848-.079 3.2033-.007 3.5835.005 4.8495.0608 1.169.0508 1.8053.2445 2.228.408.5608.216.96.4754 1.3816.895.4217.4194.6816.8176.9005 1.3787.1653.4217.3617 1.056.4169 2.2263.0602 1.2655.0739 1.645.0796 4.848.0058 3.203-.0055 3.5834-.061 4.848-.051 1.17-.245 1.8055-.408 2.2294-.216.5604-.4763.96-.8954 1.3814-.419.4215-.8181.6811-1.3783.9-.4224.1649-1.0577.3617-2.2262.4174-1.2656.0595-1.6448.072-4.8493.079-3.2045.007-3.5825-.006-4.848-.0608M16.953 5.5864A1.44 1.44 0 1 0 18.39 4.144a1.44 1.44 0 0 0-1.437 1.4424M5.8385 12.012c.0067 3.4032 2.7706 6.1557 6.173 6.1493 3.4026-.0065 6.157-2.7701 6.1506-6.1733-.0065-3.4032-2.771-6.1565-6.174-6.1498-3.403.0067-6.156 2.771-6.1496 6.1738M8 12.0077a4 4 0 1 1 4.008 3.9921A3.9996 3.9996 0 0 1 8 12.0077',
  },
  YouTube: {
    color: '#FF0000',
    path: 'M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z',
  },
  LinkedIn: {
    color: '#0A66C2',
    path: 'M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z',
  },
  Crunchbase: {
    color: '#0288D1',
    path: 'M21.6 0H2.4A2.41 2.41 0 0 0 0 2.4v19.2A2.41 2.41 0 0 0 2.4 24h19.2a2.41 2.41 0 0 0 2.4-2.4V2.4A2.41 2.41 0 0 0 21.6 0zM7.045 14.465A2.11 2.11 0 0 0 9.84 13.42h1.66a3.69 3.69 0 1 1 0-1.75H9.84a2.11 2.11 0 1 0-2.795 2.795zm11.345.845a3.55 3.55 0 0 1-1.06.63 3.68 3.68 0 0 1-3.39-.38v.38h-1.51V5.37h1.5v4.11a3.74 3.74 0 0 1 1.8-.63H16a3.67 3.67 0 0 1 2.39 6.46zm-.223-2.766a2.104 2.104 0 1 1-4.207 0 2.104 2.104 0 0 1 4.207 0z',
  },
};

/** "Community strength through sports" -> "Community strength through sports." */
const sentence = (text: string | null | undefined) => {
  const t = (text || '').trim();
  return t && !/[.!?…]$/.test(t) ? `${t}.` : t;
};

export default function Footer({ club, sponsors, compact = false }: FooterProps) {
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
      marginTop: compact ? '3rem' : '5rem',
      position: 'relative',
      zIndex: 10,
    }}>
      {/* Optional Sponsor Marquee Bar if Club sponsors exist */}
      {!compact && sponsors && sponsors.length > 0 && (
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
                      padding: isPlatinum ? '0.6rem 1rem' : '0.4rem 0.6rem',
                      background: isPlatinum ? 'rgba(245, 158, 11, 0.08)' : 'transparent',
                      border: isPlatinum ? '1px solid rgba(245, 158, 11, 0.25)' : '1px solid transparent',
                      borderRadius: '10px',
                      maxWidth: '100%',
                      flexWrap: 'wrap',
                      justifyContent: 'center',
                      transition: 'transform 0.2s, border-color 0.2s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.05)'; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                  >
                    <SponsorLogo
                      src={sponsor.logo_url}
                      name={sponsor.name}
                      height={isPlatinum ? 68 : isGold ? 54 : 42}
                      style={{
                        maxWidth: isPlatinum ? 'min(240px, 70vw)' : isGold ? 'min(190px, 60vw)' : 'min(150px, 50vw)',
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
      <div className="container" style={{ padding: compact ? '0 1.5rem 1.5rem' : '3.5rem 1.5rem 2.5rem 1.5rem' }}>
        {!compact && <div style={{
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
                : 'The free platform for grassroots football and soccer clubs: club websites, live match centres, digital member passes and club shops.'}
            </p>
            {!club && (
              <div className="row" style={{ gap: '0.6rem' }}>
                {SOCIAL_PROFILES.filter(p => SOCIAL_ICONS[p.name]).map(p => (
                  <a
                    key={p.url}
                    href={p.url}
                    target="_blank"
                    rel="noopener noreferrer me"
                    aria-label={`itsfootball.club on ${p.name} (opens in a new tab)`}
                    title={p.name}
                    className="social-icon-link"
                    style={{ '--brand': SOCIAL_ICONS[p.name].color } as React.CSSProperties}
                  >
                    <svg viewBox="0 0 24 24" width={18} height={18} fill="currentColor" aria-hidden="true">
                      <path d={SOCIAL_ICONS[p.name].path} />
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
                  <Link href={`/${club.slug}/about`} style={{ color: 'var(--text-secondary)' }}>About the Club</Link>
                  <Link href={`/${club.slug}#fixtures`} style={{ color: 'var(--text-secondary)' }}>Live Match Centre</Link>
                  <Link href={`/${club.slug}#fixtures`} style={{ color: 'var(--text-secondary)' }}>Fixtures &amp; Results</Link>
                  <Link href={`/${club.slug}#squad`} style={{ color: 'var(--text-secondary)' }}>First Team Squad</Link>
                  <Link href={`/${club.slug}#leaderboard`} style={{ color: 'var(--text-secondary)' }}>Player Leaderboards</Link>
                  <Link href={`/${club.slug}/member`} style={{ color: 'var(--text-secondary)' }}>Virtual Member Pass</Link>
                </>
              ) : (
                <>
                  <Link href="/clubs" style={{ color: 'var(--text-secondary)' }}>Explore Clubs</Link>
                  <Link href="/create-club" style={{ color: 'var(--text-secondary)' }}>Launch a New Club</Link>
                  <Link href="/live-scores" style={{ color: 'var(--text-secondary)' }}>Live Match Centre</Link>
                  <Link href={`/${fallbackSlug}/member`} style={{ color: 'var(--text-secondary)' }}>Digital Pass Showcase</Link>
                </>
              )}
            </div>
          </div>

          {/* Free tools column (platform pages only; club sites link the tools hub in the bottom row) */}
          {!club && (
            <div>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--text-primary)' }}>
                Free Tools
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.875rem' }}>
                <Link href="/tools/lineup-builder" style={{ color: 'var(--text-secondary)' }}>Free Lineup Builder</Link>
                <Link href="/tools/equal-playing-time-calculator" style={{ color: 'var(--text-secondary)' }}>Equal Playing Time Calculator</Link>
                <Link href="/tools/match-result-graphic-maker" style={{ color: 'var(--text-secondary)' }}>Free Result Graphic Maker</Link>
                <Link href="/tools/player-card-maker" style={{ color: 'var(--text-secondary)' }}>Free Player Card Maker</Link>
                <Link href="/tools/tournament-maker" style={{ color: 'var(--text-secondary)' }}>Free Tournament Maker</Link>
                <Link href="/tools/season-fee-calculator" style={{ color: 'var(--text-secondary)' }}>Season Fee Calculator</Link>
                <Link href="/guides" style={{ color: 'var(--text-secondary)' }}>Grassroots Guides</Link>
                <Link href="/grounds" style={{ color: 'var(--text-secondary)' }}>Grounds &amp; Rain Status</Link>
                <Link href="/tools" style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>All Free Tools</Link>
              </div>
            </div>
          )}

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
                  <Link href="/compare" style={{ color: 'var(--text-secondary)' }}>Compare Alternatives</Link>
                  <Link href="/best-free-football-club-website-builders-australia" style={{ color: 'var(--text-secondary)' }}>Best Club Builders Australia</Link>
                  <Link href="/about" style={{ color: 'var(--text-secondary)' }}>About Us</Link>
                  <Link href="/faq" style={{ color: 'var(--text-secondary)' }}>FAQ</Link>
                </>
              )}
            </div>
          </div>
        </div>}

        {/* Bottom copyright */}
        <div style={{
          borderTop: compact ? 'none' : '1px solid var(--border-subtle)',
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
            {/* Club sites link the platform's free tools, absolute so it's a real link from a club's own domain too */}
            {club && <a href={`${SITE_URL}/tools`} style={{ color: 'var(--text-muted)' }}>Free football tools</a>}
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
