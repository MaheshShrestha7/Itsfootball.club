'use client';

import React, { use, useMemo } from 'react';
import Link from 'next/link';
import { ArrowLeft, Shield, Users, ChevronRight } from 'lucide-react';
import { useClub } from '@/lib/club-context';
import { TEAM_TYPES, clubTeamsOf, teamMemberIds } from '@/lib/teams';

export default function TeamsPage({ params }: { params: Promise<{ clubSlug: string }> }) {
  const { clubSlug } = use(params);
  const { clubs, selectClubBySlug, clubTeams, clubTeamMembers, members, isHydrated } = useClub();
  const club = selectClubBySlug(clubSlug) || clubs[0];
  const teams = useMemo(() => (club ? clubTeamsOf(clubTeams, club.id) : []), [clubTeams, club]);
  const approvedIds = useMemo(
    () => new Set(members.filter(m => m.club_id === club?.id && (m.membership_status || 'approved') === 'approved').map(m => m.id)),
    [members, club]
  );

  if (!club) return null;

  return (
    <div style={{ minHeight: '85vh', padding: '3rem 0 5rem 0' }}>
      <div className="container" style={{ maxWidth: '1080px' }}>
        <Link href={`/${club.slug}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
          <ArrowLeft size={16} /> Back to {club.name}
        </Link>

        <h1 style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--text-primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <Shield size={30} color="var(--club-primary)" className="shrink-0" /> Our Teams
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
          Every {club.name} team, from the first team to the youngest age group.
        </p>

        {teams.length === 0 ? (
          <div className="glass-panel" style={{ padding: '1.5rem' }}>{isHydrated ? 'No teams listed yet.' : 'Loading…'}</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))', gap: '1.25rem' }}>
            {teams.map(team => {
              const players = team.is_junior ? [] : teamMemberIds(clubTeamMembers, team.id).filter(id => approvedIds.has(id));
              const typeLabel = TEAM_TYPES.find(t => t.value === team.team_type)?.label;
              return (
                <Link key={team.id} href={`/${club.slug}/teams/${team.slug}`} className="glass-panel" style={{ padding: 0, overflow: 'hidden', display: 'block', color: 'inherit', textDecoration: 'none' }}>
                  <div style={{ height: '4px', background: team.color || club.primary_color }} />
                  <div className="row" style={{ padding: '1.1rem 1.25rem', justifyContent: 'space-between' }}>
                    <div className="min-w-0">
                      <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>{team.name}</h2>
                      <div className="text-meta" style={{ marginTop: '0.25rem' }}>
                        {[typeLabel, team.age_group].filter(Boolean).join(' · ')}
                      </div>
                      {players.length > 0 && (
                        <div className="text-note row row-tight" style={{ marginTop: '0.5rem' }}>
                          <Users size={13} /> {players.length} {players.length === 1 ? 'player' : 'players'}
                        </div>
                      )}
                    </div>
                    <ChevronRight size={18} color="var(--text-muted)" className="shrink-0" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
