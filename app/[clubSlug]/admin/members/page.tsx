'use client';

import React, { use, useState, useEffect } from 'react';
import { passTokenHint } from '@/lib/ids';
import { useUrlTab } from '@/lib/use-url-tab';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { getAccessToken, getSupabaseClient } from '@/lib/supabase/client';
import { confirmAction, notify } from '@/components/ConfirmDialog';
import { useClub } from '@/lib/club-context';
import { useAuth } from '@/lib/auth-context';
import { ClubMember, isPlayerMember, MembershipPlan } from '@/lib/supabase/types';
import {
  UserCheck,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  Filter,
  Mail,
  Phone,
  Shield,
  CreditCard,
  MessageSquare,
  AlertCircle,
  Eye,
  Check,
  X,
  Sparkles,
  Calendar,
  ChevronRight,
  Reply,
  Award,
  RotateCw,
  FileSpreadsheet,
  Lock,
  Gift,
  Settings,
  Banknote
} from 'lucide-react';
import BulkMemberModal from '@/components/BulkMemberModal';
import PlayerAvatar from '@/components/PlayerAvatar';
import { ageGroupCutoff, ageGroupFit } from '@/lib/teams';
import { DATE_LOCALE } from '@/lib/dates';
import { formatMoney, parseMoneyToCents, policyAllowsWaiver, MEMBERSHIP_PAYMENT_POLICIES } from '@/lib/finance';

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

const MEMBER_TABS = ['pending', 'active', 'rejected'] as const;

export default function AdminMembersPage({
  params,
}: {
  params: Promise<{ clubSlug: string }>;
}) {
  const resolvedParams = use(params);
  const {
    clubs,
    selectClubBySlug,
    members,
    approveMemberApplication,
    rejectMemberApplication,
    recordMembershipSignupPayment,
    getClubMemberMessages,
    bulkAddMembers,
    clubTeams,
    getActiveSeason,
  } = useClub();
  const { user, can } = useAuth();

  const club = selectClubBySlug(resolvedParams.clubSlug) || clubs[0];
  const clubMembers = members.filter(m => m.club_id === club.id);

  // ?tab= in the URL: the admin menu's Members sub-items open a tab
  const [activeTab, setActiveTab] = useUrlTab(MEMBER_TABS);
  // Member messages moved to the Inbox; old links to ?tab=messages land there
  const router = useRouter();
  const searchParams = useSearchParams();
  useEffect(() => {
    if (searchParams.get('tab') === 'messages') router.replace(`/${resolvedParams.clubSlug}/admin/inquiries`);
  }, [searchParams, router, resolvedParams.clubSlug]);
  const [searchQuery, setSearchQuery] = useState('');
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
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
  useEffect(() => {
    getSupabaseClient()?.from('payments').select('member_id, status')
      .eq('club_id', club.id).eq('kind', 'membership_signup').in('status', ['paid', 'awaiting_review'])
      .then(({ data }) => setSignupPayments(Object.fromEntries((data || []).map(p => [p.member_id, p.status]))));
  }, [club.id]);

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
  const sendRenewalEmail = async (member: ClubMember) => {
    const ok = await confirmAction({
      title: `Send a renewal email to ${member.full_name}?`,
      message: `It goes to ${member.email} with their expiry date (${formatDate(member.membership_expires_at)}) and a link to renew.`,
      confirmLabel: 'Send email',
    });
    if (!ok) return;
    setSendingRenewal(member.id);
    try {
      const res = await fetch('/api/admin/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await getAccessToken()}` },
        body: JSON.stringify({ clubId: club.id, kind: 'renewal', memberId: member.id, send: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return notify('Email not sent', data.error || 'Please try again.');
      if (data.sent) showToast(`✓ Renewal email sent to ${member.full_name}.`);
      else if (data.optedOut) notify('Email not sent', `${member.full_name} has unsubscribed from ${club.name} emails.`);
      else if (data.alreadySent) notify('Already sent today', `${member.full_name} got a renewal email from you today. You can send another tomorrow.`);
      else notify('Email not sent', data.error || 'Please try again.');
    } finally {
      setSendingRenewal(null);
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const pendingMembers = clubMembers.filter(m => m.membership_status === 'pending');
  const approvedMembers = clubMembers.filter(m => !m.membership_status || m.membership_status === 'approved');
  const rejectedMembers = clubMembers.filter(m => m.membership_status === 'rejected');
  const clubMessages = getClubMemberMessages(club.id); // newest first

  const [reviewing, setReviewing] = useState<string | null>(null);

  const handleApprove = async (member: ClubMember) => {
    if (reviewing) return;
    setReviewing(member.id);
    try {
      const res = await approveMemberApplication(member.id, user?.full_name || 'Club Committee');
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
        { waiveFee: true, waiverReason: waiveReason.trim() || 'Approved with fee waiver' }
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

      {/* Header */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1rem',
        marginBottom: '2rem',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <span className="badge badge-primary row row-tight">
              <Shield size={13} /> SQUAD &amp; GOVERNANCE
            </span>
            <span className="text-note">
              {club.name} Administration
            </span>
          </div>
          <h1 style={{ fontSize: '1.85rem', fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>
            Member Approvals &amp; Passes
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            Review membership applications, issue member passes, and message approved members.
          </p>
        </div>

        {/* Actions & Quick KPI stats */}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => setBulkModalOpen(true)}
            className="btn btn-secondary"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.65rem 1.15rem',
              borderRadius: '10px',
              border: '1px solid rgba(16, 185, 129, 0.4)',
              background: 'rgba(16, 185, 129, 0.08)',
              color: 'var(--text-primary)',
              fontWeight: 800,
              fontSize: '0.85rem',
              cursor: 'pointer',
            }}
          >
            <FileSpreadsheet size={17} color="var(--c-green)" />
            <span>Bulk Import / Export</span>
          </button>

          <div style={{
            background: 'rgba(245, 158, 11, 0.08)',
            border: '1px solid rgba(245, 158, 11, 0.25)',
            borderRadius: '10px',
            padding: '0.6rem 1rem',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--c-amber)', fontWeight: 700, textTransform: 'uppercase' }}>
              Pending Review
            </div>
            <div style={{ fontSize: '1.35rem', fontWeight: 900, color: 'var(--text-primary)' }}>
              {pendingMembers.length}
            </div>
          </div>

          <div style={{
            background: 'rgba(16, 185, 129, 0.08)',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            borderRadius: '10px',
            padding: '0.6rem 1rem',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--c-green)', fontWeight: 700, textTransform: 'uppercase' }}>
              Active Members
            </div>
            <div style={{ fontSize: '1.35rem', fontWeight: 900, color: 'var(--text-primary)' }}>
              {approvedMembers.length}
            </div>
          </div>

          {/* Member messages are answered in the Inbox */}
          {can(club.id, 'inquiries') && (
            <Link href={`/${club.slug}/admin/inquiries`} data-view-ok style={{
              background: 'rgba(59, 130, 246, 0.08)',
              border: '1px solid rgba(59, 130, 246, 0.25)',
              borderRadius: '10px',
              padding: '0.6rem 1rem',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--c-sky)', fontWeight: 700, textTransform: 'uppercase' }}>
                Messages
              </div>
              <div style={{ fontSize: '1.35rem', fontWeight: 900, color: 'var(--text-primary)' }}>
                {clubMessages.length}
              </div>
            </Link>
          )}
        </div>
      </div>

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
              href={`/${resolvedParams.clubSlug}/admin/finance?tab=settings`}
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
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button data-view-ok
            type="button"
            onClick={() => setActiveTab('pending')}
            style={{
              padding: '0.6rem 1.1rem',
              borderRadius: '8px',
              border: activeTab === 'pending' ? '1px solid #F59E0B' : '1px solid transparent',
              background: activeTab === 'pending' ? 'rgba(245, 158, 11, 0.15)' : 'transparent',
              color: activeTab === 'pending' ? 'var(--c-amber)' : 'var(--text-secondary)',
              fontWeight: 800,
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
          >
            <Clock size={16} />
            <span>Pending Applications</span>
            {pendingMembers.length > 0 && (
              <span style={{
                background: '#F59E0B',
                color: '#000',
                borderRadius: '10px',
                padding: '0.1rem 0.45rem',
                fontSize: '0.7rem',
                fontWeight: 900,
              }}>
                {pendingMembers.length}
              </span>
            )}
          </button>

          <button data-view-ok
            type="button"
            onClick={() => setActiveTab('active')}
            style={{
              padding: '0.6rem 1.1rem',
              borderRadius: '8px',
              border: activeTab === 'active' ? '1px solid #10B981' : '1px solid transparent',
              background: activeTab === 'active' ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
              color: activeTab === 'active' ? 'var(--c-green)' : 'var(--text-secondary)',
              fontWeight: 800,
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
          >
            <UserCheck size={16} />
            <span>Active Members ({approvedMembers.length})</span>
          </button>

          <button data-view-ok
            type="button"
            onClick={() => setActiveTab('rejected')}
            style={{
              padding: '0.6rem 1.1rem',
              borderRadius: '8px',
              border: activeTab === 'rejected' ? '1px solid #EF4444' : '1px solid transparent',
              background: activeTab === 'rejected' ? 'rgba(239, 68, 68, 0.15)' : 'transparent',
              color: activeTab === 'rejected' ? 'var(--c-red)' : 'var(--text-secondary)',
              fontWeight: 800,
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
          >
            <XCircle size={16} />
            <span>Rejected ({rejectedMembers.length})</span>
          </button>

        </div>

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
                    className="glass-panel"
                    style={{
                      padding: '1.25rem',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      borderLeft: `4px solid ${isPending ? '#F59E0B' : isApproved ? '#10B981' : '#EF4444'}`,
                      position: 'relative',
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
                                <Link href={`/${resolvedParams.clubSlug}/admin/finance?tab=income`} className="badge" style={{ background: 'rgba(245,158,11,0.2)', color: 'var(--c-amber)', textDecoration: 'none' }} title="Check the receipt in Finance -> Income">
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
                            {(member.guardian_name || member.guardian_email || member.guardian_phone) && (
                              <span>Parent / guardian: <strong>{[member.guardian_name, member.guardian_phone, member.guardian_email].filter(Boolean).join(' · ')}</strong></span>
                            )}
                            {member.photo_consent != null && (
                              <span>Photo consent: <strong>{member.photo_consent ? 'Yes, photos can be shown publicly' : 'No public photos'}</strong></span>
                            )}
                            {member.emergency_contact && <span>Emergency contact: <strong>{member.emergency_contact}</strong></span>}
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

                            {!canApprove && can(club.id, 'finance', 'edit') && (
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
                            <CheckCircle2 size={14} /> Turnstile Pass Active
                          </span>
                          {member.email && member.membership_expires_at && (
                            <button
                              type="button"
                              onClick={() => sendRenewalEmail(member)}
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

      {/* Bulk Import / Export Modal */}
      <BulkMemberModal
        isOpen={bulkModalOpen}
        onClose={() => setBulkModalOpen(false)}
        club={club}
        allMembers={members}
        onImportMembers={bulkAddMembers}
        onSuccessToast={showToast}
      />
    </div>
  );
}
