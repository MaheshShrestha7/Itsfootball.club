import type { SyntheticEvent } from 'react';

/** onError for content images (news covers, slides): swap a dead URL for the site's branded card once,
 *  instead of showing the browser's broken-image icon. */
export function fallbackToBrandImage(e: SyntheticEvent<HTMLImageElement>) {
  const img = e.currentTarget;
  if (img.dataset.fallback) return; // the fallback itself failed: stop, don't loop
  img.dataset.fallback = '1';
  img.src = '/og-default.jpg';
}
