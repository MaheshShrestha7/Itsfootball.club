'use client';

import { use, useEffect } from 'react';
import Link from 'next/link';
import { useClub } from '@/lib/club-context';
import { useAuth } from '@/lib/auth-context';
import GettingStartedChecklist from '@/components/admin/GettingStartedChecklist';
import NeedsYouCard from '@/components/admin/NeedsYouCard';
import { useAdminAttention } from '@/lib/use-admin-attention';
import { defaultFixture } from '@/lib/fixtures';
import { matchPath } from '@/lib/slugs';
import LocalTime from '@/components/LocalTime';
import { isPlayerMember } from '@/lib/supabase/types';
import { Calendar, QrCode } from 'lucide-react';
import { getLiveMinute } from '@/lib/match-clock';
import LiveMinute from '@/components/LiveMinute';
import { defaultSeasonLabel } from '@/lib/season';
import { DATE_LOCALE } from '@/lib/dates';
import { isCountedMember } from '@/lib/people';

export default function AdminDashboardPage({
  params,
}: {
  params: Promise<{ clubSlug: string }>;
}) {
  const resolvedParams = use(params);
  const { clubs, selectClubBySlug, members, matches, activityLogs, getActiveSeason, getClubAnalytics, loadClubAnalytics, tournamentParticipants } = useClub();
  const club = selectClubBySlug(resolvedParams.clubSlug) || clubs[0];
  const { can, isClubSuperUser } = useAuth();
  // Shortcuts only for the areas this person's roles cover (a Treasurer has no fixtures or scanner)
  const canEditFixtures = can(club.id, 'matches', 'edit');
  const canScan = can(club.id, 'scanner');
  const canSeasons = can(club.id, 'seasons');
  const canFixtures = can(club.id, 'matches');
  const canAnalytics = can(club.id, 'analytics');
  const canMatchCentre = can(club.id, 'match-center');

  useEffect(() => {
    loadClubAnalytics(club.id);
  }, [club.id, loadClubAnalytics]);

  // Headcounts leave out applications still waiting (shown on their own) and rejected ones, as People does
  const clubMembers = members.filter(m => m.club_id === club.id && isCountedMember(m));
  const waitingCount = members.filter(m => m.club_id === club.id && m.membership_status === 'pending').length;
  const squadPlayers = clubMembers.filter(m => isPlayerMember(m));
  const clubMatches = matches.filter(m => m.club_id === club.id);
  const liveMatch = clubMatches.find(m => m.status === 'live' || m.status === 'halftime');
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

  return (
    <div className="admin-dash">
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
                <Link href={`/${club.slug}/admin/match-center`} className="btn btn-primary">Open Match Centre</Link>
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
            </div>
          ) : (
            <div className="admin-empty">
              <p>No match is live and nothing is scheduled.</p>
              {canEditFixtures && <Link href={`/${club.slug}/admin/matches`} className="btn btn-secondary">Schedule a match</Link>}
            </div>
          )}
        </section>
      </div>

      {/* The club's figures, one ruled strip */}
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
            <span className="admin-note">{liveMatch ? (liveMatch.status === 'halftime' ? 'Half time' : `${getLiveMinute(liveMatch)}′ in progress`) : 'This season'}</span>
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
    </div>
  );
}
