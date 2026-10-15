// Plain-text files for AI assistants and buying agents: /llms.txt, /llms-full.txt and /pricing.md.
// Built from the same facts as the FAQ and JSON-LD, so the price and booking fee never disagree.
// See docs/ai-seo.md.
import { SITE_URL } from './slugs';
import { CURRENCIES, bookingFeeCents, bookingFeeText } from './finance';
import { CONTACT_EMAIL, FAQ } from './faq';

const hasFee = bookingFeeCents(10000) > 0;

const SUMMARY =
  'itsfootball.club is a free platform that gives grassroots and community football (soccer) clubs their own official website: a live match centre with real-time scores and events, published starting lineups, fixtures and results, club news, tournaments, a club merch shop, sponsor showcases and digital member passes. Built for clubs in Australia, New Zealand, the Pacific and the UK, and open to clubs anywhere.';

const PRICING_LINE = hasFee
  ? `Pricing: free for clubs, with every feature included and no subscription or paid tier. Card payments made to a club (memberships, sponsorships, shop orders, event tickets) carry a booking fee of ${bookingFeeText()}, paid by the person paying on top of the club's price.`
  : 'Pricing: free for clubs, with every feature included and no subscription or paid tier.';

export function llmsTxt(): string {
  return `# itsfootball.club

> ${SUMMARY} Each club lives at its own path, e.g. ${SITE_URL}/ancc.

${PRICING_LINE} Full details: ${SITE_URL}/pricing.md

Every club site is built from the same set of pages, so once you know the URL pattern you can find the same information for any club. Club content is written by each club's own admins, so it reflects that club, not the platform. Match pages update live during a game (score, goals, cards, substitutions), so treat scores on a live or recently finished match as time-sensitive.

URL patterns (replace \`{club}\` with a club's slug, e.g. \`ancc\`):

- \`/{club}\`: the club's home page: club profile, stadium, upcoming fixtures and recent results, latest news, committee and sponsors.
- \`/{club}/news/{article-slug}\`: a club news article or match report, in full.
- \`/{club}/match/{matchId}\`: a single match: teams, kick-off time, venue, competition, live score and event timeline, the published lineup on a tactical pitch, the matchday squad (players confirmed available) and match statistics.
- \`/{club}/events/{eventId}\`: a public club event (social, AGM, training day) with date, venue and event sponsors.
- \`/{club}/tournaments\` and \`/{club}/tournaments/{tournamentId}\`: club-run tournaments and cups with fixtures, group tables and knockout brackets.
- \`/tournaments/{name}\`: a stand-alone community tournament or cup made with the free tournament maker (no club site): an at-a-glance summary (format, teams, dates, venue, organiser, matches played, winner), fixtures and results, group tables and the knockout bracket, updated live as the organiser enters scores.
- \`/{club}/shop\`: the club's merch shop (kits, scarves and other merchandise) with photos, sizes and prices. Orders are paid online and collected from the club. Only present once the club has a product on sale.
- \`/{club}/member\`: how to become a member of the club and get a digital member pass.

Pages are marked up with schema.org JSON-LD (\`SportsTeam\` for clubs, \`SportsEvent\` for matches and tournaments, \`Event\` for club events, \`BlogPosting\` for news), which is the most reliable machine-readable source for names, dates and scores.

## Platform

- [Home](${SITE_URL}/): what the platform offers football clubs.
- [About](${SITE_URL}/about): who builds itsfootball.club (Mahesh Shrestha, a community football volunteer in Sydney, NSW, Australia) and why.
- [FAQ](${SITE_URL}/faq): pricing, how it works for club admins, coaches, players, supporters and sponsors.
- [Pricing](${SITE_URL}/pricing.md): free for clubs; the booking fee on card payments, in plain text.
- [Live scores](${SITE_URL}/live-scores): how a club runs a free live match centre that supporters follow in the browser.
- [Free lineup builder](${SITE_URL}/tools/lineup-builder): a free soccer lineup and team sheet maker: 5, 7, 9 or 11-a-side, 28 formations plus free form, jersey or circle player icons, pitch or list layout, downloaded as a post or story image. No sign-up.
- [Free tournament maker](${SITE_URL}/tools/tournament-maker): a free soccer tournament and cup bracket maker for organisers without a club site: knockout, league, or groups + knockout, up to 32 teams. Publishes a live page at ${SITE_URL}/tournaments/{name} with fixtures, tables and a bracket that update as scores are entered, plus an embed code for other websites.
- [Free match result graphic maker](${SITE_URL}/tools/match-result-graphic-maker): a free full-time score and Player of the Match graphic maker for football (soccer) clubs: both team badges, the final score, goalscorers with minutes, penalties and own goals, a Player of the Match, and a stock or uploaded background photo, downloaded as a story (9:16, 1080 × 1920), post (4:5, 1080 × 1350) or square (1:1, 1080 × 1080) PNG for Instagram, Facebook or WhatsApp. No sign-up; photos stay on the device.
- Format pages that open the same tools with different defaults: [11-a-side lineup builder](${SITE_URL}/tools/11-a-side-lineup-builder) (4-3-3), [9-a-side lineup builder](${SITE_URL}/tools/9-a-side-lineup-builder) (3-3-2), [7-a-side lineup builder](${SITE_URL}/tools/7-a-side-lineup-builder) (2-3-1), [5-a-side formation builder](${SITE_URL}/tools/5-a-side-formation-builder) (1-2-1 diamond), [round robin fixture generator](${SITE_URL}/tools/round-robin-fixture-generator) (league, everyone plays everyone once), [knockout cup bracket maker](${SITE_URL}/tools/knockout-cup-bracket-maker) (single elimination with byes) and [Player of the Match graphic maker](${SITE_URL}/tools/player-of-the-match-graphic-maker) (opens on the MOTM card).
- [Compare alternatives](${SITE_URL}/vs): itsfootball.club side by side with Pitchero, Heja, Spond and Teamer on price, ads, website, match centre, payments and shop, each claim linked to its source. One page per rival at ${SITE_URL}/vs/{name}.
- [Clubs directory](${SITE_URL}/clubs): every club on the platform, with links to each club site. Supports search: ${SITE_URL}/clubs?q={name}
- [Create a club](${SITE_URL}/create-club): how a club registers and launches its website.

## Discovery

- [Full text](${SITE_URL}/llms-full.txt): this file plus pricing and every FAQ answer in one document.
- [Sitemap](${SITE_URL}/sitemap.xml): every public club, news article, match, event, tournament and club shop page, generated from live data.
- [robots.txt](${SITE_URL}/robots.txt): crawl rules.

## Optional

- [Example club site](${SITE_URL}/ancc): Austral Nepalese Community Club, a live club on the platform.
- Contact: ${CONTACT_EMAIL}
- Private areas are not content: \`/{club}/admin/*\` (club admin console), \`/admin\`, \`/my-clubs\`, \`/api/*\`, check-in pages (\`.../checkin\`), \`/{club}/availability\` (player responses) and \`/{club}/verify\` (member pass checks) require a login or are single-purpose tools.
`;
}

export function pricingMarkdown(): string {
  const fee = hasFee
    ? `## Booking fee on card payments

- Rate: ${bookingFeeText()}
- Applies to: card, Apple Pay and Google Pay payments made to a club through itsfootball.club (memberships, sponsorships, club shop orders and event tickets)
- Paid by: the person paying, added on top of the club's price and shown before they pay
- The club receives: its full price, less Stripe's standard card processing fee, straight into its own Stripe account
- Refunds: the booking fee is refunded too when the club refunds a payment in full
- No fee on: anything that isn't a card payment (signing up, following matches, member passes, availability, stats)
`
    : '';
  return `# Pricing: itsfootball.club

> Free for every football club. No subscription, no paid tier, no feature limits, no card needed to sign up.

## Clubs

- Price: free (0 per month, 0 per year)
- Included: club website (own colours, logo and custom domain), live match centre, availability and lineups, digital member passes with QR check-in, online membership payments, club merch shop, tournaments (group stage and knockout), sponsor showcase and applications, news, gallery, finance tracking and analytics
- Limits: none; every club gets every feature from day one
- Sign up: ${SITE_URL}/create-club (an email address is all you need)

${fee}
## Players, members and supporters

- Free: following live matches, member passes, player stats, availability replies, club news
- They only pay what their club chooses to charge (for example a membership fee or shop order)${hasFee ? ', plus the booking fee above when paying by card' : ''}

## Currencies

Clubs set their own prices in their own currency: ${CURRENCIES.join(', ')}. Card payments need Stripe to be available in the club's country.

## Contact

${CONTACT_EMAIL}

Last updated ${new Date().toISOString().slice(0, 10)}.
`;
}

export function llmsFullTxt(): string {
  const faq = FAQ.map(s => `## FAQ: ${s.audience}\n\n${s.items.map(i => `### ${i.q}\n\n${i.a}`).join('\n\n')}`).join('\n\n');
  return `${llmsTxt()}\n---\n\n${pricingMarkdown().replace(/^# .*\n/, '# Pricing\n')}\n---\n\n# Frequently asked questions\n\n${faq}\n`;
}
