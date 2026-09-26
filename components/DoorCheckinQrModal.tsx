'use client';

import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { X, Copy, Check, ExternalLink } from 'lucide-react';

interface DoorCheckinQrModalProps {
  title: string;
  subtitle: string;
  /** null while the door code is being fetched */
  checkinUrl: string | null;
  badgeLabel?: string;
  disabledNotice?: string;
  onClose: () => void;
  /** Extra buttons shown next to "Test Check-in" (e.g. a match-only "Print Gate Poster" action) */
  extraActions?: React.ReactNode;
}

export default function DoorCheckinQrModal({
  title,
  subtitle,
  checkinUrl,
  badgeLabel = 'TURNSTILE DOOR STATION',
  disabledNotice,
  onClose,
  extraActions,
}: DoorCheckinQrModalProps) {
  const [copiedLink, setCopiedLink] = useState(false);

  const copyLink = () => {
    if (!checkinUrl) return;
    navigator.clipboard?.writeText(checkinUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '1.5rem'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="glass-panel"
        style={{
          maxWidth: '520px',
          width: '100%',
          padding: '2rem',
          borderRadius: 'var(--radius-xl)',
          border: '1px solid var(--border-medium)',
          background: 'var(--bg-surface-elevated)',
          textAlign: 'center'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
          >
            <X size={20} />
          </button>
        </div>

        <span className="badge badge-primary" style={{ marginBottom: '0.5rem' }}>
          {badgeLabel}
        </span>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 900, color: '#FFFFFF', marginBottom: '0.25rem' }}>
          {title}
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
          {subtitle}
        </p>

        {disabledNotice && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid #EF4444',
            borderRadius: 'var(--radius-md)',
            padding: '0.65rem 1rem',
            marginBottom: '1.25rem',
            color: '#EF4444',
            fontSize: '0.8rem',
          }}>
            {disabledNotice}
          </div>
        )}

        {/* Live QR Code Box */}
        <div
          style={{
            background: '#FFFFFF',
            padding: '1.5rem',
            borderRadius: '16px',
            display: 'inline-block',
            margin: '0 auto 1.5rem auto',
            boxShadow: '0 8px 30px rgba(0,0,0,0.4)'
          }}
        >
          {checkinUrl ? (
            <QRCodeSVG value={checkinUrl} size={220} level="H" includeMargin={false} />
          ) : (
            <div style={{ width: 220, height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569' }}>
              Generating check-in code...
            </div>
          )}
        </div>

        <div
          style={{
            background: 'rgba(0, 0, 0, 0.4)',
            padding: '0.75rem 1rem',
            borderRadius: 'var(--radius-md)',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.5rem',
            border: '1px solid var(--border-subtle)'
          }}
        >
          <span
            style={{
              fontSize: '0.75rem',
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-secondary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
          >
            {checkinUrl || 'Generating check-in code...'}
          </span>
          <button
            type="button"
            onClick={copyLink}
            className="btn btn-secondary btn-sm"
            style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '0.3rem' }}
          >
            {copiedLink ? <Check size={12} color="#10B981" /> : <Copy size={12} />}
            <span>{copiedLink ? 'Copied' : 'Copy Link'}</span>
          </button>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <a
            href={checkinUrl || undefined}
            target="_blank"
            rel="noreferrer"
            className="btn btn-secondary btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <ExternalLink size={14} />
            <span>Test Check-in</span>
          </a>

          {extraActions}
        </div>
      </div>
    </div>
  );
}
