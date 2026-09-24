import React from 'react';
import type { Metadata } from 'next';
import { findMatchById } from '@/lib/supabase/club-lookup';
import { clubImage, clubName, clubPageMetadata, fitDescription, fitTitle, pageMetadata } from '@/lib/seo';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ clubSlug: string; matchId: string }>;
}): Promise<Metadata> {
  const { clubSlug, matchId } = await params;
  const match = await findMatchById(matchId);

  return clubPageMetadata(clubSlug, club => {
    const path = `/${club.slug}/match/${matchId}`;
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
    const score = `${match.home_team_name} ${match.home_score}-${match.away_score} ${match.away_team_name}`;
    const date = match.match_date
      ? new Date(match.match_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
      : null;

    return pageMetadata({
      title: fitTitle(fixture, isLive ? 'Live Score' : played ? 'Result' : 'Match Preview', clubName(club)),
      description: fitDescription(
        isLive
          ? `Live: ${score}${match.competition ? ` in the ${match.competition}` : ''}.`
          : played
          ? `Full time: ${score}${match.competition ? ` in the ${match.competition}` : ''}.`
          : `${fixture}${match.competition ? `, ${match.competition}` : ''}${date ? ` on ${date}` : ''}.`,
        `Follow live goals, cards, lineups and the matchday squad on the ${club.name} match center.`,
        'Get live goals, cards and lineups on the match center.',
        isLive ? 'Tune in now.' : played ? 'See the full report.' : 'Set a reminder now.'
      ),
      path,
      ...clubImage(club),
    });
  });
}

export default function MatchLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
