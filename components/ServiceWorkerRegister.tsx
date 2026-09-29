'use client';

import { useEffect } from 'react';

// Registers public/sw.js (offline copies of visited pages) in production builds. On the first visit the
// page loaded before the worker took control, so it hands the worker this page and its scripts to keep.
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    const firstInstall = !navigator.serviceWorker.controller;

    navigator.serviceWorker
      .register('/sw.js')
      .then(() => navigator.serviceWorker.ready)
      .then(registration => {
        if (!firstInstall) return;
        const assets = performance
          .getEntriesByType('resource')
          .map(entry => entry.name)
          .filter(name => name.startsWith(`${location.origin}/_next/static/`));
        registration.active?.postMessage({ type: 'cache-current-page', url: location.href, assets });
      })
      .catch(err => console.warn('Service worker registration failed', err));
  }, []);

  return null;
}
