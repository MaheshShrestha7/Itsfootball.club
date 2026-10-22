'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { getSupabaseClient } from '@/lib/supabase/client';
import { PlatformAnnouncement } from '@/lib/supabase/types';
import { formatDate } from '@/lib/dates';
import { safeLinkHref } from '@/lib/sponsors';
import {
  Radio,
  PlusCircle,
  AlertCircle,
  Info,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  ExternalLink,
  Power,
  RefreshCw,
  Bell,
} from 'lucide-react';

interface BroadcastsTabProps {
  showToast: (msg: string) => void;
}

export default function BroadcastsTab({ showToast }: BroadcastsTabProps) {
  const [announcements, setAnnouncements] = useState<PlatformAnnouncement[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // New announcement form state
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [level, setLevel] = useState<'info' | 'warning' | 'critical' | 'success'>('info');
  const [target, setTarget] = useState<'all' | 'admins' | 'members' | 'public'>('all');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkText, setLinkText] = useState('');

  const fetchAnnouncements = useCallback(async () => {
    const client = getSupabaseClient();
    if (!client) return;
    setLoading(true);
    try {
      const { data, error } = await client
        .from('platform_announcements')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) {
        setAnnouncements(data as PlatformAnnouncement[]);
      }
    } catch (err) {
      console.warn('Could not load announcements:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) return;
    if (linkUrl.trim() && !safeLinkHref(linkUrl)) {
      alert('Use a full web address (https://…) or a path on this site, such as /tools.');
      return;
    }
    const client = getSupabaseClient();
    if (!client) return;
    setSaving(true);
    try {
      const { error } = await client.from('platform_announcements').insert({
        title: title.trim(),
        message: message.trim(),
        level,
        target,
        link_url: linkUrl.trim() || null,
        link_text: linkText.trim() || null,
        is_active: true,
      });

      if (error) {
        alert(error.message);
      } else {
        showToast('✓ Announcement broadcasted successfully!');
        setModalOpen(false);
        setTitle('');
        setMessage('');
        setLinkUrl('');
        setLinkText('');
        fetchAnnouncements();
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    const client = getSupabaseClient();
    if (!client) return;
    try {
      const { error } = await client
        .from('platform_announcements')
        .update({ is_active: !currentStatus })
        .eq('id', id);

      if (error) {
        alert(error.message);
      } else {
        showToast(!currentStatus ? '✓ Broadcast activated' : '✓ Broadcast deactivated');
        fetchAnnouncements();
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to permanently delete this broadcast?')) return;
    const client = getSupabaseClient();
    if (!client) return;
    try {
      const { error } = await client.from('platform_announcements').delete().eq('id', id);
      if (error) {
        alert(error.message);
      } else {
        showToast('✓ Broadcast removed');
        fetchAnnouncements();
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const getLevelMeta = (lvl: string) => {
    switch (lvl) {
      case 'warning':
        return { label: 'Warning', icon: AlertTriangle, color: 'var(--c-amber)', bg: 'rgba(245, 158, 11, 0.15)' };
      case 'critical':
        return { label: 'Critical / Maintenance', icon: AlertCircle, color: 'var(--c-red)', bg: 'rgba(239, 68, 68, 0.15)' };
      case 'success':
        return { label: 'Announcement / Release', icon: CheckCircle2, color: 'var(--c-green)', bg: 'rgba(16, 185, 129, 0.15)' };
      default:
        return { label: 'Information', icon: Info, color: '#818CF8', bg: 'rgba(99, 102, 241, 0.15)' };
    }
  };

  return (
    <div className="glass-panel" style={{ padding: '1.75rem' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 900, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Radio size={22} color="#818CF8" />
            <span>Platform Broadcasts &amp; Global Banners</span>
          </h2>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Publish maintenance windows, critical announcements, and release highlights across all tenants
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            type="button"
            onClick={fetchAnnouncements}
            className="btn btn-secondary btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="btn btn-primary btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <PlusCircle size={15} />
            <span>New Broadcast</span>
          </button>
        </div>
      </div>

      {/* Announcements List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {loading ? (
          <div style={{ padding: '3rem 0', textAlign: 'center', color: 'var(--text-muted)' }}>
            Loading platform announcements...
          </div>
        ) : announcements.length === 0 ? (
          <div style={{ padding: '3rem 0', textAlign: 'center', color: 'var(--text-muted)', background: 'rgba(var(--tint-rgb), 0.02)', borderRadius: '8px', border: '1px dashed var(--border-subtle)' }}>
            <Radio size={32} color="var(--text-muted)" style={{ margin: '0 auto 0.75rem auto' }} />
            <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
              No Active Broadcasts
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0 }}>
              Broadcasts allow you to display global notifications to visitors, club admins, or members.
            </p>
          </div>
        ) : (
          announcements.map(ann => {
            const meta = getLevelMeta(ann.level);
            const Icon = meta.icon;

            return (
              <div
                key={ann.id}
                style={{
                  padding: '1.25rem',
                  background: 'rgba(var(--tint-rgb), 0.03)',
                  borderRadius: '8px',
                  border: ann.is_active ? `1px solid ${meta.color}` : '1px solid var(--border-subtle)',
                  opacity: ann.is_active ? 1 : 0.6,
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span className="badge" style={{ background: meta.bg, color: meta.color, display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontWeight: 800 }}>
                      <Icon size={12} />
                      <span>{meta.label}</span>
                    </span>
                    <span className="badge" style={{ background: 'rgba(var(--tint-rgb), 0.06)', color: 'var(--text-secondary)' }}>
                      Target: {ann.target}
                    </span>
                    {ann.is_active ? (
                      <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.15)', color: 'var(--c-green)' }}>
                        LIVE
                      </span>
                    ) : (
                      <span className="badge" style={{ background: 'rgba(var(--tint-rgb), 0.05)', color: 'var(--text-muted)' }}>
                        PAUSED
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={() => handleToggleActive(ann.id, ann.is_active)}
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '0.25rem 0.55rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                    >
                      <Power size={12} color={ann.is_active ? 'var(--c-green)' : 'var(--text-muted)'} />
                      <span>{ann.is_active ? 'Deactivate' : 'Activate'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(ann.id)}
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '0.25rem 0.45rem', color: 'var(--c-red)' }}
                      title="Delete Broadcast"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                <h4 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.35rem 0' }}>
                  {ann.title}
                </h4>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                  {ann.message}
                </p>

                {safeLinkHref(ann.link_url) && (
                  <div style={{ marginTop: '0.65rem' }}>
                    <a
                      href={safeLinkHref(ann.link_url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: '0.8rem', color: '#818CF8', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                    >
                      <span>{ann.link_text || 'Learn more'}</span>
                      <ExternalLink size={12} />
                    </a>
                  </div>
                )}

                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.75rem' }}>
                  Broadcast created on {formatDate(ann.created_at)}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* CREATE BROADCAST MODAL */}
      {modalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem',
          }}
        >
          <div className="glass-panel" style={{ width: '100%', maxWidth: '540px', padding: '1.75rem', background: 'rgb(var(--dk-9-13-22))' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--text-primary)', margin: '0 0 1rem 0' }}>
              Create Platform Broadcast
            </h3>

            <form onSubmit={handleCreateAnnouncement} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                  Announcement Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Scheduled Database Maintenance Notice"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.75rem',
                    background: 'rgba(var(--shade-rgb), 0.5)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '6px',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                  Message Body
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Briefly describe the notification, impact, or instructions..."
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.75rem',
                    background: 'rgba(var(--shade-rgb), 0.5)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '6px',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                    fontFamily: 'inherit',
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                    Severity Level
                  </label>
                  <select
                    value={level}
                    onChange={e => setLevel(e.target.value as any)}
                    style={{
                      width: '100%',
                      padding: '0.55rem 0.75rem',
                      background: 'rgba(var(--shade-rgb), 0.5)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '6px',
                      color: 'var(--text-primary)',
                      fontSize: '0.85rem',
                    }}
                  >
                    <option value="info">Info (Blue)</option>
                    <option value="warning">Warning (Amber)</option>
                    <option value="critical">Critical / Maintenance (Red)</option>
                    <option value="success">Feature / News (Green)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                    Target Audience
                  </label>
                  <select
                    value={target}
                    onChange={e => setTarget(e.target.value as any)}
                    style={{
                      width: '100%',
                      padding: '0.55rem 0.75rem',
                      background: 'rgba(var(--shade-rgb), 0.5)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '6px',
                      color: 'var(--text-primary)',
                      fontSize: '0.85rem',
                    }}
                  >
                    <option value="all">All Visitors &amp; Tenants</option>
                    <option value="admins">Club Admins Only</option>
                    <option value="members">Club Members Only</option>
                    <option value="public">Public Landing Page Only</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                    Optional Action Link URL
                  </label>
                  <input
                    type="url"
                    placeholder="https://..."
                    value={linkUrl}
                    onChange={e => setLinkUrl(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.55rem 0.75rem',
                      background: 'rgba(var(--shade-rgb), 0.5)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '6px',
                      color: 'var(--text-primary)',
                      fontSize: '0.85rem',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                    Optional Button Label
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Read Status Details"
                    value={linkText}
                    onChange={e => setLinkText(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.55rem 0.75rem',
                      background: 'rgba(var(--shade-rgb), 0.5)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '6px',
                      color: 'var(--text-primary)',
                      fontSize: '0.85rem',
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="btn btn-secondary btn-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn btn-primary btn-sm"
                >
                  {saving ? 'Broadcasting...' : 'Publish Broadcast'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
