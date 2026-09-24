import React from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { clubSlugExists } from '@/lib/supabase/club-lookup';
import { SITE_NAME, clubImage, clubName, clubPageMetadata, fitDescription, fitTitle, pageMetadata } from '@/lib/seo';
import ClubLayoutClient from './ClubLayoutClient';

// The club home page. Every child route sets its own metadata, so this only ever applies to /[clubSlug].
export async function generateMetadata({ params }: { params: Promise<{ clubSlug: string }> }): Promise<Metadata> {
  const { clubSlug } = await params;
  return clubPageMetadata(clubSlug, club =>
    pageMetadata({
      title: fitTitle(clubName(club), 'Fixtures, Squad & Live Scores', SITE_NAME),
      description: fitDescription(
        `Official website of ${club.name}: live match center, fixtures, results, squad, club news and sponsors.`,
        club.motto && `${club.motto.replace(/[.!\s]+$/, '')}.`,
        'Follow the club and join as a member today.',
        'Join the club today.',
        'Join today.'
      ),
      // Canonical always uses the club's current slug, consolidating old slug aliases
      path: `/${club.slug}`,
      ...clubImage(club),
    })
  );
}

export default async function ClubLayout({
  children,
  schema,
  params,
}: {
  children: React.ReactNode;
  /** @schema slot: the page's JSON-LD */
  schema: React.ReactNode;
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

  // JSON-LD sits outside ClubLayoutClient: that shows a loading shell during server rendering (club data
  // loads in the browser), which would otherwise keep the structured data out of the HTML crawlers read.
  return (
    <>
      {schema}
      <ClubLayoutClient params={params}>{children}</ClubLayoutClient>
    </>
  );
}
