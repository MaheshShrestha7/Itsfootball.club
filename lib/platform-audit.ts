import type { SupabaseClient } from '@supabase/supabase-js';

// Writes one Mission Control action to admin_audit_log from an API route that uses the service role
// (the database triggers can't see who is signed in there). A failed write is logged, never thrown,
// so the action itself still succeeds. The Action log groups rows by the action's prefix
// (platform_audit_kind in migration 20261163): user_, support_, broadcast_, ground_, job_.
export interface PlatformActor { userId: string; confirmedEmail?: string | null }
export interface PlatformAuditEntry {
  clubId?: string | null;
  action: string;
  table: string;
  targetId?: string | null;
  summary: string;
  details?: Record<string, unknown>;
}

export async function logPlatformAction(db: SupabaseClient, actor: PlatformActor, e: PlatformAuditEntry): Promise<void> {
  const { error } = await db.from('admin_audit_log').insert({
    club_id: e.clubId || null,
    actor_id: actor.userId,
    actor_email: actor.confirmedEmail || null,
    action: e.action,
    target_table: e.table,
    target_id: e.targetId || null,
    summary: e.summary.slice(0, 300),
    details: e.details || {},
  });
  if (error) console.error(`[platform-audit] ${e.action} not logged:`, error.message);
}
