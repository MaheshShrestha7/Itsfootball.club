'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MessageSquare, Send } from 'lucide-react';
import { useClub } from '@/lib/club-context';
import type { Club, ClubMember, MemberMessage } from '@/lib/supabase/types';

interface Conversation {
  memberId: string;
  member?: ClubMember;
  name: string;
  /** Oldest first */
  messages: MemberMessage[];
  latest?: MemberMessage;
  unread: number;
}

/**
 * Messages between the club and its signed-in members, one conversation per member (the Inbox).
 * `startMemberId` opens that member's conversation, even an empty one, so the committee can write first.
 */
export default function MemberMessagesPanel({ club, adminName, startMemberId }: { club: Club; adminName: string; startMemberId?: string | null }) {
  const { members, memberMessages, sendMemberMessage, replyToMemberMessage, markMemberMessageRead } = useClub();
  const [selectedId, setSelectedId] = useState<string | null>(startMemberId || null);
  const threadRef = useRef<HTMLDivElement>(null);
  const [replyText, setReplyText] = useState('');
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (startMemberId) setSelectedId(startMemberId);
  }, [startMemberId]);

  const conversations = useMemo(() => {
    const byMember = new Map<string, MemberMessage[]>();
    for (const m of memberMessages) {
      if (m.club_id !== club.id) continue;
      byMember.set(m.member_id, [...(byMember.get(m.member_id) || []), m]);
    }
    if (startMemberId && !byMember.has(startMemberId)) byMember.set(startMemberId, []);
    const list: Conversation[] = [...byMember.entries()].map(([memberId, msgs]) => {
      const messages = [...msgs].sort((a, b) => a.created_at.localeCompare(b.created_at));
      const member = members.find(m => m.id === memberId);
      const fromMember = messages.find(m => m.sender_type === 'member');
      return {
        memberId,
        member,
        name: member?.full_name || fromMember?.sender_name || 'Member',
        messages,
        latest: messages[messages.length - 1],
        unread: messages.filter(m => m.sender_type === 'member' && !m.is_read).length,
      };
    });
    // Newest conversation first; a new, empty one goes on top
    return list.sort((a, b) => (b.latest?.created_at || '9999').localeCompare(a.latest?.created_at || '9999'));
  }, [memberMessages, members, club.id, startMemberId]);

  const selected = conversations.find(c => c.memberId === selectedId) || null;

  // Opening a conversation reads the member's messages in it (the Inbox badge counts the unread ones)
  const unreadIds = selected?.messages.filter(m => m.sender_type === 'member' && !m.is_read).map(m => m.id).join(',') || '';
  useEffect(() => {
    if (unreadIds) unreadIds.split(',').forEach(id => markMemberMessageRead(id));
  }, [unreadIds, markMemberMessageRead]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || !replyText.trim()) return;
    // Reply to the member's latest message (keeps its subject and category), or write first
    const lastFromMember = [...selected.messages].reverse().find(m => m.sender_type === 'member');
    if (lastFromMember) {
      if (!replyToMemberMessage(lastFromMember.id, replyText, adminName).success) return;
    } else {
      sendMemberMessage({
        club_id: club.id,
        member_id: selected.memberId,
        sender_type: 'admin',
        sender_name: adminName,
        subject: `Message from ${club.name}`,
        category: 'Committee',
        content: replyText,
      });
    }
    setReplyText('');
    setSent(true);
    setTimeout(() => setSent(false), 3000);
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: '1.5rem' }}>
      {/* Conversations */}
      <div className="glass-panel" style={{ padding: '1.25rem', height: '620px', display: 'flex', flexDirection: 'column' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <MessageSquare size={18} color="var(--c-blue)" />
          <span>Conversations ({conversations.length})</span>
        </h3>
        <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {conversations.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              No messages from members yet.
            </div>
          ) : conversations.map(c => (
            <button
              data-view-ok
              key={c.memberId}
              type="button"
              onClick={() => {
                setSelectedId(c.memberId);
                // Stacked on a phone, the thread opens below the list: bring it into view
                const pane = threadRef.current;
                const list = pane?.previousElementSibling as HTMLElement | null;
                if (pane && list && pane.offsetTop > list.offsetTop) {
                  const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
                  requestAnimationFrame(() => pane.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' }));
                }
              }}
              style={{
                textAlign: 'left',
                padding: '0.85rem',
                borderRadius: '8px',
                background: selectedId === c.memberId ? 'rgba(59, 130, 246, 0.15)' : 'rgba(var(--shade-rgb), 0.25)',
                border: selectedId === c.memberId || c.unread ? '1px solid #3B82F6' : '1px solid var(--border-subtle)',
                cursor: 'pointer',
                color: 'inherit',
                font: 'inherit',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.35rem' }}>
                <span style={{ fontWeight: 800, fontSize: '0.85rem', color: 'var(--text-primary)' }}>{c.name}</span>
                {c.unread > 0
                  ? <span className="badge badge-live" style={{ fontSize: '0.65rem' }}>{c.unread} NEW</span>
                  : <span className="text-meta">{c.latest ? new Date(c.latest.created_at).toLocaleDateString() : 'New'}</span>}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--c-sky)', fontWeight: 600, marginBottom: '0.2rem' }}>
                {c.latest?.subject || 'New message'}
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {c.latest ? `${c.latest.sender_type === 'admin' ? 'You: ' : ''}${c.latest.content}` : 'Write the first message below.'}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Thread and reply. On a phone (stacked under the list) it's hidden until a conversation is picked,
          rather than a screen of empty box below the list */}
      <div ref={threadRef} className="glass-panel member-thread-pane" data-empty={selected ? undefined : ''} style={{ padding: '1.5rem', height: '620px', display: 'flex', flexDirection: 'column', scrollMarginTop: '6rem' }}>
        {selected ? (
          <>
            <div style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '1rem', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>{selected.name}</h3>
              {selected.member?.email && (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>{selected.member.email}</div>
              )}
            </div>

            <div style={{ flex: 1, overflowY: 'auto', marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {selected.messages.length === 0 && (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 'auto', textAlign: 'center' }}>
                  No messages with {selected.name} yet. They&apos;ll see yours in their member area.
                </p>
              )}
              {selected.messages.map(m => {
                const mine = m.sender_type === 'admin';
                return (
                  <div
                    key={m.id}
                    style={{
                      alignSelf: mine ? 'flex-end' : 'flex-start',
                      maxWidth: '85%',
                      padding: '0.75rem 0.9rem',
                      borderRadius: '10px',
                      background: mine ? 'rgba(16, 185, 129, 0.12)' : 'rgba(var(--tint-rgb), 0.04)',
                      border: `1px solid ${mine ? 'rgba(16, 185, 129, 0.3)' : 'var(--border-subtle)'}`,
                    }}
                  >
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
                      {m.sender_name} · {new Date(m.created_at).toLocaleString()}
                      {m.subject ? ` · ${m.subject}` : ''}
                    </div>
                    <p style={{ color: 'var(--text-primary)', fontSize: '0.88rem', lineHeight: 1.5, margin: 0, whiteSpace: 'pre-wrap' }}>{m.content}</p>
                  </div>
                );
              })}
            </div>

            <form onSubmit={handleSend} style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem' }}>
              <label htmlFor="member-reply" style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 700, marginBottom: '0.4rem' }}>
                {sent ? '✓ Sent to their member area' : `Reply as ${adminName}:`}
              </label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <textarea
                  id="member-reply"
                  rows={2}
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  placeholder={`Write to ${selected.name}...`}
                  style={{
                    flex: 1,
                    background: 'rgba(var(--shade-rgb), 0.4)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '8px',
                    padding: '0.6rem 0.8rem',
                    color: 'var(--text-primary)',
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
                  <span>Send</span>
                </button>
              </div>
            </form>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
            <MessageSquare size={42} style={{ opacity: 0.3, marginBottom: '0.75rem' }} />
            <p style={{ margin: 0, fontSize: '0.9rem' }}>Pick a conversation to read and reply.</p>
          </div>
        )}
      </div>
    </div>
  );
}
