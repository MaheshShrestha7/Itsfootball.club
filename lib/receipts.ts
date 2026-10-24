'use client';

import { getAccessToken } from '@/lib/supabase/client';
import { notify } from '@/components/ConfirmDialog';

/** A short-lived link to a private receipt, or the reason there isn't one */
export async function receiptLink(type: 'payment' | 'expense', id: string): Promise<{ url?: string; error?: string }> {
  const token = await getAccessToken();
  const res = await fetch(`/api/payments/receipt?type=${type}&id=${id}`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => null);
  const json = await res?.json().catch(() => ({})) ?? {};
  return res?.ok && json.url ? { url: json.url } : { error: json.error || 'Could not open the receipt.' };
}

// Receipts are private: ask the API for a short-lived link, then open it
export async function openReceipt(type: 'payment' | 'expense', id: string) {
  const win = window.open('', '_blank'); // opened synchronously so pop-up blockers allow it
  const token = await getAccessToken();
  const res = await fetch(`/api/payments/receipt?type=${type}&id=${id}`, { headers: { Authorization: `Bearer ${token}` } });
  const json = await res.json().catch(() => ({}));
  if (res.ok && json.url && win) win.location.href = json.url;
  else { win?.close(); await notify(json.error || 'Could not open the receipt.'); }
}
