'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getSupabaseClient } from '@/lib/supabase/client';
import { emptyReview, type MatchReview } from '@/lib/match-review';
import type { MatchStatLine } from '@/lib/match-stats';

export type ReviewSaveState = 'idle' | 'saving' | 'saved' | 'error';

/** The cup a summary belongs to, and which of the club's teams it is about ('' when there is only one) */
export interface CupRef { eventId?: string; tournamentId?: string; teamKey: string }

// Without a database (local preview) reviews stay in this browser
const LOCAL_KEY = 'itsfootball_reviews_v1';
type LocalStore = { matches?: Record<string, MatchReview>; cups?: Record<string, string>; shares?: Record<string, { share: CupShare | null; report: unknown }> };
const readLocal = (): LocalStore => {
  try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || '{}') || {}; } catch { return {}; }
};
const writeLocal = (next: LocalStore): boolean => {
  try { localStorage.setItem(LOCAL_KEY, JSON.stringify(next)); return true; } catch { return false; }
};
const cupKey = (c: CupRef) => `${c.eventId ? `event:${c.eventId}` : `tournament:${c.tournamentId}`}:${c.teamKey}`;

const REVIEW_COLUMNS = 'match_id, went_well, work_on, next_week';

/** True once the database has the review tables (migration 20261173). Until then the review buttons stay hidden. */
export function useMatchReviewsReady(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let live = true;
    const sb = getSupabaseClient();
    // No database (local preview): reviews are kept in the browser, so the buttons show
    void (sb ? sb.from('match_reviews').select('match_id').limit(1).then(({ error }) => !error) : Promise.resolve(true))
      .then(ok => { if (live) setReady(ok); });
    return () => { live = false; };
  }, []);
  return ready;
}

/**
 * A value that loads once per `key` and saves itself a moment after each change. `load` answers
 * null when it can't be read (no table yet, offline): the value then stays locked rather than risk
 * writing over saved work. A change still waiting is saved before another key loads and when the
 * page is left; a failed save stays queued for Retry.
 */
function useAutosaved<T>(key: string | null, blank: T, load: () => Promise<T | null>, save: (value: T) => Promise<boolean>) {
  const [value, setValue] = useState<T>(blank);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [failedFor, setFailedFor] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<ReviewSaveState>('idle');
  const pending = useRef<{ value: T; save: (value: T) => Promise<boolean> } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The latest load/save for this key, so the effect below only re-runs when the key changes
  const io = useRef({ load, save });
  useEffect(() => { io.current = { load, save }; }, [load, save]);

  const flush = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    const job = pending.current;
    if (!job) return;
    pending.current = null;
    setSaveState('saving');
    const ok = await job.save(job.value).catch(() => false);
    if (!ok) pending.current ??= job;
    setSaveState(!ok ? 'error' : pending.current ? 'saving' : 'saved');
  }, []);

  useEffect(() => {
    if (!key) return;
    let live = true;
    void (async () => {
      await flush();
      const loaded = await io.current.load().catch(() => null);
      if (!live) return;
      if (loaded === null) { setFailedFor(key); return; }
      setValue(loaded);
      setSaveState('idle');
      setLoadedFor(key);
    })();
    return () => { live = false; };
  }, [key, flush]);

  // Leaving the page or putting the phone away: send what's waiting now
  useEffect(() => {
    const onHide = () => { if (document.visibilityState === 'hidden') void flush(); };
    document.addEventListener('visibilitychange', onHide);
    return () => { document.removeEventListener('visibilitychange', onHide); void flush(); };
  }, [flush]);

  const ready = !!key && loadedFor === key;
  const change = useCallback((next: T) => {
    if (!key || loadedFor !== key) return;
    setValue(next);
    pending.current = { value: next, save: io.current.save };
    setSaveState('saving');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), 1200);
  }, [key, loadedFor, flush]);

  return { ready, failed: !!key && failedFor === key && !ready, value, change, saveState, retry: flush };
}

/** One game's review: the coach's three answers, saved as they type */
export function useMatchReview(clubId: string | undefined, matchId: string | undefined, authorName: string) {
  const load = useCallback(async (): Promise<MatchReview | null> => {
    if (!matchId) return null;
    const sb = getSupabaseClient();
    if (!sb) return readLocal().matches?.[matchId] || emptyReview(matchId);
    const { data, error } = await sb.from('match_reviews').select(REVIEW_COLUMNS).eq('match_id', matchId).maybeSingle();
    if (error) return null;
    return (data as MatchReview | null) || emptyReview(matchId);
  }, [matchId]);

  const save = useCallback(async (review: MatchReview): Promise<boolean> => {
    if (!clubId) return false;
    const sb = getSupabaseClient();
    if (!sb) {
      const local = readLocal();
      return writeLocal({ ...local, matches: { ...local.matches, [review.match_id]: review } });
    }
    const { error } = await sb.from('match_reviews')
      .upsert({ ...review, club_id: clubId, updated_by_name: authorName || null, updated_at: new Date().toISOString() });
    return !error;
  }, [clubId, authorName]);

  const { value, ...rest } = useAutosaved(matchId || null, emptyReview(matchId || ''), load, save);
  return { review: value, ...rest };
}

/** The coach's own summary of a whole cup (table cup_reviews) */
export function useCupSummary(clubId: string | undefined, cup: CupRef | null, authorName: string) {
  const key = cup ? cupKey(cup) : null;
  const rowId = useRef<{ key: string; id: string } | null>(null);
  const { eventId, tournamentId, teamKey } = cup || { teamKey: '' };
  // Who last saved the summary, for the report's "From the coach"
  const [by, setBy] = useState('');

  const load = useCallback(async (): Promise<string | null> => {
    if (!key) return null;
    const sb = getSupabaseClient();
    if (!sb) return readLocal().cups?.[key] || '';
    const q = sb.from('cup_reviews').select('id, summary, updated_by_name').eq('team_key', teamKey);
    const { data, error } = await (eventId ? q.eq('event_id', eventId) : q.eq('tournament_id', tournamentId!)).maybeSingle();
    if (error) return null;
    rowId.current = data ? { key, id: data.id } : null;
    setBy(data?.updated_by_name || '');
    return data?.summary || '';
  }, [key, eventId, tournamentId, teamKey]);

  const save = useCallback(async (summary: string): Promise<boolean> => {
    if (!key || !clubId) return false;
    const sb = getSupabaseClient();
    if (!sb) {
      const local = readLocal();
      return writeLocal({ ...local, cups: { ...local.cups, [key]: summary } });
    }
    const stamp = { summary, updated_by_name: authorName || null, updated_at: new Date().toISOString() };
    if (rowId.current?.key === key) {
      const { error } = await sb.from('cup_reviews').update(stamp).eq('id', rowId.current.id);
      return !error;
    }
    const id = await cupRowId(clubId, { eventId, tournamentId, teamKey }, stamp);
    if (!id) return false;
    rowId.current = { key, id };
    return true;
  }, [key, clubId, eventId, tournamentId, teamKey, authorName]);

  const { value, ...rest } = useAutosaved(key, '', load, save);
  return { summary: value, by, ...rest };
}

/**
 * The id of a cup's row in cup_reviews, making the row when there is none. `fields` are written
 * either way. Null when it can't be saved.
 */
async function cupRowId(clubId: string, cup: CupRef, fields: Record<string, unknown>): Promise<string | null> {
  const sb = getSupabaseClient();
  if (!sb) return null;
  const find = () => {
    const q = sb.from('cup_reviews').select('id').eq('team_key', cup.teamKey);
    return (cup.eventId ? q.eq('event_id', cup.eventId) : q.eq('tournament_id', cup.tournamentId!)).maybeSingle();
  };
  let id: string | undefined = (await find()).data?.id;
  if (!id) {
    const made = await sb.from('cup_reviews')
      .insert({ ...fields, club_id: clubId, event_id: cup.eventId || null, tournament_id: cup.tournamentId || null, team_key: cup.teamKey })
      .select('id').single();
    if (!made.error && made.data) return made.data.id;
    // Someone made the row a moment ago (another tab, a share link): write to that one
    id = (await find()).data?.id;
    if (!id) return null;
  }
  const { error } = await sb.from('cup_reviews').update(fields).eq('id', id);
  return error ? null : id;
}

/** A tournament report's share link: the token in the link and when the shared copy was saved */
export interface CupShare { token: string; sharedAt: string }

const newToken = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
};

/**
 * The share link of a cup's report (migration 20261174). `ready` is false until the database has
 * the share columns, so the Share button stays hidden. `save(report)` makes the link or replaces
 * the copy behind it; `stop()` ends it, after which the old link shows nothing.
 */
export function useCupShare(clubId: string | undefined, cup: CupRef | null) {
  const key = cup ? cupKey(cup) : null;
  const { eventId, tournamentId, teamKey } = cup || { teamKey: '' };
  const [state, setState] = useState<{ key: string; share: CupShare | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!key) return;
    let live = true;
    void (async () => {
      const sb = getSupabaseClient();
      let share: CupShare | null = null;
      if (sb) {
        const q = sb.from('cup_reviews').select('share_token, shared_at').eq('team_key', teamKey);
        const { data, error } = await (eventId ? q.eq('event_id', eventId) : q.eq('tournament_id', tournamentId!)).maybeSingle();
        if (error) return;
        if (data?.share_token) share = { token: data.share_token, sharedAt: data.shared_at };
      } else {
        share = readLocal().shares?.[key]?.share || null;
      }
      if (live) setState({ key, share });
    })();
    return () => { live = false; };
  }, [key, eventId, tournamentId, teamKey]);

  const write = useCallback(async (report: object | null, token: string | null) => {
    if (!key || !clubId) return;
    setBusy(true);
    setFailed(false);
    const sharedAt = new Date().toISOString();
    const share = token ? { token, sharedAt } : null;
    let ok: boolean;
    if (getSupabaseClient()) {
      ok = !!(await cupRowId(clubId, { eventId, tournamentId, teamKey }, { share_token: token, share_report: report, shared_at: token ? sharedAt : null }));
    } else {
      const local = readLocal();
      ok = writeLocal({ ...local, shares: { ...local.shares, [key]: { share, report } } });
    }
    setBusy(false);
    setFailed(!ok);
    if (ok) setState({ key, share });
  }, [key, clubId, eventId, tournamentId, teamKey]);

  const current = state?.key === key ? state : null;
  const token = current?.share?.token;
  return {
    ready: !!current,
    share: current?.share || null,
    busy, failed,
    save: useCallback((report: object) => write(report, token || newToken()), [write, token]),
    stop: useCallback(() => write(null, null), [write]),
  };
}

/** The saved copy behind a share link, with the club it belongs to. Null when the link is wrong or has been stopped. */
export async function loadSharedCupReport(token: string): Promise<{ report: unknown; shared_at: string; club: { name: string; slug: string; logo_url?: string | null; primary_color?: string | null } } | null> {
  const sb = getSupabaseClient();
  if (!sb) {
    const hit = Object.values(readLocal().shares || {}).find(s => s.share?.token === token);
    return hit?.share ? { report: hit.report, shared_at: hit.share.sharedAt, club: { name: (hit.report as { club?: string })?.club || '', slug: '' } } : null;
  }
  const { data, error } = await sb.rpc('shared_cup_report', { p_token: token });
  return error || !data ? null : data;
}

/** The reviews written for some games, by match id. Null when they can't be read. */
export async function loadMatchReviews(matchIds: string[]): Promise<Record<string, MatchReview> | null> {
  if (matchIds.length === 0) return {};
  const sb = getSupabaseClient();
  if (!sb) {
    const all = readLocal().matches || {};
    return Object.fromEntries(matchIds.filter(id => all[id]).map(id => [id, all[id]]));
  }
  const { data, error } = await sb.from('match_reviews').select(REVIEW_COLUMNS).in('match_id', matchIds);
  if (error || !data) return null;
  return Object.fromEntries((data as MatchReview[]).map(r => [r.match_id, r]));
}

/** Saved player stats for some games, by match id (match_player_stats). Empty when none are saved or readable. */
export async function loadStatLines(matchIds: string[]): Promise<Record<string, MatchStatLine[]>> {
  const sb = getSupabaseClient();
  if (!sb || matchIds.length === 0) return {};
  const { data, error } = await sb.from('match_player_stats')
    .select('match_id, member_id, played, minutes, goals, assists, yellow_cards, red_cards, clean_sheet, motm')
    .in('match_id', matchIds);
  if (error || !data) return {};
  const by: Record<string, MatchStatLine[]> = {};
  for (const row of data as (MatchStatLine & { match_id: string })[]) (by[row.match_id] ||= []).push(row);
  return by;
}
