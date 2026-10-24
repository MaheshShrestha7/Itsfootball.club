'use client';

import { use } from 'react';
import { useClub } from '@/lib/club-context';
import ClubShop from '@/components/ClubShop';

export default function ShopPage({ params }: { params: Promise<{ clubSlug: string }> }) {
  const { clubSlug } = use(params);
  const { clubs, selectClubBySlug } = useClub();
  return <ClubShop club={selectClubBySlug(clubSlug) || clubs[0]} />;
}
