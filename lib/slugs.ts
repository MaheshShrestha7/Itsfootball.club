// Shared by the browser (club-context) and the server (root layout), so kept free of 'use client'.

export const RESERVED_SLUGS = [
  'api', 'admin', 'clubs', 'create-club', 'my-clubs', 'verify', 'match', 'member',
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
