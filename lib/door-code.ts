'use client';

import { useEffect, useState } from 'react';
import { getSupabaseClient } from './supabase/client';

/**
 * Door self check-in link for a match or event, carrying its secret door code.
 * Only club admins get a code back; everyone else gets null.
 */
export function useDoorCheckinUrl(path: string | null, targetId: string | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    setUrl(null);
    const client = getSupabaseClient();
    if (!client || !path || !targetId) return;
    let cancelled = false;
    client.rpc('get_door_checkin_code', { p_target_id: targetId }).then(({ data }) => {
      if (!cancelled && typeof data === 'string' && data) {
        setUrl(`${window.location.origin}${path}?code=${encodeURIComponent(data)}`);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [path, targetId]);

  return url;
}
