'use client';

import { useEffect, useState } from 'react';
import { getSupabaseClient } from '@/lib/supabase/client';

/** True once the database has `table.column`. Until then the controls that write it stay hidden. */
function useColumnReady(table: string, column: string): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let live = true;
    getSupabaseClient()?.from(table).select(column).limit(1)
      .then(({ error }) => { if (live) setReady(!error); });
    return () => { live = false; };
  }, [table, column]);
  return ready;
}

/** True once fixtures can be linked to an event (matches.event_id, migration 20261169). Until then the
 *  linking controls stay hidden and the column is never sent, so saving a fixture keeps working. */
export const useEventFixturesReady = () => useColumnReady('matches', 'event_id');

/** True once gallery photos can be linked to an event (media_gallery.event_id, migration 20261171) */
export const useEventGalleryReady = () => useColumnReady('media_gallery', 'event_id');
