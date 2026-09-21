'use client';

import React, { use, useState } from 'react';
import { useClub } from '@/lib/club-context';
import { useAuth } from '@/lib/auth-context';
import { ClubMember, MemberMessage } from '@/lib/supabase/types';
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
  Send,
  AlertCircle,
  Eye,
  Check,
  X,
  Sparkles,
  Calendar,
  ChevronRight,
  Reply,
  Award,
  RotateCw
} from 'lucide-react';

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
    memberMessages,
    replyToMemberMessage
  } = useClub();
  const { user } = useAuth();

  const club = selectClubBySlug(resolvedParams.clubSlug) || clubs[0];
  const clubMembers = members.filter(m => m.club_id === club.id);

  const [activeTab, setActiveTab] = useState<'pending' | 'active' | 'rejected' | 'messages'>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [rejectModalMember, setRejectModalMember] = useState<ClubMember | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [selectedMessage, setSelectedMessage] = useState<MemberMessage | null>(null);
  const [replyText, setReplyText] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const pendingMembers = clubMembers.filter(m => m.membership_status === 'pending');
  const approvedMembers = clubMembers.filter(m => !m.membership_status || m.membership_status === 'approved');
  const rejectedMembers = clubMembers.filter(m => m.membership_status === 'rejected');
  const clubMessages = memberMessages.filter(m => m.club_id === club.id);
  const unreadMessagesCount = clubMessages.filter(m => !m.is_read && m.sender_type === 'member').length;

  const handleApprove = (member: ClubMember) => {
    const res = approveMemberApplication(member.id, user?.full_name || 'Club Committee');
    if (res.success) {
      showToast(`✓ Approved ${member.full_name}! Virtual pass and credentials generated.`);
    }
  };

  const handleRejectConfirm = () => {
    if (!rejectModalMember) return;
    const res = rejectMemberApplication(rejectModalMember.id, rejectReason || 'Application not approved for current season.', user?.full_name || 'Club Committee');
    if (res.success) {
      showToast(`Application for ${rejectModalMember.full_name} has been rejected.`);
      setRejectModalMember(null);
      setRejectReason('');
    }
  };

  const handleSendReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMessage || !replyText.trim()) return;

    const res = replyToMemberMessage(selectedMessage.id, replyText, user?.full_name || `${club.name} Committee`);
    if (res.success) {
      showToast('✓ Reply sent to member inbox.');
      setReplyText('');
    }
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
    <div style={{ padding: '1.5rem', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Toast Notification */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          bottom: '2rem',
          right: '2rem',
          background: '#0F172A',
          color: '#FFFFFF',
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
          <Sparkles size={18} color="#10B981" />
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
            <span className="badge badge-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Shield size={13} /> SQUAD &amp; GOVERNANCE
            </span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {club.name} Administration
            </span>
          </div>
          <h1 style={{ fontSize: '1.85rem', fontWeight: 900, color: '#FFFFFF', margin: 0 }}>
            Member Approvals &amp; Passes
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            Review membership applications, issue verified virtual passes, and converse with approved members.
          </p>
        </div>

        {/* Quick KPI stats */}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{
            background: 'rgba(245, 158, 11, 0.08)',
            border: '1px solid rgba(245, 158, 11, 0.25)',
            borderRadius: '10px',
            padding: '0.6rem 1rem',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '0.7rem', color: '#F59E0B', fontWeight: 700, textTransform: 'uppercase' }}>
              Pending Review
            </div>
            <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#FFFFFF' }}>
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
            <div style={{ fontSize: '0.7rem', color: '#10B981', fontWeight: 700, textTransform: 'uppercase' }}>
              Active Members
            </div>
            <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#FFFFFF' }}>
              {approvedMembers.length}
            </div>
          </div>

          <div style={{
            background: 'rgba(59, 130, 246, 0.08)',
            border: '1px solid rgba(59, 130, 246, 0.25)',
            borderRadius: '10px',
            padding: '0.6rem 1rem',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '0.7rem', color: '#60A5FA', fontWeight: 700, textTransform: 'uppercase' }}>
              Messages
            </div>
            <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#FFFFFF' }}>
              {clubMessages.length}
            </div>
          </div>
        </div>
      </div>

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
          <button
            type="button"
            onClick={() => setActiveTab('pending')}
            style={{
              padding: '0.6rem 1.1rem',
              borderRadius: '8px',
              border: activeTab === 'pending' ? '1px solid #F59E0B' : '1px solid transparent',
              background: activeTab === 'pending' ? 'rgba(245, 158, 11, 0.15)' : 'transparent',
              color: activeTab === 'pending' ? '#F59E0B' : 'var(--text-secondary)',
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

          <button
            type="button"
            onClick={() => setActiveTab('active')}
            style={{
              padding: '0.6rem 1.1rem',
              borderRadius: '8px',
              border: activeTab === 'active' ? '1px solid #10B981' : '1px solid transparent',
              background: activeTab === 'active' ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
              color: activeTab === 'active' ? '#10B981' : 'var(--text-secondary)',
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

          <button
            type="button"
            onClick={() => setActiveTab('rejected')}
            style={{
              padding: '0.6rem 1.1rem',
              borderRadius: '8px',
              border: activeTab === 'rejected' ? '1px solid #EF4444' : '1px solid transparent',
              background: activeTab === 'rejected' ? 'rgba(239, 68, 68, 0.15)' : 'transparent',
              color: activeTab === 'rejected' ? '#EF4444' : 'var(--text-secondary)',
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

          <button
            type="button"
            onClick={() => setActiveTab('messages')}
            style={{
              padding: '0.6rem 1.1rem',
              borderRadius: '8px',
              border: activeTab === 'messages' ? '1px solid #3B82F6' : '1px solid transparent',
              background: activeTab === 'messages' ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
              color: activeTab === 'messages' ? '#60A5FA' : 'var(--text-secondary)',
              fontWeight: 800,
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
          >
            <MessageSquare size={16} />
            <span>Member Inquiries</span>
            {unreadMessagesCount > 0 && (
              <span style={{
                background: '#3B82F6',
                color: '#FFFFFF',
                borderRadius: '10px',
                padding: '0.1rem 0.45rem',
                fontSize: '0.7rem',
                fontWeight: 900,
              }}>
                {unreadMessagesCount} NEW
              </span>
            )}
          </button>
        </div>

        {activeTab !== 'messages' && (
          <div style={{ position: 'relative', minWidth: '240px' }}>
            <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search by name, email..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem 0.75rem 0.5rem 2.2rem',
                borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--border-subtle)',
                color: '#FFFFFF',
                fontSize: '0.85rem',
              }}
            />
          </div>
        )}
      </div>

      {/* Main Content Area */}
      {activeTab === 'messages' ? (
        /* Member Inquiries & Messages View */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: '1.5rem' }}>
          {/* Messages List Left */}
          <div className="glass-panel" style={{ padding: '1.25rem', height: '620px', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#FFFFFF', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <MessageSquare size={18} color="#3B82F6" />
              <span>Inbox Correspondence ({clubMessages.length})</span>
            </h3>

            <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {clubMessages.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  No member messages recorded yet.
                </div>
              ) : (
                clubMessages.map(msg => (
                  <div
                    key={msg.id}
                    onClick={() => setSelectedMessage(msg)}
                    style={{
                      padding: '0.85rem',
                      borderRadius: '8px',
                      background: selectedMessage?.id === msg.id ? 'rgba(59, 130, 246, 0.15)' : 'rgba(0, 0, 0, 0.25)',
                      border: selectedMessage?.id === msg.id ? '1px solid #3B82F6' : '1px solid var(--border-subtle)',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                      <span style={{ fontWeight: 800, fontSize: '0.85rem', color: '#FFFFFF' }}>{msg.sender_name}</span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        {new Date(msg.created_at).toLocaleDateString()}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.78rem', color: '#60A5FA', fontWeight: 600, marginBottom: '0.2rem' }}>
                      {msg.subject || 'Member Question'}
                    </div>

                    <p style={{
                      fontSize: '0.8rem',
                      color: 'var(--text-secondary)',
                      margin: 0,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {msg.content}
                    </p>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.4rem' }}>
                      <span className="badge" style={{ fontSize: '0.65rem', background: 'rgba(255,255,255,0.06)' }}>
                        {msg.category || 'General'}
                      </span>
                      <span style={{ fontSize: '0.65rem', color: msg.sender_type === 'admin' ? '#10B981' : '#F59E0B' }}>
                        {msg.sender_type === 'admin' ? '✓ Committee Sent' : '• From Member'}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Message Thread & Reply Right */}
          <div className="glass-panel" style={{ padding: '1.5rem', height: '620px', display: 'flex', flexDirection: 'column' }}>
            {selectedMessage ? (
              <>
                <div style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '1rem', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#FFFFFF', margin: 0 }}>
                      {selectedMessage.subject || 'Member Inquiry'}
                    </h3>
                    <span className="badge badge-primary" style={{ fontSize: '0.7rem' }}>
                      {selectedMessage.category || 'General'}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
                    From: <strong style={{ color: '#FFFFFF' }}>{selectedMessage.sender_name}</strong> • {new Date(selectedMessage.created_at).toLocaleString()}
                  </div>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', marginBottom: '1rem', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '1rem' }}>
                  <div style={{
                    padding: '1rem',
                    background: 'rgba(255,255,255,0.03)',
                    borderRadius: '8px',
                    border: '1px solid var(--border-subtle)',
                    marginBottom: '1rem',
                  }}>
                    <div style={{ fontSize: '0.75rem', color: '#60A5FA', fontWeight: 700, marginBottom: '0.4rem' }}>
                      ORIGINAL INQUIRY
                    </div>
                    <p style={{ color: '#F8FAFC', fontSize: '0.88rem', lineHeight: 1.5, margin: 0 }}>
                      {selectedMessage.content}
                    </p>
                  </div>
                </div>

                <form onSubmit={handleSendReply} style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem' }}>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 700, marginBottom: '0.4rem' }}>
                    Reply as {user?.full_name || 'Club Committee'}:
                  </label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <textarea
                      rows={2}
                      value={replyText}
                      onChange={e => setReplyText(e.target.value)}
                      placeholder="Type official response to member..."
                      style={{
                        flex: 1,
                        background: 'rgba(0,0,0,0.4)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '8px',
                        padding: '0.6rem 0.8rem',
                        color: '#FFFFFF',
                        fontSize: '0.85rem',
                        resize: 'none',
                      }}
                    />
                    <button
                      type="submit"
                      disabled={!replyText.trim()}
                      className="btn btn-primary"
                      style={{ alignSelf: 'flex-end', display: 'flex', alignItems: 'center', gap: '0.4rem', opacity: replyText.trim() ? 1 : 0.5 }}
                    >
                      <Send size={16} />
                      <span>Reply</span>
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                <MessageSquare size={42} style={{ opacity: 0.3, marginBottom: '0.75rem' }} />
                <p style={{ margin: 0, fontSize: '0.9rem' }}>Select an inquiry from the inbox to read and reply.</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Applications / Members Grid */
        <div>
          {displayedList.length === 0 ? (
            <div className="glass-panel" style={{ padding: '3.5rem 1rem', textAlign: 'center' }}>
              <UserCheck size={42} style={{ color: 'var(--text-muted)', opacity: 0.4, marginBottom: '0.75rem' }} />
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#FFFFFF', marginBottom: '0.35rem' }}>
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <img
                            src={member.photo_url}
                            alt={member.full_name}
                            style={{
                              width: '46px',
                              height: '46px',
                              borderRadius: '12px',
                              objectFit: 'cover',
                              border: '1px solid var(--border-subtle)',
                            }}
                          />
                          <div>
                            <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#FFFFFF', margin: 0 }}>
                              {member.full_name}
                            </h3>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              {member.role === 'player' ? `Player • ${member.player_position || 'Roster'}` : 'Supporter Member'}
                            </div>
                          </div>
                        </div>

                        <span
                          className="badge"
                          style={{
                            background: isPending ? 'rgba(245, 158, 11, 0.15)' : isApproved ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                            color: isPending ? '#F59E0B' : isApproved ? '#10B981' : '#EF4444',
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
                        background: 'rgba(0,0,0,0.25)',
                        borderRadius: '8px',
                        padding: '0.75rem',
                        fontSize: '0.8rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.4rem',
                        marginBottom: '1rem',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#E2E8F0' }}>
                          <Mail size={14} color="var(--text-muted)" />
                          <span>{member.email}</span>
                        </div>

                        {member.phone && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#E2E8F0' }}>
                            <Phone size={14} color="var(--text-muted)" />
                            <span>{member.phone}</span>
                          </div>
                        )}

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#E2E8F0' }}>
                          <CreditCard size={14} color="var(--text-muted)" />
                          <span>Tier: <strong>{member.membership_tier}</strong></span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#E2E8F0' }}>
                          <Calendar size={14} color="var(--text-muted)" />
                          <span>
                            {isPending
                              ? `Applied: ${new Date(member.applied_at || member.created_at || Date.now()).toLocaleDateString()}`
                              : `Pass Valid Until: ${member.membership_expires_at}`}
                          </span>
                        </div>

                        {member.qr_code_token && (
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                            Pass Token: <code style={{ color: '#10B981' }}>{member.qr_code_token}</code>
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
                          background: 'rgba(255,255,255,0.02)',
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
                          color: '#EF4444',
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
                    <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '0.85rem', display: 'flex', gap: '0.6rem' }}>
                      {isPending ? (
                        <>
                          <button
                            type="button"
                            onClick={() => handleApprove(member)}
                            className="btn btn-primary btn-sm"
                            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}
                          >
                            <Check size={16} />
                            <span>Approve Pass</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setRejectModalMember(member)}
                            className="btn btn-secondary btn-sm"
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', color: '#EF4444' }}
                          >
                            <X size={16} />
                            <span>Reject</span>
                          </button>
                        </>
                      ) : isApproved ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          <span style={{ color: '#10B981', display: 'flex', alignItems: 'center', gap: '0.3rem', fontWeight: 700 }}>
                            <CheckCircle2 size={14} /> Turnstile Pass Active
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedMessage({
                                id: `msg-direct-${Date.now()}`,
                                club_id: club.id,
                                member_id: member.id,
                                sender_type: 'member',
                                sender_name: member.full_name,
                                sender_email: member.email,
                                subject: `Direct Outreach to ${member.full_name}`,
                                category: 'Committee',
                                content: `Member accreditation inquiry for ${member.full_name}.`,
                                is_read: true,
                                created_at: new Date().toISOString(),
                              });
                              setActiveTab('messages');
                            }}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: '#3B82F6',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                            }}
                          >
                            <MessageSquare size={13} />
                            <span>Message</span>
                          </button>
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
          background: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(5px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1rem',
        }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '440px', padding: '1.75rem', background: '#090D16' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#FFFFFF', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <XCircle size={20} color="#EF4444" />
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
              You are rejecting the membership application for <strong style={{ color: '#FFFFFF' }}>{rejectModalMember.full_name}</strong>. Provide a reason so the applicant understands the committee decision.
            </p>

            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#FFFFFF', marginBottom: '0.4rem' }}>
                Reason for Rejection:
              </label>
              <textarea
                rows={3}
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                placeholder="e.g. Senior squad roster is currently at full capacity for this division."
                style={{
                  width: '100%',
                  background: 'rgba(0,0,0,0.5)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '8px',
                  padding: '0.75rem',
                  color: '#FFFFFF',
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
                className="btn btn-sm"
                style={{ background: '#EF4444', color: '#FFFFFF', border: 'none' }}
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
