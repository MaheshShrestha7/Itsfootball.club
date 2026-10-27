'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  RefreshCw,
  Bell,
} from 'lucide-react';

interface BroadcastsTabProps {
  showToast: (msg: string) => void;
}

export default function BroadcastsTab({ showToast }: BroadcastsTabProps) {
  const [announcements, setAnnouncements] = useState<PlatformAnnouncement[]>([]);
  const [loading, setLoading] = useState(true);
  const titleRef = useRef<HTMLInputElement>(null);
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
        showToast('✓ Broadcast published');
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
        return { label: 'Warning', icon: AlertTriangle, color: 'var(--mc-amber)', bg: 'var(--mc-amber-bg)' };
      case 'critical':
        return { label: 'Critical or maintenance', icon: AlertCircle, color: 'var(--mc-red)', bg: 'var(--mc-red-bg)' };
      case 'success':
        return { label: 'Feature or news', icon: CheckCircle2, color: 'var(--mc-green-ink)', bg: 'var(--mc-mint)' };
      default:
        return { label: 'Information', icon: Info, color: 'var(--mc-indigo)', bg: 'var(--mc-lilac)' };
    }
  };

  const TARGETS: Record<string, string> = {
    all: 'Everyone',
    admins: 'Club admins',
    members: 'Club members',
    public: 'Main site visitors',
  };
  const LEVELS = [['info', 'Information'], ['warning', 'Warning'], ['critical', 'Critical'], ['success', 'Feature or news']] as const;

  const preview = getLevelMeta(level);
  const PreviewIcon = preview.icon;

  return (
    <div>
      <div className="mc-page-h">
        <div>
          <h1>Broadcasts</h1>
          <p>Banners shown across the platform. Switch one off to hide it straight away.</p>
        </div>
        <div className="right">
          <button type="button" className="mc-pill-btn ghost" onClick={fetchAnnouncements} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh
          </button>
          <button type="button" className="mc-pill-btn" onClick={() => titleRef.current?.focus()}>
            <PlusCircle size={14} /> New broadcast
          </button>
        </div>
      </div>

      <div className="mc-bc-wrap">
        <div className="mc-bc-list">
          {loading && announcements.length === 0 ? (
            <div className="mc-card mc-empty">Loading broadcasts…</div>
          ) : announcements.length === 0 ? (
            <div className="mc-card mc-empty">
              <Radio size={28} style={{ margin: '0 auto 0.6rem', display: 'block' }} />
              <b style={{ color: 'var(--mc-ink)', display: 'block', marginBottom: 4 }}>No broadcasts yet</b>
              Use the form to show a banner to visitors, club admins or members.
            </div>
          ) : (
            announcements.map(ann => {
              const meta = getLevelMeta(ann.level);
              const Icon = meta.icon;
              const href = safeLinkHref(ann.link_url);
              return (
                <div key={ann.id} className={`mc-card mc-bc${ann.is_active ? '' : ' off'}`}>
                  <span className="mc-sq" style={{ background: meta.bg, color: meta.color }}><Icon size={17} /></span>
                  <div style={{ minWidth: 0 }}>
                    <h3>{ann.title}</h3>
                    <p>{ann.message}</p>
                    <div className="meta">
                      <span className="mc-flag" style={{ background: meta.bg, color: meta.color }}>{meta.label}</span>
                      <span className="mc-flag">{TARGETS[ann.target] || ann.target}</span>
                      <span className="mc-flag">Added {formatDate(ann.created_at)}</span>
                      {href && (
                        <a href={href} target="_blank" rel="noopener noreferrer">{ann.link_text || 'Learn more'} <ExternalLink size={11} /></a>
                      )}
                    </div>
                  </div>
                  <div className="side">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={ann.is_active}
                      aria-label={ann.is_active ? `Hide ${ann.title}` : `Show ${ann.title}`}
                      className="mc-switch"
                      onClick={() => handleToggleActive(ann.id, ann.is_active)}
                    />
                    <small>{ann.is_active ? 'Showing' : 'Hidden'}</small>
                    <button type="button" className="mc-icon-btn" style={{ color: 'var(--mc-red)' }} onClick={() => handleDelete(ann.id)} aria-label={`Delete ${ann.title}`} title="Delete broadcast">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="mc-card">
          <div className="mc-card-h"><h3>New broadcast</h3><Bell size={16} color="var(--mc-ink-3)" /></div>
          <form className="mc-form" onSubmit={handleCreateAnnouncement}>
            <label htmlFor="bc-title">
              Title
              <input
                id="bc-title"
                ref={titleRef}
                type="text"
                required
                placeholder="e.g. Scheduled database maintenance"
                value={title}
                onChange={e => setTitle(e.target.value)}
              />
            </label>
            <label htmlFor="bc-message">
              Message
              <textarea
                id="bc-message"
                required
                rows={3}
                placeholder="What is happening, and what people should do"
                value={message}
                onChange={e => setMessage(e.target.value)}
              />
            </label>
            <div className="lbl">
              Type
              <span className="mc-chips" role="group" aria-label="Type">
                {LEVELS.map(([k, label]) => (
                  <button key={k} type="button" aria-pressed={level === k} onClick={() => setLevel(k)}>{label}</button>
                ))}
              </span>
            </div>
            <div className="lbl">
              Who sees it
              <span className="mc-chips" role="group" aria-label="Who sees it">
                {(Object.keys(TARGETS) as (keyof typeof TARGETS)[]).map(k => (
                  <button key={k} type="button" aria-pressed={target === k} onClick={() => setTarget(k as typeof target)}>{TARGETS[k]}</button>
                ))}
              </span>
            </div>
            <div className="two">
              <label htmlFor="bc-link">
                Link (optional)
                <input id="bc-link" type="url" placeholder="https://..." value={linkUrl} onChange={e => setLinkUrl(e.target.value)} />
              </label>
              <label htmlFor="bc-link-text">
                Button text (optional)
                <input id="bc-link-text" type="text" placeholder="e.g. Read more" value={linkText} onChange={e => setLinkText(e.target.value)} />
              </label>
            </div>
            <div className="lbl">
              Preview
              <span className="mc-preview" style={{ background: preview.bg, color: preview.color }}>
                <PreviewIcon size={14} style={{ marginTop: 1 }} />
                <span>{title.trim() || 'Your title shows here'}</span>
              </span>
            </div>
            <button type="submit" className="mc-pill-btn" disabled={saving || !title.trim() || !message.trim()} style={{ justifySelf: 'start' }}>
              {saving ? 'Publishing…' : 'Publish broadcast'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
