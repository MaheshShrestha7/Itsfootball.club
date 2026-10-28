// What this browser may keep in localStorage (lib/club-context.tsx STORAGE_KEY).
//
// The cache makes pages open instantly and keeps Match Centre working offline, but it outlives the
// visit: on a shared clubhouse laptop or a lost phone, anything in it can be read by whoever opens
// the browser next. So members are cached without their contact, health, family or pass details,
// and messages, gate scans and availability notes aren't cached at all; all of these come back
// from the database on the next load.
import type { ClubMember } from './supabase/types';

export const PRIVATE_MEMBER_FIELDS = [
  'email', 'phone', 'date_of_birth', 'emergency_contact', 'medical_notes', 'qr_code_token',
  'guardian_name', 'guardian_email', 'guardian_phone', 'application_notes', 'rejection_reason',
  'safeguarding_check_type', 'safeguarding_check_date', 'safeguarding_check_expiry_date',
  'fee_waived_at', 'fee_waived_by', 'fee_waiver_reason', 'height_cm', 'weight_kg',
] as const;

/** Entities never written to the cache (personal messages, who came through the gate, availability notes) */
export const UNCACHED_ENTITIES = ['memberMessages', 'gateScans', 'availabilities', 'inquiries'] as const;

/**
 * Members as cached. `pendingIds`: rows this device created that haven't reached the database yet
 * keep everything, or an offline sign-up would lose its details before it's saved.
 */
export function cacheSafeMembers<T extends Partial<ClubMember> & { id: string }>(members: T[], syncedIds: Iterable<string>): T[] {
  const synced = new Set(syncedIds);
  return members.map(m => {
    if (!synced.has(m.id)) return m;
    const copy: Record<string, unknown> = { ...m };
    for (const f of PRIVATE_MEMBER_FIELDS) delete copy[f];
    return copy as T;
  });
}
