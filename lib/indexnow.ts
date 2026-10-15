// Tells Bing (and through it ChatGPT search and Copilot), Yandex, Naver and Seznam that pages changed,
// via IndexNow. Same key as scripts/indexnow.mjs (public by design: public/<key>.txt proves the site
// asked). Best effort: never throws and never holds up the caller for long. Only on the live site.
import { SITE_URL } from './slugs';

export const INDEXNOW_KEY = 'd10a466fa4eff6f0f9a410315e166fef';

export async function pingIndexNow(paths: string[]): Promise<void> {
  const host = new URL(SITE_URL).host;
  if (host !== 'itsfootball.club' || !paths.length) return;
  try {
    await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ host, key: INDEXNOW_KEY, keyLocation: `${SITE_URL}/${INDEXNOW_KEY}.txt`, urlList: [...new Set(paths)].map(p => `${SITE_URL}${p}`) }),
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    // the sitemap and the deploy-time script catch it later
  }
}
