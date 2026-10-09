import { findClubAppIcons } from '@/lib/supabase/club-lookup';
import { SITE_URL } from '@/lib/seo';

// iPhones ignore manifest icons and use this for "Add to Home Screen": the club crest icon drawn
// by the admin area (lib/app-icons.ts), else the platform icon. Overrides app/apple-icon.png on club pages.
export const size = { width: 192, height: 192 };
export const contentType = 'image/png';

export default async function AppleIcon({ params }: { params: Promise<{ clubSlug: string }> }) {
  const { clubSlug } = await params;
  const own = (await findClubAppIcons(clubSlug))?.icon192;
  // Fetched rather than read from disk: the Cloudflare Worker has no filesystem
  for (const src of [own, `${SITE_URL}/icon.png`]) {
    if (!src) continue;
    const res = await fetch(src, { next: { revalidate: 3600 } }).catch(() => null);
    if (res?.ok) return new Response(await res.arrayBuffer(), { headers: { 'Content-Type': 'image/png' } });
  }
  return new Response(null, { status: 404 });
}
