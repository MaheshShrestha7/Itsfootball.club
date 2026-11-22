'use client';

import { useCallback, useEffect, useState } from 'react';
import { getSupabaseClient } from '@/lib/supabase/client';
import { useAutosaved } from '@/lib/use-match-reviews';
import { DEFAULT_SOCIAL, readSocialSettings, type SocialMark, type SocialSettings } from '@/lib/social-posts';

// Admin > Social media's saved parts (migration 20261187): the club's rules and hashtags, and what
// admins did with each post. Without the migration (or a database) they stay in this browser.

const LOCAL_KEY = 'itsfootball_social_v1';
type Local = Record<string, { settings?: SocialSettings; marks?: Record<string, SocialMark> }>;
const readLocal = (): Local => { try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || '{}') || {}; } catch { return {}; } };
const writeLocal = (next: Local) => { try { localStorage.setItem(LOCAL_KEY, JSON.stringify(next)); return true; } catch { return false; } };

/** True once the database has the social tables; false shows "saved in this browser only" */
export function useSocialReady(): boolean | null {
  const [ready, setReady] = useState<boolean | null>(null);
  useEffect(() => {
    let live = true;
    const sb = getSupabaseClient();
    void (sb ? sb.from('social_post_marks').select('post_key', { head: true }).limit(1).then(({ error }) => !error) : Promise.resolve(false))
      .then(ok => { if (live) setReady(ok); });
    return () => { live = false; };
  }, []);
  return ready;
}

export function useSocialSettings(clubId: string, db: boolean | null, authorName: string) {
  const load = useCallback(async (): Promise<SocialSettings | null> => {
    const sb = getSupabaseClient();
    if (!sb || !db) return readSocialSettings(readLocal()[clubId]?.settings);
    const { data, error } = await sb.from('social_settings').select('rules, hashtags').eq('club_id', clubId).maybeSingle();
    return error ? null : data ? readSocialSettings(data) : DEFAULT_SOCIAL;
  }, [clubId, db]);

  const save = useCallback(async (s: SocialSettings): Promise<boolean> => {
    const sb = getSupabaseClient();
    if (!sb || !db) {
      const local = readLocal();
      return writeLocal({ ...local, [clubId]: { ...local[clubId], settings: s } });
    }
    const { error } = await sb.from('social_settings').upsert(
      { club_id: clubId, rules: s.rules, hashtags: s.hashtags, updated_by_name: authorName || null, updated_at: new Date().toISOString() },
      { onConflict: 'club_id' });
    return !error;
  }, [clubId, db, authorName]);

  const { value, ...rest } = useAutosaved(db === null ? null : `${clubId}:${db}`, DEFAULT_SOCIAL, load, save);
  return { settings: value, ...rest };
}

/** What admins did with each post in the last month, and setting or clearing a mark */
export function useSocialMarks(clubId: string, db: boolean | null, authorName: string) {
  const [marks, setMarks] = useState<Record<string, SocialMark> | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (db === null) return;
    let live = true;
    void (async () => {
      const sb = getSupabaseClient();
      let next: Record<string, SocialMark> = {};
      if (sb && db) {
        const since = new Date(Date.now() - 31 * 864e5).toISOString();
        const { data, error: err } = await sb.from('social_post_marks').select('post_key, status, caption, by_name, at')
          .eq('club_id', clubId).gte('at', since).order('at', { ascending: false }).limit(500);
        if (err) { if (live) setError(true); return; }
        next = Object.fromEntries((data || []).map(r => [r.post_key, { status: r.status, caption: r.caption, by_name: r.by_name, at: r.at }]));
      } else {
        next = readLocal()[clubId]?.marks || {};
      }
      if (live) setMarks(next);
    })();
    return () => { live = false; };
  }, [clubId, db]);

  /** Sets (or with status null, clears) a post's mark; false when it didn't save */
  const mark = useCallback(async (key: string, status: SocialMark['status'] | null, caption?: string): Promise<boolean> => {
    const row: SocialMark | null = status ? { status, caption: caption ?? null, by_name: authorName || null, at: new Date().toISOString() } : null;
    const sb = getSupabaseClient();
    let ok: boolean;
    if (sb && db) {
      const { error: err } = row
        ? await sb.from('social_post_marks').upsert({ club_id: clubId, post_key: key, ...row }, { onConflict: 'club_id,post_key' })
        : await sb.from('social_post_marks').delete().eq('club_id', clubId).eq('post_key', key);
      ok = !err;
    } else {
      const local = readLocal();
      const own = { ...local[clubId]?.marks };
      if (row) own[key] = row; else delete own[key];
      ok = writeLocal({ ...local, [clubId]: { ...local[clubId], marks: own } });
    }
    if (ok) setMarks(prev => {
      const next = { ...prev };
      if (row) next[key] = row; else delete next[key];
      return next;
    });
    return ok;
  }, [clubId, db, authorName]);

  return { marks, error, mark };
}
