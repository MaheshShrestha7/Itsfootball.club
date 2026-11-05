'use client';

import React, { use, useMemo, useState } from 'react';
import Link from 'next/link';
import { useClub } from '@/lib/club-context';
import { clubTeamsOf, juniorMemberIds, publicPlayerIds, publicTeamType, teamMemberIds, teamOfMatch } from '@/lib/teams';
import { clubResult, kickoff, latestResult, teamForm } from '@/lib/fixtures';
import { isPastFixture } from '@/lib/club-lists';
import { initialsOf } from '@/lib/positions';
import { teamColourVars } from '@/lib/theme-utils';
import type { Match } from '@/lib/supabase/types';
import LocalTime from '@/components/LocalTime';
import ResultChip from '@/components/ResultChip';
import PlayerAvatar from '@/components/PlayerAvatar';
import ClubSubPage, { EmptyState, ListSkeleton } from '@/components/ClubSubPage';
import PlayerSearch, { type SearchablePlayer } from '@/components/PlayerSearch';
import PlayerCardDialog from '@/components/PlayerCardDialog';

const opponentOf = (m: Match) => m.opponent_name || (m.is_club_home ? m.away_team_name : m.home_team_name);
const shortDate = { weekday: 'short', day: 'numeric', month: 'short' } as const;

/** /club/teams: find a player, then every team as a preview: its next game, latest result, form and players */
export default function TeamsPage({ params }: { params: Promise<{ clubSlug: string }> }) {
  const { clubSlug } = use(params);
  const { clubs, selectClubBySlug, clubTeams, clubTeamMembers, members, matches, isHydrated } = useClub();
  const club = selectClubBySlug(clubSlug) || clubs[0];
  const teams = useMemo(() => (club ? clubTeamsOf(clubTeams, club.id) : []), [clubTeams, club]);
  const [cardPlayer, setCardPlayer] = useState<string | null>(null);

  const { memberById, juniorIds } = useMemo(() => {
    const approved = members.filter(m => m.club_id === club?.id && (m.membership_status || 'approved') === 'approved');
    return {
      memberById: new Map(approved.map(m => [m.id, m])),
      juniorIds: juniorMemberIds(approved, clubTeams, clubTeamMembers, { includeU18: club?.junior_includes_u18 !== false }),
    };
  }, [members, club, clubTeams, clubTeamMembers]);
  // Everyone with a public player page, with the (non-junior) teams they play for
  const searchable = useMemo<SearchablePlayer[]>(() => {
    if (!club) return [];
    const clubMembers = members.filter(m => m.club_id === club.id);
    const ids = publicPlayerIds(clubMembers, clubTeams, clubTeamMembers, { includeU18: club.junior_includes_u18 !== false });
    const teamName = new Map(teams.filter(t => !t.is_junior).map(t => [t.id, t.name]));
    return clubMembers
      .filter(m => ids.has(m.id))
      .map(m => ({
        id: m.id, full_name: m.full_name, photo_url: m.photo_url, jersey_number: m.jersey_number, player_position: m.player_position,
        teams: [...new Set(clubTeamMembers
          .filter(r => r.member_id === m.id && r.team_role === 'player' && r.is_active !== false && teamName.has(r.team_id))
          .map(r => teamName.get(r.team_id)!))],
      }))
      .sort((a, b) => a.full_name.localeCompare(b.full_name));
  }, [members, club, clubTeams, clubTeamMembers, teams]);
  // Each team's games, once
  const gamesByTeam = useMemo(() => {
    const map = new Map<string, Match[]>();
    for (const m of matches) {
      if (m.club_id !== club?.id) continue;
      const t = teamOfMatch(m, clubTeams);
      if (t) map.set(t.id, [...(map.get(t.id) || []), m]);
    }
    return map;
  }, [matches, clubTeams, club]);

  if (!club) return null;

  return (
    <ClubSubPage club={club} title="Our teams" intro={`${club.name} has ${teams.length} ${teams.length === 1 ? 'team' : 'teams'}.`}>
      {!isHydrated ? (
        <ListSkeleton rows={3} height={130} label="Loading teams" />
      ) : teams.length === 0 ? (
        <EmptyState title="No teams listed yet" />
      ) : (
        <>
        {searchable.length > 0 && <h2 className="team-find-h">Find a player</h2>}
        <PlayerSearch players={searchable} clubSlug={club.slug} placeholder="Search by name or shirt number" onPick={setCardPlayer} />
        <div className="team-cards">
          {teams.map(team => {
            const players = team.is_junior ? [] : teamMemberIds(clubTeamMembers, team.id).map(id => memberById.get(id)).filter((m): m is NonNullable<typeof m> => !!m);
            // A few faces: adults only, those with photos first
            const faces = players.filter(p => !juniorIds.has(p.id) && !p.is_junior)
              .sort((a, b) => Number(!a.photo_url) - Number(!b.photo_url) || (a.jersey_number ?? 999) - (b.jersey_number ?? 999))
              .slice(0, 4);
            const games = gamesByTeam.get(team.id) || [];
            const next = games.filter(m => m.status === 'upcoming' && !isPastFixture(m)).sort((a, b) => kickoff(a) - kickoff(b))[0];
            // A team that hides its scores publicly shows no result or form
            const last = team.hide_public_scores ? undefined : latestResult(games);
            const form = team.hide_public_scores ? [] : teamForm(games);
            const result = last ? clubResult(last) : null;
            const meta = [publicTeamType(team.team_type), team.age_group, team.match_format].filter(Boolean).join(' · ');
            return (
              <Link key={team.id} href={`/${club.slug}/teams/${team.slug}`} className="team-card" style={teamColourVars(team.color || club.primary_color) as React.CSSProperties}>
                <div className="team-card-band">
                  <h2>{team.name}</h2>
                  {meta && <p>{meta}</p>}
                </div>
                <div className="team-card-body">
                  {next && (
                    <div className="team-card-kv">
                      <span>Next</span>
                      <span>{next.is_club_home ? 'vs' : 'at'} {opponentOf(next)}<small><LocalTime value={next.match_date} options={shortDate} /></small></span>
                    </div>
                  )}
                  {last && result && (
                    <div className="team-card-kv">
                      <span>Last</span>
                      <span><b>{result.us}-{result.them}</b> {last.is_club_home ? 'vs' : 'at'} {opponentOf(last)}<small><LocalTime value={last.match_date} options={shortDate} /></small></span>
                    </div>
                  )}
                  {form.length > 0 && (
                    <div className="team-card-kv team-card-form">
                      <span>Form</span>
                      <span className="row row-tight">{form.map((o, i) => <ResultChip key={i} outcome={o} />)}</span>
                    </div>
                  )}
                  {!next && !last && players.length === 0 && (
                    <p className="text-note" style={{ margin: 0 }}>{team.is_junior ? 'Fixtures coming soon.' : 'Squad and fixtures coming soon.'}</p>
                  )}
                  {players.length > 0 && (
                    <div className="team-card-pile">
                      <span className="team-card-faces" aria-hidden="true">
                        {faces.map(p => (
                          <i key={p.id}>{p.photo_url ? <PlayerAvatar photoUrl={p.photo_url} name={p.full_name} fill /> : p.jersey_number ?? initialsOf(p.full_name)}</i>
                        ))}
                      </span>
                      {players.length} {players.length === 1 ? 'player' : 'players'}
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
        </>
      )}
      {cardPlayer && <PlayerCardDialog club={club} playerId={cardPlayer} onClose={() => setCardPlayer(null)} />}
    </ClubSubPage>
  );
}
