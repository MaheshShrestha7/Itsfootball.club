// Checks every council wet-weather link in lib/councils.ts still works, still talks about ground
// closures, and still shows the phone number we list. Run monthly by .github/workflows/council-links.yml,
// or by hand:
//   npm run council-links            prints a report; exits 1 when a link is broken or needs a look
//   REPORT=report.md npm run council-links   also writes the report as Markdown (for the GitHub issue)
// Council sites sometimes block automated requests (403/429); those are reported as "couldn't check",
// not as broken, so a firewall doesn't raise a false alarm.
import { writeFileSync } from 'node:fs';
import { COUNCILS, COUNCILS_CHECKED, type Council } from '../lib/councils';

type Verdict = 'ok' | 'look' | 'broken' | 'unchecked';
interface Result { council: Council; verdict: Verdict; notes: string[] }

const UA = 'Mozilla/5.0 (compatible; itsfootball.club link check; +https://itsfootball.club/grounds)';
const KEYWORDS = /closed|closure|ground status|field status|wet weather|open/i;
const digits = (s: string) => s.replace(/\D/g, '');

async function check(council: Council): Promise<Result> {
  const notes: string[] = [];
  let res: Response;
  try {
    res = await fetch(council.url, { redirect: 'follow', headers: { 'User-Agent': UA, Accept: 'text/html' }, signal: AbortSignal.timeout(20000) });
  } catch (err) {
    return { council, verdict: 'broken', notes: [`Request failed: ${(err as Error).message}`] };
  }
  if ([401, 403, 429, 503].includes(res.status)) return { council, verdict: 'unchecked', notes: [`HTTP ${res.status} (the site may block automated checks)`] };
  if (!res.ok) return { council, verdict: 'broken', notes: [`HTTP ${res.status}`] };

  let verdict: Verdict = 'ok';
  const from = new URL(council.url);
  const to = new URL(res.url || council.url);
  if (to.host.replace(/^www\./, '') !== from.host.replace(/^www\./, '')) {
    verdict = 'look';
    notes.push(`Redirects to another site: ${to.href}`);
  } else if (to.pathname.replace(/\/$/, '').toLowerCase() !== from.pathname.replace(/\/$/, '').toLowerCase()) {
    notes.push(`Redirects to ${to.href}`);
  }
  const html = await res.text().catch(() => '');
  const text = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ');
  if (!KEYWORDS.test(text)) {
    verdict = 'look';
    notes.push('The page no longer mentions closures, wet weather or ground status');
  }
  if (council.phone && !digits(text).includes(digits(council.phone.number).replace(/^0/, ''))) {
    verdict = 'look';
    notes.push(`The phone number ${council.phone.number} is no longer on the page`);
  }
  return { council, verdict, notes };
}

const results: Result[] = [];
for (const c of COUNCILS) results.push(await check(c)); // one at a time, to be polite to council sites

const icon: Record<Verdict, string> = { ok: '✅', look: '⚠️', broken: '❌', unchecked: '⏸️' };
const problems = results.filter(r => r.verdict === 'broken' || r.verdict === 'look');
const lines = [
  `# Council wet-weather links: ${problems.length ? `${problems.length} need a look` : 'all fine'}`,
  '',
  `Checked ${results.length} councils from \`lib/councils.ts\` (last checked by hand ${COUNCILS_CHECKED}).`,
  '',
  '| | Council | Link | Notes |',
  '|-|-|-|-|',
  ...results.map(r => `| ${icon[r.verdict]} | ${r.council.name} | ${r.council.url} | ${r.notes.join('; ') || ''} |`),
  '',
  problems.length
    ? 'To fix: open each flagged link, find the council\'s current wet-weather or ground status page, update `url`, `note` or `phone` in `lib/councils.ts`, and set `COUNCILS_CHECKED` to today.'
    : 'Nothing to do.',
];
const report = lines.join('\n');
console.log(report);
if (process.env.REPORT) writeFileSync(process.env.REPORT, report);
process.exitCode = problems.length ? 1 : 0;
