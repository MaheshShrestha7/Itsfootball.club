'use client';

import { useCallback, useEffect, useState } from 'react';
import { getSupabaseClient } from './supabase/client';
import type { AccessLevel } from './permissions';

/** A club's access role (table club_access_roles); members hold it by its name as a squad label */
export interface AccessRole {
  id: string;
  club_id: string;
  name: string;
  description?: string | null;
  permissions: Record<string, AccessLevel>;
  /** The locked Club Admin role: everything */
  is_super: boolean;
  sort_order: number;
}

/** The club's access roles, read straight from the database (not part of the synced club state) */
export function useAccessRoles(clubId: string) {
  const [roles, setRoles] = useState<AccessRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const db = getSupabaseClient();
    if (!db) return setLoading(false);
    const { data, error: err } = await db
      .from('club_access_roles')
      .select('*')
      .eq('club_id', clubId)
      .order('sort_order')
      .order('name');
    setError(err?.message ?? null);
    if (data) setRoles(data as AccessRole[]);
    setLoading(false);
  }, [clubId]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { roles, loading, error, reload };
}
