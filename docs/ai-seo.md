# AI SEO (getting cited by ChatGPT, Perplexity, Claude, Gemini and Google AI Overviews)

Working reference for the AI-search optimisation work. Pick it up from the **Status** table: every
item says what was done, where, and what's left. Method comes from the `ai-seo` skill
(`~/.claude/skills/ai-seo`), installed from github.com/coreyhaines31/marketingskills.

- **Started**: 2026-10-10
- **Target markets**: Australia, New Zealand, Oceania (Pacific), United Kingdom
- **Positioning in one line**: itsfootball.club is a free platform that gives grassroots and community
  football clubs their own website, live match centre, digital member passes, club shop and sponsor tools.

## Facts AI answers must get right

Keep these identical everywhere (llms.txt, pricing.md, FAQ, JSON-LD, homepage). If one changes, change
it at the source listed, not by hand in each place.

| Fact | Value | Source of truth |
| --- | --- | --- |
| Price for clubs | Free. No subscription, no paid tier, every feature included | `lib/faq.ts` (pricing section) |
| Booking fee | 1.5% of card payments, minimum 0.30 in the payment currency, paid by the payer on top of the club's price | `NEXT_PUBLIC_BOOKING_FEE_*` env vars, read by `BOOKING_FEE` + `bookingFeeText()` in `lib/finance.ts` |
| Who pays the fee | The person paying (member, buyer, sponsor), only on card payments through the platform | `lib/faq.ts` |
| Currencies | AUD, NZD, GBP and others in `CURRENCIES` | `lib/finance.ts` |
| Contact | contact@itsfootball.club | `lib/faq.ts` (`CONTACT_EMAIL`) |
| Social profiles | https://www.facebook.com/ItsFootball.Club, https://www.tiktok.com/@itsfootball.club | `SOCIAL_PROFILES` in `lib/seo.ts` |

The llms.txt / llms-full.txt / pricing.md routes are built at build time, so a fee change in the env
vars needs a redeploy to show up there (same as the payment screen).

## Baseline audit (2026-10-10)

Already in place before this work, verified against production:

- AI crawlers get 200s: `OAI-SearchBot`, `GPTBot`, `ChatGPT-User`, `PerplexityBot`, `ClaudeBot`,
  `Claude-SearchBot` (tested with `curl -A`). robots.txt allows all except admin and `/api/`.
  **Re-check after any Cloudflare change**: Cloudflare's "Block AI bots" / AI Crawl Control setting
  can switch this off at the edge without touching the code.
- Pages are server-rendered with real content (club page, FAQ, clubs directory, tournaments), so
  crawlers that don't run JavaScript still see text.
- Sitemap generated from live data (`app/sitemap.ts`), JSON-LD on every public page type
  (`lib/schema.ts`), FAQPage schema on `/faq`, length-tuned titles/descriptions (`lib/seo.ts`),
  `llms.txt`.

Gaps found: pricing missing from llms.txt (strongest selling point invisible to AI), no number for
the booking fee anywhere, no `SoftwareApplication` entity, no `sameAs`, no quotable definition
sentence on the homepage, news articles only reachable as `#news-…` fragments inside a modal (not
citable, not crawlable links), FAQ written for existing users rather than the questions people ask an
assistant.

## Status

| # | Item | Phase | Status | Where |
| --- | --- | --- | --- | --- |
| 1 | Pricing + booking fee + `/faq` link in llms.txt | 1 | DONE | `app/llms.txt/route.ts`, `lib/llms.ts` |
| 2 | `/pricing.md` for buying agents | 1 | DONE | `app/pricing.md/route.ts`, `lib/llms.ts` |
| 3 | `SoftwareApplication` (free offer, features, area served) in home JSON-LD | 1 | DONE | `homeSchema()` in `lib/schema.ts` |
| 4 | `sameAs` social profiles + contact on `Organization` | 1 | DONE | `SOCIAL_PROFILES` in `lib/seo.ts` |
| 5 | Quotable definition sentence on the homepage | 1 | DONE | hero sub in `app/HomeClient.tsx` |
| 6 | News articles get their own pages `/{club}/news/{slug}` | 2 | DONE | `app/[clubSlug]/news/[newsSlug]/`, `@schema/news/...`, sitemap, club page cards are now links |
| 7 | FAQ: questions people ask an assistant, direct first sentence | 2 | DONE | new "New to itsfootball.club" section in `lib/faq.ts` |
| 8 | `/llms-full.txt` generated from the FAQ data | 2 | DONE | `app/llms-full.txt/route.ts` |
| 9 | Guides for problem-aware queries | 3 | TODO | see Phase 3 |
| 10 | Comparison pages | 3 | TODO | see Phase 3 |
| 11 | Directory listings | 4 | TODO (owner) | see Phase 4 |
| 12 | Community presence | 4 | TODO (owner) | see Phase 4 |
| 13 | Club case studies / backlinks | 4 | TODO (owner) | see Phase 4 |
| 14 | Monthly AI visibility tracking | 5 | TODO | prompt list below |

## Phase 1 and 2: what was built

**Generated text files** (`lib/llms.ts`): `llmsTxt()`, `llmsFullTxt()` and `pricingMarkdown()` build
the three files from the same facts. `public/llms.txt` was replaced by a route so the fee can't go
stale. Routes are static (built once per deploy).

**FAQ data moved** from `app/faq/page.tsx` to `lib/faq.ts`, so the FAQ page, its FAQPage schema and
llms-full.txt all read one list. The pricing answers now state the fee as a number via
`bookingFeeText()`.

**News article pages**: `/{club}/news/{slug}` renders the full article (cover, video, body) on the
server through the usual `useClub` initial data, with its own title/description/canonical
(`layout.tsx`), `BlogPosting` JSON-LD (`@schema/news/[newsSlug]/page.tsx`) and a sitemap entry. The
news cards and hero news buttons on the club home page are now real `<Link>`s to these pages; the old
news modal was removed. `#news-{slug}` ids stay on the cards so old fragment links still scroll.
URLs are built with `newsPath()` and read back with `decodeSlugParam()` (`lib/slugs.ts`).

**Article body on the server** (`components/ArticleBody.tsx`): DOMPurify needs the browser's DOM, so
`sanitizeArticleHtml` returns '' on the server and the article text used to be missing from the
HTML that crawlers read. The server (and the first browser paint, to keep hydration identical) now
renders the article's words as plain paragraphs; the sanitised HTML replaces them once mounted.
Pictures and embedded videos inside the body only appear after that swap.

**Homepage definition**: the hero sub-line now opens with "itsfootball.club is the free platform for
grassroots football clubs: …" (copy change; reword freely, but keep a plain "X is Y" sentence).

## Not done yet / next session

1. Commit and deploy, then run the checks below against production.
2. Submit the sitemap again in Google Search Console and Bing Webmaster Tools so the new
   `/news/...` URLs get crawled; Bing also feeds ChatGPT search and Copilot.
3. Run the first Phase 5 baseline (prompt list below) before Phase 3 content ships, so later changes
   can be compared against it.
4. Phase 3 needs a content route (`/guides/[slug]`) and real written guides.

## Phase 3: content (TODO)

Write for people first (Google's guidance: no separate "for AI" content). Each page opens with a 40-60
word direct answer, uses headings phrased like the question, cites real numbers, shows an author and
a "last updated" date. First-hand material from ANCC (Austral Nepalese Community Club) is the
strongest proof available.

Guides (problem-aware), AU/NZ/UK spelling:
1. How to make a website for your football club (free)
2. How to collect club membership fees / subs online
3. How to find and keep local sponsors for a grassroots club
4. How to run a club tournament or cup (groups + knockout)
5. How to run live scores for a Sunday league / community match
6. Running a club with volunteers: the committee roles and tools

Comparison pages (honest, dated, no claims about competitors we can't source): itsfootball.club vs
Pitchero, vs Spond, vs TeamApp. ChatGPT cites comparison pages less since Aug 2026; Google AI
Overviews, Gemini and Perplexity still use them. Needs a content route (e.g. `/guides/[slug]`) before
any of this can ship; not built yet.

## Phase 4: presence off the site (owner actions)

- Directories: Product Hunt, Capterra, AlternativeTo, SaaSHub, GetApp (the `directory-submissions`
  skill has the list and tracker). Describe the product with the one-line positioning above, word
  for word, everywhere: AI models look for consensus.
- Communities: r/SundayLeague, r/grassrootsfootball, AU/NZ/UK local football Facebook groups. Genuine
  answers only, no link drops.
- Clubs on the platform: ask ANCC and others to link "Website by itsfootball.club" from their social
  bios and league listings.
- Social: keep the Facebook and TikTok bios on the same one-line positioning.

## Phase 5: measuring (monthly)

Run each prompt 3-5 times in ChatGPT, Perplexity, Google (AI Overview) and Gemini. Record whether
itsfootball.club is cited, mentioned or recommended, and who is instead, as a rate ("cited 2/5").
One run is an anecdote, not a measurement.

Core prompts:
1. free football club website builder
2. free football club website Australia / New Zealand / UK
3. best app to run a grassroots football club
4. app for Sunday league team availability and lineups
5. how do I make a website for my soccer club
6. how to collect football club membership fees online
7. live score app for amateur football matches
8. digital membership card for a sports club
9. football club merch shop for a small club
10. free alternative to Pitchero
11. free alternative to Spond for football
12. free alternative to TeamApp
13. how to run a football tournament with groups and knockout
14. what is itsfootball.club
15. is itsfootball.club free

Log results in a sheet with date, engine, prompt, runs, cited count, competitors named.

## Verified locally (2026-10-10, production build against live data)

- `npm run check` and `npm run build` pass; `/llms.txt`, `/llms-full.txt`, `/pricing.md` prerender as
  static and show the 1.5% / 0.30 fee; llms-full.txt holds all 43 FAQ answers.
- `/ancc/news/selroti-strikers-wins-3rd-edition-of-ancc-dashain-cup-at-craik-park`: own title,
  canonical, `BlogPosting` + `BreadcrumbList`, and the full article text in the HTML without JavaScript.
- Club page news cards link to `/ancc/news/...`; the sitemap lists the 3 ANCC articles.
- Home JSON-LD has `WebApplication` with price 0, areaServed and the fee.
- Not checked: the in-browser swap from plain paragraphs to formatted HTML (hydration), on a real phone.

## Checks after any change here

- `npm run check` (includes `bookingFeeText` asserts in `lib/finance.check.ts`)
- `npm run build`
- `curl -s https://itsfootball.club/llms.txt`, `/llms-full.txt`, `/pricing.md` return 200 with the fee
- A news URL from the sitemap renders its full text with `curl` (no JavaScript)
- Google Rich Results Test on `/`, `/faq`, a club page and a news page
