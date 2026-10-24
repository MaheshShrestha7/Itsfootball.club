'use client';

import React, { use, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CalendarPlus } from 'lucide-react';
import { useClub } from '@/lib/club-context';
import { clubTeamsOf, publicScoreHidden, teamLabel, teamOfMatch } from '@/lib/teams';
import { clubPlaysIn, kickoff } from '@/lib/fixtures';
import { SITE_URL } from '@/lib/slugs';
import FixtureRow from '@/components/FixtureRow';

/** /club/fixtures: every upcoming fixture and this season's results, by team (the home page shows a few) */
export default function ClubFixturesPage({ params }: { params: Promise<{ clubSlug: string }> }) {
  const { clubSlug } = use(params);
  const { clubs, selectClubBySlug, matches, clubTeams, tournamentParticipants, getActiveSeason, isHydrated } = useClub();
  const club = selectClubBySlug(clubSlug) || clubs[0];
  const teams = clubTeamsOf(clubTeams, club.id);
  const [teamId, setTeamId] = useState<string>('all');
  const season = getActiveSeason(club.id)?.name;

  const clubMatches = useMemo(() => matches
    .filter(m => m.club_id === club.id && clubPlaysIn(m, tournamentParticipants, club.name))
    .filter(m => teamId === 'all' || teamOfMatch(m, clubTeams)?.id === teamId), [matches, club, tournamentParticipants, teamId, clubTeams]);
  const upcoming = clubMatches
    .filter(m => ['upcoming', 'live', 'halftime', 'postponed'].includes(m.status))
    .sort((a, b) => kickoff(a) - kickoff(b));
  const results = clubMatches
    .filter(m => m.status === 'completed' && (!season || !m.season || m.season === season))
    .sort((a, b) => kickoff(b) - kickoff(a));
  const label = (m: (typeof matches)[number]) => (teams.length > 1 && teamId === 'all' ? teamOfMatch(m, clubTeams) : undefined);
  const sectionTitle: React.CSSProperties = { fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 1rem' };

  return (
    <div style={{ minHeight: '85vh', padding: '3rem 0 5rem 0' }}>
      <div className="container" style={{ maxWidth: '860px' }}>
        <Link href={`/${club.slug}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
          <ArrowLeft size={16} /> Back to {club.name}
        </Link>
        <h1 style={{ fontSize: 'clamp(1.8rem, 5vw, 2.4rem)', fontWeight: 900, marginBottom: '0.4rem' }}>Fixtures &amp; results</h1>
        <div className="row" style={{ gap: '0.25rem 1rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
          <a href={`${SITE_URL.replace(/^https?:/, 'webcal:')}/${club.slug}/calendar.ics`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', minHeight: '44px', fontSize: '0.85rem', fontWeight: 700, color: 'var(--club-ink)' }}>
            <CalendarPlus size={15} aria-hidden="true" /> Add to my calendar
          </a>
          <a href={`/${club.slug}/calendar.ics`} download style={{ display: 'inline-flex', alignItems: 'center', minHeight: '44px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>or download .ics</a>
        </div>

        {teams.length > 1 && (
          <div role="group" aria-label="Team" className="fixtures-team-chips">
            {[{ id: 'all', name: 'All teams' }, ...teams].map(t => (
              <button key={t.id} type="button" aria-pressed={teamId === t.id} onClick={() => setTeamId(t.id)}
                className={`btn btn-sm ${teamId === t.id ? 'btn-primary' : 'btn-secondary'}`}>
                {t.id === 'all' ? t.name : teamLabel(t as (typeof teams)[number])}
              </button>
            ))}
          </div>
        )}

        <section aria-labelledby="fx-upcoming" style={{ marginBottom: '2.5rem' }}>
          <h2 id="fx-upcoming" style={sectionTitle}>Coming up</h2>
          {upcoming.length === 0 ? (
            <p className="glass-panel text-note" style={{ padding: '1.25rem' }}>{isHydrated ? 'No fixtures scheduled yet.' : 'Loading fixtures…'}</p>
          ) : (
            <div className="stack stack-sm">
              {upcoming.map(m => <FixtureRow key={m.id} match={m} clubSlug={club.slug} hideScore={publicScoreHidden(m, clubTeams)} teamLabel={label(m) ? teamLabel(label(m)!) : undefined} />)}
            </div>
          )}
        </section>

        {results.length > 0 && (
          <section aria-labelledby="fx-results">
            <h2 id="fx-results" style={sectionTitle}>Results{season ? ` · ${season}` : ''}</h2>
            <div className="stack stack-sm">
              {results.map(m => <FixtureRow key={m.id} match={m} clubSlug={club.slug} hideScore={publicScoreHidden(m, clubTeams)} teamLabel={label(m) ? teamLabel(label(m)!) : undefined} />)}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
