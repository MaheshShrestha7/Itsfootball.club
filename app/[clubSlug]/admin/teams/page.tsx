'use client';

import { use, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ClubTeamsManager from '@/components/teams/ClubTeamsManager';

// Club teams (first team, reserves, academy, youth). Tournament sides live on the Tournaments screen.
export default function AdminTeamsPage({ params }: { params: Promise<{ clubSlug: string }> }) {
  const { clubSlug } = use(params);
  const router = useRouter();
  // Old links to the tournament sides tab (#tournament-sides) go to their new home
  useEffect(() => {
    if (window.location.hash === '#tournament-sides') router.replace(`/${clubSlug}/admin/tournaments#tournament-sides`);
  }, [clubSlug, router]);
  return <ClubTeamsManager clubSlug={clubSlug} />;
}
