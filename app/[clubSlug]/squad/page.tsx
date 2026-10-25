'use client';

import React, { use, useMemo } from 'react';
import Link from 'next/link';
import { ArrowLeft, ChevronRight, Lock } from 'lucide-react';
import { useClub } from '@/lib/club-context';
import { clubTeamsOf, juniorMemberIds, squadPlayerIds } from '@/lib/teams';
import PlayerAvatar from '@/components/PlayerAvatar';

const LINES: { title: string; positions: string[] }[] = [
  { title: 'Goalkeepers', positions: ['GK'] },
  { title: 'Defenders', positions: ['CB', 'LB', 'RB', 'LWB', 'RWB'] },
  { title: 'Midfielders', positions: ['CDM', 'CM', 'CAM', 'LM', 'RM'] },
  { title: 'Forwards', positions: ['LW', 'RW', 'ST', 'CF'] },
];

/** /club/squad: the club's players by position. Juniors aren't listed (safeguarding), as on the home page. */
export default function ClubSquadPage({ params }: { params: Promise<{ clubSlug: string }> }) {
  const { clubSlug } = use(params);
  const { clubs, selectClubBySlug, members, clubTeams, clubTeamMembers, isHydrated } = useClub();
  const club = selectClubBySlug(clubSlug) || clubs[0];
  const teams = clubTeamsOf(clubTeams, club.id);

  const players = useMemo(() => {
    const clubMembers = members.filter(m => m.club_id === club.id && (m.membership_status || 'approved') === 'approved');
    const juniorIds = juniorMemberIds(clubMembers, clubTeams, clubTeamMembers, { includeU18: club.junior_includes_u18 !== false });
    const squad = squadPlayerIds(clubMembers, clubTeamMembers);
    return clubMembers
      .filter(m => squad.has(m.id) && !juniorIds.has(m.id) && !m.is_junior)
      .sort((a, b) => (a.jersey_number ?? 999) - (b.jersey_number ?? 999) || a.full_name.localeCompare(b.full_name));
  }, [members, club, clubTeams, clubTeamMembers]);

  const known = new Set(LINES.flatMap(l => l.positions));
  const groups = [
    ...LINES.map(l => ({ title: l.title, list: players.filter(p => l.positions.includes(p.player_position || '')) })),
    { title: 'Squad', list: players.filter(p => !known.has(p.player_position || '')) },
  ].filter(g => g.list.length);

  return (
    <div style={{ minHeight: '85vh', padding: '3rem 0 5rem 0' }}>
      <div className="container" style={{ maxWidth: '1080px' }}>
        <Link href={`/${club.slug}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
          <ArrowLeft size={16} /> Back to {club.name}
        </Link>
        <h1 style={{ fontSize: 'clamp(1.8rem, 5vw, 2.4rem)', fontWeight: 900, marginBottom: '0.4rem' }}>Squad</h1>
        {teams.length > 1 && (
          <p className="text-body" style={{ marginBottom: '1.5rem' }}>
            By team:{' '}
            {teams.map((t, i) => (
              <React.Fragment key={t.id}>{i > 0 && ' · '}<Link href={`/${club.slug}/teams/${t.slug}`} style={{ color: 'var(--club-ink)', fontWeight: 700 }}>{t.name}</Link></React.Fragment>
            ))}
          </p>
        )}

        {groups.length === 0 ? (
          <p className="glass-panel text-note" style={{ padding: '1.25rem' }}>{isHydrated ? 'No players listed yet.' : 'Loading the squad…'}</p>
        ) : (
          <div className="stack" style={{ gap: '2rem' }}>
            {groups.map(g => (
              <section key={g.title} aria-label={g.title}>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.75rem' }}>{g.title} <span className="text-meta">({g.list.length})</span></h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 220px), 1fr))', gap: '0.75rem' }}>
                  {g.list.map(p => (
                    <Link key={p.id} href={`/${club.slug}/squad/${p.id}`} className="glass-panel glass-panel-interactive row" style={{ padding: '0.75rem 1rem', color: 'inherit', textDecoration: 'none' }}>
                      <PlayerAvatar name={p.full_name} photoUrl={p.photo_url} size={40} />
                      <div className="min-w-0" style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                          {p.jersey_number != null && <span style={{ color: 'var(--club-ink)', marginRight: 6 }}>#{p.jersey_number}</span>}
                          {p.full_name}
                        </div>
                        {p.player_position && <div className="text-meta">{p.player_position}</div>}
                      </div>
                      <ChevronRight size={16} color="var(--text-muted)" className="shrink-0" aria-hidden="true" />
                    </Link>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        {teams.some(t => t.is_junior) && (
          <div className="glass-panel row" style={{ padding: '1rem 1.25rem', marginTop: '2rem' }}>
            <Lock size={16} color="var(--text-muted)" className="shrink-0" aria-hidden="true" />
            <span className="text-body">To protect our young players, junior squads aren&apos;t listed here. Each junior team&apos;s page has its fixtures.</span>
          </div>
        )}
      </div>
    </div>
  );
}
