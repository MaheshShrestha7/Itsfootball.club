import { NextRequest, NextResponse } from 'next/server';
import sitemap from '@/app/sitemap';
import { pingIndexNow } from '@/lib/indexnow';
import { SITE_URL } from '@/lib/seo';

// Hourly IndexNow ping, triggered by the Cloudflare cron in worker.ts (or by hand:
// POST with "Authorization: Bearer $CRON_SECRET"; add ?dry=1 to list the URLs without sending).
// Sends every sitemap URL whose lastModified falls in the last WINDOW_HOURS: news just published,
// matches that kicked off (live or just finished), new events and tournaments, updated clubs.
// The window overlaps the hourly schedule so a late run doesn't miss anything; repeats are harmless.

const WINDOW_HOURS = 3;
const MAX_URLS = 10000; // IndexNow's limit per request

/** Equal-time string compare, so the secret can't be guessed byte by byte from response timing */
function sameSecret(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  if (!sameSecret(req.headers.get('authorization') || '', `Bearer ${secret}`)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const since = Date.now() - WINDOW_HOURS * 3600 * 1000;
  const paths = (await sitemap())
    .filter(e => e.lastModified && new Date(e.lastModified).getTime() >= since)
    .map(e => e.url.slice(SITE_URL.length) || '/')
    .slice(0, MAX_URLS);

  if (req.nextUrl.searchParams.get('dry') === '1') return NextResponse.json({ dryRun: true, paths });
  await pingIndexNow(paths);
  return NextResponse.json({ sent: paths.length });
}
