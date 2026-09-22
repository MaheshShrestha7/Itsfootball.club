import React from 'react';
import type { Metadata } from 'next';
import { findClubBySlug, findMatchById } from '@/lib/supabase/club-lookup';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ clubSlug: string; matchId: string }>;
}): Promise<Metadata> {
  const { clubSlug, matchId } = await params;
  const [club, match] = await Promise.all([
    findClubBySlug(clubSlug),
    findMatchById(matchId),
  ]);
  if (!club || !match) return {};

  const title = `${match.home_team_name} vs ${match.away_team_name} | ${club.name}`;
  const scoreLine =
    match.status === 'completed' || match.status === 'live' || match.status === 'halftime'
      ? `${match.home_team_name} ${match.home_score} - ${match.away_score} ${match.away_team_name}`
      : `${match.home_team_name} vs ${match.away_team_name}`;
  const description = `${scoreLine}${match.competition ? ` • ${match.competition}` : ''} • ${club.name} Match Center`;
  const image = club.banner_url || club.logo_url || undefined;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      siteName: 'itsfootball.club',
      type: 'website',
      ...(image ? { images: [{ url: image }] } : {}),
    },
    twitter: {
      card: image ? 'summary_large_image' : 'summary',
      title,
      description,
      ...(image ? { images: [image] } : {}),
    },
  };
}

export default function MatchLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
