'use client';

import { useEffect, useState } from 'react';
import { getSupabaseClient } from '@/lib/supabase/client';

/** True once fixtures can be linked to an event (matches.event_id, migration 20261169). Until then the
 *  linking controls stay hidden and the column is never sent, so saving a fixture keeps working. */
export function useEventFixturesReady(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let live = true;
    getSupabaseClient()?.from('matches').select('event_id').limit(1)
      .then(({ error }) => { if (live) setReady(!error); });
    return () => { live = false; };
  }, []);
  return ready;
}
