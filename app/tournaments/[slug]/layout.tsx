import React from 'react';
import { notFound, redirect } from 'next/navigation';
import { clubExists } from '@/lib/supabase/server-data';
import { findClubBySlug } from '@/lib/supabase/club-lookup';
import { isEventClub } from '@/lib/public-tournaments';

// A public tournament page lives in a tournament-only club (lib/public-tournaments.ts). Unknown slugs
// get a real 404; a normal club's slug goes to that club's own tournaments.
export default async function PublicTournamentLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  // Fails open on a database error, like club pages do (see clubExists)
  if (!(await clubExists(slug))) notFound();
  const club = await findClubBySlug(slug);
  if (club && !isEventClub(club)) redirect(`/${club.slug}/tournaments`);
  return children;
}
