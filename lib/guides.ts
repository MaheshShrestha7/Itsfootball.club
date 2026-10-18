// The guides under /guides: short pages that each answer one question people ask (Australia-first, with
// sources) and lead into the free tool that does the job. Used for the index page, the sitemap, llms.txt
// and the "Read the guide" links on the tool pages.
import { LINEUP_FORMAT_PAGES, PLAYING_TIME_FORMAT_PAGES, PLAYING_TIME_TOOL, SEASON_FEE_TOOL, TOURNAMENT_FORMAT_PAGES, TOURNAMENT_TOOL, LINEUP_TOOL, type ToolPageLink } from '@/lib/tool-pages';

export interface Guide extends ToolPageLink {
  /** The question the guide answers, as people ask it */
  question: string;
  /** The tool the guide leads into */
  tool: ToolPageLink;
  /** Tool pages that link back to this guide */
  linkedFrom: string[];
}

export const GUIDES_HUB: ToolPageLink = { path: '/guides', label: 'Guides', blurb: 'Junior rules, fair minutes, fixtures and fees' };

/** When the guides were last checked against their sources: shown as "Updated" and as dateModified */
export const GUIDES_UPDATED = '2026-10-15';

export const GUIDES: Guide[] = [
  {
    path: '/guides/miniroos-rules-by-age',
    label: 'MiniRoos rules by age',
    blurb: 'Players, subs, match length and pitch size, under 6 to under 11',
    question: 'How many players, subs and minutes are there in MiniRoos football?',
    tool: PLAYING_TIME_FORMAT_PAGES[0],
    linkedFrom: [LINEUP_TOOL.path, ...LINEUP_FORMAT_PAGES.map(t => t.path), PLAYING_TIME_TOOL.path, ...PLAYING_TIME_FORMAT_PAGES.map(t => t.path)],
  },
  {
    path: '/guides/equal-playing-time-junior-football',
    label: 'Equal playing time in junior football',
    blurb: 'What Football Australia says, and how to share the minutes',
    question: 'Do junior football players have to get equal playing time?',
    tool: PLAYING_TIME_TOOL,
    linkedFrom: [PLAYING_TIME_TOOL.path, ...PLAYING_TIME_FORMAT_PAGES.map(t => t.path)],
  },
  {
    path: '/guides/round-robin-how-many-matches',
    label: 'How many matches in a round robin?',
    blurb: 'Matches, rounds and time slots for 3 to 12 teams',
    question: 'How many matches and rounds does a round robin tournament have?',
    tool: TOURNAMENT_FORMAT_PAGES[0],
    linkedFrom: [TOURNAMENT_TOOL.path, ...TOURNAMENT_FORMAT_PAGES.map(t => t.path)],
  },
  {
    path: '/guides/how-much-to-charge-for-club-registration',
    label: 'How much to charge for club registration',
    blurb: 'The break-even fee, card fees and the surcharge ban',
    question: 'How much should a community soccer club charge for registration?',
    tool: SEASON_FEE_TOOL,
    linkedFrom: [SEASON_FEE_TOOL.path],
  },
  {
    path: '/guides/how-many-subs-in-7-a-side',
    label: 'How many subs in 7-a-side',
    blurb: 'Bench limits, rolling rotation rules and fair minutes for Under 8 and Under 9',
    question: 'How many substitutes are allowed in 7-a-side football?',
    tool: PLAYING_TIME_FORMAT_PAGES[1] || PLAYING_TIME_TOOL,
    linkedFrom: [PLAYING_TIME_TOOL.path, ...(PLAYING_TIME_FORMAT_PAGES[1] ? [PLAYING_TIME_FORMAT_PAGES[1].path] : [])],
  },
  {
    path: '/guides/miniroos-rules-nsw-vic-qld-wa',
    label: 'MiniRoos rules by state: NSW, VIC, QLD & WA',
    blurb: 'National formats vs state variations, retreat lines and competition policies',
    question: 'How do MiniRoos rules compare between NSW, Victoria, Queensland and WA?',
    tool: PLAYING_TIME_TOOL,
    linkedFrom: [PLAYING_TIME_TOOL.path, ...PLAYING_TIME_FORMAT_PAGES.map(t => t.path)],
  },
  {
    path: '/guides/2027-football-australia-registration-fees',
    label: '2027 Football Australia registration fees',
    blurb: 'The new National Football Development Contribution and fee freeze explained',
    question: 'What is the Football Australia 2027 National Football Development Contribution?',
    tool: SEASON_FEE_TOOL,
    linkedFrom: [SEASON_FEE_TOOL.path],
  },
  {
    path: '/guides/how-to-start-a-football-club-in-australia',
    label: 'How to start a football club in Australia',
    blurb: 'Step-by-step: association affiliation, incorporation, constitution & kits',
    question: 'How do you start a community football (soccer) club in Australia?',
    tool: LINEUP_TOOL,
    linkedFrom: [LINEUP_TOOL.path],
  },
  {
    path: '/guides/football-club-sponsorship-proposal-template',
    label: 'Club sponsorship proposal template',
    blurb: 'Sponsorship packages, pricing tiers, pitch valuation and proposal outline',
    question: 'How do you write a grassroots football club sponsorship proposal?',
    tool: SEASON_FEE_TOOL,
    linkedFrom: [SEASON_FEE_TOOL.path],
  },
  {
    path: '/guides/football-club-committee-roles-and-responsibilities',
    label: 'Club committee roles and responsibilities',
    blurb: 'President, Secretary, Treasurer, Registrar and Member Protection duties',
    question: 'What are the committee roles in an Australian community football club?',
    tool: PLAYING_TIME_TOOL,
    linkedFrom: [PLAYING_TIME_TOOL.path],
  },
  {
    path: '/guides/is-the-ground-closed-after-rain-sydney-councils',
    label: 'Is the ground closed after rain? Sydney councils',
    blurb: 'Wet weather inspection times, council status hotlines and weekend ground rules',
    question: 'How do Sydney councils decide when sportsgrounds close after rain?',
    tool: LINEUP_TOOL,
    linkedFrom: [LINEUP_TOOL.path],
  },
];

export const guideByPath = (path: string) => GUIDES.find(g => g.path === path)!;

/** The guides a tool page links to */
export const guidesForTool = (toolPath: string) => GUIDES.filter(g => g.linkedFrom.includes(toolPath));

/** Official documents the guides were checked against (18 October 2026) */
export const SOURCES = {
  faMiniRoos: {
    title: 'MiniRoos National Playing Formats',
    publisher: 'Football Australia, via PlayFootball',
    url: 'https://playfootball.com.au/sites/default/files/2025-10/FA0708_MiniRoos_Doc_Update_2.pdf',
    note: 'Formats, substitutes, match length, pitch, ball and goal sizes by age, in force since 1 January 2015',
  },
  fnswMiniRoos: {
    title: 'MiniRoos Regulations & Information',
    publisher: 'Football NSW',
    url: 'https://footballnsw.com.au/miniroos',
    note: 'State federation regulations governing Under 6 through Under 11 in New South Wales',
  },
  fvMiniRoos: {
    title: 'MiniRoos Guidelines',
    publisher: 'Football Victoria',
    url: 'https://footballvictoria.com.au/sites/ffv/files/2026-04/MiniRoos_Guidelines_updated_290426.pdf',
    note: 'A state federation applying the same formats, with its guidance on game time and results',
  },
  fqMiniRoos: {
    title: 'MiniRoos Operating Manual',
    publisher: 'Football Queensland',
    url: 'https://footballqueensland.com.au/miniroos',
    note: 'Junior operating formats and retreat line rules across Queensland zones',
  },
  fwMiniRoos: {
    title: 'MiniRoos Junior Rules',
    publisher: 'Football West',
    url: 'https://footballwest.com.au/miniroos',
    note: 'Junior playing framework and matchday regulations in Western Australia',
  },
  faGameTime: {
    title: 'Game Time Policy Template',
    publisher: 'Football Australia',
    url: 'https://footballaustralia.com.au/sites/ffa/files/2023-06/Game%20Time%20Policy%20Template.pdf',
    note: 'A template policy clubs adapt: equal game time for MiniRoos, at least half a game for youth',
  },
  faReforms2027: {
    title: 'Football Australia Freezes Base Registration Fees for 2027 Amid Structural Reforms',
    publisher: 'Football Australia (National Tribune)',
    url: 'https://www.nationaltribune.com.au/football-australia-freezes-base-registration-fees-for-2027-amid-structural-reforms/',
    note: 'Replacement of national base and service fees with the unified National Football Development Contribution from 2027',
  },
  ascGovernance: {
    title: 'Sports Governance Principles & Club Committee Standards',
    publisher: 'Australian Sports Commission',
    url: 'https://www.sportaus.gov.au/governance',
    note: 'Statutory roles, constitution guidance, and legal duties for community club office-bearers',
  },
  nswIncorporation: {
    title: 'Running an Incorporated Community Association',
    publisher: 'NSW Fair Trading',
    url: 'https://www.nsw.gov.au/housing-and-construction/associations',
    note: 'Association incorporation, committee constitution, public liability insurance, and AGM requirements',
  },
  rbaSurcharge: {
    title: 'Removal of card payment surcharges from 1 October 2026: FAQs',
    publisher: 'Reserve Bank of Australia',
    url: 'https://www.rba.gov.au/payments-and-infrastructure/review-of-retail-payments-regulation/2026-03/conclusions-paper/faqs/index.html',
    note: 'No surcharges on eftpos, Mastercard and Visa from 1 October 2026; costs can go into the overall price',
  },
  stripeAu: {
    title: 'Stripe pricing, Australia',
    publisher: 'Stripe',
    url: 'https://stripe.com/au/pricing',
    note: 'Card processing rates, GST included',
  },
};
