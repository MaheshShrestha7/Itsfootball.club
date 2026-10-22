// Tells Bing (and through it ChatGPT search and Copilot), Yandex, Naver and Seznam about new and changed
// pages straight away, via IndexNow (https://www.indexnow.org). Google doesn't use IndexNow; it reads the sitemap.
//
//   npm run indexnow                    URLs in the live sitemap changed in the last 48 hours, plus the
//                                       platform pages (home, tools, guides, compare, FAQ...), which change on deploys
//   npm run indexnow -- --hours 6       a different window
//   npm run indexnow -- <url> <url>...  just these URLs
//   add --dry-run to print the list without sending it
//
// Run it after a deploy. To run it on every deploy, add `&& npm run indexnow` to the deploy command in
// Cloudflare (Workers & Pages > itsfootball-club > Settings > Build). The key is public by design: IndexNow
// checks that public/<key>.txt on the site holds it, which proves the site asked for these URLs.
const KEY = 'd10a466fa4eff6f0f9a410315e166fef';
const SITE = process.env.INDEXNOW_SITE || 'https://itsfootball.club';
const ENDPOINT = 'https://api.indexnow.org/indexnow';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const hoursAt = args.indexOf('--hours');
const hours = hoursAt >= 0 ? Number(args[hoursAt + 1]) : 48;
const given = args.filter((a, i) => /^https?:\/\//.test(a) && args[i - 1] !== '--hours');

// Pages that belong to the platform rather than a club: the first path segment is one of these (or none)
const PLATFORM = new Set(['', 'tools', 'guides', 'compare', 'pricing', 'faq', 'about', 'live-scores', 'clubs', 'create-club']);

async function fromSitemap() {
  const res = await fetch(`${SITE}/sitemap.xml`);
  if (!res.ok) throw new Error(`sitemap.xml: HTTP ${res.status}`);
  const xml = await res.text();
  const since = Date.now() - hours * 3600 * 1000;
  const urls = [];
  for (const [, body] of xml.matchAll(/<url>([\s\S]*?)<\/url>/g)) {
    const loc = body.match(/<loc>([^<]+)<\/loc>/)?.[1]?.trim();
    if (!loc) continue;
    const lastmod = Date.parse(body.match(/<lastmod>([^<]+)<\/lastmod>/)?.[1] ?? '');
    const first = new URL(loc).pathname.split('/')[1] ?? '';
    if (PLATFORM.has(first) || (!isNaN(lastmod) && lastmod >= since)) urls.push(loc);
  }
  return urls;
}

const host = new URL(SITE).host;
const urlList = [...new Set(given.length ? given : await fromSitemap())].filter(u => new URL(u).host === host).slice(0, 10000);
console.log(`indexnow: ${urlList.length} URL(s)${dryRun ? ' (dry run)' : ''}`);
if (dryRun) {
  for (const u of urlList) console.log(`  ${u}`);
  process.exit(0);
}
if (!urlList.length) process.exit(0);

const res = await fetch(ENDPOINT, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host, key: KEY, keyLocation: `${SITE}/${KEY}.txt`, urlList }),
});
// 200 OK and 202 Accepted both mean it was received; 403 means the key file isn't live yet
console.log(`indexnow: HTTP ${res.status} ${res.statusText}`);
if (res.status >= 300) {
  console.log(await res.text().catch(() => ''));
  process.exitCode = 1;
}
