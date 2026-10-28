import { getSupabaseClient } from '@/lib/supabase/client';

// Two-step sign-in (an authenticator app code) on Supabase's built-in TOTP factors.
// The database treats a session that passed the second step as 'aal2'. Accounts that
// turned it on need aal2 for admin rights (mfa_ok() in 20261129_security_3.sql), and
// platform admins always need it.

export interface MfaStatus {
  /** The verified authenticator, if this account has one */
  factorId: string | null;
  /** This session already passed the second step */
  verified: boolean;
  /** Signed in with a password or link only, but the account has an authenticator */
  needsCode: boolean;
}

export async function getMfaStatus(): Promise<MfaStatus | null> {
  const client = getSupabaseClient();
  if (!client) return null;
  const [{ data: aal, error }, { data: factors }] = await Promise.all([
    client.auth.mfa.getAuthenticatorAssuranceLevel(),
    client.auth.mfa.listFactors(),
  ]);
  if (error || !aal) return null;
  const factor = factors?.totp?.find(f => f.status === 'verified') || null;
  return {
    factorId: factor?.id || null,
    verified: aal.currentLevel === 'aal2',
    needsCode: aal.currentLevel === 'aal1' && aal.nextLevel === 'aal2',
  };
}

/** Plain-language text for the errors people actually hit */
export function friendlyMfaError(message: string | undefined): string {
  const m = (message || '').toLowerCase();
  if (m.includes('invalid') || m.includes('expired')) return 'That code did not match. Check the time on your phone and try the newest code.';
  if (m.includes('rate') || m.includes('too many')) return 'Too many tries. Please wait a minute and try again.';
  if (m.includes('disabled') || m.includes('not enabled')) return 'Two-step sign-in is not switched on for this site yet. Please contact support.';
  return message || 'Something went wrong. Please try again.';
}

/** A 6-digit code, with spaces people paste from their app removed */
export function cleanCode(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, 6);
}
