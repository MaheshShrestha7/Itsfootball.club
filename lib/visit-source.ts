/**
 * Where a visit came from: a Facebook post, Google, a QR poster, a club email...
 *
 * Three signals, best first:
 *  1. Tags in the link (utm_source / utm_medium / utm_campaign). Our own share buttons, posters and
 *     emails add them (tagLink), so "Shared match page" or "Event flyer" shows up as its own line.
 *  2. fbclid, which Facebook adds to every link clicked in its app, even when it sends no referrer.
 *  3. The referring site (document.referrer). Instagram, WhatsApp and email apps often send none:
 *     those visits are "Direct or an app".
 * Only sources and counts: never who the visitor is.
 */

const TAG_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'utm_id', 'fbclid', 'gclid'];
const FIRST_KEY = 'itsfootball_first_src';
const FIRST_DAYS = 90;

export type LinkTags = { src?: string; med?: string; cmp?: string; fb?: 1 };

/** The tags of a source, with the site it came from: what a sign-up row remembers */
export type FirstSource = LinkTags & { ref?: string };

const clean = (v: string | null | undefined) =>
  (v || '').trim().toLowerCase().replace(/[^a-z0-9 _./-]/g, '').replace(/\s+/g, '-').slice(0, 80) || undefined;

/** Adds our tags to a link we hand out, unless it already carries its own */
export function tagLink(url: string, source: string, medium: string, campaign: string): string {
  try {
    const rel = url.startsWith('/');
    const u = new URL(url, 'https://x.invalid');
    if ([...u.searchParams.keys()].some(k => k.startsWith('utm_'))) return url;
    u.searchParams.set('utm_source', source);
    u.searchParams.set('utm_medium', medium);
    const c = clean(campaign);
    if (c) u.searchParams.set('utm_campaign', c);
    return rel ? `${u.pathname}${u.search}${u.hash}` : u.toString();
  } catch {
    return url;
  }
}

/** The tags in this page's address. Takes them off the address afterwards, so a visitor who copies the
 *  link on doesn't pass our tag along and the next page view isn't counted under it again. */
export function takeLinkTags(): LinkTags {
  if (typeof window === 'undefined') return {};
  let url: URL;
  try { url = new URL(window.location.href); } catch { return {}; }
  const p = url.searchParams;
  if (!TAG_KEYS.some(k => p.has(k))) return {};
  const tags: LinkTags = {};
  const src = clean(p.get('utm_source')), med = clean(p.get('utm_medium')), cmp = clean(p.get('utm_campaign'));
  if (src) tags.src = src;
  if (med) tags.med = med;
  if (cmp) tags.cmp = cmp;
  if (p.has('fbclid')) tags.fb = 1;
  TAG_KEYS.forEach(k => p.delete(k));
  try {
    const qs = p.toString();
    window.history.replaceState(null, '', `${url.pathname}${qs ? `?${qs}` : ''}${url.hash}`);
  } catch { /* the address just keeps its tags */ }
  return tags;
}

/** The referring site, unless it's this same site */
function outsideReferrer(): string | undefined {
  try {
    const r = document.referrer;
    if (!r || new URL(r).host === window.location.host) return undefined;
    return r.slice(0, 500);
  } catch {
    return undefined;
  }
}

/** The tags for this page view, and remembers the first outside source this browser arrived from
 *  (for 90 days, in this browser only) so a later sign-up can say what brought it. */
export function visitTags(): LinkTags {
  const tags = takeLinkTags();
  const ref = typeof document === 'undefined' ? undefined : outsideReferrer();
  if (tags.src || tags.fb || ref) {
    try {
      const old = JSON.parse(localStorage.getItem(FIRST_KEY) || 'null') as (FirstSource & { at?: number }) | null;
      if (!old || !old.at || Date.now() - old.at > FIRST_DAYS * 86400000) {
        localStorage.setItem(FIRST_KEY, JSON.stringify({ ...tags, ...(ref ? { ref } : {}), at: Date.now() }));
      }
    } catch { /* storage blocked: nothing remembered */ }
  }
  return tags;
}

/** The first outside source this browser arrived from in the last 90 days ({} for none) */
export function firstSource(): FirstSource {
  try {
    const s = JSON.parse(localStorage.getItem(FIRST_KEY) || 'null') as (FirstSource & { at?: number }) | null;
    if (!s || !s.at || Date.now() - s.at > FIRST_DAYS * 86400000) return {};
    const { at: _at, ...rest } = s;
    void _at;
    return rest;
  } catch {
    return {};
  }
}

// ------------------------------------------------------------------------------------- naming

export const DIRECT = 'Direct or an app';
export const OWN_SITE = 'Your own site';

const BY_TAG: [RegExp, string][] = [
  [/^(facebook|fb|facebook\.com|meta)$/, 'Facebook'],
  [/^(instagram|ig|insta)$/, 'Instagram'],
  [/^(whatsapp|wa)$/, 'WhatsApp'],
  [/^(messenger)$/, 'Messenger'],
  [/^(email|e-mail|mail|newsletter|gmail|outlook)$/, 'Email'],
  [/^(qr|poster|flyer|print)$/, 'QR poster or flyer'],
  [/^(sms|text)$/, 'Text message'],
  [/^(google)$/, 'Google'],
  [/^(tiktok)$/, 'TikTok'],
  [/^(x|twitter)$/, 'X (Twitter)'],
  [/^(linkedin)$/, 'LinkedIn'],
  [/^(youtube)$/, 'YouTube'],
];

const BY_HOST: [RegExp, string][] = [
  [/(^|\.)(facebook\.com|fb\.com|fb\.me)$/, 'Facebook'],
  [/(^|\.)messenger\.com$/, 'Messenger'],
  [/(^|\.)instagram\.com$/, 'Instagram'],
  [/(^|\.)(whatsapp\.com|whatsapp\.net|wa\.me)$/, 'WhatsApp'],
  [/(^|\.)(mail\.google\.com|outlook\.live\.com|outlook\.office\.com|mail\.yahoo\.com)$/, 'Email'],
  [/(^|\.)(chatgpt\.com|openai\.com|perplexity\.ai|claude\.ai|gemini\.google\.com|copilot\.microsoft\.com|meta\.ai)$/, 'AI chat'],
  [/(^|\.)google\.[a-z.]+$/, 'Google'],
  [/(^|\.)(bing\.com|duckduckgo\.com|yahoo\.com|ecosia\.org|baidu\.com|yandex\.[a-z]+)$/, 'Other search'],
  [/(^|\.)tiktok\.com$/, 'TikTok'],
  [/(^|\.)(x\.com|twitter\.com|t\.co)$/, 'X (Twitter)'],
  [/(^|\.)(linkedin\.com|lnkd\.in)$/, 'LinkedIn'],
  [/(^|\.)(youtube\.com|youtu\.be)$/, 'YouTube'],
  [/(^|\.)reddit\.com$/, 'Reddit'],
  [/(^|\.)threads\.(net|com)$/, 'Threads'],
];

/** Which of our own pages count as "your own site": a club's pages (slug + custom domain) or all of itsfootball.club */
export type OwnSite = { slug?: string; domain?: string | null };

const isPlatformHost = (h: string) => /(^|\.)itsfootball\.club$/.test(h);

/** The source a visit row is named under */
export function sourceLabel(referrer: string | null | undefined, meta: unknown, own: OwnSite = {}): string {
  const m = (meta && typeof meta === 'object' ? meta : {}) as Record<string, unknown>;
  const src = typeof m.src === 'string' ? m.src : '';
  const tagged = src ? BY_TAG.find(([re]) => re.test(src))?.[1] : undefined;
  if (tagged) return tagged;
  if (m.fb) return 'Facebook';
  if (referrer) {
    try {
      const u = new URL(referrer);
      const host = u.host.toLowerCase().replace(/^www\./, '');
      if (own.domain && host === own.domain.toLowerCase().replace(/^www\./, '')) return OWN_SITE;
      if (isPlatformHost(host)) {
        if (!own.slug) return OWN_SITE;
        const first = u.pathname.split('/')[1]?.toLowerCase();
        // strict-origin-when-cross-origin: a club on its own domain only sees "itsfootball.club/"
        return first === own.slug.toLowerCase() ? OWN_SITE : 'itsfootball.club';
      }
      const named = BY_HOST.find(([re]) => re.test(host))?.[1];
      if (named) return named;
      return host || DIRECT;
    } catch { /* not a URL */ }
  }
  // A link of ours that said only "shared" (the share sheet doesn't say which app it went to)
  if (src === 'share') return 'Shared link, app unknown';
  if (src) return src;
  return DIRECT;
}

/** How a tagged link was handed out, from its medium */
export function mediumLabel(med: string | undefined): string {
  switch (med) {
    case 'share': return 'Share button';
    case 'poster': return 'QR poster';
    case 'flyer': return 'Event flyer';
    case 'email': return 'Club email';
    default: return med ? med : 'Tagged link';
  }
}

type Row = { referrer?: string | null; metadata?: unknown; visitor_hash?: string | null; created_at: string };

export type SourceSummary = {
  /** [source, visits], most first. A visit = one browser on one day. Your own site left out. */
  sources: [string, number][];
  /** Tagged links (campaigns), most visits first */
  campaigns: { campaign: string; how: string; visits: number; from: string }[];
  visits: number;
};

/** Visits by source: one per browser per day, named after its best signal (any outside source beats "Direct") */
export function summariseSources(rows: Row[], own: OwnSite = {}): SourceSummary {
  const visits = new Map<string, string>();
  const camps = new Map<string, { campaign: string; how: string; seen: Set<string>; from: Map<string, number> }>();
  let anon = 0;
  for (const r of rows) {
    const label = sourceLabel(r.referrer, r.metadata, own);
    const vid = r.visitor_hash && r.visitor_hash !== 'anon' ? r.visitor_hash : `anon${anon++}`;
    const key = `${vid}|${r.created_at.slice(0, 10)}`;
    const had = visits.get(key);
    if (!had || ((had === DIRECT || had === OWN_SITE) && label !== DIRECT && label !== OWN_SITE)) visits.set(key, label);

    const m = (r.metadata && typeof r.metadata === 'object' ? r.metadata : {}) as Record<string, unknown>;
    if (typeof m.cmp === 'string' && m.cmp) {
      const ck = `${m.cmp}|${m.med || ''}`;
      const c = camps.get(ck) || { campaign: m.cmp, how: mediumLabel(typeof m.med === 'string' ? m.med : undefined), seen: new Set<string>(), from: new Map<string, number>() };
      if (!c.seen.has(key)) {
        c.seen.add(key);
        c.from.set(label, (c.from.get(label) || 0) + 1);
      }
      camps.set(ck, c);
    }
  }
  const counts = new Map<string, number>();
  for (const label of visits.values()) if (label !== OWN_SITE) counts.set(label, (counts.get(label) || 0) + 1);
  const sources = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const campaigns = [...camps.values()]
    .map(c => ({
      campaign: c.campaign,
      how: c.how,
      visits: c.seen.size,
      from: [...c.from.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([l, n]) => `${l} ${n}`).join(', '),
    }))
    .sort((a, b) => b.visits - a.visits);
  return { sources, campaigns, visits: sources.reduce((a, [, n]) => a + n, 0) };
}

/** Sign-ups (or any other counted rows) by the source that first brought them, most first */
export function countBySource(rows: Row[], own: OwnSite = {}): [string, number][] {
  const counts = new Map<string, number>();
  for (const r of rows) {
    const label = sourceLabel(r.referrer, r.metadata, own);
    const l = label === OWN_SITE ? DIRECT : label;
    counts.set(l, (counts.get(l) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

/** The referrer + metadata of a sign-up row: the first source this browser came from, and what was signed up for */
export function signupRow(kind: string): { referrer: string | null; metadata: Record<string, unknown> } {
  const { ref, ...tags } = firstSource();
  return { referrer: ref || null, metadata: { kind, ...tags } };
}
