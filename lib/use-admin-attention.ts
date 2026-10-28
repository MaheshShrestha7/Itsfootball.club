'use client';

import { useEffect, useState } from 'react';
import { getSupabaseClient } from './supabase/client';
import { useClub } from './club-context';
import { useAuth } from './auth-context';
import { attentionItems, type AttentionItem } from './admin-attention';
import { isEndingSoon, hasSentChange, isStaleSignup, sponsorSignupStage } from './sponsors';

/** The dashboard's "Needs you" list for one club, limited to what this person's roles can act on */
export function useAdminAttention(club: { id: string; slug: string }): AttentionItem[] {
  const { members, matches, inquiries, memberMessages, sponsors } = useClub();
  const { can } = useAuth();
  const [receiptsToReview, setReceiptsToReview] = useState(0);
  const [ordersToHandOut, setOrdersToHandOut] = useState(0);
  // Sponsor sign-ups whose bank transfer receipt is waiting: counted under receipts, not "not paid yet" (SPE-7)
  const [sponsorReceipts, setSponsorReceipts] = useState<Set<string>>(() => new Set());
  // Re-checked every minute so "enter the result" appears without a reload on matchday
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const db = getSupabaseClient();
    if (!db) return;
    db.from('payments').select('id', { count: 'exact', head: true })
      .eq('club_id', club.id).eq('status', 'awaiting_review')
      .then(({ count }) => setReceiptsToReview(count || 0));
    db.from('payments').select('id', { count: 'exact', head: true })
      .eq('club_id', club.id).eq('kind', 'shop_order').eq('status', 'paid').is('fulfilled_at', null)
      .then(({ count }) => setOrdersToHandOut(count || 0));
    db.from('payments').select('sponsor_id')
      .eq('club_id', club.id).eq('kind', 'sponsorship').eq('status', 'awaiting_review')
      .then(({ data }) => setSponsorReceipts(new Set((data || []).map(p => p.sponsor_id as string))));
  }, [club.id]);

  const clubSponsors = sponsors.filter(s => s.club_id === club.id);
  const unreadContact = inquiries.filter(i => i.club_id === club.id && i.status === 'unread').length;
  const unreadMemberMessages = memberMessages.filter(m => m.club_id === club.id && m.sender_type === 'member' && !m.is_read).length;
  const counts = {
    pendingApplications: members.filter(m => m.club_id === club.id && m.membership_status === 'pending').length,
    receiptsToReview,
    unreadMessages: unreadContact + unreadMemberMessages,
    unreadContact,
    ordersToHandOut,
    sponsorsToPutOnSite: clubSponsors.filter(s => sponsorSignupStage(s, now) === 'paid').length,
    sponsorSignups: clubSponsors.filter(s => sponsorSignupStage(s, now) === 'unpaid' && !sponsorReceipts.has(s.id)).length,
    sponsorsEndingSoon: clubSponsors.filter(s => isEndingSoon(s, now)).length,
    staleSponsorSignups: clubSponsors.filter(s => isStaleSignup(s, now)).length,
    sponsorChanges: clubSponsors.filter(s => hasSentChange(s)).length,
  };
  return attentionItems(club.slug, counts, matches.filter(m => m.club_id === club.id), now)
    .filter(item => can(club.id, item.area));
}
