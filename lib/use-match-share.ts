'use client';

import { useCallback, useMemo } from 'react';
import { useClub } from '@/lib/club-context';
import { lineupBench } from '@/lib/lineup-bench';
import { GOAL_EVENT_TYPES, isJuniorFixture, juniorMemberIds, juniorPublicName, publicMember, publicScoreHidden } from '@/lib/teams';
import { isPlayerMember, type Club, type Match } from '@/lib/supabase/types';

/** What a club's match graphics need, named as the public match page names people: goals, player
 *  photos, the Team list's substitutes and the Player of the Match, with junior players shortened.
 *  Used by Admin > Matches and Admin > Social media. */
export function useMatchShare(club: Club) {
  const { matches, clubTeams, matchEvents, members, clubTeamMembers, activityLogs, getMatchAvailabilities } = useClub();
  const clubMatches = useMemo(() => matches.filter(m => m.club_id === club.id), [matches, club.id]);
  // Goals for the share graphics, with the same public names as the match page (junior players shortened)
  const goalsByMatch = useMemo(() => {
    const byMatch = new Map<string, typeof matchEvents>();
    for (const e of matchEvents) {
      if (!GOAL_EVENT_TYPES.includes(e.event_type)) continue;
      const m = clubMatches.find(x => x.id === e.match_id);
      if (!m) continue;
      const ev = isJuniorFixture(m, clubTeams) ? { ...e, player_name: juniorPublicName(e.player_name) } : e;
      byMatch.set(m.id, [...(byMatch.get(m.id) || []), ev]);
    }
    return byMatch;
  }, [matchEvents, clubMatches, clubTeams]);
  // The share graphic is public: lineup names and photos follow the match page's junior rules
  const juniorIds = useMemo(() => juniorMemberIds(members, clubTeams, clubTeamMembers, { includeU18: club.junior_includes_u18 !== false }), [members, clubTeams, clubTeamMembers, club.junior_includes_u18]);
  const memberPhotos = useMemo(() => Object.fromEntries(members.map(m => [m.id, publicMember(m, juniorIds).photo_url])), [members, juniorIds]);
  // Each fixture's Player of the Match (from the verified stats), named as the match page shows them
  const motmByMatch = useMemo(() => {
    const byId = new Map(members.map(m => [m.id, m]));
    return new Map(activityLogs.filter(l => l.event_type === 'match_motm' && l.reference_id && byId.has(l.member_id)).map(l => {
      const m = publicMember(byId.get(l.member_id)!, juniorIds);
      return [l.reference_id!, { name: m.full_name, photo: m.photo_url }];
    }));
  }, [activityLogs, members, juniorIds]);
  const publicMatches = useMemo(() => new Map(clubMatches.map(m => {
    const juniorFixture = isJuniorFixture(m, clubTeams);
    if (!juniorFixture && juniorIds.size === 0) return [m.id, m];
    const shorten = (coords: Match['home_lineup_coords']) => coords?.map(p =>
      juniorFixture || (p.member_id && juniorIds.has(p.member_id)) ? { ...p, name: juniorPublicName(p.name) } : p);
    return [m.id, { ...m, home_lineup_coords: shorten(m.home_lineup_coords), away_lineup_coords: shorten(m.away_lineup_coords) }];
  })), [clubMatches, clubTeams, juniorIds]);

  // The share graphic's Team list: the substitutes after the starters, as the match page lists them
  // (the named bench, else the other players who said they're in), with the same public names
  const shareSquad = useMemo(() => members.filter(p => p.club_id === club.id && isPlayerMember(p)).map(p => publicMember(p, juniorIds)), [members, club.id, juniorIds]);
  const shareSubs = useCallback((m: Match) => {
    const juniorFixture = isJuniorFixture(m, clubTeams);
    const inIds = new Set(getMatchAvailabilities(m.id).filter(a => a.status === 'available').map(a => a.member_id));
    const side = (m.is_club_home ?? true) ? 'home' : 'away';
    return lineupBench(m, side, shareSquad, shareSquad.filter(p => inIds.has(p.id)))
      .map(p => ({ number: p.jersey_number || 0, name: juniorFixture ? juniorPublicName(p.full_name) : p.full_name }));
  }, [clubTeams, getMatchAvailabilities, shareSquad]);

  /** The props MatchShareButton takes for one fixture */
  return useCallback((m: Match) => ({
    match: publicMatches.get(m.id) || m,
    club,
    hideScore: publicScoreHidden(m, clubTeams),
    events: goalsByMatch.get(m.id),
    photos: memberPhotos,
    subs: shareSubs(m),
    motm: motmByMatch.get(m.id),
  }), [publicMatches, club, clubTeams, goalsByMatch, memberPhotos, shareSubs, motmByMatch]);
}
