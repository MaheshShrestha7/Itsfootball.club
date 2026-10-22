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
  /** When this guide went live (datePublished): never change it when the guide is edited */
  published: string;
  /** When this guide was last checked against its sources, if later than GUIDES_UPDATED */
  updated?: string;
}

export const GUIDES_HUB: ToolPageLink = { path: '/guides', label: 'Guides', blurb: 'Junior rules, fair minutes, fixtures and fees' };

/** When the guides were last checked against their sources: shown as "Updated" and as dateModified */
export const GUIDES_UPDATED = '2026-10-18';

export const GUIDES: Guide[] = [
  {
    path: '/guides/miniroos-rules-by-age',
    published: '2026-10-15',
    label: 'MiniRoos rules by age',
    blurb: 'Players, subs, match length and pitch size, under 6 to under 11',
    question: 'How many players, subs and minutes are there in MiniRoos football?',
    tool: PLAYING_TIME_FORMAT_PAGES[0],
    linkedFrom: [LINEUP_TOOL.path, ...LINEUP_FORMAT_PAGES.map(t => t.path), PLAYING_TIME_TOOL.path, ...PLAYING_TIME_FORMAT_PAGES.map(t => t.path)],
  },
  {
    path: '/guides/equal-playing-time-junior-football',
    published: '2026-10-15',
    label: 'Equal playing time in junior football',
    blurb: 'What Football Australia says, and how to share the minutes',
    question: 'Do junior football players have to get equal playing time?',
    tool: PLAYING_TIME_TOOL,
    linkedFrom: [PLAYING_TIME_TOOL.path, ...PLAYING_TIME_FORMAT_PAGES.map(t => t.path)],
  },
  {
    path: '/guides/round-robin-how-many-matches',
    published: '2026-10-15',
    label: 'How many matches in a round robin?',
    blurb: 'Matches, rounds and time slots for 3 to 12 teams',
    question: 'How many matches and rounds does a round robin tournament have?',
    tool: TOURNAMENT_FORMAT_PAGES[0],
    linkedFrom: [TOURNAMENT_TOOL.path, ...TOURNAMENT_FORMAT_PAGES.map(t => t.path)],
  },
  {
    path: '/guides/how-much-to-charge-for-club-registration',
    published: '2026-10-15',
    label: 'How much to charge for club registration',
    blurb: 'The break-even fee, card fees and the surcharge ban',
    question: 'How much should a community soccer club charge for registration?',
    tool: SEASON_FEE_TOOL,
    linkedFrom: [SEASON_FEE_TOOL.path],
  },
  {
    path: '/guides/how-many-subs-in-7-a-side',
    published: '2026-10-18',
    label: 'How many subs in 7-a-side',
    blurb: 'Bench limits, rolling rotation rules and fair minutes for Under 8 and Under 9',
    question: 'How many substitutes are allowed in 7-a-side football?',
    tool: PLAYING_TIME_FORMAT_PAGES[1] || PLAYING_TIME_TOOL,
    linkedFrom: [PLAYING_TIME_TOOL.path, ...(PLAYING_TIME_FORMAT_PAGES[1] ? [PLAYING_TIME_FORMAT_PAGES[1].path] : [])],
  },
  {
    path: '/guides/miniroos-rules-nsw-vic-qld-wa',
    published: '2026-10-18',
    label: 'MiniRoos rules by state: NSW, VIC, QLD & WA',
    blurb: 'National formats vs state variations, retreat lines and competition policies',
    question: 'How do MiniRoos rules compare between NSW, Victoria, Queensland and WA?',
    tool: PLAYING_TIME_TOOL,
    linkedFrom: [PLAYING_TIME_TOOL.path, ...PLAYING_TIME_FORMAT_PAGES.map(t => t.path)],
  },
  {
    path: '/guides/2027-football-australia-registration-fees',
    published: '2026-10-18',
    label: '2027 Football Australia registration fees',
    blurb: 'The new National Football Development Contribution and fee freeze explained',
    question: 'What is the Football Australia 2027 National Football Development Contribution?',
    tool: SEASON_FEE_TOOL,
    linkedFrom: [SEASON_FEE_TOOL.path],
  },
  {
    path: '/guides/how-to-start-a-football-club-in-australia',
    published: '2026-10-18',
    label: 'How to start a football club in Australia',
    blurb: 'Step-by-step: association affiliation, incorporation, constitution & kits',
    question: 'How do you start a community football (soccer) club in Australia?',
    tool: LINEUP_TOOL,
    linkedFrom: [LINEUP_TOOL.path],
  },
  {
    path: '/guides/football-club-sponsorship-proposal-template',
    published: '2026-10-18',
    label: 'Club sponsorship proposal template',
    blurb: 'Sponsorship packages, pricing tiers, pitch valuation and proposal outline',
    question: 'How do you write a grassroots football club sponsorship proposal?',
    tool: SEASON_FEE_TOOL,
    linkedFrom: [SEASON_FEE_TOOL.path],
  },
  {
    path: '/guides/football-club-committee-roles-and-responsibilities',
    published: '2026-10-18',
    label: 'Club committee roles and responsibilities',
    blurb: 'President, Secretary, Treasurer, Registrar and Member Protection duties',
    question: 'What are the committee roles in an Australian community football club?',
    tool: PLAYING_TIME_TOOL,
    linkedFrom: [PLAYING_TIME_TOOL.path],
  },
  {
    path: '/guides/is-the-ground-closed-after-rain-sydney-councils',
    published: '2026-10-18',
    label: 'Is the ground closed after rain? Sydney councils',
    blurb: 'Wet weather inspection times, council status hotlines and weekend ground rules',
    question: 'How do Sydney councils decide when sportsgrounds close after rain?',
    tool: LINEUP_TOOL,
    linkedFrom: [LINEUP_TOOL.path],
  },
  {
    path: '/guides/how-to-register-on-playfootball',
    published: '2026-10-22',
    label: 'How to register on PlayFootball',
    blurb: 'Step by step for players and parents, plus pending approvals, transfers and refunds',
    question: 'How do you register for a football club on PlayFootball?',
    tool: SEASON_FEE_TOOL,
    linkedFrom: [SEASON_FEE_TOOL.path],
    updated: '2026-10-22',
  },
  {
    path: '/guides/sport-vouchers-for-football-by-state',
    published: '2026-10-22',
    label: 'Sport vouchers for football, by state',
    blurb: 'Active and Creative Kids, Get Active Kids, Play On!, KidSport and the rest',
    question: 'Which government sport vouchers can you use for football registration in Australia?',
    tool: SEASON_FEE_TOOL,
    linkedFrom: [SEASON_FEE_TOOL.path],
    updated: '2026-10-22',
  },
  {
    path: '/guides/football-club-agm-agenda-template',
    published: '2026-10-22',
    label: 'Football club AGM agenda template',
    blurb: 'Deadlines, notice periods, a running order you can copy, and what to lodge after',
    question: 'What has to happen at a football club AGM in Australia?',
    tool: SEASON_FEE_TOOL,
    linkedFrom: [SEASON_FEE_TOOL.path],
    updated: '2026-10-22',
  },
  {
    path: '/guides/extreme-heat-policy-football-australia',
    published: '2026-10-22',
    label: 'Extreme heat and lightning policy',
    blurb: 'When hot-weather games are cancelled, drinks breaks and the 30-second lightning rule',
    question: 'When are junior football games cancelled because of heat in Australia?',
    tool: PLAYING_TIME_TOOL,
    linkedFrom: [PLAYING_TIME_TOOL.path],
    updated: '2026-10-22',
  },
  {
    path: '/guides/grants-for-football-clubs-australia',
    published: '2026-10-22',
    label: 'Grants for football clubs in Australia',
    blurb: 'Football Australia, state and council grants, and tax-deductible donations',
    question: 'What grants can a community football club in Australia apply for?',
    tool: SEASON_FEE_TOOL,
    linkedFrom: [SEASON_FEE_TOOL.path],
    updated: '2026-10-22',
  },
  {
    path: '/guides/bunnings-sausage-sizzle-fundraiser',
    published: '2026-10-22',
    label: 'Running a Bunnings sausage sizzle',
    blurb: 'How to ask your store, food rules by state, the roster and the shopping list',
    question: 'How does a football club book and run a Bunnings sausage sizzle fundraiser?',
    tool: SEASON_FEE_TOOL,
    linkedFrom: [SEASON_FEE_TOOL.path],
    updated: '2026-10-22',
  },
];

/** The date a guide was last checked against its sources */
export const guideUpdated = (g: Guide) => [g.updated ?? GUIDES_UPDATED, g.published].sort().at(-1)!;

/** The most recent check across all guides, for the index page */
export const GUIDES_LAST_UPDATED = GUIDES.map(guideUpdated).sort().at(-1)!;

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
  playFootballSa: {
    title: '2026 Guide to register on Play Football',
    publisher: 'Football SA',
    url: 'https://footballsa.com.au/sites/ffsa/files/2025-12/2026%20-%20Guide%20to%20register%20on%20Play%20Football.pdf',
    note: 'The registration steps, what to have ready, and PlayFootball support contacts',
  },
  playFootballClub: {
    title: 'How do I register to my club on Play Football?',
    publisher: 'Football SA',
    url: 'https://footballsa.com.au/news/how-do-i-register-my-club-2019-play-football',
    note: 'Searching for a club, claiming an existing record, and accounts in a parent’s name',
  },
  faRefunds: {
    title: 'National Registration Fee Refund Policy',
    publisher: 'Football Australia',
    url: 'https://footballaustralia.com.au/sites/default/files/2026-09/National%20Registration%20Fee%20Refund%20Policy.pdf',
    note: 'Applies from 1 November 2025: who refunds which fee, and how to ask',
  },
  nswVoucher: {
    title: 'Active and Creative Kids voucher guidelines',
    publisher: 'Service NSW',
    url: 'https://www.service.nsw.gov.au/guidelines-for-service-nsw-grants-programs-and-services/active-and-creative-kids-voucher',
    note: 'Two $50 vouchers a year, Family Tax Benefit families, football (soccer) listed',
  },
  fnswVouchers: {
    title: 'Active Kids Rebate a Booming Success for Football Families',
    publisher: 'Football NSW',
    url: 'https://footballnsw.com.au/?p=103986',
    note: 'Football took about half of all vouchers in the scheme’s first season (2018)',
  },
  vicVoucher: {
    title: 'Get Active Kids vouchers are back in play',
    publisher: 'Sport and Recreation Victoria',
    url: 'https://sport.vic.gov.au/news/2026/march/get-active-kids-vouchers-are-back-in-play',
    note: 'Round 10: up to $200, Health Care or Pensioner Concession Card, closed 2 April 2026',
  },
  qldVoucher: {
    title: 'Applying for and using Play On! Sports Vouchers',
    publisher: 'Queensland Government',
    url: 'https://qld.gov.au/recreation/sports/funding/playon/apply',
    note: 'Up to $200, one per child per financial year; open 27 July to 18 December 2026',
  },
  waVoucher: {
    title: 'Apply for KidSport',
    publisher: 'WA Department of Local Government, Sport and Cultural Industries',
    url: 'https://kidsport.dlgsc.wa.gov.au/kidsport/apply-for-kidsport-1/',
    note: 'Ages 5 to 18, concession card, a KidSport club; funding resets 1 July',
  },
  waVoucherAmount: {
    title: 'KidSport vouchers',
    publisher: 'Jessica Stojkovski MLA',
    url: 'https://jessicastojkovski.com.au/community/tackling-cost-of-living/kidsport-vouchers/',
    note: 'Up to $300 per child per financial year',
  },
  saVoucher: {
    title: 'Sports Vouchers',
    publisher: 'Government of South Australia',
    url: 'https://www.sportsvouchers.sa.gov.au/',
    note: 'Two $100 vouchers a year, Reception to Year 9, ages 5 to 18 from 1 January 2027',
  },
  tasVoucher: {
    title: 'Ticket to Play',
    publisher: 'Tasmanian Government',
    url: 'https://tickettoplay.tas.gov.au/',
    note: 'Two vouchers of up to $100, ages 5 to 18, concession card or Family Tax Benefit A',
  },
  ntVoucher: {
    title: 'Get sport vouchers for your child',
    publisher: 'NT Government',
    url: 'https://nt.gov.au/leisure/sport/get-sport-vouchers-for-your-child',
    note: 'Two $100 vouchers a year for school-age children in urban areas',
  },
  nswMeetings: {
    title: 'Meetings of incorporated associations',
    publisher: 'NSW Government (Fair Trading)',
    url: 'https://www.nsw.gov.au/business-and-economy/incorporated-associations/running-an-incorporated-association/meetings',
    note: 'AGM within 6 months of year end, 14 days’ notice, 21 for a special resolution, AGM business',
  },
  nswTier2: {
    title: 'Tier 2 incorporated associations financial reporting',
    publisher: 'NSW Government (Fair Trading)',
    url: 'https://www.nsw.gov.au/business-and-economy/incorporated-associations/running-an-incorporated-association/financial-reporting-requirements/tier-2-incorporated-associations-financial-reporting',
    note: 'What the statements must show, and lodging Form A12 within a month of the AGM',
  },
  vicMeetings: {
    title: 'Incorporated association meetings',
    publisher: 'Consumer Affairs Victoria',
    url: 'https://www.consumer.vic.gov.au/clubs-and-fundraising/incorporated-associations/running-an-incorporated-association/meetings',
    note: 'AGM within 5 months of year end, 21 days’ notice and 75% for special resolutions',
  },
  vicAnnualStatement: {
    title: 'Step-by-step summary of financial reporting requirements',
    publisher: 'Consumer Affairs Victoria',
    url: 'https://www.consumer.vic.gov.au/clubs-and-fundraising/incorporated-associations/running-an-incorporated-association/annual-statement/step-by-step-summary',
    note: 'Annual statement lodged through myCAV within one month of the AGM',
  },
  qldMeetings: {
    title: 'Types of meetings',
    publisher: 'Queensland Government (Office of Fair Trading)',
    url: 'https://www.qld.gov.au/community/fair-trading/associations-charities-and-non-for-profits/incorporated-associations/running-an-incorporated-association/meetings-for-associations/types-of-meetings',
    note: 'AGM within 6 months of year end, 14 days’ notice and the AGM business under the model rules',
  },
  smaHeat: {
    title: 'Extreme Heat Risk and Response Guidelines and Webtool (2025)',
    publisher: 'Sports Medicine Australia, with the University of Sydney',
    url: 'https://heathealth.info/wp-content/uploads/Extreme-Heat-Policy-2025_FIN.pdf',
    note: 'Four risk levels from local weather data, and what to do at each',
  },
  smaHeatTool: {
    title: 'SMA Extreme Heat Policy webtool',
    publisher: 'Sports Medicine Australia, with the University of Sydney',
    url: 'https://sma-heat-policy.sydney.edu.au/',
    note: 'Pick soccer and your postcode for today’s heat risk',
  },
  fwWeather: {
    title: 'Extreme Weather Policy v7.1',
    publisher: 'Football West',
    url: 'https://footballwest.com.au/sites/fw/files/2026-01/Extreme%20Weather%20Policy%20-%20%28website%29%20v7.1.pdf',
    note: 'From November 2025: heat thresholds by age, drinks breaks and the lightning rule',
  },
  fnswHeat: {
    title: 'Football NSW Hot Weather Policy in full force this weekend',
    publisher: 'Football NSW',
    url: 'https://footballnsw.com.au/?p=103916',
    note: 'Clubs decide under their duty of care, using Sports Medicine Australia guidance',
  },
  faGrowingFootball: {
    title: 'Growing Football Community Grant Program: Grant Guidelines',
    publisher: 'Football Australia',
    url: 'https://footballaustralia.com.au/sites/default/files/2026-09/Growing%20Football%20Community%20Grant%20Program%20-%20Grant%20Guidelines.pdf',
    note: 'Up to $5,000 for women and girls projects; 2026/27 round 8 September to 20 October 2026',
  },
  asfFaqs: {
    title: 'Fundraising FAQs',
    publisher: 'Australian Sports Foundation',
    url: 'https://asf.org.au/faqs',
    note: 'Free to register, 5% kept from online donations, tax-deductible from $2, paid out fortnightly',
  },
  asfActiveKids: {
    title: '$618K delivered to grassroots clubs to boost participation',
    publisher: 'Australian Sports Foundation',
    url: 'https://asf.org.au/resources/blog/2026-active-kids-grant',
    note: 'Active Kids Grant: equipment and uniforms for clubs with members 20 and under; next round early 2027',
  },
  nswLsgp: {
    title: 'Local Sport Grant Program 2026/27',
    publisher: 'NSW Office of Sport',
    url: 'https://www.nsw.gov.au/grants-and-funding/local-sport-grant-program-lsgp-2026/27',
    note: '$2,000 to $20,000; round ran 27 July to 24 August 2026, outcomes December 2026',
  },
  clubGrants: {
    title: 'ClubGRANTS',
    publisher: 'Inner West Council',
    url: 'https://www.innerwest.nsw.gov.au/grants/clubgrants',
    note: 'Category 1 applications open each March through ClubGRANTS online',
  },
  vicClubGrants: {
    title: '2026 starts with big wins for sporting clubs',
    publisher: 'Sport and Recreation Victoria',
    url: 'https://sport.vic.gov.au/news/2026/february/2026-starts-with-big-wins-for-sporting-clubs',
    note: 'Sporting Club Grants Program streams and amounts; round open 25 February to 7 April 2026',
  },
  waEveryClub: {
    title: 'Every Club Grant Scheme guidelines',
    publisher: 'WA Department of Local Government, Sport and Cultural Industries',
    url: 'https://dlgsc.wa.gov.au/funding/sport-and-recreation-funding/every-club-grant-scheme/every-club-grant-scheme-guidelines',
    note: 'Councils apply and run club development projects; clubs benefit through their council',
  },
  bunningsCommunity: {
    title: 'In our community',
    publisher: 'Bunnings Warehouse',
    url: 'https://bunnings.com.au/about-us/in-our-community',
    note: 'Requests in writing, on letterhead, to the nearest store’s Activities Organiser',
  },
  bunningsOnion: {
    title: 'Why Bunnings’ iconic snags will never be the same again',
    publisher: 'SmartCompany',
    url: 'https://www.smartcompany.com.au/industries/retail/bunnings-sausages-ohs/',
    note: 'The 2018 suggestion to put the onion under the sausage, as a slip hazard',
  },
  nswFoodCharity: {
    title: 'Charities and not-for-profit organisations',
    publisher: 'NSW Food Authority',
    url: 'https://www.foodauthority.nsw.gov.au/node/3091',
    note: 'Sausage sizzles cooked and eaten straight away don’t need notification; food safety still applies',
  },
  vicStreatrader: {
    title: 'Applying to register a simple sausage sizzle in Victoria',
    publisher: 'Hindmarsh Shire Council',
    url: 'https://www.hrcc.vic.gov.au/files/assets/public/v/1/document-resources/services/public-health/applying-to-register-a-simple-sausage-sizzle-in-victoria-step-by-step-guide-final.pdf',
    note: 'Victorian sizzles are registered through Streatrader as Class 4, with a Statement of Trade',
  },
  stripeAu: {
    title: 'Stripe pricing, Australia',
    publisher: 'Stripe',
    url: 'https://stripe.com/au/pricing',
    note: 'Card processing rates, GST included',
  },
};
