// Facts for the /vs/{competitor} comparison pages. Every competitor cell cites a source from that
// competitor's own site, checked on CHECKED_ON; re-check before changing a price or claim.

export const CHECKED_ON = '14 October 2026';

/** 'yes' and 'no' draw a mark; 'part' is a qualified yes (paid plan only, limited); 'info' is plain text. */
export type Mark = 'yes' | 'no' | 'part' | 'info';
export interface Cell { mark: Mark; text: string; source?: number }
export interface Row { label: string; us: Cell; them: Cell }
export interface Source { title: string; url: string }

export interface Competitor {
  slug: string;
  name: string;
  /** One honest line under the page title */
  summary: string;
  /** Set when the product no longer exists: the page becomes an "alternative to" page */
  closed?: { on: string; note: string };
  rows: Row[];
  /** Where they're stronger: keeps the page fair and believable */
  theirStrengths: string[];
  sources: Source[];
}

const FREE: Cell = { mark: 'yes', text: 'Free, every feature, no paid tier' };
const NO_ADS: Cell = { mark: 'yes', text: 'No ads, ever' };
const TEAMS: Cell = { mark: 'yes', text: 'Unlimited teams' };
const WEBSITE: Cell = { mark: 'yes', text: 'Included, with your colours, logo and own domain' };
const PAYMENTS: Cell = { mark: 'yes', text: 'Included. Card payers add a small booking fee, so the club gets its full price' };
const MATCH_CENTRE: Cell = { mark: 'yes', text: 'Live scores, lineups and events, run from any phone browser' };
const NO_APP: Cell = { mark: 'yes', text: 'No. Everything opens in the browser' };
const SHOP: Cell = { mark: 'yes', text: 'Included free, fee shown before paying' };
const PASS: Cell = { mark: 'yes', text: 'Digital member pass with QR check-in' };
const TOURNAMENTS: Cell = { mark: 'yes', text: 'Group stages and knockouts' };

export const COMPETITORS: Competitor[] = [
  {
    slug: 'pitchero',
    name: 'Pitchero',
    summary: 'Both give your club a website and live scores. Pitchero charges £38 or £99 a month to drop the ads and add teams; we don\'t charge the club at all.',
    rows: [
      { label: 'Price for the club', us: FREE, them: { mark: 'part', text: 'Free plan for 1 team. Standard £38/month, Pro £99/month', source: 0 } },
      { label: 'Ads on the club site', us: NO_ADS, them: { mark: 'part', text: 'Third-party ads on Free, limited on Standard, none on Pro', source: 0 } },
      { label: 'Teams', us: TEAMS, them: { mark: 'part', text: '1 on Free, 20 on Standard (+£2.50/month each), unlimited on Pro', source: 0 } },
      { label: 'Club website', us: WEBSITE, them: { mark: 'yes', text: 'Included. Custom domain on Standard and Pro', source: 0 } },
      { label: 'Online payments', us: PAYMENTS, them: { mark: 'part', text: 'Not on Free. From 2.42% + 17p (Standard) or 1.67% + 15p (Pro)', source: 0 } },
      { label: 'Live match centre', us: MATCH_CENTRE, them: { mark: 'yes', text: 'Live scores entered in the Pitchero Club app, shown on the website', source: 1 } },
      { label: 'Fans need an app?', us: NO_APP, them: { mark: 'yes', text: 'No for scores. The app adds push notifications', source: 1 } },
      { label: 'Club shop', us: SHOP, them: { mark: 'info', text: '"Sell all product types" listed under payments', source: 0 } },
    ],
    theirStrengths: [
      'A native app with push notifications for members.',
      'Club email accounts on paid plans (10 on Standard, 50 on Pro).',
      'Covers many sports, not just football.',
    ],
    sources: [
      { title: 'Pitchero pricing', url: 'https://www.pitchero.com/pricing' },
      { title: 'Pitchero help: Manage scores and events in the Club app', url: 'https://help.pitchero.com/knowledge/club-app/scores-match-events' },
    ],
  },
  {
    slug: 'heja',
    name: 'Heja',
    summary: 'Heja is a private team chat and schedule app for coaches and parents. itsfootball.club is the whole club online: a public site, live match centre, payments and shop.',
    rows: [
      { label: 'Price for the club', us: FREE, them: { mark: 'part', text: 'Free plan is ad-supported. Team Pro "from $8.33"', source: 0 } },
      { label: 'Ads', us: NO_ADS, them: { mark: 'part', text: 'Ads on Free. Pro removes them for admins, Pro Max for everyone', source: 1 } },
      { label: 'Public club website', us: WEBSITE, them: { mark: 'no', text: '"Teams can only be accessed by team members"', source: 0 } },
      { label: 'Live match centre', us: MATCH_CENTRE, them: { mark: 'info', text: 'Not listed on Heja\'s pricing or features pages', source: 1 } },
      { label: 'Fans need an app?', us: NO_APP, them: { mark: 'no', text: 'Teams are members-only in the app; desktop access is a Pro feature', source: 1 } },
      { label: 'Payments', us: PAYMENTS, them: { mark: 'part', text: 'Pro: create and track fees, bank payouts in selected regions', source: 1 } },
      { label: 'Availability and RSVPs', us: { mark: 'yes', text: 'Included' }, them: { mark: 'yes', text: 'Included on Free', source: 0 } },
      { label: 'Member passes and tournaments', us: { mark: 'yes', text: 'QR member pass, group and knockout tournaments' }, them: { mark: 'info', text: 'Not listed', source: 1 } },
    ],
    theirStrengths: [
      'A polished team chat and feed for players and parents.',
      'Works for any sport and any team size.',
    ],
    sources: [
      { title: 'Heja pricing', url: 'https://heja.io/pricing' },
      { title: 'Heja help: Team Pro and Pro Max features', url: 'https://help.heja.io/en/articles/4358964-team-pro-features' },
    ],
  },
  {
    slug: 'spond',
    name: 'Spond',
    summary: 'Spond is free for team admin too. The difference: its club website is a paid subscription after a free trial, and fans follow along in the browser here without an app.',
    rows: [
      { label: 'Price for the club', us: FREE, them: { mark: 'yes', text: 'App free to download and use', source: 0 } },
      { label: 'Club website', us: WEBSITE, them: { mark: 'part', text: 'Paid subscription after a free trial (6 months UK, 12 months AU)', source: 1 } },
      { label: 'Card fees on payments', us: PAYMENTS, them: { mark: 'info', text: 'AUD 2.5% + $0.30, GBP 2.5% + £0.20. Club pays by default', source: 2 } },
      { label: 'Live match centre', us: MATCH_CENTRE, them: { mark: 'info', text: 'Not listed on Spond\'s club website pages', source: 1 } },
      { label: 'Fans need an app?', us: NO_APP, them: { mark: 'part', text: 'Members use the Spond app or its web version', source: 0 } },
      { label: 'Availability and events', us: { mark: 'yes', text: 'Included' }, them: { mark: 'yes', text: 'Included', source: 0 } },
      { label: 'Club shop', us: SHOP, them: { mark: 'info', text: 'Payment requests can list products, each with its own fee', source: 3 } },
      { label: 'Member passes and tournaments', us: { mark: 'yes', text: 'QR member pass, group and knockout tournaments' }, them: { mark: 'info', text: 'Not listed', source: 1 } },
    ],
    theirStrengths: [
      'Very large user base, so many parents already have the app.',
      'Strong event and attendance tools across many sports.',
    ],
    sources: [
      { title: 'Spond help: Spond is free to download and use', url: 'https://help.spond.com/en/articles/25998-spond-is-free-to-download-and-use' },
      { title: 'Spond help: Set up your club website', url: 'https://help.spond.com/club/en/articles/148773-set-up-your-club-website' },
      { title: 'Spond help: Transaction fees in Spond Club', url: 'https://help.spond.com/club/en/articles/58192-what-is-the-transaction-fee-in-spond-club' },
      { title: 'Spond help: Payment costs in the Spond app', url: 'https://help.spond.com/app/en/articles/118091-payments-costs-in-the-spond-app' },
    ],
  },
  {
    slug: 'teamer',
    name: 'Teamer',
    summary: 'Teamer closed on 5 October 2026. If your team used it for availability and match days, you can move to itsfootball.club for free and get a full club site too.',
    closed: { on: '5 October 2026', note: 'Its owner is pointing users to Pitchero, a paid product from the same group.' },
    rows: [
      { label: 'Still running?', us: { mark: 'yes', text: 'Yes' }, them: { mark: 'no', text: 'Closed 5 October 2026', source: 0 } },
      { label: 'Price for the club', us: FREE, them: { mark: 'info', text: 'Was free, with paid Team Premium (cancelled September 2026)', source: 0 } },
      { label: 'Availability and lineups', us: { mark: 'yes', text: 'Availability replies, lineups on a pitch' }, them: { mark: 'no', text: 'Gone with the closure', source: 0 } },
      { label: 'Club website', us: WEBSITE, them: { mark: 'info', text: '—' } },
      { label: 'Live match centre', us: MATCH_CENTRE, them: { mark: 'info', text: '—' } },
      { label: 'Fans need an app?', us: NO_APP, them: { mark: 'info', text: '—' } },
    ],
    theirStrengths: [],
    sources: [
      { title: 'Teamer shutdown FAQs', url: 'https://help.teamer.net/knowledge/teamer-shutdown-faqs' },
    ],
  },
];

export const competitorBySlug = (slug: string) => COMPETITORS.find(c => c.slug === slug);
