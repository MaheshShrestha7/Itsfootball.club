'use client';

import { useCallback, useEffect, useState } from 'react';
import { getSupabaseClient } from './supabase/client';

/**
 * Medical notes the signed-in person may read at a club, by member id (Club Admins, the coaches
 * of the member's teams, the member and their guardian; migration 20261129). Kept out of the
 * shared club data on purpose: it's fetched only where it's shown and never cached in the browser.
 */
export function useMemberHealth(clubId: string | undefined, enabled = true) {
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState(false);

  const reload = useCallback(async () => {
    const db = getSupabaseClient();
    if (!db || !clubId || !enabled) return;
    const { data, error } = await db.rpc('member_health_notes', { p_club_id: clubId });
    if (!error) setNotes(Object.fromEntries(((data || []) as { member_id: string; medical_notes: string }[]).map(r => [r.member_id, r.medical_notes])));
    setLoaded(true);
  }, [clubId, enabled]);

  useEffect(() => { reload(); }, [reload]);

  return { notes, loaded, reload, setLocal: (memberId: string, text: string) => setNotes(n => ({ ...n, [memberId]: text })) };
}
