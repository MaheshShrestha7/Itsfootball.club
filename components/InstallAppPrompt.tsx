'use client';

import React, { useEffect, useState } from 'react';
import { Download, Share, X } from 'lucide-react';

// Offers to add the club site to the home screen, so the member pass opens like an app (and offline).
// Chrome on Android and desktop fire beforeinstallprompt and get an Install button; every other browser
// gets the steps for its platform. Hidden once installed or dismissed.

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISSED_KEY = 'itsfootball_install_dismissed';

function isInstalled() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

type Platform = 'ios' | 'android' | 'desktop';

function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'desktop';
}

// Shown when the browser doesn't offer its own install prompt (iPhone, Firefox, Samsung Internet,
// or Chrome before it decides the site is installable)
const MANUAL_STEPS: Record<Platform, React.ReactNode> = {
  ios: (
    <>
      Tap <Share size={14} aria-label="Share" style={{ verticalAlign: '-2px' }} /> Share in your browser, then choose{' '}
      <strong>Add to Home Screen</strong>.
    </>
  ),
  android: (
    <>
      Open your browser menu (<strong>⋮</strong>), then tap <strong>Install app</strong> or <strong>Add to Home screen</strong>.
    </>
  ),
  desktop: (
    <>
      Use the install icon at the right of the address bar, or <strong>Install</strong> in the browser menu.
    </>
  ),
};

export default function InstallAppPrompt({ clubName }: { clubName: string }) {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [platform, setPlatform] = useState<Platform>('desktop');
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if (isInstalled()) return;
    try {
      if (localStorage.getItem(DISMISSED_KEY)) return;
    } catch {
      // Storage blocked: still offer it
    }
    setDismissed(false);
    setPlatform(detectPlatform());

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setDismissed(true);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISSED_KEY, '1');
    } catch {
      // Not remembered, shows again next visit
    }
  };

  const install = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    const { outcome } = await installEvent.userChoice;
    setInstallEvent(null);
    if (outcome === 'accepted') setDismissed(true);
  };

  if (dismissed) return null;

  return (
    <div
      className="glass-panel"
      role="region"
      aria-label="Add to home screen"
      style={{ width: '100%', maxWidth: '400px', marginTop: '1.25rem', padding: '1rem 1.25rem', display: 'flex', gap: '0.9rem', alignItems: 'flex-start' }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '0.25rem' }}>Keep your pass on your home screen</div>
        {installEvent ? (
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Add {clubName} as an app to open your pass in one tap, even without signal at the gate.
          </p>
        ) : (
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            {MANUAL_STEPS[platform]} Your pass will then open in one tap, even offline.
          </p>
        )}
        {installEvent && (
          <button type="button" className="btn btn-primary" onClick={install} style={{ marginTop: '0.75rem', padding: '0.5rem 1rem' }}>
            <Download size={16} aria-hidden="true" /> Install app
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.25rem' }}
      >
        <X size={18} aria-hidden="true" />
      </button>
    </div>
  );
}
