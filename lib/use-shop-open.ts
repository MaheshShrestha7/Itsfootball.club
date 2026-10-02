'use client';

import { useEffect, useState } from 'react';
import { getSupabaseClient } from '@/lib/supabase/client';

/** True once the club has at least one product on sale: the shop is only linked to from then on */
export function useShopOpen(clubId: string): boolean {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    getSupabaseClient()?.from('shop_products').select('id', { count: 'exact', head: true })
      .eq('club_id', clubId).eq('is_active', true)
      .then(({ count }) => setOpen(Boolean(count)));
  }, [clubId]);
  return open;
}
