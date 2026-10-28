// Server check of a Cloudflare Turnstile token (components/Captcha.tsx makes them), for public
// forms that don't go through Supabase Auth. Enforced only when both keys are set, so a site
// without Turnstile, or with only the site key, works as before.

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export function turnstileEnforced(): boolean {
  return Boolean(process.env.TURNSTILE_SECRET_KEY && process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);
}

/** True when the token is valid, or when the check is not set up */
export async function verifyTurnstile(token: unknown, ip?: string | null): Promise<boolean> {
  if (!turnstileEnforced()) return true;
  if (typeof token !== 'string' || !token || token.length > 2048) return false;
  const body = new URLSearchParams({ secret: process.env.TURNSTILE_SECRET_KEY as string, response: token });
  if (ip && ip !== 'unknown') body.set('remoteip', ip);
  try {
    const res = await fetch(VERIFY_URL, { method: 'POST', body });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    // Cloudflare unreachable: refuse, the visitor can try again
    return false;
  }
}

export const TURNSTILE_FAILED = 'The security check did not pass. Please complete it again and resend.';
