'use client';

import type { Match } from '@/lib/supabase/types';
import { getLiveMinuteLabel, useNowTick } from '@/lib/match-clock';

/** Shows the current match minute ("9", or "12+2" in stoppage) and keeps it ticking */
export default function LiveMinute({ match }: { match: Match }) {
  const now = useNowTick();
  // Server and browser clocks differ by the page's load time; the next tick corrects any difference
  return <span suppressHydrationWarning>{getLiveMinuteLabel(match, now)}</span>;
}
