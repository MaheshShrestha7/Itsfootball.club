'use client';

import { useEffect, useState } from 'react';
import { getSupabaseClient } from '@/lib/supabase/client';

/** True once the database has the matchday columns on fixtures (meet_time, kit, bench_member_ids;
 *  migration 20261164). Until then the boxes stay hidden and the columns are never sent, so saving a
 *  fixture or publishing a line-up keeps working. */
export function useMatchdayDetailsReady(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let live = true;
    getSupabaseClient()?.from('matches').select('meet_time, kit, bench_member_ids').limit(1)
      .then(({ error }) => { if (live) setReady(!error); });
    return () => { live = false; };
  }, []);
  return ready;
}
