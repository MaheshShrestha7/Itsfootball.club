'use client';

import React, { useState, useEffect } from 'react';
import { passTokenHint } from '@/lib/ids';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabase/client';
import { notify } from '@/components/ConfirmDialog';
import { useClub } from '@/lib/club-context';
import { receiptLink } from '@/lib/receipts';
import { useAuth } from '@/lib/auth-context';
import { ClubMember, isPlayerMember, MembershipPlan } from '@/lib/supabase/types';
import {
  UserCheck,
  CheckCircle2,
  XCircle,
  Search,
  Mail,
  Phone,
  CreditCard,
  MessageSquare,
  Check,
  X,
  Sparkles,
  Calendar,
  RotateCw,
  Lock,
  Gift,
  Settings,
  Banknote,
  FileText
} from 'lucide-react';
import PlayerAvatar from '@/components/PlayerAvatar';
import { canSendRenewal, sendRenewalEmail } from '@/components/admin/renewalEmail';
import { ageGroupCutoff, ageGroupFit, suggestJuniorTeam } from '@/lib/teams';
import { DATE_LOCALE } from '@/lib/dates';
import { formatMoney, parseMoneyToCents, policyAllowsWaiver, MEMBERSHIP_PAYMENT_POLICIES } from '@/lib/finance';
import { useMemberHealth } from '@/lib/use-member-health';
import MedicalNote from '@/components/admin/MedicalNote';

/** '2026-10-01' or an ISO timestamp as "1 Oct 2026"; date-only values stay on their calendar day */
function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value);
  return isNaN(d.getTime()) ? value : d.toLocaleDateString(DATE_LOCALE, { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Whole years from a 'YYYY-MM-DD' birth date to today */
function ageOn(dateOfBirth: string): number | null {
  const [y, m, d] = dateOfBirth.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return null;
  const now = new Date();
  return now.getFullYear() - y - (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d) ? 1 : 0);
}


export type MemberTab = 'pending' | 'active' | 'rejected';

/**
 * Applications, member passes and rejected applications (the old Members page), shown on the
 * People page. The tab lives in the People page's URL, so it comes in as a prop.
 */
export default function MembersWorkspace({
  clubSlug,
  tab: activeTab,
  onTabChange: setActiveTab,
}: {
  clubSlug: string;
  tab: MemberTab;
  onTabChange: (tab: MemberTab) => void;
}) {
  const {
    clubs,
    selectClubBySlug,
    members,
    approveMemberApplication,
    rejectMemberApplication,
    recordMembershipSignupPayment,
    refreshMemberRow,
    clubTeams,
    getActiveSeason,
  } = useClub();
  const { user, can } = useAuth();

  const club = selectClubBySlug(clubSlug) || clubs[0];
  const clubMembers = members.filter(m => m.club_id === club.id);
  const health = useMemberHealth(club.id);

  const searchParams = useSearchParams();
  const [searchQuery, setSearchQuery] = useState('');
  // ?member=<id> (e.g. Finance's Application button): open that member's tab and bring the card into view
  const focusMemberId = searchParams.get('member');
  const focusMember = focusMemberId ? clubMembers.find(m => m.id === focusMemberId) : undefined;
  const focusTab = !focusMember ? null : focusMember.membership_status === 'pending' ? 'pending' : focusMember.membership_status === 'rejected' ? 'rejected' : 'active';
  useEffect(() => {
    if (!focusTab || !focusMemberId) return;
    const show = setTimeout(() => setActiveTab(focusTab), 0);
    const scroll = setTimeout(() => document.getElementById(`member-card-${focusMemberId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 200);
    return () => { clearTimeout(show); clearTimeout(scroll); };
    // Once per link (setActiveTab is stable enough; re-running would fight the admin's own tab clicks)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusMemberId, focusTab]);
  const [rejectModalMember, setRejectModalMember] = useState<ClubMember | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [waiveModalMember, setWaiveModalMember] = useState<ClubMember | null>(null);
  const [waiveReason, setWaiveReason] = useState('');
  // Cash or bank payment taken by hand for an application
  const [payModalMember, setPayModalMember] = useState<ClubMember | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<'cash' | 'bank_transfer' | 'other'>('cash');
  const [payNote, setPayNote] = useState('');
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [currency, setCurrency] = useState('AUD');

  useEffect(() => {
    const client = getSupabaseClient();
    if (!client) return;
    client.from('membership_plans').select('*').eq('club_id', club.id)
      .then(({ data }) => setPlans((data || []) as MembershipPlan[]));
    client.from('club_payment_settings').select('currency').eq('club_id', club.id).maybeSingle()
      .then(({ data }) => data?.currency && setCurrency(data.currency));
  }, [club.id]);

  // Sign-up payment status per member (paid by card, or a bank receipt waiting in Finance)
  const [signupPayments, setSignupPayments] = useState<Record<string, string>>({});
  // Bank receipts waiting to be checked, so the card can show and verify them without going to Finance
  const [receiptsToCheck, setReceiptsToCheck] = useState<Record<string, { id: string; hasReceipt: boolean; amountCents?: number; reference?: string | null; method?: string }>>({});
  // Receipt previews open on the card itself (member id -> short-lived link, or an error)
  const [receiptPreview, setReceiptPreview] = useState<Record<string, { url?: string; error?: string; loading?: boolean; notImage?: boolean }>>({});
  const toggleReceiptPreview = async (memberId: string, paymentId: string) => {
    if (receiptPreview[memberId]) {
      setReceiptPreview(prev => { const next = { ...prev }; delete next[memberId]; return next; });
      return;
    }
    setReceiptPreview(prev => ({ ...prev, [memberId]: { loading: true } }));
    const link = await receiptLink('payment', paymentId);
    setReceiptPreview(prev => ({ ...prev, [memberId]: link }));
  };
  useEffect(() => {
    getSupabaseClient()?.from('payments').select('id, member_id, status, receipt_key, amount_cents, reference, method')
      .eq('club_id', club.id).eq('kind', 'membership_signup').in('status', ['paid', 'awaiting_review'])
      .then(({ data }) => {
        const rows = data || [];
        // A paid row wins over an older receipt still waiting
        setSignupPayments(Object.fromEntries([...rows].sort((a, b) => (a.status === 'paid' ? 1 : 0) - (b.status === 'paid' ? 1 : 0)).map(p => [p.member_id, p.status])));
        setReceiptsToCheck(Object.fromEntries(rows.filter(p => p.status === 'awaiting_review').map(p => [p.member_id, { id: p.id, hasReceipt: !!p.receipt_key, amountCents: p.amount_cents, reference: p.reference, method: p.method }])));
      });
  }, [club.id]);

  /** Marks the receipt paid. Resolves 'approved' when the club's policy approved them with it, 'paid', or null on failure */
  const verifyReceipt = async (member: ClubMember, thenApprove = false): Promise<'approved' | 'paid' | null> => {
    const pending = receiptsToCheck[member.id];
    const client = getSupabaseClient();
    if (!pending || !client || reviewing) return null;
    setReviewing(member.id);
    let outcome: 'approved' | 'paid' | null = null;
    try {
      const { error } = await client.rpc('fulfil_payment', { p_payment_id: pending.id });
      if (error) { await notify('Payment not verified', error.message); return null; }
      setSignupPayments(prev => ({ ...prev, [member.id]: 'paid' }));
      setReceiptsToCheck(prev => { const next = { ...prev }; delete next[member.id]; return next; });
      // Under an auto-approve policy the payment approved them too
      const { data: fresh } = await client.from('club_members').select('membership_status').eq('id', member.id).maybeSingle();
      outcome = fresh?.membership_status === 'approved' ? 'approved' : 'paid';
      if (outcome === 'approved' || !thenApprove) showToast(outcome === 'approved'
        ? `✓ Payment verified and ${member.full_name} approved.`
        : can(club.id, 'members', 'edit')
          ? `✓ Payment verified for ${member.full_name}. You can approve them now.`
          : `✓ Payment verified for ${member.full_name}. Someone who manages Members can approve them now.`);
      if (outcome === 'approved') await refreshMemberRow(member.id);
    } finally {
      setReviewing(null);
    }
    if (outcome === 'paid' && thenApprove) await handleApprove(member);
    return outcome;
  };

  // Last paid renewal per member (newest first, so the first one seen wins)
  const [lastRenewed, setLastRenewed] = useState<Record<string, string>>({});
  useEffect(() => {
    getSupabaseClient()?.from('payments').select('member_id, paid_at')
      .eq('club_id', club.id).eq('kind', 'membership_renewal').eq('status', 'paid').not('paid_at', 'is', null)
      .order('paid_at', { ascending: false })
      .then(({ data }) => {
        const latest: Record<string, string> = {};
        (data || []).forEach(p => { if (p.member_id && !latest[p.member_id]) latest[p.member_id] = p.paid_at; });
        setLastRenewed(latest);
      });
  }, [club.id]);

  // Renewal reminder email to one member (same email as the bulk notice in Email Notifications)
  const [sendingRenewal, setSendingRenewal] = useState<string | null>(null);
  const sendRenewal = async (member: ClubMember) => {
    if (await sendRenewalEmail(club, member, sending => setSendingRenewal(sending ? member.id : null))) {
      showToast(`✓ Renewal email sent to ${member.full_name}.`);
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const pendingMembers = clubMembers.filter(m => m.membership_status === 'pending');
  const approvedMembers = clubMembers.filter(m => !m.membership_status || m.membership_status === 'approved');
  const rejectedMembers = clubMembers.filter(m => m.membership_status === 'rejected');

  const [reviewing, setReviewing] = useState<string | null>(null);

  // Under-18 players heading for a team that isn't a junior team: the card suggests one (ADM-N5)
  const activeTeams = clubTeams.filter(t => t.club_id === club.id && t.is_active);
  const [teamPick, setTeamPick] = useState<Record<string, string>>({});
  const juniorCheck = (member: ClubMember) => {
    if (member.membership_status !== 'pending' || String(member.role).toLowerCase() === 'supporter') return null;
    const age = member.date_of_birth ? ageOn(member.date_of_birth) : null;
    const minor = age !== null ? age < 18 : !!member.guardian_email;
    if (!minor) return null;
    const target = activeTeams.find(t => t.id === member.requested_team_id) || activeTeams.find(t => t.is_default) || activeTeams[0];
    if (!target || target.is_junior) return null;
    const suggested = suggestJuniorTeam(member.date_of_birth, activeTeams, ageGroupCutoff(getActiveSeason(member.club_id)?.start_date));
    return { age, target, suggested, juniors: activeTeams.filter(t => t.is_junior) };
  };
  /** The team picked on the card ('' = keep the team they'd join anyway) */
  const pickedTeam = (member: ClubMember) => {
    const check = juniorCheck(member);
    if (!check) return undefined;
    const picked = teamPick[member.id] ?? check.suggested?.id ?? '';
    return picked && picked !== check.target.id ? picked : undefined;
  };

  const handleApprove = async (member: ClubMember) => {
    if (reviewing) return;
    setReviewing(member.id);
    try {
      const teamId = pickedTeam(member);
      const res = await approveMemberApplication(member.id, user?.full_name || 'Club Committee', teamId ? { teamId } : undefined);
      if (!res.success) return notify('Not approved', res.message);
      showToast(res.emailed
        ? `✓ Approved ${member.full_name}. We've emailed them how to sign in.`
        : `✓ Approved ${member.full_name}. The email to them didn't go out, so let them know they can sign in.`);
    } finally {
      setReviewing(null);
    }
  };

  const handleRejectConfirm = async () => {
    if (!rejectModalMember || reviewing) return;
    const member = rejectModalMember;
    setReviewing(member.id);
    try {
      const res = await rejectMemberApplication(member.id, rejectReason || 'Application not approved for current season.', user?.full_name || 'Club Committee');
      if (!res.success) return notify('Not rejected', res.message);
      showToast(res.emailed
        ? `Application for ${member.full_name} rejected. We've emailed them.`
        : `Application for ${member.full_name} rejected. The email to them didn't go out.`);
      setRejectModalMember(null);
      setRejectReason('');
    } finally {
      setReviewing(null);
    }
  };

  const handleWaiveConfirm = async () => {
    if (!waiveModalMember || reviewing) return;
    const member = waiveModalMember;
    setReviewing(member.id);
    try {
      const res = await approveMemberApplication(
        member.id,
        user?.full_name || 'Club Committee',
        { waiveFee: true, waiverReason: waiveReason.trim() || 'Approved with fee waiver', teamId: pickedTeam(member) }
      );
      if (!res.success) return notify('Not approved', res.message);
      showToast(res.emailed
        ? `✓ Approved ${member.full_name} (fee waived). We've emailed them how to sign in.`
        : `✓ Approved ${member.full_name} (fee waived). Let them know they can sign in.`);
      setWaiveModalMember(null);
      setWaiveReason('');
    } finally {
      setReviewing(null);
    }
  };

  const openPayModal = (member: ClubMember, priceCents: number) => {
    setPayModalMember(member);
    setPayAmount((priceCents / 100).toFixed(2));
    setPayMethod('cash');
    setPayNote('');
  };

  const handleRecordPayment = async (approve: boolean) => {
    if (!payModalMember || reviewing) return;
    const member = payModalMember;
    const cents = parseMoneyToCents(payAmount);
    if (cents === null || cents <= 0) return notify('Check the amount', 'Enter the amount paid, e.g. 120 or 120.50');
    setReviewing(member.id);
    let recorded = false;
    let autoApproved = false;
    try {
      const res = await recordMembershipSignupPayment(member.id, { amountCents: cents, method: payMethod, note: payNote });
      if (!res.success) return notify('Payment not recorded', res.message);
      recorded = true;
      autoApproved = !!res.autoApproved;
      setSignupPayments(prev => ({ ...prev, [member.id]: 'paid' }));
      setPayModalMember(null);
      if (autoApproved) showToast(`✓ Payment recorded and ${member.full_name} approved (your club approves paid applications automatically).`);
      else if (!approve) showToast(can(club.id, 'members', 'edit')
        ? `✓ Payment recorded for ${member.full_name}. You can approve them now.`
        : `✓ Payment recorded for ${member.full_name}. Someone who manages Members can approve them now.`);
    } finally {
      setReviewing(null);
    }
    if (recorded && approve && !autoApproved) await handleApprove(member);
  };

  // Filter members based on search
  const filterList = (list: ClubMember[]) => {
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(
      m =>
        m.full_name.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        (m.membership_tier && m.membership_tier.toLowerCase().includes(q))
    );
  };

  const displayedList =
    activeTab === 'pending'
      ? filterList(pendingMembers)
      : activeTab === 'active'
      ? filterList(approvedMembers)
      : filterList(rejectedMembers);

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      {/* Toast Notification */}
      {toastMessage && (
        <div role="status" className="admin-save-toast" style={{
          position: 'fixed',
          bottom: '2rem',
          right: '2rem',
          background: 'rgb(var(--dk-15-23-42))',
          color: 'var(--text-primary)',
          border: '1px solid #10B981',
          boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
          padding: '0.85rem 1.4rem',
          borderRadius: '12px',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          gap: '0.6rem',
          fontWeight: 700,
          fontSize: '0.9rem',
          animation: 'fadeIn 0.3s ease',
        }}>
          <Sparkles size={18} color="var(--c-green)" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Membership Signup & Payment Policy Banner */}
      {(() => {
        const policyId = club.membership_payment_policy || 'require_payment';
        const currentPolicy = MEMBERSHIP_PAYMENT_POLICIES.find(p => p.id === policyId) || MEMBERSHIP_PAYMENT_POLICIES[0];
        return (
          <div
            className="glass-panel"
            style={{
              padding: '0.85rem 1.25rem',
              marginBottom: '1.5rem',
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.75rem',
              borderLeft: '4px solid var(--club-primary)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <CreditCard size={18} color="var(--club-primary)" />
              <div>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  Signup Payment Policy:{' '}
                </span>
                <strong style={{ color: 'var(--text-primary)', fontSize: '0.86rem' }}>
                  {currentPolicy.title}
                </strong>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
                  — {currentPolicy.description}
                </span>
              </div>
            </div>
            <Link
              href={`/${clubSlug}/admin/finance?tab=settings`}
              className="btn btn-secondary btn-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem' }}
            >
              <Settings size={13} />
              <span>Configure Policy</span>
            </Link>
          </div>
        );
      })()}

      {/* Navigation Tabs & Search */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1rem',
        marginBottom: '1.5rem',
        borderBottom: '1px solid var(--border-subtle)',
        paddingBottom: '0.75rem',
      }}>
        {/* The tabs are the People page's own */}
        <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-secondary)' }}>
          {activeTab === 'pending' ? `${pendingMembers.length} waiting` : activeTab === 'active' ? `${approvedMembers.length} members` : `${rejectedMembers.length} rejected`}
        </span>

        {(
          <div style={{ position: 'relative', minWidth: 'min(240px, 100%)' }}>
            <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input data-view-ok aria-label="Search members"
              type="text"
              placeholder="Search by name, email..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem 0.75rem 0.5rem 2.2rem',
                borderRadius: '8px',
                background: 'rgba(var(--tint-rgb), 0.05)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)',
                fontSize: '0.85rem',
              }}
            />
          </div>
        )}
      </div>

      {/* Main Content Area */}
      {(
        /* Applications / Members Grid */
        <div>
          {displayedList.length === 0 ? (
            <div className="glass-panel" style={{ padding: '3.5rem 1rem', textAlign: 'center' }}>
              <UserCheck size={42} style={{ color: 'var(--text-muted)', opacity: 0.4, marginBottom: '0.75rem' }} />
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
                No {activeTab} members found
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', maxWidth: '420px', margin: '0 auto' }}>
                {activeTab === 'pending'
                  ? 'All membership applications have been processed. New applicant submissions will appear here instantly.'
                  : 'No records match the current filter.'}
              </p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: '1.25rem' }}>
              {displayedList.map(member => {
                const isPending = member.membership_status === 'pending';
                const isApproved = !member.membership_status || member.membership_status === 'approved';
                const isRejected = member.membership_status === 'rejected';

                return (
                  <div
                    key={member.id}
                    id={`member-card-${member.id}`}
                    className="glass-panel"
                    style={{
                      padding: '1.25rem',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      borderLeft: `4px solid ${isPending ? '#F59E0B' : isApproved ? '#10B981' : '#EF4444'}`,
                      position: 'relative',
                      ...(member.id === focusMemberId ? { boxShadow: '0 0 0 2px var(--club-primary)' } : {}),
                    }}
                  >
                    <div>
                      {/* Top Header of Card */}
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1rem' }}>
                        <div className="row row-loose">
                          <PlayerAvatar photoUrl={member.photo_url} name={member.full_name} size={46} style={{ borderRadius: '12px', border: '1px solid var(--border-subtle)' }} />
                          <div>
                            <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                              {member.full_name}
                            </h3>
                            <div className="text-meta">
                              {isPlayerMember(member) ? `Player • ${member.player_position || 'Roster'}` : 'Supporter Member'}
                            </div>
                          </div>
                        </div>

                        <span
                          className="badge"
                          style={{
                            background: isPending ? 'rgba(245, 158, 11, 0.15)' : isApproved ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                            color: isPending ? 'var(--c-amber)' : isApproved ? 'var(--c-green)' : 'var(--c-red)',
                            fontSize: '0.7rem',
                            fontWeight: 800,
                            padding: '0.2rem 0.55rem',
                          }}
                        >
                          {isPending ? '⏳ PENDING REVIEW' : isApproved ? '✓ APPROVED & ACTIVE' : '✕ REJECTED'}
                        </span>
                      </div>

                      {/* Contact & Meta Details */}
                      <div style={{
                        background: 'rgba(var(--shade-rgb), 0.25)',
                        borderRadius: '8px',
                        padding: '0.75rem',
                        fontSize: '0.8rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.4rem',
                        marginBottom: '1rem',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
                          <Mail size={14} color="var(--text-muted)" />
                          <span>{member.email}</span>
                        </div>

                        {member.phone && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
                            <Phone size={14} color="var(--text-muted)" />
                            <span>{member.phone}</span>
                          </div>
                        )}

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', color: 'var(--text-primary)' }}>
                          <CreditCard size={14} color="var(--text-muted)" />
                          <span>Tier: <strong>{member.membership_tier}</strong></span>
                          {(() => {
                            const memberPlan = plans.find(p => p.name === member.membership_tier);
                            const planPrice = memberPlan?.price_cents ?? 0;
                            const hasFee = planPrice > 0;
                            const isPaid = signupPayments[member.id] === 'paid';
                            const isAwaiting = signupPayments[member.id] === 'awaiting_review';
                            const isWaived = !!member.fee_waived_at;

                            if (isWaived) {
                              return <span className="badge" style={{ background: 'rgba(99,102,241,0.2)', color: '#818CF8' }}>✓ FEE WAIVED</span>;
                            }
                            if (isPaid) {
                              return <span className="badge" style={{ background: 'rgba(16,185,129,0.2)', color: 'var(--c-green)' }}>✓ PAID</span>;
                            }
                            if (isAwaiting) {
                              return (
                                <Link href={`/${clubSlug}/admin/finance?tab=income`} className="badge" style={{ background: 'rgba(245,158,11,0.2)', color: 'var(--c-amber)', textDecoration: 'none' }} title="Check the receipt in Finance -> Income">
                                  ⏳ RECEIPT TO CHECK
                                </Link>
                              );
                            }
                            if (hasFee) {
                              return <span className="badge" style={{ background: 'rgba(239,68,68,0.15)', color: 'var(--c-red)' }}>✕ UNPAID ({formatMoney(planPrice, currency)})</span>;
                            }
                            return <span className="badge" style={{ background: 'rgba(255,255,255,0.08)', color: 'var(--text-muted)' }}>FREE TIER</span>;
                          })()}
                        </div>
                        {member.fee_waived_at && (
                          <div style={{ fontSize: '0.74rem', color: '#818CF8', background: 'rgba(99,102,241,0.08)', padding: '0.25rem 0.5rem', borderRadius: '4px' }}>
                            Fee waived by {member.fee_waived_by || 'Committee'}: &ldquo;{member.fee_waiver_reason || 'Fee waiver'}&rdquo;
                          </div>
                        )}

                        {/* What the applicant told us: joining as, age, emergency contact, consent */}
                        {isPending && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', color: 'var(--text-primary)', fontSize: '0.8rem' }}>
                            <span>Joining as: <strong>{String(member.role).toLowerCase() === 'supporter' ? 'Supporter / non-playing' : 'Player'}</strong></span>
                            {member.date_of_birth && (
                              <span>Born: <strong>{formatDate(member.date_of_birth)}</strong>{(() => { const a = ageOn(member.date_of_birth); return a !== null ? ` (age ${a}${a < 18 ? ', under 18' : ''})` : ''; })()}</span>
                            )}
                            {(() => {
                              const team = member.requested_team_id ? clubTeams.find(t => t.id === member.requested_team_id && t.club_id === member.club_id) : undefined;
                              if (!team) return null;
                              const fit = ageGroupFit(member.date_of_birth, team.age_group, ageGroupCutoff(getActiveSeason(member.club_id)?.start_date));
                              return (
                                <>
                                  <span>Team: <strong>{team.name}</strong> <span style={{ color: 'var(--text-muted)' }}>(joins it when approved)</span></span>
                                  {fit === 'too_old' && (
                                    <span style={{ color: 'var(--c-amber)' }}>⚠ Too old for {team.age_group} on the season&apos;s cut-off date: check the team before approving.</span>
                                  )}
                                  {team.is_junior && !member.date_of_birth && (
                                    <span style={{ color: 'var(--c-amber)' }}>⚠ No date of birth given for a junior team.</span>
                                  )}
                                </>
                              );
                            })()}
                            {(() => {
                              const check = juniorCheck(member);
                              if (!check) return null;
                              const picked = teamPick[member.id] ?? check.suggested?.id ?? '';
                              return (
                                <div data-junior-check style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', padding: '0.6rem 0.7rem', borderRadius: '8px', background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                                  <span style={{ color: 'var(--c-amber)', fontWeight: 700 }}>
                                    ⚠ {check.age !== null ? `Age ${check.age}` : 'Under 18 (parent or guardian applied)'}, but would join {check.target.name}, which isn&apos;t a junior team.
                                  </span>
                                  {check.juniors.length > 0 ? (
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                      <span>Put them in</span>
                                      <select className="form-select" style={{ width: 'auto', padding: '0.3rem 0.5rem', fontSize: '0.8rem' }} value={picked}
                                        onChange={e => setTeamPick(prev => ({ ...prev, [member.id]: e.target.value }))} aria-label={`Team for ${member.full_name}`}>
                                        {check.juniors.map(t => <option key={t.id} value={t.id}>{t.name}{t.id === check.suggested?.id ? ' (suggested)' : ''}</option>)}
                                        <option value={check.target.id}>Keep {check.target.name}</option>
                                      </select>
                                    </label>
                                  ) : (
                                    <span style={{ color: 'var(--text-secondary)' }}>
                                      Your club has no junior team yet. <Link href={`/${clubSlug}/admin/teams`} style={{ color: 'var(--club-ink)', fontWeight: 700 }}>Add one under Teams</Link> before approving, or approve into {check.target.name}.
                                    </span>
                                  )}
                                </div>
                              );
                            })()}
                            {/* A free supporter waiting: the club can let these through without anyone approving */}
                            {member.membership_status === 'pending' && !club.auto_approve_free && !member.guardian_email && member.role === 'supporter'
                              && plans.find(p => p.name === member.membership_tier)?.price_cents === 0 && (
                              <span className="text-meta">
                                Free supporter passes can be approved automatically.{' '}
                                <Link href={`/${clubSlug}/admin/finance?tab=settings`} style={{ color: 'var(--club-ink)', fontWeight: 700 }}>Turn it on in Finance, Settings</Link>
                              </span>
                            )}
                            {(member.guardian_name || member.guardian_email || member.guardian_phone) && (
                              <span>Parent / guardian: <strong>{[member.guardian_name, member.guardian_phone, member.guardian_email].filter(Boolean).join(' · ')}</strong></span>
                            )}
                            {member.photo_consent != null && (
                              <span>Photo consent: <strong>{member.photo_consent ? 'Yes, photos can be shown publicly' : 'No public photos'}</strong></span>
                            )}
                            {member.emergency_contact && <span>Emergency contact: <strong>{member.emergency_contact}</strong></span>}
                            <MedicalNote text={health.notes[member.id]} className="" />
                            {member.terms_accepted_at && <span style={{ color: 'var(--text-muted)' }}>Accepted terms {formatDate(member.terms_accepted_at)}</span>}
                            {member.guardian_consent_at && <span style={{ color: 'var(--c-green)' }}>✓ Parent / guardian consent given</span>}
                          </div>
                        )}

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
                          <Calendar size={14} color="var(--text-muted)" />
                          <span>
                            {isPending
                              ? `Applied: ${formatDate(member.applied_at || member.created_at)}`
                              : `Pass Valid Until: ${formatDate(member.membership_expires_at)}`}
                          </span>
                        </div>

                        {isApproved && (
                          <>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
                              <UserCheck size={14} color="var(--text-muted)" />
                              {/* Approval date: when they became a member (the application date if it was never reviewed) */}
                              <span>Joined: {formatDate(member.reviewed_at || member.applied_at || member.created_at)}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
                              <RotateCw size={14} color="var(--text-muted)" />
                              <span>Last Renewed: {lastRenewed[member.id] ? formatDate(lastRenewed[member.id]) : 'Not renewed yet'}</span>
                            </div>
                          </>
                        )}

                        {member.qr_code_token && (
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                            Pass <code style={{ color: 'var(--c-green)' }}>{passTokenHint(member.qr_code_token)}</code>
                          </div>
                        )}
                      </div>

                      {/* Application Statement / Notes */}
                      {member.application_notes && (
                        <div style={{
                          fontSize: '0.78rem',
                          color: 'var(--text-secondary)',
                          fontStyle: 'italic',
                          marginBottom: '1rem',
                          background: 'rgba(var(--tint-rgb), 0.02)',
                          padding: '0.5rem 0.75rem',
                          borderRadius: '6px',
                          borderLeft: '2px solid var(--border-subtle)',
                        }}>
                          &ldquo;{member.application_notes}&rdquo;
                        </div>
                      )}

                      {/* Rejection Note if applicable */}
                      {isRejected && member.rejection_reason && (
                        <div style={{
                          fontSize: '0.78rem',
                          color: 'var(--c-red)',
                          background: 'rgba(239, 68, 68, 0.08)',
                          padding: '0.5rem 0.75rem',
                          borderRadius: '6px',
                          marginBottom: '1rem',
                        }}>
                          <strong>Rejection Note:</strong> {member.rejection_reason}
                        </div>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '0.85rem', display: 'flex', flexWrap: 'wrap', gap: '0.6rem' }}>
                      {isPending ? (() => {
                        const memberPlan = plans.find(p => p.name === member.membership_tier);
                        const planPrice = memberPlan?.price_cents ?? 0;
                        const hasFee = planPrice > 0;
                        const isPaid = signupPayments[member.id] === 'paid';
                        const isWaived = !!member.fee_waived_at;
                        const policy = club.membership_payment_policy || 'require_payment';
                        const allowWaiver = policyAllowsWaiver(policy);
                        const canApprove = !hasFee || isPaid || isWaived;

                        return (
                          <>
                            {canApprove ? (
                              <button
                                type="button"
                                onClick={() => handleApprove(member)}
                                disabled={reviewing === member.id}
                                className="btn btn-primary btn-sm"
                                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}
                              >
                                <Check size={16} />
                                <span>{reviewing === member.id ? 'Approving...' : 'Approve Pass'}</span>
                              </button>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flex: 1 }}>
                                <button
                                  type="button"
                                  disabled
                                  className="btn btn-secondary btn-sm"
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '0.35rem',
                                    opacity: 0.7,
                                    cursor: 'not-allowed',
                                    background: 'rgba(239, 68, 68, 0.08)',
                                    borderColor: 'rgba(239, 68, 68, 0.25)',
                                    color: 'var(--c-red)',
                                  }}
                                  title="Member must pay their membership fee before approval can be granted"
                                >
                                  <Lock size={14} />
                                  <span>Payment Required ({formatMoney(planPrice, currency)})</span>
                                </button>
                              </div>
                            )}

                            {receiptsToCheck[member.id] && !canApprove && (() => {
                              const receipt = receiptsToCheck[member.id];
                              const preview = receiptPreview[member.id];
                              const canBoth = can(club.id, 'finance', 'edit') && can(club.id, 'members', 'edit');
                              return (
                                <div data-view-ok data-application-receipt style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%' }}>
                                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.25)', borderRadius: '6px', padding: '0.45rem 0.6rem' }}>
                                    <strong style={{ color: 'var(--c-amber)' }}>Receipt to check:</strong>{' '}
                                    {receipt.method === 'bank_transfer' ? 'Bank transfer' : receipt.method === 'cash' ? 'Cash' : 'Payment'}
                                    {typeof receipt.amountCents === 'number' && <> of <strong style={{ color: 'var(--text-primary)' }}>{formatMoney(receipt.amountCents, currency)}</strong></>}
                                    {receipt.reference && <> · Ref <code>{receipt.reference}</code></>}
                                    {typeof receipt.amountCents === 'number' && receipt.amountCents !== planPrice && (
                                      <span style={{ display: 'block', color: 'var(--c-amber)' }}>⚠ The plan costs {formatMoney(planPrice, currency)}: check the amount before verifying.</span>
                                    )}
                                  </div>
                                  {preview && (
                                    <div style={{ borderRadius: '8px', border: '1px solid var(--border-subtle)', overflow: 'hidden', background: 'rgba(var(--shade-rgb), 0.3)' }}>
                                      {preview.loading ? (
                                        <p style={{ margin: 0, padding: '0.75rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>Loading receipt…</p>
                                      ) : preview.error ? (
                                        <p style={{ margin: 0, padding: '0.75rem', fontSize: '0.78rem', color: 'var(--c-red)' }}>{preview.error}</p>
                                      ) : preview.notImage ? (
                                        <p style={{ margin: 0, padding: '0.75rem', fontSize: '0.78rem' }}>This receipt is a document. <a href={preview.url} target="_blank" rel="noopener" style={{ color: 'var(--club-ink)', fontWeight: 700 }}>Open it</a></p>
                                      ) : (
                                        <a href={preview.url} target="_blank" rel="noopener" title="Open full size">
                                          <img src={preview.url} alt={`Receipt from ${member.full_name}`} style={{ display: 'block', width: '100%', maxHeight: 260, objectFit: 'contain' }}
                                            onError={() => setReceiptPreview(prev => ({ ...prev, [member.id]: { ...prev[member.id], notImage: true } }))} />
                                        </a>
                                      )}
                                    </div>
                                  )}
                                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                    {receipt.hasReceipt && (
                                      <button
                                        type="button"
                                        onClick={() => toggleReceiptPreview(member.id, receipt.id)}
                                        className="btn btn-secondary btn-sm"
                                        style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}
                                        aria-expanded={!!preview}
                                      >
                                        <FileText size={14} />
                                        <span>{preview ? 'Hide Receipt' : 'View Receipt'}</span>
                                      </button>
                                    )}
                                    {canBoth && (
                                      <button
                                        type="button"
                                        onClick={() => verifyReceipt(member, true)}
                                        disabled={reviewing === member.id}
                                        className="btn btn-primary btn-sm"
                                        style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}
                                        title="The money is in the bank: mark it paid and approve the pass"
                                      >
                                        <Check size={14} />
                                        <span>{reviewing === member.id ? 'Working...' : 'Verify & Approve'}</span>
                                      </button>
                                    )}
                                    {can(club.id, 'finance', 'edit') && (
                                      <button
                                        type="button"
                                        onClick={() => verifyReceipt(member)}
                                        disabled={reviewing === member.id}
                                        className="btn btn-secondary btn-sm"
                                        style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', color: 'var(--c-green)' }}
                                        title="The money is in the bank: mark this payment as paid"
                                      >
                                        <CheckCircle2 size={14} />
                                        <span>{reviewing === member.id ? 'Verifying...' : canBoth ? 'Verify Only' : 'Verify Payment'}</span>
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            })()}

                            {!canApprove && !receiptsToCheck[member.id] && can(club.id, 'finance', 'edit') && (
                              <button
                                type="button"
                                // A Treasurer can record it even where Members is view-only for them
                                data-view-ok
                                onClick={() => openPayModal(member, planPrice)}
                                disabled={reviewing === member.id}
                                className="btn btn-secondary btn-sm"
                                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', color: 'var(--c-green)' }}
                                title="They paid by cash or bank transfer: record it here, then approve"
                              >
                                <Banknote size={14} />
                                <span>Record Payment</span>
                              </button>
                            )}

                            {allowWaiver && !canApprove && (
                              <button
                                type="button"
                                onClick={() => { setWaiveModalMember(member); setWaiveReason(''); }}
                                disabled={reviewing === member.id}
                                className="btn btn-secondary btn-sm"
                                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', color: '#818CF8' }}
                                title="Waive membership fee for hardship, life member, or committee discretion"
                              >
                                <Gift size={14} />
                                <span>Waive Fee &amp; Approve</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => setRejectModalMember(member)}
                              className="btn btn-secondary btn-sm"
                              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', color: 'var(--c-red)' }}
                            >
                              <X size={16} />
                              <span>Reject</span>
                            </button>
                          </>
                        );
                      })() : isApproved ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap', rowGap: '0.5rem', alignItems: 'center', justifyContent: 'space-between', width: '100%', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          <span style={{ color: 'var(--c-green)', display: 'flex', alignItems: 'center', gap: '0.3rem', fontWeight: 700 }}>
                            <CheckCircle2 size={14} /> Pass Active
                          </span>
                          {canSendRenewal(member) && (
                            <button
                              type="button"
                              onClick={() => sendRenewal(member)}
                              disabled={sendingRenewal === member.id}
                              title="Email this member a reminder to renew their membership"
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--c-amber)',
                                fontWeight: 700,
                                cursor: sendingRenewal === member.id ? 'wait' : 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.3rem',
                                marginLeft: 'auto',
                                marginRight: '0.75rem',
                              }}
                            >
                              <Mail size={13} />
                              <span>{sendingRenewal === member.id ? 'Sending…' : 'Send Renewal Email'}</span>
                            </button>
                          )}
                          {/* Member messages live in the Inbox, which opens this member's conversation */}
                          {can(club.id, 'inquiries') && (
                            <Link
                              href={`/${club.slug}/admin/inquiries?member=${member.id}`}
                              data-view-ok
                              style={{
                                color: 'var(--c-blue)',
                                fontWeight: 700,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.3rem',
                              }}
                            >
                              <MessageSquare size={13} />
                              <span>Message</span>
                            </Link>
                          )}
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleApprove(member)}
                          className="btn btn-secondary btn-sm"
                          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}
                        >
                          <RotateCw size={14} />
                          <span>Re-Evaluate &amp; Approve</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Reject Modal */}
      {rejectModalMember && (
        <div style={{
          position: 'fixed',
          inset: 0,
          overflowY: 'auto',
          overscrollBehavior: 'contain',
          background: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(5px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1rem',
        }}>
          <div className="glass-panel" style={{ margin: 'auto', width: '100%', maxWidth: '440px', padding: '1.75rem', background: 'rgb(var(--dk-9-13-22))' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <XCircle size={20} color="var(--c-red)" />
                <span>Reject Membership</span>
              </h3>
              <button
                type="button"
                onClick={() => setRejectModalMember(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
              You are rejecting the membership application for <strong className="text-primary">{rejectModalMember.full_name}</strong>. We&apos;ll email them, and the reason you give here is included in that email.
            </p>

            <div style={{ marginBottom: '1.25rem' }}>
              <label htmlFor="members-reason-for-rejection" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
                Reason for Rejection:
              </label>
              <textarea id="members-reason-for-rejection"
                rows={3}
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                placeholder="e.g. Senior squad roster is currently at full capacity for this division."
                style={{
                  width: '100%',
                  background: 'rgba(var(--shade-rgb), 0.5)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '8px',
                  padding: '0.75rem',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem',
                  resize: 'none',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setRejectModalMember(null)}
                className="btn btn-secondary btn-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRejectConfirm}
                disabled={!!reviewing}
                className="btn btn-sm"
                style={{ background: '#EF4444', color: '#FFFFFF', border: 'none' }}
              >
                {reviewing ? 'Rejecting...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fee Waiver Modal */}
      {waiveModalMember && (
        <div style={{
          position: 'fixed',
          inset: 0,
          overflowY: 'auto',
          overscrollBehavior: 'contain',
          background: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(5px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1rem',
        }}>
          <div className="glass-panel" style={{ margin: 'auto', width: '100%', maxWidth: '440px', padding: '1.75rem', background: 'rgb(var(--dk-9-13-22))' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Gift size={20} color="#818CF8" />
                <span>Waive Fee &amp; Approve</span>
              </h3>
              <button
                type="button"
                onClick={() => setWaiveModalMember(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
              You are approving <strong className="text-primary">{waiveModalMember.full_name}</strong> and waiving their membership fee ({waiveModalMember.membership_tier ? `${waiveModalMember.membership_tier}` : 'fee'}). This decision will be recorded in the club audit log.
            </p>

            <div style={{ marginBottom: '1.25rem' }}>
              <label htmlFor="members-reason-for-waiver" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
                Reason for Waiver:
              </label>
              <textarea id="members-reason-for-waiver"
                rows={3}
                value={waiveReason}
                onChange={e => setWaiveReason(e.target.value)}
                placeholder="e.g. Life member honorarium, scholarship, financial hardship, or committee sponsor."
                style={{
                  width: '100%',
                  background: 'rgba(var(--shade-rgb), 0.5)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '8px',
                  padding: '0.75rem',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem',
                  resize: 'none',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setWaiveModalMember(null)}
                className="btn btn-secondary btn-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleWaiveConfirm}
                disabled={!!reviewing}
                className="btn btn-sm"
                style={{ background: '#6366F1', color: '#FFFFFF', border: 'none' }}
              >
                {reviewing ? 'Approving...' : 'Confirm Waiver & Approve'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {payModalMember && (() => {
        const planPrice = plans.find(p => p.name === payModalMember.membership_tier)?.price_cents ?? 0;
        const field = {
          width: '100%',
          background: 'rgba(var(--shade-rgb), 0.5)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '8px',
          padding: '0.6rem 0.75rem',
          color: 'var(--text-primary)',
          fontSize: '0.85rem',
        };
        const label = { display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.4rem' };
        return (
          <div data-view-ok style={{
            position: 'fixed',
            inset: 0,
            overflowY: 'auto',
            overscrollBehavior: 'contain',
            background: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem',
          }}>
            <div className="glass-panel" role="dialog" aria-modal="true" aria-labelledby="members-record-payment-title" style={{ margin: 'auto', width: '100%', maxWidth: '440px', padding: '1.75rem', background: 'rgb(var(--dk-9-13-22))' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <h3 id="members-record-payment-title" style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Banknote size={20} color="var(--c-green)" />
                  <span>Record Payment</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setPayModalMember(null)}
                  aria-label="Close"
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                >
                  <X size={20} />
                </button>
              </div>

              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
                <strong className="text-primary">{payModalMember.full_name}</strong> paid for {payModalMember.membership_tier || 'membership'}
                {planPrice > 0 ? ` (${formatMoney(planPrice, currency)})` : ''} by cash or bank transfer. It is saved in Finance as their sign-up payment and their membership starts today.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.9rem' }}>
                <div>
                  <label htmlFor="members-payment-amount" style={label}>Amount paid ({currency})</label>
                  <input id="members-payment-amount" inputMode="decimal" value={payAmount} onChange={e => setPayAmount(e.target.value)} style={field} />
                </div>
                <div>
                  <label htmlFor="members-payment-method" style={label}>Paid by</label>
                  <select id="members-payment-method" value={payMethod} onChange={e => setPayMethod(e.target.value as typeof payMethod)} style={field}>
                    <option value="cash">Cash</option>
                    <option value="bank_transfer">Bank transfer</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
              <div style={{ marginBottom: '1.25rem' }}>
                <label htmlFor="members-payment-note" style={label}>Note (optional)</label>
                <input id="members-payment-note" value={payNote} onChange={e => setPayNote(e.target.value)} placeholder="e.g. Paid at training, receipt #104" style={field} />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                <button type="button" onClick={() => setPayModalMember(null)} className="btn btn-secondary btn-sm">
                  Cancel
                </button>
                <button type="button" onClick={() => handleRecordPayment(false)} disabled={!!reviewing} className="btn btn-secondary btn-sm">
                  Record Only
                </button>
                {can(club.id, 'members', 'edit') && (
                  <button type="button" onClick={() => handleRecordPayment(true)} disabled={!!reviewing} className="btn btn-primary btn-sm">
                    {reviewing ? 'Saving...' : 'Record & Approve'}
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}


    </div>
  );
}
