'use client';

import { use } from 'react';
import TournamentAdminScreen from '@/components/tournament/TournamentAdminScreen';

export default function AdminTournamentDetailPage({
  params,
}: {
  params: Promise<{ clubSlug: string; tournamentId: string }>;
}) {
  const { clubSlug, tournamentId } = use(params);
  return <TournamentAdminScreen clubSlug={clubSlug} tournamentId={tournamentId} />;
}
