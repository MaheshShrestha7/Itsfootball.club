import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { AccessLevel } from '../permissions';

export type AuthCheck =
  | { ok: true; userId: string; token: string; supabase: SupabaseClient }
  | { ok: false; status: 401 | 403 | 500; error: string };

/**
 * Verifies the caller's Supabase access token (sent as `Authorization: Bearer ...`). The returned
 * client carries that token, so row-level security decides what it can see - no service key involved.
 */
export async function requireUser(request: Request): Promise<AuthCheck> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return { ok: false, status: 500, error: 'Authentication service is not configured.' };

  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim();
  if (!token) return { ok: false, status: 401, error: 'Sign in to continue.' };

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  // getUser() asks Supabase to validate the token (a forged or expired one is rejected)
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return { ok: false, status: 401, error: 'Your session has expired. Please sign in again.' };
  return { ok: true, userId: data.user.id, token, supabase };
}

/** requireUser, and the caller is the club's Owner (not just a Club Admin) */
export async function requireClubOwner(request: Request, clubId: string): Promise<AuthCheck> {
  const auth = await requireUser(request);
  if (!auth.ok) return auth;
  const { data } = await auth.supabase.from('clubs').select('owner_id').eq('id', clubId).maybeSingle();
  return data?.owner_id && data.owner_id === auth.userId
    ? auth
    : { ok: false, status: 403, error: 'Only the club Owner can do this.' };
}

/**
 * requireUser, and the caller's access roles at this club reach `level` on one of `areas`
 * (null: on any area). Owner and Club Admin always pass. See lib/permissions.ts.
 */
export async function requireClubPerm(
  request: Request,
  clubId: string,
  areas: string[] | null,
  level: AccessLevel = 'view'
): Promise<AuthCheck> {
  const auth = await requireUser(request);
  if (!auth.ok) return auth;
  const { data } = await auth.supabase.rpc('has_club_perm', { p_club_id: clubId, p_areas: areas, p_level: level });
  return data === true ? auth : { ok: false, status: 403, error: 'Your role at this club does not allow this.' };
}
