'use client';

import React, { use, useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Handshake, Lock, ShieldCheck } from 'lucide-react';
import { useClub } from '@/lib/club-context';
import { decodeSlugParam } from '@/lib/slugs';
import { STAFF_ROLES, TEAM_ROLE_LABELS, clubTeamsOf, juniorMemberIds, publicMember, publicTeamType, teamMemberIds, teamOfMatch } from '@/lib/teams';
import { POSITION_NAMES, SQUAD_LINES, groupByLine, initialsOf, type SquadLineKey } from '@/lib/positions';
import { defaultSeasonLabel } from '@/lib/season';
import { teamColourVars } from '@/lib/theme-utils';
import PlayerAvatar from '@/components/PlayerAvatar';
import SilkBackdrop from '@/components/SilkBackdrop';
import ResultChip from '@/components/ResultChip';
import FixtureRow from '@/components/FixtureRow';
import ClubSubPage, { EmptyState, ListSkeleton } from '@/components/ClubSubPage';
import { matchesPlayer } from '@/components/PlayerSearch';
import PlayerCardDialog from '@/components/PlayerCardDialog';
import { isPastFixture } from '@/lib/club-lists';
import { kickoff, latestResult, teamForm, teamRecord } from '@/lib/fixtures';
import ContactModal from '@/components/ContactModal';

// Short enough that the games column fits beside the squad as it sticks; the Fixtures page has the rest
const UPCOMING_SHOWN = 2;
const RESULTS_SHOWN = 4;

/** One player: their photo or shirt number, name and position. Opens their card, except a junior
 *  playing up, who has no public page and stays a plain row. */
function SquadRow({ player, open }: {
  player: { full_name: string; photo_url?: string; jersey_number?: number | null; player_position?: string | null };
  open?: () => void;
}) {
  const position = player.player_position ? POSITION_NAMES[player.player_position] || player.player_position : null;
  const body = (<>
    {player.photo_url
      ? <span className="team-tile team-tile-photo"><PlayerAvatar photoUrl={player.photo_url} name={player.full_name} fill /></span>
      : <span className={`team-tile${player.jersey_number == null ? ' team-tile-none' : ''}`} aria-hidden="true">{player.jersey_number ?? initialsOf(player.full_name)}</span>}
    <span className="min-w-0">
      <strong>{player.full_name}</strong>
      <small>{[player.photo_url && player.jersey_number != null ? `#${player.jersey_number}` : null, position].filter(Boolean).join(' · ')}</small>
    </span>
  </>);
  return open
    ? <button type="button" className="team-row" aria-haspopup="dialog" onClick={open}>{body}</button>
    : <div className="team-row team-row-plain">{body}</div>;
}

export default function TeamPage({ params }: { params: Promise<{ clubSlug: string; teamSlug: string }> }) {
  const { clubSlug, teamSlug } = use(params);
  const { clubs, selectClubBySlug, clubTeams, clubTeamMembers, members, matches, getActiveSeason, isHydrated } = useClub();
  const club = selectClubBySlug(clubSlug) || clubs[0];
  const slug = decodeSlugParam(teamSlug);
  const team = useMemo(
    () => (club ? clubTeamsOf(clubTeams, club.id).find(t => t.slug === slug) : undefined),
    [clubTeams, club, slug]
  );
  const [line, setLine] = useState<'ALL' | SquadLineKey>('ALL');
  const [search, setSearch] = useState('');
  const [cardPlayer, setCardPlayer] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);

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
  const upcomingAll = teamMatches
    .filter(m => !isPastFixture(m) && ['upcoming', 'live', 'halftime', 'postponed'].includes(m.status))
    .sort((a, b) => kickoff(a) - kickoff(b));
  const resultsAll = teamMatches.filter(m => isPastFixture(m)).sort((a, b) => kickoff(b) - kickoff(a));

  const lines = useMemo(() => {
    const found = search.trim() ? players.filter(p => matchesPlayer(p, search)) : players;
    return groupByLine(found).filter(g => line === 'ALL' || g.key === line);
  }, [players, search, line]);

  if (!club) return null;

  const trail = [{ href: `/${club.slug}/teams`, label: 'Teams' }];

  if (!team) {
    return (
      <ClubSubPage club={club} title={isHydrated ? 'Team not found' : 'Team'} trail={trail}>
        {isHydrated ? (
          <EmptyState title="This team could not be found" action={<Link href={`/${club.slug}/teams`} className="btn btn-secondary btn-sm">See all teams</Link>} />
        ) : <ListSkeleton rows={3} label="Loading the team" />}
      </ClubSubPage>
    );
  }

  const colour = team.color || club.primary_color;
  const currentSeason = getActiveSeason?.(club.id)?.name || defaultSeasonLabel();
  // This season's record; a team yet to play this season shows its latest season, named on the band
  const lastSeason = latestResult(teamMatches)?.season;
  const season = teamRecord(teamMatches, currentSeason).played > 0 || !lastSeason ? currentSeason : lastSeason;
  // A team that hides its scores publicly (junior grassroots rules) shows no record or form
  const record = team.hide_public_scores ? null : teamRecord(teamMatches, season);
  const form = team.hide_public_scores ? [] : teamForm(teamMatches);
  const meta = [publicTeamType(team.team_type), team.age_group, team.match_format].filter(Boolean).join(' · ');
  const seeAll = (view: 'upcoming' | 'past', count: number) => (
    <Link href={`/${club.slug}/fixtures?team=${encodeURIComponent(team.slug)}${view === 'past' ? '&view=past&season=all' : ''}`} className="tp-more">
      See all {count} {view === 'past' ? 'results' : 'fixtures'} <ChevronRight size={16} aria-hidden="true" />
    </Link>
  );

  return (
    <ClubSubPage club={club} title={team.name} trail={trail} width={1280} bare>
      <div className="team-page" style={teamColourVars(colour) as React.CSSProperties}>
        <section className="team-band" aria-labelledby="team-name">
          <SilkBackdrop primary={colour} secondary={club.secondary_color} numberSelector=".team-no-print" number={null} />
          <div className="team-band-in">
            <div>
              <h1 id="team-name" className="team-band-name">{team.name}</h1>
              {meta && <p className="team-band-meta">{meta}</p>}
              {team.description && <p className="team-band-about">{team.description}</p>}
            </div>
            {(record?.played || form.length > 0) ? (
              <div className="team-band-low">
                {record && record.played > 0 && (
                  <div>
                    <p className="team-band-season">{season} season</p>
                    <dl className="tp-leader-stats">
                      {([['Played', record.played], ['Won', record.won], ['Drawn', record.drawn], ['Lost', record.lost]] as const).map(([label, n]) => (
                        <div key={label}><dd>{n}</dd><dt>{label}</dt></div>
                      ))}
                    </dl>
                  </div>
                )}
                {form.length > 0 && (
                  <p className="team-band-form">
                    <span>Form, newest on the right</span>
                    <span className="row row-tight">{form.map((o, i) => <ResultChip key={i} outcome={o} />)}</span>
                  </p>
                )}
              </div>
            ) : null}
          </div>
        </section>

        {/* Friendly invitations (migration 20261157): the team's switch decides, so nothing shows before it runs */}
        {team.is_active && team.open_to_friendlies === true && (
          <div className="team-invite">
            <button type="button" className="btn btn-primary" onClick={() => setInviteOpen(true)}>
              <Handshake size={17} aria-hidden="true" /> Invite us to a friendly
            </button>
            <span className="text-note">For coaches and managers from other clubs</span>
          </div>
        )}

        <div className="team-cols">
          {/* First in the page so a phone reaches the games before a long squad; beside it on desktop */}
          <div className="team-games">
            <section aria-labelledby="team-next">
              <h2 id="team-next" className="team-h">{upcomingAll.length > 1 ? 'Next games' : 'Next game'}</h2>
              {upcomingAll.length === 0 ? (
                <p className="team-quiet">None scheduled.</p>
              ) : (
                <>
                  {upcomingAll.slice(0, UPCOMING_SHOWN).map(m => <FixtureRow key={m.id} match={m} clubSlug={club.slug} hideScore={team.hide_public_scores} />)}
                  {upcomingAll.length > UPCOMING_SHOWN && seeAll('upcoming', upcomingAll.length)}
                </>
              )}
            </section>
            <section aria-labelledby="team-results">
              <h2 id="team-results" className="team-h">Results</h2>
              {resultsAll.length === 0 ? (
                <p className="team-quiet">No games played yet.</p>
              ) : (
                <>
                  {resultsAll.slice(0, RESULTS_SHOWN).map(m => <FixtureRow key={m.id} match={m} clubSlug={club.slug} hideScore={team.hide_public_scores} />)}
                  {resultsAll.length > RESULTS_SHOWN && seeAll('past', resultsAll.length)}
                </>
              )}
            </section>
          </div>

          <div className="team-squad">
            {staff.length > 0 && (
              <section aria-labelledby="team-staff">
                <h2 id="team-staff" className="team-h">Coaches &amp; staff</h2>
                <ul className="team-rows">
                  {staff.map(({ member, role }) => (
                    <li key={`${member.id}-${role}`} className="team-row team-row-plain">
                      <PlayerAvatar name={member.full_name} photoUrl={member.photo_url} size={40} />
                      <span className="min-w-0"><strong>{member.full_name}</strong><small>{role}</small></span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section aria-labelledby="team-squad">
              <h2 id="team-squad" className="team-h">Squad {players.length > 0 && <small>{players.length} {players.length === 1 ? 'player' : 'players'}</small>}</h2>
              {team.is_junior ? (
                <div className="glass-panel row" style={{ padding: '1.25rem' }}>
                  <Lock size={16} color="var(--text-muted)" className="shrink-0" />
                  <span className="text-body">To protect our young players, this squad isn&apos;t listed publicly. Contact the club to find out more.</span>
                </div>
              ) : players.length === 0 ? (
                <p className="team-quiet">{isHydrated ? 'No players listed yet.' : 'Loading…'}</p>
              ) : (
                <>
                  {players.length > 6 && (
                    <div className="team-tools">
                      <div className="tp-seg" role="group" aria-label="Filter the squad by position">
                        {(['ALL', ...SQUAD_LINES.map(l => l.key)] as const).map(key => (
                          <button key={key} type="button" aria-pressed={line === key} onClick={() => setLine(key)}
                            aria-label={key === 'ALL' ? 'All positions' : SQUAD_LINES.find(l => l.key === key)?.title}>
                            {key === 'ALL' ? 'All' : key}
                          </button>
                        ))}
                      </div>
                      <input type="search" className="form-input" aria-label="Search the squad" placeholder="Search the squad"
                        value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') setSearch(''); }} autoComplete="off" />
                    </div>
                  )}
                  {/* Keyed by the filter, not the search, so typing doesn't flicker */}
                  <div key={line} className="team-lines tp-swap">
                    {lines.length === 0 && <p className="team-quiet">{search.trim() ? `No player matches “${search.trim()}”.` : 'No players in this position.'}</p>}
                    {lines.map(g => (
                      <section key={g.key} aria-label={g.title}>
                        <h3 className="team-line-h"><span>{g.title}</span><small>{g.list.length}</small></h3>
                        <ul className="team-rows">
                          {g.list.map(p => (
                            <li key={p.id}>
                              <SquadRow player={p} open={juniorIds.has(p.id) || p.is_junior ? undefined : () => setCardPlayer(p.id)} />
                            </li>
                          ))}
                        </ul>
                      </section>
                    ))}
                  </div>
                </>
              )}
            </section>

            {team.is_junior && (club.welfare_officer_name || club.welfare_officer_email || club.welfare_officer_phone) && (
              <section aria-labelledby="team-welfare">
                <h2 id="team-welfare" className="team-h"><ShieldCheck size={20} color="var(--club-primary)" aria-hidden="true" /> Welfare officer</h2>
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
          </div>
        </div>
      </div>
      {cardPlayer && <PlayerCardDialog club={club} playerId={cardPlayer} colour={colour} onClose={() => setCardPlayer(null)} />}
      <ContactModal club={club} isOpen={inviteOpen} onClose={() => setInviteOpen(false)} defaultType="Friendly Match" defaultTeamId={team.id} />
    </ClubSubPage>
  );
}
