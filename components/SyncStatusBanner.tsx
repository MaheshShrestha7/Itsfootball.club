'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { useClub } from '@/lib/club-context';

/**
 * Global, site-wide notice for when the client can't confirm it's showing what's actually in
 * Supabase - either the initial load failed, or local changes aren't reaching the database.
 * Admin pages render their own contextual version of this inline, so it's skipped here to
 * avoid showing the same warning twice.
 */
export default function SyncStatusBanner() {
  const pathname = usePathname();
  const { syncStatus, retrySync } = useClub();

  if (pathname?.includes('/admin')) return null;

  const isError = syncStatus.phase === 'error';
  const isReadonlyPending = syncStatus.phase === 'readonly' && (syncStatus.pending || 0) > 0;
  if (!isError && !isReadonlyPending) return null;

  return (
    <div
      role="alert"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 200,
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.75rem',
        padding: '0.55rem 1rem',
        fontSize: '0.8rem',
        textAlign: 'center',
        background: isError ? '#7F1D1D' : '#78350F',
        color: isError ? '#FCA5A5' : '#FCD34D',
        borderBottom: `1px solid ${isError ? '#EF4444' : '#F59E0B'}`,
      }}
    >
      <span>
        {isError
          ? `Live data couldn't be loaded - what you're seeing may not match the database. ${syncStatus.message || ''}`
          : `${syncStatus.pending} change(s) are only saved in this browser. ${syncStatus.message || ''}`}
      </span>
      <button
        type="button"
        onClick={retrySync}
        style={{
          padding: '0.25rem 0.75rem',
          borderRadius: '6px',
          border: '1px solid currentColor',
          background: 'transparent',
          color: 'inherit',
          fontSize: '0.75rem',
          fontWeight: 700,
          cursor: 'pointer',
        }}
      >
        Retry
      </button>
    </div>
  );
}
