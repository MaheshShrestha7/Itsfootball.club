'use client';

import { useEffect, useState } from 'react';
import { getSupabaseClient } from '@/lib/supabase/client';

/** True once the club has at least one product on sale and takes card payments (shop checkout is
 *  card only): the shop is only linked to from then on */
export function useShopOpen(clubId: string): boolean {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const client = getSupabaseClient();
    if (!client) return;
    Promise.all([
      client.from('shop_products').select('id', { count: 'exact', head: true }).eq('club_id', clubId).eq('is_active', true),
      client.from('club_payment_settings').select('stripe_charges_enabled').eq('club_id', clubId).maybeSingle(),
    ]).then(([products, settings]) => setOpen(Boolean(products.count) && settings.data?.stripe_charges_enabled === true));
  }, [clubId]);
  return open;
}
