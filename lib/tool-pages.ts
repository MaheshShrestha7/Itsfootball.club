// The free tools under /tools: the main tools and the format landing pages that open them with
// different defaults. Used for the sitemap, the cross-links between the pages and llms.txt.
export interface ToolPageLink {
  path: string;
  label: string;
  blurb: string;
  /** Button text for a format page inside its main tool's card on /tools: the start of its label (e.g. "9-a-side"), so the rest can stay in the link for search engines and screen readers */
  short?: string;
}

export const LINEUP_TOOL: ToolPageLink = { path: '/tools/lineup-builder', label: 'Football lineup builder', blurb: '5, 7, 9 or 11-a-side, 28 formations' };
export const TOURNAMENT_TOOL: ToolPageLink = { path: '/tools/tournament-maker', label: 'Soccer tournament maker', blurb: 'Groups, knockout or league, live link' };
export const RESULT_TOOL: ToolPageLink = { path: '/tools/match-result-graphic-maker', label: 'Match result graphic maker', blurb: 'Full-time score for stories and posts' };
export const PLAYING_TIME_TOOL: ToolPageLink = { path: '/tools/equal-playing-time-calculator', label: 'Equal playing time calculator', blurb: 'Fair minutes and a sub schedule' };
export const PLAYER_CARD_TOOL: ToolPageLink = { path: '/tools/player-card-maker', label: 'Football player card maker', blurb: 'Your photo, rating and season stats' };
export const SEASON_FEE_TOOL: ToolPageLink = { path: '/tools/season-fee-calculator', label: 'Season fee calculator', blurb: 'Break-even subs, card vs cash' };

export const LINEUP_FORMAT_PAGES: ToolPageLink[] = [
  { path: '/tools/11-a-side-lineup-builder', label: '11-a-side lineup builder', blurb: 'Opens on 4-3-3', short: '11-a-side' },
  { path: '/tools/9-a-side-lineup-builder', label: '9-a-side lineup builder', blurb: 'Opens on 3-3-2', short: '9-a-side' },
  { path: '/tools/7-a-side-lineup-builder', label: '7-a-side lineup builder', blurb: 'Opens on 2-3-1', short: '7-a-side' },
  { path: '/tools/5-a-side-formation-builder', label: '5-a-side formation builder', blurb: 'Opens on the 1-2-1 diamond', short: '5-a-side' },
];

export const TOURNAMENT_FORMAT_PAGES: ToolPageLink[] = [
  { path: '/tools/round-robin-fixture-generator', label: 'Round robin fixture generator', blurb: 'Everyone plays everyone once', short: 'Round robin' },
  { path: '/tools/knockout-cup-bracket-maker', label: 'Knockout cup bracket maker', blurb: 'Single elimination with byes', short: 'Knockout cup' },
];

export const RESULT_FORMAT_PAGES: ToolPageLink[] = [
  { path: '/tools/player-of-the-match-graphic-maker', label: 'Player of the Match graphic maker', blurb: 'MOTM card with their photo', short: 'Player of the Match' },
];

export const PLAYING_TIME_FORMAT_PAGES: ToolPageLink[] = [
  { path: '/tools/9-a-side-substitution-planner', label: '9-a-side substitution planner', blurb: 'Sub rotation for 9v9', short: '9-a-side' },
  { path: '/tools/7-a-side-substitution-planner', label: '7-a-side substitution planner', blurb: 'Sub rotation for 7v7', short: '7-a-side' },
  { path: '/tools/5-a-side-substitution-planner', label: '5-a-side substitution planner', blurb: 'Rolling subs for 5v5', short: '5-a-side' },
];

export const PLAYER_CARD_FORMAT_PAGES: ToolPageLink[] = [
  { path: '/tools/team-of-the-week-card-maker', label: 'Team of the Week card maker', blurb: 'Black and gold cards with the round', short: 'Team of the Week' },
  { path: '/tools/player-of-the-month-card-maker', label: 'Player of the Month card maker', blurb: 'An award card with the month', short: 'Player of the Month' },
  { path: '/tools/goalkeeper-card-maker', label: 'Goalkeeper card maker', blurb: 'Clean sheets and saves on the card', short: 'Goalkeeper' },
  { path: '/tools/soccer-player-card-maker', label: 'Soccer player card maker', blurb: 'Rec league and travel soccer stats', short: 'Soccer' },
];

export const FORMAT_PAGES = [...LINEUP_FORMAT_PAGES, ...TOURNAMENT_FORMAT_PAGES, ...RESULT_FORMAT_PAGES, ...PLAYING_TIME_FORMAT_PAGES, ...PLAYER_CARD_FORMAT_PAGES];

/** The hub page listing every tool, grouped as below */
export const TOOLS_HUB: ToolPageLink = { path: '/tools', label: 'Free football tools', blurb: 'Every free tool, no sign-up' };

export interface ToolGroup {
  id: string;
  /** Jump-bar and menu label */
  short: string;
  heading: string;
  blurb: string;
  main: ToolPageLink[];
  formats: ToolPageLink[];
}

// The /tools hub sections, the Free Tools menu and the "More free tools" links on each tool page (its own group first).
// Grouped by the job: before kick-off, after the whistle, competitions, the club's own admin.
export const TOOL_GROUPS: ToolGroup[] = [
  {
    id: 'team-and-subs',
    short: 'Team & subs',
    heading: 'Pick the team and the subs',
    blurb: 'Before kick-off: post the lineup and share fair minutes for every player.',
    main: [LINEUP_TOOL, PLAYING_TIME_TOOL],
    formats: [...LINEUP_FORMAT_PAGES, ...PLAYING_TIME_FORMAT_PAGES],
  },
  {
    id: 'graphics-and-cards',
    short: 'Graphics & cards',
    heading: 'Graphics and player cards',
    blurb: 'After the whistle: share the score and the Player of the Match, and make award cards for your players.',
    main: [RESULT_TOOL, PLAYER_CARD_TOOL],
    formats: [...RESULT_FORMAT_PAGES, ...PLAYER_CARD_FORMAT_PAGES],
  },
  {
    id: 'tournaments',
    short: 'Tournaments',
    heading: 'Tournaments and cups',
    blurb: 'Draw the fixtures and share a live page with tables and a bracket.',
    main: [TOURNAMENT_TOOL],
    formats: TOURNAMENT_FORMAT_PAGES,
  },
  {
    id: 'club-admin',
    short: 'Club admin',
    heading: 'Running the club',
    blurb: 'Work out what to charge for the season so the club breaks even.',
    main: [SEASON_FEE_TOOL],
    formats: [],
  },
];

/** The format pages that open a main tool with different defaults, shown as buttons on its /tools card */
export const TOOL_FORMATS: Record<string, ToolPageLink[]> = {
  [LINEUP_TOOL.path]: LINEUP_FORMAT_PAGES,
  [PLAYING_TIME_TOOL.path]: PLAYING_TIME_FORMAT_PAGES,
  [RESULT_TOOL.path]: RESULT_FORMAT_PAGES,
  [PLAYER_CARD_TOOL.path]: PLAYER_CARD_FORMAT_PAGES,
  [TOURNAMENT_TOOL.path]: TOURNAMENT_FORMAT_PAGES,
};

/** The public grounds directory, listed with the tools on /tools and in the Free Tools menu */
export const GROUNDS_LINK: ToolPageLink = { path: '/grounds', label: 'Football grounds directory', blurb: 'Pitches, parking and directions by suburb' };

export const MAIN_TOOLS = TOOL_GROUPS.flatMap(g => g.main);

/** When the tool pages last changed: shown as "Updated" under each heading and as dateModified. Bump it when a tool changes. */
export const TOOLS_UPDATED = '2026-10-16';

export function formatUpdated(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

const slugOf = (path: string) => path.split('/').pop() || 'tools';

/** The 1200x630 share image (public/images/tools/og), made from the tool's example output */
export function toolOgImage(path: string): string {
  return `/images/tools/og/${slugOf(path)}.jpg`;
}

export interface ToolExample {
  src: string;
  width: number;
  height: number;
  alt: string;
  caption: string;
}

// A real output of each tool (public/images/tools), made by running the tool with example teams and players
const EXAMPLES: Record<string, Omit<ToolExample, 'src'>> = {
  'lineup-builder': { width: 800, height: 1000, alt: 'Starting XI graphic for Riverside Rovers in a 4-3-3 with shirt-number jerseys on a pitch, made with the free football lineup builder', caption: 'A starting XI with jersey icons, downloaded as a 4:5 post.' },
  '11-a-side-lineup-builder': { width: 800, height: 1000, alt: '11-a-side starting XI graphic in a 4-3-3 with eleven named players on a pitch, made with the free 11-a-side lineup builder', caption: 'An 11-a-side team sheet in a 4-3-3, ready for Instagram or the team chat.' },
  '9-a-side-lineup-builder': { width: 800, height: 1000, alt: '9-a-side starting nine graphic in a 3-3-2 with nine named players on a pitch, made with the free 9-a-side lineup builder', caption: 'A 9-a-side team sheet in a 3-3-2, downloaded as a 4:5 post.' },
  '7-a-side-lineup-builder': { width: 800, height: 1000, alt: '7-a-side starting seven graphic in a 2-3-1 with seven named players on a pitch, made with the free 7-a-side lineup builder', caption: 'A 7-a-side team sheet in a 2-3-1, downloaded as a 4:5 post.' },
  '5-a-side-formation-builder': { width: 800, height: 1000, alt: '5-a-side team graphic in the 1-2-1 diamond with five named players on a pitch, made with the free 5-a-side formation builder', caption: 'A 5-a-side team in the 1-2-1 diamond, downloaded as a 4:5 post.' },
  'equal-playing-time-calculator': { width: 800, height: 716, alt: 'Rotation chart for a 9-a-side squad of 13 over 60 minutes: one keeper all game and every outfield player on for 40 minutes, made with the free equal playing time calculator', caption: '13 players, 9-a-side, 2 × 30 minutes, same keeper all game: everyone else gets 40 minutes.' },
  '9-a-side-substitution-planner': { width: 800, height: 716, alt: 'Rotation chart for 13 players in a 9-a-side match of 2 × 30 minutes, with each player on for 41 or 42 minutes, made with the free 9-a-side substitution planner', caption: '13 players over 2 × 30 minutes: every player gets 41 or 42 minutes, keepers included.' },
  '7-a-side-substitution-planner': { width: 800, height: 626, alt: 'Rotation chart for 10 players in a 7-a-side match of 2 × 25 minutes, every player on for 35 minutes, made with the free 7-a-side substitution planner', caption: '10 players over 2 × 25 minutes: 35 minutes each, keepers included.' },
  '5-a-side-substitution-planner': { width: 800, height: 565, alt: 'Rotation chart for 8 players in a 5-a-side match of 2 × 20 minutes, every player on for 25 minutes with rolling subs, made with the free 5-a-side substitution planner', caption: '8 players over 2 × 20 minutes with rolling subs: 25 minutes each.' },
  'match-result-graphic-maker': { width: 800, height: 1000, alt: 'Full-time result graphic: Riverside Rovers 3, Northside United 1, with goalscorers, minutes and the Player of the Match, made with the free match result graphic maker', caption: 'A full-time result with scorers and the Player of the Match, as a 4:5 post.' },
  'player-of-the-match-graphic-maker': { width: 800, height: 1000, alt: 'Player of the Match graphic for Kai Tanaka with the 3-1 score, date and venue, made with the free Player of the Match graphic maker', caption: 'A Player of the Match card with the score, date and venue, as a 4:5 post.' },
  'player-card-maker': { width: 800, height: 964, alt: 'Black gold football player card for Kai Tanaka, ST, rated 87, with goals, assists, appearances, Player of the Match, attendance streak and attendance %, made with the free football player card maker', caption: 'A Black gold card for a striker: 21 goals and 8 assists in 20 games. Add a photo and the player stands on the card.' },
  'goalkeeper-card-maker': { width: 800, height: 964, alt: 'Silver goalkeeper card for Max Fraser, GK, rated 74, with 9 clean sheets and 41 saves in 19 games, made with the free goalkeeper card maker', caption: 'A Silver keeper card: 9 clean sheets and 41 saves in 19 games.' },
  'soccer-player-card-maker': { width: 800, height: 964, alt: 'Blue club-colours soccer player card for Noah Patel, CM, rated 82, with goals, assists, games played and attendance, made with the free soccer player card maker', caption: 'A card in the team’s own blue, for a midfielder with 12 assists.' },
  'team-of-the-week-card-maker': { width: 800, height: 964, alt: 'Team of the Week card for Kai Tanaka, ST, rated 86, black and gold with stars and a Team of the Week · Round 7 label, made with the free Team of the Week card maker', caption: 'A Team of the Week card with the round on it. Make one for each player picked.' },
  'player-of-the-month-card-maker': { width: 800, height: 964, alt: 'Player of the Month card for Kai Tanaka, ST, rated 88, royal blue with a sunburst and a Player of the Month · October label, made with the free Player of the Month card maker', caption: 'A Player of the Month card with the month on it.' },
  'tournament-maker': { width: 800, height: 976, alt: 'Group tables for an eight-team cup with two groups of four and the top two going through to the knockouts, made with the free soccer tournament maker', caption: 'Eight teams in two groups of four, with the top two going into the knockouts.' },
  'round-robin-fixture-generator': { width: 800, height: 653, alt: 'League table for a six-team round robin where everyone plays everyone once, 15 matches in total, made with the free round robin fixture generator', caption: 'Six teams in a round robin: 15 matches, and the table fills in as scores go in.' },
  'knockout-cup-bracket-maker': { width: 800, height: 1151, alt: 'Knockout bracket for an eight-team cup with four quarter-finals and two semi-finals, seeded 1 v 8, made with the free knockout cup bracket maker', caption: 'An eight-team bracket, seeded 1 v 8, 4 v 5, 2 v 7 and 3 v 6.' },
  'season-fee-calculator': { width: 800, height: 1145, alt: 'Season budget for a senior team of 18 players: a break-even fee of $524.95, $534.06 by card after Stripe fees and $590.57 in cash, made with the free season fee calculator', caption: 'The example season: 18 players, $11,380 of costs and $2,500 of sponsor and grant income.' },
};

export function toolExample(path: string): ToolExample | undefined {
  const slug = slugOf(path);
  const e = EXAMPLES[slug];
  return e && { src: `/images/tools/${slug}.webp`, ...e };
}
