import { authReturnTarget } from '@/lib/slugs';

// Where a Supabase Auth sign-in link should point (used by app/api/auth/email-hook).
//
// A club's own custom domain is only trusted when the domain is LIVE on our edge (Cloudflare for
// SaaS). "Live" means the domain's DNS points at us, so our own /auth/confirm — never someone
// else's server — receives the token and signs the member in. A domain that is only pending (or set
// to a server we don't control) is NOT trusted: the link falls back to the platform verify URL,
// which hands the session to itsfootball.club, our own origin. Without this, any club owner could
// set custom_domain to a domain they control, request a sign-in link for anyone else's email, and
// have the token delivered to their server (SEC11-1).

export interface AuthSignInLinkParams {
  /** NEXT_PUBLIC_SUPABASE_URL (trailing slash tolerated). */
  supabaseUrl: string;
  /** The Supabase redirect target for this email. */
  redirectTo: string;
  tokenHash: string;
  type: string;
  /** custom_domain of the club this email is branded as, if the email is for a club page. */
  clubCustomDomain: string | null | undefined;
  /** True only when that custom domain is confirmed live on our edge (see lib/cloudflare isLive). */
  domainIsLive: boolean;
}

const q = (key: string, value: string) => `${key}=${encodeURIComponent(value)}`;

export function authSignInLink(p: AuthSignInLinkParams): string {
  const target = authReturnTarget(p.redirectTo);
  // Trust the club domain only when the redirect really targets it AND it is live on our edge.
  const useOwnDomain = !!target && !!p.clubCustomDomain && p.clubCustomDomain === target.host && p.domainIsLive;

  if (useOwnDomain && target) {
    return `https://${target.host}/auth/confirm?${q('token_hash', p.tokenHash)}&${q('type', p.type)}&${q('next', target.pathname + target.search)}`;
  }
  return `${p.supabaseUrl.replace(/\/+$/, '')}/auth/v1/verify?${q('token', p.tokenHash)}&${q('type', p.type)}&${q('redirect_to', p.redirectTo)}`;
}
