'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Eye, EyeOff, Lock, Mail } from 'lucide-react';

// Shared pieces of the sign-in, join and password screens. Styles live in app/globals.css under
// "Sign-in, join and password screens"; every animation there has a prefers-reduced-motion fallback.

type TabOption<T extends string> = readonly [value: T, label: string, Icon?: React.ComponentType<{ size?: number }>];

/** A segmented switch whose highlight slides to the chosen option. Arrow keys move between options. */
export function AuthTabs<T extends string>({ options, value, onChange, label, quiet, idPrefix }: {
  options: readonly TabOption<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  quiet?: boolean;
  idPrefix: string;
}) {
  const index = Math.max(0, options.findIndex(([v]) => v === value));
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const next = (index + (e.key === 'ArrowRight' ? 1 : options.length - 1)) % options.length;
    onChange(options[next][0]);
    refs.current[next]?.focus();
  };
  return (
    <div role="tablist" aria-label={label} className={`auth-seg${quiet ? ' is-quiet' : ''}`}
      style={{ '--n': options.length, '--i': index } as React.CSSProperties} onKeyDown={onKey}>
      <span className="auth-seg-pill" aria-hidden="true" />
      {options.map(([v, text, Icon], i) => (
        <button key={v} ref={el => { refs.current[i] = el; }} type="button" role="tab" id={`${idPrefix}-tab-${v}`}
          aria-selected={v === value} aria-controls={`${idPrefix}-panel`} tabIndex={v === value ? 0 : -1}
          onClick={() => onChange(v)}>
          {Icon && <Icon size={quiet ? 15 : 16} />}
          <span>{text}</span>
        </button>
      ))}
    </div>
  );
}

/** Email field with the envelope icon */
export function EmailField({ id, label = 'Email', value, onChange, hint, readOnly, autoFocus }: {
  id: string; label?: string; value: string; onChange: (v: string) => void; hint?: React.ReactNode; readOnly?: boolean; autoFocus?: boolean;
}) {
  return (
    <div className="auth-field">
      <label htmlFor={id} className="form-label">{label}</label>
      <div className="auth-input-wrap">
        <Mail size={16} aria-hidden="true" />
        <input id={id} type="email" required autoComplete="email" inputMode="email" autoCapitalize="none" spellCheck={false}
          className="form-input" placeholder="you@email.com" value={value} readOnly={readOnly} autoFocus={autoFocus}
          onChange={e => onChange(e.target.value)} />
      </div>
      {hint && <div className="auth-field-hint">{hint}</div>}
    </div>
  );
}

/** 0-4: a simple guide, not a rule (the only rule is 8+ characters, which Supabase also checks) */
export function passwordStrength(pw: string): number {
  if (!pw) return 0;
  if (pw.length < 8) return 1;
  let score = 2;
  if (pw.length >= 12) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw) && /[\d\W_]/.test(pw)) score++;
  return Math.min(score, 4);
}
const STRENGTH = ['', 'Too short', 'OK', 'Good', 'Strong'];
const STRENGTH_COLOUR = ['', 'var(--c-red)', 'var(--c-amber)', 'var(--c-green)', 'var(--c-green)'];

/** Password field with show/hide, a Caps Lock warning, and an optional strength meter for new passwords */
export function PasswordField({ id, label = 'Password', value, onChange, isNew, showStrength, aside }: {
  id: string; label?: string; value: string; onChange: (v: string) => void; isNew?: boolean; showStrength?: boolean; aside?: React.ReactNode;
}) {
  const [shown, setShown] = useState(false);
  const [caps, setCaps] = useState(false);
  const strength = passwordStrength(value);
  const meterId = useId();
  const checkCaps = (e: React.KeyboardEvent<HTMLInputElement>) => setCaps(e.getModifierState?.('CapsLock') ?? false);
  return (
    <div className="auth-field">
      <label htmlFor={id} className="form-label">{label}</label>
      <div className="auth-input-wrap has-toggle">
        <Lock size={16} aria-hidden="true" />
        <input id={id} type={shown ? 'text' : 'password'} required minLength={isNew ? 8 : undefined}
          autoComplete={isNew ? 'new-password' : 'current-password'} className="form-input"
          placeholder={isNew ? 'At least 8 characters' : 'Your password'} value={value}
          aria-describedby={showStrength ? meterId : undefined}
          onChange={e => onChange(e.target.value)} onKeyUp={checkCaps} onKeyDown={checkCaps} onBlur={() => setCaps(false)} />
        <button type="button" className="auth-eye" onClick={() => setShown(s => !s)}
          aria-label={shown ? 'Hide password' : 'Show password'} aria-pressed={shown}>
          {shown ? <EyeOff size={18} /> : <Eye size={18} />}
          <span>{shown ? 'Hide' : 'Show'}</span>
        </button>
      </div>
      {showStrength && value && (
        <>
          <div className="auth-strength" aria-hidden="true">
            {[1, 2, 3, 4].map(n => <span key={n} style={n <= strength ? { background: STRENGTH_COLOUR[strength] } : undefined} />)}
          </div>
          <div id={meterId} className="auth-strength-label">Password strength: <strong style={{ color: STRENGTH_COLOUR[strength] }}>{STRENGTH[strength]}</strong></div>
        </>
      )}
      {(caps || aside) && (
        <div className="auth-row">
          <span className="auth-caps" role="status">{caps ? 'Caps Lock is on' : ''}</span>
          {aside}
        </div>
      )}
    </div>
  );
}

/** Error or success message, shown just above the button it relates to */
export function AuthAlert({ kind, children }: { kind: 'error' | 'ok'; children: React.ReactNode }) {
  return (
    <div className={`auth-alert ${kind === 'error' ? 'is-error' : 'is-ok'}`} role={kind === 'error' ? 'alert' : 'status'}>
      {kind === 'error' ? <AlertCircle size={17} /> : <CheckCircle2 size={17} />}
      <span>{children}</span>
    </div>
  );
}

/** The main button: shows a spinner and keeps its width while busy */
export function SubmitButton({ busy, busyLabel, children, icon }: { busy: boolean; busyLabel: string; children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <button type="submit" disabled={busy} aria-busy={busy} className="btn btn-primary auth-submit">
      {busy ? <span className="auth-spinner" aria-hidden="true" /> : icon}
      <span>{busy ? busyLabel : children}</span>
    </button>
  );
}

/** Adds the shake class for one run whenever `trigger` changes to a truthy value */
export function useShake<T extends HTMLElement = HTMLDivElement>(trigger: unknown) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!trigger || !el) return;
    el.classList.remove('auth-shake');
    void el.offsetWidth;
    el.classList.add('auth-shake');
  }, [trigger]);
  return ref;
}

/** "Check your inbox": shown after a sign-in link or reset email, with a resend cooldown */
export function InboxSent({ email, title = 'Check your inbox', children, onResend, onChangeEmail, resendBusy, extra }: {
  email: string; title?: string; children?: React.ReactNode; extra?: React.ReactNode; onResend: () => void; onChangeEmail: () => void; resendBusy?: boolean;
}) {
  const [wait, setWait] = useState(30);
  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait(w => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);
  const domain = email.split('@')[1]?.toLowerCase() || '';
  const webmail = /gmail|googlemail/.test(domain) ? ['Open Gmail', 'https://mail.google.com/mail/u/0/#search/in%3Aanywhere+newer_than%3A1h']
    : /outlook|hotmail|live\.|msn/.test(domain) ? ['Open Outlook', 'https://outlook.live.com/mail/0/']
    : /yahoo/.test(domain) ? ['Open Yahoo Mail', 'https://mail.yahoo.com/']
    : /icloud|me\.com|mac\.com/.test(domain) ? ['Open iCloud Mail', 'https://www.icloud.com/mail'] : null;
  return (
    <div className="auth-sent" role="status">
      <div className="auth-sent-icon" aria-hidden="true">
        <Mail size={34} />
        <span className="auth-sent-tick">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
        </span>
      </div>
      <h2>{title}</h2>
      <p>{children ?? <>We&apos;ve sent a sign-in link to <strong style={{ color: 'var(--text-primary)' }}>{email}</strong>. Open it on this device to sign in. It works once.</>}</p>
      {webmail && (
        <a className="btn btn-secondary" href={webmail[1]} target="_blank" rel="noopener noreferrer" style={{ width: '100%', minHeight: '46px', marginBottom: '0.75rem' }}>{webmail[0]}</a>
      )}
      <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', display: 'grid', gap: '0.3rem' }}>
        <span>
          Nothing yet? Check your spam folder, or{' '}
          {wait > 0
            ? <span>resend in <span className="auth-countdown">0:{String(wait).padStart(2, '0')}</span></span>
            : <button type="button" className="auth-link" disabled={resendBusy} onClick={() => { onResend(); setWait(30); }}>{resendBusy ? 'sending...' : 'send it again'}</button>}
        </span>
        <span><button type="button" className="auth-link" onClick={onChangeEmail}>Use a different email</button></span>
      </div>
      {/* e.g. the security check that "send it again" needs, and its error */}
      {extra}
    </div>
  );
}
