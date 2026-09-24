'use client';

import React from 'react';
import { Sponsor } from '@/lib/supabase/types';
import SponsorTrackedLink from './SponsorTrackedLink';
import { sortSponsorsByTier } from '@/lib/sponsors';

interface SponsorMarqueeProps {
  sponsors: Sponsor[];
  /** Recorded with each impression/click so the Sponsor Hub can report this placement separately */
  placement: string;
  title?: string;
}

/** Continuously scrolling strip of sponsor logos. Pauses on hover/focus; static for reduced-motion users. */
export default function SponsorMarquee({ sponsors, placement, title = 'Matchday Partners' }: SponsorMarqueeProps) {
  if (sponsors.length === 0) return null;

  const ordered = sortSponsorsByTier(sponsors);
  // Slow the loop down as the list grows so each logo stays on screen long enough to read
  const duration = `${Math.max(18, ordered.length * 5)}s`;

  const renderRow = (copy: boolean) => (
    <div className="sponsor-marquee-row" aria-hidden={copy || undefined} inert={copy || undefined}>
      {ordered.map(s => (
        <SponsorTrackedLink
          key={`${copy ? 'b' : 'a'}-${s.id}`}
          clubId={s.club_id}
          sponsorId={s.id}
          placement={placement}
          href={s.website_url || '#'}
          className="sponsor-marquee-item"
        >
          <img loading="lazy" decoding="async" src={s.logo_url} alt={`${s.name} logo`} draggable={false} />
          <span>{s.name}</span>
        </SponsorTrackedLink>
      ))}
    </div>
  );

  return (
    <section className="glass-panel sponsor-marquee" aria-label={title}>
      <div className="sponsor-marquee-title">{title}</div>
      <div className="sponsor-marquee-viewport">
        <div className="sponsor-marquee-track" style={{ animationDuration: duration }}>
          {renderRow(false)}
          {renderRow(true)}
        </div>
      </div>
    </section>
  );
}
