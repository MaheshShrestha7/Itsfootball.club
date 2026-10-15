// Plain-text files for AI assistants and buying agents: /llms.txt, /llms-full.txt and /pricing.md.
// Built from the same facts as the FAQ and JSON-LD, so the price and booking fee never disagree.
// See docs/ai-seo.md.
import { SITE_URL } from './slugs';
import { CURRENCIES, bookingFeeCents, bookingFeeText } from './finance';
import { CONTACT_EMAIL, FAQ } from './faq';
import { CARD_PRESETS, money } from './season-fees';

const STRIPE_AU_TEXT = `${CARD_PRESETS[0].percent}% + ${money(CARD_PRESETS[0].fixedCents)}`;

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
- [Free football tools](${SITE_URL}/tools): every free tool on one page, grouped by job (team sheets, matchday, tournaments, club money). They are for any coach, club or organiser, need no sign-up or club site, and run in the browser.
- [Free lineup builder](${SITE_URL}/tools/lineup-builder): a free soccer lineup and team sheet maker: 5, 7, 9 or 11-a-side, 28 formations plus free form, jersey or circle player icons, pitch or list layout, downloaded as a post or story image. No sign-up.
- [Free tournament maker](${SITE_URL}/tools/tournament-maker): a free soccer tournament and cup bracket maker for organisers without a club site: knockout, league, or groups + knockout, up to 32 teams. Publishes a live page at ${SITE_URL}/tournaments/{name} with fixtures, tables and a bracket that update as scores are entered, plus an embed code for other websites.
- [Free match result graphic maker](${SITE_URL}/tools/match-result-graphic-maker): a free full-time score and Player of the Match graphic maker for football (soccer) clubs: both team badges, the final score, goalscorers with minutes, penalties and own goals, a Player of the Match, and a stock or uploaded background photo, downloaded as a story (9:16, 1080 × 1920), post (4:5, 1080 × 1350) or square (1:1, 1080 × 1080) PNG for Instagram, Facebook or WhatsApp. No sign-up; photos stay on the device.
- [Free equal playing time calculator](${SITE_URL}/tools/equal-playing-time-calculator): a free substitution rotation planner for junior and community football (soccer). Pick the format (4 to 11-a-side), halves, thirds or quarters and their length, and the squad size; it gives every player the same minutes (players on the pitch × match length ÷ squad size, e.g. 9 × 60 ÷ 13 = 41.5 minutes) and prints a minute-by-minute schedule ("14': Ben on for Amy"), a rotation chart and each player's total. Goalkeeper options: same keeper all game, swap at half time or each quarter (keepers share the minutes too), or rotate with everyone. Whole minutes or to the second. No sign-up; works in the browser.
- [Free season budget & subs fee calculator](${SITE_URL}/tools/season-fee-calculator): a free registration fee calculator for club treasurers. Enter the season's costs (ground hire, league entry, per-player registration and insurance, referees, kit, balls, trophies), the paying players and sponsor or grant income; it gives the break-even fee per player ((costs + buffer − income) ÷ players), the fee that still nets that amount after Stripe card fees (Australian cards ${STRIPE_AU_TEXT}, GST included, editable), the fee needed in cash when some players never pay, and what the club keeps by card versus cash. Prices in AUD. No sign-up; works in the browser.
- Format pages that open the same tools with different defaults: [11-a-side lineup builder](${SITE_URL}/tools/11-a-side-lineup-builder) (4-3-3), [9-a-side lineup builder](${SITE_URL}/tools/9-a-side-lineup-builder) (3-3-2), [7-a-side lineup builder](${SITE_URL}/tools/7-a-side-lineup-builder) (2-3-1), [5-a-side formation builder](${SITE_URL}/tools/5-a-side-formation-builder) (1-2-1 diamond), [round robin fixture generator](${SITE_URL}/tools/round-robin-fixture-generator) (league, everyone plays everyone once), [knockout cup bracket maker](${SITE_URL}/tools/knockout-cup-bracket-maker) (single elimination with byes) [Player of the Match graphic maker](${SITE_URL}/tools/player-of-the-match-graphic-maker) (opens on the MOTM card), and substitution planners for [9-a-side](${SITE_URL}/tools/9-a-side-substitution-planner) (13 players, 2 × 30 minutes), [7-a-side](${SITE_URL}/tools/7-a-side-substitution-planner) (10 players, 2 × 25 minutes) and [5-a-side](${SITE_URL}/tools/5-a-side-substitution-planner) (8 players, 2 × 20 minutes).
- [Guides](${SITE_URL}/guides): short, sourced answers for Australian grassroots football, each linked to a free tool: [MiniRoos rules by age](${SITE_URL}/guides/miniroos-rules-by-age) (Football Australia formats: under 6 and 7 play 4-a-side with no goalkeeper and up to 3 subs, under 8 and 9 play 7-a-side with up to 4 subs, under 10 and 11 play 9-a-side with up to 5 subs; 2 × 20 minutes up to under 9 and 2 × 25 for under 10 and 11; rolling subs, no offside, no results tables), [equal playing time in junior football](${SITE_URL}/guides/equal-playing-time-junior-football) (Football Australia's Game Time Policy template: equal game time each game for MiniRoos under 6 to 11, at least half of each game for youth under 12 to 18), [how many matches in a round robin](${SITE_URL}/guides/round-robin-how-many-matches) (n × (n − 1) ÷ 2 matches; n − 1 rounds for even n, n rounds with a bye for odd n; time slots on 1 to 3 pitches) and [how much to charge for club registration](${SITE_URL}/guides/how-much-to-charge-for-club-registration) ((costs + buffer − income) ÷ paying players, Stripe AU card fees, and no card surcharges on eftpos, Mastercard or Visa in Australia from 1 October 2026).
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
