'use client';

import { use, useEffect } from 'react';
import Link from 'next/link';
import { useClub } from '@/lib/club-context';
import { useAuth } from '@/lib/auth-context';
import GettingStartedChecklist from '@/components/admin/GettingStartedChecklist';
import NeedsYouCard from '@/components/admin/NeedsYouCard';
import FixtureOffersCard from '@/components/admin/FixtureOffersCard';
import { clubTeamsOf } from '@/lib/teams';
import { useAdminAttention } from '@/lib/use-admin-attention';
import { defaultFixture } from '@/lib/fixtures';
import { matchPath } from '@/lib/slugs';
import LocalTime from '@/components/LocalTime';
import { countsTowardClubRecord, isPlayerMember } from '@/lib/supabase/types';
import { Calendar, QrCode } from 'lucide-react';
import { getLiveMinuteLabel } from '@/lib/match-clock';
import LiveMinute from '@/components/LiveMinute';
import { defaultSeasonLabel } from '@/lib/season';
import { DATE_LOCALE } from '@/lib/dates';
import { isCountedMember } from '@/lib/people';
import ClubOverview, { OVERVIEW_VIEWS } from '@/components/admin/ClubOverview';
import { comingEvents, lastResult, opponentLine, sameDayGames } from '@/lib/club-overview';
import { clubResult, OUTCOME_LABEL } from '@/lib/fixtures';
import { EVENT_TYPE_LABEL } from '@/lib/club-numbers';
import { useUrlTab } from '@/lib/use-url-tab';

export default function AdminDashboardPage({
  params,
}: {
  params: Promise<{ clubSlug: string }>;
}) {
  const resolvedParams = use(params);
  const { clubs, selectClubBySlug, members, matches, activityLogs, getActiveSeason, getClubAnalytics, loadClubAnalytics, tournamentParticipants, clubTeams, events } = useClub();
  const club = selectClubBySlug(resolvedParams.clubSlug) || clubs[0];
  const { can, isClubSuperUser } = useAuth();
  // Shortcuts only for the areas this person's roles cover (a Treasurer has no fixtures or scanner)
  const canEditFixtures = can(club.id, 'matches', 'edit');
  const canScan = can(club.id, 'scanner');
  const canSeasons = can(club.id, 'seasons');
  const canFixtures = can(club.id, 'matches');
  const canAnalytics = can(club.id, 'analytics');
  const canMatchCentre = can(club.id, 'match-center');
  const canEvents = can(club.id, 'events');

  // A card's detail screen (?view=money); the bare URL is the dashboard itself
  const [view, setView] = useUrlTab(OVERVIEW_VIEWS, 'view');

  useEffect(() => {
    loadClubAnalytics(club.id);
  }, [club.id, loadClubAnalytics]);

  // Headcounts leave out applications still waiting (shown on their own) and rejected ones, as People does
  const clubMembers = members.filter(m => m.club_id === club.id && isCountedMember(m));
  const waitingCount = members.filter(m => m.club_id === club.id && m.membership_status === 'pending').length;
  const squadPlayers = clubMembers.filter(m => isPlayerMember(m));
  const clubMatches = matches.filter(m => m.club_id === club.id);
  // DASH-4: every game that is live, not only the first one found
  const liveMatches = clubMatches.filter(m => m.status === 'live' || m.status === 'halftime');
  const liveMatch = liveMatches[0];
  const analytics = getClubAnalytics(club.id);
  const recentActivity = activityLogs
    .filter(l => l.club_id === club.id)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 5);
  const activeSeason = getActiveSeason ? getActiveSeason(club.id) : null;
  const attention = useAdminAttention(club);
  // When nothing is live, the Matchday card points at the next game instead of an empty box
  const nextFixture = defaultFixture(clubMatches, tournamentParticipants, club.name, { skipLive: true });
  const nextMatch = nextFixture?.status === 'upcoming' ? nextFixture : undefined;
  // DASH-4: the other games that day (a club with several teams plays more than one on a Saturday)
  const alsoThatDay = nextMatch ? sameDayGames(clubMatches, nextMatch) : [];
  // DASH-3: the last result and the jobs that follow full time
  const last = lastResult(clubMatches.filter(m => countsTowardClubRecord(m)));
  const lastRes = last ? clubResult(last) : null;
  // DASH-5: training, socials, the AGM and trials in the next two weeks
  const coming = canEvents ? comingEvents(events.filter(e => e.club_id === club.id)) : [];
  const gameHref = (m: { id: string }) => (canMatchCentre ? `/${club.slug}/admin/match-center?match=${m.id}` : matchPath(club.slug, m as typeof clubMatches[number]));

  return (
    <div className="admin-dash">
      {!view && (
        <>
          <div className="admin-dash-head">
            <div>
              <h1>{club.name} dashboard</h1>
              <p>Everything for running your club: matches, members, and your public website.</p>
            </div>

            {(canEditFixtures || canScan) && (
              <div className="admin-dash-actions">
                {canEditFixtures && (
                  <Link href={`/${club.slug}/admin/matches`} className="btn btn-secondary">
                    <Calendar size={16} aria-hidden="true" />
                    <span>Schedule matches</span>
                  </Link>
                )}
                {canScan && (
                  <Link href={`/${club.slug}/admin/scanner`} className="btn btn-secondary admin-dash-scan">
                    <QrCode size={16} aria-hidden="true" />
                    <span>Scan passes</span>
                  </Link>
                )}
              </div>
            )}
          </div>

          {isClubSuperUser(club.id) && <GettingStartedChecklist clubId={club.id} clubSlug={club.slug} />}

          {/* Friendlies another club on itsfootball.club offered to our site */}
          {canFixtures && <FixtureOffersCard club={club} teams={clubTeamsOf(clubTeams, club.id)} canAdd={canEditFixtures} />}

          {/* What's waiting on the committee, beside the club's next (or live) game; on phones the live game comes first */}
          <div className={liveMatch ? 'admin-dash-lead is-live' : 'admin-dash-lead'}>
            <NeedsYouCard items={attention} />

            <section className={liveMatch ? 'admin-panel admin-matchday is-live' : 'admin-panel admin-matchday'} aria-labelledby="matchday-title">
              <div className="admin-panel-head">
                <h2 id="matchday-title">Matchday</h2>
                {liveMatch ? (
                  <span className="admin-live-tag">{liveMatch.status === 'halftime' ? 'Live, half time' : <>Live, <LiveMinute match={liveMatch} />&prime;</>}</span>
                ) : (
                  <span className="admin-meta">No live match</span>
                )}
              </div>

              {liveMatch ? (
                <div className="admin-match">
                  <div className="admin-score">
                    <div className="admin-score-side">{liveMatch.home_team_name}<small>Home</small></div>
                    <div className="admin-goals" aria-label={`${liveMatch.home_score} to ${liveMatch.away_score}`}>{liveMatch.home_score} : {liveMatch.away_score}</div>
                    <div className="admin-score-side">{liveMatch.away_team_name}<small>Away</small></div>
                  </div>
                  {canMatchCentre && (
                    <Link href={`/${club.slug}/admin/match-center?match=${liveMatch.id}`} className="btn btn-primary">Open Match Centre</Link>
                  )}
                  {liveMatches.length > 1 && (
                    <div>
                      <p className="admin-kicker">Also live</p>
                      <ul className="admin-also">
                        {liveMatches.slice(1).map(m => (
                          <li key={m.id}><Link href={gameHref(m)}><span>{m.home_team_name} <span className="admin-vs">vs</span> {m.away_team_name}</span><b>{m.home_score} : {m.away_score}</b></Link></li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : nextMatch ? (
                <div className="admin-match">
                  <div>
                    <p className="admin-kicker">Next match</p>
                    <p className="admin-fixture">{nextMatch.home_team_name} <span className="admin-vs">vs</span> {nextMatch.away_team_name}</p>
                  </div>
                  <dl className="admin-facts">
                    <div><dt>Date</dt><dd><LocalTime value={nextMatch.match_date} options={{ weekday: 'short', day: 'numeric', month: 'short' }} /></dd></div>
                    <div><dt>Kick-off</dt><dd><LocalTime value={nextMatch.match_date} format="time" options={{ hour: 'numeric', minute: '2-digit' }} /></dd></div>
                    {nextMatch.venue && <div><dt>Venue</dt><dd>{nextMatch.venue}</dd></div>}
                  </dl>
                  <div className="admin-match-actions">
                    {canMatchCentre && (
                      <Link href={`/${club.slug}/admin/match-center?match=${nextMatch.id}`} className="btn btn-primary">Start match in Match Centre</Link>
                    )}
                    <Link href={matchPath(club.slug, nextMatch)} className="btn btn-secondary">Public match page</Link>
                  </div>
                  {alsoThatDay.length > 0 && (
                    <div>
                      <p className="admin-kicker">Also that day</p>
                      <ul className="admin-also">
                        {alsoThatDay.map(m => (
                          <li key={m.id}><Link href={gameHref(m)}><span>{m.home_team_name} <span className="admin-vs">vs</span> {m.away_team_name}</span><b><LocalTime value={m.match_date} format="time" options={{ hour: 'numeric', minute: '2-digit' }} /></b></Link></li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <div className="admin-empty">
                  <p>No match is live and nothing is scheduled.</p>
                  {canEditFixtures && <Link href={`/${club.slug}/admin/matches`} className="btn btn-secondary">Schedule a match</Link>}
                </div>
              )}

              {last && lastRes && (
                <div className="admin-last">
                  <p className="admin-kicker">Last result, <LocalTime value={last.match_date} options={{ weekday: 'short', day: 'numeric', month: 'short' }} /></p>
                  <p className="admin-last-line">
                    <b>{lastRes.outcome ? OUTCOME_LABEL[lastRes.outcome] : 'Played'} {lastRes.us} : {lastRes.them}</b> {opponentLine(last)}
                    {!last.is_audited && <span className="admin-meta"> · player stats not saved yet</span>}
                  </p>
                  <div className="admin-match-actions">
                    {!last.is_audited && canMatchCentre && (
                      <Link href={`/${club.slug}/admin/match-center?match=${last.id}`} className="btn btn-primary btn-sm">Save player stats</Link>
                    )}
                    {canFixtures && <Link href={`/${club.slug}/admin/matches`} className="btn btn-secondary btn-sm">Share the result</Link>}
                    <Link href={matchPath(club.slug, last)} className="btn btn-secondary btn-sm">Match page</Link>
                  </div>
                </div>
              )}
            </section>
          </div>

          {coming.length > 0 && (
            <section className="admin-panel" aria-labelledby="coming-title">
              <div className="admin-panel-head">
                <h2 id="coming-title">Coming up at the club</h2>
                <Link href={`/${club.slug}/admin/events`} className="admin-dash-link">Events and training</Link>
              </div>
              <ul className="admin-also is-events">
                {coming.map(e => (
                  <li key={e.id}>
                    <Link href={`/${club.slug}/admin/events`}>
                      <span>{e.title}<small>{EVENT_TYPE_LABEL[e.category] || 'Event'}, <LocalTime value={e.start_time} options={{ weekday: 'short', day: 'numeric', month: 'short' }} /> at <LocalTime value={e.start_time} format="time" options={{ hour: 'numeric', minute: '2-digit' }} />{e.location ? `, ${e.location}` : ''}</small></span>
                      <b>{e.rsvp_count || 0} going</b>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      {/* Club at a glance: the cards and their detail screens. Before migration 20261150 it falls
          back to the club's figures, one ruled strip */}
      <ClubOverview
        club={club}
        view={view}
        onView={setView}
        fallback={(
          <section className="admin-panel admin-dash-figures-wrap" aria-label="Club figures">
            <dl className="admin-dash-figures">
              <div>
                <dt>Active season</dt>
                <dd>{activeSeason?.name || defaultSeasonLabel()}</dd>
                {canSeasons && <Link href={`/${club.slug}/admin/seasons`}>Manage seasons</Link>}
              </div>
              <div>
                <dt>Players</dt>
                <dd>{squadPlayers.length}</dd>
                <span className="admin-note">{clubMembers.length} members in total{waitingCount > 0 && `, ${waitingCount} waiting to join`}</span>
              </div>
              <div>
                <dt>{liveMatch ? 'Live match' : 'Fixtures'}</dt>
                <dd className={liveMatch ? 'is-live' : undefined}>{liveMatch ? `${liveMatch.home_score} : ${liveMatch.away_score}` : clubMatches.length}</dd>
                <span className="admin-note">{liveMatch ? (liveMatch.status === 'halftime' ? 'Half time' : `${getLiveMinuteLabel(liveMatch)}′ in progress`) : 'This season'}</span>
                {canFixtures && <Link href={`/${club.slug}/admin/matches`}>Manage fixtures</Link>}
              </div>
              <div>
                <dt>Member passes</dt>
                <dd>{clubMembers.length}</dd>
                <span className="admin-note">{analytics.gateScansCount.toLocaleString()} {analytics.gateScansCount === 1 ? 'pass scanned' : 'passes scanned'} at the gate</span>
                {canScan && <Link href={`/${club.slug}/admin/scanner`}>Open the gate scanner</Link>}
              </div>
              <div>
                <dt>Public page visits</dt>
                <dd>{analytics.totalVisits.toLocaleString()}</dd>
                {canAnalytics && <Link href={`/${club.slug}/admin/analytics`}>See visitor stats</Link>}
              </div>
            </dl>
          </section>
        )}
      />

      {!view && (
        <section className="admin-panel" aria-labelledby="activity-title">
          <div className="admin-panel-head">
            <h2 id="activity-title">Recent activity</h2>
            {can(club.id, 'activity') && <Link href={`/${club.slug}/admin/activity`} className="admin-dash-link">Activity log</Link>}
          </div>
          {recentActivity.length === 0 ? (
            <p className="admin-empty">No activity yet.</p>
          ) : (
            <table className="admin-log">
              <thead><tr><th scope="col">What happened</th><th scope="col">When</th></tr></thead>
              <tbody>
                {recentActivity.map(act => (
                  <tr key={act.id}>
                    <td>{act.description}</td>
                    <td className="admin-when">{new Date(act.created_at).toLocaleString(DATE_LOCALE)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}
    </div>
  );
}
