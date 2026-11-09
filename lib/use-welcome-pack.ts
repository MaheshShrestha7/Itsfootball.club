'use client';

// The welcome pack for whoever is signed in, with what the club already has (lib/welcome-pack.ts).
// Used by the "Start here" page and the admin menu's "4 of 11" note.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from './auth-context';
import { useClub } from './club-context';
import { getAccessToken, getSupabaseClient } from './supabase/client';
import { factsFrom, laterFor, packFor, packProgress } from './welcome-pack';

/** Same key the dashboard's "Get your club ready" list uses for Copy link */
export const SHARED_KEY = (clubId: string) => `itsfootball_setup_shared_${clubId}`;
/** Steps ticked by hand ("Mark as done"), as a JSON list of step keys */
const TICKED_KEY = (clubId: string) => `itsfootball_start_${clubId}`;
/** Tells every open copy of the hook (page and menu) to read the ticks again */
const CHANGE_EVENT = 'welcome-pack-change';

function readTicked(clubId: string): Set<string> {
  try {
    const list = JSON.parse(localStorage.getItem(TICKED_KEY(clubId)) || '[]');
    return new Set(Array.isArray(list) ? list.map(String) : []);
  } catch { return new Set(); }
}

function readShared(clubId: string): boolean {
  try { return localStorage.getItem(SHARED_KEY(clubId)) === '1'; } catch { return false; }
}

export function useWelcomePack(club: { id: string; logo_url?: string | null }) {
  const clubId = club.id;
  const { isClubSuperUser, getClubAccess } = useAuth();
  const { seasons, clubTeams, clubTeamMembers, members, matches } = useClub();
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  const [sharedFlag, setSharedFlag] = useState(false);
  const [plans, setPlans] = useState<number | null>(null);
  const [stripe, setStripe] = useState(false);
  const [helperRoles, setHelperRoles] = useState<string[]>([]);

  const isSuper = isClubSuperUser(clubId);
  const access = getClubAccess(clubId);
  const viewer = useMemo(() => ({ isSuper, areas: access?.areas || {} }), [isSuper, access]);
  const groups = useMemo(() => packFor(viewer), [viewer]);
  const later = useMemo(() => laterFor(viewer), [viewer]);

  useEffect(() => {
    const sync = () => { setTicked(readTicked(clubId)); setSharedFlag(readShared(clubId)); };
    sync();
    window.addEventListener(CHANGE_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => { window.removeEventListener(CHANGE_EVENT, sync); window.removeEventListener('storage', sync); };
  }, [clubId]);

  // Only what the club context doesn't already hold, and only what this person's steps need
  const steps = groups.flatMap(g => g.steps.map(s => s.key));
  const needPlans = steps.includes('plans');
  const needStripe = steps.includes('stripe');
  const needHelper = steps.includes('helper');
  useEffect(() => {
    const db = getSupabaseClient();
    if (!db) { setPlans(0); return; }
    let live = true;
    Promise.all([
      needPlans ? db.from('membership_plans').select('id', { count: 'exact', head: true }).eq('club_id', clubId) : null,
      needStripe ? db.from('club_payment_settings').select('stripe_charges_enabled').eq('club_id', clubId).maybeSingle() : null,
      needHelper ? db.from('club_access_roles').select('name').eq('club_id', clubId).eq('is_super', false) : null,
    ]).then(([p, s, r]) => {
      if (!live) return;
      setPlans(p?.count ?? 0);
      setStripe(!!(s?.data as { stripe_charges_enabled?: boolean } | null)?.stripe_charges_enabled);
      setHelperRoles(((r?.data as { name: string }[] | null) || []).map(x => x.name));
    }).catch(() => { if (live) setPlans(0); });
    return () => { live = false; };
  }, [clubId, needPlans, needStripe, needHelper]);

  const facts = useMemo(() => {
    const teamIds = new Set(clubTeams.filter(t => t.club_id === clubId).map(t => t.id));
    return factsFrom({
      logoUrl: club.logo_url,
      seasons: seasons.filter(s => s.club_id === clubId).length,
      teams: teamIds.size,
      teamMembers: clubTeamMembers.filter(tm => teamIds.has(tm.team_id)).length,
      plans: plans ?? 0,
      stripe,
      fixtures: matches.filter(m => m.club_id === clubId).length,
      members: members.filter(m => m.club_id === clubId),
      helperRoles,
      sharedFlag,
    });
  }, [club.logo_url, clubId, seasons, clubTeams, clubTeamMembers, plans, stripe, matches, members, helperRoles, sharedFlag]);

  const progress = useMemo(() => packProgress(groups, facts, ticked), [groups, facts, ticked]);

  /** Tick or untick a step by hand */
  const setDone = useCallback((key: string, done: boolean) => {
    const next = readTicked(clubId);
    if (done) next.add(key); else next.delete(key);
    try {
      localStorage.setItem(TICKED_KEY(clubId), JSON.stringify([...next]));
      if (key === 'share' && done) localStorage.setItem(SHARED_KEY(clubId), '1');
      if (key === 'share' && !done) localStorage.removeItem(SHARED_KEY(clubId));
    } catch { /* private mode: the tick lasts until the page reloads */ }
    setTicked(next);
    if (key === 'share') setSharedFlag(done);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, [clubId]);

  return { groups, later, facts, ticked, progress, setDone, ready: plans !== null };
}

/**
 * Email the signed-in admin their welcome pack after they start running a club (invite accepted,
 * club made). Fire and forget: it survives the page moving on, and a failure only skips the email.
 */
export async function sendWelcomePack(club: { clubId?: string; clubSlug?: string }) {
  try {
    const token = await getAccessToken();
    if (!token) return;
    await fetch('/api/admin/welcome-pack', {
      method: 'POST',
      keepalive: true,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ...club, why: 'new' }),
    });
  } catch { /* the Start here page has it all anyway */ }
}
