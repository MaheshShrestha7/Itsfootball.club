'use client';

import React from 'react';
import { useClub } from '@/lib/club-context';
import { isSponsorOnSite, topTierSponsors } from '@/lib/sponsors';
import SponsorTrackedLink from './SponsorTrackedLink';
import SponsorLogo from './SponsorLogo';

/** "Supported by" (SP-F8): the club's top-tier sponsors on the site, under a match report and at the
 *  end of a news story. Counted as "Match reports and news" in the Sponsor Report. */
export default function SupportedBy({ clubId }: { clubId: string }) {
  const { sponsors } = useClub();
  // Club-wide sponsors only; admins load hidden and ended ones too, so they see what fans see
  const shown = topTierSponsors(sponsors.filter(s => s.club_id === clubId && !s.event_id && isSponsorOnSite(s)));
  if (!shown.length) return null;
  return (
    <aside aria-label="Supported by" className="glass-panel" style={{ padding: '1.1rem 1.25rem', marginBottom: '2rem', borderRadius: 'var(--radius-xl)', textAlign: 'center' }}>
      <div style={{ fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
        Supported by
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0.75rem' }}>
        {shown.map(s => (
          <SponsorTrackedLink key={s.id} clubId={clubId} sponsorId={s.id} placement="supported_by" href={s.website_url || ''}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 132, height: 64, padding: '0.5rem', borderRadius: 12,
              background: s.logo_url ? '#fff' : 'rgba(var(--tint-rgb), 0.06)', border: '1px solid var(--border-subtle)' }}>
            <SponsorLogo src={s.logo_url} name={s.name} height={44} style={{ maxWidth: '100%' }} />
            <span className="sr-only">{s.name}</span>
          </SponsorTrackedLink>
        ))}
      </div>
    </aside>
  );
}
