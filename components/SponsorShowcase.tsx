'use client';

import SponsorLogo from '@/components/SponsorLogo';
import SponsorTrackedLink from '@/components/SponsorTrackedLink';
import { sponsorLabel } from '@/lib/sponsors';
import type { Sponsor } from '@/lib/supabase/types';

type Scale = 'xl' | 'lg' | 'md' | 'sm';

/** A sponsor's card size: the club's override, else by tier */
function sponsorScale(sponsor: Pick<Sponsor, 'size_scale' | 'tier'>): Scale {
  if (sponsor.size_scale && sponsor.size_scale !== 'auto') return sponsor.size_scale as Scale;
  switch (sponsor.tier) {
    case 'platinum': return 'xl';
    case 'gold': return 'lg';
    case 'silver': return 'md';
    default: return 'sm';
  }
}

/** The club's sponsors as tiered cards linking to their sites (club home page and /sponsor).
 *  Pass them already in order (sortSponsorsByTier); `placement` labels the clicks in sponsor analytics. */
export default function SponsorShowcase({ sponsors: sortedSponsors, placement }: { sponsors: Sponsor[]; placement: string }) {
  return (
    <div style={{
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'stretch',
      gap: '1.25rem',
      justifyContent: 'center',
    }}>
      {sortedSponsors.map(sponsor => {
        const scale = sponsorScale(sponsor);
        const isXL = scale === 'xl';
        const isLG = scale === 'lg';
        const isMD = scale === 'md';

        const badgeText = (sponsor.tier === 'platinum' ? '★ ' : '') + sponsorLabel(sponsor).toUpperCase();

        return (
          <SponsorTrackedLink
            key={sponsor.id}
            clubId={sponsor.club_id}
            sponsorId={sponsor.id}
            placement={placement}
            href={sponsor.website_url || '#'}
            className="glass-panel"
            style={{
              padding: isXL ? '1.6rem 2.2rem' : isLG ? '1.3rem 1.75rem' : isMD ? '1.05rem 1.4rem' : '0.85rem 1.15rem',
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: isXL ? '1.25rem 1.75rem' : isLG ? '1rem 1.4rem' : isMD ? '0.8rem 1.1rem' : '0.65rem 0.85rem',
              textDecoration: 'none',
              borderRadius: isXL ? '18px' : isLG ? '16px' : '12px',
              minWidth: isXL ? 'min(100%, 340px)' : isLG ? 'min(100%, 280px)' : isMD ? 'min(100%, 220px)' : 'min(100%, 170px)',
              flex: isXL ? '2 1 420px' : isLG ? '1.5 1 320px' : isMD ? '1 1 240px' : '0.7 1 180px',
              maxWidth: isXL ? '720px' : isLG ? '560px' : isMD ? '420px' : '320px',
              background: isXL
                ? 'radial-gradient(ellipse at top left, rgba(245, 158, 11, 0.16), rgba(var(--dk-15-23-42), 0.85))'
                : isLG
                ? 'radial-gradient(ellipse at top left, rgba(245, 158, 11, 0.07), rgba(var(--dk-15-23-42), 0.65))'
                : 'rgba(var(--tint-rgb), 0.025)',
              border: isXL
                ? '1px solid rgba(245, 158, 11, 0.45)'
                : isLG
                ? '1px solid rgba(245, 158, 11, 0.22)'
                : isMD
                ? '1px solid rgba(var(--tint-rgb), 0.1)'
                : '1px solid rgba(var(--tint-rgb), 0.05)',
              boxShadow: isXL ? '0 10px 32px rgba(245, 158, 11, 0.14)' : isLG ? '0 6px 20px rgba(0, 0, 0, 0.25)' : 'none',
              transition: 'transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = 'translateY(-3px)';
              if (isXL) e.currentTarget.style.borderColor = '#F59E0B';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = 'translateY(0)';
              if (isXL) e.currentTarget.style.borderColor = 'rgba(245, 158, 11, 0.45)';
            }}
          >
            <SponsorLogo
              src={sponsor.logo_url}
              name={sponsor.name}
              height={isXL ? 100 : isLG ? 76 : isMD ? 58 : 44}
              style={{
                maxWidth: isXL ? 'min(100%, 300px)' : isLG ? 'min(100%, 230px)' : isMD ? 'min(100%, 170px)' : 'min(100%, 130px)',
                filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.3))',
              }}
            />
            {/* Below ~180px beside the logo, the name moves under it rather than squeezing into a thin column */}
            <div style={{ overflow: 'hidden', minWidth: 0, flex: '1 1 180px' }}>
              <div style={{
                fontWeight: 900,
                fontSize: isXL ? '1.3rem' : isLG ? '1.1rem' : isMD ? '0.95rem' : '0.85rem',
                color: 'var(--text-primary)',
                lineHeight: 1.25,
                // Up to two lines: long business names stay readable instead of cutting off
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                overflowWrap: 'anywhere',
                letterSpacing: '-0.01em',
              }} title={sponsor.name}>
                {sponsor.name}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '3px' }}>
                <span className="badge" style={{
                  fontSize: isXL ? '0.72rem' : '0.68rem',
                  padding: isXL ? '0.2rem 0.55rem' : '0.15rem 0.4rem',
                  fontWeight: 800,
                  backgroundColor: sponsor.tier === 'platinum'
                    ? 'rgba(245, 158, 11, 0.22)'
                    : sponsor.tier === 'gold'
                    ? 'rgba(234, 179, 8, 0.18)'
                    : 'rgba(var(--tint-rgb), 0.08)',
                  color: sponsor.tier === 'platinum'
                    ? '#F59E0B'
                    : sponsor.tier === 'gold'
                    ? '#FBBF24'
                    : 'var(--text-muted)',
                  letterSpacing: '0.04em',
                }}>
                  {badgeText}
                </span>
              </div>
            </div>
          </SponsorTrackedLink>
        );
      })}
    </div>  );
}
