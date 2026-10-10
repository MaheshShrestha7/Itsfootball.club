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
- \`/{club}/shop\`: the club's merch shop (kits, scarves and other merchandise) with photos, sizes and prices. Orders are paid online and collected from the club. Only present once the club has a product on sale.
- \`/{club}/member\`: how to become a member of the club and get a digital member pass.

Pages are marked up with schema.org JSON-LD (\`SportsTeam\` for clubs, \`SportsEvent\` for matches and tournaments, \`Event\` for club events, \`BlogPosting\` for news), which is the most reliable machine-readable source for names, dates and scores.

## Platform

- [Home](${SITE_URL}/): what the platform offers football clubs.
- [FAQ](${SITE_URL}/faq): pricing, how it works for club admins, coaches, players, supporters and sponsors.
- [Pricing](${SITE_URL}/pricing.md): free for clubs; the booking fee on card payments, in plain text.
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
