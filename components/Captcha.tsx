'use client';

import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';

// Cloudflare Turnstile, the bot check Supabase Auth verifies on sign-in, sign-up, magic links and
// password resets (Supabase dashboard > Authentication > Attack Protection > CAPTCHA). Without a
// site key nothing renders and no token is sent, so the forms work as before.
export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '';

/** The error to show when a form is submitted before the check has passed, or null when it can go */
export function captchaError(token: string | null): string | null {
  return TURNSTILE_SITE_KEY && !token ? 'Please wait for the security check below to finish, then try again.' : null;
}

interface TurnstileApi {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let scriptPromise: Promise<void> | null = null;

function loadTurnstile(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => {
        scriptPromise = null;
        reject(new Error('Turnstile failed to load'));
      };
      document.head.appendChild(s);
    });
  }
  return scriptPromise;
}

export interface CaptchaHandle {
  /** A token works once: call after every request that used it */
  reset: () => void;
}

const Captcha = forwardRef<CaptchaHandle, { onToken: (token: string | null) => void }>(function Captcha({ onToken }, ref) {
  const box = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const onTokenRef = useRef(onToken);
  onTokenRef.current = onToken;
  const [failed, setFailed] = useState(false);

  useImperativeHandle(ref, () => ({
    reset: () => {
      onTokenRef.current(null);
      if (widgetId.current && window.turnstile) window.turnstile.reset(widgetId.current);
    },
  }), []);

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return;
    let cancelled = false;
    loadTurnstile()
      .then(() => {
        if (cancelled || !box.current || !window.turnstile) return;
        widgetId.current = window.turnstile.render(box.current, {
          sitekey: TURNSTILE_SITE_KEY,
          theme: 'auto',
          size: 'flexible',
          callback: (token: string) => onTokenRef.current(token),
          'expired-callback': () => onTokenRef.current(null),
          'error-callback': () => onTokenRef.current(null),
        });
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      if (widgetId.current && window.turnstile) window.turnstile.remove(widgetId.current);
      widgetId.current = null;
    };
  }, []);

  if (!TURNSTILE_SITE_KEY) return null;
  return (
    <div>
      <div ref={box} style={{ minHeight: '65px' }} />
      {failed && (
        <div role="alert" style={{ color: 'var(--c-red)', fontSize: '0.78rem', marginTop: '0.35rem' }}>
          The security check couldn&apos;t load. Check your connection or pause your content blocker, then reload the page.
        </div>
      )}
    </div>
  );
});

export default Captcha;
