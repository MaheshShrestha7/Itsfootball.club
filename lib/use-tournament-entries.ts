'use client';

// Guest team entries and squads (hosted tournaments, migration 20261180), read straight from the
// database: they're not part of the background sync. Staff read the full tables (row-level security
// lets only Tournaments editors in); visitors read tournament_squads_public.
import { useCallback, useEffect, useState } from 'react';
import { getAccessToken, getSupabaseClient } from '@/lib/supabase/client';
import type { TournamentEntry, TournamentSquadPlayer } from '@/lib/supabase/types';
import type { EntryPlayer } from '@/lib/hosted-tournaments';

export function useTournamentEntries(tournamentId: string, enabled: boolean) {
  const [entries, setEntries] = useState<TournamentEntry[]>([]);
  const [squads, setSquads] = useState<TournamentSquadPlayer[]>([]);
  const [bills, setBills] = useState<Record<string, { status: string; method: string; amount_cents: number; currency: string }>>({});
  const [loaded, setLoaded] = useState(false);

  const reload = useCallback(async () => {
    const db = getSupabaseClient();
    if (!db || !enabled) return;
    const [{ data: e }, { data: s }] = await Promise.all([
      db.from('tournament_entries').select('*').eq('tournament_id', tournamentId),
      db.from('tournament_squads').select('*').eq('tournament_id', tournamentId).order('sort_order'),
    ]);
    const list = (e || []) as TournamentEntry[];
    setEntries(list);
    setSquads((s || []) as TournamentSquadPlayer[]);
    const ids = list.map(x => x.payment_id).filter((id): id is string => !!id);
    if (ids.length) {
      // Staff without Finance can't read payments: the fee column then just says "Billed"
      const { data: p } = await db.from('payments').select('id, status, method, amount_cents, currency').in('id', ids);
      setBills(Object.fromEntries((p || []).map(b => [b.id, b])));
    } else setBills({});
    setLoaded(true);
  }, [tournamentId, enabled]);

  useEffect(() => { reload(); }, [reload]);

  /** Saves a team's private details (and makes its entry link the first time) */
  const saveEntry = useCallback(async (participantId: string, fields: Partial<TournamentEntry>) => {
    const db = getSupabaseClient();
    if (!db) return 'Not connected.';
    const existing = entries.find(e => e.participant_id === participantId);
    const row = existing
      ? fields
      // tournament_id and club_id are filled in by the database from the team
      : { participant_id: participantId, tournament_id: tournamentId, club_id: '00000000-0000-0000-0000-000000000000', entry_key: `te-${crypto.randomUUID().replace(/-/g, '')}`, ...fields };
    const { error } = existing
      ? await db.from('tournament_entries').update(row).eq('participant_id', participantId)
      : await db.from('tournament_entries').insert(row);
    if (error) return error.message;
    await reload();
    return null;
  }, [entries, tournamentId, reload]);

  /** A new link for a team: the old one stops working */
  const newLink = useCallback((participantId: string) => saveEntry(participantId, { entry_key: `te-${crypto.randomUUID().replace(/-/g, '')}` }), [saveEntry]);

  const setPresent = useCallback(async (playerId: string, present: boolean) => {
    setSquads(prev => prev.map(p => (p.id === playerId ? { ...p, present } : p)));
    const { error } = await getSupabaseClient()!.from('tournament_squads').update({ present }).eq('id', playerId);
    if (error) await reload();
  }, [reload]);

  /**
   * The host types a guest team's players. Rows keep their id (and the check-in tick) when edited;
   * removed players are deleted. The guest's entry link shows the same list.
   */
  const saveSquad = useCallback(async (participantId: string, players: (EntryPlayer & { id?: string })[]) => {
    const db = getSupabaseClient();
    if (!db) return 'Not connected.';
    const rows = players.map(({ id, ...p }, i) => ({ id, row: { ...p, participant_id: participantId, sort_order: i } }));
    const keep = rows.filter(r => r.id).map(r => r.id!);
    const gone = squads.filter(s => s.participant_id === participantId && !keep.includes(s.id)).map(s => s.id);
    if (gone.length) {
      const { error } = await db.from('tournament_squads').delete().in('id', gone);
      if (error) return error.message;
    }
    for (const { id, row } of rows.filter(r => r.id)) {
      const { error } = await db.from('tournament_squads').update(row).eq('id', id!);
      if (error) { await reload(); return error.message; }
    }
    // tournament_id and club_id are filled in by the database from the team
    const fresh = rows.filter(r => !r.id).map(({ row }) => ({ ...row, tournament_id: tournamentId, club_id: '00000000-0000-0000-0000-000000000000' }));
    if (fresh.length) {
      const { error } = await db.from('tournament_squads').insert(fresh);
      if (error) { await reload(); return error.message; }
    }
    await reload();
    return null;
  }, [squads, tournamentId, reload]);

  const setCheckedIn = useCallback((participantId: string, on: boolean) =>
    saveEntry(participantId, { checked_in_at: on ? new Date().toISOString() : null }), [saveEntry]);

  /** The host's own server actions: invite / remind / info / bill */
  const act = useCallback(async (clubId: string, action: 'invite' | 'remind' | 'info' | 'bill', participantIds?: string[]) => {
    const token = await getAccessToken();
    const r = await fetch('/api/admin/tournament-entries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ clubId, tournamentId, action, participantIds }),
    }).catch(() => null);
    const data = r ? await r.json().catch(() => ({})) : { error: 'Check your connection and try again.' };
    await reload();
    return { ok: !!r?.ok && !data.error, ...data } as { ok: boolean; error?: string; sent?: number; skipped?: string[]; billed?: number };
  }, [tournamentId, reload]);

  /** The treasurer saw the bank transfer arrive */
  const markPaid = useCallback(async (clubId: string, paymentId: string) => {
    const token = await getAccessToken();
    const r = await fetch('/api/payments/fee-requests/settle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ clubId, paymentId, action: 'bank' }),
    }).catch(() => null);
    const data = r ? await r.json().catch(() => ({})) : { error: 'Check your connection and try again.' };
    await reload();
    return r?.ok ? null : (data.error as string) || 'That didn\'t save.';
  }, [reload]);

  return { entries, squads, bills, loaded, reload, saveEntry, saveSquad, newLink, setPresent, setCheckedIn, act, markPaid };
}

/** A tournament's guest squads as visitors see them: no hidden players, junior names shortened */
export function usePublicSquads(tournamentId: string | undefined, enabled: boolean) {
  const [squads, setSquads] = useState<TournamentSquadPlayer[]>([]);
  useEffect(() => {
    const db = getSupabaseClient();
    if (!db || !enabled || !tournamentId) return;
    let live = true;
    db.from('tournament_squads_public').select('*').eq('tournament_id', tournamentId).order('sort_order')
      .then(({ data }) => { if (live) setSquads((data || []) as TournamentSquadPlayer[]); });
    return () => { live = false; };
  }, [tournamentId, enabled]);
  return squads;
}
