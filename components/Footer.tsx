'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Club, Sponsor } from '@/lib/supabase/types';
import { useClub } from '@/lib/club-context';
import { useAuth } from '@/lib/auth-context';
import { Shield, MapPin, Mail, Phone, Heart } from 'lucide-react';
import SponsorTrackedLink from './SponsorTrackedLink';

interface FooterProps {
  club?: Club | null;
  sponsors?: Sponsor[];
}

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
      background: 'rgba(5, 7, 11, 0.95)',
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
          background: 'rgba(255, 255, 255, 0.015)',
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
                      color: isPlatinum ? '#FFFFFF' : 'var(--text-secondary)'
                    }}>
                      {sponsor.name}
                    </span>
                    <span className="badge" style={{
                      fontSize: '0.7rem',
                      backgroundColor: isPlatinum ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                      color: isPlatinum ? '#F59E0B' : 'var(--text-muted)'
                    }}>
                      {sponsor.tier}
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
                  <Shield size={18} color="#FFFFFF" />
                </div>
              ) : (
                <img src="/logo-96.png" alt="itsfootball.club logo" width={48} height={48} loading="lazy" decoding="async" style={{ width: '48px', height: '48px' }} />
              )}
              <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '1.2rem' }}>
                {club ? club.name : 'itsfootball.club'}
              </span>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', lineHeight: 1.6, marginBottom: '1.2rem' }}>
              {club
                ? `${club.motto || 'Dedicated to the beautiful game.'} Home matches played at ${club.stadium_name}.`
                : 'The premier digital platform for football clubs worldwide. Live match centers, official member passes, and dedicated club websites.'}
            </p>
            {club && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <MapPin size={14} color="var(--club-primary)" /> {club.stadium_name}
                </span>
                {club.contact_email && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Mail size={14} color="var(--club-primary)" /> {club.contact_email}
                  </span>
                )}
                {club.contact_phone && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
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
                </>
              ) : (
                <>
                  <Link href="/clubs" style={{ color: 'var(--text-secondary)' }}>Clubs Directory</Link>
                  <Link href="/my-clubs" style={{ color: 'var(--text-secondary)' }}>My Clubs</Link>
                  <Link href="/create-club" style={{ color: 'var(--text-secondary)' }}>Register New Club</Link>
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
              <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10B981' }}>Protected Squad Data</span>
              <span className="badge" style={{ background: 'rgba(37, 99, 235, 0.1)', color: '#3B82F6' }}>Match Media Hub</span>
              <span className="badge" style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#F59E0B' }}>Dedicated Club Sites</span>
              <span className="badge" style={{ background: 'rgba(168, 85, 247, 0.1)', color: '#A855F7' }}>Verified Turnstiles</span>
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
          <div>
            &copy; {new Date().getFullYear()} {club ? club.name : 'itsfootball.club'}. All rights reserved.
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span>Powered by</span>
            <Link href="/" style={{ color: 'var(--text-secondary)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
              <img src="/logo-96.png" alt="" width={20} height={20} loading="lazy" decoding="async" style={{ width: '20px', height: '20px' }} />
              ItsFootball.club
            </Link>
            <Heart size={13} color="#EF4444" fill="#EF4444" />
          </div>
        </div>
      </div>
    </footer>
  );
}
