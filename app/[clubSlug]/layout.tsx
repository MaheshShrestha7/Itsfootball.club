'use client';

import React, { use, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useClub } from '@/lib/club-context';
import ClubNavbar from '@/components/ClubNavbar';
import Footer from '@/components/Footer';
import { hexToRgb, evaluateColorContrast } from '@/lib/theme-utils';

export default function ClubLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ clubSlug: string }>;
}) {
  const resolvedParams = use(params);
  const pathname = usePathname();
  const { clubs, selectClubBySlug, sponsors, trackPageView, isHydrated } = useClub();
  const club = selectClubBySlug(resolvedParams.clubSlug) ||
    clubs.find(c => c.slug.toLowerCase() === resolvedParams.clubSlug.toLowerCase()) ||
    clubs[0];

  // Track real public page visits for live club analytics
  useEffect(() => {
    if (club?.id && pathname && !pathname.includes('/admin')) {
      trackPageView(club.id, pathname);
    }
  }, [club?.id, pathname, trackPageView]);

  if (!club) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem', textAlign: 'center', padding: '2rem' }}>
        {isHydrated ? (
          <>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 900 }}>Club not found</h1>
            <p style={{ color: 'var(--text-muted)' }}>No club exists at this address yet.</p>
            <Link href="/create-club" className="btn btn-primary">Launch a Club</Link>
          </>
        ) : (
          <div style={{ color: 'var(--text-muted)' }}>Loading...</div>
        )}
      </div>
    );
  }

  // Dynamic CSS variables injected for this club tenant
  const primaryRgb = hexToRgb(club?.primary_color || '#10B981');
  const secondaryRgb = hexToRgb(club?.secondary_color || '#0F172A');
  const accentRgb = hexToRgb(club?.accent_color || '#F59E0B');

  // WCAG 2.2 AA Contrast calculation
  const contrastEval = evaluateColorContrast(club?.primary_color || '#10B981');

  const clubSponsors = club ? sponsors.filter(s => s.club_id === club.id) : [];

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        // Injected Dynamic Branding Variables & WCAG Compliant Contrast Text
        ['--club-primary' as any]: club.primary_color,
        ['--club-primary-rgb' as any]: primaryRgb.rgbString,
        ['--club-primary-contrast' as any]: contrastEval.bestTextColor,
        ['--club-secondary' as any]: club.secondary_color,
        ['--club-secondary-rgb' as any]: secondaryRgb.rgbString,
        ['--club-accent' as any]: club.accent_color,
        ['--club-accent-rgb' as any]: accentRgb.rgbString,
      }}
    >
      <ClubNavbar club={club} />
      <div style={{ flex: 1 }}>
        {children}
      </div>
      <Footer club={club} sponsors={clubSponsors} />
    </div>
  );
}

