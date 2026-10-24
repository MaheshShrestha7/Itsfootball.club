import { getAccessToken } from '@/lib/supabase/client';
import { confirmAction, notify } from '@/components/ConfirmDialog';
import type { ClubMember } from '@/lib/supabase/types';
import { DATE_LOCALE } from '@/lib/dates';

const formatDate = (value: string | null | undefined) => {
  if (!value) return '—';
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value);
  return isNaN(d.getTime()) ? value : d.toLocaleDateString(DATE_LOCALE, { day: 'numeric', month: 'short', year: 'numeric' });
};

/**
 * Renewal reminder email to one member (same email as the bulk notice in Email Notifications), after
 * asking first. Resolves true once it has gone; anything else is explained in a notice.
 */
export async function sendRenewalEmail(club: { id: string; name: string }, member: ClubMember, onSending?: (sending: boolean) => void): Promise<boolean> {
  const ok = await confirmAction({
    title: `Send a renewal email to ${member.full_name}?`,
    message: `It goes to ${member.email} with their expiry date (${formatDate(member.membership_expires_at)}) and a link to renew.`,
    confirmLabel: 'Send email',
  });
  if (!ok) return false;
  onSending?.(true);
  try {
    const res = await fetch('/api/admin/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await getAccessToken()}` },
      body: JSON.stringify({ clubId: club.id, kind: 'renewal', memberId: member.id, send: true }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { notify('Email not sent', data.error || 'Please try again.'); return false; }
    if (data.sent) return true;
    if (data.optedOut) notify('Email not sent', `${member.full_name} has unsubscribed from ${club.name} emails.`);
    else if (data.alreadySent) notify('Already sent today', `${member.full_name} got a renewal email from you today. You can send another tomorrow.`);
    else notify('Email not sent', data.error || 'Please try again.');
    return false;
  } finally {
    onSending?.(false);
  }
}
