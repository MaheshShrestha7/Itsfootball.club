'use client';

// A tournament's own sponsors (migration 20261196), read straight from the database: they're not part
// of the background sync. Visitors read the active ones; the club's Tournaments editors read and
// change them all (row-level security). `ready` stays false until the table exists.
import { useCallback, useEffect, useState } from 'react';
import { getSupabaseClient } from '@/lib/supabase/client';
import type { TournamentSponsor } from '@/lib/tournament-sponsors';

export function useTournamentSponsors(tournamentId: string | undefined) {
  const [sponsors, setSponsors] = useState<TournamentSponsor[]>([]);
  const [ready, setReady] = useState(false);

  const reload = useCallback(async () => {
    const db = getSupabaseClient();
    if (!db || !tournamentId) return;
    const { data, error } = await db.from('tournament_sponsors').select('*').eq('tournament_id', tournamentId).order('display_order');
    setReady(!error);
    if (!error) setSponsors((data || []) as TournamentSponsor[]);
  }, [tournamentId]);

  useEffect(() => { reload(); }, [reload]);

  /** Adds or changes one sponsor; returns an error message, or null when saved */
  const save = useCallback(async (fields: Partial<TournamentSponsor>, id?: string) => {
    const db = getSupabaseClient();
    if (!db || !tournamentId) return 'Not connected.';
    const { error } = id
      ? await db.from('tournament_sponsors').update(fields).eq('id', id)
      // club_id is filled in by the database from the tournament
      : await db.from('tournament_sponsors').insert({ ...fields, tournament_id: tournamentId, club_id: '00000000-0000-0000-0000-000000000000' });
    await reload();
    return error ? error.message : null;
  }, [tournamentId, reload]);

  const remove = useCallback(async (id: string) => {
    const { error } = await getSupabaseClient()!.from('tournament_sponsors').delete().eq('id', id);
    await reload();
    return error ? error.message : null;
  }, [reload]);

  /** Saves new positions (from moveSponsor), showing them straight away */
  const reorder = useCallback(async (changes: { id: string; display_order: number }[]) => {
    if (!changes.length) return;
    setSponsors(prev => prev.map(s => ({ ...s, display_order: changes.find(c => c.id === s.id)?.display_order ?? s.display_order })));
    const db = getSupabaseClient()!;
    await Promise.all(changes.map(c => db.from('tournament_sponsors').update({ display_order: c.display_order }).eq('id', c.id)));
    await reload();
  }, [reload]);

  return { sponsors, ready, save, remove, reorder };
}
