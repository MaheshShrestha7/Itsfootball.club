'use client';

import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabase/client';
import { clubSlugFromPath, isPlatformHost } from '@/lib/slugs';
import { PlatformAnnouncement } from '@/lib/supabase/types';
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X, ExternalLink } from 'lucide-react';
import { safeLinkHref } from '@/lib/sponsors';

export default function PlatformAnnouncementBanner() {
  const [announcement, setAnnouncement] = useState<PlatformAnnouncement | null>(null);
  const [dismissed, setDismissed] = useState(true);
  // Who sees which banner depends on the club whose page this is (MCF-9), so look again when that changes
  const slug = clubSlugFromPath(usePathname());

  useEffect(() => {
    let live = true;
    async function loadBanner() {
      const client = getSupabaseClient();
      if (!client) return;
      try {
        const host = window.location.hostname;
        // get_platform_banner (migration 20261177) applies the audience, clubs and start date
        let { data, error } = await client.rpc('get_platform_banner', { p_slug: slug || null, p_host: isPlatformHost(host) ? null : host });
        if (error && /function|does not exist/i.test(error.message)) {
          ({ data, error } = await client.from('platform_announcements').select('*').eq('is_active', true)
            .order('created_at', { ascending: false }).limit(1));
        }
        const ann = !error && Array.isArray(data) && data.length > 0 ? (data[0] as PlatformAnnouncement) : null;
        let seen = false;
        try { seen = !!ann && sessionStorage.getItem(`dismissed_announcement_${ann.id}`) === 'true'; } catch { /* storage unavailable */ }
        if (!live) return;
        setAnnouncement(ann && !seen ? ann : null);
        setDismissed(!ann || seen);
      } catch {
        // Table may not yet exist in migration
      }
    }

    loadBanner();
    return () => { live = false; };
  }, [slug]);

  if (dismissed || !announcement) return null;

  const handleDismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem(`dismissed_announcement_${announcement.id}`, 'true');
    } catch {
      // storage unavailable
    }
    // Signed in: remembered across devices, and counted in Mission Control. Does nothing for visitors.
    getSupabaseClient()?.rpc('dismiss_platform_banner', { p_id: announcement.id }).then(() => {}, () => {});
  };

  const getStyle = () => {
    switch (announcement.level) {
      case 'critical':
        return {
          bg: '#DC2626',
          color: '#FFFFFF',
          icon: AlertCircle,
        };
      case 'warning':
        return {
          bg: '#D97706',
          color: '#FFFFFF',
          icon: AlertTriangle,
        };
      case 'success':
        return {
          bg: '#059669',
          color: '#FFFFFF',
          icon: CheckCircle2,
        };
      default:
        return {
          bg: '#4F46E5',
          color: '#FFFFFF',
          icon: Info,
        };
    }
  };

  const style = getStyle();
  const Icon = style.icon;
  // Only web addresses or paths on this site (also enforced by the database, migration 20261116)
  const linkHref = safeLinkHref(announcement.link_url);

  return (
    <div
      role="alert"
      style={{
        background: style.bg,
        color: style.color,
        padding: '0.65rem 1rem',
        fontSize: '0.85rem',
        fontWeight: 600,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.75rem',
        position: 'relative',
        zIndex: 9999,
        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center', textAlign: 'center' }}>
        <Icon size={16} />
        <span>
          <strong>{announcement.title}:</strong> {announcement.message}
        </span>
        {linkHref && (
          <a
            href={linkHref}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: '#FFFFFF',
              textDecoration: 'underline',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.2rem',
              marginLeft: '0.25rem',
              fontWeight: 700,
            }}
          >
            <span>{announcement.link_text || 'Learn more'}</span>
            <ExternalLink size={12} />
          </a>
        )}
      </div>

      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss banner"
        style={{
          background: 'none',
          border: 'none',
          color: 'currentColor',
          opacity: 0.8,
          cursor: 'pointer',
          padding: '0.2rem',
          display: 'flex',
          alignItems: 'center',
          position: 'absolute',
          right: '1rem',
        }}
      >
        <X size={16} />
      </button>
    </div>
  );
}
