'use client';

import React, { use, useMemo } from 'react';
import Link from 'next/link';
import { ArrowLeft, Calendar, Users, Lock, ShieldCheck } from 'lucide-react';
import { useClub } from '@/lib/club-context';
import { decodeSlugParam } from '@/lib/slugs';
import { STAFF_ROLES, TEAM_ROLE_LABELS, TEAM_TYPES, clubTeamsOf, juniorMemberIds, publicMember, teamMemberIds, teamOfMatch } from '@/lib/teams';
import PlayerAvatar from '@/components/PlayerAvatar';
import FixtureRow from '@/components/FixtureRow';

export default function TeamPage({ params }: { params: Promise<{ clubSlug: string; teamSlug: string }> }) {
  const { clubSlug, teamSlug } = use(params);
  const { clubs, selectClubBySlug, clubTeams, clubTeamMembers, members, matches, isHydrated } = useClub();
  const club = selectClubBySlug(clubSlug) || clubs[0];
  const slug = decodeSlugParam(teamSlug);
  const team = useMemo(
    () => (club ? clubTeamsOf(clubTeams, club.id).find(t => t.slug === slug) : undefined),
    [clubTeams, club, slug]
  );

  // A junior playing up for this team is shown as "Sam T.", without a photo unless a guardian allowed it
  const { memberById, juniorIds } = useMemo(() => {
    const clubMembers = members.filter(m => m.club_id === club?.id && (m.membership_status || 'approved') === 'approved');
    const juniorIds = juniorMemberIds(clubMembers, clubTeams, clubTeamMembers, { includeU18: club.junior_includes_u18 !== false });
    return { memberById: new Map(clubMembers.map(m => [m.id, publicMember(m, juniorIds)])), juniorIds };
  }, [members, club, clubTeams, clubTeamMembers]);

  const players = useMemo(() => {
    if (!team || team.is_junior) return [];
    return teamMemberIds(clubTeamMembers, team.id)
      .map(id => memberById.get(id))
      .filter((m): m is NonNullable<typeof m> => !!m)
      .sort((a, b) => (a.jersey_number ?? 999) - (b.jersey_number ?? 999) || a.full_name.localeCompare(b.full_name));
  }, [team, clubTeamMembers, memberById]);

  const staff = useMemo(() => {
    if (!team || team.is_junior) return [];
    return clubTeamMembers
      .filter(r => r.team_id === team.id && r.team_role !== 'player' && r.is_active !== false && memberById.has(r.member_id))
      .sort((a, b) => STAFF_ROLES.indexOf(a.team_role) - STAFF_ROLES.indexOf(b.team_role))
      .map(r => ({ member: memberById.get(r.member_id)!, role: TEAM_ROLE_LABELS[r.team_role] }));
  }, [team, clubTeamMembers, memberById]);

  const teamMatches = useMemo(
    () => (team ? matches.filter(m => m.club_id === team.club_id && teamOfMatch(m, clubTeams)?.id === team.id) : []),
    [matches, clubTeams, team]
  );
  const upcoming = teamMatches
    .filter(m => ['upcoming', 'live', 'halftime', 'postponed'].includes(m.status))
    .sort((a, b) => new Date(a.match_date).getTime() - new Date(b.match_date).getTime())
    .slice(0, 8);
  const results = teamMatches
    .filter(m => m.status === 'completed')
    .sort((a, b) => new Date(b.match_date).getTime() - new Date(a.match_date).getTime())
    .slice(0, 8);

  if (!club) return null;

  const back = (
    <Link href={`/${club.slug}/teams`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
      <ArrowLeft size={16} /> All teams
    </Link>
  );

  if (!team) {
    return (
      <div style={{ minHeight: '85vh', padding: '3rem 0 5rem 0' }}>
        <div className="container" style={{ maxWidth: '1080px' }}>
          {back}
          <div className="glass-panel" style={{ padding: '1.5rem' }}>{isHydrated ? 'This team could not be found.' : 'Loading…'}</div>
        </div>
      </div>
    );
  }

  const typeLabel = TEAM_TYPES.find(t => t.value === team.team_type)?.label;
  const sectionTitle: React.CSSProperties = { fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' };

  return (
    <div style={{ minHeight: '85vh', padding: '3rem 0 5rem 0' }}>
      <div className="container" style={{ maxWidth: '1080px' }}>
        {back}

        <div style={{ borderLeft: `4px solid ${team.color || club.primary_color}`, paddingLeft: '1rem', marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--text-primary)', margin: 0, overflowWrap: 'anywhere' }}>{team.name}</h1>
          <div className="text-body" style={{ marginTop: '0.35rem' }}>
            {[club.name, typeLabel, team.age_group, team.match_format].filter(Boolean).join(' · ')}
          </div>
          {team.description && <p className="text-body" style={{ marginTop: '0.75rem', whiteSpace: 'pre-line' }}>{team.description}</p>}
        </div>

        <div className="stack" style={{ gap: '2.5rem' }}>
          {staff.length > 0 && (
            <section aria-labelledby="team-staff">
              <h2 id="team-staff" style={sectionTitle}>Coaches & staff</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 220px), 1fr))', gap: '0.75rem' }}>
                {staff.map(({ member, role }) => (
                  <div key={`${member.id}-${role}`} className="glass-panel row" style={{ padding: '0.75rem 1rem' }}>
                    <PlayerAvatar name={member.full_name} photoUrl={member.photo_url} size={36} />
                    <div className="min-w-0">
                      <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.9rem' }}>{member.full_name}</div>
                      <div className="text-meta">{role}</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section aria-labelledby="team-squad">
            <h2 id="team-squad" style={sectionTitle}><Users size={20} color="var(--club-primary)" /> Squad</h2>
            {team.is_junior ? (
              <div className="glass-panel row" style={{ padding: '1.25rem' }}>
                <Lock size={16} color="var(--text-muted)" className="shrink-0" />
                <span className="text-body">To protect our young players, this squad isn&apos;t listed publicly. Contact the club to find out more.</span>
              </div>
            ) : players.length === 0 ? (
              <div className="glass-panel" style={{ padding: '1.25rem' }}>{isHydrated ? 'No players listed yet.' : 'Loading…'}</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 220px), 1fr))', gap: '0.75rem' }}>
                {players.map(p => {
                  const card = (
                    <>
                      <PlayerAvatar name={p.full_name} photoUrl={p.photo_url} size={40} />
                      <div className="min-w-0">
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                          {p.jersey_number != null && <span style={{ color: 'var(--club-ink)', marginRight: 6 }}>#{p.jersey_number}</span>}
                          {p.full_name}
                        </div>
                        {p.player_position && <div className="text-meta">{p.player_position}</div>}
                      </div>
                    </>
                  );
                  // A junior playing up keeps a plain card: no public player page
                  return juniorIds.has(p.id) || p.is_junior ? (
                    <div key={p.id} className="glass-panel row" style={{ padding: '0.75rem 1rem' }}>{card}</div>
                  ) : (
                    <Link key={p.id} href={`/${club.slug}/squad/${p.id}`} className="glass-panel glass-panel-interactive row" style={{ padding: '0.75rem 1rem', color: 'inherit', textDecoration: 'none' }}>{card}</Link>
                  );
                })}
              </div>
            )}
          </section>

          {team.is_junior && (club.welfare_officer_name || club.welfare_officer_email || club.welfare_officer_phone) && (
            <section aria-labelledby="team-welfare">
              <h2 id="team-welfare" style={sectionTitle}><ShieldCheck size={20} color="var(--club-primary)" /> Welfare officer</h2>
              <div className="glass-panel" style={{ padding: '1.25rem' }}>
                <p className="text-body" style={{ margin: 0 }}>
                  Any concern about a young player&apos;s safety or wellbeing? Contact our welfare officer
                  {club.welfare_officer_name ? <>, <strong className="text-primary">{club.welfare_officer_name}</strong></> : null}.
                </p>
                <div className="row row-wrap" style={{ marginTop: '0.75rem', gap: '0.5rem 1.25rem' }}>
                  {club.welfare_officer_email && <a href={`mailto:${club.welfare_officer_email}`}>{club.welfare_officer_email}</a>}
                  {club.welfare_officer_phone && <a href={`tel:${club.welfare_officer_phone.replace(/[^\d+]/g, '')}`}>{club.welfare_officer_phone}</a>}
                </div>
              </div>
            </section>
          )}

          <section aria-labelledby="team-fixtures">
            <h2 id="team-fixtures" style={sectionTitle}><Calendar size={20} color="var(--club-primary)" /> Fixtures</h2>
            {upcoming.length === 0 ? (
              <div className="glass-panel" style={{ padding: '1.25rem' }}>No upcoming fixtures.</div>
            ) : (
              <div className="stack stack-sm">
                {upcoming.map(m => <FixtureRow key={m.id} match={m} clubSlug={club.slug} hideScore={team.hide_public_scores} />)}
              </div>
            )}
          </section>

          {results.length > 0 && (
            <section aria-labelledby="team-results">
              <h2 id="team-results" style={sectionTitle}>Results</h2>
              <div className="stack stack-sm">
                {results.map(m => <FixtureRow key={m.id} match={m} clubSlug={club.slug} hideScore={team.hide_public_scores} />)}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
