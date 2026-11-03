'use client';

import React, { use, useState } from 'react';
import { CalendarPlus } from 'lucide-react';
import { useClub } from '@/lib/club-context';
import { clubTeamsOf, publicScoreHidden, teamLabel, teamOfMatch } from '@/lib/teams';
import { clubPlaysIn, clubResult, kickoff, publicFixtures } from '@/lib/fixtures';
import { groupByMonth, isPastFixture, seasonOfMatch, seasonOptions } from '@/lib/club-lists';
import { useUrlParam, useUrlTab } from '@/lib/use-url-tab';
import { SITE_URL } from '@/lib/slugs';
import FixtureRow from '@/components/FixtureRow';
import ClubSubPage, { EmptyState, ListSkeleton, MonthGroup, UpcomingPastTabs } from '@/components/ClubSubPage';

const VIEWS = ['upcoming', 'past'] as const;
const PAGE = 40;
/** The URL value for games with no season */
const NO_SEASON = 'none';

/** /club/fixtures: every fixture and result, Upcoming | Past, by team and (past) by season.
 *  Tab, team and season live in the URL (?view=past&team=u12&season=2025) so a view can be shared. */
export default function ClubFixturesPage({ params }: { params: Promise<{ clubSlug: string }> }) {
  const { clubSlug } = use(params);
  const { clubs, selectClubBySlug, matches, clubTeams, tournamentParticipants, getActiveSeason, seasons, isHydrated } = useClub();
  const club = selectClubBySlug(clubSlug) || clubs[0];
  const teams = clubTeamsOf(clubTeams, club.id);
  const [view, setView] = useUrlTab(VIEWS, 'view');
  const [teamSlug, setTeamSlug] = useUrlParam('team');
  const [seasonParam, setSeason] = useUrlParam('season');
  const [shown, setShown] = useState(PAGE);
  const team = teams.find(t => t.slug === teamSlug);
  const clubSeasons = seasons.filter(s => s.club_id === club.id);

  // In-house games (two of the club's own sides) stay with the squad unless the club plays nothing else
  const own = matches.filter(m => m.club_id === club.id);
  const clubMatches = publicFixtures(own, own)
    .filter(m => clubPlaysIn(m, tournamentParticipants, club.name))
    .filter(m => !team || teamOfMatch(m, clubTeams)?.id === team.id);

  const upcoming = clubMatches
    .filter(m => !isPastFixture(m) && ['upcoming', 'live', 'halftime', 'postponed'].includes(m.status))
    .sort((a, b) => kickoff(a) - kickoff(b));
  const pastAll = clubMatches.filter(m => isPastFixture(m)).sort((a, b) => kickoff(b) - kickoff(a));

  // Seasons with past games, newest first; the club's current one is the default when it has games
  const seasonKey = (m: (typeof matches)[number]) => seasonOfMatch(m, clubSeasons) || NO_SEASON;
  const options = seasonOptions(pastAll.map(m => seasonOfMatch(m, clubSeasons)), clubSeasons).map(s => s || NO_SEASON);
  const active = getActiveSeason(club.id)?.name;
  const season = seasonParam === 'all' || options.includes(seasonParam) ? seasonParam
    : active && options.includes(active) ? active : options[0] || 'all';
  const past = season === 'all' ? pastAll : pastAll.filter(m => seasonKey(m) === season);

  // The season so far, from the club's side (games with hidden scores, e.g. junior, left out)
  const record = past.reduce((r, m) => {
    if (m.status !== 'completed' || publicScoreHidden(m, clubTeams)) return r;
    const res = clubResult(m);
    if (!res.outcome) return r;
    r[res.outcome]++;
    r.gf += res.us;
    r.ga += res.them;
    return r;
  }, { W: 0, D: 0, L: 0, gf: 0, ga: 0 });
  const played = record.W + record.D + record.L;

  const label = (m: (typeof matches)[number]) => {
    const t = teams.length > 1 && !team ? teamOfMatch(m, clubTeams) : undefined;
    return t ? teamLabel(t) : undefined;
  };
  const row = (m: (typeof matches)[number]) => (
    <FixtureRow key={m.id} match={m} clubSlug={club.slug} hideScore={publicScoreHidden(m, clubTeams)} teamLabel={label(m)} />
  );
  const list = view === 'upcoming' ? upcoming : past.slice(0, shown);
  const seasonName = (s: string) => (s === NO_SEASON ? 'No season set' : s);

  return (
    <ClubSubPage
      club={club}
      title="Fixtures & results"
      width={900}
      intro={`Every ${club.name} game: what's coming up and how past games went.`}
      actions={<>
        <a href={`${SITE_URL.replace(/^https?:/, 'webcal:')}/${club.slug}/calendar.ics`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', minHeight: '44px', fontSize: '0.85rem', fontWeight: 700, color: 'var(--club-ink)' }}>
          <CalendarPlus size={15} aria-hidden="true" /> Add to my calendar
        </a>
        <a href={`/${club.slug}/calendar.ics`} download style={{ display: 'inline-flex', alignItems: 'center', minHeight: '44px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>or download .ics</a>
      </>}
    >
      {teams.length > 1 && (
        <div role="group" aria-label="Team" className="fixtures-team-chips">
          {[undefined, ...teams].map(t => (
            <button key={t?.id ?? 'all'} type="button" aria-pressed={team?.id === t?.id} onClick={() => { setTeamSlug(t?.slug ?? ''); setShown(PAGE); }}
              className={`btn btn-sm ${team?.id === t?.id ? 'btn-primary' : 'btn-secondary'}`}>
              {t ? teamLabel(t) : 'All teams'}
            </button>
          ))}
        </div>
      )}

      <div className="club-toolbar">
        <UpcomingPastTabs view={view} onView={v => { setView(v); setShown(PAGE); }} upcoming={upcoming.length} past={past.length} labels={['Upcoming', 'Results']} />
        {view === 'past' && options.length > 0 && (
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
            <span className="text-note">Season</span>
            <select className="club-select" value={season} onChange={e => { setSeason(e.target.value); setShown(PAGE); }}>
              {options.map(s => <option key={s} value={s}>{seasonName(s)}</option>)}
              {options.length > 1 && <option value="all">All seasons</option>}
            </select>
          </label>
        )}
      </div>

      {view === 'past' && played > 0 && (
        <div className="club-summary" aria-label={`Record${season === 'all' ? '' : ` for ${seasonName(season)}`}`}>
          <div><strong>{played}</strong><span>Played</span></div>
          <div><strong style={{ color: 'var(--c-green)' }}>{record.W}</strong><span>Won</span></div>
          <div><strong>{record.D}</strong><span>Drawn</span></div>
          <div><strong style={{ color: 'var(--c-red)' }}>{record.L}</strong><span>Lost</span></div>
          <div><strong>{record.gf}-{record.ga}</strong><span>Goals</span></div>
        </div>
      )}

      {!isHydrated ? (
        <ListSkeleton label="Loading fixtures" />
      ) : list.length === 0 ? (
        view === 'upcoming' ? (
          <EmptyState title="No fixtures scheduled yet"
            action={pastAll.length > 0 ? <button type="button" className="btn btn-secondary btn-sm" onClick={() => setView('past')}>See past results</button> : undefined}>
            New games appear here as soon as the club adds them. Add the calendar above to get them on your phone.
          </EmptyState>
        ) : (
          <EmptyState title="No past games here">
            {team ? `Nothing played by ${teamLabel(team)} yet.` : 'Results show here once games are played.'}
          </EmptyState>
        )
      ) : (
        groupByMonth(list, m => m.match_date).map(g => <MonthGroup key={g.key || 'tbc'} label={g.label}>{g.items.map(row)}</MonthGroup>)
      )}

      {view === 'past' && past.length > shown && (
        <button type="button" className="btn btn-secondary" style={{ marginTop: '1.5rem' }} onClick={() => setShown(n => n + PAGE)}>
          Show older games
        </button>
      )}
    </ClubSubPage>
  );
}
