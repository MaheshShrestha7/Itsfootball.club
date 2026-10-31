'use client';

import React, { use, useEffect, useMemo, useState } from 'react';
import { useClub } from '@/lib/club-context';
import { useAuth } from '@/lib/auth-context';
import { ContactInquiry } from '@/lib/supabase/types';
import { useUrlTab } from '@/lib/use-url-tab';
import { useSearchParams } from 'next/navigation';
import MemberMessagesPanel from '@/components/MemberMessagesPanel';
import { Mail, Phone, Archive, CheckCheck, Reply, MessageSquare, Inbox, Send, CalendarDays } from 'lucide-react';
import { DATE_LOCALE } from '@/lib/dates';
import { getAccessToken, getSupabaseClient } from '@/lib/supabase/client';

interface InquiryReply {
  id: string;
  inquiry_id: string;
  body: string;
  sent_by_name?: string | null;
  emailed: boolean;
  created_at: string;
}

/** Enquiries sent from an event page start with "About: <event>" (see /api/contact) */
function splitAbout(message: string): { about: string | null; text: string } {
  const m = /^About: (.+)\n\n/.exec(message);
  return m ? { about: m[1], text: message.slice(m[0].length) } : { about: null, text: message };
}

type Filter = 'all' | ContactInquiry['status'];

const INBOX_TABS = ['members', 'contact'] as const;

export default function AdminInquiriesPage({
  params,
}: {
  params: Promise<{ clubSlug: string }>;
}) {
  const resolvedParams = use(params);
  const { clubs, selectClubBySlug, inquiries, updateInquiryStatus, memberMessages } = useClub();
  const club = selectClubBySlug(resolvedParams.clubSlug) || clubs[0];
  const [filter, setFilter] = useState<Filter>('all');
  const { user } = useAuth();
  // ?tab= in the URL (the admin menu's Inbox sub-items); ?member= opens that member's conversation
  // (the Message button on Members)
  const [tab, setTab] = useUrlTab(INBOX_TABS);
  const startMemberId = useSearchParams().get('member');
  const unreadMemberMessages = memberMessages.filter(m => m.club_id === club.id && m.sender_type === 'member' && !m.is_read).length;
  const unreadEnquiries = inquiries.filter(i => i.club_id === club.id && i.status === 'unread').length;

  const clubInquiries = useMemo(
    () =>
      inquiries
        .filter(i => i.club_id === club.id)
        .filter(i => filter === 'all' || i.status === filter)
        .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '')),
    [inquiries, club.id, filter]
  );

  const filters: Filter[] = ['all', 'unread', 'read', 'replied', 'archived'];

  // Reply history (migration 20261119). Without the table the list is just empty and the mail app still works.
  const [replies, setReplies] = useState<InquiryReply[]>([]);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replySending, setReplySending] = useState(false);
  const [replyNote, setReplyNote] = useState<{ id: string; ok: boolean; text: string } | null>(null);
  const [unsentBody, setUnsentBody] = useState<{ id: string; body: string } | null>(null);
  useEffect(() => {
    const client = getSupabaseClient();
    if (!client || !club?.id) return;
    client.from('contact_inquiry_replies').select('id, inquiry_id, body, sent_by_name, emailed, created_at')
      .eq('club_id', club.id).order('created_at', { ascending: true })
      .then(({ data }) => setReplies((data as InquiryReply[]) || []));
  }, [club?.id]);

  const adminName = user?.full_name || `${club.name} Committee`;
  const mailtoFor = (item: ContactInquiry, body?: string) =>
    `mailto:${item.sender_email}?subject=${encodeURIComponent(`Re: your message to ${club.name}`)}${body ? `&body=${encodeURIComponent(body)}` : ''}`;

  const sendReply = async (item: ContactInquiry) => {
    const text = replyText.trim();
    if (!text) return;
    setReplySending(true);
    setReplyNote(null);
    setUnsentBody(null);
    try {
      const token = await getAccessToken();
      const res = await fetch('/api/admin/inquiries/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ clubId: club.id, inquiryId: item.id, body: text, senderName: adminName }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.reply) {
        setReplyNote({ id: item.id, ok: false, text: data.error || 'The reply could not be sent. Try again, or use your mail app.' });
        return;
      }
      setReplies(prev => [...prev, data.reply]);
      updateInquiryStatus(item.id, 'replied');
      setReplyText('');
      setReplyingTo(null);
      setReplyNote(data.emailed
        ? { id: item.id, ok: true, text: `Reply emailed to ${item.sender_email}.` }
        : { id: item.id, ok: false, text: `Reply saved, but email isn't set up for your club yet, so it wasn't sent. Send it from your mail app:` });
      if (!data.emailed) setUnsentBody({ id: item.id, body: text });
    } catch {
      setReplyNote({ id: item.id, ok: false, text: 'The reply could not be sent. Try again, or use your mail app.' });
    } finally {
      setReplySending(false);
    }
  };

  return (
    <div>
      <div className="admin-head">
        <div>
          <h1>Inbox</h1>
          <p>Messages from signed-in members, and enquiries sent through your public contact form.</p>
        </div>
      </div>

      <div data-view-ok role="tablist" aria-label="Inbox" className="admin-tabs">
        {([
          { key: 'members' as const, label: 'Member messages', icon: MessageSquare, unread: unreadMemberMessages },
          { key: 'contact' as const, label: 'Contact form', icon: Inbox, unread: unreadEnquiries },
        ]).map(t => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className="admin-tab"
          >
            <t.icon size={15} aria-hidden="true" />
            <span>{t.label}</span>
            {t.unread > 0 && <span className="admin-count">{t.unread}<span className="sr-only"> new</span></span>}
          </button>
        ))}
      </div>

      {tab === 'members' ? (
        <MemberMessagesPanel club={club} adminName={adminName} startMemberId={startMemberId} />
      ) : (
      <>
      <div className="admin-chips" role="group" aria-label="Show" style={{ marginBottom: 'var(--space-md)' }}>
        {filters.map(f => (
          <button data-view-ok
            key={f}
            type="button"
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
            className="admin-chip"
            style={{ textTransform: 'capitalize' }}
          >
            {f}
          </button>
        ))}
      </div>

      {clubInquiries.length === 0 ? (
        <div className="admin-panel admin-empty">
          No messages here yet.
        </div>
      ) : (
        <div className="stack">
          {clubInquiries.map(item => (
            <div
              key={item.id}
              className="glass-panel"
              style={{ padding: '1.25rem', borderColor: item.status === 'unread' ? 'var(--color-accent-line)' : undefined }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{item.sender_name}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    {item.inquiry_type}, {item.created_at ? new Date(item.created_at).toLocaleString(DATE_LOCALE) : ''}
                  </div>
                </div>
                <span className={item.status === 'unread' ? 'admin-pill is-ok' : 'admin-pill'} style={{ textTransform: 'capitalize', alignSelf: 'flex-start' }}>{item.status}</span>
              </div>

              {(() => {
                const { about, text } = splitAbout(item.message);
                return (
                  <>
                    {about && (
                      <span className="admin-pill" style={{ marginTop: '0.25rem' }}>
                        <CalendarDays size={12} aria-hidden="true" /> About: {about}
                      </span>
                    )}
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.55, whiteSpace: 'pre-wrap', margin: '0.5rem 0 1rem' }}>
                      {text}
                    </p>
                  </>
                );
              })()}

              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                <span style={{ display: 'inline-flex', gap: '0.35rem', alignItems: 'center' }}><Mail size={13} aria-hidden="true" />{item.sender_email}</span>
                {item.sender_phone && (
                  <span style={{ display: 'inline-flex', gap: '0.35rem', alignItems: 'center' }}><Phone size={13} aria-hidden="true" />{item.sender_phone}</span>
                )}
              </div>

              {replies.some(r => r.inquiry_id === item.id) && (
                <div style={{ display: 'grid', gap: '0.5rem', marginBottom: '1rem' }}>
                  {replies.filter(r => r.inquiry_id === item.id).map(r => (
                    <div key={r.id} style={{ marginLeft: '1rem', padding: '0.7rem 0.9rem', borderRadius: '10px', background: 'var(--color-paper-3)', border: '1px solid var(--color-rule)' }}>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
                        Reply from {r.sent_by_name || club.name}, {new Date(r.created_at).toLocaleString(DATE_LOCALE)}, {r.emailed ? 'Emailed' : 'Not emailed'}
                      </div>
                      <p style={{ color: 'var(--text-primary)', fontSize: '0.88rem', lineHeight: 1.5, margin: 0, whiteSpace: 'pre-wrap' }}>{r.body}</p>
                    </div>
                  ))}
                </div>
              )}

              {replyNote?.id === item.id && (
                <div role="status" style={{ marginBottom: '0.75rem', padding: '0.6rem 0.85rem', borderRadius: '8px', fontSize: '0.82rem', border: `1px solid ${replyNote.ok ? 'var(--color-accent-line)' : 'var(--color-warn-line)'}`, background: replyNote.ok ? 'var(--color-accent-wash)' : 'var(--color-warn-wash)', color: 'var(--text-primary)' }}>
                  {replyNote.text}
                  {unsentBody?.id === item.id && (
                    <> <a href={mailtoFor(item, unsentBody.body)} style={{ color: 'var(--color-accent-ink)', fontWeight: 600 }}>Open in mail app</a></>
                  )}
                </div>
              )}

              {replyingTo === item.id && (
                <div style={{ marginBottom: '0.75rem' }}>
                  <label htmlFor={`reply-${item.id}`} className="form-label">Reply to {item.sender_name}</label>
                  <textarea
                    id={`reply-${item.id}`}
                    rows={4}
                    className="form-textarea"
                    value={replyText}
                    onChange={e => setReplyText(e.target.value)}
                    placeholder="Write your reply. It's emailed to them and saved here."
                    maxLength={4000}
                  />
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                    <button type="button" className="btn btn-primary btn-sm" disabled={replySending || !replyText.trim()} onClick={() => sendReply(item)}>
                      <Send size={14} aria-hidden="true" /> {replySending ? 'Sending…' : 'Send reply'}
                    </button>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setReplyingTo(null); setReplyText(''); }}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {replyingTo !== item.id && (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => { setReplyingTo(item.id); setReplyText(''); setReplyNote(null); }}
                  >
                    <Reply size={14} aria-hidden="true" /> Reply
                  </button>
                )}
                <a
                  href={mailtoFor(item)}
                  className="btn btn-secondary btn-sm"
                  onClick={() => updateInquiryStatus(item.id, 'replied')}
                >
                  <Mail size={14} aria-hidden="true" /> Use mail app
                </a>
                {item.status === 'unread' && (
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => updateInquiryStatus(item.id, 'read')}>
                    <CheckCheck size={14} aria-hidden="true" /> Mark read
                  </button>
                )}
                {item.status !== 'archived' && (
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => updateInquiryStatus(item.id, 'archived')}>
                    <Archive size={14} aria-hidden="true" /> Archive
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      </>
      )}
    </div>
  );
}
