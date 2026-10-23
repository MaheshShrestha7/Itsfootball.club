'use client';

import { getAccessToken } from '@/lib/supabase/client';
import { notify } from '@/components/ConfirmDialog';

// Receipts are private: ask the API for a short-lived link, then open it
export async function openReceipt(type: 'payment' | 'expense', id: string) {
  const win = window.open('', '_blank'); // opened synchronously so pop-up blockers allow it
  const token = await getAccessToken();
  const res = await fetch(`/api/payments/receipt?type=${type}&id=${id}`, { headers: { Authorization: `Bearer ${token}` } });
  const json = await res.json().catch(() => ({}));
  if (res.ok && json.url && win) win.location.href = json.url;
  else { win?.close(); await notify(json.error || 'Could not open the receipt.'); }
}
