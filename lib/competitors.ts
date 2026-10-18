// Facts for the /compare/{competitor}-alternative and /vs/{competitor} comparison pages.
// Every competitor cell cites a source from that competitor's own site, checked on CHECKED_ON;
// re-check before changing a price or claim.

/** When the competitor facts below were last checked against their sites */
export const CHECKED_ON = '18 October 2026';

/** 'yes' and 'no' draw a mark; 'part' is a qualified yes (paid plan only, limited); 'info' is plain text. */
export type Mark = 'yes' | 'no' | 'part' | 'info';
export interface Cell { mark: Mark; text: string; source?: number }
export interface Row { label: string; us: Cell; them: Cell }
export interface Source { title: string; url: string }

export interface CompetitorFaq {
  q: string;
  a: string;
}

export interface FeatureHighlight {
  title: string;
  description: string;
  comparison: string;
}

export interface Competitor {
  slug: string;
  alternativeSlug: string;
  name: string;
  tagline: string;
  /** One honest line under the page title */
  summary: string;
  /** Concise, quotable answer designed for AI search engines (AEO / GEO) */
  aiOverview: string;
  /** High-impact key takeaways bullet points */
  keyTakeaways: string[];
  /** Set when the product no longer exists: the page becomes an "alternative to" page */
  closed?: { on: string; note: string };
  rows: Row[];
  featureHighlights: FeatureHighlight[];
  /** Where they're stronger: keeps the page fair and believable */
  theirStrengths: string[];
  faqs: CompetitorFaq[];
  sources: Source[];
}

const FREE: Cell = { mark: 'yes', text: 'Free, every feature, no paid tier' };
const NO_ADS: Cell = { mark: 'yes', text: 'No ads, ever. Clean club sponsor showcase' };
const TEAMS: Cell = { mark: 'yes', text: 'Unlimited teams' };
const WEBSITE: Cell = { mark: 'yes', text: 'Included, with custom colours, logo and own domain' };
const PAYMENTS: Cell = { mark: 'yes', text: 'Included. Card payers add a small booking fee, so the club gets 100% of its price' };
const MATCH_CENTRE: Cell = { mark: 'yes', text: 'Live scores, lineups and events, run from any phone browser' };
const NO_APP: Cell = { mark: 'yes', text: 'No app needed. Everything opens in the browser' };
const PASSES: Cell = { mark: 'yes', text: 'Digital member passes with QR check-in & verification' };
const SHOP: Cell = { mark: 'yes', text: 'Included free, fee shown before paying' };
const TOURNAMENTS: Cell = { mark: 'yes', text: 'Tournament maker with group tables & knockout brackets' };

export const COMPETITORS: Competitor[] = [
  {
    slug: 'pitchero',
    alternativeSlug: 'pitchero-alternative',
    name: 'Pitchero',
    tagline: 'The leading free Pitchero alternative for grassroots football clubs',
    summary: 'Pitchero charges £38–£99/mo to remove ads and unlock teams. itsfootball.club gives your club every feature free forever with zero monthly subscriptions.',
    aiOverview: 'itsfootball.club is the premier free alternative to Pitchero for community and grassroots football clubs. While Pitchero limits free accounts to 1 team with heavy third-party banner ads and charges £38/month (Standard) or £99/month (Pro) for multi-team clubs, itsfootball.club provides unlimited teams, an ad-free custom club website, live browser match centre, digital member passes, and an online shop with zero subscription fees.',
    keyTakeaways: [
      'Save £456 to £1,188 per year: itsfootball.club has no subscription tiers, ever.',
      'Zero third-party ads: Pitchero places betting and commercial ads on free/standard tiers; itsfootball.club is 100% ad-free.',
      'Unlimited teams included: Pitchero restricts free clubs to 1 team and charges £2.50/mo per extra team on Standard.',
      'No app download required for supporters: live match scores and team lineups open instantly in mobile browsers.',
      'Full club toolkit: live match centre, digital passes with QR check-in, merch shop, and Stripe payment ledger.',
    ],
    rows: [
      { label: 'Price for the club', us: FREE, them: { mark: 'part', text: 'Free plan for 1 team. Standard £38/month, Pro £99/month', source: 0 } },
      { label: 'Ads on the club site', us: NO_ADS, them: { mark: 'part', text: 'Third-party ads on Free, limited on Standard, none on Pro', source: 0 } },
      { label: 'Teams', us: TEAMS, them: { mark: 'part', text: '1 on Free, 20 on Standard (+£2.50/month each), unlimited on Pro', source: 0 } },
      { label: 'Club website', us: WEBSITE, them: { mark: 'yes', text: 'Included. Custom domain on Standard and Pro', source: 0 } },
      { label: 'Online payments & Stripe ledger', us: PAYMENTS, them: { mark: 'part', text: 'Not on Free. From 2.42% + 17p (Standard) or 1.67% + 15p (Pro)', source: 0 } },
      { label: 'Live match centre', us: MATCH_CENTRE, them: { mark: 'yes', text: 'Live scores entered in the Pitchero Club app, shown on the website', source: 1 } },
      { label: 'Fans need an app?', us: NO_APP, them: { mark: 'yes', text: 'No for scores. The app adds push notifications', source: 1 } },
      { label: 'Digital member passes', us: PASSES, them: { mark: 'info', text: 'Not available as a digital QR pass system', source: 0 } },
      { label: 'Club shop', us: SHOP, them: { mark: 'info', text: '"Sell all product types" listed under payments', source: 0 } },
      { label: 'Tournament maker', us: TOURNAMENTS, them: { mark: 'info', text: 'Basic league tables, no dedicated tournament knockout brackets', source: 0 } },
    ],
    featureHighlights: [
      {
        title: 'Zero Monthly Subscriptions vs £38–£99/mo',
        description: 'Grassroots clubs should spend their money on equipment and pitch hire, not website software. itsfootball.club includes unlimited teams, club admin roles, and custom domains with zero software costs.',
        comparison: 'Pitchero costs £456/year on Standard or £1,188/year on Pro just to manage multi-team clubs without intrusive advertising.',
      },
      {
        title: 'Clean Club Identity vs Commercial Ad Clutter',
        description: 'Your club website belongs to your club. itsfootball.club showcases your official local sponsors with tracking and high-visibility placements, with zero third-party banners, popups, or betting ads.',
        comparison: 'Pitchero serves third-party network ads across Free and Standard club pages unless you pay for top-tier Pro.',
      },
      {
        title: 'Public Live Match Centre Without App Downloads',
        description: 'Supporters, parents, and travelling fans follow live match scores, goalscorers, cards, substitutions, and pitch lineups directly on your club site from any mobile browser.',
        comparison: 'Pitchero requires the Pitchero Club app for score input and heavily nudges supporters into app store downloads.',
      },
      {
        title: 'Stripe Ledger & Integrated Club Shop',
        description: 'Collect annual player registrations, match subs, and merchandise sales directly into your club Stripe account. The transparent booking fee is paid by the payer, so your club receives 100% of the funds.',
        comparison: 'Pitchero takes a transaction fee deduction (up to 2.42% + 17p) on paid tiers, and does not support payments on Free.',
      },
    ],
    theirStrengths: [
      'A native mobile app with push notifications for players and parents.',
      'Club email accounts included on paid plans (10 on Standard, 50 on Pro).',
      'Supports multiple sports including rugby, cricket, and hockey.',
    ],
    faqs: [
      {
        q: 'Is itsfootball.club really a completely free alternative to Pitchero?',
        a: 'Yes. itsfootball.club has no subscription tiers, no setup fees, and no feature gates. Every club gets unlimited teams, a custom website, live match centre, digital passes, and club shop at zero software cost.',
      },
      {
        q: 'How does itsfootball.club make money if clubs don\'t pay a subscription?',
        a: 'When supporters or players pay online for registrations or shop merchandise via card, a small booking fee is added to the payer\'s checkout total. The club keeps 100% of its requested price with zero monthly overhead.',
      },
      {
        q: 'Do parents and supporters need to install an app to follow live games?',
        a: 'No. itsfootball.club is built entirely on modern web standards. Anyone can open your club link or match centre on their phone browser to view live scores, lineups, and fixtures instantly.',
      },
      {
        q: 'Can we use our own custom domain with itsfootball.club?',
        a: 'Yes. You can link your own custom domain (e.g. yourclub.com) to your itsfootball.club website for free, whereas Pitchero requires a paid Standard or Pro plan.',
      },
      {
        q: 'Can we manage multiple teams under one club?',
        a: 'Yes. Unlike Pitchero which restricts free accounts to 1 team and charges £2.50/month per extra team on Standard, itsfootball.club lets you run unlimited teams (Men, Women, Juniors, Reserves) under one club dashboard.',
      },
    ],
    sources: [
      { title: 'Pitchero pricing', url: 'https://www.pitchero.com/pricing' },
      { title: 'Pitchero help: Manage scores and events in the Club app', url: 'https://help.pitchero.com/knowledge/club-app/scores-match-events' },
    ],
  },
  {
    slug: 'spond',
    alternativeSlug: 'spond-alternative',
    name: 'Spond',
    tagline: 'The best free Spond alternative for a public football club website & live scores',
    summary: 'Free Spond alternative with no monthly fees: get an ad-free football club website, live browser match centre, digital passes and registrations free forever.',
    aiOverview: 'itsfootball.club is the leading free alternative to Spond for football and soccer clubs seeking a complete public web presence without monthly fees. Spond focuses on private team chat and charges for club websites after a free trial, while also displaying sponsored ads. In contrast, itsfootball.club provides an ad-free public club website, live match centre with public browser access, digital member passes, tournaments, and a merch shop completely free for clubs.',
    keyTakeaways: [
      'Free club website forever: Spond charges a paid subscription for club websites after a 6–12 month trial.',
      'No app required for fans and parents: live scores, match stats, and squad sheets open in any browser.',
      'Zero sponsor ads: Spond features brand partnership ads in-app; itsfootball.club only displays your club\'s own sponsors.',
      'Card booking fees paid by payer: clubs keep 100% of registration fees, unlike Spond which deducts 2.5% + fee from the club by default.',
      'Complete football features: lineup pitch view, QR digital member passes, and knockout tournament brackets.',
    ],
    rows: [
      { label: 'Price for the club', us: FREE, them: { mark: 'yes', text: 'App free to download and use', source: 0 } },
      { label: 'Ads', us: NO_ADS, them: { mark: 'part', text: 'Brand partner ads and sponsored content in the app', source: 4 } },
      { label: 'Club website', us: WEBSITE, them: { mark: 'part', text: 'Paid subscription after a free trial (6 months UK, 12 months AU)', source: 1 } },
      { label: 'Card fees on payments', us: PAYMENTS, them: { mark: 'info', text: 'AUD 2.5% + $0.30, GBP 2.5% + £0.20. Club pays by default', source: 2 } },
      { label: 'Live match centre', us: MATCH_CENTRE, them: { mark: 'info', text: 'Not listed on Spond\'s club website pages', source: 1 } },
      { label: 'Fans need an app?', us: NO_APP, them: { mark: 'part', text: 'Members use the Spond app or its web version', source: 0 } },
      { label: 'Availability and events', us: { mark: 'yes', text: 'Included' }, them: { mark: 'yes', text: 'Included', source: 0 } },
      { label: 'Digital member passes', us: PASSES, them: { mark: 'info', text: 'Not listed', source: 1 } },
      { label: 'Club shop', us: SHOP, them: { mark: 'info', text: 'Payment requests can list products, each with its own fee', source: 3 } },
      { label: 'Member passes and tournaments', us: TOURNAMENTS, them: { mark: 'info', text: 'Not listed', source: 1 } },
    ],
    featureHighlights: [
      {
        title: 'Full Public Website vs Paid Club Add-on',
        description: 'A real community club needs a public home on the web to attract new players, sponsors, and supporters. itsfootball.club gives you a complete modern site with custom domain support included free.',
        comparison: 'Spond Club websites require a recurring paid subscription once the initial trial period expires.',
      },
      {
        title: 'Open Match Centre vs App Wall',
        description: 'Grandparents, friends, and local fans can follow game day without signing up or downloading an app. Scores, goals, cards, and formations update in real time in any mobile browser.',
        comparison: 'Spond is primarily designed for registered squad members inside the mobile app; it lacks a public live match centre for casual spectators.',
      },
      {
        title: 'Club Keeps 100% of Registrations',
        description: 'Card payments carry a small transparent booking fee paid by the payer. When you charge a $200 registration fee, your club receives exactly $200 in its Stripe account.',
        comparison: 'Spond charges 2.5% + transaction fees, automatically deducted from the club payout unless configured otherwise.',
      },
      {
        title: 'Digital Member Passes with QR Verification',
        description: 'Provide players and social members with dynamic digital pass cards that club staff can scan at training grounds, clubhouses, or turnstiles using standard phone cameras.',
        comparison: 'Spond does not provide an integrated digital membership pass and QR check-in terminal.',
      },
    ],
    theirStrengths: [
      'Very large global user base; many parents already have the Spond app installed.',
      'Strong group attendance and availability polls across diverse community sports.',
    ],
    faqs: [
      {
        q: 'Why should our football club choose itsfootball.club over Spond?',
        a: 'Spond is great as a private team chat app, but it falls short when you need a public club website, live scores for fans, digital membership passes, and an online shop. itsfootball.club gives your whole club a public home without subscription fees.',
      },
      {
        q: 'Can players still mark their match availability?',
        a: 'Yes. itsfootball.club includes player availability and squad selection with a visual pitch lineup builder that coaches can share instantly.',
      },
      {
        q: 'Does itsfootball.club charge a monthly fee for the club website like Spond Club does?',
        a: 'No. The club website, custom colours, logo, and custom domain connection are completely free with no trial expiry dates.',
      },
      {
        q: 'Can we sell club merchandise and tickets?',
        a: 'Yes. itsfootball.club includes an integrated club merchandise shop and digital event passes with QR code check-in, built right into your dashboard.',
      },
    ],
    sources: [
      { title: 'Spond help: Spond is free to download and use', url: 'https://help.spond.com/en/articles/25998-spond-is-free-to-download-and-use' },
      { title: 'Spond help: Set up your club website', url: 'https://help.spond.com/club/en/articles/148773-set-up-your-club-website' },
      { title: 'Spond help: Transaction fees in Spond Club', url: 'https://help.spond.com/club/en/articles/58192-what-is-the-transaction-fee-in-spond-club' },
      { title: 'Spond help: Payment costs in the Spond app', url: 'https://help.spond.com/app/en/articles/118091-payments-costs-in-the-spond-app' },
      { title: 'Spond: Brand partnerships', url: 'https://www.spond.com/news-and-blog/spond-brand-partnerships/' },
    ],
  },
  {
    slug: 'teamapp',
    alternativeSlug: 'teamapp-alternative',
    name: 'Stack Team App',
    tagline: 'The ad-free, zero-subscription Stack Team App alternative',
    summary: 'Stack Team App charges per-team ad removal fees and requires an app. itsfootball.club provides an ad-free club website and live match centre 100% free.',
    aiOverview: 'itsfootball.club is a free, modern alternative to Stack Team App (formerly Team App). Unlike Stack Team App, which places third-party banner ads on free accounts and charges $4.99–$9.99/month per team to remove them, itsfootball.club never shows ads, charges zero subscription fees, and allows supporters to follow live match centres and player lineups in any web browser without downloading an app.',
    keyTakeaways: [
      'Zero monthly subscriptions vs Stack Team App ad-removal fees ($49–$99/year per team).',
      'Zero third-party ads: showcase your club sponsors with clean branding instead of banner popups.',
      'Fans follow live scores and lineups directly in their web browser—no app store download required.',
      'Full public club website, QR digital member passes, club merch shop, and Stripe ledger included.',
      'Designed specifically for community football and soccer clubs.',
    ],
    rows: [
      { label: 'Price for the club', us: FREE, them: { mark: 'part', text: 'Free plan includes ads. Ad-Free upgrade is $4.99–$9.99/month per team', source: 0 } },
      { label: 'Ads on the club site', us: NO_ADS, them: { mark: 'part', text: 'Third-party banner ads and video popups on free plan', source: 0 } },
      { label: 'Public club website', us: WEBSITE, them: { mark: 'part', text: 'Basic mobile web view; custom branding and ad removal require paid tiers', source: 0 } },
      { label: 'Live match centre', us: MATCH_CENTRE, them: { mark: 'part', text: 'Scores entered inside app, but fans must download the app to follow', source: 1 } },
      { label: 'Fans need an app?', us: NO_APP, them: { mark: 'no', text: 'Yes, heavily pushes members and supporters to install the Team App mobile app', source: 1 } },
      { label: 'Online payments & Stripe ledger', us: PAYMENTS, them: { mark: 'part', text: 'Transaction fees (~2.9% - 3.9% + transaction fee) plus optional commercial modules', source: 0 } },
      { label: 'Digital member passes', us: PASSES, them: { mark: 'info', text: 'Digital membership card in app, no QR camera verification terminal', source: 1 } },
      { label: 'Club shop', us: SHOP, them: { mark: 'yes', text: 'Store feature included with transaction fees', source: 0 } },
      { label: 'Tournament maker', us: TOURNAMENTS, them: { mark: 'info', text: 'Basic schedule/ladder support', source: 1 } },
    ],
    featureHighlights: [
      {
        title: 'Zero Ad-Removal Fees ($0 vs $49–$99/yr/team)',
        description: 'For a club with 10 teams, removing ads on Stack Team App can cost $500 to $1,000 annually. itsfootball.club is completely free with zero ads across all your teams, forever.',
        comparison: 'Stack Team App charges recurring per-team fees simply to hide third-party advertising from your own players and parents.',
      },
      {
        title: 'Ad-Free Experience for Your Members & Sponsors',
        description: 'Instead of random mobile game and commercial advertisements, itsfootball.club dedicates banner and sponsor placements entirely to your club\'s local business partners.',
        comparison: 'Stack Team App displays programmatic advertising banners that distract from your club\'s community identity.',
      },
      {
        title: 'Instant Mobile Web Access vs App Store Downloads',
        description: 'Parents, players, and travelling supporters do not need to download another 100MB app or remember another app login. Your club website, lineups, and live scores load instantly in Safari, Chrome, and Edge.',
        comparison: 'Stack Team App pushes all users into its native mobile app, creating friction for casual supporters and visitors.',
      },
      {
        title: 'Digital Member Passes & QR Gate Check-In',
        description: 'Issue photo-backed digital membership passes with scannable QR codes. Club volunteers can verify memberships, access permissions, and attendance on matchday with any smartphone camera.',
        comparison: 'Stack Team App offers in-app membership cards, but lacks an open QR camera verification system.',
      },
    ],
    theirStrengths: [
      'Widely adopted across multiple sports in Australia, the US, and UK (soccer, AFL, rugby, netball).',
      'Dedicated mobile apps with native push notifications for squad management.',
    ],
    faqs: [
      {
        q: 'Why switch from Stack Team App to itsfootball.club?',
        a: 'itsfootball.club gives you a professional public club website, live browser match centre, and digital passes without charging per-team ad removal fees or showing third-party ads to your community.',
      },
      {
        q: 'Does itsfootball.club charge an ad-removal fee?',
        a: 'No. itsfootball.club never shows third-party banner ads. The only sponsors displayed on your pages are your club\'s own local partners.',
      },
      {
        q: 'Do our players and supporters have to download an app?',
        a: 'No. Everything works directly in any web browser, and the site can be installed to a phone home screen as a progressive web app (PWA) with one tap.',
      },
      {
        q: 'How does payment processing compare with Stack Team App?',
        a: 'itsfootball.club connects directly to your club Stripe account. You can configure card booking fees to be paid by the payer, allowing your club to collect 100% of registration fees without subscription deductions.',
      },
    ],
    sources: [
      { title: 'Stack Team App pricing & features', url: 'https://www.teamapp.com' },
      { title: 'Stack Team App support: Ad-free upgrade', url: 'https://support.teamapp.com' },
    ],
  },
  {
    slug: 'heja',
    alternativeSlug: 'heja-alternative',
    name: 'Heja',
    tagline: 'The free Heja alternative with a public club website, live scores & shop',
    summary: 'Heja is a private team chat app for coaches. itsfootball.club gives your club a free public website, live match centre, digital member passes and club shop.',
    aiOverview: 'itsfootball.club is a free, full-featured alternative to Heja for football clubs. While Heja is restricted to private team chat and attendance within a mobile app with banner ads on its free plan, itsfootball.club provides a complete public club website, live match centre for supporters, QR member passes, tournament manager, and club merch shop with zero fees and zero ads.',
    keyTakeaways: [
      'Full public website: Heja has no public web presence; itsfootball.club gives you a full club website with custom domain.',
      'Live match centre: fans and family follow live match action in browser without needing an app.',
      'No ads: Heja shows ads on its free plan; itsfootball.club is completely ad-free.',
      'Club shop & digital passes: sell merchandise, collect dues, and issue QR member cards from one platform.',
    ],
    rows: [
      { label: 'Price for the club', us: FREE, them: { mark: 'part', text: 'Free plan is ad-supported. Team Pro "from $8.33"', source: 0 } },
      { label: 'Ads', us: NO_ADS, them: { mark: 'part', text: 'Ads on Free. Pro removes them for admins, Pro Max for everyone', source: 1 } },
      { label: 'Public club website', us: WEBSITE, them: { mark: 'no', text: '"Teams can only be accessed by team members"', source: 0 } },
      { label: 'Live match centre', us: MATCH_CENTRE, them: { mark: 'info', text: 'Not listed on Heja\'s pricing or features pages', source: 1 } },
      { label: 'Fans need an app?', us: NO_APP, them: { mark: 'no', text: 'Teams are members-only in the app; desktop access is a Pro feature', source: 1 } },
      { label: 'Online payments', us: PAYMENTS, them: { mark: 'part', text: 'Pro: create and track fees, bank payouts in selected regions', source: 1 } },
      { label: 'Availability and RSVPs', us: { mark: 'yes', text: 'Included' }, them: { mark: 'yes', text: 'Included on Free', source: 0 } },
      { label: 'Digital member passes', us: PASSES, them: { mark: 'info', text: 'Not listed', source: 1 } },
      { label: 'Club shop', us: SHOP, them: { mark: 'info', text: 'Not listed', source: 1 } },
      { label: 'Tournament maker', us: TOURNAMENTS, them: { mark: 'info', text: 'Not listed', source: 1 } },
    ],
    featureHighlights: [
      {
        title: 'Whole Club Platform vs Team Chat App',
        description: 'Heja operates as a walled garden inside an app. itsfootball.club connects your teams, players, club committee, and supporters through a modern public club website.',
        comparison: 'Heja has no public club presence for supporters, sponsors, or prospective players.',
      },
      {
        title: 'Public Live Match Centre',
        description: 'Record goals, cards, and substitutions on your phone at the ground. Anyone can open the match link on their browser and follow the live score in real time.',
        comparison: 'Heja does not provide a live match broadcast centre for fans.',
      },
    ],
    theirStrengths: [
      'A polished team chat and feed for players and parents.',
      'Works for any sport and any team size.',
    ],
    faqs: [
      {
        q: 'How does itsfootball.club differ from Heja?',
        a: 'Heja is focused on private team chat inside an app. itsfootball.club gives your entire club a public website, live scores for fans, digital membership passes, tournaments, and a merch shop, completely free.',
      },
      {
        q: 'Can we still track player availability?',
        a: 'Yes. Players mark themselves available with one tap, and coaches can organize lineups on a visual pitch board.',
      },
    ],
    sources: [
      { title: 'Heja pricing', url: 'https://heja.io/pricing' },
      { title: 'Heja help: Team Pro and Pro Max features', url: 'https://help.heja.io/en/articles/4358964-team-pro-features' },
    ],
  },
  {
    slug: 'teamer',
    alternativeSlug: 'teamer-alternative',
    name: 'Teamer',
    tagline: 'The free alternative to Teamer after its closure',
    summary: 'Teamer closed on 5 October 2026. Switch to itsfootball.club for free to manage player availability, fixtures, digital member passes and a public club site.',
    aiOverview: 'For sports clubs looking for an alternative to Teamer following its closure on October 5, 2026, itsfootball.club provides a 100% free, drop-in replacement. Clubs can manage player availability, pitch lineups, schedule fixtures, and launch a complete public club website with live scores and online payments without any monthly fees.',
    keyTakeaways: [
      'Teamer closed October 5, 2026: itsfootball.club is actively maintained and 100% free.',
      'Manage availability, lineups, and schedules in one place.',
      'Bonus upgrade: get a full public club website, live scores, and digital member passes.',
    ],
    closed: { on: '5 October 2026', note: 'Its owner is pointing users to Pitchero, a paid product from the same group.' },
    rows: [
      { label: 'Still running?', us: { mark: 'yes', text: 'Yes' }, them: { mark: 'no', text: 'Closed 5 October 2026', source: 0 } },
      { label: 'Price for the club', us: FREE, them: { mark: 'info', text: 'Was free, with paid Team Premium (cancelled September 2026)', source: 0 } },
      { label: 'Availability and lineups', us: { mark: 'yes', text: 'Availability replies, lineups on a pitch' }, them: { mark: 'no', text: 'Gone with the closure', source: 0 } },
      { label: 'Club website', us: WEBSITE, them: { mark: 'info', text: '—' } },
      { label: 'Live match centre', us: MATCH_CENTRE, them: { mark: 'info', text: '—' } },
      { label: 'Fans need an app?', us: NO_APP, them: { mark: 'info', text: '—' } },
      { label: 'Digital member passes', us: PASSES, them: { mark: 'info', text: '—' } },
    ],
    featureHighlights: [
      {
        title: 'Seamless Migration from Teamer',
        description: 'Easily set up your club, add your squads, and invite your players. Your team will be up and running in minutes without paying for expensive alternatives.',
        comparison: 'Teamer shut down and directed users to paid Pitchero plans starting at £38/month.',
      },
    ],
    theirStrengths: [],
    faqs: [
      {
        q: 'Why did Teamer close down?',
        a: 'Teamer officially closed on October 5, 2026, with its parent company directing users toward Pitchero, a paid subscription product.',
      },
      {
        q: 'Is itsfootball.club a good replacement for Teamer?',
        a: 'Yes. itsfootball.club provides all of Teamer\'s core availability and scheduling features, plus a modern club website, live match centre, digital passes, and club shop at zero cost.',
      },
    ],
    sources: [
      { title: 'Teamer shutdown FAQs', url: 'https://help.teamer.net/knowledge/teamer-shutdown-faqs' },
    ],
  },
];

export const competitorBySlug = (slug: string) => COMPETITORS.find(c => c.slug === slug);

export const competitorBySlugOrAlternative = (slug: string): Competitor | undefined => {
  const clean = slug.toLowerCase().replace(/-alternative$/, '');
  return COMPETITORS.find(c => c.slug === clean || c.alternativeSlug === slug.toLowerCase());
};

/** Slugs for generating static params across both /compare/[slug] and /vs/[competitor] */
export const ALL_COMPARE_SLUGS = [
  ...COMPETITORS.map(c => c.alternativeSlug),
  ...COMPETITORS.map(c => c.slug),
];

/** The all-in-one table order on /compare and /vs */
export const COMPARE_ORDER = ['pitchero', 'spond', 'teamapp', 'heja', 'teamer'] as const;
export interface CompareRow { label: string; us: Cell; them: Record<(typeof COMPARE_ORDER)[number], Cell> }

const DASH: Cell = { mark: 'info', text: '—' };
const NOT_LISTED = (source: number): Cell => ({ mark: 'info', text: 'Not listed', source });

export const COMPARE_ROWS: CompareRow[] = [
  { label: 'Still running?', us: { mark: 'yes', text: 'Yes' }, them: {
    pitchero: { mark: 'yes', text: 'Yes' }, spond: { mark: 'yes', text: 'Yes' }, teamapp: { mark: 'yes', text: 'Yes' }, heja: { mark: 'yes', text: 'Yes' },
    teamer: { mark: 'no', text: 'Closed 5 Oct 2026', source: 0 } } },
  { label: 'Price for the club', us: FREE, them: {
    pitchero: { mark: 'part', text: 'Free for 1 team. £38 or £99/month', source: 0 },
    spond: { mark: 'yes', text: 'Free app', source: 0 },
    teamapp: { mark: 'part', text: 'Free with ads. Ad-Free $4.99–$9.99/mo per team', source: 0 },
    heja: { mark: 'part', text: 'Free with ads. Pro from $8.33', source: 0 },
    teamer: DASH } },
  { label: 'Ads', us: NO_ADS, them: {
    pitchero: { mark: 'part', text: 'On Free and Standard', source: 0 },
    spond: { mark: 'part', text: 'Brand partner ads in the app', source: 4 },
    teamapp: { mark: 'part', text: 'Banner ads and video popups on free plan', source: 0 },
    heja: { mark: 'part', text: 'On Free; Pro Max removes them', source: 1 },
    teamer: DASH } },
  { label: 'Public club website', us: WEBSITE, them: {
    pitchero: { mark: 'yes', text: 'Included', source: 0 },
    spond: { mark: 'part', text: 'Paid after free trial', source: 1 },
    teamapp: { mark: 'part', text: 'Basic mobile web view; custom tiers paid', source: 0 },
    heja: { mark: 'no', text: 'Members-only teams', source: 0 },
    teamer: DASH } },
  { label: 'Live match centre', us: MATCH_CENTRE, them: {
    pitchero: { mark: 'yes', text: 'Live scores via their app', source: 1 },
    spond: NOT_LISTED(1),
    teamapp: { mark: 'part', text: 'Scores in app; fans must download app', source: 1 },
    heja: NOT_LISTED(1),
    teamer: DASH } },
  { label: 'Fans need an app?', us: NO_APP, them: {
    pitchero: { mark: 'yes', text: 'No for scores', source: 1 },
    spond: { mark: 'part', text: 'Spond app or web', source: 0 },
    teamapp: { mark: 'no', text: 'Yes, heavily pushes app install', source: 1 },
    heja: { mark: 'no', text: 'Yes, members-only app', source: 1 },
    teamer: DASH } },
  { label: 'Online payments', us: PAYMENTS, them: {
    pitchero: { mark: 'part', text: 'Paid plans, from 1.67% + 15p', source: 0 },
    spond: { mark: 'yes', text: 'AUD 2.5% + $0.30, club pays by default', source: 2 },
    teamapp: { mark: 'part', text: 'Transaction fees (~2.9% - 3.9% + fee)', source: 0 },
    heja: { mark: 'part', text: 'Pro: track fees, payouts in some regions', source: 1 },
    teamer: DASH } },
  { label: 'Digital member passes', us: PASSES, them: {
    pitchero: NOT_LISTED(0),
    spond: NOT_LISTED(1),
    teamapp: { mark: 'info', text: 'In-app cards, no QR camera scanner', source: 1 },
    heja: NOT_LISTED(1),
    teamer: DASH } },
  { label: 'Club shop', us: SHOP, them: {
    pitchero: { mark: 'info', text: '"Sell all product types"', source: 0 },
    spond: { mark: 'info', text: 'Products in payment requests', source: 3 },
    teamapp: { mark: 'yes', text: 'Store module with transaction fees', source: 0 },
    heja: NOT_LISTED(1),
    teamer: DASH } },
  { label: 'Tournament maker', us: TOURNAMENTS, them: {
    pitchero: NOT_LISTED(0),
    spond: NOT_LISTED(1),
    teamapp: { mark: 'info', text: 'Basic schedule/ladder support', source: 1 },
    heja: NOT_LISTED(1),
    teamer: DASH } },
];
