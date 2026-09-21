'use client';

import type { Match } from '@/lib/supabase/types';
import { getLiveMinute, useNowTick } from '@/lib/match-clock';

/** Shows the current match minute and keeps it ticking */
export default function LiveMinute({ match }: { match: Match }) {
  const now = useNowTick();
  return <>{getLiveMinute(match, now)}</>;
}
