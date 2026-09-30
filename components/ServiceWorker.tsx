'use client';

import { useEffect } from 'react';

/** Registers public/sw.js (offline page + push notifications). Production only: in dev it would serve stale reloads. */
export default function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch(err => console.warn('Service worker not registered:', err));
  }, []);
  return null;
}
