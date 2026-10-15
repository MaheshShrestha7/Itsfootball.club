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
];

export const guideByPath = (path: string) => GUIDES.find(g => g.path === path)!;

/** The guides a tool page links to */
export const guidesForTool = (toolPath: string) => GUIDES.filter(g => g.linkedFrom.includes(toolPath));

/** Official documents the guides were checked against (15 October 2026) */
export const SOURCES = {
  faMiniRoos: {
    title: 'MiniRoos National Playing Formats',
    publisher: 'Football Australia, via PlayFootball',
    url: 'https://playfootball.com.au/sites/default/files/2025-10/FA0708_MiniRoos_Doc_Update_2.pdf',
    note: 'Formats, substitutes, match length, pitch, ball and goal sizes by age, in force since 1 January 2015',
  },
  fvMiniRoos: {
    title: 'MiniRoos Guidelines',
    publisher: 'Football Victoria',
    url: 'https://footballvictoria.com.au/sites/ffv/files/2026-04/MiniRoos_Guidelines_updated_290426.pdf',
    note: 'A state federation applying the same formats, with its guidance on game time and results',
  },
  faGameTime: {
    title: 'Game Time Policy Template',
    publisher: 'Football Australia',
    url: 'https://footballaustralia.com.au/sites/ffa/files/2023-06/Game%20Time%20Policy%20Template.pdf',
    note: 'A template policy clubs adapt: equal game time for MiniRoos, at least half a game for youth',
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
