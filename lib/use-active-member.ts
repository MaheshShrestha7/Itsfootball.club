'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { getSupabaseClient } from '@/lib/supabase/client';

/** The signed-in viewer is an active member of the club, or the guardian of one
 *  (is_active_club_member, migration 20261141). Display only: what a member pays is decided by the
 *  server (lib/payments-server.ts). False when signed out or before the migration runs */
export function useIsActiveMember(clubId: string): boolean {
  const { user } = useAuth();
  const [member, setMember] = useState(false);
  useEffect(() => {
    const db = getSupabaseClient();
    if (!user || !db || !clubId) return;
    let cancelled = false;
    db.rpc('is_active_club_member', { p_club_id: clubId }).then(({ data }) => { if (!cancelled) setMember(data === true); });
    return () => { cancelled = true; };
  }, [user, clubId]);
  return !!user && member;
}
