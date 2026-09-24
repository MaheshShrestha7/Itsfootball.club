import type { Metadata } from 'next';
import { findClubBySlug, type ClubMetadataRow } from './supabase/club-lookup';

export const SITE_NAME = 'itsfootball.club';
// Deliberately not NEXT_PUBLIC_APP_URL: that one is localhost in local .env files, and NEXT_PUBLIC_
// values are inlined at build time, so a local build would ship localhost canonical URLs.
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://itsfootball.club').replace(/\/+$/, '');
export const DEFAULT_OG_IMAGE = '/og-default.jpg';

const TITLE_MAX = 60;
const DESC_MIN = 140;
const DESC_MAX = 155;

function truncateWords(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const space = cut.lastIndexOf(' ');
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,;:|•–—-]+$/, '')}…`;
}

/** A title part, or [preferred, shorter] alternatives (e.g. a club's full name and short name). */
type TitlePart = string | [string, string] | null | undefined;

/** Joins parts with " | " within 60 chars: first swaps in the shorter alternatives, then drops parts from the end. */
export function fitTitle(...parts: TitlePart[]): string {
  const present = parts.filter((p): p is string | [string, string] => !!p && (Array.isArray(p) ? !!p[0] : !!p.trim()));
  const long = present.map(p => (Array.isArray(p) ? p[0] : p).trim());
  const short = present.map(p => (Array.isArray(p) ? p[1] || p[0] : p).trim());
  for (let n = present.length; n >= 1; n--) {
    for (const set of [long, short]) {
      const title = set.slice(0, n).join(' | ');
      if (title.length <= TITLE_MAX) return title;
    }
  }
  return truncateWords(short[0] || SITE_NAME, TITLE_MAX);
}

// Last-resort calls to action (longest first) for when a page's own sentences land short of 140 chars,
// e.g. for a club with a very short name
const TOP_UP_CTAS = ['Visit the club website today.', 'Find out more today.', 'Find out more.', 'Visit today.', 'Learn more.', 'Join us.'];

/** Builds a 140-155 char description from sentences in priority order: a sentence that would overflow is
 *  skipped in favour of a later (shorter) one, and it stops as soon as the minimum length is reached. */
export function fitDescription(...sentences: (string | null | undefined | false)[]): string {
  let out = '';
  for (const s of [...sentences, ...TOP_UP_CTAS]) {
    if (!s || !s.trim()) continue;
    const next = out ? `${out} ${s.trim()}` : s.trim();
    if (next.length > DESC_MAX) {
      if (!out) out = truncateWords(s.trim(), DESC_MAX);
      continue;
    }
    out = next;
    if (out.length >= DESC_MIN) break;
  }
  return out;
}

interface PageMetaInput {
  title: string;
  description: string;
  /** Site-relative canonical path, e.g. "/ancc/match/123" */
  path: string;
  /** Wide banner or square logo; falls back to the 1200x630 site card */
  image?: string | null;
  imageIsSquare?: boolean;
  type?: 'website' | 'article';
  noIndex?: boolean;
}

export function pageMetadata({ title, description, path, image, imageIsSquare, type = 'website', noIndex }: PageMetaInput): Metadata {
  const url = image || DEFAULT_OG_IMAGE;
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: path },
    openGraph: {
      title,
      description,
      url: path,
      siteName: SITE_NAME,
      type,
      images: [{ url, alt: title }],
    },
    twitter: {
      card: image && imageIsSquare ? 'summary' : 'summary_large_image',
      title,
      description,
      images: [url],
    },
    ...(noIndex ? { robots: { index: false, follow: false } } : {}),
  };
}

/** Club name plus its short name as the fallback when the title runs long */
export const clubName = (club: ClubMetadataRow): [string, string] => [club.name, club.short_name || club.name];

/** The club's preview image: its banner if it has one (wide), else its crest (square), else the site card */
export function clubImage(club: ClubMetadataRow): { image: string | null; imageIsSquare: boolean } {
  if (club.banner_url) return { image: club.banner_url, imageIsSquare: false };
  if (club.logo_url) return { image: club.logo_url, imageIsSquare: true };
  return { image: null, imageIsSquare: false };
}

/** generateMetadata body for a page under /[clubSlug]: looks the club up and hands it to `build`. */
export async function clubPageMetadata(
  clubSlug: string,
  build: (club: ClubMetadataRow) => Metadata | Promise<Metadata>
): Promise<Metadata> {
  const club = await findClubBySlug(clubSlug);
  if (!club) return { title: { absolute: fitTitle('Club not found', SITE_NAME) }, robots: { index: false, follow: false } };
  return build(club);
}

/** Admin screens: unique tab titles, never indexed. `task` completes "... for <club>", e.g. "Manage the squad". */
export function adminMetadata(label: string, section: string, task = `Manage ${label.toLowerCase()}`) {
  return async ({ params }: { params: Promise<{ clubSlug: string; [key: string]: string }> }): Promise<Metadata> => {
    const resolved = await params;
    const path = section.replace(/\[(\w+)\]/g, (_, key) => resolved[key] || key);
    return clubPageMetadata(resolved.clubSlug, club =>
      pageMetadata({
        title: fitTitle(/admin/i.test(label) ? label : `${label} Admin`, clubName(club), SITE_NAME),
        description: fitDescription(
          `${task} for ${club.name} in the club admin console on ${SITE_NAME}.`,
          'Sign in as a club admin to make changes, then publish them to your public club website instantly.',
          'Sign in as a club admin to continue.',
          'Sign in to continue.'
        ),
        path: `/${club.slug}/admin${path ? `/${path}` : ''}`,
        ...clubImage(club),
        noIndex: true,
      })
    );
  };
}
