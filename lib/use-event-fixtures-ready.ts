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

/** True once hosted tournaments are switched on (migration 20261180): age groups, timing, guest team
 *  details, entry links and squads. Until then those controls stay hidden and the new columns are never sent. */
export const useHostedTournamentsReady = () => useColumnReady('tournaments', 'match_minutes');

/** True once tournaments can keep their own tie-breakers (tournaments.tie_breakers, migration 20261181) */
export const useTieBreakersReady = () => useColumnReady('tournaments', 'tie_breakers');

/** True once the host's "Start the knockout stage" tap can be saved (tournaments.knockout_started_at, migration 20261185).
 *  Until then knockout games open by themselves once every group game is played. */
export const useKnockoutStartReady = () => useColumnReady('tournaments', 'knockout_started_at');
