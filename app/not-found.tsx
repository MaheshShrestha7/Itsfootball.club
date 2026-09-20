import React from 'react';
import Link from 'next/link';
import { Shield, Home, Compass } from 'lucide-react';

export default function NotFound() {
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
        padding: '3rem 2rem',
        textAlign: 'center',
      }}>
        <div style={{
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          background: 'rgba(16, 185, 129, 0.12)',
          color: 'var(--club-primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 1.5rem',
          border: '1px solid rgba(16, 185, 129, 0.25)',
        }}>
          <Compass size={32} />
        </div>

        <span className="badge badge-primary" style={{ marginBottom: '0.75rem' }}>
          404 • OFF THE PITCH
        </span>

        <h1 style={{ fontSize: '2.2rem', fontWeight: 900, marginBottom: '0.75rem', color: '#FFFFFF' }}>
          Page Not Found
        </h1>

        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '2rem' }}>
          The match, club, or page you are looking for has either concluded, moved to another division, or does not exist.
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', justifyContent: 'center' }}>
          <Link
            href="/"
            className="btn btn-primary touch-target"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <Home size={16} />
            <span>Return to Home</span>
          </Link>

          <Link
            href="/clubs"
            className="btn btn-secondary touch-target"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <Shield size={16} />
            <span>Explore Clubs</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
