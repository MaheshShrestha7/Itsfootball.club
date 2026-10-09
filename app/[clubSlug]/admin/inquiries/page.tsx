'use client';

import React, { use, useMemo, useState } from 'react';
import { useClub } from '@/lib/club-context';
import { ContactInquiry } from '@/lib/supabase/types';
import Link from 'next/link';
import { Mail, Phone, Archive, CheckCheck, Reply, MessageSquare, ArrowRight } from 'lucide-react';

type Filter = 'all' | ContactInquiry['status'];

export default function AdminInquiriesPage({
  params,
}: {
  params: Promise<{ clubSlug: string }>;
}) {
  const resolvedParams = use(params);
  const { clubs, selectClubBySlug, inquiries, updateInquiryStatus, memberMessages } = useClub();
  const club = selectClubBySlug(resolvedParams.clubSlug) || clubs[0];
  const [filter, setFilter] = useState<Filter>('all');
  const memberThreads = memberMessages.filter(m => m.club_id === club.id && m.sender_type === 'member');
  const unreadMemberMessages = memberThreads.filter(m => !m.is_read).length;

  const clubInquiries = useMemo(
    () =>
      inquiries
        .filter(i => i.club_id === club.id)
        .filter(i => filter === 'all' || i.status === filter)
        .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '')),
    [inquiries, club.id, filter]
  );

  const filters: Filter[] = ['all', 'unread', 'read', 'replied', 'archived'];

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <span className="badge badge-primary" style={{ marginBottom: '0.4rem' }}>INBOX</span>
        <h1 className="stat-value">Inbox</h1>
        <p className="text-body">
          Messages from signed-in members, and enquiries sent through your public contact form.
        </p>
      </div>

      {/* Member messages live on the Member Approvals page, where admins can reply in the thread */}
      <Link
        href={`/${club.slug}/admin/members?tab=messages`}
        className="glass-panel glass-panel-interactive"
        style={{ display: 'flex', alignItems: 'center', gap: '0.9rem', padding: '1rem 1.25rem', marginBottom: '2rem', textDecoration: 'none', borderLeft: unreadMemberMessages ? '3px solid #3B82F6' : '3px solid transparent' }}
      >
        <MessageSquare size={22} color="var(--c-blue)" className="shrink-0" />
        <div className="min-w-0" style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, color: 'var(--text-primary)' }}>Member messages</div>
          <div className="text-note">
            {memberThreads.length === 0
              ? 'No messages from members yet.'
              : `${memberThreads.length} message${memberThreads.length === 1 ? '' : 's'} from members${unreadMemberMessages ? `, ${unreadMemberMessages} new` : ''}.`}
          </div>
        </div>
        {unreadMemberMessages > 0 && <span className="badge badge-live">{unreadMemberMessages} NEW</span>}
        <ArrowRight size={18} className="shrink-0 text-muted" />
      </Link>

      <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.75rem' }}>Contact form enquiries</h2>

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
        {filters.map(f => (
          <button data-view-ok
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={filter === f ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
            style={{ textTransform: 'capitalize' }}
          >
            {f}
          </button>
        ))}
      </div>

      {clubInquiries.length === 0 ? (
        <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          No messages here yet.
        </div>
      ) : (
        <div className="stack">
          {clubInquiries.map(item => (
            <div
              key={item.id}
              className="glass-panel"
              style={{ padding: '1.25rem', borderLeft: item.status === 'unread' ? '3px solid #10B981' : '3px solid transparent' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                <div>
                  <div style={{ fontWeight: 800, color: 'var(--text-primary)' }}>{item.sender_name}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    {item.inquiry_type} · {item.created_at ? new Date(item.created_at).toLocaleString() : ''}
                  </div>
                </div>
                <span className="badge" style={{ textTransform: 'uppercase', alignSelf: 'flex-start' }}>{item.status}</span>
              </div>

              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.55, whiteSpace: 'pre-wrap', margin: '0.5rem 0 1rem' }}>
                {item.message}
              </p>

              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                <span style={{ display: 'inline-flex', gap: '0.35rem', alignItems: 'center' }}><Mail size={13} />{item.sender_email}</span>
                {item.sender_phone && (
                  <span style={{ display: 'inline-flex', gap: '0.35rem', alignItems: 'center' }}><Phone size={13} />{item.sender_phone}</span>
                )}
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <a
                  href={`mailto:${item.sender_email}?subject=${encodeURIComponent(`Re: ${item.inquiry_type}`)}`}
                  className="btn btn-primary btn-sm"
                  onClick={() => updateInquiryStatus(item.id, 'replied')}
                >
                  <Reply size={14} /> Reply by email
                </a>
                {item.status === 'unread' && (
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => updateInquiryStatus(item.id, 'read')}>
                    <CheckCheck size={14} /> Mark read
                  </button>
                )}
                {item.status !== 'archived' && (
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => updateInquiryStatus(item.id, 'archived')}>
                    <Archive size={14} /> Archive
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
