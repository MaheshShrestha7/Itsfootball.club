'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Club } from '@/lib/supabase/types';
import { useAuth } from '@/lib/auth-context';
import {
  ShieldAlert,
  Lock,
  ArrowLeft,
  KeyRound,
  UserCheck,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Shield,
  CreditCard,
  LogOut
} from 'lucide-react';

interface AdminGuardProps {
  club: Club;
  children: React.ReactNode;
}

export default function AdminGuard({ club, children }: AdminGuardProps) {
  const { user, isLoading, isAuthenticated, login, hasClubAdminAccess, getUserRoleForClub, logout } = useAuth();
  
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // 1. Loading state
  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        gap: '1.25rem',
      }}>
        <div style={{
          position: 'relative',
          width: '60px',
          height: '60px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <div style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            border: `3px solid ${club.primary_color}30`,
            borderTopColor: club.primary_color,
            animation: 'spin 0.8s linear infinite',
          }} />
          {club.logo_url ? (
            <img src={club.logo_url} alt={club.name} style={{ width: '36px', height: '36px', objectFit: 'contain', borderRadius: '50%' }} />
          ) : (
            <Shield size={26} color={club.primary_color} />
          )}
        </div>
        <div style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', fontWeight: 700 }}>
          Verifying {club.name} accreditation...
        </div>
      </div>
    );
  }

  // 2. Unauthenticated: Render Stadium Security Checkpoint
  if (!isAuthenticated || !user) {
    const handleFormSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setLoginError(null);
      setSubmitting(true);

      const res = await login(emailInput, passwordInput);
      setSubmitting(false);

      if (!res.success) {
        setLoginError(res.error || 'Invalid credentials. Please check your email and password.');
      }
    };

    return (
      <div style={{
        minHeight: '75vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem 1rem',
      }}>
        <div
          className="glass-panel"
          style={{
            maxWidth: '520px',
            width: '100%',
            padding: '2.5rem',
            background: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-medium)',
            borderRadius: 'var(--radius-xl)',
            boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
            textAlign: 'center',
          }}
        >
          {/* Security Crest Header */}
          <div style={{
            width: '68px',
            height: '68px',
            borderRadius: '20px',
            background: `linear-gradient(135deg, ${club.primary_color}25, rgba(0, 0, 0, 0.4))`,
            border: `2px solid ${club.primary_color}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.5rem auto',
            boxShadow: `0 8px 25px ${club.primary_color}30`,
            overflow: 'hidden',
          }}>
            {club.logo_url ? (
              <img src={club.logo_url} alt={club.name} style={{ width: '48px', height: '48px', objectFit: 'contain' }} />
            ) : (
              <Shield size={34} color={club.primary_color} />
            )}
          </div>

          <span className="badge badge-danger" style={{ marginBottom: '0.6rem' }}>
            ACCREDITATION CHECKPOINT • RBAC PROTECTED
          </span>

          <h2 style={{ fontSize: '1.75rem', fontWeight: 900, color: '#FFFFFF', marginBottom: '0.5rem' }}>
            {club.name} Admin Portal
          </h2>

          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '2rem', lineHeight: 1.5 }}>
            Access to live matchday controls, squad accreditation, and branding configurations requires authenticated club director or administrative credentials.
          </p>

          {/* Error Message */}
          {loginError && (
            <div
              style={{
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid #EF4444',
                borderRadius: 'var(--radius-md)',
                padding: '0.75rem 1rem',
                color: '#EF4444',
                fontSize: '0.8rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                marginBottom: '1.5rem',
                textAlign: 'left',
              }}
              role="alert"
            >
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{loginError}</span>
            </div>
          )}

          {/* Credential Login Form */}
          <form onSubmit={handleFormSubmit} style={{ textAlign: 'left', marginBottom: '0.5rem' }}>
            <div className="form-group">
              <label className="form-label" style={{ fontSize: '0.8rem' }}>Secretariat Email Address</label>
              <input
                type="email"
                required
                className="form-input"
                placeholder="admin@club.org"
                value={emailInput}
                onChange={e => setEmailInput(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label" style={{ fontSize: '0.8rem' }}>Password / Access Key</label>
              <input
                type="password"
                className="form-input"
                placeholder="••••••••••••"
                value={passwordInput}
                onChange={e => setPasswordInput(e.target.value)}
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="btn btn-primary"
              style={{ width: '100%', marginTop: '0.5rem', height: '44px' }}
            >
              <KeyRound size={16} />
              <span>{submitting ? 'Authenticating...' : 'Sign In & Access Control Room'}</span>
            </button>
          </form>

          <div style={{ marginTop: '1.75rem', textAlign: 'center' }}>
            <Link
              href={`/${club.slug}`}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', color: 'var(--text-muted)', fontSize: '0.825rem' }}
            >
              <ArrowLeft size={14} />
              <span>Return to Public {club.name} Portal</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 3. Authenticated but Insufficient Permissions (e.g. Player or Supporter)
  const userRole = getUserRoleForClub(club.id);
  const isAuthorized = hasClubAdminAccess(club.id);

  if (!isAuthorized) {
    return (
      <div style={{
        minHeight: '70vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem 1rem',
      }}>
        <div
          className="glass-panel"
          style={{
            maxWidth: '520px',
            width: '100%',
            padding: '2.5rem',
            background: 'var(--bg-surface-elevated)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            borderRadius: 'var(--radius-xl)',
            textAlign: 'center',
          }}
        >
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '20px',
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid #EF4444',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.25rem auto',
            color: '#EF4444',
          }}>
            <ShieldAlert size={32} />
          </div>

          <span className="badge badge-danger" style={{ marginBottom: '0.5rem' }}>
            403 FORBIDDEN • INSUFFICIENT PERMISSIONS
          </span>

          <h2 style={{ fontSize: '1.75rem', fontWeight: 900, color: '#FFFFFF', marginBottom: '0.5rem' }}>
            Access Restricted
          </h2>

          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1.5rem', lineHeight: 1.5 }}>
            You are signed in as <strong>{user.full_name}</strong> with role{' '}
            <span style={{ color: '#F59E0B', fontWeight: 700, textTransform: 'uppercase' }}>
              {userRole || 'Supporter'}
            </span>
            . Administrative access is reserved exclusively for Club Owners and verified Secretariat Administrators.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '2rem' }}>
            <Link href={`/${club.slug}/member`} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
              <CreditCard size={16} />
              <span>View My Player Pass & Clubhouse</span>
            </Link>

            <button
              type="button"
              onClick={() => logout()}
              className="btn btn-secondary"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
            >
              <LogOut size={16} />
              <span>Sign Out & Switch Account</span>
            </button>
          </div>

          <Link
            href={`/${club.slug}`}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', color: 'var(--text-muted)', fontSize: '0.825rem' }}
          >
            <ArrowLeft size={14} />
            <span>Return to {club.name} Homepage</span>
          </Link>
        </div>
      </div>
    );
  }

  // 4. Authenticated and Authorized: Render Protected Admin Portal Content
  return <>{children}</>;
}
