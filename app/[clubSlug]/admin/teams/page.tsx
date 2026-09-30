'use client';

import { use } from 'react';
import InternalTeamsManager from '@/components/tournament/InternalTeamsManager';

// The club's own teams and squads (used for tournaments and internal matches)
export default function AdminTeamsPage({ params }: { params: Promise<{ clubSlug: string }> }) {
  const { clubSlug } = use(params);
  return <InternalTeamsManager clubSlug={clubSlug} />;
}
