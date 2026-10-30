'use client';

import React, { useEffect, useState } from 'react';
import type { GroundPlace } from '@/lib/sponsors';
import type { GroundSponsor } from '@/lib/sponsor-ground-server';
import SponsorTrackedLink from './SponsorTrackedLink';
import SponsorLogo from './SponsorLogo';

/** The sponsors whose package includes a place at the ground (Admin, Sponsors, Packages: "At the
 *  ground and in print"), from /api/sponsors/ground. null while loading. */
export function useGroundSponsors(clubId: string | undefined, place: GroundPlace, eventId?: string | null): GroundSponsor[] | null {
  const [list, setList] = useState<GroundSponsor[] | null>(null);
  useEffect(() => {
    if (!clubId) return;
    let stopped = false;
    const q = new URLSearchParams({ club: clubId, place, ...(eventId ? { event: eventId } : {}) });
    fetch(`/api/sponsors/ground?${q}`)
      .then(r => (r.ok ? r.json() : { sponsors: [] }))
      .then(j => { if (!stopped) setList(Array.isArray(j.sponsors) ? j.sponsors : []); })
      .catch(() => { if (!stopped) setList([]); });
    return () => { stopped = true; };
  }, [clubId, place, eventId]);
  return list;
}

/** A row of sponsor logos on white tiles under a small spaced heading. On a phone screen (tickets,
 *  check-in) the logos link to the sponsor and count in their Sponsor Report under `place`. */
export default function GroundSponsors({ clubId, place, eventId, heading, className, style }: {
  clubId: string; place: GroundPlace; eventId?: string | null; heading: string; className?: string; style?: React.CSSProperties;
}) {
  const sponsors = useGroundSponsors(clubId, place, eventId);
  if (!sponsors?.length) return null;
  return (
    <aside aria-label={heading} className={className} style={{ textAlign: 'center', ...style }}>
      <div style={{ fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.7rem' }}>
        {heading}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0.6rem' }}>
        {sponsors.map(s => (
          <SponsorTrackedLink key={s.id} clubId={clubId} sponsorId={s.id} placement={place} href={s.website_url || ''}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 104, height: 52, padding: '0.4rem', borderRadius: 10,
              background: s.logo_url ? '#fff' : 'rgba(var(--tint-rgb), 0.06)', border: '1px solid var(--border-subtle)' }}>
            <SponsorLogo src={s.logo_url} name={s.name} height={36} style={{ maxWidth: '100%' }} />
            <span className="sr-only">{s.name}</span>
          </SponsorTrackedLink>
        ))}
      </div>
    </aside>
  );
}
