'use client';

import { useEffect, useMemo, useState } from 'react';
import { useClub } from '@/lib/club-context';
import { formatClock, formatShortDay } from '@/lib/dates';
import { hasKickoffTime, soonestFirst, tournamentTeamGroups } from '@/lib/fixtures';
import type { MatchReview } from '@/lib/match-review';
import type { MatchStatLine } from '@/lib/match-stats';
import { compareTournamentMatches, tournamentMatchLabel } from '@/lib/tournament-engine';
import type { Match } from '@/lib/supabase/types';
import { loadMatchReviews, loadStatLines, type CupRef } from '@/lib/use-match-reviews';

/** One of the club's teams in the cup, with its games in playing order */
export interface CupTeam { key: string; name?: string; games: Match[] }

/** "Sat, 22 Nov · 9:00 am · Semi-Final" */
export const gameWhen = (m: Match) => [
  formatShortDay(m.match_date, hasKickoffTime(m)),
  !hasKickoffTime(m) && m.match_time ? formatClock(m.match_time) : null,
  tournamentMatchLabel(m),
].filter(Boolean).join(' · ');

/**
 * A cup's games for the cup review and the tournament report: the event (an outside cup) or the
 * club's own tournament from the address, the club's teams in it, the team being looked at, and
 * that team's match reviews and saved player stats.
 */
export function useCupGames(clubSlug: string, ids: { event?: string; tournament?: string; team?: string }) {
  const { clubs, selectClubBySlug, matches, events: clubEvents, tournaments, tournamentParticipants, clubTeams } = useClub();
  const club = selectClubBySlug(clubSlug) || clubs[0];

  const event = ids.event ? clubEvents.find(e => e.id === ids.event && e.club_id === club.id) : undefined;
  const tournament = !event && ids.tournament ? tournaments.find(t => t.id === ids.tournament && t.club_id === club.id) : undefined;
  const cupName = event?.title || tournament?.name;

  // By club team for an event, by entry for a tournament. A tournament with none of the club's own
  // entries is listed whole, without a result for "us".
  const teams = useMemo<CupTeam[]>(() => {
    const own = matches.filter(m => m.club_id === club.id);
    if (event) {
      const games = own.filter(m => m.event_id === event.id).sort(soonestFirst);
      const teamIds = [...new Set(games.map(m => m.team_id || ''))];
      return teamIds.map(id => ({ key: id, name: clubTeams.find(t => t.id === id)?.name, games: games.filter(m => (m.team_id || '') === id) }));
    }
    if (tournament) {
      const games = own.filter(m => m.tournament_id === tournament.id);
      const groups = tournamentTeamGroups(games, tournamentParticipants.filter(p => p.tournament_id === tournament.id));
      return groups.length
        ? groups.map(g => ({ key: g.participant.id, name: g.participant.name, games: g.games }))
        : [{ key: '', games: [...games].sort(compareTournamentMatches) }];
    }
    return [];
  }, [matches, club.id, event, tournament, clubTeams, tournamentParticipants]);

  const [teamKey, setTeamKey] = useState(ids.team || '');
  const team = teams.find(t => t.key === teamKey) || teams[0];
  const games = useMemo(() => team?.games || [], [team]);
  const idList = games.map(m => m.id).join(',');

  // Null reviews: they couldn't be read (no table yet, or offline)
  const [reviews, setReviews] = useState<Record<string, MatchReview> | null>({});
  const [lines, setLines] = useState<Record<string, MatchStatLine[]>>({});
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    const matchIds = idList ? idList.split(',') : [];
    void Promise.all([loadMatchReviews(matchIds), loadStatLines(matchIds)]).then(([r, l]) => {
      if (!live) return;
      setReviews(r);
      setLines(l);
      setLoadedFor(idList);
    });
    return () => { live = false; };
  }, [idList]);

  const cup: CupRef | null = team && (event || tournament) ? { eventId: event?.id, tournamentId: tournament?.id, teamKey: team.key } : null;
  const query = `${event ? `event=${event.id}` : `tournament=${tournament?.id}`}${team?.key ? `&team=${team.key}` : ''}`;
  return {
    club, event, tournament, cupName, teams, team, setTeamKey, games, reviews, lines, cup, query,
    /** Reviews and stats for the team on screen have arrived */
    loaded: loadedFor === idList,
    // Only a tournament needs the team's name to tell which side is ours
    ourName: tournament ? team?.name : undefined,
  };
}
