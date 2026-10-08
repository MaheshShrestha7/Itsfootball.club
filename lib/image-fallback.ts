import type { SyntheticEvent } from 'react';

/** The site's branded card, for content images with no URL at all (onError never fires for an empty src).
 *  Same file as DEFAULT_OG_IMAGE in lib/seo.ts, which isn't imported here because it pulls in server code. */
export const BRAND_IMAGE = '/og-image.jpg';

/** onError for content images (news covers, slides): swap a dead URL for the site's branded card once,
 *  instead of showing the browser's broken-image icon. */
export function fallbackToBrandImage(e: SyntheticEvent<HTMLImageElement>) {
  const img = e.currentTarget;
  if (img.dataset.fallback) return; // the fallback itself failed: stop, don't loop
  img.dataset.fallback = '1';
  img.src = BRAND_IMAGE;
}
