'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { isTrackedPublicPath, trackPlatformVisit } from '@/lib/platform-tracking';
import { isPlatformHost } from '@/lib/slugs';

/**
 * Counts visits to the public itsfootball.club pages (free tools, guides, grounds, compare, tournaments,
 * pricing...) for Mission Control's Overview. Never a club's own pages, and never on a club's own domain.
 * Saves the page, a random browser id, the referring site and phone or desktop: no names or emails.
 */
export default function PlatformVisitTracker() {
  const pathname = usePathname();
  useEffect(() => {
    if (!pathname || !isPlatformHost(window.location.hostname) || !isTrackedPublicPath(pathname)) return;
    trackPlatformVisit(pathname);
  }, [pathname]);
  return null;
}
