import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { toClubRole } from './types';

export type AuthCheck =
  | { ok: true; userId: string; token: string; supabase: SupabaseClient }
  | { ok: false; status: 401 | 403 | 500; error: string };

/**
 * Verifies the caller's Supabase access token (sent as `Authorization: Bearer ...`) and that they
 * run at least one club (owner, or an owner/admin member). Everything is checked with the caller's
 * own token, so row-level security decides what they can see - no service key involved.
 */
export async function requireClubAdmin(request: Request): Promise<AuthCheck> {
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

  const userId = data.user.id;
  const [owned, memberships] = await Promise.all([
    supabase.from('clubs').select('id').eq('owner_id', userId).limit(1),
    supabase.from('club_members').select('role, roles').eq('user_id', userId),
  ]);
  // Roles are squad labels such as 'Player, Club Admin'
  const isAdmin = (memberships.data || []).some(m => ['owner', 'admin'].includes(toClubRole(m.role, m.roles)));
  if (!owned.data?.length && !isAdmin) {
    return { ok: false, status: 403, error: 'Only club administrators can upload files.' };
  }
  return { ok: true, userId, token, supabase };
}
