'use client';

import React, { useState, useEffect } from 'react';
import { getSupabaseClient } from '@/lib/supabase/client';
import { PlatformAnnouncement } from '@/lib/supabase/types';
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X, ExternalLink } from 'lucide-react';

export default function PlatformAnnouncementBanner() {
  const [announcement, setAnnouncement] = useState<PlatformAnnouncement | null>(null);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    async function loadBanner() {
      const client = getSupabaseClient();
      if (!client) return;
      try {
        const { data, error } = await client
          .from('platform_announcements')
          .select('*')
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(1);

        if (!error && data && data.length > 0) {
          const ann = data[0] as PlatformAnnouncement;
          // Check if previously dismissed in this browser session
          const dismissedKey = `dismissed_announcement_${ann.id}`;
          if (sessionStorage.getItem(dismissedKey) !== 'true') {
            setAnnouncement(ann);
            setDismissed(false);
          }
        }
      } catch {
        // Table may not yet exist in migration
      }
    }

    loadBanner();
  }, []);

  if (dismissed || !announcement) return null;

  const handleDismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem(`dismissed_announcement_${announcement.id}`, 'true');
    } catch {
      // storage unavailable
    }
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
        {announcement.link_url && (
          <a
            href={announcement.link_url}
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
