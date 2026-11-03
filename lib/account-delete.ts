import type { SupabaseClient } from '@supabase/supabase-js';

// Deleting an account (the user themselves via /api/account, or Mission Control). Club records
// about them (squad entry, payments, attendance) belong to the club and stay, unlinked from the
// account. Club owners must hand over or close their club first: a club without an owner would
// have nobody able to run it. Server-only: needs the service-role client.

export type DeleteResult =
  | { ok: true }
  | { ok: false; status: 409; owned: { id: string; name: string }[] }
  | { ok: false; status: 500; error: string };

export async function deleteAccount(db: SupabaseClient, userId: string): Promise<DeleteResult> {
  const { data: owned, error: ownedError } = await db.from('clubs').select('id, name').eq('owner_id', userId);
  if (ownedError) return { ok: false, status: 500, error: ownedError.message };
  if (owned?.length) return { ok: false, status: 409, owned };

  const { error: unlinkError } = await db.from('club_members').update({ user_id: null }).eq('user_id', userId);
  if (unlinkError) return { ok: false, status: 500, error: unlinkError.message };

  const { error } = await db.auth.admin.deleteUser(userId);
  if (error) return { ok: false, status: 500, error: error.message };
  return { ok: true };
}
