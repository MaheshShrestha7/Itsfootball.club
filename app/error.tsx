'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('App Router caught error:', error);
  }, [error]);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem 1rem',
      background: 'var(--bg-pitch)',
      color: '#FFFFFF',
      fontFamily: 'var(--font-sans)',
    }}>
      <div className="glass-panel" style={{
        maxWidth: '520px',
        width: '100%',
        padding: '2.5rem 2rem',
        textAlign: 'center',
        border: '1px solid rgba(239, 68, 68, 0.3)',
      }}>
        <div style={{
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          background: 'rgba(239, 68, 68, 0.15)',
          color: '#EF4444',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 1.5rem',
        }}>
          <AlertTriangle size={28} />
        </div>

        <span className="badge" style={{ marginBottom: '0.75rem', background: 'rgba(239, 68, 68, 0.2)', color: '#EF4444', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
          TECHNICAL STOPPAGE
        </span>

        <h2 style={{ fontSize: '1.75rem', fontWeight: 900, marginBottom: '0.75rem', color: '#FFFFFF' }}>
          Something went wrong
        </h2>

        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '2rem' }}>
          An unexpected error occurred while loading this page. Our stadium control room has been alerted.
        </p>

        {error?.digest && (
          <div style={{
            fontSize: '0.75rem',
            fontFamily: 'var(--font-mono)',
            color: 'var(--text-muted)',
            background: 'rgba(0,0,0,0.3)',
            padding: '0.5rem 0.75rem',
            borderRadius: '6px',
            marginBottom: '1.5rem',
            wordBreak: 'break-all',
          }}>
            Incident Digest: {error.digest}
          </div>
        )}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', justifyContent: 'center' }}>
          <button
            type="button"
            onClick={() => reset()}
            className="btn btn-primary touch-target"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <RefreshCw size={16} />
            <span>Try Again</span>
          </button>

          <Link
            href="/"
            className="btn btn-secondary touch-target"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <Home size={16} />
            <span>Return to Pitch</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
