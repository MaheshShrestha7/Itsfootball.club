'use client';

import React, { useRef, useState } from 'react';
import Link from 'next/link';
import { Club } from '@/lib/supabase/types';
import { useAuth } from '@/lib/auth-context';
import Captcha, { captchaError, type CaptchaHandle } from '@/components/Captcha';
import { AuthAlert, EmailField, InboxSent, PasswordField, SubmitButton, useShake } from '@/components/auth/AuthBits';
import {
  ShieldAlert,
  ArrowLeft,
  KeyRound,
  AlertCircle,
  Shield,
  CreditCard,
  LogOut
} from 'lucide-react';

interface AdminGuardProps {
  club: Club;
  children: React.ReactNode;
}

export default function AdminGuard({ club, children }: AdminGuardProps) {
  const { user, isLoading, isAuthenticated, login, sendPasswordReset, hasClubAdminAccess, getUserRoleForClub, logout } = useAuth();
  
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const captcha = useRef<CaptchaHandle>(null);
  const [resetSentTo, setResetSentTo] = useState<string | null>(null);
  const shake = useShake<HTMLFormElement>(loginError);

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
            <img loading="eager" decoding="async" width={36} height={36} src={club.logo_url} alt={`${club.name} crest`} style={{ width: '36px', height: '36px', objectFit: 'contain', borderRadius: '50%' }} />
          ) : (
            <Shield size={26} color={club.primary_color} />
          )}
        </div>
        <div style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', fontWeight: 700 }}>
          Checking your access to {club.name}...
        </div>
      </div>
    );
  }

  // 2. Unauthenticated: Render Stadium Security Checkpoint
  if (!isAuthenticated || !user) {
    const handleFormSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setLoginError(null);
      const notReady = captchaError(captchaToken);
      if (notReady) return setLoginError(notReady);
      setSubmitting(true);

      const res = await login(emailInput, passwordInput, captchaToken);
      setSubmitting(false);
      captcha.current?.reset();

      if (!res.success) {
        setLoginError(res.error || 'Invalid credentials. Please check your email and password.');
      }
    };

    const handleForgot = async () => {
      setLoginError(null);
      if (!emailInput.trim()) return setLoginError('Enter your email first, then choose "Forgot password?" again.');
      const notReady = captchaError(captchaToken);
      if (notReady) return setLoginError(notReady);
      setSubmitting(true);
      const res = await sendPasswordReset(emailInput, captchaToken);
      setSubmitting(false);
      captcha.current?.reset();
      if (!res.success) return setLoginError(res.error || 'Could not send the reset email.');
      // Same screen whether or not there is an account (no account fishing)
      setResetSentTo(emailInput.trim());
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
          className="glass-panel auth-card"
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
            background: `linear-gradient(135deg, ${club.primary_color}25, rgba(var(--shade-rgb), 0.4))`,
            border: `2px solid ${club.primary_color}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.5rem auto',
            boxShadow: `0 8px 25px ${club.primary_color}30`,
            overflow: 'hidden',
          }}>
            {club.logo_url ? (
              <img loading="eager" decoding="async" width={48} height={48} src={club.logo_url} alt={`${club.name} crest`} style={{ width: '48px', height: '48px', objectFit: 'contain' }} />
            ) : (
              <Shield size={34} color={club.primary_color} />
            )}
          </div>

          <span className="badge badge-danger" style={{ marginBottom: '0.6rem' }}>
            ADMIN SIGN-IN
          </span>

          <h2 style={{ fontSize: '1.75rem', fontWeight: 900, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
            {club.name} Admin Portal
          </h2>

          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '2rem', lineHeight: 1.5 }}>
            Sign in with the account that manages this club to run fixtures, the squad and the club&apos;s branding.
          </p>

          {/* Credential Login Form */}
          {resetSentTo ? (
            <InboxSent email={resetSentTo} resendBusy={submitting} onResend={handleForgot} onChangeEmail={() => setResetSentTo(null)}
              extra={<>
              <div style={{ marginTop: '1rem' }}><Captcha ref={captcha} onToken={setCaptchaToken} /></div>
              {loginError && <div style={{ marginTop: '0.75rem', textAlign: 'left' }}><AuthAlert kind="error">{loginError}</AuthAlert></div>}
              </>}>
              If there&apos;s an account for <strong style={{ color: 'var(--text-primary)' }}>{resetSentTo}</strong>, we&apos;ve emailed it a link to choose a new password.
            </InboxSent>
          ) : (
          <form onSubmit={handleFormSubmit} ref={shake} style={{ textAlign: 'left', marginBottom: '0.5rem' }}>
            <EmailField id="admin-guard-email" value={emailInput} onChange={setEmailInput} />
            <PasswordField id="admin-guard-password" value={passwordInput} onChange={setPasswordInput}
              aside={<button type="button" className="auth-link" onClick={handleForgot} disabled={submitting}>Forgot password?</button>} />
            <div style={{ marginBottom: '1rem' }}>
              <Captcha ref={captcha} onToken={setCaptchaToken} />
            </div>
            {loginError && <AuthAlert kind="error">{loginError}</AuthAlert>}
            <SubmitButton busy={submitting} busyLabel="Signing in...">Sign in</SubmitButton>
          </form>
          )}

          <div style={{ marginTop: '1.75rem', textAlign: 'center' }}>
            <Link
              href={`/${club.slug}`}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', color: 'var(--text-muted)', fontSize: '0.825rem' }}
            >
              <ArrowLeft size={14} />
              <span>Back to the {club.name} website</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 3. Authenticated but Insufficient Permissions (e.g. Player or Supporter)
  const userRole = getUserRoleForClub(club.id);
  const isAuthorized = hasClubAdminAccess(club.id) || (!!club.owner_id && club.owner_id === user.id);

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
            color: 'var(--c-red)',
          }}>
            <ShieldAlert size={32} />
          </div>

          <span className="badge badge-danger" style={{ marginBottom: '0.5rem' }}>
            NO ADMIN ACCESS
          </span>

          <h2 style={{ fontSize: '1.75rem', fontWeight: 900, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
            Access Restricted
          </h2>

          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1.5rem', lineHeight: 1.5 }}>
            You are signed in as <strong>{user.full_name}</strong> with role{' '}
            <span style={{ color: 'var(--c-amber)', fontWeight: 700, textTransform: 'uppercase' }}>
              {userRole || 'Supporter'}
            </span>
            . Only the club&apos;s Owner and people with an admin role can open this page. Ask the Owner or a Club Admin to give your account a role.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '2rem' }}>
            <Link href={`/${club.slug}/member`} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
              <CreditCard size={16} />
              <span>Go to my member page</span>
            </Link>

            <button
              type="button"
              onClick={() => logout()}
              className="btn btn-secondary"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
            >
              <LogOut size={16} />
              <span>Sign out and use another account</span>
            </button>
          </div>

          <Link
            href={`/${club.slug}`}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', color: 'var(--text-muted)', fontSize: '0.825rem' }}
          >
            <ArrowLeft size={14} />
            <span>Back to the {club.name} website</span>
          </Link>
        </div>
      </div>
    );
  }

  // 4. Authenticated and Authorized: Render Protected Admin Portal Content
  return <>{children}</>;
}
