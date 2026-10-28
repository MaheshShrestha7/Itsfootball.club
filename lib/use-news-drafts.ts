'use client';

import { useEffect, useState } from 'react';
import { getSupabaseClient } from '@/lib/supabase/client';

/**
 * Drafts and scheduled posts need migration 20261130_news_drafts.sql. Until it runs, the draft
 * options stay hidden so news keeps saving (null while checking).
 */
export function useNewsDraftsReady(): boolean | null {
  const [ready, setReady] = useState<boolean | null>(() => (getSupabaseClient() ? null : true));
  useEffect(() => {
    getSupabaseClient()?.from('news_articles').select('is_draft').limit(1).then(({ error }) => setReady(!error));
  }, []);
  return ready;
}
