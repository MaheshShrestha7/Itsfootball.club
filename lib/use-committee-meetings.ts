'use client';

import { useCallback, useEffect, useState } from 'react';
import { getSupabaseClient } from '@/lib/supabase/client';
import { useAutosaved } from '@/lib/use-match-reviews';
import { MEETING_COLUMNS, type CommitteeAction, type CommitteeMeeting } from '@/lib/committee-meetings';

// Committee meetings and their actions (migration 20261182). Without a database (local preview)
// they're kept in this browser, so the pages still work.

const LOCAL_KEY = 'itsfootball-committee-meetings';
interface LocalStore { meetings?: CommitteeMeeting[]; actions?: CommitteeAction[] }
const readLocal = (): LocalStore => {
  try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || '{}') || {}; } catch { return {}; }
};
const writeLocal = (next: LocalStore): boolean => {
  try { localStorage.setItem(LOCAL_KEY, JSON.stringify(next)); return true; } catch { return false; }
};

/** null while checking; false until migration 20261182 has run */
export function useMeetingsReady(): boolean | null {
  const [ready, setReady] = useState<boolean | null>(null);
  useEffect(() => {
    let live = true;
    const sb = getSupabaseClient();
    void (sb ? sb.from('committee_meetings').select('id').limit(1).then(r => !r.error) : Promise.resolve(true))
      .then(ok => { if (live) setReady(ok); });
    return () => { live = false; };
  }, []);
  return ready;
}

/** Every meeting and action of the club, newest meeting first */
export function useCommittee(clubId: string, enabled: boolean) {
  const [meetings, setMeetings] = useState<CommitteeMeeting[] | null>(null);
  const [actions, setActions] = useState<CommitteeAction[]>([]);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    if (!enabled) return;
    const sb = getSupabaseClient();
    if (!sb) {
      const local = readLocal();
      setMeetings((local.meetings || []).filter(m => m.club_id === clubId).sort((a, b) => b.starts_at.localeCompare(a.starts_at)));
      setActions((local.actions || []).filter(a => a.club_id === clubId));
      return;
    }
    // shortcut: loads every meeting and action; page by year once a club has hundreds of meetings
    const [m, a] = await Promise.all([
      sb.from('committee_meetings').select(MEETING_COLUMNS).eq('club_id', clubId).order('starts_at', { ascending: false }).limit(500),
      sb.from('committee_actions').select('*').eq('club_id', clubId).order('created_at').limit(2000),
    ]);
    setError(!!(m.error || a.error));
    if (!m.error) setMeetings((m.data || []) as CommitteeMeeting[]);
    if (!a.error) setActions((a.data || []) as CommitteeAction[]);
  }, [clubId, enabled]);
  useEffect(() => { void load(); }, [load]);

  /** Returns the new meeting's id, or null when it couldn't be saved */
  const createMeeting = useCallback(async (row: Omit<CommitteeMeeting, 'id'>): Promise<string | null> => {
    const sb = getSupabaseClient();
    if (!sb) {
      const local = readLocal();
      const id = crypto.randomUUID();
      if (!writeLocal({ ...local, meetings: [...(local.meetings || []), { ...row, id }] })) return null;
      await load();
      return id;
    }
    const { data, error: e } = await sb.from('committee_meetings').insert(row).select('id').single();
    if (e || !data) return null;
    await load();
    return data.id as string;
  }, [load]);

  const deleteMeeting = useCallback(async (id: string): Promise<boolean> => {
    const sb = getSupabaseClient();
    if (!sb) {
      const local = readLocal();
      const ok = writeLocal({ meetings: (local.meetings || []).filter(m => m.id !== id), actions: (local.actions || []).filter(a => a.meeting_id !== id) });
      await load();
      return ok;
    }
    const { error: e } = await sb.from('committee_meetings').delete().eq('id', id);
    await load();
    return !e;
  }, [load]);

  const addAction = useCallback(async (row: Omit<CommitteeAction, 'id' | 'created_at' | 'closed_at' | 'closed_in' | 'status'>): Promise<boolean> => {
    const sb = getSupabaseClient();
    if (!sb) {
      const local = readLocal();
      const ok = writeLocal({ ...local, actions: [...(local.actions || []), { ...row, id: crypto.randomUUID(), status: 'open', closed_at: null, closed_in: null, created_at: new Date().toISOString() }] });
      await load();
      return ok;
    }
    const { error: e } = await sb.from('committee_actions').insert(row);
    await load();
    return !e;
  }, [load]);

  const updateAction = useCallback(async (id: string, changes: Partial<Pick<CommitteeAction, 'status' | 'closed_at' | 'closed_in'>>): Promise<boolean> => {
    // Shown straight away; the reload below puts it back if the save failed
    setActions(list => list.map(a => (a.id === id ? { ...a, ...changes } : a)));
    const sb = getSupabaseClient();
    if (!sb) {
      const local = readLocal();
      return writeLocal({ ...local, actions: (local.actions || []).map(a => (a.id === id ? { ...a, ...changes } : a)) });
    }
    const { error: e } = await sb.from('committee_actions').update(changes).eq('id', id);
    if (e) await load();
    return !e;
  }, [load]);

  const deleteAction = useCallback(async (id: string): Promise<boolean> => {
    setActions(list => list.filter(a => a.id !== id));
    const sb = getSupabaseClient();
    if (!sb) {
      const local = readLocal();
      return writeLocal({ ...local, actions: (local.actions || []).filter(a => a.id !== id) });
    }
    const { error: e } = await sb.from('committee_actions').delete().eq('id', id);
    if (e) await load();
    return !e;
  }, [load]);

  return { meetings, actions, error, reload: load, createMeeting, deleteMeeting, addAction, updateAction, deleteAction };
}

type Editable = Omit<CommitteeMeeting, 'id' | 'club_id' | 'share_token' | 'shared_at' | 'agenda_sent_at' | 'minutes_sent_at'>;
const EDITABLE: (keyof Editable)[] = ['kind', 'topic', 'event_id', 'starts_at', 'location', 'status', 'agenda', 'attendance', 'current_item', 'item_started_at', 'started_at', 'ended_at', 'figures'];

/**
 * One meeting, saved a moment after each change.
 * shortcut: last save wins if two people edit the same meeting at once; add realtime if committees ask for it.
 */
export function useMeeting(meetingId: string | null, authorName: string) {
  const load = useCallback(async (): Promise<CommitteeMeeting | null> => {
    if (!meetingId) return null;
    const sb = getSupabaseClient();
    if (!sb) return readLocal().meetings?.find(m => m.id === meetingId) || null;
    const { data, error } = await sb.from('committee_meetings').select(MEETING_COLUMNS).eq('id', meetingId).maybeSingle();
    return error || !data ? null : (data as CommitteeMeeting);
  }, [meetingId]);

  const save = useCallback(async (m: CommitteeMeeting): Promise<boolean> => {
    const row = Object.fromEntries(EDITABLE.map(k => [k, m[k]])) as Partial<CommitteeMeeting>;
    const sb = getSupabaseClient();
    if (!sb) {
      const local = readLocal();
      return writeLocal({ ...local, meetings: (local.meetings || []).map(x => (x.id === m.id ? { ...x, ...row } : x)) });
    }
    const { error } = await sb.from('committee_meetings')
      .update({ ...row, updated_by_name: authorName || null, updated_at: new Date().toISOString() }).eq('id', m.id);
    return !error;
  }, [authorName]);

  return useAutosaved<CommitteeMeeting | null>(meetingId, null, load, save as (m: CommitteeMeeting | null) => Promise<boolean>);
}

/** Marks the agenda or minutes as emailed, or sets the share link (columns the autosave leaves alone) */
export async function patchMeeting(id: string, changes: Partial<Pick<CommitteeMeeting, 'agenda_sent_at' | 'minutes_sent_at' | 'share_token' | 'shared_at'>> & { share_report?: object | null }): Promise<boolean> {
  const sb = getSupabaseClient();
  if (!sb) {
    const local = readLocal();
    const { share_report: _drop, ...rest } = changes;
    void _drop;
    return writeLocal({ ...local, meetings: (local.meetings || []).map(x => (x.id === id ? { ...x, ...rest } : x)) });
  }
  const { error } = await sb.from('committee_meetings').update(changes).eq('id', id);
  return !error;
}

/** The minutes behind a share link (migration 20261182), for the public page */
export async function loadSharedMinutes(token: string) {
  if (!/^[A-Za-z0-9]{32,64}$/.test(token)) return null;
  const sb = getSupabaseClient();
  if (!sb) return null;
  const { data, error } = await sb.rpc('shared_committee_minutes', { p_token: token });
  if (error || !data) return null;
  return data as { report: unknown; shared_at: string; club: { name: string; slug: string; logo_url?: string | null; primary_color?: string | null } };
}
