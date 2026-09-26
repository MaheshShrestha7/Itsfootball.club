'use client';

import type { Match } from '@/lib/supabase/types';
import { getLiveMinute, useNowTick } from '@/lib/match-clock';

/** Shows the current match minute and keeps it ticking */
export default function LiveMinute({ match }: { match: Match }) {
  const now = useNowTick();
  // Server and browser clocks differ by the page's load time; the next tick corrects any difference
  return <span suppressHydrationWarning>{getLiveMinute(match, now)}</span>;
}
