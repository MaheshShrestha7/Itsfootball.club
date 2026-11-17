import { SITE_URL, authReturnTarget } from '@/lib/slugs';

// Where a Supabase Auth sign-in link should point (used by app/api/auth/email-hook).
//
// Always the platform verify link, which ends on itsfootball.club: a sign-in token never goes to a
// club's own domain. A club owner controls their domain, and Cloudflare saying it is "live" on our
// edge doesn't prove our code answers it (their own Cloudflare zone runs first in Orange-to-Orange,
// or they repoint DNS later), so a token sent there could be harvested to take over anyone's
// account (SEC11-1, SEC17-1). A sign-in asked for on a club domain lands on the same page at
// itsfootball.club (club pages live there too, under /{slug}).

export interface AuthSignInLinkParams {
  /** NEXT_PUBLIC_SUPABASE_URL (trailing slash tolerated). */
  supabaseUrl: string;
  /** The Supabase redirect target for this email. */
  redirectTo: string;
  tokenHash: string;
  type: string;
}

const q = (key: string, value: string) => `${key}=${encodeURIComponent(value)}`;

export function authSignInLink(p: AuthSignInLinkParams): string {
  // authReturnUrl from a club domain: SITE_URL/auth/confirm?to=<club domain page> -> that path on SITE_URL
  const target = authReturnTarget(p.redirectTo);
  const redirectTo = target ? `${SITE_URL}${target.pathname}${target.search}` : p.redirectTo;
  return `${p.supabaseUrl.replace(/\/+$/, '')}/auth/v1/verify?${q('token', p.tokenHash)}&${q('type', p.type)}&${q('redirect_to', redirectTo)}`;
}
