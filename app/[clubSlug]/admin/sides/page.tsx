'use client';

import { use } from 'react';
import InternalTeamsManager from '@/components/tournament/InternalTeamsManager';

// In-house sides: the club's own members split into sides for club cups (Players and teams in the menu)
export default function AdminSidesPage({ params }: { params: Promise<{ clubSlug: string }> }) {
  const { clubSlug } = use(params);
  return <InternalTeamsManager clubSlug={clubSlug} />;
}
