'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { BrandWordmark } from '@/components/BrandLogo';
import Captcha, { captchaError, type CaptchaHandle } from '@/components/Captcha';
import { useDialog } from '@/lib/use-escape-to-close';
import { X } from 'lucide-react';
import { AuthAlert, AuthTabs, EmailField, InboxSent, PasswordField, SubmitButton, useShake } from '@/components/auth/AuthBits';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultMode?: 'login' | 'signup';
  redirectTo?: string;
  /** False on club sites: new people join a club through its membership application instead */
  allowSignup?: boolean;
}

export default function AuthModal({ isOpen, onClose, defaultMode = 'login', redirectTo = '/my-clubs', allowSignup = true }: AuthModalProps) {
  const router = useRouter();
  const { login, signup, resendConfirmation, sendPasswordReset } = useAuth();
  // 'reset': forgot password, asks only for the email
  const [mode, setMode] = useState<'login' | 'signup' | 'reset'>(allowSignup ? defaultMode : 'login');

  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [noticeMsg, setNoticeMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Offer to resend the confirmation email when the account isn't confirmed yet
  const [canResend, setCanResend] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const captcha = useRef<CaptchaHandle>(null);
  // "Check your inbox" after a reset email or a sign-up that needs its email confirmed
  const [sentTo, setSentTo] = useState<{ kind: 'reset' | 'confirm'; email: string } | null>(null);
  const shake = useShake<HTMLFormElement>(errorMsg);
  // Opening the popup again starts from the form, not an old "Check your inbox"
  useEffect(() => {
    if (!isOpen) setSentTo(null);
  }, [isOpen]);

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Lock page scroll behind the dialog while it is open
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  const dialogRef = useDialog(isOpen && mounted, onClose);

  if (!isOpen || !mounted) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setNoticeMsg(null);
    setCanResend(false);
    const notReady = captchaError(captchaToken);
    if (notReady) return setErrorMsg(notReady);
    setSubmitting(true);

    try {
      if (mode === 'reset') {
        const res = await sendPasswordReset(email, captchaToken);
        if (!res.success) setErrorMsg(res.error || 'Could not send the reset email.');
        // Same message whether or not there is an account (no account fishing)
        else setSentTo({ kind: 'reset', email: email.trim() });
      } else if (mode === 'login') {
        const res = await login(email, password, captchaToken);
        if (!res.success) {
          setErrorMsg(res.error || 'Failed to sign in. Please verify credentials.');
          setCanResend(/confirm your email/i.test(res.error || ''));
        } else {
          onClose();
          if (redirectTo) {
            window.location.href = redirectTo;
          }
        }
      } else {
        const res = await signup(email, fullName, password, captchaToken);
        if (!res.success) {
          setErrorMsg(res.error || 'Failed to register account.');
        } else if (res.needsEmailConfirmation) {
          setSentTo({ kind: 'confirm', email: email.trim() });
          setMode('login');
          setPassword('');
        } else {
          onClose();
          if (redirectTo) {
            window.location.href = redirectTo;
          }
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'An unexpected authentication error occurred.');
    } finally {
      setSubmitting(false);
      captcha.current?.reset();
    }
  };

  const handleResend = async () => {
    setErrorMsg(null);
    const notReady = captchaError(captchaToken);
    if (notReady) return setErrorMsg(notReady);
    setSubmitting(true);
    const res = await resendConfirmation(email, captchaToken);
    setSubmitting(false);
    captcha.current?.reset();
    if (res.success) setNoticeMsg(`Confirmation email sent again to ${email.trim()}.`);
    else setErrorMsg(res.error || 'Could not resend the confirmation email.');
  };

  return createPortal(
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 10000,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        display: 'flex',
        justifyContent: 'center',
        overflowY: 'auto',
        padding: '1.5rem 1rem',
      }}
      className="auth-modal-backdrop"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
        className="glass-panel auth-modal"
        style={{
          maxWidth: '460px',
          width: '100%',
          padding: '2.25rem',
          background: 'var(--bg-surface-elevated)',
          border: '1px solid var(--border-medium)',
          borderRadius: 'var(--radius-xl)',
          boxShadow: 'var(--shadow-lg)',
          position: 'relative',
          margin: 'auto',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '0.75rem',
            right: '0.75rem',
            background: 'rgba(var(--tint-rgb), 0.05)',
            border: 'none',
            color: 'var(--text-secondary)',
            width: '44px',
            height: '44px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
          aria-label="Close dialog"
        >
          <X size={16} />
        </button>

        {/* Header Logo */}
        <BrandWordmark height={44} style={{ margin: '0.25rem auto 1.1rem auto' }} />

        {sentTo ? (
          <InboxSent email={sentTo.email} resendBusy={submitting}
            title={sentTo.kind === 'confirm' ? 'Confirm your email' : 'Check your inbox'}
            onResend={() => (sentTo.kind === 'confirm' ? handleResend() : handleSubmit({ preventDefault() {} } as React.FormEvent))}
            onChangeEmail={() => { setSentTo(null); setErrorMsg(null); setNoticeMsg(null); }}
            extra={<>
            <div style={{ marginTop: '1rem' }}><Captcha ref={captcha} onToken={setCaptchaToken} /></div>
            {errorMsg && <div style={{ marginTop: '0.75rem', textAlign: 'left' }}><AuthAlert kind="error">{errorMsg}</AuthAlert></div>}
            </>}>
            {sentTo.kind === 'confirm'
              ? <>Your account is made. Open the link we sent to <strong style={{ color: 'var(--text-primary)' }}>{sentTo.email}</strong> to finish signing in.</>
              : <>If there&apos;s an account for <strong style={{ color: 'var(--text-primary)' }}>{sentTo.email}</strong>, we&apos;ve emailed it a link to choose a new password.</>}
          </InboxSent>
        ) : (<>
        <h3 id="auth-modal-title" style={{ fontSize: '1.45rem', fontWeight: 900, textAlign: 'center', color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
          {mode === 'reset' ? 'Reset your password' : mode === 'login' ? 'Welcome back' : 'Create your account'}
        </h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textAlign: 'center', marginBottom: '1.4rem', lineHeight: 1.5 }}>
          {mode === 'reset'
            ? 'Enter your account email and we\'ll send you a link to choose a new password.'
            : mode === 'login'
            ? 'Sign in to run your club, your member pass and match reporting.'
            : 'For club owners and committee. Joining a club as a player or supporter? Use that club\'s Join page.'}
        </p>

        {allowSignup && mode !== 'reset' && (
          <AuthTabs idPrefix="authmodal" label="Sign in or create an account" value={mode as 'login' | 'signup'}
            onChange={m => { setMode(m); setErrorMsg(null); }}
            options={[['login', 'Sign in'], ['signup', 'Create account']] as const} />
        )}

        <form id="authmodal-panel" ref={shake} key={mode} className="auth-panel" onSubmit={handleSubmit}>
          {mode === 'signup' && (
            <div className="auth-field">
              <label htmlFor="authmodal-full-name" className="form-label">Full name</label>
              <input autoComplete="name" id="authmodal-full-name" type="text" required className="form-input" style={{ minHeight: '46px' }}
                placeholder="Your full name" value={fullName} onChange={e => setFullName(e.target.value)} />
            </div>
          )}

          <EmailField id="authmodal-email-address" value={email} onChange={setEmail} />

          {mode !== 'reset' && (
            <PasswordField id="authmodal-password" value={password} onChange={setPassword}
              isNew={mode === 'signup'} showStrength={mode === 'signup'}
              aside={mode === 'login' ? (
                <button type="button" className="auth-link" onClick={() => { setMode('reset'); setErrorMsg(null); setNoticeMsg(null); setCanResend(false); }}>
                  Forgot password?
                </button>
              ) : undefined} />
          )}

          <div style={{ marginBottom: '1rem' }}>
            <Captcha ref={captcha} onToken={setCaptchaToken} />
          </div>

          {errorMsg && <AuthAlert kind="error">{errorMsg}</AuthAlert>}
          {noticeMsg && <AuthAlert kind="ok">{noticeMsg}</AuthAlert>}

          {canResend && (
            <button type="button" onClick={handleResend} disabled={submitting} className="btn btn-secondary" style={{ minHeight: '44px', width: '100%', marginBottom: '0.75rem' }}>
              Resend confirmation email
            </button>
          )}

          <SubmitButton busy={submitting} busyLabel={mode === 'reset' ? 'Sending...' : mode === 'login' ? 'Signing in...' : 'Creating your account...'}
            >
            {mode === 'reset' ? 'Email me a reset link' : mode === 'login' ? 'Sign in' : 'Create account'}
          </SubmitButton>

          {mode === 'reset' && (
            <div className="auth-foot" style={{ marginTop: '0.9rem' }}>
              <button type="button" className="auth-link" onClick={() => { setMode('login'); setErrorMsg(null); setNoticeMsg(null); }}>
                Back to sign in
              </button>
            </div>
          )}
        </form>
        </>)}
      </div>
    </div>,
    document.body
  );
}
