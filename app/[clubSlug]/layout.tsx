import React from 'react';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound, permanentRedirect, redirect } from 'next/navigation';
import { clubExists } from '@/lib/supabase/server-data';
import { SITE_NAME, clubImage, clubName, clubPageMetadata, clubPageTitle, fitDescription, fitTitle, pageMetadata } from '@/lib/seo';
import { findClubBySlug, newsMissing, resolveMatchParam } from '@/lib/supabase/club-lookup';
import { decodeSlugParam } from '@/lib/slugs';
import { isEventClub, tournamentPagePath } from '@/lib/public-tournaments';
import ClubLayoutClient from './ClubLayoutClient';

// The club home page. Every child route sets its own metadata, so this only ever applies to /[clubSlug].
export async function generateMetadata({ params }: { params: Promise<{ clubSlug: string }> }): Promise<Metadata> {
  const { clubSlug } = await params;
  return clubPageMetadata(clubSlug, club => ({
    // Installing from a club's pages gives that club's app (child pages inherit these two)
    manifest: `/${club.slug}/manifest.webmanifest`,
    appleWebApp: { capable: true, title: club.short_name || club.name, statusBarStyle: 'default' },
    ...pageMetadata({
      title: clubPageTitle(club),
      description: fitDescription(
        `Official website of ${club.name}: live match centre, fixtures, results, squad, club news and sponsors.`,
        club.motto && `${club.motto.replace(/[.!\s]+$/, '')}.`,
        'Follow the club and join as a member today.',
        'Join the club today.',
        'Join today.'
      ),
      // Canonical always uses the club's current slug, consolidating old slug aliases
      path: `/${club.slug}`,
      ...clubImage(club),
    }),
  }));
}

/**
 * /{club}/match/{param} or /{club}/news/{slug}: 'missing' when Supabase says the match or article doesn't
 * exist, or the current slug when a match was asked for by its id or a slug it had before a reschedule.
 */
async function checkSubPage(clubSlug: string, pathname: string): Promise<'missing' | { matchSlug: string } | null> {
  const [, , section, id, ...rest] = pathname.split('/');
  if (!id || rest.length) return null;
  if (section === 'match') {
    const found = await resolveMatchParam(clubSlug, id);
    if (found === 'missing') return 'missing';
    return found?.slug && found.slug !== id ? { matchSlug: found.slug } : null;
  }
  if (section === 'news') return (await newsMissing(clubSlug, decodeSlugParam(id))) ? 'missing' : null;
  return null;
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
  // open on a transient Supabase error (see clubExists), unlike a plain
  // "club not found" lookup - a network blip shouldn't 404 every club page.
  if (!(await clubExists(clubSlug))) {
    notFound();
  }
  // Same for a deleted match or news article. Checked here rather than in their own layouts: those render
  // inside ClubLayoutClient, which shows a loading shell on the server, so a notFound() there never
  // reaches the status code and the page went out as a 200 "not found".
  const subPage = await checkSubPage(clubSlug, (await headers()).get('x-pathname') || '');
  if (subPage === 'missing') notFound();

  // JSON-LD sits outside ClubLayoutClient: that shows a loading shell during server rendering (club data
  // loads in the browser), which would otherwise keep the structured data out of the HTML crawlers read.
  // Shown in place of the page if the club's data didn't load on the server in time, so the HTML
  // still names the club (same lookup as generateMetadata, so no extra request)
  const lookup = await findClubBySlug(clubSlug);
  // A tournament-only club has no club site: everything under it goes to its tournament page
  if (isEventClub(lookup)) redirect(tournamentPagePath(lookup!.slug));
  // One URL per match for search engines and shared links: the id and old slugs move to the readable slug.
  // The path keeps the club slug, which a club's own domain passes straight through (middleware.ts).
  if (subPage?.matchSlug) permanentRedirect(`/${lookup?.slug || clubSlug}/match/${subPage.matchSlug}`);
  const fallback = lookup ? { name: lookup.name, motto: lookup.motto || '' } : undefined;

  return (
    <>
      {schema}
      <ClubLayoutClient params={params} fallback={fallback}>{children}</ClubLayoutClient>
    </>
  );
}
