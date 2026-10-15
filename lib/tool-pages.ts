// The free tools under /tools: the main tools and the format landing pages that open them with
// different defaults. Used for the sitemap, the cross-links between the pages and llms.txt.
export interface ToolPageLink {
  path: string;
  label: string;
  blurb: string;
}

export const LINEUP_TOOL: ToolPageLink = { path: '/tools/lineup-builder', label: 'Football lineup builder', blurb: '5, 7, 9 or 11-a-side, 28 formations' };
export const TOURNAMENT_TOOL: ToolPageLink = { path: '/tools/tournament-maker', label: 'Soccer tournament maker', blurb: 'Groups, knockout or league, live link' };
export const RESULT_TOOL: ToolPageLink = { path: '/tools/match-result-graphic-maker', label: 'Match result graphic maker', blurb: 'Full-time score for stories and posts' };
export const PLAYING_TIME_TOOL: ToolPageLink = { path: '/tools/equal-playing-time-calculator', label: 'Equal playing time calculator', blurb: 'Fair minutes and a sub schedule' };
export const SEASON_FEE_TOOL: ToolPageLink = { path: '/tools/season-fee-calculator', label: 'Season fee calculator', blurb: 'Break-even subs, card vs cash' };

export const LINEUP_FORMAT_PAGES: ToolPageLink[] = [
  { path: '/tools/11-a-side-lineup-builder', label: '11-a-side lineup builder', blurb: 'Opens on 4-3-3' },
  { path: '/tools/9-a-side-lineup-builder', label: '9-a-side lineup builder', blurb: 'Opens on 3-3-2' },
  { path: '/tools/7-a-side-lineup-builder', label: '7-a-side lineup builder', blurb: 'Opens on 2-3-1' },
  { path: '/tools/5-a-side-formation-builder', label: '5-a-side formation builder', blurb: 'Opens on the 1-2-1 diamond' },
];

export const TOURNAMENT_FORMAT_PAGES: ToolPageLink[] = [
  { path: '/tools/round-robin-fixture-generator', label: 'Round robin fixture generator', blurb: 'Everyone plays everyone once' },
  { path: '/tools/knockout-cup-bracket-maker', label: 'Knockout cup bracket maker', blurb: 'Single elimination with byes' },
];

export const RESULT_FORMAT_PAGES: ToolPageLink[] = [
  { path: '/tools/player-of-the-match-graphic-maker', label: 'Player of the Match graphic maker', blurb: 'MOTM card with their photo' },
];

export const PLAYING_TIME_FORMAT_PAGES: ToolPageLink[] = [
  { path: '/tools/9-a-side-substitution-planner', label: '9-a-side substitution planner', blurb: 'Sub rotation for 9v9' },
  { path: '/tools/7-a-side-substitution-planner', label: '7-a-side substitution planner', blurb: 'Sub rotation for 7v7' },
  { path: '/tools/5-a-side-substitution-planner', label: '5-a-side substitution planner', blurb: 'Rolling subs for 5v5' },
];

export const FORMAT_PAGES = [...LINEUP_FORMAT_PAGES, ...TOURNAMENT_FORMAT_PAGES, ...RESULT_FORMAT_PAGES, ...PLAYING_TIME_FORMAT_PAGES];

/** The hub page listing every tool, grouped as below */
export const TOOLS_HUB: ToolPageLink = { path: '/tools', label: 'Free football tools', blurb: 'Every free tool, no sign-up' };

export interface ToolGroup {
  id: string;
  heading: string;
  blurb: string;
  main: ToolPageLink[];
  formats: ToolPageLink[];
}

// The /tools hub sections and the "More free tools" links on each tool page (its own group first)
export const TOOL_GROUPS: ToolGroup[] = [
  {
    id: 'team-sheets',
    heading: 'Team sheets and formations',
    blurb: 'Pick a formation, name your players and download a lineup graphic for the team chat or socials.',
    main: [LINEUP_TOOL],
    formats: LINEUP_FORMAT_PAGES,
  },
  {
    id: 'matchday',
    heading: 'Matchday',
    blurb: 'Share fair minutes before kick-off, then post the full-time score and your Player of the Match.',
    main: [PLAYING_TIME_TOOL, RESULT_TOOL],
    formats: [...PLAYING_TIME_FORMAT_PAGES, ...RESULT_FORMAT_PAGES],
  },
  {
    id: 'tournaments',
    heading: 'Tournaments and cups',
    blurb: 'Draw the fixtures and get a live page with tables and a bracket that update as you enter scores.',
    main: [TOURNAMENT_TOOL],
    formats: TOURNAMENT_FORMAT_PAGES,
  },
  {
    id: 'club-money',
    heading: 'Club money',
    blurb: 'Work out what to charge for the season so the club breaks even, card fees and all.',
    main: [SEASON_FEE_TOOL],
    formats: [],
  },
];

export const MAIN_TOOLS = TOOL_GROUPS.flatMap(g => g.main);
