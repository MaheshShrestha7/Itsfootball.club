'use client';

// Clubs already on itsfootball.club linked as teams in another club's tournament (migration 20261197).
// Read straight from the database, not part of the background sync. Before the migration every read
// errors, so `ready` stays false and the "Find a club" search and the invitations stay hidden.
import { useCallback, useEffect, useState } from 'react';
import { getSupabaseClient } from '@/lib/supabase/client';
import { isListedClub } from '@/lib/public-tournaments';
import type { Match } from '@/lib/supabase/types';

export type LinkStatus = 'pending' | 'accepted' | 'declined';

export interface TournamentLink {
  participant_id: string;
  tournament_id: string;
  linked_club_id: string;
  linked_team_id: string | null;
  status: LinkStatus;
  show_on_linked_site: boolean;
  linked: { name: string; slug: string } | null;
}

/** What the Add a club popup hands back when the host picked a club from the search */
export interface LinkPick {
  club_id: string;
  club_name: string;
  team_id: string | null;
  show: boolean;
}

export interface FoundClub {
  id: string;
  slug: string;
  name: string;
  logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  teams: { id: string; name: string; logo_url: string | null; color: string | null }[];
}

// The database fills these from the team (tournament_club_link_fill)
const FILLED = { tournament_id: '00000000-0000-0000-0000-000000000000', host_club_id: '00000000-0000-0000-0000-000000000000' };

/** Clubs on the platform whose name contains `q` (not the host itself, event-only or hidden test clubs) */
export async function findClubs(q: string, hostClubId: string): Promise<FoundClub[]> {
  const db = getSupabaseClient();
  const term = q.trim();
  if (!db || term.length < 2) return [];
  const { data } = await db.from('clubs')
    .select('id, slug, name, logo_url, primary_color, secondary_color, config')
    .ilike('name', `%${term.replace(/[\\%_]/g, '\\$&')}%`)
    .neq('id', hostClubId)
    .order('name')
    .limit(12);
  const clubs = (data || []).filter(isListedClub).slice(0, 8);
  if (!clubs.length) return [];
  const { data: teams } = await db.from('club_teams')
    .select('id, club_id, name, logo_url, color, sort_order')
    .in('club_id', clubs.map(c => c.id))
    .order('sort_order');
  return clubs.map(c => ({
    id: c.id, slug: c.slug, name: c.name, logo_url: c.logo_url, primary_color: c.primary_color, secondary_color: c.secondary_color,
    teams: (teams || []).filter(t => t.club_id === c.id).map(t => ({ id: t.id, name: t.name, logo_url: t.logo_url, color: t.color })),
  }));
}

/** Saves (adds or changes) the link for one tournament team; returns an error message, or null */
export async function saveLink(participantId: string, pick: Pick<LinkPick, 'club_id' | 'team_id' | 'show'>): Promise<string | null> {
  const db = getSupabaseClient();
  if (!db) return 'Not connected.';
  const { error } = await db.from('tournament_club_links').upsert({
    ...FILLED, participant_id: participantId, linked_club_id: pick.club_id, linked_team_id: pick.team_id, show_on_linked_site: pick.show,
  }, { onConflict: 'participant_id' });
  return error ? error.message : null;
}

export async function removeLink(participantId: string): Promise<string | null> {
  const { error } = await getSupabaseClient()!.from('tournament_club_links').delete().eq('participant_id', participantId);
  return error ? error.message : null;
}

/** True once migration 20261197 has run (the table answers) */
export function useLinksReady(enabled = true) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const db = getSupabaseClient();
    if (!db || !enabled) return;
    db.from('tournament_club_links').select('participant_id', { head: true, count: 'exact' }).limit(1)
      .then(({ error }) => setReady(!error));
  }, [enabled]);
  return ready;
}

/** A tournament's links. The host's staff see them all; visitors only see accepted ones (row-level security). */
export function useTournamentLinks(tournamentId: string | undefined) {
  const [links, setLinks] = useState<TournamentLink[]>([]);
  const [ready, setReady] = useState(false);
  const reload = useCallback(async () => {
    const db = getSupabaseClient();
    if (!db || !tournamentId) return;
    const { data, error } = await db.from('tournament_club_links')
      .select('participant_id, tournament_id, linked_club_id, linked_team_id, status, show_on_linked_site, linked:clubs!linked_club_id(name, slug)')
      .eq('tournament_id', tournamentId);
    setReady(!error);
    if (!error) setLinks((data || []) as unknown as TournamentLink[]);
  }, [tournamentId]);
  useEffect(() => { reload(); }, [reload]);
  return { links, ready, reload, linkOf: (participantId: string) => links.find(l => l.participant_id === participantId) };
}

export interface LinkInvite {
  participant_id: string;
  tournament: { id: string; name: string; slug: string; start_date: string | null; venue: string | null } | null;
  host: { name: string; slug: string; logo_url: string | null } | null;
  team: { name: string } | null;
  club_team: { name: string } | null;
}

/** Invitations waiting for this club's answer (its admin dashboard) */
export function useLinkInvites(clubId: string) {
  const [invites, setInvites] = useState<LinkInvite[]>([]);
  const reload = useCallback(async () => {
    const db = getSupabaseClient();
    if (!db) return;
    const { data, error } = await db.from('tournament_club_links')
      .select('participant_id, tournament:tournaments(id, name, slug, start_date, venue), host:clubs!host_club_id(name, slug, logo_url), team:tournament_participants(name), club_team:club_teams(name)')
      .eq('linked_club_id', clubId).eq('status', 'pending');
    if (!error) setInvites((data || []) as unknown as LinkInvite[]);
  }, [clubId]);
  useEffect(() => { reload(); }, [reload]);
  const respond = useCallback(async (participantId: string, accept: boolean) => {
    const { error } = await getSupabaseClient()!.rpc('respond_tournament_link', { p_participant_id: participantId, p_accept: accept });
    if (!error) setInvites(list => list.filter(i => i.participant_id !== participantId));
    return error ? error.message : null;
  }, []);
  return { invites, respond };
}

export type LinkedGame = Match & { hostSlug: string };

/** Turns one of the host's tournament games into this club's fixture, or null when the team isn't in it */
export function asLinkedGame(m: Match, teamName: string, teamId: string | null, hostSlug: string): LinkedGame | null {
  const name = teamName.trim().toLowerCase();
  const home = (m.home_team_name || '').trim().toLowerCase() === name;
  const away = (m.away_team_name || '').trim().toLowerCase() === name;
  if (home === away) return null;
  return { ...m, is_club_home: home, opponent_name: (home ? m.away_team_name : m.home_team_name) || m.opponent_name, team_id: teamId ?? undefined, hostSlug } as LinkedGame;
}

/** Games in other clubs' tournaments this club accepted and the host chose to show here (public Fixtures) */
export function useLinkedGames(clubId: string) {
  const [games, setGames] = useState<LinkedGame[]>([]);
  useEffect(() => {
    const db = getSupabaseClient();
    if (!db || !clubId) return;
    let stale = false;
    (async () => {
      const { data: links, error } = await db.from('tournament_club_links')
        .select('tournament_id, linked_team_id, host:clubs!host_club_id(slug), team:tournament_participants(name)')
        .eq('linked_club_id', clubId).eq('status', 'accepted').eq('show_on_linked_site', true);
      if (error || !links?.length) return;
      const { data: ms } = await db.from('matches').select('*').in('tournament_id', [...new Set(links.map(l => l.tournament_id))]);
      if (stale) return;
      setGames(links.flatMap(l => {
        const link = l as unknown as { tournament_id: string; linked_team_id: string | null; host: { slug: string } | null; team: { name: string } | null };
        if (!link.team || !link.host) return [];
        return ((ms || []) as Match[]).filter(m => m.tournament_id === link.tournament_id)
          .map(m => asLinkedGame(m, link.team!.name, link.linked_team_id, link.host!.slug))
          .filter((g): g is LinkedGame => !!g);
      }));
    })().catch(() => {});
    return () => { stale = true; };
  }, [clubId]);
  return games;
}
