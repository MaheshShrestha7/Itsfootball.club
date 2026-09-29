// Shared by the browser (club-context), the server (root layout) and middleware, so kept free of
// 'use client' and of imports.

// Deliberately not NEXT_PUBLIC_APP_URL: that one is localhost in local .env files, and NEXT_PUBLIC_
// values are inlined at build time, so a local build would ship localhost canonical URLs.
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://itsfootball.club').replace(/\/+$/, '');
const SITE_HOST = new URL(SITE_URL).host;

/** itsfootball.club itself (any subdomain), local dev or a workers.dev preview, i.e. not a club's own domain */
export function isPlatformHost(host: string): boolean {
  const h = host.toLowerCase().split(':')[0];
  return h === SITE_HOST || h.endsWith(`.${SITE_HOST}`) || h === 'localhost' || h === '127.0.0.1' || h.endsWith('.workers.dev');
}

// Supabase only sends sign-in links back to allowlisted URLs, and a club's own domain isn't one. So a
// page there asks for SITE_URL/auth/confirm?to=<page>, and the email hook (app/api/auth/email-hook)
// turns that into a link to <club domain>/auth/confirm, which verifies the token on the club's domain.
const CONFIRM_PATH = '/auth/confirm';

/** The emailRedirectTo for a sign-in link that should land on `path` of the site at `origin` */
export function authReturnUrl(origin: string, path: string): string {
  const url = `${origin}${path}`;
  return isPlatformHost(new URL(origin).host) ? url : `${SITE_URL}${CONFIRM_PATH}?to=${encodeURIComponent(url)}`;
}

/** The page an authReturnUrl was asked for, or null when `redirectTo` isn't one */
export function authReturnTarget(redirectTo: string): URL | null {
  try {
    const url = new URL(redirectTo);
    if (url.origin !== new URL(SITE_URL).origin || url.pathname !== CONFIRM_PATH) return null;
    return new URL(url.searchParams.get('to') || '');
  } catch {
    return null;
  }
}

/** A same-site path to go to after signing in: anything else (another site, '//evil.com') becomes '/' */
export const safeNextPath = (next: string | null) => (next && /^\/(?![/\\])/.test(next) ? next : '/');

/** 'https://WWW.YourClub.com/news' -> 'www.yourclub.com'; '' when it isn't a usable club domain */
export function normalizeDomain(input: string | null | undefined): string {
  const host = (input || '').trim().toLowerCase().replace(/^[a-z]+:\/\//, '').split(/[/?#:]/)[0].replace(/\.$/, '');
  const valid = /^(?=.{4,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(host);
  return valid && !isPlatformHost(host) ? host : '';
}

export const RESERVED_SLUGS = [
  'api', 'admin', 'clubs', 'create-club', 'my-clubs', 'faq', 'unsubscribe', 'verify', 'match', 'member',
  'squad', 'events', 'news', 'sponsors', 'branding', 'analytics', 'scanner',
  'login', 'register', 'auth', 'settings', 'dashboard', 'static', 'assets'
];

/** The club a path belongs to ('/ancc/match/123' -> 'ancc'), or '' for platform pages */
export function clubSlugFromPath(pathname: string | null | undefined): string {
  let first = '';
  try {
    first = decodeURIComponent(pathname?.split('/')[1] || '').toLowerCase();
  } catch {
    return ''; // malformed escape in the URL
  }
  return first && !RESERVED_SLUGS.includes(first) ? first : '';
}
