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
    }}>
      {sortedSponsors.map(sponsor => {
        const scale = sponsorScale(sponsor);
        const isXL = scale === 'xl';
        const isLG = scale === 'lg';
        const isMD = scale === 'md';

        // A card only when it opens the sponsor's site; size shows the tier
        const linked = !!sponsor.website_url;

        return (
          <SponsorTrackedLink
            key={sponsor.id}
            clubId={sponsor.club_id}
            sponsorId={sponsor.id}
            placement={placement}
            href={sponsor.website_url || '#'}
            className={linked ? 'glass-panel glass-panel-interactive' : undefined}
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
              <div className="text-meta" style={{ marginTop: '2px' }}>{sponsorLabel(sponsor)}</div>
            </div>
          </SponsorTrackedLink>
        );
      })}
    </div>  );
}
