import { getSupabaseClient } from '@/lib/supabase/client';
import { secureToken } from '@/lib/tokens';

/**
 * Record a platform-level visit (to itsfootball.club home, pricing, about, directory, etc.)
 * Rate-limited per browser session to 1 entry per path per 30 minutes.
 */
export function trackPlatformVisit(path: string) {
  if (typeof window === 'undefined') return;
  const client = getSupabaseClient();
  if (!client) return;

  try {
    const key = `itsfootball_plat_pv_${path}`;
    const last = Number(sessionStorage.getItem(key) || 0);
    if (Date.now() - last < 30 * 60 * 1000) return;
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
      event_type: 'page_view',
      page_path: path.slice(0, 255),
      visitor_hash: visitor,
      referrer: document.referrer || null,
      metadata: { device, screenWidth: window.innerWidth },
    })
    .then(({ error }) => {
      if (error) {
        // Table may not yet exist if migration hasn't been executed
        console.debug('Platform tracking notice:', error.message);
      }
    });
}
