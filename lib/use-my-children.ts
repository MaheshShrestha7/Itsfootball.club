'use client';

import { useEffect, useState } from 'react';
import { getSupabaseClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import type { ClubMember } from '@/lib/supabase/types';

// One request per club and signed-in user, shared by the navbar, tab bar and app home
const cache = new Map<string, Promise<ClubMember[]>>();

/** The children the signed-in parent or guardian looks after at this club (my_children RPC); [] when signed out */
export function useMyChildren(clubId: string): ClubMember[] {
  const { user } = useAuth();
  const [children, setChildren] = useState<ClubMember[]>([]);
  useEffect(() => {
    const client = getSupabaseClient();
    if (!user || !client) return setChildren([]);
    const key = `${clubId}:${user.id}`;
    if (!cache.has(key)) {
      cache.set(key, Promise.resolve(client.rpc('my_children', { p_club_id: clubId }))
        .then(({ data, error }) => (!error && Array.isArray(data) ? (data as ClubMember[]) : [])));
    }
    let live = true;
    cache.get(key)!.then(list => { if (live) setChildren(list); });
    return () => { live = false; };
  }, [clubId, user]);
  return children;
}
