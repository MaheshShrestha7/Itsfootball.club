'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Lock, X, KeyRound, AlertCircle, ArrowRight, UserPlus, CheckCircle2 } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultMode?: 'login' | 'signup';
  redirectTo?: string;
}

export default function AuthModal({ isOpen, onClose, defaultMode = 'login', redirectTo = '/my-clubs' }: AuthModalProps) {
  const router = useRouter();
  const { login, signup, resendConfirmation } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>(defaultMode);

  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [noticeMsg, setNoticeMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Offer to resend the confirmation email when the account isn't confirmed yet
  const [canResend, setCanResend] = useState(false);

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
    setSubmitting(true);

    try {
      if (mode === 'login') {
        const res = await login(email, password);
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
        const res = await signup(email, fullName, password);
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
    }
  };

  const handleResend = async () => {
    setErrorMsg(null);
    setSubmitting(true);
    const res = await resendConfirmation(email);
    setSubmitting(false);
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
            background: 'rgba(255, 255, 255, 0.05)',
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
        <img
          src="/logo-96.png"
          alt="itsfootball.club logo"
          width={72}
          height={72}
          decoding="async"
          style={{ display: 'block', width: '72px', height: '72px', margin: '0 auto 1rem auto', filter: 'drop-shadow(0 6px 16px rgba(0, 0, 0, 0.5))' }}
        />

        <h3 style={{ fontSize: '1.5rem', fontWeight: 800, textAlign: 'center', color: '#FFFFFF', marginBottom: '0.4rem' }}>
          {mode === 'login' ? 'Sign In to itsfootball.club' : 'Create Football Profile'}
        </h3>
        <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', textAlign: 'center', marginBottom: '1.5rem' }}>
          {mode === 'login'
            ? 'Access your member digital pass, club management, or match reporting.'
            : 'Join the premier platform for club management and matchday passes.'}
        </p>

        {/* Tab switch */}
        <div style={{
          display: 'flex',
          background: 'rgba(0, 0, 0, 0.3)',
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

        {/* Error Alert */}

        {/* Auth Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
          {mode === 'signup' && (
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: '0.78rem' }}>Full Name *</label>
              <input
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
            <label className="form-label" style={{ fontSize: '0.78rem' }}>Email Address *</label>
            <input
              type="email"
              required
              className="form-input"
              placeholder="name@footballclub.org"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" style={{ fontSize: '0.78rem' }}>Password</label>
            <input
              type="password"
              required
              minLength={mode === 'signup' ? 8 : undefined}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              className="form-input"
              placeholder={mode === 'signup' ? 'At least 8 characters' : '••••••••••••'}
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </div>

    {errorMsg && (
      <div
        style={{
          background: 'rgba(239, 68, 68, 0.15)',
          border: '1px solid #EF4444',
          borderRadius: 'var(--radius-md)',
          padding: '0.65rem 0.85rem',
          color: '#EF4444',
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
            <span>{submitting ? 'Processing...' : mode === 'login' ? 'Sign In to Account' : 'Complete Registration'}</span>
          </button>
        </form>
      </div>
    </div>,
    document.body
  );
}
