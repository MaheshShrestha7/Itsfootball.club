import { getSupabaseClient } from '@/lib/supabase/client';
import { secureToken } from '@/lib/ids';
import { isPlatformHost } from '@/lib/slugs';

/**
 * Record a platform-level visit (to itsfootball.club home, pricing, about, directory, etc.)
 * Rate-limited per browser session to 1 entry per path per 30 minutes.
 */
export function trackPlatformVisit(path: string) {
  record('page_view', path);
}

/** Public pages that count as platform visits (the homepage counts itself in HomeClient). */
const PUBLIC_PREFIXES = [
  '/tools', '/guides', '/grounds', '/compare', '/tournaments', '/pricing', '/about', '/faq', '/create-club',
  '/best-free-football-club-website-builders-australia', '/live-scores', '/clubs', '/privacy', '/terms',
];

/** True for the public itsfootball.club pages the Overview's traffic card counts (never a club's pages). */
export function isTrackedPublicPath(path: string): boolean {
  return PUBLIC_PREFIXES.some(p => path === p || path.startsWith(`${p}/`));
}

/**
 * A free tool was used (a graphic downloaded or shared, a tournament created): one row per use,
 * on the tool's page. Counted on Mission Control's Overview. Rate-limited to one per action per minute.
 */
export function trackToolUse(action: string) {
  if (typeof window === 'undefined') return;
  if (!isPlatformHost(window.location.hostname) || !isTrackedPublicPath(window.location.pathname)) return;
  record('tool_use', window.location.pathname, { action: action.slice(0, 40) }, 60 * 1000, action);
}

function record(eventType: 'page_view' | 'tool_use', path: string, extra: Record<string, string> = {}, gapMs = 30 * 60 * 1000, keySuffix = '') {
  if (typeof window === 'undefined') return;
  const client = getSupabaseClient();
  if (!client) return;

  try {
    const key = `itsfootball_plat_${eventType === 'page_view' ? 'pv' : 'tu'}_${path}${keySuffix}`;
    const last = Number(sessionStorage.getItem(key) || 0);
    if (Date.now() - last < gapMs) return;
    sessionStorage.setItem(key, String(Date.now()));
  } catch {
    // storage blocked or unavailable
  }

  let device = 'Desktop';
  const ua = navigator.userAgent || '';
  if (/tablet|ipad/i.test(ua) || (window.innerWidth >= 768 && window.innerWidth <= 1024)) {
    device = 'Tablet';
  } else if (/mobile|iphone|android|phone/i.test(ua) || window.innerWidth < 768) {
    device = 'Mobile';
  }

  let visitor = '';
  try {
    visitor = localStorage.getItem('itsfootball_vid') || '';
    if (!visitor) {
      visitor = secureToken('v').slice(0, 24);
      localStorage.setItem('itsfootball_vid', visitor);
    }
  } catch {
    visitor = 'anon';
  }

  client
    .from('platform_analytics')
    .insert({
      event_type: eventType,
      page_path: path.slice(0, 255),
      visitor_hash: visitor,
      referrer: document.referrer.slice(0, 500) || null, // the database caps it at 500
      metadata: { device, screenWidth: window.innerWidth, ...extra },
    })
    .then(({ error }) => {
      if (error) {
        // Table may not yet exist if migration hasn't been executed
        console.debug('Platform tracking notice:', error.message);
      }
    });
}
