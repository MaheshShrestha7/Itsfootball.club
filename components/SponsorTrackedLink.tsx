'use client';

import React, { useEffect, useRef } from 'react';
import { useClub } from '@/lib/club-context';
import { sponsorHref } from '@/lib/sponsors';

interface SponsorTrackedLinkProps {
  clubId: string;
  sponsorId: string;
  placement: string;
  href: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
  onMouseEnter?: React.MouseEventHandler<HTMLAnchorElement>;
  onMouseLeave?: React.MouseEventHandler<HTMLAnchorElement>;
}

/** Wraps a sponsor placement link with real impression/viewability/click tracking
 *  (see lib/club-context.tsx trackSponsorEvent + app/api/sponsor-track), so the admin
 *  Sponsor Hub dashboard reports actual traffic instead of a modeled estimate. */
export default function SponsorTrackedLink({
  clubId, sponsorId, placement, href, children, style, className, onMouseEnter, onMouseLeave,
}: SponsorTrackedLinkProps) {
  const { trackSponsorEvent } = useClub();
  const ref = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;

    let viewableSince: number | null = null;
    let viewableFired = false;
    let impressionFired = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const markViewable = () => {
      if (viewableFired || viewableSince === null) return;
      viewableFired = true;
      trackSponsorEvent(clubId, sponsorId, 'viewable_impression', { placement, dwellMs: Date.now() - viewableSince });
    };

    const observer = new IntersectionObserver(
      entries => {
        const entry = entries[0];
        if (entry.isIntersecting) {
          if (!impressionFired) {
            impressionFired = true;
            trackSponsorEvent(clubId, sponsorId, 'impression', { placement });
          }
          if (entry.intersectionRatio >= 0.5 && viewableSince === null) {
            viewableSince = Date.now();
            // MRC standard: counts as "viewable" once ≥50% of it has been in view for ≥1 continuous second.
            timer = setTimeout(markViewable, 1000);
          }
        } else {
          if (timer) { clearTimeout(timer); timer = null; }
          viewableSince = null;
        }
      },
      { threshold: [0, 0.5] }
    );
    observer.observe(el);

    return () => {
      if (timer) clearTimeout(timer);
      observer.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clubId, sponsorId, placement]);

  return (
    <a
      ref={ref}
      href={sponsorHref(href) || '#'}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      style={style}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={() => trackSponsorEvent(clubId, sponsorId, 'click', { placement })}
    >
      {children}
    </a>
  );
}
