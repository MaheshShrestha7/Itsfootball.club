'use client';

import React, { use, useMemo } from 'react';
import Link from 'next/link';
import { Users, ChevronRight, CalendarDays } from 'lucide-react';
import { useClub } from '@/lib/club-context';
import { TEAM_TYPES, clubTeamsOf, teamMemberIds, teamOfMatch } from '@/lib/teams';
import { clubResult, kickoff } from '@/lib/fixtures';
import { isPastFixture } from '@/lib/club-lists';
import type { Match } from '@/lib/supabase/types';
import LocalTime from '@/components/LocalTime';
import ResultChip from '@/components/ResultChip';
import ClubSubPage, { EmptyState, ListSkeleton } from '@/components/ClubSubPage';

/** /club/teams: every team as a card with its next game and recent form, linking to the team's page */
export default function TeamsPage({ params }: { params: Promise<{ clubSlug: string }> }) {
  const { clubSlug } = use(params);
  const { clubs, selectClubBySlug, clubTeams, clubTeamMembers, members, matches, isHydrated } = useClub();
  const club = selectClubBySlug(clubSlug) || clubs[0];
  const teams = useMemo(() => (club ? clubTeamsOf(clubTeams, club.id) : []), [clubTeams, club]);
  const approvedIds = useMemo(
    () => new Set(members.filter(m => m.club_id === club?.id && (m.membership_status || 'approved') === 'approved').map(m => m.id)),
    [members, club]
  );
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
    <ClubSubPage club={club} title="Our teams" intro={`Every ${club.name} team, from the first team to the youngest age group.`}>
      {!isHydrated ? (
        <ListSkeleton rows={3} height={130} label="Loading teams" />
      ) : teams.length === 0 ? (
        <EmptyState title="No teams listed yet" />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))', gap: '1.25rem' }}>
          {teams.map(team => {
            const players = team.is_junior ? [] : teamMemberIds(clubTeamMembers, team.id).filter(id => approvedIds.has(id));
            const typeLabel = TEAM_TYPES.find(t => t.value === team.team_type)?.label;
            const games = gamesByTeam.get(team.id) || [];
            const next = games.filter(m => m.status === 'upcoming' && !isPastFixture(m)).sort((a, b) => kickoff(a) - kickoff(b))[0];
            // Last five results, oldest first so the newest sits on the right (form guides read that way)
            const form = team.hide_public_scores ? [] : games
              .filter(m => m.status === 'completed').sort((a, b) => kickoff(b) - kickoff(a))
              .map(m => clubResult(m).outcome).filter((o): o is NonNullable<typeof o> => !!o).slice(0, 5).reverse();
            return (
              <Link key={team.id} href={`/${club.slug}/teams/${team.slug}`} className="glass-panel glass-panel-interactive" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', color: 'inherit', textDecoration: 'none' }}>
                <div style={{ height: '4px', background: team.color || club.primary_color }} />
                <div style={{ padding: '1.1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.6rem', flex: 1 }}>
                  <div className="row" style={{ justifyContent: 'space-between' }}>
                    <div className="min-w-0">
                      <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>{team.name}</h2>
                      <div className="text-meta" style={{ marginTop: '0.2rem' }}>{[typeLabel, team.age_group].filter(Boolean).join(' · ')}</div>
                    </div>
                    <ChevronRight size={18} color="var(--text-muted)" className="shrink-0" aria-hidden="true" />
                  </div>
                  <div className="text-note" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <CalendarDays size={13} aria-hidden="true" className="shrink-0" />
                    {next ? (
                      <span className="min-w-0" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        Next: <LocalTime value={next.match_date} /> {next.is_club_home ? 'vs' : 'at'} {next.opponent_name || (next.is_club_home ? next.away_team_name : next.home_team_name)}
                      </span>
                    ) : 'No game scheduled'}
                  </div>
                  <div className="row" style={{ justifyContent: 'space-between', marginTop: 'auto' }}>
                    {players.length > 0 ? (
                      <span className="text-note row row-tight"><Users size={13} aria-hidden="true" /> {players.length} {players.length === 1 ? 'player' : 'players'}</span>
                    ) : <span />}
                    {form.length > 0 && (
                      <span className="row row-tight">
                        <span className="sr-only">Recent form:</span>
                        {form.map((o, i) => <ResultChip key={i} outcome={o} />)}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </ClubSubPage>
  );
}
