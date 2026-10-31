'use client';

import { useEffect, useState } from 'react';
import { getSupabaseClient } from '@/lib/supabase/client';
import type { ClubPerk } from '@/lib/supabase/types';

/** The club's live perks (club_perks_public, migration 20261141). With `withCodes`, the discount
 *  codes are added for a signed-in active member or their guardian (my_perk_codes); for anyone else
 *  the codes stay blank. Empty until the migration runs, so nothing shows before it */
export function useClubPerks(clubId: string, withCodes = false): { perks: ClubPerk[]; loaded: boolean } {
  const [state, setState] = useState<{ perks: ClubPerk[]; loaded: boolean }>({ perks: [], loaded: false });
  useEffect(() => {
    const db = getSupabaseClient();
    if (!db || !clubId) return;
    let cancelled = false;
    Promise.all([
      db.from('club_perks_public').select('*').eq('club_id', clubId).order('sort_order'),
      withCodes ? db.rpc('my_perk_codes', { p_club_id: clubId }) : Promise.resolve({ data: [] }),
    ]).then(([{ data: perks }, { data: codes }]) => {
      if (cancelled) return;
      const byPerk = new Map(((codes || []) as { perk_id: string; code: string }[]).map(c => [c.perk_id, c.code]));
      setState({ perks: ((perks || []) as ClubPerk[]).map(p => ({ ...p, code: byPerk.get(p.id) ?? null })), loaded: true });
    });
    return () => { cancelled = true; };
  }, [clubId, withCodes]);
  return state;
}
