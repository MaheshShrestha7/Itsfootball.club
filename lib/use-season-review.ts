'use client';

import { useCallback, useEffect, useState } from 'react';
import { getSupabaseClient } from '@/lib/supabase/client';
import { fetchPaged } from '@/lib/paged';
import { emptyExtras, readExtras, type SeasonExtras } from '@/lib/season-review';
import { newToken, useAutosaved, type CupShare } from '@/lib/use-match-reviews';
import type { MatchStatLine } from '@/lib/match-stats';
import type { EventAttendee } from '@/lib/supabase/types';

// The Season review's saved parts (migration 20261179) and the records it reads that the club
// context doesn't hold. Without a database (local preview) the saved parts stay in this browser.

const LOCAL_KEY = 'itsfootball_season_review_v1';
type Local = Record<string, { extras?: SeasonExtras; share?: CupShare | null; report?: unknown }>;
const readLocal = (): Local => { try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || '{}') || {}; } catch { return {}; } };
const writeLocal = (next: Local) => { try { localStorage.setItem(LOCAL_KEY, JSON.stringify(next)); return true; } catch { return false; } };
const keyOf = (clubId: string, season: string) => `${clubId}:${season}`;

/** True once the database has season_reviews. Until then the awards, thanks and Share boxes stay hidden. */
export function useSeasonReviewReady(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let live = true;
    const sb = getSupabaseClient();
    void (sb ? sb.from('season_reviews').select('season').limit(1).then(({ error }) => !error) : Promise.resolve(true))
      .then(ok => { if (live) setReady(ok); });
    return () => { live = false; };
  }, []);
  return ready;
}

/** The awards, extra names and switches for one season, saved as the committee changes them */
export function useSeasonExtras(clubId: string | undefined, season: string | undefined, authorName: string) {
  const load = useCallback(async (): Promise<SeasonExtras | null> => {
    if (!clubId || !season) return null;
    const sb = getSupabaseClient();
    if (!sb) return readLocal()[keyOf(clubId, season)]?.extras || emptyExtras();
    const { data, error } = await sb.from('season_reviews').select('awards, thanks, hide_money, hide_replies').eq('club_id', clubId).eq('season', season).maybeSingle();
    return error ? null : readExtras(data);
  }, [clubId, season]);

  const save = useCallback(async (x: SeasonExtras): Promise<boolean> => {
    if (!clubId || !season) return false;
    const sb = getSupabaseClient();
    if (!sb) {
      const local = readLocal();
      const k = keyOf(clubId, season);
      return writeLocal({ ...local, [k]: { ...local[k], extras: x } });
    }
    // Upsert leaves the share link alone on an existing row
    const { error } = await sb.from('season_reviews').upsert(
      { club_id: clubId, season, ...x, updated_by_name: authorName || null, updated_at: new Date().toISOString() },
      { onConflict: 'club_id,season' });
    return !error;
  }, [clubId, season, authorName]);

  const { value, ...rest } = useAutosaved(clubId && season ? keyOf(clubId, season) : null, emptyExtras(), load, save);
  return { extras: value, ...rest };
}

/** The season's share link. `save(report)` makes the link or replaces the copy behind it; `stop()` ends it. */
export function useSeasonShare(clubId: string | undefined, season: string | undefined) {
  const key = clubId && season ? keyOf(clubId, season) : null;
  const [state, setState] = useState<{ key: string; share: CupShare | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!key || !clubId || !season) return;
    let live = true;
    void (async () => {
      const sb = getSupabaseClient();
      let share: CupShare | null = null;
      if (sb) {
        const { data, error } = await sb.from('season_reviews').select('share_token, shared_at').eq('club_id', clubId).eq('season', season).maybeSingle();
        if (error) return;
        if (data?.share_token) share = { token: data.share_token, sharedAt: data.shared_at };
      } else {
        share = readLocal()[key]?.share || null;
      }
      if (live) setState({ key, share });
    })();
    return () => { live = false; };
  }, [key, clubId, season]);

  const write = useCallback(async (report: object | null, token: string | null) => {
    if (!key || !clubId || !season) return;
    setBusy(true);
    setFailed(false);
    const sharedAt = new Date().toISOString();
    const share = token ? { token, sharedAt } : null;
    let ok: boolean;
    const sb = getSupabaseClient();
    if (sb) {
      const { error } = await sb.from('season_reviews').upsert(
        { club_id: clubId, season, share_token: token, share_report: report, shared_at: token ? sharedAt : null },
        { onConflict: 'club_id,season' });
      ok = !error;
    } else {
      const local = readLocal();
      ok = writeLocal({ ...local, [key]: { ...local[key], share, report } });
    }
    setBusy(false);
    setFailed(!ok);
    if (ok) setState({ key, share });
  }, [key, clubId, season]);

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

export type SharedClub = { name: string; slug: string; logo_url?: string | null; primary_color?: string | null };

/** The saved review behind a share link, with its club. Null when the link is wrong or has been stopped. */
export async function loadSharedSeasonReview(token: string): Promise<{ report: unknown; shared_at: string; club: SharedClub } | null> {
  const sb = getSupabaseClient();
  if (!sb) {
    const hit = Object.values(readLocal()).find(x => x.share?.token === token);
    return hit?.share ? { report: hit.report, shared_at: hit.share.sharedAt, club: { name: (hit.report as { club?: string })?.club || '', slug: '' } } : null;
  }
  const { data, error } = await sb.rpc('shared_season_review', { p_token: token });
  return error || !data ? null : data;
}

// ---------------------------------------------------------------------------
// Records read straight from the database. Each part is null when it can't be read (no access, no
// table), and the review leaves that section out rather than showing a wrong number.
// ---------------------------------------------------------------------------

export interface SeasonRecords {
  statLines: Record<string, MatchStatLine[]>;
  attendees: EventAttendee[] | null;
  ticketPayments: Map<string, { amount_cents: number; status: string }> | null;
  sponsorCounts: Record<string, { views: number; clicks: number; scans: number }> | null;
  eventNotes: { eventId: string; went_well: string; next_time: string }[] | null;
}

const MAX = 100000;

export async function loadSeasonRecords(opts: {
  clubId: string; matchIds: string[]; eventIds: string[]; sponsorIds: string[]; from: string | null; to: string | null; committee: boolean;
}): Promise<SeasonRecords> {
  const sb = getSupabaseClient();
  const out: SeasonRecords = { statLines: {}, attendees: null, ticketPayments: null, sponsorCounts: null, eventNotes: null };
  if (!sb) return out;
  const chunks = <T,>(xs: T[], n = 150) => Array.from({ length: Math.ceil(xs.length / n) }, (_, k) => xs.slice(k * n, k * n + n));

  const statJob = (async () => {
    for (const ids of chunks(opts.matchIds)) {
      const { data, error } = await sb.from('match_player_stats')
        .select('match_id, member_id, played, minutes, goals, assists, yellow_cards, red_cards, clean_sheet, motm').in('match_id', ids);
      if (error || !data) return;
      for (const row of data as (MatchStatLine & { match_id: string })[]) (out.statLines[row.match_id] ||= []).push(row);
    }
  })();

  const attendeeJob = (async () => {
    if (!opts.eventIds.length) { out.attendees = []; out.ticketPayments = new Map(); return; }
    const rows: EventAttendee[] = [];
    for (const ids of chunks(opts.eventIds)) {
      const { data, error } = await fetchPaged<EventAttendee>((f, t) => sb.from('event_attendees')
        .select('id, event_id, club_id, member_id, attendee_name, checkin_status, checked_in_at, qr_ticket_code, payment_id')
        .in('event_id', ids).order('id').range(f, t), MAX);
      if (error) return;
      rows.push(...data);
    }
    out.attendees = rows;
    const payIds = [...new Set(rows.map(r => r.payment_id).filter((x): x is string => !!x))];
    const pays = new Map<string, { amount_cents: number; status: string }>();
    for (const ids of chunks(payIds)) {
      const { data, error } = await sb.from('payments').select('id, amount_cents, status').in('id', ids);
      if (error || !data) return;
      for (const p of data as { id: string; amount_cents: number; status: string }[]) pays.set(p.id, p);
    }
    out.ticketPayments = pays;
  })();

  // Sponsor numbers for the season: counted on the server, a few small requests per sponsor
  const sponsorJob = (async () => {
    if (!opts.from || !opts.to || !opts.sponsorIds.length) return;
    const counts: Record<string, { views: number; clicks: number; scans: number }> = {};
    const count = async (id: string, types: string[]) => {
      const { count: n, error } = await sb.from('sponsor_analytics').select('id', { count: 'exact', head: true })
        .eq('club_id', opts.clubId).eq('sponsor_id', id).in('event_type', types).gte('created_at', opts.from!).lte('created_at', opts.to!);
      if (error) throw error;
      return n || 0;
    };
    try {
      await Promise.all(opts.sponsorIds.map(async id => {
        const [views, clicks, scans] = await Promise.all([count(id, ['impression']), count(id, ['click']), count(id, ['scan'])]);
        counts[id] = { views, clicks, scans };
      }));
      out.sponsorCounts = counts;
    } catch { /* no access: the wall shows logos without numbers */ }
  })();

  const notesJob = (async () => {
    if (!opts.committee || !opts.eventIds.length) return;
    const { data, error } = await sb.from('event_reviews').select('event_id, went_well, next_time').in('event_id', opts.eventIds.slice(0, 300));
    if (!error && data) out.eventNotes = (data as { event_id: string; went_well: string; next_time: string }[]).map(r => ({ eventId: r.event_id, went_well: r.went_well || '', next_time: r.next_time || '' }));
  })();

  await Promise.all([statJob, attendeeJob, sponsorJob, notesJob]);
  return out;
}
