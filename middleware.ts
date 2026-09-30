import { NextRequest, NextResponse } from 'next/server';
import { SITE_URL, isPlatformHost } from './lib/slugs';

// Pages that only exist on itsfootball.club itself: on a club's own domain they send you back there
const PLATFORM_PAGES = ['clubs', 'create-club', 'my-clubs', 'faq', 'unsubscribe'];

// Club domain -> slug (null = no club has it). Per isolate; a changed domain shows up within a minute.
const HOST_TTL_MS = 60_000;
const hostCache = new Map<string, { slug: string | null; at: number }>();

/** The club using this domain; undefined when the lookup failed and nothing is cached */
async function slugForHost(host: string): Promise<string | null | undefined> {
  const hit = hostCache.get(host);
  if (hit && Date.now() - hit.at < HOST_TTL_MS) return hit.slug;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  try {
    const res = await fetch(
      `${url}/rest/v1/clubs?select=slug&is_active=eq.true&custom_domain=eq.${encodeURIComponent(host)}`,
      { headers: { apikey: key } }
    );
    if (!res.ok) throw new Error(`clubs lookup ${res.status}`);
    const slug = ((await res.json()) as { slug: string }[])[0]?.slug ?? null;
    hostCache.set(host, { slug, at: Date.now() });
    return slug;
  } catch {
    return hit?.slug; // stale beats down
  }
}

// Content-Security-Policy with a fresh nonce per request. Next.js reads the nonce from the request's
// CSP header and puts it on the scripts it renders, which is why every page renders dynamically
// (see `dynamic` in app/layout.tsx): a cached page would carry a stale nonce.
export async function middleware(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const csp = (process.env.CSP_TEMPLATE || '').replaceAll('__NONCE__', nonce);
  const { pathname, search } = request.nextUrl;

  // A club's own domain serves that club's pages at the root: yourclub.com/member is /{slug}/member.
  // Links inside the app still carry the slug (yourclub.com/{slug}/member), and those pass straight through.
  const host = (request.headers.get('host') || '').toLowerCase().split(':')[0];
  let clubSlug = '';
  let rewriteTo = '';
  if (host && !isPlatformHost(host)) {
    const slug = await slugForHost(host);
    if (slug === undefined) return new NextResponse('Temporarily unavailable, please try again.', { status: 503 });
    if (!slug) return NextResponse.redirect(`${SITE_URL}${pathname}${search}`);
    const first = pathname.split('/')[1]?.toLowerCase() || '';
    if (PLATFORM_PAGES.includes(first)) return NextResponse.redirect(`${SITE_URL}${pathname}${search}`);
    clubSlug = slug;
    // /api and /auth (sign-in links, see authReturnUrl) are the same on every domain
    if (first !== 'api' && first !== 'auth' && first !== slug) rewriteTo = `/${slug}${pathname === '/' ? '' : pathname}`;
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('Content-Security-Policy', csp);
  // The root layout loads the page's club data on the server (lib/supabase/server-data.ts)
  requestHeaders.set('x-pathname', rewriteTo || pathname);
  // The club whose own domain this is ('' on itsfootball.club), so the browser loads it (lib/club-context.tsx)
  requestHeaders.set('x-club-host-slug', clubSlug);

  const response = rewriteTo
    ? NextResponse.rewrite(new URL(`${rewriteTo}${search}`, request.url), { request: { headers: requestHeaders } })
    : NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', csp);
  return response;
}

export const config = {
  matcher: [
    {
      // Pages and API routes; static files and prefetches don't need a policy of their own. The service
      // worker, its offline page and the manifest are skipped too, so a club domain serves them from
      // its root instead of rewriting them to /{slug}/sw.js (which doesn't exist).
      source: '/((?!_next/static|_next/image|sw\\.js$|offline\\.html$|manifest\\.webmanifest$|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|txt|xml)$).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
