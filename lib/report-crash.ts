// Tells Mission Control a page crashed (POST /api/client-error). Never throws; once per page load.
let sent = false;

export function reportCrash(error: Error & { digest?: string }, where: 'page' | 'global' = 'page') {
  if (sent || typeof window === 'undefined') return;
  sent = true;
  try {
    fetch('/api/client-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: window.location.pathname, message: error?.message || String(error), digest: error?.digest, where }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // nothing to do: reporting must never make the error page worse
  }
}
