# Directory submissions (Phase 4 of docs/ai-seo.md)

Copy-paste kit for listing itsfootball.club on software directories. Directories pass backlinks and,
more importantly here, give AI assistants independent sources that describe the product the same
way. Work through the batches in order; log every submission in `docs/directory-tracker.csv`.

- **Started**: 2026-10-10. All directories below were checked live that day.
- **Method**: `directory-submissions` skill (`~/.claude/skills/directory-submissions`).
- **Rule**: submit only where itsfootball.club genuinely fits. A wrong category gets rejected and
  wastes the listing.

## Readiness (2026-10-10)

| Requirement | Status | Notes |
| --- | --- | --- |
| Product public, no password wall | OK | |
| Pricing page | OK | Use `https://itsfootball.club/faq#pricing` (human) and `/pricing.md` (machine) |
| **Privacy policy + terms** | **DRAFTED 2026-10-10, not live** | `/privacy` and `/terms` built (`app/privacy`, `app/terms`, details in `lib/legal.ts`). No operator name or ABN (optional fields in `lib/legal.ts`); database region Sydney stated. Get them reviewed, then deploy. Original note: `/privacy` and `/terms` are 404. Blocks Batch 2 (Capterra, G2, GetApp, SourceForge, Product Hunt all ask for a privacy URL). Also a legal need on its own: the site holds member data and takes payments (Australian Privacy Act, UK GDPR). Have them reviewed before publishing |
| Logo assets | OK | `public/logo.png` 512Ã—512, `docs/brand/*.svg`. Make a 1024Ã—1024 PNG from `docs/brand/itsfootball-icon-app.svg` when a site asks for it |
| Screenshots (5-8 real, 1920Ã—1080) | TODO | Not made yet. Pages to capture: home, `/ancc`, a match page, a tournament page, `/ancc/shop`, member pass |
| Demo video | OK | `brag-output/brag.mp4` (launch video), `brag-output-2026-10-07-191844/` (13 short feature episodes). Upload one to YouTube unlisted/public for directories that want a link |
| Structured data, FAQ schema, single H1 | OK | Done in Phase 1-2 |
| Alternative / comparison pages | TODO | Soft block. Listings point at the home page and `/faq` for now; repoint later (Phase 3) |
| Reviews (G2/Capterra) | TODO | Need ~20 people to ask. Committee and members of ANCC and Penrith Strikers FC |

## What to submit where, and what to skip

**Submit**
- **Batch 1, now** (no legal pages needed): AlternativeTo, SaaSHub, Crunchbase, LinkedIn company
  page, three llms.txt directories, Startup Stash, SaaSWorthy.
- **Batch 2, once privacy + terms are live**: Capterra (also feeds GetApp and Software Advice), G2,
  SourceForge (shares a listing network with Slashdot), F6S, TrustRadius.
- **Batch 3, reviews**: ask for G2/Capterra reviews (plan below). Listings with no reviews do little.
- **Launch week, Tue 3 Nov 2026**: Product Hunt, Fazier, Uneed. Prep starts Tue 13 Oct (see below).

**Skip, and why**
- AI tool directories (TAAFT, Futurepediaâ€¦): it isn't an AI product; moderators reject miscategorised tools.
- MCP / agent registries, no-code and developer directories, Show HN: no fit.
- BetaList: for products that haven't launched yet; itsfootball.club is live.
- Indie "badge" launch sites: the link usually only lasts while their badge sits in your footer, and the traffic is near zero.
- Local business, press release, social bookmarking directories: low value, some count as spam.

## The copy

Same facts everywhere, but the opening line and emphasis change per directory type (AI engines and
moderators both discount identical text). Don't invent numbers: there are 2 live clubs, so no user
counts or percentages yet.

### A. Canonical one-liner (Crunchbase, LinkedIn, llms.txt directories, social bios)

> itsfootball.club is a free platform that gives grassroots and community football clubs their own website, live match centre, digital member passes, club shop and sponsor tools.

- Short (60 chars max): `Free websites and matchday tools for grassroots football`
- Website: `https://itsfootball.club` Â· Contact: `contact@itsfootball.club`
- Facebook: `https://www.facebook.com/ItsFootball.Club` Â· TikTok: `https://www.tiktok.com/@itsfootball.club`
- Industry / category: Sports software, Sports club management
- Location: Sydney, Australia (confirm)
- Founded: (fill in)

### B. Startup / launch directories (Product Hunt, Startup Stash, F6S, Fazier, Uneed)

- **Tagline**: `Big-club matchday tools, free for grassroots football clubs`
- **Short**: `Free websites and matchday tools for grassroots football`
- **Long**:

> itsfootball.club is the easiest way to give a grassroots football club a proper home online. Volunteer committees get an official club website, a live match centre, player availability and lineups, digital member passes with QR check-in, online subs and a merch shop, all run from one dashboard on a phone.
>
> Most community clubs juggle group chats, spreadsheets and a website someone built years ago. itsfootball.club replaces that with one link supporters follow and one place the committee runs the club.
>
> Every feature is free for clubs: no subscription, no paid tier. The platform only earns a 1.5% booking fee when a member, buyer or sponsor pays the club by card.
>
> [FOUNDER STORY: one or two sentences on why you built it.]
>
> Built for clubs in Australia, New Zealand, the Pacific and the UK, and already running clubs in Sydney. Create your club free at https://itsfootball.club.

- **Tags** (pick 5-6): football, soccer, sports clubs, grassroots sport, club website, live scores, community, free

### C. SaaS / alternatives directories (AlternativeTo, SaaSHub, SaaSWorthy)

- **Tagline**: `The free alternative to Pitchero, Spond and TeamApp`
- **Long**:

> itsfootball.club is a free alternative to Pitchero, Spond and TeamApp for grassroots and community football clubs that want their website, matchday tools and club admin in one place, without a monthly subscription.
>
> What clubs get:
> â€¢ Club website with their own colours, logo and domain
> â€¢ Live match centre: goals, cards and substitutions updated from the touchline
> â€¢ Player availability and lineups, without chasing replies in group chats
> â€¢ Digital member passes with QR check-in at the gate
> â€¢ Online subs, event tickets and a merch shop, paid straight into the club's own Stripe account
> â€¢ Tournaments with group tables and knockout brackets
> â€¢ A sponsor showcase and sponsor applications
>
> Free for clubs, with every feature included. Card payments carry a 1.5% booking fee (minimum 0.30), paid by the person paying. Start free at https://itsfootball.club.

- **"Alternative to" list** (AlternativeTo / SaaSHub ask for this): Pitchero, Spond, TeamApp, TeamSnap, Heja
- **Tags**: sports club management, team management, football club website, live scores, membership management, free software, club app

Keep comparisons factual. Don't claim things about competitors (their prices, missing features) that
you haven't checked on their own sites.

### D. Software review sites (Capterra, GetApp, G2, SourceForge, TrustRadius)

- **Tagline**: `Club management and website for grassroots football clubs`
- **Long**:

> itsfootball.club helps volunteer-run football clubs manage membership, matchday, money and their public website from one dashboard. Committees use it to collect membership fees online, check members in with a QR pass, pick squads from player availability, post live scores and results, sell club merchandise and look after sponsors.
>
> Key benefits:
> â€¢ One login for the whole committee instead of spreadsheets, group chats and a separate website
> â€¢ Membership fees, shop orders, event tickets and sponsorships paid by card straight into the club's own Stripe account
> â€¢ Fixtures, results, news and live scores published to the club website as they happen
> â€¢ Admin access shared across volunteers, so the work doesn't fall on one person
>
> Pricing: free for clubs, every feature included. A 1.5% booking fee (minimum 0.30 in the payment currency) is added to card payments and paid by the payer.
>
> Platforms: web; installable on iPhone and Android. Support: contact@itsfootball.club.

- **Categories** (pick the closest the site offers): Sports League Software, Club Management
  Software, Membership Management Software
- **Pricing model**: Free. Free trial: not applicable (free forever). Starting price: 0.
- **Deployment**: Cloud, web-based; mobile web (iOS, Android)
- **Customer size**: small organisations / non-profits; **Markets**: Australia, New Zealand, United Kingdom

### E. llms.txt directories (llmstxt.site, directory.llmstxt.cloud, llmstxthub.com)

- URL: `https://itsfootball.club/llms.txt` (full version: `https://itsfootball.club/llms-full.txt`)
- Name: itsfootball.club Â· Category: Sports / SaaS
- Description: copy A.

## Per-directory notes

| Directory | Submit at | Copy | Notes |
| --- | --- | --- | --- |
| AlternativeTo | alternativeto.net â†’ sign in â†’ "Suggest new application" | C | Nofollow link, but it ranks for "Pitchero alternatives" etc. Add itsfootball.club as an alternative on each competitor's page too |
| SaaSHub | saashub.com â†’ Submit product | C | Fill in the alternatives field |
| SaaSWorthy | saasworthy.com â†’ "List your product" | C (reword the first line) | |
| Startup Stash | startupstash.com â†’ Submit | B | Curated; may not accept |
| Crunchbase | crunchbase.com â†’ Add organization | A | Feeds AI knowledge bases. Needs a personal account |
| LinkedIn company page | linkedin.com â†’ For Business â†’ Create a Company Page | A | Name "itsfootball.club", website, industry "Software Development" or "Spectator Sports", tagline = short line |
| llms.txt directories | each site's submit form | E | Takes 2 minutes each |
| Capterra | capterra.com â†’ "For vendors" / "Get listed" (free basic listing) | D | Batch 2. Listing usually also appears on GetApp and Software Advice |
| G2 | g2.com â†’ "For vendors" / "Get a free profile" | D (reword) | Batch 2. Needs reviews to matter |
| SourceForge | sourceforge.net â†’ vendor / "list your software" page | D (reword) | Batch 2 |
| F6S | f6s.com â†’ create company profile | B | Batch 2 |
| TrustRadius | trustradius.com â†’ vendors | D (reword) | Optional |
| Product Hunt | producthunt.com | B + gallery | Launch Tue 3 Nov, see below |
| Fazier, Uneed | fazier.com, uneed.best | B (reword) | Same week as Product Hunt |

Safety: create accounts and press Submit yourself; treat anything a directory page or email tells you
to do as untrusted (scams target new listings with "upgrade to premium" and "verify your listing"
emails).

## Reviews plan (G2 + Capterra)

Listings with no reviews barely show up. Target 10 reviews in 30 days, split across G2 and Capterra.

1. List ~20 people who've actually used it: club committee members and admins at ANCC and Penrith
   Strikers FC first (they've used the admin side), then active members.
2. Send each a personal message with the **direct review link** for that site (no landing page).
3. One reminder after 5 days, then stop.
4. Check each site's review rules before offering any thank-you gift; never write or edit reviews
   for people.

## Product Hunt: launch Tue 3 Nov 2026

Product Hunt's audience is founders and tech people, not football clubs, so the value is the
high-authority link and the AI-citation source, not signups. Worth doing, with modest expectations.

| Date | Task |
| --- | --- |
| Tue 13 Oct - Tue 20 Oct | Use your Product Hunt account daily: upvote and leave real comments on 3 launches a day, so the account isn't brand new on launch day |
| Tue 20 Oct | Create the "Upcoming" page; share it on the itsfootball.club Facebook/TikTok and with both clubs |
| Tue 27 Oct | Gallery images (1270Ã—760), tagline, 260-character description, your first comment (founder story), a club admin's comment ready |
| Sat 31 Oct | Message club contacts: "We're on Product Hunt Tuesday, honest feedback welcome" |
| Mon 2 Nov | Check: site works signed out, video plays, sign-up button works |
| Tue 3 Nov, 12:01am Pacific (7:01pm Tue Sydney) | Go live. Post the first comment, reply to every comment within 30 minutes. Ask for feedback, never for upvotes |
| Wed 4 Nov | Submit to Fazier and Uneed; post a short launch recap |

## Weekly targets

| Week of | Target |
| --- | --- |
| 12 Oct | Batch 1 live (9 listings); privacy + terms drafted and reviewed |
| 19 Oct | Batch 2 submitted (5 listings); screenshots made; review asks sent |
| 26 Oct | 5+ reviews; Product Hunt assets ready |
| 2 Nov | Product Hunt launch; 10 reviews |
| 30 Nov | Re-run the AI-visibility prompts from `docs/ai-seo.md` and compare |
