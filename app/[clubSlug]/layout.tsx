import React from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { clubSlugExists, findClubBySlug } from '@/lib/supabase/club-lookup';
import ClubLayoutClient from './ClubLayoutClient';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ clubSlug: string }>;
}): Promise<Metadata> {
  const { clubSlug } = await params;
  const club = await findClubBySlug(clubSlug);
  if (!club) return {};

  const title = `${club.name} | itsfootball.club`;
  const description = club.motto || `Official club hub for ${club.name} — live match center, squad, fixtures, and news.`;
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

export default async function ClubLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ clubSlug: string }>;
}) {
  const { clubSlug } = await params;

  // Server-side existence check so unknown club slugs return a real HTTP 404
  // instead of a client-rendered 200 "not found" page. This intentionally fails
  // open on a transient Supabase error (see clubSlugExists), unlike a plain
  // "club not found" lookup - a network blip shouldn't 404 every club page.
  if (!(await clubSlugExists(clubSlug))) {
    notFound();
  }

  return <ClubLayoutClient params={params}>{children}</ClubLayoutClient>;
}
