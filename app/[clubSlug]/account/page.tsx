'use client';

import { use } from 'react';
import { useClub } from '@/lib/club-context';
import AccountSettings from '@/components/account/AccountSettings';

// Account settings inside a club's site (and on its own domain, where the sign-in is that domain's)
export default function ClubAccountPage({ params }: { params: Promise<{ clubSlug: string }> }) {
  const { clubSlug } = use(params);
  const club = useClub().selectClubBySlug(clubSlug) || undefined;
  return <AccountSettings club={club} signInHref={`/${club?.slug || clubSlug}/member`} />;
}
