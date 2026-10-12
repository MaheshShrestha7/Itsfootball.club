'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { BrandWordmark } from '@/components/BrandLogo';
import Captcha, { captchaError, type CaptchaHandle } from '@/components/Captcha';
import { Lock, X, KeyRound, AlertCircle, ArrowRight, UserPlus, CheckCircle2 } from 'lucide-react';

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
        else setNoticeMsg(`If there's an account for ${email.trim()}, we've emailed it a link to choose a new password. Check your spam folder too.`);
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
          setNoticeMsg(`Account created. We sent a confirmation link to ${email.trim()}. Click it to finish signing in (check your spam folder too).`);
          setCanResend(true);
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
      onClick={onClose}
    >
      <div
        className="glass-panel"
        style={{
          maxWidth: '480px',
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
            top: '1.25rem',
            right: '1.25rem',
            background: 'rgba(var(--tint-rgb), 0.05)',
            border: 'none',
            color: 'var(--text-secondary)',
            width: '32px',
            height: '32px',
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
        <BrandWordmark height={48} style={{ margin: '0.25rem auto 1.25rem auto' }} />

        <h3 style={{ fontSize: '1.5rem', fontWeight: 800, textAlign: 'center', color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
          {mode === 'reset' ? 'Reset your password' : mode === 'login' ? 'Sign In to itsfootball.club' : 'Create Football Profile'}
        </h3>
        <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', textAlign: 'center', marginBottom: '1.5rem' }}>
          {mode === 'reset'
            ? 'Enter your account email and we\'ll send you a link to choose a new password.'
            : mode === 'login'
            ? 'Access your member digital pass, club management, or match reporting.'
            : 'Join the premier platform for club management and matchday passes.'}
        </p>

        {/* Tab switch */}
        {allowSignup && mode !== 'reset' && (
        <div style={{
          display: 'flex',
          background: 'rgba(var(--shade-rgb), 0.3)',
          padding: '0.3rem',
          borderRadius: '10px',
          marginBottom: '1.5rem',
          border: '1px solid var(--border-subtle)',
        }}>
          <button
            type="button"
            onClick={() => { setMode('login'); setErrorMsg(null); }}
            style={{
              flex: 1,
              padding: '0.5rem',
              borderRadius: '8px',
              border: 'none',
              background: mode === 'login' ? 'var(--club-primary)' : 'transparent',
              color: mode === 'login' ? '#FFFFFF' : 'var(--text-secondary)',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setMode('signup'); setErrorMsg(null); }}
            style={{
              flex: 1,
              padding: '0.5rem',
              borderRadius: '8px',
              border: 'none',
              background: mode === 'signup' ? 'var(--club-primary)' : 'transparent',
              color: mode === 'signup' ? '#FFFFFF' : 'var(--text-secondary)',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            Register
          </button>
        </div>
        )}

        {/* Error Alert */}

        {/* Auth Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
          {mode === 'signup' && (
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="authmodal-full-name" className="form-label" style={{ fontSize: '0.78rem' }}>Full Name *</label>
              <input id="authmodal-full-name"
                type="text"
                required
                className="form-input"
                placeholder="Your full name"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
              />
            </div>
          )}

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="authmodal-email-address" className="form-label" style={{ fontSize: '0.78rem' }}>Email Address *</label>
            <input id="authmodal-email-address"
              type="email"
              required
              className="form-input"
              placeholder="name@footballclub.org"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>

          {mode !== 'reset' && (
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="authmodal-password" className="form-label" style={{ fontSize: '0.78rem' }}>Password</label>
            <input id="authmodal-password"
              type="password"
              required
              minLength={mode === 'signup' ? 8 : undefined}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              className="form-input"
              placeholder={mode === 'signup' ? 'At least 8 characters' : '••••••••••••'}
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
            {mode === 'login' && (
              <button
                type="button"
                onClick={() => { setMode('reset'); setErrorMsg(null); setNoticeMsg(null); setCanResend(false); }}
                style={{ background: 'none', border: 'none', padding: 0, marginTop: '0.4rem', color: 'var(--c-green)', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}
              >
                Forgot password?
              </button>
            )}
          </div>
          )}

          <Captcha ref={captcha} onToken={setCaptchaToken} />

    {errorMsg && (
      <div
        style={{
          background: 'rgba(239, 68, 68, 0.15)',
          border: '1px solid #EF4444',
          borderRadius: 'var(--radius-md)',
          padding: '0.65rem 0.85rem',
          color: 'var(--c-red)',
          fontSize: '0.78rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          marginBottom: 0,
        }}
        role="alert"
      >
        <AlertCircle size={15} style={{ flexShrink: 0 }} />
        <span>{errorMsg}</span>
      </div>
    )}

          {noticeMsg && (
            <div role="status" style={{ background: 'rgba(16, 185, 129, 0.12)', border: '1px solid #10B981', color: '#6EE7B7', borderRadius: '8px', padding: '0.7rem 0.9rem', fontSize: '0.8rem' }}>
              {noticeMsg}
            </div>
          )}

          {canResend && (
            <button type="button" onClick={handleResend} disabled={submitting} className="btn btn-secondary" style={{ height: '40px', width: '100%' }}>
              Resend confirmation email
            </button>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="btn btn-primary"
            style={{ height: '44px', width: '100%', marginTop: '0.5rem' }}
          >
            <KeyRound size={16} />
            <span>{submitting ? 'Processing...' : mode === 'reset' ? 'Email Me a Reset Link' : mode === 'login' ? 'Sign In to Account' : 'Complete Registration'}</span>
          </button>

          {mode === 'reset' && (
            <button
              type="button"
              onClick={() => { setMode('login'); setErrorMsg(null); setNoticeMsg(null); }}
              style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}
            >
              Back to sign in
            </button>
          )}
        </form>
      </div>
    </div>,
    document.body
  );
}
