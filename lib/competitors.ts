// Facts for the /compare/{competitor}-alternative pages (/vs/{competitor} redirects there).
// Every competitor cell cites a source from that competitor's own site (or its App Store / Capterra
// listing), checked on that competitor's `checkedOn`; re-check before changing a price or claim.
// Prose (overview, takeaways, highlights, FAQs) only repeats what the sourced rows say about them.
import { FEE_PHRASE } from './faq';

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
  /** How they do it, from the sourced rows; left out when there's nothing sourced to say */
  comparison?: string;
}

export interface Competitor {
  slug: string;
  alternativeSlug: string;
  name: string;
  tagline: string;
  /** One honest line under the page title */
  summary: string;
  /** A short, quotable answer for search and AI answers: facts only */
  aiOverview: string;
  keyTakeaways: string[];
  /** Set when the product no longer exists: the page becomes an "alternative to" page */
  closed?: { on: string; note: string };
  /** When their facts were last checked against the sources (ISO date) */
  checkedOn: string;
  /**
   * Facts not checked against their own pages yet: the page shows only our side, says so, and stays
   * out of search (noindex, not in the sitemap) until someone checks and fills in the rows.
   */
  unchecked?: boolean;
  rows: Row[];
  featureHighlights: FeatureHighlight[];
  /** Where they're stronger: keeps the page fair and believable */
  theirStrengths: string[];
  faqs: CompetitorFaq[];
  sources: Source[];
}

const FREE: Cell = { mark: 'yes', text: `Free for clubs, every feature. Card payers pay ${FEE_PHRASE}` };
const NO_ADS: Cell = { mark: 'yes', text: 'No third-party ads. Your club sponsors are shown instead' };
const TEAMS: Cell = { mark: 'yes', text: 'Unlimited teams' };
const WEBSITE: Cell = { mark: 'yes', text: 'Included, with your colours, crest and own domain' };
const PAYMENTS: Cell = { mark: 'yes', text: 'Included. Card payers add a booking fee, so the club gets its full price' };
const MATCH_CENTRE: Cell = { mark: 'yes', text: 'Live scores, lineups and events, run from any phone browser' };
const NO_APP: Cell = { mark: 'yes', text: 'No. Everything opens in the browser' };
const PASSES: Cell = { mark: 'yes', text: 'Digital member passes with QR check-in' };
const SHOP: Cell = { mark: 'yes', text: 'Included, fee shown before paying' };
const TOURNAMENTS: Cell = { mark: 'yes', text: 'Tournaments with group tables and knockout brackets' };

const NOT_LISTED = (source: number): Cell => ({ mark: 'info', text: 'Not listed', source });
const NOT_CHECKED: Cell = { mark: 'info', text: 'Not checked yet', source: 0 };

/** Our side of the table for a competitor whose facts haven't been checked */
const uncheckedRows = (): Row[] => [
  { label: 'Price for the club', us: FREE, them: NOT_CHECKED },
  { label: 'Ads', us: NO_ADS, them: NOT_CHECKED },
  { label: 'Public club website', us: WEBSITE, them: NOT_CHECKED },
  { label: 'Live match centre', us: MATCH_CENTRE, them: NOT_CHECKED },
  { label: 'Fans need an app?', us: NO_APP, them: NOT_CHECKED },
  { label: 'Online payments', us: PAYMENTS, them: NOT_CHECKED },
  { label: 'Digital member passes', us: PASSES, them: NOT_CHECKED },
  { label: 'Club shop', us: SHOP, them: NOT_CHECKED },
  { label: 'Tournament maker', us: TOURNAMENTS, them: NOT_CHECKED },
];

/** What itsfootball.club does, said once so every page says it the same way */
const OUR_FACTS = [
  `Free for clubs: no subscription and no paid plan. People paying by card pay ${FEE_PHRASE} on top, so the club gets its full price.`,
  'Supporters follow live scores, lineups and match events in a phone browser, with nothing to install.',
  'A public club website in the club’s colours and crest, with its own domain if it has one.',
  'Digital member passes with QR check-in, a club shop, and tournaments with group tables and knockouts.',
];

const OUR_FAQS: CompetitorFaq[] = [
  {
    q: 'Is itsfootball.club free?',
    a: `Yes, for clubs. There is no subscription and no paid plan. People paying online by card pay ${FEE_PHRASE} on top of the club’s price, so the club receives its full price.`,
  },
  {
    q: 'Do supporters need an app to follow live scores?',
    a: 'No. The club website and match centre open in any phone browser, and the site can be added to a phone’s home screen.',
  },
];

/** A page for a competitor whose facts haven't been checked yet: our side only, no claims about them */
function unchecked(c: { slug: string; name: string; website: string }): Competitor {
  return {
    slug: c.slug,
    alternativeSlug: `${c.slug}-alternative`,
    name: c.name,
    tagline: `itsfootball.club and ${c.name}`,
    summary: `What itsfootball.club offers football clubs. We haven’t checked ${c.name}’s current plans yet, so see their website for their prices and features.`,
    aiOverview: `itsfootball.club is a free platform for grassroots football (soccer) clubs: a public club website, a live match centre that supporters follow in the browser, digital member passes with QR check-in, a club shop and tournaments. Clubs pay nothing; card payers pay ${FEE_PHRASE}. For ${c.name}’s current plans and prices, see their own website.`,
    keyTakeaways: OUR_FACTS,
    checkedOn: '2026-10-22',
    unchecked: true,
    rows: uncheckedRows(),
    featureHighlights: [],
    theirStrengths: [],
    faqs: OUR_FAQS,
    sources: [{ title: `${c.name} website`, url: c.website }],
  };
}

export const COMPETITORS: Competitor[] = [
  {
    slug: 'pitchero',
    alternativeSlug: 'pitchero-alternative',
    name: 'Pitchero',
    tagline: 'A free Pitchero alternative for grassroots football clubs',
    summary: 'Both give your club a website and live scores. Pitchero charges £38 or £99 a month to drop the ads and add teams; itsfootball.club doesn’t charge the club at all.',
    aiOverview: `Pitchero and itsfootball.club both give a football club a website with live scores. Pitchero’s Free plan covers 1 team with third-party ads; Standard is £38 a month (up to 20 teams, limited ads) and Pro £99 a month (unlimited teams, no ads). itsfootball.club is free for clubs with unlimited teams and no third-party ads; card payers pay ${FEE_PHRASE}. Pitchero adds club email accounts and a native app on paid plans.`,
    keyTakeaways: [
      'Pitchero Standard is £38 a month (£456 a year) and Pro £99 a month (£1,188 a year). itsfootball.club has no subscription.',
      'Pitchero shows third-party ads on Free and limited ads on Standard. itsfootball.club shows only your club’s sponsors.',
      'Pitchero Free covers 1 team; Standard 20 (+£2.50 a month each after that). itsfootball.club has unlimited teams.',
      'On both, supporters can follow live scores on the website without an app.',
      'Pitchero has no online payments on Free. itsfootball.club takes card payments, with the fee paid by the payer.',
    ],
    checkedOn: '2026-10-22',
    rows: [
      { label: 'Price for the club', us: FREE, them: { mark: 'part', text: 'Free plan for 1 team. Standard £38/month, Pro £99/month', source: 0 } },
      { label: 'Ads on the club site', us: NO_ADS, them: { mark: 'part', text: 'Third-party ads on Free, limited on Standard, none on Pro', source: 0 } },
      { label: 'Teams', us: TEAMS, them: { mark: 'part', text: '1 on Free, 20 on Standard (+£2.50/month each), unlimited on Pro', source: 0 } },
      { label: 'Club website', us: WEBSITE, them: { mark: 'yes', text: 'Included. Custom domain on Standard and Pro', source: 0 } },
      { label: 'Online payments', us: PAYMENTS, them: { mark: 'part', text: 'Not on Free. From 2.42% + 17p (Standard) or 1.67% + 15p (Pro)', source: 0 } },
      { label: 'Live match centre', us: MATCH_CENTRE, them: { mark: 'yes', text: 'Live scores entered in the Pitchero Club app, shown on the website', source: 1 } },
      { label: 'Fans need an app?', us: NO_APP, them: { mark: 'yes', text: 'No for scores. The app adds push notifications', source: 1 } },
      { label: 'Digital member passes', us: PASSES, them: NOT_LISTED(0) },
      { label: 'Club shop', us: SHOP, them: { mark: 'info', text: '"Sell all product types" listed under payments', source: 0 } },
      { label: 'Tournament maker', us: TOURNAMENTS, them: NOT_LISTED(0) },
    ],
    featureHighlights: [
      {
        title: 'No subscription',
        description: 'Every feature is included for every club. The only charge is the booking fee a card payer sees before paying.',
        comparison: 'Pitchero Standard is £38 a month and Pro £99 a month.',
      },
      {
        title: 'Your sponsors, not ad networks',
        description: 'Sponsor spots on your site go to your club’s own sponsors, with click tracking for them.',
        comparison: 'Pitchero shows third-party ads on Free, limited ads on Standard and none on Pro.',
      },
      {
        title: 'Live scores in the browser',
        description: 'Record goals, cards and subs from a phone at the ground; supporters follow the match page live.',
        comparison: 'Pitchero scores are entered in its Club app and shown on the website.',
      },
    ],
    theirStrengths: [
      'A native app with push notifications for members.',
      'Club email accounts on paid plans (10 on Standard, 50 on Pro).',
      'Covers many sports, not just football.',
    ],
    faqs: [
      {
        q: 'How much does Pitchero cost compared with itsfootball.club?',
        a: `Pitchero is free for 1 team with third-party ads, £38 a month on Standard and £99 a month on Pro. itsfootball.club has no subscription for clubs; card payers pay ${FEE_PHRASE}.`,
      },
      {
        q: 'Can we use our own domain?',
        a: 'Yes. A club can connect its own domain from its branding settings. On Pitchero a custom domain comes with Standard and Pro.',
      },
      {
        q: 'Can we run several teams under one club?',
        a: 'Yes, as many as you like. Pitchero allows 1 team on Free and 20 on Standard (£2.50 a month for each extra), and unlimited on Pro.',
      },
      ...OUR_FAQS.slice(1),
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
    tagline: 'A free Spond alternative with a public club website and live scores',
    summary: 'Spond is free for team admin too. The difference: its club website is a paid subscription after a free trial, and fans follow along in the browser here without an app.',
    aiOverview: `Spond’s app is free for teams and members, with brand partner content in the app. Its club website costs A$22 a month after a free trial (12 months in Australia), and Spond card payments cost AUD 2.5% + $0.30, charged to the club by default. itsfootball.club is free for clubs, website included; card payers pay ${FEE_PHRASE}. Supporters follow live scores in the browser.`,
    keyTakeaways: [
      'Spond’s club website is A$22 a month after the free trial. On itsfootball.club the website is included.',
      'Spond card payments cost AUD 2.5% + $0.30, charged to the club by default. Here the payer pays the booking fee.',
      'Supporters follow live scores, lineups and events in the browser on itsfootball.club. A live match centre isn’t listed on Spond’s club website pages.',
      'Both handle availability and events.',
    ],
    checkedOn: '2026-10-22',
    rows: [
      { label: 'Price for the club', us: FREE, them: { mark: 'yes', text: 'App free to download and use', source: 0 } },
      { label: 'Ads', us: NO_ADS, them: { mark: 'part', text: 'Brand partner ads and sponsored content in the app', source: 4 } },
      { label: 'Club website', us: WEBSITE, them: { mark: 'part', text: 'A$22/month after a free trial (12 months in Australia)', source: 5 } },
      { label: 'Card fees on payments', us: PAYMENTS, them: { mark: 'info', text: 'AUD 2.5% + $0.30, GBP 2.5% + £0.20. Club pays by default', source: 2 } },
      { label: 'Live match centre', us: MATCH_CENTRE, them: { mark: 'info', text: 'Not listed on Spond\'s club website pages', source: 1 } },
      { label: 'Fans need an app?', us: NO_APP, them: { mark: 'part', text: 'Members use the Spond app or its web version', source: 0 } },
      { label: 'Availability and events', us: { mark: 'yes', text: 'Included' }, them: { mark: 'yes', text: 'Included', source: 0 } },
      { label: 'Digital member passes', us: PASSES, them: NOT_LISTED(1) },
      { label: 'Club shop', us: SHOP, them: { mark: 'info', text: 'Payment requests can list products, each with its own fee', source: 3 } },
      { label: 'Tournament maker', us: TOURNAMENTS, them: NOT_LISTED(1) },
    ],
    featureHighlights: [
      {
        title: 'Website included',
        description: 'Every club gets a public website with fixtures, results, squad, news and sponsors, in its own colours.',
        comparison: 'Spond’s club website is A$22 a month after the free trial.',
      },
      {
        title: 'The payer pays the card fee',
        description: 'A $200 registration reaches the club as $200; the payer sees the booking fee before paying.',
        comparison: 'Spond charges the club AUD 2.5% + $0.30 per card payment by default.',
      },
      {
        title: 'Live scores for everyone',
        description: 'Grandparents and away fans follow the match page in a browser without signing up.',
      },
    ],
    theirStrengths: [
      'Very large user base, so many parents already have the app.',
      'Strong event and attendance tools across many sports.',
    ],
    faqs: [
      {
        q: 'Does itsfootball.club charge for the club website like Spond?',
        a: 'No. The website, colours, crest and your own domain are included for every club. Spond’s club website is A$22 a month after the free trial.',
      },
      {
        q: 'Can players still mark their availability?',
        a: 'Yes. Players answer In, Maybe or Out from a link or the club app, and coaches pick the lineup on a pitch.',
      },
      ...OUR_FAQS,
    ],
    sources: [
      { title: 'Spond help: Spond is free to download and use', url: 'https://help.spond.com/en/articles/25998-spond-is-free-to-download-and-use' },
      { title: 'Spond help: Set up your club website', url: 'https://help.spond.com/club/en/articles/148773-set-up-your-club-website' },
      { title: 'Spond help: Transaction fees in Spond Club', url: 'https://help.spond.com/club/en/articles/58192-what-is-the-transaction-fee-in-spond-club' },
      { title: 'Spond help: Payment costs in the Spond app', url: 'https://help.spond.com/app/en/articles/118091-payments-costs-in-the-spond-app' },
      { title: 'Spond: Brand partnerships', url: 'https://www.spond.com/news-and-blog/spond-brand-partnerships/' },
      { title: 'Spond club website', url: 'https://www.spond.com/club-website/' },
    ],
  },
  {
    slug: 'teamapp',
    alternativeSlug: 'teamapp-alternative',
    name: 'Stack Team App',
    tagline: 'A Stack Team App alternative without ads, built for football',
    summary: 'Team App is free and funded by ads in its app. itsfootball.club is free for clubs too, with no third-party ads and live scores in the browser instead of an app.',
    aiOverview: `Stack Team App is free for clubs to create and use, funded by mobile ads; a member can remove the ads for AUD $4.49 a year, and a club can remove them for all members (price not published). It includes a free website and live scores, and works for many sports. itsfootball.club is free for clubs with no third-party ads, built only for football, and supporters follow live scores in the browser. Card payers pay ${FEE_PHRASE}.`,
    keyTakeaways: [
      'Both are free for clubs. Team App is funded by ads; itsfootball.club shows no third-party ads.',
      'Team App members can pay AUD $4.49 a year to remove ads. There is nothing to pay to remove ads here.',
      'Team App works for many sports. itsfootball.club is built only for football: lineups on a pitch, rolling subs, tournaments.',
      'Supporters follow live scores in the browser here, with nothing to install.',
    ],
    checkedOn: '2026-10-22',
    rows: [
      { label: 'Price for the club', us: FREE, them: { mark: 'yes', text: '"Completely free to create and use", no setup fees', source: 0 } },
      { label: 'Ads', us: NO_ADS, them: { mark: 'part', text: 'Funded by mobile ads. Members can remove them for AUD $4.49/year; clubs can remove them for everyone (price not published)', source: 2 } },
      { label: 'Public club website', us: WEBSITE, them: { mark: 'yes', text: 'Free website that updates with the app', source: 2 } },
      { label: 'Live match centre', us: MATCH_CENTRE, them: { mark: 'yes', text: 'Ladders, schedules, results and live scores', source: 2 } },
      { label: 'Online payments', us: PAYMENTS, them: { mark: 'info', text: 'Store payments carry transaction fees; the rate isn’t on the support page', source: 0 } },
      { label: 'Own sponsors instead of ads', us: { mark: 'yes', text: 'Sponsor spots with click tracking' }, them: { mark: 'yes', text: 'Clubs can replace ads with their own sponsor banners', source: 1 } },
      { label: 'Digital member passes', us: PASSES, them: NOT_LISTED(2) },
      { label: 'Tournament maker', us: TOURNAMENTS, them: NOT_LISTED(2) },
    ],
    featureHighlights: [
      {
        title: 'No ads to pay to remove',
        description: 'There are no third-party ads, so members never see them and nobody pays to hide them.',
        comparison: 'Team App is funded by ads; members can remove them for AUD $4.49 a year.',
      },
      {
        title: 'Built for football',
        description: 'Lineups on a pitch, availability, rolling subs, live match events and tournaments with knockouts.',
        comparison: 'Team App covers many sports.',
      },
      {
        title: 'Digital member passes',
        description: 'Members show a QR pass on their phone; volunteers check it with any phone camera at the gate.',
      },
    ],
    theirStrengths: [
      'Works for many sports, not just football.',
      'Many Australian members already have the app installed.',
      'Clubs can replace the ads with their own sponsor banners.',
    ],
    faqs: [
      {
        q: 'Is Team App free?',
        a: 'Yes, Team App says it is completely free to create and use. It is funded by ads, which a member can remove for AUD $4.49 a year. itsfootball.club is free for clubs and shows no third-party ads.',
      },
      ...OUR_FAQS,
    ],
    sources: [
      { title: 'Team App Support: Cost of Team App', url: 'https://support.teamapp.com/en/knowledgebase/5-general-faqs/docs/97-cost-of-team-app' },
      { title: 'Team App Support: Advertising information', url: 'https://support.teamapp.com/en/knowledgebase/5-general-faqs/docs/3-advertising-information' },
      { title: 'Stack Team App on the App Store', url: 'https://apps.apple.com/us/app/team-app-your-team-your-app/id625607532' },
    ],
  },
  {
    slug: 'heja',
    alternativeSlug: 'heja-alternative',
    name: 'Heja',
    tagline: 'A free Heja alternative with a public club website and live scores',
    summary: 'Heja is a private team chat and schedule app for coaches and parents. itsfootball.club is the whole club online: a public site, live match centre, payments and shop.',
    aiOverview: `Heja is a team app for coaches and parents: its free plan is ad-supported, Team Pro starts “from $8.33”, and teams can only be accessed by team members. itsfootball.club gives a football club a public website, a live match centre in the browser, member passes, a shop and tournaments, free for clubs; card payers pay ${FEE_PHRASE}.`,
    keyTakeaways: [
      'Heja teams can only be accessed by team members. itsfootball.club gives the club a public website.',
      'Heja’s free plan has ads; Pro removes them for admins and Pro Max for everyone. There are no third-party ads here.',
      'Both handle availability and RSVPs.',
      'A live match centre isn’t listed on Heja’s pricing or features pages. Here supporters follow scores in the browser.',
    ],
    checkedOn: '2026-10-14',
    rows: [
      { label: 'Price for the club', us: FREE, them: { mark: 'part', text: 'Free plan is ad-supported. Team Pro "from $8.33"', source: 0 } },
      { label: 'Ads', us: NO_ADS, them: { mark: 'part', text: 'Ads on Free. Pro removes them for admins, Pro Max for everyone', source: 1 } },
      { label: 'Public club website', us: WEBSITE, them: { mark: 'no', text: '"Teams can only be accessed by team members"', source: 0 } },
      { label: 'Live match centre', us: MATCH_CENTRE, them: { mark: 'info', text: 'Not listed on Heja\'s pricing or features pages', source: 1 } },
      { label: 'Fans need an app?', us: NO_APP, them: { mark: 'no', text: 'Teams are members-only in the app; desktop access is a Pro feature', source: 1 } },
      { label: 'Online payments', us: PAYMENTS, them: { mark: 'part', text: 'Pro: create and track fees, bank payouts in selected regions', source: 1 } },
      { label: 'Availability and RSVPs', us: { mark: 'yes', text: 'Included' }, them: { mark: 'yes', text: 'Included on Free', source: 0 } },
      { label: 'Digital member passes', us: PASSES, them: NOT_LISTED(1) },
      { label: 'Club shop', us: SHOP, them: NOT_LISTED(1) },
      { label: 'Tournament maker', us: TOURNAMENTS, them: NOT_LISTED(1) },
    ],
    featureHighlights: [
      {
        title: 'A public home for the club',
        description: 'Fixtures, results, squad, news and sponsors on a website anyone can open, for new players, parents and sponsors.',
        comparison: 'Heja teams can only be accessed by team members.',
      },
      {
        title: 'Live scores for supporters',
        description: 'Record goals, cards and subs at the ground; anyone with the link follows the match live in a browser.',
      },
    ],
    theirStrengths: [
      'A polished team chat and feed for players and parents.',
      'Works for any sport and any team size.',
    ],
    faqs: [
      {
        q: 'How is itsfootball.club different from Heja?',
        a: 'Heja is a team app whose teams are members-only. itsfootball.club gives the whole club a public website, live scores supporters can follow in a browser, member passes, a shop and tournaments.',
      },
      {
        q: 'Can we still track player availability?',
        a: 'Yes. Players answer In, Maybe or Out, and coaches pick the lineup on a pitch.',
      },
      ...OUR_FAQS.slice(0, 1),
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
    tagline: 'A free alternative to Teamer after its closure',
    summary: 'Teamer closed on 5 October 2026. If your team used it for availability and match days, you can move to itsfootball.club for free and get a full club site too.',
    aiOverview: `Teamer closed on 5 October 2026, and its owner is pointing users to Pitchero, a paid product from the same group. itsfootball.club covers availability and lineups, and adds a public club website, live scores in the browser and member passes. It is free for clubs; card payers pay ${FEE_PHRASE}.`,
    keyTakeaways: [
      'Teamer closed on 5 October 2026.',
      'Availability replies and lineups on a pitch are included here.',
      'Your club also gets a public website, live scores and digital member passes.',
    ],
    closed: { on: '5 October 2026', note: 'Its owner is pointing users to Pitchero, a paid product from the same group.' },
    checkedOn: '2026-10-14',
    rows: [
      { label: 'Still running?', us: { mark: 'yes', text: 'Yes' }, them: { mark: 'no', text: 'Closed 5 October 2026', source: 0 } },
      { label: 'Price for the club', us: FREE, them: { mark: 'info', text: 'Was free, with paid Team Premium (cancelled September 2026)', source: 0 } },
      { label: 'Availability and lineups', us: { mark: 'yes', text: 'Availability replies, lineups on a pitch' }, them: { mark: 'no', text: 'Gone with the closure', source: 0 } },
      { label: 'Club website', us: WEBSITE, them: { mark: 'info', text: '—' } },
      { label: 'Live match centre', us: MATCH_CENTRE, them: { mark: 'info', text: '—' } },
      { label: 'Fans need an app?', us: NO_APP, them: { mark: 'info', text: '—' } },
    ],
    featureHighlights: [
      {
        title: 'Moving over',
        description: 'Create your club with an email address, import the squad in bulk and share one link with players.',
      },
    ],
    theirStrengths: [],
    faqs: [
      {
        q: 'When did Teamer close?',
        a: 'Teamer closed on 5 October 2026. Its owner is pointing users to Pitchero, a paid product from the same group.',
      },
      {
        q: 'Can itsfootball.club replace Teamer?',
        a: 'For availability and lineups, yes: players reply In, Maybe or Out and coaches pick the team on a pitch. The club also gets a public website, live scores and member passes.',
      },
      ...OUR_FAQS.slice(0, 1),
    ],
    sources: [
      { title: 'Teamer shutdown FAQs', url: 'https://help.teamer.net/knowledge/teamer-shutdown-faqs' },
    ],
  },
  {
    slug: 'playpass',
    alternativeSlug: 'playpass-alternative',
    name: 'Playpass',
    tagline: 'A free Playpass alternative for football clubs',
    summary: 'Playpass is built for registrations, scheduling and standings, with a 1–3% platform fee on payments. itsfootball.club is free for clubs, with a website, live match centre and passes.',
    aiOverview: `Playpass has a free plan with a 3% platform fee on payments, and paid plans at $9, $19 and $99 a month that lower the fee to 2.5%, 2% and 1% (50% off for non-profits). Scoring and standings are on every plan, and a custom domain is a $99 a year add-on on paid plans. itsfootball.club is free for clubs, built for football, with the card fee (${FEE_PHRASE}) paid by the payer.`,
    keyTakeaways: [
      'Playpass charges a 1–3% platform fee on payments, depending on the plan. Here the payer pays the booking fee.',
      'Playpass paid plans are $9, $19 or $99 a month; non-profits get 50% off. There is no paid plan here.',
      'A custom domain is a $99 a year add-on on Playpass paid plans. Here a club connects its own domain at no cost.',
      'Both include scoring and standings. itsfootball.club adds a live match centre with lineups and events.',
    ],
    checkedOn: '2026-10-22',
    rows: [
      { label: 'Price for the club', us: FREE, them: { mark: 'part', text: 'Free (3% platform fee), Plus $9, Pro $19, Max $99 a month (fee 2.5%, 2%, 1%). 50% off for non-profits', source: 0 } },
      { label: 'Ads', us: NO_ADS, them: { mark: 'info', text: 'Not mentioned on the pricing page', source: 0 } },
      { label: 'Public club website', us: WEBSITE, them: { mark: 'part', text: '1 custom page on Free, 3 on Plus, 10 on Pro, unlimited on Max', source: 0 } },
      { label: 'Own domain', us: { mark: 'yes', text: 'Included' }, them: { mark: 'part', text: '$99 a year add-on on paid plans', source: 0 } },
      { label: 'Scores and standings', us: MATCH_CENTRE, them: { mark: 'yes', text: 'Online scoring and standings on every plan', source: 0 } },
      { label: 'Online payments', us: PAYMENTS, them: { mark: 'part', text: 'Platform fee of 1–3% depending on the plan', source: 0 } },
      { label: 'Digital member passes', us: PASSES, them: NOT_LISTED(0) },
    ],
    featureHighlights: [
      {
        title: 'No platform fee for the club',
        description: 'The club receives its full price; the payer sees the booking fee before paying.',
        comparison: 'Playpass takes a 3% platform fee on Free, down to 1% on its $99 a month plan.',
      },
      {
        title: 'Built for football matchdays',
        description: 'Lineups on a pitch, availability, live goals, cards and subs, and member passes at the gate.',
      },
    ],
    theirStrengths: [
      'Scoring and standings are included even on the free plan.',
      'Discount for non-profit organisations.',
      'Works for many sports and social leagues.',
    ],
    faqs: [
      {
        q: 'How do Playpass fees compare?',
        a: `Playpass takes a platform fee of 3% on its free plan and 2.5%, 2% or 1% on its $9, $19 and $99 a month plans. itsfootball.club has no plan to pay for; card payers pay ${FEE_PHRASE}.`,
      },
      ...OUR_FAQS.slice(1),
    ],
    sources: [
      { title: 'Playpass pricing', url: 'https://playpass.com/pricing' },
    ],
  },
  {
    slug: 'clubhelix',
    alternativeSlug: 'clubhelix-alternative',
    name: 'ClubHelix',
    tagline: 'A free ClubHelix alternative for grassroots football clubs',
    summary: 'ClubHelix combines members, payments, events, competitions and a website builder, with paid plan prices on request. itsfootball.club is free for clubs and built for football.',
    aiOverview: `ClubHelix is a club and association system with members, payments, events, competitions and a website builder. Its Capterra listing shows a free version and a free trial, with paid plans billed every 4 weeks and prices not published. itsfootball.club is free for clubs, built for football, with a live match centre in the browser and member passes; card payers pay ${FEE_PHRASE}.`,
    keyTakeaways: [
      'ClubHelix paid plan prices aren’t published on its Capterra listing. itsfootball.club has no paid plan.',
      'Both include a club website with your own domain.',
      'ClubHelix lists fixtures, results and ladders; live scores aren’t mentioned. Here supporters follow live scores in the browser.',
    ],
    checkedOn: '2026-10-22',
    rows: [
      { label: 'Price for the club', us: FREE, them: { mark: 'info', text: 'Free version and free trial; paid plans billed every 4 weeks, prices not published', source: 0 } },
      { label: 'Public club website', us: WEBSITE, them: { mark: 'yes', text: 'Website builder included, own domain', source: 0 } },
      { label: 'Live match centre', us: MATCH_CENTRE, them: { mark: 'info', text: 'Fixtures, results and ladders; live scores not mentioned', source: 0 } },
      { label: 'Competitions', us: TOURNAMENTS, them: { mark: 'yes', text: 'Competitions built in, for clubs and governing bodies', source: 0 } },
      { label: 'Digital member passes', us: PASSES, them: NOT_LISTED(0) },
    ],
    featureHighlights: [
      {
        title: 'Live scores for supporters',
        description: 'Record goals, cards and subs at the ground; anyone with the link follows the match in a browser.',
      },
    ],
    theirStrengths: [
      'Aimed at clubs and governing bodies, with competitions built in.',
      'Works for many sports.',
    ],
    faqs: [
      {
        q: 'How much does ClubHelix cost?',
        a: 'Its Capterra listing shows a free version and a free trial, with paid plans billed every 4 weeks; prices aren’t published there, so ask ClubHelix for a quote. itsfootball.club has no paid plan.',
      },
      ...OUR_FAQS.slice(1),
    ],
    sources: [
      { title: 'ClubHelix on Capterra Australia', url: 'https://www.capterra.com.au/software/1111404/ClubHelix' },
    ],
  },
  {
    slug: 'teamsnap',
    alternativeSlug: 'teamsnap-alternative',
    name: 'TeamSnap',
    tagline: 'A free TeamSnap alternative for grassroots football clubs',
    summary: 'TeamSnap is free to start for a single team, with custom pricing for clubs and leagues. itsfootball.club is free for clubs, with a website, live match centre and passes.',
    aiOverview: `TeamSnap is $0 to start for a single team, and clubs and leagues get custom pricing from its sales team. TeamSnap ONE covers club websites, registration with payments, a team app and tournaments with brackets and live scoring. itsfootball.club is free for clubs, built for football, with the card fee (${FEE_PHRASE}) paid by the payer.`,
    keyTakeaways: [
      'TeamSnap is $0 to start for one team; clubs and leagues get a custom quote. itsfootball.club has no paid plan.',
      'TeamSnap lists club websites as an add-on. Here every club gets a website with its colours and crest.',
      'Both do tournaments. itsfootball.club adds a live match centre that supporters open in the browser.',
    ],
    checkedOn: '2026-10-22',
    rows: [
      { label: 'Price for the club', us: FREE, them: { mark: 'info', text: '$0 to start for a single team; custom pricing for clubs and leagues', source: 0 } },
      { label: 'Ads', us: NO_ADS, them: { mark: 'info', text: 'Not mentioned on the pricing page', source: 0 } },
      { label: 'Public club website', us: WEBSITE, them: { mark: 'part', text: 'Club websites, listed as an add-on with custom pricing', source: 2 } },
      { label: 'Live match centre', us: MATCH_CENTRE, them: { mark: 'info', text: 'Live scoring for tournaments, plus built-in live streaming', source: 1 } },
      { label: 'Online payments', us: PAYMENTS, them: { mark: 'yes', text: 'Registration with integrated payments; rates on request', source: 1 } },
      { label: 'Tournament maker', us: TOURNAMENTS, them: { mark: 'yes', text: 'Brackets, live scoring and automated updates', source: 1 } },
      { label: 'Digital member passes', us: PASSES, them: NOT_LISTED(1) },
    ],
    featureHighlights: [
      {
        title: 'One price for every club: free',
        description: 'No quote, no sales call and no add-ons. Every club gets the website, match centre, passes and shop.',
        comparison: 'TeamSnap prices clubs and leagues individually, and lists websites as an add-on.',
      },
      {
        title: 'Live scores without an app',
        description: 'Record goals, cards and subs at the ground; anyone with the link follows the match in a browser.',
      },
    ],
    theirStrengths: [
      'Built-in live streaming.',
      'Registration and payments built for large clubs and leagues.',
      'Works for many sports.',
    ],
    faqs: [
      {
        q: 'How much does TeamSnap cost?',
        a: 'TeamSnap is $0 to start for a single team. Clubs and leagues get customised pricing, so ask TeamSnap for a quote. itsfootball.club has no paid plan.',
      },
      ...OUR_FAQS.slice(1),
    ],
    sources: [
      { title: 'TeamSnap pricing', url: 'https://www.teamsnap.com/pricing' },
      { title: 'TeamSnap ONE for clubs and leagues', url: 'https://www.teamsnap.com/one' },
      { title: 'TeamSnap payments', url: 'https://www.teamsnap.com/for-business/features/payments' },
    ],
  },
  {
    slug: 'sportsengine',
    alternativeSlug: 'sportsengine-alternative',
    name: 'SportsEngine',
    tagline: 'A free SportsEngine alternative for grassroots football clubs',
    summary: 'SportsEngine HQ costs $67 a month billed yearly, with a 3.25% + $1.50 processing rate. itsfootball.club is free for clubs, with a website, live match centre and passes.',
    aiOverview: `SportsEngine HQ is $67 a month billed yearly or $79 billed monthly, and includes a website, registration and payments and a team mobile app, with a processing rate of 3.25% + $1.50. SportsEngine Play, for live streaming, is $1,500 a year. itsfootball.club is free for clubs, built for football, with the card fee (${FEE_PHRASE}) paid by the payer.`,
    keyTakeaways: [
      'SportsEngine HQ is $67 a month billed yearly ($79 monthly). itsfootball.club has no paid plan.',
      'SportsEngine HQ processing is 3.25% + $1.50 a payment. Here the payer pays the booking fee and the club gets its full price.',
      'SportsEngine streams games through its Play product. itsfootball.club has a live match centre with lineups and events.',
    ],
    checkedOn: '2026-10-22',
    rows: [
      { label: 'Price for the club', us: FREE, them: { mark: 'part', text: 'HQ $67 a month billed yearly, or $79 billed monthly', source: 0 } },
      { label: 'Public club website', us: WEBSITE, them: { mark: 'yes', text: 'Website included in HQ', source: 0 } },
      { label: 'Online payments', us: PAYMENTS, them: { mark: 'part', text: 'HQ processing rate 3.25% + $1.50', source: 0 } },
      { label: 'Live match centre', us: MATCH_CENTRE, them: { mark: 'info', text: 'Game streaming with Play ($1,500 a year); live scores not listed', source: 0 } },
      { label: 'Team app', us: { mark: 'yes', text: 'Runs in the browser and can be added to the home screen' }, them: { mark: 'yes', text: 'Team mobile app in HQ', source: 0 } },
      { label: 'Digital member passes', us: PASSES, them: NOT_LISTED(0) },
    ],
    featureHighlights: [
      {
        title: 'No monthly plan',
        description: 'The club pays nothing; people paying by card see the booking fee before they pay.',
        comparison: 'SportsEngine HQ is $67 a month billed yearly, plus 3.25% + $1.50 a payment.',
      },
      {
        title: 'Built for football matchdays',
        description: 'Lineups on a pitch, availability, live goals, cards and subs, and member passes at the gate.',
      },
    ],
    theirStrengths: [
      'Live game streaming with its Play product.',
      'Registration and payments for large organisations.',
      'Works for many sports.',
    ],
    faqs: [
      {
        q: 'How much does SportsEngine cost?',
        a: `SportsEngine HQ is $67 a month billed yearly or $79 billed monthly, with a processing rate of 3.25% + $1.50. itsfootball.club has no plan to pay for; card payers pay ${FEE_PHRASE}.`,
      },
      ...OUR_FAQS.slice(1),
    ],
    sources: [
      { title: 'SportsEngine pricing', url: 'https://www.sportsengine.com/pricing/' },
    ],
  },
  {
    slug: 'sporteasy',
    alternativeSlug: 'sporteasy-alternative',
    name: 'SportEasy',
    tagline: 'A free SportEasy alternative for grassroots football clubs',
    summary: 'SportEasy is free for a team of up to 30 members, with ads; Premium is €9.99 a month and clubs pay per member. itsfootball.club is free for clubs.',
    aiOverview: `SportEasy's free Basic team plan is limited to 30 members and shows ad banners; Premium is €9.99 a month or €119.88 a year and removes them. Club plans are €5.40 (Classic) or €5.76 (Sponsors) per member a year after a one-month free trial. itsfootball.club is free for clubs of any size, with no third-party ads; card payers pay ${FEE_PHRASE}.`,
    keyTakeaways: [
      'SportEasy charges clubs per member: €5.40 or €5.76 a member a year. itsfootball.club has no paid plan.',
      'The free SportEasy team plan stops at 30 members and shows ad banners. Here there is no member limit and no third-party ads.',
      'Both collect fees online. Here the payer pays the booking fee, so the club gets its full price.',
    ],
    checkedOn: '2026-10-22',
    rows: [
      { label: 'Price for a team', us: FREE, them: { mark: 'part', text: 'Basic free up to 30 members; Premium €9.99 a month or €119.88 a year', source: 0 } },
      { label: 'Price for a club', us: FREE, them: { mark: 'part', text: 'Classic €5.40 or Sponsors €5.76 per member a year, after a one-month free trial', source: 1 } },
      { label: 'Ads', us: NO_ADS, them: { mark: 'part', text: 'Ad banners, removed with Premium or a club plan', source: 0 } },
      { label: 'Public club website', us: WEBSITE, them: { mark: 'info', text: 'Website and apps listed as a team feature; plan not shown clearly', source: 0 } },
      { label: 'Online payments', us: PAYMENTS, them: { mark: 'info', text: 'Fee collection listed; plan not shown clearly', source: 0 } },
      { label: 'Digital member passes', us: PASSES, them: NOT_LISTED(1) },
    ],
    featureHighlights: [
      {
        title: 'No per-member price',
        description: 'A club with 50 members and a club with 500 both pay nothing.',
        comparison: 'SportEasy club plans are €5.40 or €5.76 per member a year.',
      },
      {
        title: 'No third-party ads',
        description: 'Your club’s own sponsors are shown instead.',
        comparison: 'The free SportEasy plan shows ad banners until a team or club pays.',
      },
    ],
    theirStrengths: [
      'Phone apps for iPhone and Android.',
      'Team statistics, including live stats.',
      'Works for many sports.',
    ],
    faqs: [
      {
        q: 'How much does SportEasy cost?',
        a: 'A SportEasy team is free up to 30 members with ad banners, or €9.99 a month for Premium. Club plans are €5.40 or €5.76 per member a year. itsfootball.club has no paid plan.',
      },
      ...OUR_FAQS.slice(1),
    ],
    sources: [
      { title: 'SportEasy team plans', url: 'https://www.sporteasy.net/en/teams/team-offers/' },
      { title: 'SportEasy club plans', url: 'https://www.sporteasy.net/en/clubs/plans/' },
    ],
  },
  {
    slug: 'teamo',
    alternativeSlug: 'teamo-alternative',
    name: 'Teamo',
    tagline: 'A free Teamo alternative for grassroots football clubs',
    summary: 'Teamo is free up to 50 members, then £9.99 to £54.99 a month by club size, with a club website from Silver up. itsfootball.club is free for clubs of any size.',
    aiOverview: `Teamo is free for clubs of up to 50 members, then £9.99 to £54.99 a month depending on member count, with unlimited teams on every tier. A club website comes with Silver (£21.99 a month) and up, and in-app payments cost from 2% + 20p, taken from the club's amount. itsfootball.club is free for clubs of any size; card payers pay ${FEE_PHRASE}, so the club gets its full price.`,
    keyTakeaways: [
      'Teamo is free up to 50 members, then £9.99 to £54.99 a month. itsfootball.club has no paid plan at any size.',
      'Teamo includes a club website from Silver (£21.99 a month). Here every club gets one.',
      'Teamo payment fees (from 2% + 20p) come out of the club’s amount. Here the payer pays the booking fee.',
      'Both include unlimited teams.',
    ],
    checkedOn: '2026-10-22',
    rows: [
      { label: 'Price for the club', us: FREE, them: { mark: 'part', text: 'Free up to 50 members; £9.99 to £54.99 a month above that', source: 0 } },
      { label: 'Teams', us: TEAMS, them: { mark: 'yes', text: 'Unlimited teams on every tier', source: 0 } },
      { label: 'Ads', us: NO_ADS, them: { mark: 'info', text: 'Not mentioned on the pricing page', source: 0 } },
      { label: 'Public club website', us: WEBSITE, them: { mark: 'part', text: 'From Silver (£21.99 a month) up', source: 0 } },
      { label: 'Online payments', us: PAYMENTS, them: { mark: 'part', text: 'From 2% + 20p, taken from the club’s amount', source: 0 } },
      { label: 'Live match centre', us: MATCH_CENTRE, them: { mark: 'info', text: 'Not mentioned on the pricing page', source: 0 } },
      { label: 'Digital member passes', us: PASSES, them: NOT_LISTED(0) },
    ],
    featureHighlights: [
      {
        title: 'Free at any size',
        description: 'The price doesn’t go up as the club grows.',
        comparison: 'Teamo moves a club to a paid tier once it passes 50 members.',
      },
      {
        title: 'The club gets its full price',
        description: 'People paying by card pay the booking fee on top, so a £30 sub pays the club £30.',
        comparison: 'Teamo’s example: a £30 payment leaves the club £29.20.',
      },
    ],
    theirStrengths: [
      'Free tier includes chat, availability, selection, events and club email.',
      'Unlimited teams on every tier.',
    ],
    faqs: [
      {
        q: 'How much does Teamo cost?',
        a: 'Teamo is free up to 50 members, then £9.99 to £54.99 a month depending on member count. In-app payments cost from 2% + 20p. itsfootball.club has no paid plan.',
      },
      ...OUR_FAQS.slice(1),
    ],
    sources: [
      { title: 'Teamo pricing', url: 'https://teamo.chat/tweb/pricing/' },
    ],
  },
  {
    slug: 'plai',
    alternativeSlug: 'plai-alternative',
    name: 'PLAI',
    tagline: 'A free PLAI alternative for grassroots football clubs',
    summary: 'PLAI has no subscription and earns from fees on payments; its app lists advertising. itsfootball.club is free for clubs, with no third-party ads and a live match centre.',
    aiOverview: `PLAI is a sports club app with no subscription: it earns from fees on payments the club takes, and includes a free club website. Its App Store listing says the app contains advertising, and a live score can be added to an event. itsfootball.club is also free for clubs, with no third-party ads, a live match centre with lineups and events, and member passes; card payers pay ${FEE_PHRASE}.`,
    keyTakeaways: [
      'Both have no subscription for the club.',
      'PLAI’s App Store listing says it contains advertising. itsfootball.club shows no third-party ads.',
      'PLAI lets you add a live score to an event. itsfootball.club has a full match centre: lineups, goals, cards and subs.',
    ],
    checkedOn: '2026-10-22',
    rows: [
      { label: 'Price for the club', us: FREE, them: { mark: 'yes', text: 'No subscription; earns only when the club takes a payment', source: 0 } },
      { label: 'Ads', us: NO_ADS, them: { mark: 'part', text: 'App Store listing says the app contains advertising', source: 1 } },
      { label: 'Public club website', us: WEBSITE, them: { mark: 'yes', text: 'Free club website', source: 0 } },
      { label: 'Live match centre', us: MATCH_CENTRE, them: { mark: 'part', text: 'A live score can be added to an event', source: 1 } },
      { label: 'Online payments', us: PAYMENTS, them: { mark: 'info', text: 'Fees on payments; rate not shown on the home page', source: 0 } },
      { label: 'Digital member passes', us: PASSES, them: NOT_LISTED(0) },
    ],
    featureHighlights: [
      {
        title: 'A full match centre',
        description: 'Lineups on a pitch, live goals, cards and subs, followed in the browser.',
        comparison: 'PLAI lets you add a live score to an event.',
      },
      {
        title: 'Member passes at the gate',
        description: 'Digital passes with QR check-in for players and members.',
      },
    ],
    theirStrengths: [
      'No subscription, like itsfootball.club.',
      'Apple Pay and Google Pay in the app.',
      'Works for many sports.',
    ],
    faqs: [
      {
        q: 'Is PLAI free?',
        a: `PLAI has no subscription and earns from fees on payments the club takes. itsfootball.club is also free for clubs; card payers pay ${FEE_PHRASE}.`,
      },
      ...OUR_FAQS.slice(1),
    ],
    sources: [
      { title: 'PLAI website', url: 'https://www.plaisport.com/' },
      { title: 'PLAI Sport on the App Store', url: 'https://apps.apple.com/app/id1537033173' },
    ],
  },
  {
    slug: 'football-club',
    alternativeSlug: 'football-club-alternative',
    name: 'Football.Club',
    tagline: 'A free Football.Club alternative for grassroots football clubs',
    summary: 'Football.Club launched in July 2026 as a club operating platform from $499 a month. itsfootball.club is free for clubs, with a website, live match centre and passes.',
    aiOverview: `Football.Club is an operating platform for football clubs announced in July 2026: website, finances, member records, match days and player health under one login, with an AI agent for member messages. Its launch release gives pricing from $499 a month. itsfootball.club is free for clubs; card payers pay ${FEE_PHRASE}.`,
    keyTakeaways: [
      'Football.Club pricing starts at $499 a month, per its launch release. itsfootball.club has no paid plan.',
      'Both give a club a website on its own address.',
      'Football.Club adds an AI agent for member messages. itsfootball.club focuses on matchday: live scores, lineups and passes.',
    ],
    checkedOn: '2026-10-22',
    rows: [
      { label: 'Price for the club', us: FREE, them: { mark: 'part', text: 'From $499 a month', source: 0 } },
      { label: 'Public club website', us: WEBSITE, them: { mark: 'yes', text: 'Club address on the Football.Club domain, or the club’s own domain', source: 0 } },
      { label: 'Match days', us: MATCH_CENTRE, them: { mark: 'info', text: 'Match day module listed; live scores not mentioned', source: 0 } },
      { label: 'Online payments', us: PAYMENTS, them: { mark: 'info', text: 'Finances module; AI agent follows up overdue payments', source: 0 } },
      { label: 'Digital member passes', us: PASSES, them: NOT_LISTED(0) },
    ],
    featureHighlights: [
      {
        title: 'Free for every club',
        description: 'Website, live match centre, passes and shop with no monthly fee.',
        comparison: 'Football.Club starts at $499 a month.',
      },
    ],
    theirStrengths: [
      'AI agent answering member and parent questions in more than 50 languages.',
      'Player health and finances in the same login.',
      'Setup sponsorship of up to CAD$20,000 for clubs that apply.',
    ],
    faqs: [
      {
        q: 'How much does Football.Club cost?',
        a: 'Its July 2026 launch release gives pricing from $499 a month. itsfootball.club has no paid plan.',
      },
      ...OUR_FAQS.slice(1),
    ],
    sources: [
      { title: 'Football.Club launch release (Newsfile, 28 July 2026)', url: 'https://www.newsfilecorp.com/release/306894/Fairfax-Partners-Acquires-Premium-Domain-Football.Club' },
    ],
  },
  // Footeo's site couldn't be read on 22 Oct 2026; check it before filling in its rows
  unchecked({ slug: 'footeo', name: 'Footeo', website: 'https://www.footeo.com' }),
];

/** Competitors with checked facts: listed in the sitemap, the /compare matrix and llms.txt */
export const CHECKED_COMPETITORS = COMPETITORS.filter(c => !c.unchecked);

export const competitorBySlug = (slug: string) => COMPETITORS.find(c => c.slug === slug);

export const competitorBySlugOrAlternative = (slug: string): Competitor | undefined => {
  const clean = slug.toLowerCase().replace(/-alternative$/, '');
  return COMPETITORS.find(c => c.slug === clean || c.alternativeSlug === slug.toLowerCase());
};

/** Slugs for /compare/[slug] (the alternative slug is canonical; the bare slug renders the same page) */
export const ALL_COMPARE_SLUGS = [
  ...COMPETITORS.map(c => c.alternativeSlug),
  ...COMPETITORS.map(c => c.slug),
];

/** "22 October 2026" */
export const checkedOnLabel = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

/** The all-in-one table order on /compare */
export const COMPARE_ORDER = ['pitchero', 'spond', 'teamapp', 'heja', 'teamer'] as const;
export interface CompareRow { label: string; us: Cell; them: Record<(typeof COMPARE_ORDER)[number], Cell> }

const DASH: Cell = { mark: 'info', text: '—' };

export const COMPARE_ROWS: CompareRow[] = [
  { label: 'Still running?', us: { mark: 'yes', text: 'Yes' }, them: {
    pitchero: { mark: 'yes', text: 'Yes' }, spond: { mark: 'yes', text: 'Yes' }, teamapp: { mark: 'yes', text: 'Yes' }, heja: { mark: 'yes', text: 'Yes' },
    teamer: { mark: 'no', text: 'Closed 5 Oct 2026', source: 0 } } },
  { label: 'Price for the club', us: FREE, them: {
    pitchero: { mark: 'part', text: 'Free for 1 team. £38 or £99/month', source: 0 },
    spond: { mark: 'yes', text: 'Free app', source: 0 },
    teamapp: { mark: 'yes', text: 'Free, funded by ads', source: 0 },
    heja: { mark: 'part', text: 'Free with ads. Pro from $8.33', source: 0 },
    teamer: DASH } },
  { label: 'Ads', us: NO_ADS, them: {
    pitchero: { mark: 'part', text: 'On Free and Standard', source: 0 },
    spond: { mark: 'part', text: 'Brand partner ads in the app', source: 4 },
    teamapp: { mark: 'part', text: 'Mobile ads; members can remove them for AUD $4.49/year', source: 2 },
    heja: { mark: 'part', text: 'On Free; Pro Max removes them', source: 1 },
    teamer: DASH } },
  { label: 'Public club website', us: WEBSITE, them: {
    pitchero: { mark: 'yes', text: 'Included', source: 0 },
    spond: { mark: 'part', text: 'A$22/month after free trial', source: 5 },
    teamapp: { mark: 'yes', text: 'Free website', source: 2 },
    heja: { mark: 'no', text: 'Members-only teams', source: 0 },
    teamer: DASH } },
  { label: 'Live match centre', us: MATCH_CENTRE, them: {
    pitchero: { mark: 'yes', text: 'Live scores via their app', source: 1 },
    spond: NOT_LISTED(1),
    teamapp: { mark: 'yes', text: 'Live scores', source: 2 },
    heja: NOT_LISTED(1),
    teamer: DASH } },
  { label: 'Fans need an app?', us: NO_APP, them: {
    pitchero: { mark: 'yes', text: 'No for scores', source: 1 },
    spond: { mark: 'part', text: 'Spond app or web', source: 0 },
    teamapp: { mark: 'info', text: 'App, plus a website that updates with it', source: 2 },
    heja: { mark: 'no', text: 'Yes, members-only app', source: 1 },
    teamer: DASH } },
  { label: 'Online payments', us: PAYMENTS, them: {
    pitchero: { mark: 'part', text: 'Paid plans, from 1.67% + 15p', source: 0 },
    spond: { mark: 'yes', text: 'AUD 2.5% + $0.30, club pays by default', source: 2 },
    teamapp: { mark: 'info', text: 'Store transaction fees, rate not published', source: 0 },
    heja: { mark: 'part', text: 'Pro: track fees, payouts in some regions', source: 1 },
    teamer: DASH } },
  { label: 'Digital member passes', us: PASSES, them: {
    pitchero: NOT_LISTED(0),
    spond: NOT_LISTED(1),
    teamapp: NOT_LISTED(2),
    heja: NOT_LISTED(1),
    teamer: DASH } },
  { label: 'Club shop', us: SHOP, them: {
    pitchero: { mark: 'info', text: '"Sell all product types"', source: 0 },
    spond: { mark: 'info', text: 'Products in payment requests', source: 3 },
    teamapp: { mark: 'info', text: 'Store, with transaction fees', source: 0 },
    heja: NOT_LISTED(1),
    teamer: DASH } },
  { label: 'Tournament maker', us: TOURNAMENTS, them: {
    pitchero: NOT_LISTED(0),
    spond: NOT_LISTED(1),
    teamapp: NOT_LISTED(2),
    heja: NOT_LISTED(1),
    teamer: DASH } },
];
