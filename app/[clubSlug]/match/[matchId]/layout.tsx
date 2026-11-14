import React from 'react';
import type { Metadata } from 'next';
import { findClubMatch, matchReportReady } from '@/lib/supabase/club-lookup';
import { matchPath } from '@/lib/slugs';
import { clubImage, clubName, clubPageMetadata, fitDescription, fitTitle, pageMetadata } from '@/lib/seo';
import { tournamentMatchLabel } from '@/lib/tournament-engine';
import { clubTimeZone } from '@/lib/dates';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ clubSlug: string; matchId: string }>;
}): Promise<Metadata> {
  const { clubSlug, matchId } = await params;
  const match = await findClubMatch(clubSlug, matchId);
  // A finished game with only a score has a thin report: kept out of search until more is logged
  const thin = !!match && match.status === 'completed' && !match.score_hidden && !(await matchReportReady(match.id));

  return clubPageMetadata(clubSlug, club => {
    // The id and any old slug redirect here (app/[clubSlug]/layout.tsx), so the canonical is the current slug
    const path = match && match.club_id === club.id ? matchPath(club.slug, match) : `/${club.slug}/match/${matchId}`;
    if (!match || match.club_id !== club.id) {
      return pageMetadata({
        title: fitTitle('Match not found', clubName(club)),
        description: fitDescription(`This match could not be found. See the latest fixtures, results and live scores from ${club.name}.`, 'Browse all club fixtures.'),
        path,
        ...clubImage(club),
        noIndex: true,
      });
    }

    const fixture = `${match.home_team_name} vs ${match.away_team_name}`;
    const played = ['completed', 'full_time', 'live', 'halftime'].includes(match.status);
    const isLive = match.status === 'live' || match.status === 'halftime';
    // A team that hides its scores publicly: the description names the fixture, never the score
    const score = match.score_hidden ? fixture : `${match.home_team_name} ${match.home_score}-${match.away_score} ${match.away_team_name}`;
    const date = match.match_date
      ? new Date(match.match_date).toLocaleDateString('en-AU', { timeZone: clubTimeZone(club), day: 'numeric', month: 'short', year: 'numeric' })
      : null;
    // Same teams can meet twice (home and away, or a group game and a semi-final on one day), so the title
    // carries the cup stage, or else the date, to keep every match's title unique
    const which = tournamentMatchLabel(match) || date;
    // The old placeholder default isn't a competition (the match page hides it too)
    const competition = match.competition && match.competition !== 'Premier Regional League' ? match.competition : null;

    return pageMetadata({
      title: fitTitle(fixture, which, isLive ? 'Live Score' : played ? 'Result' : 'Match Preview', clubName(club)),
      description: fitDescription(
        isLive
          ? `Live: ${score}${competition ? ` in the ${competition}` : ''}.`
          : played
          ? `Full time: ${score}${competition ? ` in the ${competition}` : ''}.`
          : `${fixture}${competition ? `, ${competition}` : ''}${date ? ` on ${date}` : ''}.`,
        `Follow live goals, cards, lineups and the matchday squad on the ${club.name} match centre.`,
        'Get live goals, cards and lineups on the match centre.',
        isLive ? 'Tune in now.' : played ? 'See the full report.' : 'Set a reminder now.'
      ),
      path,
      ...clubImage(club),
      noIndex: thin,
    });
  });
}

export default function MatchLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
